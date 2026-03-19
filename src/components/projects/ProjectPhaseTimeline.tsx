import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { PHASE_LABELS } from '@/types/project';
import { Check, Circle, ChevronDown, History, ClipboardCheck, Code2, Palette, GraduationCap, Rocket, ShieldCheck, Clock, Cog, Brain, RadioTower } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTimeBR } from '@/utils/dateFormat';
import { differenceInDays, differenceInHours } from 'date-fns';

interface Phase {
  id: string;
  phase_name: string;
  status: string;
  is_active: boolean | null;
  started_at: string | null;
  completed_at: string | null;
  assigned_user_id: string | null;
}

interface Transition {
  id: string;
  phase_name: string;
  status: string;
  entered_at: string;
  exited_at: string | null;
  duration_minutes: number | null;
  changed_by_profile?: { name: string } | null;
}

interface ProjectPhaseTimelineProps {
  phases: Phase[];
  onStatusChange?: (phaseId: string, phaseName: string, newStatus: string, oldStatus: string) => void;
  availableStatuses?: Record<string, string[]>;
  canEdit?: boolean;
  transitions?: Transition[];
  assignedUsers?: Record<string, { name: string; avatar_url: string | null } | null>;
}

const PHASE_ICONS: Record<string, React.ReactNode> = {
  validacao: <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={1.5} />,
  ux_po: <Palette className="h-3.5 w-3.5" strokeWidth={1.5} />,
  dev_chatbot: <Code2 className="h-3.5 w-3.5" strokeWidth={1.5} />,
  treinamento: <GraduationCap className="h-3.5 w-3.5" strokeWidth={1.5} />,
  ativacao: <Rocket className="h-3.5 w-3.5" strokeWidth={1.5} />,
  verificacao_bm: <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />,
  automacao: <Cog className="h-3.5 w-3.5" strokeWidth={1.5} />,
  curadoria_ia: <Brain className="h-3.5 w-3.5" strokeWidth={1.5} />,
  go_live_assistido: <RadioTower className="h-3.5 w-3.5" strokeWidth={1.5} />,
};

const STATUS_CATEGORIES: { label: string; color: string; statuses: string[] }[] = [
  {
    label: 'Não iniciado',
    color: 'text-muted-foreground',
    statuses: ['BACKLOG'],
  },
  {
    label: 'Ativo',
    color: 'text-info',
    statuses: [
      // validacao
      'EM ANÁLISE', 'DADOS INCOMPLETOS', 'VALIDADO',
      // ux_po
      'MAPEAMENTO DE PROCESSOS', 'MONTAGEM DE FLUXO', 'REVISÃO INTERNA', 'APROVAÇÃO DO CLIENTE', 'AJUSTES',
      // dev_chatbot
      'DESENVOLVIMENTO', 'QA', 'REVISÃO',
      // treinamento
      'AGENDAMENTO', 'MATERIAL PREPARADO', 'TREINAMENTO REALIZADO',
      // ativacao
      'EM ANDAMENTO', 'COM PENDÊNCIA',
      'CONFIGURAÇÃO', 'TESTES', 'GO-LIVE',
      // verificacao_bm
      'EM CONTATO', 'REUNIÃO AGENDADA', 'AGUARDANDO CLIENTE', 'AGUARDANDO META', 'EM VERIFICAÇÃO', 'PENDENTE META', 'APROVADO',
      // automacao
      'EM DESENVOLVIMENTO', 'EM TESTE',
      // curadoria_ia
      'EM PROCESSO DE CURADORIA', 'GESTÃO DE PENDÊNCIAS',
      // go_live_assistido
      'EM ACOMPANHAMENTO',
    ],
  },
  {
    label: 'Pausado',
    color: 'text-warning',
    statuses: [
      'PAUSADO', 'EM PAUSA',
    ],
  },
  {
    label: 'Cancelado',
    color: 'text-destructive',
    statuses: ['CANCELADO'],
  },
  {
    label: 'Fechado',
    color: 'text-success',
    statuses: ['CONCLUÍDO'],
  },
];

