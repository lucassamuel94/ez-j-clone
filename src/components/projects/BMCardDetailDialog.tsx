import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ShieldCheck, Building2, User, Phone, Mail, Globe, Monitor, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BMData {
  cnpj: string;
  razao_social: string;
  tipo_cliente: 'NOVO' | 'BASE' | '';
  executivo: string;
  responsavel: string;
  telefone: string;
  email: string;
  site: string;
  versao_plataforma: 'VP' | 'V2' | '';
  descricao: string;
}

const EMPTY_BM: BMData = {
  cnpj: '',
  razao_social: '',
  tipo_cliente: '',
  executivo: '',
  responsavel: '',
  telefone: '',
  email: '',
  site: '',
  versao_plataforma: '',
  descricao: '',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phaseId: string;
  projectName: string;
  currentStatus: string;
  initialData?: Partial<BMData> | null;
  onSaved?: () => void;
}

export function BMCardDetailDialog({ open, onOpenChange, phaseId, projectName, currentStatus, initialData, onSaved }: Props) {
  const [form, setForm] = useState<BMData>({ ...EMPTY_BM, ...initialData });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_BM, ...initialData });
    }
  }, [open, initialData]);

  const update = (field: keyof BMData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.cnpj.trim() || !form.razao_social.trim()) {
      toast.error('CNPJ e Razão Social são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('project_phases')
        .update({ bm_data: form as any })
        .eq('id', phaseId);

      if (error) throw error;
      toast.success('Dados salvos com sucesso');
      onSaved?.();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar dados');
    } finally {
      setSaving(false);
    }
  };

  const statusColor: Record<string, string> = {
    'BACKLOG': 'bg-muted text-muted-foreground',
    'EM CONTATO': 'bg-info/10 text-info',
    'REUNIÃO AGENDADA': 'bg-primary/10 text-primary',
    'AGUARDANDO CLIENTE': 'bg-warning/10 text-warning',
    'AGUARDANDO META': 'bg-primary/10 text-primary',
    'PAUSADO': 'bg-warning/10 text-warning',
    'CANCELADO': 'bg-destructive/10 text-destructive',
    'CONCLUÍDO': 'bg-success/10 text-success',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold text-foreground">{projectName}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-semibold bg-primary/10 text-primary border-primary/20">
                  API Oficial
                </Badge>
                <Badge className={cn('text-[10px] px-2 py-0.5 border-0', statusColor[currentStatus] || 'bg-muted text-muted-foreground')}>
                  {currentStatus}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {/* Descrição */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
          <Textarea
            placeholder="Descreva os detalhes desta verificação de BM..."
            value={form.descricao}
            onChange={(e) => update('descricao', e.target.value)}
            className="min-h-[80px] text-sm"
          />
        </div>

        <Separator />

        {/* Dados obrigatórios */}
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5" /> Dados da Empresa
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* CNPJ */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">CNPJ <span className="text-destructive">*</span></Label>
              <Input
                placeholder="00.000.000/0000-00"
                value={form.cnpj}
                onChange={(e) => update('cnpj', e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* Razão Social */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Razão Social <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Razão social da empresa"
                value={form.razao_social}
                onChange={(e) => update('razao_social', e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* Tipo de Cliente */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Tipo de Cliente</Label>
              <Select value={form.tipo_cliente} onValueChange={(v) => update('tipo_cliente', v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOVO">Novo</SelectItem>
                  <SelectItem value="BASE">Base</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Executivo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Executivo</Label>
              <Input
                placeholder="Nome do executivo"
                value={form.executivo}
                onChange={(e) => update('executivo', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Dados do Contato */}
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <User className="h-3.5 w-3.5" /> Dados do Contato
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Responsável */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Responsável</Label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <Input
                  placeholder="Nome do responsável"
                  value={form.responsavel}
                  onChange={(e) => update('responsavel', e.target.value)}
                  className="h-9 text-sm pl-8"
                />
              </div>
            </div>

            {/* Telefone */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <Input
                  placeholder="(00) 00000-0000"
                  value={form.telefone}
                  onChange={(e) => update('telefone', e.target.value)}
                  className="h-9 text-sm pl-8"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <Input
                  type="email"
                  placeholder="email@empresa.com"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="h-9 text-sm pl-8"
                />
              </div>
            </div>

            {/* Site */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Site</Label>
              <div className="relative">
                <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <Input
                  placeholder="www.empresa.com.br"
                  value={form.site}
                  onChange={(e) => update('site', e.target.value)}
                  className="h-9 text-sm pl-8"
                />
              </div>
            </div>

            {/* Versão da Plataforma */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Versão da Plataforma</Label>
              <Select value={form.versao_plataforma} onValueChange={(v) => update('versao_plataforma', v)}>
                <SelectTrigger className="h-9 text-sm">
                  <Monitor className="h-3.5 w-3.5 mr-1.5 text-muted-foreground/50" />
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VP">VP</SelectItem>
                  <SelectItem value="V2">V2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
