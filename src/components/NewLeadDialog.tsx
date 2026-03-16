import { useState } from 'react';
import { useCtrlEnter } from '@/hooks/useCtrlEnter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateLead } from '@/hooks/useLeads';
import { checkCnpjDuplicate, CnpjDuplicateResult } from '@/services/leadService';
import { toast } from 'sonner';
import { Plus, Loader2, Clipboard, AlertTriangle, Building2, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PhoneInput } from '@/components/PhoneInput';
import { CompanySearch } from '@/components/CompanySearch';
import { CnpjaResult } from '@/hooks/useCnpjaSearch';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQueryClient } from '@tanstack/react-query';

interface NewLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadCreated?: (leadId: string) => void;
}

// Input with paste button
const InputWithPaste = ({
  id,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  id: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) => {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text);
      toast.success('Texto colado');
    } catch {
      toast.error('Não foi possível acessar a área de transferência');
    }
  };

  return (
    <div className="relative flex items-center">
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background pr-9"
      />
      <button
        type="button"
        onClick={handlePaste}
        className="absolute right-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
        title="Colar da área de transferência"
      >
        <Clipboard className="h-4 w-4" />
      </button>
    </div>
  );
};

interface DuplicateInfo {
  reason: 'lead' | 'account' | 'opportunity';
  leadId?: string;
  leadName?: string;
  leadCompany?: string;
  accountId?: string;
  accountName?: string;
  oppStage?: string;
}

