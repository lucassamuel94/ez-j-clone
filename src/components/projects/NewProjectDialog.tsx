import { useState, useMemo, useCallback } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Building2, User, Settings2, ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { ProjectType, ApiType, BrokerType, ChecklistData, PROJECT_TYPE_LABELS, PHASES_BY_TYPE } from '@/types/project';
import { PhoneInput } from '@/components/PhoneInput';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ListGroup } from '@/components/kibo-ui/list';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { resolveAutoAssignments } from '@/services/projectAssignmentService';
import { cn } from '@/lib/utils';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// --- Stepper steps ---
const STEPS = [
  { id: 'type', label: 'Tipo', icon: Settings2 },
  { id: 'company', label: 'Empresa', icon: Building2 },
  { id: 'config', label: 'Configuração', icon: Settings2 },
  { id: 'contact', label: 'Responsável', icon: User },
] as const;

type StepId = (typeof STEPS)[number]['id'];

// --- Inline validation helpers ---
function validateCNPJ(cnpj: string): string | null {
  const digits = cnpj.replace(/\D/g, '');
  if (!digits) return 'CNPJ é obrigatório';
  if (digits.length !== 14) return 'CNPJ deve ter 14 dígitos';
  return null;
}

export const NewProjectDialog = ({ open, onOpenChange }: NewProjectDialogProps) => {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<StepId>('type');

  // Form state
  const [projectType, setProjectType] = useState<ProjectType>('venda');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [versao, setVersao] = useState<'V2' | 'VP' | ''>('VP');
  const [responsavelNome, setResponsavelNome] = useState('');
  const [responsavelTelefone, setResponsavelTelefone] = useState('');
  const [responsavelEmail, setResponsavelEmail] = useState('');
  const [apiType, setApiType] = useState<ApiType>('oficial');
  const [plano, setPlano] = useState('');
  const [possuiIntegracao, setPossuiIntegracao] = useState(false);
  const [quaisIntegracoes, setQuaisIntegracoes] = useState('');
  const [armazenamentoExtra, setArmazenamentoExtra] = useState('1 ano');
  const [descricaoProjeto, setDescricaoProjeto] = useState('');
  const [broker, setBroker] = useState<BrokerType>('ez');
  const [teraCoexistencia, setTeraCoexistencia] = useState(false);
  const [numeroApiOficial, setNumeroApiOficial] = useState('');

  // Touched state for inline validation
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  // --- Validation per step ---
  const stepErrors = useMemo(() => {
    const errors: Record<string, Record<string, string | null>> = {
      type: {},
      company: {},
      config: {},
      contact: {},
    };

    // Company step
    if (projectType !== 'api_oficial') {
      errors.company.razaoSocial = !razaoSocial.trim() ? 'Razão Social é obrigatória' : null;
    }
    errors.company.cnpj = validateCNPJ(cnpj);

    // Config step
    if (projectType === 'api_oficial') {
      errors.config.numeroApiOficial = !numeroApiOficial.trim() ? 'Número é obrigatório' : null;
    }

    // Contact step
    errors.contact.responsavelNome = !responsavelNome.trim() ? 'Nome do responsável é obrigatório' : null;

    return errors;
  }, [projectType, razaoSocial, cnpj, responsavelNome, numeroApiOficial]);

  const isStepValid = useCallback(
    (s: StepId): boolean => {
      const errs = stepErrors[s];
      return Object.values(errs).every((e) => e === null);
    },
    [stepErrors],
  );

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  const visibleSteps = useMemo(() => {
    // For api_oficial, config has broker-specific fields
    return STEPS;
  }, []);

  const goNext = useCallback(() => {
    const idx = visibleSteps.findIndex((s) => s.id === step);
    if (idx < visibleSteps.length - 1) {
      setStep(visibleSteps[idx + 1].id);
    }
  }, [step, visibleSteps]);

  const goPrev = useCallback(() => {
    const idx = visibleSteps.findIndex((s) => s.id === step);
    if (idx > 0) {
      setStep(visibleSteps[idx - 1].id);
    }
  }, [step, visibleSteps]);

  const resetForm = () => {
    setProjectType('venda');
    setRazaoSocial('');
    setCnpj('');
    setVersao('VP');
    setResponsavelNome('');
    setResponsavelTelefone('');
    setResponsavelEmail('');
    setApiType('oficial');
    setPlano('');
    setPossuiIntegracao(false);
    setQuaisIntegracoes('');
    setArmazenamentoExtra('1 ano');
    setDescricaoProjeto('');
    setBroker('ez');
    setTeraCoexistencia(false);
    setNumeroApiOficial('');
    setStep('type');
    setTouched({});
  };

  const isFormValid = () => {
    return STEPS.every((s) => isStepValid(s.id));
  };

  const handleSubmit = async () => {
    if (!isFormValid()) return;
    setSubmitting(true);
    try {
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
          closer_responsavel_user_id: '',
          api_type: apiType,
          plano,
          possui_integracao: possuiIntegracao,
          quais_integracoes: quaisIntegracoes,
          armazenamento_extra: armazenamentoExtra,
          descricao_projeto: descricaoProjeto,
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
          closer_responsavel_user_id: '',
          api_type: apiType,
          possui_integracao: possuiIntegracao,
          quais_integracoes: quaisIntegracoes,
          descricao_projeto: descricaoProjeto,
        };
      } else {
        checklistData = {
          type: 'api_oficial',
          razao_social: razaoSocial,
          cnpj,
          versao,
          responsavel_nome: responsavelNome,
          responsavel_telefone: responsavelTelefone,
          responsavel_email: responsavelEmail,
          broker,
          tera_coexistencia: teraCoexistencia,
          numero_api_oficial: numeroApiOficial,
          forma_pagamento: 'boleto',
        };
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Auto-assign roles
      const assignments = await resolveAutoAssignments();

      const now = new Date();
      const addBusinessDays = (start: Date, days: number): Date => {
        const result = new Date(start);
        let added = 0;
        while (added < days) {
          result.setDate(result.getDate() + 1);
          const dow = result.getDay();
          if (dow !== 0 && dow !== 6) added++;
        }
        return result;
      };
      const dueDate = addBusinessDays(now, 15);

      const phases = PHASES_BY_TYPE[projectType];
      const firstPhase = phases[0];

      const projectData: Record<string, unknown> = {
        project_type: projectType,
        created_by_user_id: user.id,
        head_user_id: assignments.head_user_id || user.id,
        ux_po_user_id: assignments.ux_po_user_id,
        dev_user_id: assignments.dev_user_id,
        treinamento_user_id: assignments.treinamento_user_id,
        checklist_data: checklistData,
        overall_status: 'ativo',
        priority: 'media',
        current_phase: firstPhase,
        company_name: projectType === 'api_oficial' ? (cnpj || 'Sem nome') : razaoSocial,
        cnpj,
        version: versao,
        contact_name: responsavelNome,
        contact_phone: responsavelTelefone,
        contact_email: responsavelEmail,
        start_date: now.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
      };

      if (projectType === 'venda' || projectType === 'evolucao' || projectType === 'migracao') {
        projectData.api_type = apiType || 'Oficial';
        projectData.has_integration = possuiIntegracao;
        projectData.integrations_description = quaisIntegracoes || null;
        projectData.project_description = descricaoProjeto || null;
        projectData.broker = 'EZ';
        projectData.storage_time = armazenamentoExtra || '1 ano';
      }
      if (projectType === 'venda' || projectType === 'migracao') {
        projectData.plan_name = plano;
      }
      if (projectType === 'api_oficial') {
        projectData.broker = broker || 'EZ';
        projectData.has_coexistence = teraCoexistencia;
        projectData.activation_phone = numeroApiOficial;
        projectData.api_type = 'Oficial';
        projectData.storage_time = '1 ano';
      }

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert(projectData as any)
        .select('id')
        .single();

      if (projectError) {
        toast.error('Erro ao criar projeto');
        return;
      }

      const projectId = project.id;

      const firstPhaseAssigneeMap: Record<string, string | null> = {
        validacao: assignments.head_user_id,
        ux_po: assignments.ux_po_user_id,
        dev_chatbot: assignments.dev_user_id,
        treinamento: assignments.treinamento_user_id,
        verificacao_bm: assignments.head_user_id,
      };
      const firstPhaseAssignee = firstPhaseAssigneeMap[firstPhase] || assignments.head_user_id || user.id;

      await supabase.from('project_phases').insert({
        project_id: projectId,
        phase_name: firstPhase,
        status: 'BACKLOG',
        sort_order: 0,
        is_active: true,
        assigned_user_id: firstPhaseAssignee,
      } as any);

      await supabase.from('project_status_transitions').insert({
        project_id: projectId,
        phase_name: firstPhase,
        status: 'BACKLOG',
        entered_at: new Date().toISOString(),
        changed_by_user_id: user.id,
      } as any);

      await supabase.from('project_activity_logs').insert({
        project_id: projectId,
        user_id: user.id,
        action_type: 'project_created',
        description: `Projeto criado manualmente (${projectType})`,
      } as any);

      // Trigger automatic messages for project creation
      supabase.functions.invoke('trigger-automatic-message', {
        body: { trigger_key: 'project_created', project_id: projectId },
      }).catch(console.error);

      const { data: headUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'head_pos_venda' as any);

      if (headUsers && headUsers.length > 0) {
        const companyName = projectType === 'api_oficial' ? (cnpj || 'Sem nome') : razaoSocial;
        const notifications = headUsers.map((u: any) => ({
          user_id: u.user_id,
          title: 'Novo projeto criado',
          message: `Novo projeto ${PROJECT_TYPE_LABELS[projectType]} - ${companyName}`,
          type: 'info',
          link: '/projects',
        }));
        await supabase.from('notifications').insert(notifications);
      }

      toast.success('Projeto criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['phase-detail'] });
      queryClient.invalidateQueries({ queryKey: ['phase-project-counts'] });

      resetForm();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Field error helper ---
  const fieldError = (stepId: StepId, field: string) => {
    if (!touched[field]) return null;
    return stepErrors[stepId]?.[field] || null;
  };

  const FieldError = ({ error }: { error: string | null }) => {
    if (!error) return null;
    return (
      <p className="flex items-center gap-1 text-[11px] text-destructive mt-1">
        <AlertCircle className="h-3 w-3" /> {error}
      </p>
    );
  };

  // --- Render steps ---
  const renderTypeStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Selecione o tipo de projeto para continuar.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.entries(PROJECT_TYPE_LABELS) as [ProjectType, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setProjectType(key)}
            className={cn(
              'group relative flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-all duration-200 hover:-translate-y-0.5',
              projectType === key
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border/40 bg-card hover:border-primary/30 hover:bg-muted/30',
            )}
          >
            {projectType === key && (
              <div className="absolute top-2 right-2">
                <Check className="h-4 w-4 text-primary" />
              </div>
            )}
            <Settings2
              className={cn(
                'h-7 w-7 transition-colors',
                projectType === key ? 'text-primary' : 'text-muted-foreground/50 group-hover:text-muted-foreground',
              )}
              strokeWidth={1.5}
            />
            <span
              className={cn(
                'text-sm font-semibold transition-colors',
                projectType === key ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
            <span className="text-[10px] text-muted-foreground/70">
              {key === 'venda' && 'Projeto completo de implementação'}
              {key === 'evolucao' && 'Melhoria em projeto existente'}
              {key === 'api_oficial' && 'Verificação de Business Manager'}
              {key === 'migracao' && 'Migração de plataforma'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderCompanyStep = () => (
    <div className="space-y-4">
      <ListGroup label="Dados da Empresa" defaultOpen>
        <div className="px-2 pb-2 space-y-3">
          {projectType !== 'api_oficial' && (
            <div className="space-y-1">
              <Label className="text-xs font-medium">Razão Social *</Label>
              <Input
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                onBlur={() => markTouched('razaoSocial')}
                placeholder="Nome da empresa"
                className={cn(
                  'h-9',
                  fieldError('company', 'razaoSocial') && 'border-destructive focus-visible:ring-destructive/30',
                )}
              />
              <FieldError error={fieldError('company', 'razaoSocial')} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">CNPJ *</Label>
              <Input
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                onBlur={() => markTouched('cnpj')}
                placeholder="00.000.000/0000-00"
                className={cn(
                  'h-9',
                  fieldError('company', 'cnpj') && 'border-destructive focus-visible:ring-destructive/30',
                )}
              />
              <FieldError error={fieldError('company', 'cnpj')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">
                {projectType === 'evolucao' ? 'Versão Atual' : 'Versão'}
              </Label>
              <Select value={versao} onValueChange={(v) => setVersao(v as 'V2' | 'VP')}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="VP">VP</SelectItem>
                  <SelectItem value="V2">V2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </ListGroup>
    </div>
  );

  const renderConfigStep = () => {
    if (projectType === 'api_oficial') {
      return (
        <div className="space-y-4">
          <ListGroup label="Configuração API Oficial" defaultOpen>
            <div className="px-2 pb-2 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Broker *</Label>
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
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Número API Oficial *</Label>
                  <PhoneInput
                    value={numeroApiOficial}
                    onChange={(v) => {
                      setNumeroApiOficial(v);
                      markTouched('numeroApiOficial');
                    }}
                  />
                  <FieldError error={fieldError('config', 'numeroApiOficial')} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2.5">
                <Label className="text-xs font-medium cursor-pointer">Terá Coexistência?</Label>
                <Switch checked={teraCoexistencia} onCheckedChange={setTeraCoexistencia} />
              </div>
            </div>
          </ListGroup>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <ListGroup label="Configurações Técnicas" defaultOpen>
          <div className="px-2 pb-2 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
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
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Plano</Label>
                  <Input value={plano} onChange={(e) => setPlano(e.target.value)} placeholder="Nome do plano" className="h-9" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2.5">
              <Label className="text-xs font-medium cursor-pointer">Possui integração?</Label>
              <Switch checked={possuiIntegracao} onCheckedChange={setPossuiIntegracao} />
            </div>

            {possuiIntegracao && (
              <div className="space-y-1">
                <Label className="text-xs font-medium">Quais integrações?</Label>
                <Textarea
                  value={quaisIntegracoes}
                  onChange={(e) => setQuaisIntegracoes(e.target.value)}
                  placeholder="Descreva as integrações..."
                  className="min-h-[60px]"
                />
              </div>
            )}

            {(projectType === 'venda' || projectType === 'migracao') && (
              <div className="space-y-1">
                <Label className="text-xs font-medium">Armazenamento Extra</Label>
                <Select value={armazenamentoExtra || '1_ano'} onValueChange={setArmazenamentoExtra}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="1_ano">1 ano</SelectItem>
                    <SelectItem value="2_anos">2 anos</SelectItem>
                    <SelectItem value="3_anos">3 anos</SelectItem>
                    <SelectItem value="4_anos">4 anos</SelectItem>
                    <SelectItem value="5_anos">5 anos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </ListGroup>

        <ListGroup label="Descrição do Projeto" defaultOpen>
          <div className="px-2 pb-2">
            <Textarea
              value={descricaoProjeto}
              onChange={(e) => setDescricaoProjeto(e.target.value)}
              placeholder="Descreva brevemente o projeto..."
              className="min-h-[80px]"
            />
          </div>
        </ListGroup>
      </div>
    );
  };

  const renderContactStep = () => (
    <div className="space-y-4">
      <ListGroup label="Dados do Responsável" defaultOpen>
        <div className="px-2 pb-2 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Nome *</Label>
            <Input
              value={responsavelNome}
              onChange={(e) => setResponsavelNome(e.target.value)}
              onBlur={() => markTouched('responsavelNome')}
              placeholder="Nome completo"
              className={cn(
                'h-9',
                fieldError('contact', 'responsavelNome') && 'border-destructive focus-visible:ring-destructive/30',
              )}
            />
            <FieldError error={fieldError('contact', 'responsavelNome')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Telefone</Label>
              <PhoneInput value={responsavelTelefone} onChange={setResponsavelTelefone} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">E-mail</Label>
              <Input
                type="email"
                value={responsavelEmail}
                onChange={(e) => setResponsavelEmail(e.target.value)}
                placeholder="email@empresa.com"
                className="h-9"
              />
            </div>
          </div>
        </div>
      </ListGroup>

      {/* Summary */}
      <ListGroup label="Resumo" defaultOpen color="hsl(var(--primary))">
        <div className="px-3 pb-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div>
              <span className="text-muted-foreground">Tipo</span>
              <p className="font-medium text-foreground">{PROJECT_TYPE_LABELS[projectType]}</p>
            </div>
            <div>
              <span className="text-muted-foreground">CNPJ</span>
              <p className="font-medium text-foreground">{cnpj || '—'}</p>
            </div>
            {projectType !== 'api_oficial' && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Empresa</span>
                <p className="font-medium text-foreground">{razaoSocial || '—'}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Responsável</span>
              <p className="font-medium text-foreground">{responsavelNome || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Versão</span>
              <p className="font-medium text-foreground">{versao || '—'}</p>
            </div>
          </div>
        </div>
      </ListGroup>
    </div>
  );

  const stepContent: Record<StepId, () => React.ReactNode> = {
    type: renderTypeStep,
    company: renderCompanyStep,
    config: renderConfigStep,
    contact: renderContactStep,
  };

  const isLastStep = currentStepIndex === visibleSteps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="bg-card max-w-2xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4.5 w-4.5 text-primary" strokeWidth={1.5} />
            Novo Projeto
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-1">
            {visibleSteps.map((s, i) => {
              const Icon = s.icon;
              const isCurrent = s.id === step;
              const isPast = i < currentStepIndex;
              const isValid = isStepValid(s.id);

              return (
                <div key={s.id} className="flex items-center gap-1 flex-1">
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 w-full',
                      isCurrent
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : isPast && isValid
                          ? 'bg-muted/40 text-foreground/70 hover:bg-muted/60'
                          : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30',
                    )}
                  >
                    {isPast && isValid ? (
                      <Check className="h-3.5 w-3.5 text-success shrink-0" strokeWidth={2} />
                    ) : (
                      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                    )}
                    <span className="truncate">{s.label}</span>
                  </button>
                  {i < visibleSteps.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="max-h-[55vh] px-6">
          <div className="pb-4">{stepContent[step]()}</div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="px-6 pb-5 pt-3 border-t border-border/30 flex-row justify-between gap-2">
          <div>
            {!isFirstStep && (
              <Button variant="ghost" size="sm" onClick={goPrev} className="gap-1.5 text-xs">
                <ChevronLeft className="h-3.5 w-3.5" /> Voltar
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              Cancelar
            </Button>
            {isLastStep ? (
              <Button size="sm" onClick={handleSubmit} disabled={!isFormValid() || submitting} className="gap-1.5 text-xs">
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Criar Projeto
              </Button>
            ) : (
              <Button size="sm" onClick={goNext} className="gap-1.5 text-xs">
                Próximo <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