const STATUS_DOT_COLORS: Record<string, string> = {
  'BACKLOG': 'bg-muted-foreground/30',
  'EM ANÁLISE': 'bg-chart-5',
  'DADOS INCOMPLETOS': 'bg-destructive/70',
  'VALIDADO': 'bg-chart-3/80',
  'MAPEAMENTO DE PROCESSOS': 'bg-chart-4/80',
  'MONTAGEM DE FLUXO': 'bg-chart-4',
  'REVISÃO INTERNA': 'bg-chart-2',
  'APROVAÇÃO DO CLIENTE': 'bg-chart-5',
  'AJUSTES': 'bg-chart-5/80',
  'DESENVOLVIMENTO': 'bg-chart-4',
  'QA': 'bg-chart-5/80',
  'REVISÃO': 'bg-chart-2',
  'AGENDAMENTO': 'bg-chart-4/80',
  'MATERIAL PREPARADO': 'bg-chart-5',
  'TREINAMENTO REALIZADO': 'bg-chart-3/80',
  'CONFIGURAÇÃO': 'bg-chart-4/80',
  'TESTES': 'bg-chart-5/80',
  'GO-LIVE': 'bg-chart-3',
  'EM VERIFICAÇÃO': 'bg-chart-5',
  'PENDENTE META': 'bg-chart-5/80',
  'APROVADO': 'bg-chart-3/80',
  'CONCLUÍDO': 'bg-chart-3',
  // ativacao
  'EM ANDAMENTO': 'bg-chart-4',
  'COM PENDÊNCIA': 'bg-destructive/70',
  // verificacao_bm
  'EM CONTATO': 'bg-chart-4/80',
  'REUNIÃO AGENDADA': 'bg-chart-5',
  'AGUARDANDO CLIENTE': 'bg-chart-5/80',
  'AGUARDANDO META': 'bg-chart-2',
  'PAUSADO': 'bg-chart-5/60',
  'CANCELADO': 'bg-destructive/60',
  // automacao
  'EM DESENVOLVIMENTO': 'bg-chart-4',
  'EM TESTE': 'bg-chart-5/80',
  // curadoria_ia
  'EM PROCESSO DE CURADORIA': 'bg-chart-4',
  'EM PAUSA': 'bg-chart-5/60',
  'GESTÃO DE PENDÊNCIAS': 'bg-chart-2',
  // go_live_assistido
  'EM ACOMPANHAMENTO': 'bg-chart-4',
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  'BACKLOG': 'bg-muted/40 text-muted-foreground border border-border/20',
  'CONCLUÍDO': 'bg-chart-3/10 text-chart-3 border border-chart-3/20',
};

function getStatusBadgeColor(status: string): string {
  return STATUS_BADGE_COLORS[status] || 'bg-info/10 text-info border border-info/20';
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `${d}d${rh > 0 ? ` ${rh}h` : ''}`;
}