export const NewLeadDialog = ({ open, onOpenChange, onLeadCreated }: NewLeadDialogProps) => {
  const createLeadMutation = useCreateLead();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Form fields
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phone2, setPhone2] = useState('');
  const [source, setSource] = useState('');
  const [cnpj, setCnpj] = useState('');

  // Store full CNPJá result for enrichment
  const [cnpjaData, setCnpjaData] = useState<CnpjaResult | null>(null);

  // Duplicate state
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);

  const mapDuplicateResult = (result: CnpjDuplicateResult): DuplicateInfo | null => {
    if (!result.isDuplicate || !result.reason) return null;
    return {
      reason: result.reason,
      leadId: result.existingLeadId,
      leadName: result.existingLeadName,
      leadCompany: result.existingLeadCompany,
      accountId: result.existingAccountId,
      accountName: result.existingAccountName,
      oppStage: result.existingOppStage,
    };
  };

  const handleCompanySelect = async (result: CnpjaResult) => {
    const cleanCnpj = (result.cnpj || '').replace(/\D/g, '');
    if (cleanCnpj.length === 14) {
      const dupCheck = await checkCnpjDuplicate(result.cnpj);
      const info = mapDuplicateResult(dupCheck);
      if (info) {
        setDuplicateInfo(info);
        resetForm();
        return;
      }
    }

    setDuplicateInfo(null);
    setCompany(result.razao_social || result.nome_fantasia || company);
    setCnpj(result.cnpj || '');
    setCnpjaData(result);
    if (result.email && !email) setEmail(result.email);
    if (result.phone && !phone) setPhone(result.phone);
    if (result.phone_2 && !phone2) setPhone2(result.phone_2);
    toast.success(`Empresa "${result.razao_social || result.nome_fantasia}" selecionada`);
  };



  const isLoading = createLeadMutation.isPending;
  const canSubmit = !isLoading && !!name.trim() && !!company.trim() && !!phone.trim() && !!source;
  useCtrlEnter(() => handleSubmit(), open && canSubmit);

  const resetForm = () => {
    setName('');
    setCompany('');
    setEmail('');
    setPhone('');
    setPhone2('');
    setSource('');
    setCnpj('');
    setCnpjaData(null);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !company.trim() || !source) {
      toast.error('Nome, empresa e fonte são obrigatórios');
      return;
    }

    if (!phone.trim()) {
      toast.error('Preencha pelo menos o Telefone 1');
      return;
    }

    // CNPJ duplicate check
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length === 14) {
      const dupCheck = await checkCnpjDuplicate(cnpj);
      const info = mapDuplicateResult(dupCheck);
      if (info) {
        setDuplicateInfo(info);
        return;
      }
    }

    try {
      const leadData: any = {
        lead_type: source === 'Outbound' ? 'OUTBOUND' : source === 'Indicação' ? 'INDICACAO' : 'INBOUND',
        name: name.trim(),
        company: company.trim(),
        email: email.trim() || '',
        phone: phone.trim() || '',
        phone_2: phone2.trim() || '',
        source: source.trim() || '',
        cnpj: cnpj.replace(/\D/g, '') || '',
        status: 'Novo',
        owner_user_id: '',
        last_contact_at: null,
        next_action_at: new Date(),
        attempts_count: 0,
      };

      // Enrich with full CNPJá data if available
      if (cnpjaData) {
        leadData.razao_social = cnpjaData.razao_social || '';
        leadData.nome_fantasia = cnpjaData.nome_fantasia || '';
        leadData.porte = cnpjaData.porte || null;
        leadData.capital_social = cnpjaData.capital_social || null;
        leadData.situacao_cadastral = cnpjaData.situacao_cadastral || null;
        leadData.cnae_fiscal = cnpjaData.cnae_fiscal || null;
        leadData.cnae_fiscal_descricao = cnpjaData.cnae_fiscal_descricao || null;
        // Auto-fill company_segment from cnae_fiscal_descricao
        if (cnpjaData.cnae_fiscal_descricao) {
          leadData.company_segment = cnpjaData.cnae_fiscal_descricao;
        }
        leadData.cnaes_secundarios = cnpjaData.cnaes_secundarios || null;
        leadData.data_inicio_atividade = cnpjaData.data_inicio_atividade || null;
        leadData.logradouro = cnpjaData.logradouro || null;
        leadData.numero = cnpjaData.numero || null;
        leadData.complemento = cnpjaData.complemento || null;
        leadData.bairro = cnpjaData.bairro || null;
        leadData.city = cnpjaData.city || null;
        leadData.state = cnpjaData.state || null;
        leadData.cep = cnpjaData.cep || null;
        if (cnpjaData.phone_2 && !phone2.trim()) {
          leadData.phone_2 = cnpjaData.phone_2;
        }
      }

      const createdLead = await createLeadMutation.mutateAsync(leadData);

      toast.success('Lead criado com sucesso!');
      onLeadCreated?.(createdLead.id);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : (error as any)?.message || 'Erro desconhecido';
      if (errMsg.includes('leads_cnpj_unique') || errMsg.includes('duplicate key')) {
        toast.error('Este CNPJ já está cadastrado na base. Verifique os clientes existentes.');
      } else {
        toast.error(`Erro ao criar lead: ${errMsg}`);
      }
      console.error('Error creating lead:', error);
    }
  };

  const getDuplicateMessage = () => {
    if (!duplicateInfo) return null;
    switch (duplicateInfo.reason) {
      case 'lead':
        return (
          <>
            Este CNPJ já está vinculado ao lead <strong>"{duplicateInfo.leadName}"</strong> ({duplicateInfo.leadCompany}).
          </>
        );
      case 'account':
        return (
          <>
            Este CNPJ já está cadastrado na conta <strong>"{duplicateInfo.accountName}"</strong>. Não é possível criar um lead duplicado.
          </>
        );
      case 'opportunity':
        return (
          <>
            Este CNPJ pertence à conta <strong>"{duplicateInfo.accountName}"</strong> que possui uma oportunidade ativa no estágio <strong>"{duplicateInfo.oppStage}"</strong>. Não é possível criar um lead duplicado.
          </>
        );
    }
  };

  const getDuplicateIcon = () => {
    if (!duplicateInfo) return AlertTriangle;
    switch (duplicateInfo.reason) {
      case 'account': return Building2;
      case 'opportunity': return Briefcase;
      default: return AlertTriangle;
    }
  };

  const DuplicateIcon = getDuplicateIcon();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setDuplicateInfo(null); onOpenChange(v); }}>
      <DialogContent className="bg-card max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Novo Lead
          </DialogTitle>
          <DialogDescription>
            Adicione um novo lead ao seu pipeline de prospecção
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Company Search via CNPJá */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Buscar empresa por nome ou CNPJ (CNPJá)</Label>
            <CompanySearch onSelect={handleCompanySelect} placeholder="Digite o nome ou CNPJ da empresa..." />
          </div>

          {/* Duplicate Info Card */}
          {duplicateInfo && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <DuplicateIcon className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">
                    {duplicateInfo.reason === 'lead' ? 'CNPJ já cadastrado como Lead' :
                     duplicateInfo.reason === 'account' ? 'CNPJ já cadastrado como Conta' :
                     'CNPJ com oportunidade ativa'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {getDuplicateMessage()}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDuplicateInfo(null)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}

          {/* Name and Company */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Contato *</Label>
              <InputWithPaste id="name" placeholder="Nome do contato" value={name} onChange={setName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Empresa *</Label>
              <InputWithPaste id="company" placeholder="Nome da empresa" value={company} onChange={setCompany} />
            </div>
          </div>

          {/* Telefone 1 and Telefone 2 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone 1 *</Label>
              <PhoneInput value={phone} onChange={setPhone} placeholder="(00) 0000-0000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone2">Telefone 2</Label>
              <PhoneInput value={phone2} onChange={setPhone2} placeholder="(00) 0000-0000" />
            </div>
          </div>

          {/* Email and Source */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <InputWithPaste id="email" type="email" placeholder="email@empresa.com" value={email} onChange={setEmail} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Fonte *</Label>
              <div className="flex gap-2 h-9">
                {['Inbound', 'Outbound', 'Indicação'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSource(source === opt ? '' : opt)}
                    className={cn(
                      'flex-1 px-3 text-sm rounded-md border transition-all font-medium',
                      source === opt
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Criar Lead
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
