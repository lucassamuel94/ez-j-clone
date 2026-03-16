import { useCallback, useMemo, useState } from 'react';
import { useCloserStages } from '@/hooks/useCloserStages';
import { useEvolutionStages } from '@/hooks/useEvolutionStages';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MessageComposer } from './MessageComposer';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  MessageSquare, Mail, Bell, PlayCircle, Settings2, Users, FileText,
  Clock, Calendar, Zap, User, AlertTriangle, TrendingUp, Info, Eye, X, Copy, Check,
  Globe, Plus, Trash2, ChevronLeft, ChevronRight, Send, Shield, History,
} from 'lucide-react';
import { MessageDispatchLogs } from './MessageDispatchLogs';

// ── Types & constants ──

export interface FormData {
  name: string;
  message_type: string;
  title: string;
  body: string;
  is_active: boolean;
  trigger_key: string;
  trigger_module: string;
  trigger_event: string;
  trigger_phase: string;
  trigger_stage: string;
  schedule_type: string;
  schedule_time: string;
  schedule_day: number | null;
  channels: string[];
  target_type: string;
  target_departments: string[];
  target_roles: string[];
  target_user_ids: string[];
  target_group_id: string;
  dynamic_recipients: string[];
  ai_enabled: boolean;
  ai_prompt: string;
  webhook_urls: string[];
}

export const EMPTY_FORM: FormData = {
  name: '', message_type: 'whatsapp', title: '', body: '',
  is_active: true, trigger_key: '', trigger_module: '', trigger_event: '', trigger_phase: '', trigger_stage: '',
  schedule_type: 'tempo_real',
  schedule_time: '', schedule_day: null, channels: ['whatsapp'], target_type: 'all',
  target_departments: [], target_roles: [], target_user_ids: [], target_group_id: '', dynamic_recipients: [],
  ai_enabled: false, ai_prompt: '',
  webhook_urls: [],
};

interface TriggerEventDef {
  key: string;
  label: string;
  description: string;
  needsStage?: boolean;
  needsPhase?: boolean;
}

const TRIGGER_MODULES: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: 'sdr', label: 'Leads', icon: <User className="h-3.5 w-3.5" /> },
  { key: 'closer', label: 'Oportunidades', icon: <Zap className="h-3.5 w-3.5" /> },
  { key: 'evolution', label: 'Evoluções', icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { key: 'projects', label: 'Projetos', icon: <Settings2 className="h-3.5 w-3.5" /> },
  { key: 'verificacao_bm', label: 'Verificação BM', icon: <Shield className="h-3.5 w-3.5" /> },
  { key: 'api_analysis', label: 'Análise de API', icon: <Globe className="h-3.5 w-3.5" /> },
];

const TRIGGER_EVENTS: Record<string, TriggerEventDef[]> = {
  sdr: [
    { key: 'lead_created', label: 'Novo lead recebido', description: 'Quando um novo lead entra no sistema' },
    { key: 'lead_meeting_scheduled', label: 'Reunião agendada', description: 'Quando uma reunião é agendada com lead' },
    { key: 'lead_opportunity_sent', label: 'Enviado ao Closer', description: 'Lead qualificado enviado ao pipeline do Closer' },
    { key: 'lead_discarded', label: 'Lead descartado', description: 'Quando um lead é marcado como descartado' },
    { key: 'lead_returned_closer', label: 'Devolvido pelo Closer', description: 'Lead retornou do Closer para o SDR' },
  ],
  closer: [
    { key: 'opp_created', label: 'Oportunidade criada', description: 'Nova oportunidade adicionada ao pipeline' },
    { key: 'opp_stage_changed', label: 'Mudança de estágio', description: 'Oportunidade mudou de estágio', needsStage: true },
    { key: 'opp_won', label: 'Ganho', description: 'Oportunidade marcada como ganha' },
    { key: 'opp_lost', label: 'Perdido', description: 'Oportunidade marcada como perdida' },
    { key: 'opp_returned_sdr', label: 'Devolvido ao SDR', description: 'Oportunidade devolvida ao SDR' },
  ],
  projects: [
    { key: 'project_created', label: 'Novo projeto', description: 'Quando um projeto é criado (manual ou oportunidade ganha)' },
    { key: 'phase_status_changed', label: 'Status alterado', description: 'Status de uma fase foi alterado', needsPhase: true, needsStage: true },
    { key: 'phase_completed', label: 'Fase concluída', description: 'Uma fase do projeto foi concluída', needsPhase: true },
    { key: 'project_delivered', label: 'Projeto entregue', description: 'Projeto finalizado e entregue ao cliente' },
  ],
  verificacao_bm: [
    { key: 'bm_created', label: 'Verificação criada', description: 'Nova verificação de BM criada' },
    { key: 'bm_status_changed', label: 'Status alterado', description: 'Status da verificação de BM foi alterado', needsStage: true },
    { key: 'bm_completed', label: 'Verificação concluída', description: 'Verificação de BM finalizada com sucesso' },
    { key: 'bm_cancelled', label: 'Verificação cancelada', description: 'Verificação de BM foi cancelada' },
  ],
  evolution: [
    { key: 'evo_created', label: 'Evolução criada', description: 'Nova oportunidade de evolução adicionada' },
    { key: 'evo_stage_changed', label: 'Mudança de estágio', description: 'Evolução mudou de estágio', needsStage: true },
    { key: 'evo_won', label: 'Ganho', description: 'Evolução marcada como ganha' },
    { key: 'evo_lost', label: 'Perdido', description: 'Evolução marcada como perdida' },
  ],
  api_analysis: [
    { key: 'api_analysis_created', label: 'Análise criada', description: 'Nova solicitação de análise de API criada' },
    { key: 'api_analysis_completed', label: 'Análise concluída', description: 'Análise de API foi concluída' },
  ],
};

const BM_STATUSES = [
  'BACKLOG', 'EM CONTATO', 'REUNIÃO AGENDADA', 'AGUARDANDO CLIENTE', 'AGUARDANDO META', 'PAUSADO', 'CANCELADO', 'CONCLUÍDO',
];