function getTimeInStatus(phase: Phase): string | null {
  if (phase.status === 'CONCLUÍDO' || phase.status === 'BACKLOG') return null;
  // Find the latest transition or use started_at
  const ref = phase.started_at;
  if (!ref) return null;
  const now = new Date();
  const start = new Date(ref);
  const days = differenceInDays(now, start);
  if (days > 0) return `${days}d`;
  const hours = differenceInHours(now, start);
  if (hours > 0) return `${hours}h`;
  return '<1h';
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export function ProjectPhaseTimeline({ phases, onStatusChange, availableStatuses, canEdit, transitions = [], assignedUsers = {} }: ProjectPhaseTimelineProps) {
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({});
  const [showAllPhases, setShowAllPhases] = useState(false);

  if (!phases.length) return null;

  const transitionsByPhase = transitions.reduce<Record<string, Transition[]>>((acc, t) => {
    if (!acc[t.phase_name]) acc[t.phase_name] = [];
    acc[t.phase_name].push(t);
    return acc;
  }, {});

  const toggleHistory = (phaseName: string) => {
    setOpenHistory(prev => ({ ...prev, [phaseName]: !prev[phaseName] }));
  };

  // Find the active phase (or last completed if none active)
  const activePhase = phases.find(p => p.is_active && p.status !== 'CONCLUÍDO');
  const displayPhases = showAllPhases ? phases : (activePhase ? [activePhase] : phases.slice(0, 1));

  const completedCount = phases.filter(p => p.status === 'CONCLUÍDO').length;
  const totalCount = phases.length;

  return (
    <div className="relative">
      {/* Summary when collapsed */}
      {!showAllPhases && totalCount > 1 && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 flex items-center gap-1.5">
            {phases.map((p, i) => (
              <div
                key={p.id}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  p.status === 'CONCLUÍDO' ? 'bg-chart-3/80' : p.is_active ? 'bg-primary' : 'bg-muted/40',
                )}
                title={PHASE_LABELS[p.phase_name] || p.phase_name}
              />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground/50 font-mono">{completedCount}/{totalCount}</span>
        </div>
      )}

      {/* Vertical connector line (only when expanded) */}
      {showAllPhases && <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border/30" />}

      <div className="space-y-0">
        {displayPhases.map((phase, idx) => {
          const isCompleted = phase.status === 'CONCLUÍDO';
          const isActive = phase.is_active && !isCompleted;
          const statuses = availableStatuses?.[phase.phase_name] || [];
          const phaseTransitions = transitionsByPhase[phase.phase_name] || [];
          const hasHistory = phaseTransitions.length > 0;
          const isHistoryOpen = !!openHistory[phase.phase_name];
          const assignedUser = assignedUsers[phase.phase_name] || null;
          const icon = PHASE_ICONS[phase.phase_name] || <Circle className="h-3.5 w-3.5" />;
          const timeInStatus = isActive ? getTimeInStatus(phase) : null;

          return (
            <div key={phase.id}>
              <div className={cn(
                'flex items-center gap-3 pl-1 pr-2 py-2 rounded-lg transition-all group relative',
                isActive && 'bg-card dark:bg-muted/20 shadow-sm border border-border/30 dark:border-border/20',
                !isActive && !isCompleted && 'hover:bg-card/60 dark:hover:bg-muted/10',
              )}>
                {/* Phase indicator node */}
                <div className={cn(
                  'relative z-10 flex items-center justify-center h-[30px] w-[30px] rounded-full flex-shrink-0 transition-colors',
                  isCompleted && 'bg-chart-3/10 text-chart-3',
                  isActive && 'bg-primary/10 text-primary ring-2 ring-primary/20',
                  !isActive && !isCompleted && 'bg-muted/40 text-muted-foreground/40',
                )}>
                  {isCompleted ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : icon}
                </div>

                {/* Phase name + time in status */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className={cn(
                    'text-xs',
                    isCompleted && 'text-muted-foreground/40',
                    isActive && 'text-foreground font-semibold',
                    !isActive && !isCompleted && 'text-foreground/60 font-medium',
                  )}>
                    {PHASE_LABELS[phase.phase_name] || phase.phase_name}
                  </span>
                  {timeInStatus && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/50 font-mono">
                      <Clock className="h-2.5 w-2.5" strokeWidth={1.5} />
                      {timeInStatus}
                    </span>
                  )}
                </div>

                {/* Right side: avatar + history + status */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {assignedUser && (
                    <Avatar className="h-5 w-5 text-[8px]">
                      {assignedUser.avatar_url && (
                        <AvatarImage src={assignedUser.avatar_url} alt={assignedUser.name} />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-[8px]">
                        {getInitials(assignedUser.name)}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  {hasHistory && (
                    <button
                      onClick={() => toggleHistory(phase.phase_name)}
                      className={cn(
                        'p-1 rounded transition-colors',
                        isHistoryOpen ? 'text-muted-foreground/60' : 'text-muted-foreground/20 hover:text-muted-foreground/50',
                      )}
                      title="Histórico"
                    >
                      <History className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                  )}

                  {!isCompleted && (
                    <div>
                      {canEdit && statuses.length > 0 ? (
                        <StatusPickerPopover
                          currentStatus={phase.status}
                          availableStatuses={statuses}
                          onSelect={(newStatus) => onStatusChange?.(phase.id, phase.phase_name, newStatus, phase.status)}
                        />
                      ) : (
                        <span className={cn(
                          'inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-0.5 rounded-full',
                          getStatusBadgeColor(phase.status),
                        )}>
                         <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', STATUS_DOT_COLORS[phase.status] || 'bg-muted-foreground/30')} />
                          <span className="max-w-[100px] truncate">{phase.status}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Inline history */}
              {hasHistory && (
                <Collapsible open={isHistoryOpen}>
                  <CollapsibleContent>
                    <div className="ml-[42px] pl-3 py-0.5 mb-1 border-l border-border/20">
                      {phaseTransitions.map((t) => {
                        const durationStr = formatDuration(t.duration_minutes);
                        return (
                          <div key={t.id} className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground/50">
                            <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', STATUS_DOT_COLORS[t.status] || 'bg-muted-foreground/30')} />
                            <span className="font-medium text-foreground/60">{t.status}</span>
                            <span>•</span>
                            <span>{formatDateTimeBR(t.entered_at)}</span>
                            {durationStr && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[10px]">{durationStr}</span>
                              </>
                            )}
                            {t.changed_by_profile?.name && (
                              <>
                                <span>•</span>
                                <span className="text-muted-foreground/40">{t.changed_by_profile.name}</span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          );
        })}
      </div>

      {/* Toggle all phases button */}
      {totalCount > 1 && (
        <button
          onClick={() => setShowAllPhases(!showAllPhases)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors mt-2 py-1"
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform', showAllPhases && 'rotate-180')} strokeWidth={1.5} />
          {showAllPhases ? 'Mostrar apenas fase atual' : `Ver todas as fases (${totalCount})`}
        </button>
      )}
    </div>
  );
}

/* ClickUp-style Status Picker Popover */
function StatusPickerPopover({ currentStatus, availableStatuses, onSelect }: {
  currentStatus: string;
  availableStatuses: string[];
  onSelect: (status: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const categorized = STATUS_CATEGORIES.map(cat => ({
    ...cat,
    items: cat.statuses.filter(s => availableStatuses.includes(s)),
  })).filter(cat => cat.items.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          'inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full transition-all',
          getStatusBadgeColor(currentStatus),
          'hover:ring-1 hover:ring-border/30 cursor-pointer',
        )}>
          <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', STATUS_DOT_COLORS[currentStatus] || 'bg-muted-foreground/30')} />
          <span className="max-w-[100px] truncate">{currentStatus}</span>
          <ChevronDown className="h-2.5 w-2.5 opacity-40 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[200px] p-0">
        <div className="py-1">
          {categorized.map((cat, catIdx) => (
            <div key={cat.label}>
              {catIdx > 0 && <div className="h-px bg-border/30 my-1" />}
              <div className="px-3 py-1.5">
                <span className={cn('text-[10px] font-semibold uppercase tracking-wider', cat.color)}>{cat.label}</span>
              </div>
              {cat.items.map(status => (
                <button
                  key={status}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors text-left',
                    status === currentStatus && 'bg-muted/30 font-medium',
                  )}
                  onClick={() => { onSelect(status); setOpen(false); }}
                >
                  <span className={cn('h-2 w-2 rounded-full flex-shrink-0', STATUS_DOT_COLORS[status] || 'bg-muted-foreground/30')} />
                  <span className="flex-1">{status}</span>
                  {status === currentStatus && <Check className="h-3 w-3 text-primary" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
