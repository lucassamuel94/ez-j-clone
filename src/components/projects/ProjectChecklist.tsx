import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Trophy, Building2, UserCheck, Settings, FileText, FolderKanban } from 'lucide-react';
import { ProjectType, ApiType, BrokerType, ChecklistData, PROJECT_TYPE_LABELS } from '@/types/project';
import { useCreateProject } from '@/hooks/useProjects';
import { CloserOpportunity } from '@/services/closerService';
import { PhoneInput } from '@/components/PhoneInput';
import { RichTextEditor } from '@/components/RichTextEditor';
import { useCurrentUser } from '@/hooks/useCurrentUser';

import { Textarea } from '@/components/ui/textarea';

interface ProjectChecklistProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: CloserOpportunity;
  onSuccess: () => void;
  defaultProjectType?: ProjectType | null;
}

export const ProjectChecklist = ({ open, onOpenChange, opportunity, onSuccess, defaultProjectType }: ProjectChecklistProps) => {
  const createProject = useCreateProject();
  const { user: currentUser } = useCurrentUser();
  
  const [projectType, setProjectType] = useState<ProjectType>(defaultProjectType || 'venda');

  // Section 2 — Dados da Empresa
  const [razaoSocial, setRazaoSocial] = useState(opportunity.lead_razao_social || opportunity.lead_company || '');
  const [cnpj, setCnpj] = useState(opportunity.lead_cnpj || '');

  // Section 3 — Responsável do Cliente
  const [responsavelNome, setResponsavelNome] = useState(opportunity.lead_name || '');
  const [responsavelTelefone, setResponsavelTelefone] = useState(opportunity.lead_phone || '');
  const [responsavelEmail, setResponsavelEmail] = useState(opportunity.lead_email || '');

  // Section 4 — Configurações
  const [versao, setVersao] = useState<'V2' | 'VP' | ''>('VP');
  const [tempoArmazenamento, setTempoArmazenamento] = useState('1_ano');
  const [apiType, setApiType] = useState<ApiType>('oficial');
  const [plano, setPlano] = useState('');
  const [possuiIntegracao, setPossuiIntegracao] = useState(false);
  const [quaisIntegracoes, setQuaisIntegracoes] = useState('');
  const [usaIA, setUsaIA] = useState(false);

  // API Oficial fields
  const [broker, setBroker] = useState<BrokerType>('gupshup');
  const [teraCoexistencia, setTeraCoexistencia] = useState(false);
  const [numeroApiOficial, setNumeroApiOficial] = useState('');
  const [observacaoApiOficial, setObservacaoApiOficial] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<'boleto' | 'cartao'>('boleto');

  // Site da empresa
  const [siteEmpresa, setSiteEmpresa] = useState(opportunity.lead_website || '');

  // Section 5 — Descrição
  const [descricaoProjeto, setDescricaoProjeto] = useState('');

  const handleSubmit = async () => {
    let checklistData: ChecklistData;

    if (projectType === 'venda' || projectType === 'migracao') {
      checklistData = {
        type: projectType,
        razao_social: razaoSocial,
        cnpj,
        versao: versao as 'V2' | 'VP',
        responsavel_nome: responsavelNome,
        responsavel_telefone: responsavelTelefone,
        responsavel_email: responsavelEmail,
        api_type: apiType,
        plano,
        possui_integracao: possuiIntegracao,
        quais_integracoes: quaisIntegracoes,
        tempo_armazenamento: tempoArmazenamento || undefined,
        descricao_projeto: descricaoProjeto,
        website: siteEmpresa || undefined,
        usa_ia: usaIA,
      } as ChecklistData;
    } else if (projectType === 'evolucao') {
      checklistData = {
        type: 'evolucao',
        razao_social: razaoSocial,
        cnpj,
        versao_atual: versao as 'V2' | 'VP',
        responsavel_nome: responsavelNome,
        responsavel_telefone: responsavelTelefone,
        responsavel_email: responsavelEmail,
        api_type: apiType,
        possui_integracao: possuiIntegracao,
        quais_integracoes: quaisIntegracoes,
        descricao_projeto: descricaoProjeto,
        website: siteEmpresa || undefined,
        usa_ia: usaIA,
      };
    } else {
      checklistData = {
        type: 'api_oficial',
        razao_social: razaoSocial,
        cnpj,
        versao: versao as string,
        responsavel_nome: responsavelNome,
        responsavel_telefone: responsavelTelefone,
        responsavel_email: responsavelEmail,
        broker,
        tera_coexistencia: teraCoexistencia,
        numero_api_oficial: numeroApiOficial,
        forma_pagamento: formaPagamento,
        observacao: observacaoApiOficial || undefined,
        website: siteEmpresa || undefined,
      };
    }

    await createProject.mutateAsync({
      opportunity_id: opportunity.id,
      lead_id: opportunity.lead_id,
      project_type: projectType,
      checklist_data: checklistData,
      closer_user_id: currentUser?.id || opportunity.assigned_to_user_id || undefined,
      sdr_user_id: opportunity.sdr_user_id || undefined,
      closer_name: opportunity.closer_name || undefined,
      sdr_name: opportunity.sdr_name || undefined,
    });

    onSuccess();
    onOpenChange(false);
  };

  const isValid = () => {
    if (!cnpj.trim()) return false;
    if (!versao) return false;

    if (projectType === 'api_oficial') {
      return !!numeroApiOficial.trim() && !!responsavelNome.trim();
    }

    if (!razaoSocial.trim()) return false;
    if (!responsavelNome.trim()) return false;
    if ((projectType === 'venda' || projectType === 'migracao') && !tempoArmazenamento) return false;

    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card max-w-[1000px] max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <Trophy className="h-4 w-4" />
            </div>
            Checklist de Projeto — Ganho
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Preencha os dados para criar o projeto de <span className="font-medium text-foreground">{opportunity.lead_company}</span>.
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] px-6">
          <div className="space-y-4 pb-4">

            {/* Section 1 — Tipo de Projeto */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <FolderKanban className="h-3.5 w-3.5" />
                  Tipo de Projeto
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <Select value={projectType} onValueChange={(v) => setProjectType(v as ProjectType)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROJECT_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Section 2 — Dados da Empresa */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5" />
                  Dados da Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="grid grid-cols-2 gap-4">
                  {/* Razão Social - show for all project types */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Razão Social {projectType !== 'api_oficial' && <span className="text-destructive">*</span>}</Label>
                    <Input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Nome da empresa" className="h-9 placeholder:opacity-70" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">CNPJ <span className="text-destructive">*</span></Label>
                    <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" className="h-9 placeholder:opacity-70" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium">Site da Empresa</Label>
                    <Input value={siteEmpresa} onChange={(e) => setSiteEmpresa(e.target.value)} placeholder="https://www.exemplo.com.br" className="h-9 placeholder:opacity-70" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3 — Responsável do Cliente */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <UserCheck className="h-3.5 w-3.5" />
                  Responsável do Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Nome <span className="text-destructive">*</span></Label>
                    <Input value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} placeholder="Nome completo" className="h-9 placeholder:opacity-70" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Telefone</Label>
                    <PhoneInput value={responsavelTelefone} onChange={setResponsavelTelefone} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">E-mail</Label>
                    <Input type="email" value={responsavelEmail} onChange={(e) => setResponsavelEmail(e.target.value)} placeholder="email@empresa.com" className="h-9 placeholder:opacity-70" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 4 — Configurações */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Settings className="h-3.5 w-3.5" />
                  Configurações
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="grid grid-cols-2 gap-4">
                  {/* Versão */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Versão <span className="text-destructive">*</span></Label>
                    <Select value={versao} onValueChange={(v) => setVersao(v as 'V2' | 'VP')}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecionar versão..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="V2">V2</SelectItem>
                        <SelectItem value="VP">VP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tempo de Armazenamento - only for Venda */}
                  {(projectType === 'venda' || projectType === 'migracao') && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Tempo de Armazenamento <span className="text-destructive">*</span></Label>
                      <Select value={tempoArmazenamento} onValueChange={setTempoArmazenamento}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1_ano">1 ano</SelectItem>
                          <SelectItem value="2_anos">2 anos</SelectItem>
                          <SelectItem value="3_anos">3 anos</SelectItem>
                          <SelectItem value="4_anos">4 anos</SelectItem>
                          <SelectItem value="5_anos">5 anos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Venda / Evolução specific fields */}
                  {(projectType === 'venda' || projectType === 'evolucao' || projectType === 'migracao') && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Tipo de API WhatsApp</Label>
                        <Select value={apiType} onValueChange={(v) => setApiType(v as ApiType)}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="oficial">Oficial</SelectItem>
                            <SelectItem value="extra">Extra</SelectItem>
                            <SelectItem value="oficial_e_extra">Oficial e Extra</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(projectType === 'venda' || projectType === 'migracao') && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Plano</Label>
                          <Input value={plano} onChange={(e) => setPlano(e.target.value)} placeholder="Nome do plano" className="h-9 placeholder:opacity-70" />
                        </div>
                      )}

                      <div className="col-span-2 flex items-center justify-between rounded-md border px-3 py-2">
                        <Label className="text-xs font-medium">Possui integração?</Label>
                        <Switch checked={possuiIntegracao} onCheckedChange={setPossuiIntegracao} />
                      </div>

                      {possuiIntegracao && (
                        <div className="col-span-2 space-y-1.5">
                          <Label className="text-xs font-medium">Quais integrações?</Label>
                          <Textarea
                            value={quaisIntegracoes}
                            onChange={(e) => setQuaisIntegracoes(e.target.value)}
                            placeholder="Descreva as integrações..."
                            className="min-h-[60px] placeholder:opacity-70"
                          />
                        </div>
                      )}

                      <div className="col-span-2 flex items-center justify-between rounded-md border px-3 py-2">
                        <div>
                          <Label className="text-xs font-medium">Projeto terá IA?</Label>
                          <p className="text-[11px] text-muted-foreground">Marque se o projeto incluirá funcionalidades de inteligência artificial</p>
                        </div>
                        <Switch checked={usaIA} onCheckedChange={setUsaIA} />
                      </div>

                    </>
                  )}
                  {/* API Oficial specific fields */}
                  {projectType === 'api_oficial' && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Broker <span className="text-destructive">*</span></Label>
                        <Select value={broker} onValueChange={(v) => setBroker(v as BrokerType)}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gupshup">Gupshup</SelectItem>
                            <SelectItem value="hyperflow">HyperFlow</SelectItem>
                            <SelectItem value="ez">EZ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Número para API Oficial <span className="text-destructive">*</span></Label>
                        <PhoneInput value={numeroApiOficial} onChange={setNumeroApiOficial} />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Forma de Pagamento <span className="text-destructive">*</span></Label>
                        <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as 'boleto' | 'cartao')}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="boleto">Boleto</SelectItem>
                            <SelectItem value="cartao">Cartão</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-2 flex items-center justify-between rounded-md border px-3 py-2">
                        <Label className="text-xs font-medium">Terá Coexistência?</Label>
                        <Switch checked={teraCoexistencia} onCheckedChange={setTeraCoexistencia} />
                      </div>

                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-xs font-medium">Observação</Label>
                        <Textarea
                          value={observacaoApiOficial}
                          onChange={(e) => setObservacaoApiOficial(e.target.value)}
                          placeholder="Observações adicionais sobre a API Oficial..."
                          className="min-h-[80px] placeholder:opacity-70"
                        />
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Section 5 — Descrição do Projeto (Venda/Evolução only) */}
            {(projectType === 'venda' || projectType === 'evolucao' || projectType === 'migracao') && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Descrição do Projeto
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <RichTextEditor
                    content={descricaoProjeto}
                    onChange={setDescricaoProjeto}
                    placeholder="Descreva brevemente o escopo e objetivos do projeto..."
                    className="min-h-[180px]"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 pb-6 pt-2 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid() || createProject.isPending}>
            {createProject.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</>
            ) : (
              <><Trophy className="h-4 w-4 mr-2" />Confirmar Ganho e Criar Projeto</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