// CLOSER_STAGES and EVOLUTION_STAGES are now provided dynamically via useCloserStages/usePipelineStatuses
// Keeping as static fallback for evolution only
// Evolution stages are now dynamic via useEvolutionStages hook

const PROJECT_PHASES_OPTIONS = [
  { key: 'validacao', label: 'Validação' },
  { key: 'ux_po', label: 'UX/PO' },
  { key: 'dev_chatbot', label: 'Dev Chatbot' },
  { key: 'treinamento', label: 'Treinamento' },
  { key: 'ativacao', label: 'Ativação' },
  { key: 'verificacao_bm', label: 'Verificação BM' },
  { key: 'automacao', label: 'Automação' },
  { key: 'curadoria_ia', label: 'Curadoria de IA' },
  { key: 'go_live_assistido', label: 'Go-Live Assistido' },
];

const PHASE_STATUSES_OPTIONS: Record<string, string[]> = {
  validacao: ['BACKLOG', 'EM ANÁLISE', 'DADOS INCOMPLETOS', 'VALIDADO', 'CONCLUÍDO'],
  ux_po: ['BACKLOG', 'MAPEAMENTO DE PROCESSOS', 'MONTAGEM DE FLUXO', 'REVISÃO INTERNA', 'APROVAÇÃO DO CLIENTE', 'AJUSTES', 'CONCLUÍDO'],
  dev_chatbot: ['BACKLOG', 'DESENVOLVIMENTO', 'QA', 'REVISÃO', 'CONCLUÍDO'],
  treinamento: ['BACKLOG', 'AGENDAMENTO', 'MATERIAL PREPARADO', 'TREINAMENTO REALIZADO', 'CONCLUÍDO'],
  ativacao: ['BACKLOG', 'EM ANDAMENTO', 'COM PENDÊNCIA', 'CONCLUÍDO'],
  verificacao_bm: ['BACKLOG', 'EM CONTATO', 'REUNIÃO AGENDADA', 'AGUARDANDO CLIENTE', 'AGUARDANDO META', 'PAUSADO', 'CANCELADO', 'CONCLUÍDO'],
  automacao: ['BACKLOG', 'EM DESENVOLVIMENTO', 'EM TESTE', 'CONCLUÍDO'],
  curadoria_ia: ['BACKLOG', 'EM PROCESSO DE CURADORIA', 'EM PAUSA', 'GESTÃO DE PENDÊNCIAS', 'CONCLUÍDO'],
  go_live_assistido: ['BACKLOG', 'EM ACOMPANHAMENTO', 'CONCLUÍDO'],
};

function buildTriggerKey(module: string, event: string, phase: string, stage: string): string {
  if (module === 'custom') return event || '';
  if (!event) return '';
  const parts = [event];
  if (phase) parts.push(phase);
  if (stage) parts.push(stage);
  return parts.join(':');
}

interface Team { id: string; name: string }
interface Role { id: string; name: string }
interface SystemUser { id: string; name: string; email?: string | null; whatsapp?: string | null }
interface MessageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  editingId: string | null;
  onSave: () => void;
  onTest?: () => void;
  onForceSend?: () => void;
  isSaving: boolean;
  teams: Team[];
  roles: Role[];
  systemUsers: SystemUser[];
}

const CHANNEL_OPTIONS = [
  { key: 'whatsapp', icon: <MessageSquare className="h-4 w-4" />, label: 'WhatsApp', activeClass: 'border-[hsl(var(--success))]/50 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]' },
  { key: 'email', icon: <Mail className="h-4 w-4" />, label: 'E-mail', activeClass: 'border-[hsl(var(--info))]/50 bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]' },
  { key: 'push', icon: <Bell className="h-4 w-4" />, label: 'Push', activeClass: 'border-primary/50 bg-primary/10 text-primary' },
];

const SCHEDULE_OPTIONS: { key: string; label: string; description: string }[] = [
  { key: 'diario', label: 'Diário', description: 'Todos os dias (seg a dom), incluindo feriados' },
  { key: 'dias_uteis', label: 'Dias úteis', description: 'Seg a sex, excluindo feriados nacionais' },
  { key: 'semanal', label: 'Semanal', description: 'Uma vez por semana no dia escolhido' },
  { key: 'mensal', label: 'Mensal', description: 'Uma vez por mês no dia escolhido' },
  { key: 'manual', label: 'Manual', description: 'Apenas via teste manual' },
];

const TARGET_LABELS: Record<string, string> = {
  all: 'Todos os usuários',
  department: 'Por equipe',
  roles: 'Por cargo',
  users: 'Usuários específicos',
  group: 'Grupo WhatsApp',
  dynamic: 'Dinâmico (por contexto)',
};

const DYNAMIC_RECIPIENT_OPTIONS = [
  { key: 'closer', label: 'Closer', description: 'Vendedor da oportunidade' },
  { key: 'sdr', label: 'SDR', description: 'Pré-vendas que originou o lead' },
  { key: 'lead', label: 'Lead / Cliente', description: 'WhatsApp do prospect/cliente' },
  { key: 'head', label: 'Head Pós-Venda', description: 'Gestor de projetos' },
  { key: 'ux_po', label: 'UX/PO', description: 'Responsável UX do projeto' },
  { key: 'dev', label: 'Dev Chatbot', description: 'Desenvolvedor do projeto' },
  { key: 'treinamento', label: 'Treinamento', description: 'Responsável pelo treinamento' },
];

// ── Component ──

export function MessageFormDialog({
  open, onOpenChange, form, setForm, editingId,
  onSave, onTest, onForceSend, isSaving, teams, roles, systemUsers,
}: MessageFormDialogProps) {
  const { stages: closerStagesFromDb } = useCloserStages();
  const { activeStages: evoActiveStages } = useEvolutionStages();
  // Filter out terminal stages for trigger config
  const CLOSER_STAGES = useMemo(() => closerStagesFromDb.filter(s => s !== 'Ganho' && s !== 'Perdido'), [closerStagesFromDb]);
  const EVOLUTION_STAGES = evoActiveStages;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBody, setPreviewBody] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'message' | 'webhook' | 'logs'>('config');

  // Fetch WhatsApp groups
  const { data: whatsappGroups = [] } = useQuery({
    queryKey: ['whatsapp-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_groups')
        .select('id, name, phone_or_id, description')
        .order('name');
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; phone_or_id: string; description: string | null }>;
    },
  });

  const isEventMode = form.schedule_type === 'tempo_real';

  const toggleChannel = useCallback((ch: string) => {
    setForm(prev => ({
      ...prev,
      channels: prev.channels.includes(ch)
        ? prev.channels.filter(c => c !== ch)
        : [...prev.channels, ch],
    }));
  }, [setForm]);

  const allTeamsSelected = teams.length > 0 && teams.every(t => form.target_departments.includes(t.id));
  const someTeamsSelected = teams.some(t => form.target_departments.includes(t.id));
  const toggleAllTeams = () => {
    setForm(prev => ({ ...prev, target_departments: allTeamsSelected ? [] : teams.map(t => t.id) }));
  };

  const allRolesSelected = roles.length > 0 && roles.every(r => form.target_roles.includes(r.id));
  const someRolesSelected = roles.some(r => form.target_roles.includes(r.id));
  const toggleAllRoles = () => {
    setForm(prev => ({ ...prev, target_roles: allRolesSelected ? [] : roles.map(r => r.id) }));
  };

  const allUsersSelected = systemUsers.length > 0 && systemUsers.every(u => form.target_user_ids.includes(u.id));
  const someUsersSelected = systemUsers.some(u => form.target_user_ids.includes(u.id));
  const toggleAllUsers = () => {
    setForm(prev => ({ ...prev, target_user_ids: allUsersSelected ? [] : systemUsers.map(u => u.id) }));
  };

  // Conflict check
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const checkConflict = async () => {
    if (isEventMode || !form.schedule_time) return;
    const { data } = await supabase
      .from('automatic_messages')
      .select('id, name')
      .eq('is_active', true)
      .eq('schedule_time', form.schedule_time)
      .eq('schedule_type', form.schedule_type);
    const conflicts = (data || []).filter(m => m.id !== editingId);
    if (conflicts.length > 0) {
      setConflictWarning(`${conflicts.length} mensagem(ns) ativa(s) no mesmo horário: ${conflicts.map(c => c.name).join(', ')}`);
    } else {
      setConflictWarning(null);
    }
  };

  // Preview
  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      let text = form.ai_enabled ? form.ai_prompt : form.body;
      const mockVars: Record<string, string> = {
        lead_name: 'João Silva', empresa: 'Empresa Exemplo LTDA', sdr: 'Ana Santos',
        closer: 'Carlos Oliveira', valor: 'R$ 15.000,00', estagio: 'Negociação',
        cnpj: '12.345.678/0001-90', fase: 'Dev Chatbot', status_fase: 'EM DESENVOLVIMENTO',
        dev: 'Pedro Dev', ux_po: 'Maria UX', head: 'Paulo Head', treinamento: 'Julia Treino',
        total_agendamentos_hoje: '5', total_agendamentos_mes: '42', meta_agendamentos: '60',
        percentual_agendamentos: '70%',
        performance_sdrs: '• Ana: 3 hoje (20/25 mês - 80%)\n• Bruno: 2 hoje (22/25 mês - 88%)',
        horario: '16:30', dias_uteis_restantes: '10', dias_uteis_decorridos: '12',
        titulo_analise: 'Integração API WhatsApp Business', descricao_analise: 'Análise de viabilidade da integração com API oficial do WhatsApp',
        viabilidade: 'viavel', solicitante: 'Ana Santos', responsavel_analise: 'Pedro Dev',
        prazo_analise: '14/03/2026 18:00', status_analise: 'em_analise', link_analise: 'https://ez-journey.lovable.app/api-analysis',
      };

      if (form.ai_enabled && form.ai_prompt) {
        const { data, error } = await supabase.functions.invoke('generate-auto-message', {
          body: { action: 'generate', context: text },
        });
        if (!error && data?.text) {
          text = data.text;
          // Also update the body field with the generated preview
          setForm(p => ({ ...p, body: data.text }));
        }
      }

      text = text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => mockVars[key] ?? '');
      setPreviewBody(text);
      setPreviewOpen(true);
    } catch {
      toast.error('Erro ao gerar preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const tabStatus = useMemo(() => {
    const general = !!form.name.trim();
    const message = form.ai_enabled ? !!form.ai_prompt.trim() : !!form.body.trim();
    const webhook = form.webhook_urls.length > 0 && form.webhook_urls.some(u => u.trim());
    return { general, message, webhook };
  }, [form.name, form.body, form.ai_enabled, form.ai_prompt, form.webhook_urls]);

  const copyTriggerKey = () => {
    navigator.clipboard.writeText(form.trigger_key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1500);
  };


  // ── Render ──

  return (
    <TooltipProvider delayDuration={200}>
      <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0 overflow-hidden [&>button.absolute]:hidden" style={{ display: 'flex', flexDirection: 'column' }} onOpenAutoFocus={(e) => {
            e.preventDefault();
            setTimeout(() => {
              document.querySelector<HTMLInputElement>('[data-autofocus]')?.focus();
            }, 50);
          }}>
            <DialogHeader className="sr-only">
              <DialogTitle>{editingId ? 'Editar Mensagem' : 'Nova Mensagem Automática'}</DialogTitle>
              <DialogDescription>Configure gatilho, público-alvo e conteúdo da mensagem.</DialogDescription>
            </DialogHeader>
            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-border shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-foreground tracking-[-0.02em] font-display">
                  {editingId ? 'Editar Mensagem' : 'Nova Mensagem Automática'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure gatilho, público-alvo e conteúdo da mensagem.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {editingId && onTest && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onTest}>
                        <PlayCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Testar</TooltipContent>
                  </Tooltip>
                )}
                {editingId && onForceSend && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-warning hover:text-warning" onClick={onForceSend}>
                        <Zap className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Forçar envio</TooltipContent>
                  </Tooltip>
                )}
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer',
                    form.is_active
                      ? 'border-success/40 bg-success/10'
                      : 'border-warning/40 bg-warning/10'
                  )}
                >
                  <span className="relative flex h-2 w-2">
                    <span className={cn(
                      'absolute inline-flex h-full w-full rounded-full opacity-75',
                      form.is_active ? 'bg-success animate-ping' : 'bg-warning animate-ping'
                    )} />
                    <span className={cn(
                      'relative inline-flex h-2 w-2 rounded-full',
                      form.is_active ? 'bg-success' : 'bg-warning'
                    )} />
                  </span>
                  <span className={cn(
                    'text-xs font-medium transition-colors',
                    form.is_active ? 'text-success' : 'text-warning'
                  )}>
                    {form.is_active ? 'Ativa' : 'Inativa'}
                  </span>
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm(p => ({ ...p, is_active: v }))}
                    aria-label="Ativar ou desativar mensagem"
                    onClick={(e) => e.stopPropagation()}
                    className="scale-90"
                  />
                </button>
                <button
                  onClick={() => onOpenChange(false)}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

          {/* ── Tabs ── */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'config' | 'message' | 'webhook' | 'logs')} className="flex flex-col flex-1 min-h-0">
            <div className="px-6 pt-2 shrink-0 border-b border-border">
              <TabsList className="bg-transparent p-0 h-auto gap-6">
                <TabsTrigger
                  value="config"
                  className="bg-transparent px-0 pb-2.5 pt-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none text-muted-foreground hover:text-foreground gap-1.5 text-sm font-medium transition-all duration-150"
                >
                  <Settings2 className="h-4 w-4" />
                  Configuração
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full transition-colors',
                    tabStatus.general ? 'bg-primary' : 'bg-muted-foreground/30'
                  )} />
                </TabsTrigger>
                <TabsTrigger
                  value="message"
                  className="bg-transparent px-0 pb-2.5 pt-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none text-muted-foreground hover:text-foreground gap-1.5 text-sm font-medium transition-all duration-150"
                >
                  <FileText className="h-4 w-4" />
                  Mensagem
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full transition-colors',
                    tabStatus.message ? 'bg-primary' : 'bg-muted-foreground/30'
                  )} />
                </TabsTrigger>
                <TabsTrigger
                  value="webhook"
                  className="bg-transparent px-0 pb-2.5 pt-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none text-muted-foreground hover:text-foreground gap-1.5 text-sm font-medium transition-all duration-150"
                >
                  <Globe className="h-4 w-4" />
                  Webhook
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full transition-colors',
                    tabStatus.webhook ? 'bg-primary' : 'bg-muted-foreground/30'
                  )} />
                </TabsTrigger>
                {editingId && (
                  <TabsTrigger
                    value="logs"
                    className="bg-transparent px-0 pb-2.5 pt-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none text-muted-foreground hover:text-foreground gap-1.5 text-sm font-medium transition-all duration-150"
                  >
                    <History className="h-4 w-4" />
                    Logs
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* ── Inactive banner ── */}
            {!form.is_active && (
              <div className="mx-6 mt-3 px-3 py-2 rounded-lg border border-warning/30 bg-warning/5 flex items-center gap-2 shrink-0"
                style={{
                  backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 10px, hsl(var(--warning) / 0.04) 10px, hsl(var(--warning) / 0.04) 20px)',
                }}>
                <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                <p className="text-xs text-warning">
                  Esta mensagem está inativa — não será disparada até ser reativada.
                </p>
              </div>
            )}

            {/* ── Scroll content ── */}
            <div className={cn(
              "flex-1 overflow-y-auto px-6 py-5 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent transition-opacity duration-200",
              !form.is_active && 'opacity-50 pointer-events-none'
            )}>
              {/* ══════ TAB: CONFIGURAÇÃO ══════ */}
              <TabsContent value="config" className="mt-0 space-y-6 animate-in fade-in duration-200">

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="msg-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Nome da mensagem
                  </Label>
                  <Input
                    id="msg-name"
                    data-autofocus
                    value={form.name}
                    onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Boas-vindas novo lead"
                    className="h-10 bg-card border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Dispatch type — SegmentedControl */}
                <div className="space-y-2 mt-5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Tipo de disparo
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setForm(p => ({
                        ...p,
                        schedule_type: 'tempo_real',
                        schedule_time: '',
                        schedule_day: null,
                      }))}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border text-left transition-all duration-150',
                        isEventMode
                          ? 'border-2 border-primary bg-primary/5'
                          : 'border border-border hover:border-primary/50 hover:bg-accent/50'
                      )}
                    >
                      <div className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                        isEventMode ? 'bg-primary/15' : 'bg-muted'
                      )}>
                        <Zap className={cn('h-4 w-4', isEventMode ? 'text-primary' : 'text-muted-foreground')} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Evento do Sistema</p>
                        <p className="text-xs text-muted-foreground">Disparado por ação</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(p => ({
                        ...p,
                        schedule_type: p.schedule_type === 'tempo_real' ? 'dias_uteis' : p.schedule_type,
                        trigger_event: '',
                        trigger_phase: '',
                        trigger_stage: '',
                      }))}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border text-left transition-all duration-150',
                        !isEventMode
                          ? 'border-2 border-primary bg-primary/5'
                          : 'border border-border hover:border-primary/50 hover:bg-accent/50'
                      )}
                    >
                      <div className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                        !isEventMode ? 'bg-primary/15' : 'bg-muted'
                      )}>
                        <Calendar className={cn('h-4 w-4', !isEventMode ? 'text-primary' : 'text-muted-foreground')} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Agendado</p>
                        <p className="text-xs text-muted-foreground">Horário fixo</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* ── Event mode: trigger config ── */}
                {isEventMode && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Zap className="h-3 w-3" /> Gatilho
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Select
                        value={form.trigger_module}
                        onValueChange={(v) => {
                          const updates: Partial<FormData> = {
                            trigger_module: v,
                            trigger_event: '', trigger_phase: '', trigger_stage: '', trigger_key: '',
                          };
                          if (v === 'api_analysis') {
                            updates.target_type = 'dynamic';
                            updates.dynamic_recipients = ['closer', 'dev'];
                          }
                          setForm(p => ({ ...p, ...updates }));
                        }}
                      >
                        <SelectTrigger className="h-10 bg-card border-border">
                          <SelectValue placeholder="Módulo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {TRIGGER_MODULES.map(m => (
                            <SelectItem key={m.key} value={m.key}>
                              <span className="flex items-center gap-1.5">{m.icon} {m.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {form.trigger_module && (
                        <Select
                          value={form.trigger_event}
                          onValueChange={(v) => {
                            const newKey = buildTriggerKey(form.trigger_module, v, '', '');
                            const updates: Partial<FormData> = {
                              trigger_event: v,
                              trigger_phase: '', trigger_stage: '', trigger_key: newKey,
                            };
                            // Auto-select dynamic recipients for api_analysis module
                            if (form.trigger_module === 'api_analysis') {
                              updates.target_type = 'dynamic';
                              updates.dynamic_recipients = ['closer', 'dev'];
                            }
                            setForm(p => ({ ...p, ...updates }));
                          }}
                        >
                          <SelectTrigger className="h-10 bg-card border-border">
                            <SelectValue placeholder="Evento..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(TRIGGER_EVENTS[form.trigger_module] || []).map(ev => (
                              <SelectItem key={ev.key} value={ev.key}>
                                <div className="flex flex-col items-start text-left">
                                  <span className="text-sm">{ev.label}</span>
                                  <span className="text-[10px] text-muted-foreground">{ev.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Phase select (projects) */}
                    {(() => {
                      const evDef = (TRIGGER_EVENTS[form.trigger_module] || []).find(e => e.key === form.trigger_event);
                      if (!evDef?.needsPhase) return null;
                      return (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">Fase do Projeto</Label>
                          <Select
                            value={form.trigger_phase}
                            onValueChange={(v) => {
                              const newKey = buildTriggerKey(form.trigger_module, form.trigger_event, v, '');
                              setForm(p => ({ ...p, trigger_phase: v, trigger_stage: '', trigger_key: newKey }));
                            }}
                          >
                            <SelectTrigger className="h-10 bg-card border-border">
                              <SelectValue placeholder="Selecione a fase..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="*">Qualquer fase</SelectItem>
                              {PROJECT_PHASES_OPTIONS.map(ph => (
                                <SelectItem key={ph.key} value={ph.key}>{ph.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })()}

                    {/* Stage/Status select */}
                    {(() => {
                      const evDef = (TRIGGER_EVENTS[form.trigger_module] || []).find(e => e.key === form.trigger_event);
                      if (!evDef?.needsStage) return null;
                      if (form.trigger_module === 'closer' || form.trigger_module === 'evolution' || form.trigger_module === 'verificacao_bm') {
                        const stages = form.trigger_module === 'evolution' ? EVOLUTION_STAGES : form.trigger_module === 'verificacao_bm' ? BM_STATUSES : CLOSER_STAGES;
                        return (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Estágio</Label>
                            <Select
                              value={form.trigger_stage}
                              onValueChange={(v) => {
                                const newKey = buildTriggerKey(form.trigger_module, form.trigger_event, '', v);
                                setForm(p => ({ ...p, trigger_stage: v, trigger_key: newKey }));
                              }}
                            >
                              <SelectTrigger className="h-10 bg-card border-border">
                                <SelectValue placeholder="Selecione o estágio..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="*">Qualquer estágio</SelectItem>
                                {stages.map(s => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      }
                      if (form.trigger_module === 'projects' && form.trigger_phase && form.trigger_phase !== '*') {
                        const statuses = PHASE_STATUSES_OPTIONS[form.trigger_phase] || [];
                        return (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                            <Select
                              value={form.trigger_stage}
                              onValueChange={(v) => {
                                const newKey = buildTriggerKey(form.trigger_module, form.trigger_event, form.trigger_phase, v);
                                setForm(p => ({ ...p, trigger_stage: v, trigger_key: newKey }));
                              }}
                            >
                              <SelectTrigger className="h-10 bg-card border-border">
                                <SelectValue placeholder="Selecione o status..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="*">Qualquer status</SelectItem>
                                {statuses.map(s => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Trigger key badge */}
                    {form.trigger_key && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-card/60 border border-border">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Chave:</span>
                        <code className="text-xs font-mono bg-accent/50 text-accent-foreground px-2 py-0.5 rounded">
                          {form.trigger_key}
                        </code>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={copyTriggerKey}
                              className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
                            >
                              {copiedKey ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {copiedKey ? 'Copiado!' : 'Copiar chave'}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Scheduled mode ── */}
                {!isEventMode && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                    {/* Module selector for scheduled messages (variables context) */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <FileText className="h-3 w-3" /> Contexto das variáveis
                      </Label>
                      <Select
                        value={form.trigger_module || ''}
                        onValueChange={(v) => setForm(p => ({ ...p, trigger_module: v }))}
                      >
                        <SelectTrigger className="h-10 bg-card border-border">
                          <SelectValue placeholder="Selecione o módulo para variáveis..." />
                        </SelectTrigger>
                        <SelectContent>
                          {TRIGGER_MODULES.map(m => (
                            <SelectItem key={m.key} value={m.key}>
                              <span className="flex items-center gap-1.5">{m.icon} {m.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">
                        Define quais variáveis dinâmicas estarão disponíveis na aba Mensagem.
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
                      <div className="flex items-end gap-4">
                        <div className="space-y-2 flex-1">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3 w-3" /> Frequência
                          </Label>
                          <Select value={form.schedule_type} onValueChange={(v) => {
                            setForm(p => ({ ...p, schedule_type: v }));
                            setTimeout(checkConflict, 100);
                          }}>
                            <SelectTrigger className="h-12 bg-background border-border text-left">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SCHEDULE_OPTIONS.map(opt => (
                                <SelectItem key={opt.key} value={opt.key}>
                                  <div className="flex flex-col items-start">
                                    <span className="text-sm">{opt.label}</span>
                                    <span className="text-[10px] text-muted-foreground">{opt.description}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {['diario', 'dias_uteis'].includes(form.schedule_type) && (
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                              type="time"
                              value={form.schedule_time || '08:00'}
                              onChange={(e) => {
                                setForm(p => ({ ...p, schedule_time: e.target.value }));
                                setTimeout(checkConflict, 100);
                              }}
                              className="h-12 w-[160px] pl-9 bg-background border-border font-normal"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Schedule info alerts */}
                    {form.schedule_type === 'diario' && (
                      <div className="flex items-start gap-2.5 p-3 rounded-lg border border-[hsl(var(--info))]/20 bg-[hsl(var(--info))]/5">
                        <Info className="h-4 w-4 text-[hsl(var(--info))] shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">
                          Dispara <strong className="text-foreground">todos os dias</strong> (seg a dom), incluindo feriados.
                        </p>
                      </div>
                    )}
                    {form.schedule_type === 'dias_uteis' && (
                      <div className="flex items-start gap-2.5 p-3 rounded-lg border border-[hsl(var(--info))]/20 bg-[hsl(var(--info))]/5">
                        <Info className="h-4 w-4 text-[hsl(var(--info))] shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">
                          Dispara apenas de <strong className="text-foreground">segunda a sexta</strong>, excluindo feriados nacionais brasileiros.
                        </p>
                      </div>
                    )}

                    {form.schedule_type === 'semanal' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">Dia da Semana</Label>
                          <Select value={form.schedule_day?.toString() ?? ''} onValueChange={(v) => setForm(p => ({ ...p, schedule_day: parseInt(v) }))}>
                            <SelectTrigger className="h-10 bg-card border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Segunda-feira</SelectItem>
                              <SelectItem value="2">Terça-feira</SelectItem>
                              <SelectItem value="3">Quarta-feira</SelectItem>
                              <SelectItem value="4">Quinta-feira</SelectItem>
                              <SelectItem value="5">Sexta-feira</SelectItem>
                              <SelectItem value="6">Sábado</SelectItem>
                              <SelectItem value="0">Domingo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">Horário</Label>
                          <Input type="time" value={form.schedule_time} onChange={(e) => setForm(p => ({ ...p, schedule_time: e.target.value }))} className="h-10 bg-card border-border" />
                        </div>
                      </div>
                    )}

                    {form.schedule_type === 'mensal' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Dia do Mês</Label>
                            <Select value={form.schedule_day?.toString() ?? ''} onValueChange={(v) => setForm(p => ({ ...p, schedule_day: parseInt(v) }))}>
                              <SelectTrigger className="h-10 bg-card border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                                  <SelectItem key={d} value={d.toString()}>Dia {d}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Horário</Label>
                            <Input type="time" value={form.schedule_time} onChange={(e) => setForm(p => ({ ...p, schedule_time: e.target.value }))} className="h-10 bg-card border-border" />
                          </div>
                        </div>
                        {form.schedule_day && form.schedule_day >= 29 && (
                          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/8">
                            <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground">
                              Alguns meses têm menos dias. Nestes casos, o disparo ocorrerá no último dia do mês.
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Conflict warning */}
                    {conflictWarning && (
                      <div className="flex items-start gap-2.5 p-3 rounded-lg border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/8">
                        <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">{conflictWarning}</p>
                      </div>
                    )}

                    {/* Optional trigger_key */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Identificador (opcional)</Label>
                      <Input
                        value={form.trigger_key}
                        onChange={(e) => setForm(p => ({ ...p, trigger_key: e.target.value }))}
                        placeholder="Ex: parciais_sdr, resumo_closer"
                        className="h-10 bg-card border-border font-mono text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground/60">
                        Usado para identificar esta mensagem ao ser disparada por sistemas externos.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Channels ── */}
                <div className="space-y-2 mt-5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Canais de Envio
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {CHANNEL_OPTIONS.map(({ key, icon, label, activeClass }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleChannel(key)}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150',
                          form.channels.includes(key)
                            ? activeClass
                            : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
                        )}
                      >
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email subject */}
                {form.channels.includes('email') && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-2 fade-in duration-200">
                    <Label className="text-xs font-medium text-muted-foreground">Assunto do E-mail</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="Assunto do e-mail"
                      className="h-10 bg-card border-border"
                    />
                  </div>
                )}


                <div className="border-t border-border" />

                {/* ── Público-alvo ── */}
                <div className="space-y-2 mt-5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3 w-3" /> Público-alvo
                  </Label>
                  <Select value={form.target_type} onValueChange={(v) => setForm(p => ({ ...p, target_type: v }))}>
                    <SelectTrigger className="h-10 bg-card border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TARGET_LABELS).map(([k, l]) => (
                        <SelectItem key={k} value={k}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dynamic mode info */}
                {form.target_type === 'dynamic' && (
                  <div className="space-y-3 animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="flex items-start gap-2.5 p-3 rounded-lg border border-primary/20 bg-primary/8">
                      <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-accent-foreground">Modo Dinâmico</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          A mensagem será enviada para os papéis selecionados, usando o WhatsApp cadastrado no perfil de cada um.
                        </p>
                      </div>
                    </div>

                    <Label className="text-xs font-medium text-muted-foreground block">
                      Quem recebe esta mensagem?
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(form.trigger_module === 'api_analysis'
                        ? DYNAMIC_RECIPIENT_OPTIONS.filter(o => o.key === 'closer' || o.key === 'dev')
                        : DYNAMIC_RECIPIENT_OPTIONS
                      ).map((opt) => {
                        const selected = form.dynamic_recipients.includes(opt.key);
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              setForm(p => ({
                                ...p,
                                dynamic_recipients: selected
                                  ? p.dynamic_recipients.filter(r => r !== opt.key)
                                  : [...p.dynamic_recipients, opt.key],
                              }));
                            }}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-lg border text-left transition-all duration-150',
                              selected
                                ? 'border-2 border-primary/60 bg-primary/5'
                                : 'border border-border hover:border-primary/50 hover:bg-accent/50'
                            )}
                          >
                            <div className={cn(
                              'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                              selected ? 'bg-primary/15' : 'bg-muted'
                            )}>
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{opt.label}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{opt.description}</p>
                            </div>
                            {selected && (
                              <Check className="h-4 w-4 text-primary shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {form.dynamic_recipients.length === 0 && (
                      <p className="text-[10px] text-destructive">Selecione pelo menos um destinatário.</p>
                    )}
                  </div>
                )}

                {/* Target: teams */}
                {form.target_type === 'department' && (
                  <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                    <Label className="text-xs font-medium text-muted-foreground mb-2 block">Selecione as Equipes</Label>
                    <div className="border border-border rounded-xl p-3 space-y-0.5 max-h-60 overflow-y-auto bg-card">
                      {teams.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhuma equipe cadastrada.</p>
                      ) : (
                        <>
                          <label className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-1.5 transition-colors border-b border-border mb-1 pb-1.5">
                            <Checkbox
                              checked={allTeamsSelected}
                              ref={(el) => { if (el && someTeamsSelected && !allTeamsSelected) { el.dataset.state = 'indeterminate'; el.setAttribute('aria-checked', 'mixed'); } }}
                              onCheckedChange={toggleAllTeams}
                              aria-label="Selecionar todas as equipes"
                            />
                            <span className="text-sm font-medium text-foreground">Selecionar todas</span>
                            <span className="text-[10px] text-muted-foreground ml-auto">{form.target_departments.length}/{teams.length}</span>
                          </label>
                          {teams.map((team) => (
                            <label key={team.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-1.5 transition-colors">
                              <Checkbox
                                checked={form.target_departments.includes(team.id)}
                                onCheckedChange={(checked) => {
                                  setForm(p => ({ ...p, target_departments: checked ? [...p.target_departments, team.id] : p.target_departments.filter(d => d !== team.id) }));
                                }}
                              />
                              <span className="text-sm text-foreground">{team.name}</span>
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Target: group */}
                {form.target_type === 'group' && (
                  <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                    <Label className="text-xs font-medium text-muted-foreground mb-2 block">Selecione o Grupo</Label>
                    {whatsappGroups.length === 0 ? (
                      <div className="border border-border rounded-xl p-4 bg-card">
                        <p className="text-xs text-muted-foreground">
                          Nenhum grupo cadastrado. Cadastre grupos em{' '}
                          <span className="font-medium text-foreground">Configurações → Grupos WhatsApp</span>.
                        </p>
                      </div>
                    ) : (
                      <div className="border border-border rounded-xl p-3 space-y-0.5 max-h-60 overflow-y-auto bg-card">
                        {whatsappGroups.map((grp) => (
                          <label
                            key={grp.id}
                            className={cn(
                              'flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2 transition-colors',
                              form.target_group_id === grp.id
                                ? 'bg-primary/8 border border-primary/40'
                                : 'hover:bg-muted/50 border border-transparent'
                            )}
                          >
                            <input
                              type="radio"
                              name="target_group"
                              className="sr-only"
                              checked={form.target_group_id === grp.id}
                              onChange={() => setForm(p => ({ ...p, target_group_id: grp.id }))}
                            />
                            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Users className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{grp.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono truncate">{grp.phone_or_id}</p>
                            </div>
                            {form.target_group_id === grp.id && (
                              <Check className="h-4 w-4 text-primary shrink-0" />
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                    {form.target_group_id === '' && (
                      <p className="text-[10px] text-destructive mt-1">Selecione um grupo.</p>
                    )}
                  </div>
                )}


                {form.target_type === 'roles' && (
                  <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                    <Label className="text-xs font-medium text-muted-foreground mb-2 block">Selecione os Cargos</Label>
                    <div className="border border-border rounded-xl p-3 space-y-0.5 max-h-60 overflow-y-auto bg-card">
                      {roles.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum cargo cadastrado.</p>
                      ) : (
                        <>
                          <label className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-1.5 transition-colors border-b border-border mb-1 pb-1.5">
                            <Checkbox
                              checked={allRolesSelected}
                              ref={(el) => { if (el && someRolesSelected && !allRolesSelected) { el.dataset.state = 'indeterminate'; el.setAttribute('aria-checked', 'mixed'); } }}
                              onCheckedChange={toggleAllRoles}
                              aria-label="Selecionar todos os cargos"
                            />
                            <span className="text-sm font-medium text-foreground">Selecionar todos</span>
                            <span className="text-[10px] text-muted-foreground ml-auto">{form.target_roles.length}/{roles.length}</span>
                          </label>
                          {roles.map((role) => (
                            <label key={role.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-1.5 transition-colors">
                              <Checkbox
                                checked={form.target_roles.includes(role.id)}
                                onCheckedChange={(checked) => {
                                  setForm(p => ({ ...p, target_roles: checked ? [...p.target_roles, role.id] : p.target_roles.filter(r => r !== role.id) }));
                                }}
                              />
                              <span className="text-sm text-foreground">{role.name}</span>
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Target: users */}
                {form.target_type === 'users' && (
                  <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                    <Label className="text-xs font-medium text-muted-foreground mb-2 block">Selecione os Usuários</Label>
                    <div className="border border-border rounded-xl p-3 space-y-0.5 max-h-60 overflow-y-auto bg-card">
                      {systemUsers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum usuário encontrado.</p>
                      ) : (
                        <>
                          <label className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-1.5 transition-colors border-b border-border mb-1 pb-1.5">
                            <Checkbox
                              checked={allUsersSelected}
                              ref={(el) => { if (el && someUsersSelected && !allUsersSelected) { el.dataset.state = 'indeterminate'; el.setAttribute('aria-checked', 'mixed'); } }}
                              onCheckedChange={toggleAllUsers}
                              aria-label="Selecionar todos os usuários"
                            />
                            <span className="text-sm font-medium text-foreground">Selecionar todos</span>
                            <span className="text-[10px] text-muted-foreground ml-auto">{form.target_user_ids.length}/{systemUsers.length}</span>
                          </label>
                          {systemUsers.map((user) => {
                            const hasWhatsapp = !!user.whatsapp?.trim();
                            return (
                              <label key={user.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-1.5 transition-colors">
                                <Checkbox
                                  checked={form.target_user_ids.includes(user.id)}
                                  onCheckedChange={(checked) => {
                                    setForm(p => ({ ...p, target_user_ids: checked ? [...p.target_user_ids, user.id] : p.target_user_ids.filter(u => u !== user.id) }));
                                  }}
                                />
                                <span className="text-sm text-foreground">{user.name}</span>
                                {user.email && <span className="text-[10px] text-muted-foreground">{user.email}</span>}
                                {form.channels.includes('whatsapp') && !hasWhatsapp && (
                                  <span className="ml-auto flex items-center gap-1 text-[10px] text-[hsl(var(--warning))] shrink-0">
                                    <AlertTriangle className="h-3 w-3" /> Sem WhatsApp
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ══════ TAB: MENSAGEM ══════ */}
              <TabsContent value="message" className="mt-0 animate-in fade-in duration-200">
                <MessageComposer
                  value={form.body}
                  onChange={(body) => setForm(p => ({ ...p, body }))}
                  aiEnabled={form.ai_enabled}
                  onAiEnabledChange={(v) => setForm(p => ({ ...p, ai_enabled: v }))}
                  aiPrompt={form.ai_prompt}
                  onAiPromptChange={(v) => setForm(p => ({ ...p, ai_prompt: v }))}
                  triggerModule={form.trigger_module}
                />
              </TabsContent>

              {/* ══════ TAB: WEBHOOK ══════ */}
              <TabsContent value="webhook" className="mt-0 space-y-5 animate-in fade-in duration-200">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    URLs de Webhook
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Quando esta mensagem for disparada, uma requisição POST será enviada para cada URL configurada com o payload do evento.
                  </p>
                </div>

                <div className="space-y-3">
                  {form.webhook_urls.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={url}
                        onChange={(e) => {
                          const updated = [...form.webhook_urls];
                          updated[idx] = e.target.value;
                          setForm(p => ({ ...p, webhook_urls: updated }));
                        }}
                        placeholder="https://exemplo.com/webhook"
                        className="h-10 bg-card border-border focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-10 w-10 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setForm(p => ({
                            ...p,
                            webhook_urls: p.webhook_urls.filter((_, i) => i !== idx),
                          }));
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setForm(p => ({ ...p, webhook_urls: [...p.webhook_urls, ''] }))}
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar URL
                  </Button>
                </div>

                {form.webhook_urls.length > 0 && (
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payload enviado (exemplo)</p>
                    <pre className="text-xs text-foreground font-mono bg-background rounded-lg p-3 border border-border overflow-x-auto">
{`{
  "event": "automatic_message_triggered",
  "message_id": "${editingId || 'uuid'}",
  "message_name": "${form.name || 'Nome da mensagem'}",
  "trigger_key": "${form.trigger_key || 'trigger_key'}",
  "timestamp": "2026-03-11T10:00:00Z",
  "body": "Conteúdo da mensagem...",
  "recipients": ["user_id_1", "user_id_2"]
}`}
                    </pre>
                  </div>
                )}
               </TabsContent>

              {/* ══════ TAB: LOGS ══════ */}
              {editingId && (
                <TabsContent value="logs" className="mt-0 animate-in fade-in duration-200">
                  <MessageDispatchLogs messageId={editingId} />
                </TabsContent>
              )}
            </div>

            {/* ── Per-tab contextual footer ── */}
            <div className="border-t border-border px-6 py-3.5 flex items-center justify-between bg-background shrink-0">
              {/* Left: Cancel + contextual action */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                {activeTab === 'message' && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    onClick={handlePreview}
                    disabled={previewLoading || (!form.body.trim() && !form.ai_prompt.trim())}
                  >
                    <Eye className="h-3.5 w-3.5" /> Pré-visualizar
                  </Button>
                )}
              </div>

              {/* Center: Progress dots */}
              <div className="flex items-center gap-1.5">
                {(['config', 'message', 'webhook'] as const).map((tab) => (
                  <span
                    key={tab}
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-300',
                      activeTab === tab ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/25'
                    )}
                  />
                ))}
              </div>

              {/* Right: navigation */}
              <div className="flex items-center gap-2">
                {activeTab !== 'config' && activeTab !== 'logs' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => setActiveTab(activeTab === 'webhook' ? 'message' : 'config')}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Voltar
                  </Button>
                )}
                {activeTab === 'config' && (
                  <Button
                    size="sm"
                    className="gap-1 min-w-[90px]"
                    onClick={() => setActiveTab('message')}
                  >
                    Próximo <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                )}
                {(activeTab === 'message' || activeTab === 'webhook') && (
                  <Button
                    size="sm"
                    onClick={onSave}
                    disabled={isSaving}
                    className="min-w-[80px] gap-1.5 shadow-[0_2px_8px_hsl(var(--primary)/0.2)]"
                  >
                    {isSaving ? (
                      <span className="flex items-center gap-1.5">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Salvando…
                      </span>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" /> Salvar
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Preview modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> Exemplo de mensagem gerada
            </DialogTitle>
            <DialogDescription className="text-xs">
              Preview com dados fictícios para visualizar como a mensagem será enviada.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/40 border border-border rounded-xl p-4">
            <p className="text-sm text-foreground whitespace-pre-wrap">{previewBody || '(vazio)'}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
