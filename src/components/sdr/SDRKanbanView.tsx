import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import { usePipelineStatuses } from '@/hooks/usePipelineStatuses';
import {
  KanbanProvider,
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanOverlay,
} from '@/components/kibo-ui/kanban';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Lead, LeadStatus } from '@/types/lead';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Inbox,
  Flame,
  Loader2,
  Plus,
  Snowflake,
  Thermometer,
  ChevronDown,
  Clock,
  Trash2,
  Send,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ---------- Types ----------

export type SDRSortOption = 'priority_desc' | 'created_desc' | 'next_action_asc' | 'temperature_desc' | 'last_contact_asc';

// Re-export from useSDRStages for backward compatibility
export { useSDRStages } from '@/hooks/useSDRStages';

const TERMINAL_STATUSES: Set<string> = new Set(['Descartado', 'Oportunidade criada']);

export interface KanbanColumn {
  id: string;
  status: string;
  items: Lead[];
  total: number;
}

interface SDRKanbanViewProps {
  columns: KanbanColumn[];
  visibleStatuses: Set<string>;
  onMoveStatus: (leadId: string, newStatus: LeadStatus) => void;
  onCardClick: (lead: Lead) => void;
  onDeleteLead?: (lead: Lead) => void;
  onSendToCloser?: (lead: Lead) => void;
  getLeadHref?: (lead: Lead) => string;
  isMoving?: boolean;
  isLoading?: boolean;
  currentUserId?: string | null;
  isManager?: boolean;
  onLoadMore?: (status: string) => void;
}

// ---------- Helpers ----------

const STATUS_PROGRESS: Record<string, number> = {
  'Novo': 5,
  'Em contato': 15,
  'Ocupado': 20,
  'Agendar retorno': 25,
  'Agendar Retorno': 25,
  'Sem retorno': 25,
  'Interesse': 40,
  'Lead Quente': 40,
  'Interesse/Agendar Retorno': 45,
  'Oportunidade Futura': 45,
  'Reagendar Reunião': 50,
  'Reciclagem': 30,
  'Devolvido pelo Closer': 35,
  'Reunião agendada': 70,
  'Reunião Agendada': 70,
  'Reunião Confirmada': 80,
  'Oportunidade criada': 100,
  'Descartado': 0,
};

function getStatusProgress(status: string): number {
  return STATUS_PROGRESS[status] ?? 10;
}

// ---------- Temperature Badge ----------

function TemperatureBadge({ temperature }: { temperature: string | null | undefined }) {
  if (!temperature) return null;
  const t = temperature.toLowerCase();
  const isHot = t === 'quente';
  const isCold = t === 'frio';
  return (
    <span className={cn(
      'inline-flex items-center',
      isHot && 'text-destructive',
      isCold && 'text-info',
      !isHot && !isCold && 'text-muted-foreground'
    )} title={temperature}>
      {isHot ? <Flame className="h-3.5 w-3.5" /> : isCold ? <Snowflake className="h-3.5 w-3.5" /> : <Thermometer className="h-3.5 w-3.5" />}
    </span>
  );
}

// ---------- Card Content ----------

function CardContent({ lead, currentUserId, isManager }: { lead: Lead; currentUserId?: string | null; isManager?: boolean }) {
  const isTerminal = TERMINAL_STATUSES.has(lead.status);
  const hasNextAction = !!lead.next_action_at;
  const nextActionIsFuture = hasNextAction && new Date(lead.next_action_at!) > new Date();
  const hasSchedule = nextActionIsFuture;
  // "Atrasado" only when next_action is past AND attempts > 0 (evidence of real engagement)
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const nextActionIsRecent = hasNextAction && !nextActionIsFuture && (Date.now() - new Date(lead.next_action_at!).getTime()) < SEVEN_DAYS_MS;
  const isOverdue = !isTerminal && hasNextAction && !nextActionIsFuture && (lead.attempts_count > 0 || nextActionIsRecent);
  const progress = getStatusProgress(lead.status);
  const timeAgo = formatDistanceToNow(new Date(lead.updated_at), { addSuffix: false, locale: ptBR });
  const ownerFirst = lead.owner_name?.split(' ')[0];

  return (
    <div className={cn(
      'px-3 py-2.5 space-y-1.5',
      isOverdue && ''
    )}>
      {/* Line 1: Company */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-xs font-semibold text-foreground truncate flex-1 leading-tight">
          {lead.razao_social || lead.nome_fantasia || lead.company || 'Não informado'}
        </span>
        {isOverdue && (
          <span className="inline-flex w-2 h-2 rounded-full bg-destructive animate-pulse shrink-0" />
        )}
      </div>

      {/* Line 2: Contact + Temperature */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {lead.name && (
          <span className="text-xs text-foreground/70 truncate max-w-[140px]">
            Contato: {lead.name}
          </span>
        )}
        <TemperatureBadge temperature={lead.temperature} />
      </div>

      {/* Line 3: Next action / schedule info */}
      {!isTerminal &&
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          {nextActionIsFuture && (
            <span className="text-foreground/70 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {format(new Date(lead.next_action_at!), 'dd/MM HH:mm', { locale: ptBR })}
            </span>
          )}
          {isOverdue && (
            <span className="text-destructive font-medium text-[10px] bg-destructive/10 px-1.5 py-px rounded-full">Atrasado</span>
          )}
          {!hasSchedule && !isOverdue && (
            <span className="text-warning font-medium text-[10px] bg-warning/15 px-1.5 py-px rounded-full">Sem agendamento</span>
          )}
          {lead.attempts_count > 0 && (
            <span className="text-foreground/50 text-[10px]">
              {lead.attempts_count} tentativa{lead.attempts_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      }

      {/* Last update */}
      <div className="text-[10px] text-foreground/50">
        Última atualização: {timeAgo}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-foreground/50">
        <span>Probabilidade de fechar: {progress}%</span>
        <span className="text-[8px] font-semibold px-1 py-px rounded bg-warning/20 text-warning uppercase leading-none">beta</span>
      </div>
    </div>
  );
}

// ---------- Scroll Sentinel ----------

function ScrollSentinel({ onVisible }: { onVisible: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onVisible(); },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible]);

  return <div ref={ref} className="h-1 w-full shrink-0" />;
}

// ---------- Main Component ----------

export function SDRKanbanView({
  columns,
  visibleStatuses,
  onMoveStatus,
  onCardClick,
  onDeleteLead,
  onSendToCloser,
  getLeadHref,
  isMoving = false,
  isLoading = false,
  currentUserId,
  isManager = false,
  onLoadMore,
}: SDRKanbanViewProps) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const { getColorMap } = usePipelineStatuses();
  const statusColorMap = useMemo(() => getColorMap('sdr'), [getColorMap]);

  const allLeads = useMemo(() => columns.flatMap(c => c.items), [columns]);

  const leadMap = useMemo(() => {
    const map = new Map<string, Lead>();
    allLeads.forEach((l) => map.set(l.id, l));
    return map;
  }, [allLeads]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = event;
    if (!over) return;

    const activeLeadId = String(active.id);
    const overId = String(over.id);

    let targetStatus: LeadStatus | null = null;
    if (columns.some(c => c.status === overId)) {
      targetStatus = overId as LeadStatus;
    } else {
      const targetLead = leadMap.get(overId);
      if (targetLead) targetStatus = targetLead.status;
    }

    if (!targetStatus) return;
    const sourceLead = leadMap.get(activeLeadId);
    if (!sourceLead || sourceLead.status === targetStatus) return;
    onMoveStatus(activeLeadId, targetStatus);
  }, [leadMap, onMoveStatus]);

  const handleDragStart = useCallback((event: any) => {
    const lead = leadMap.get(String(event.active.id));
    if (lead) setActiveLead(lead);
  }, [leadMap]);

  // Loading skeleton
  if (isLoading) {
    const skeletonStatuses = columns.map(c => c.status).slice(0, 6);
    return (
      <div className="flex gap-3 overflow-x-auto pb-4">
        {skeletonStatuses.map((status) => (
          <div key={status} className="!w-[260px] sm:!w-[280px] !min-w-[260px] sm:!min-w-[280px] rounded-xl bg-muted/30 border border-border/40 flex-shrink-0">
            <div className="flex items-center justify-between p-3 border-b border-border/30">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{status}</span>
            </div>
            <div className="p-2 space-y-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border/50 bg-card p-3 space-y-2 animate-pulse">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-10 bg-muted rounded" />
                    <div className="h-4 flex-1 bg-muted rounded" />
                  </div>
                  <div className="flex gap-1.5">
                    <div className="h-4 w-16 bg-muted rounded-full" />
                    <div className="h-4 w-12 bg-muted rounded-full" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 bg-muted rounded" />
                    <div className="h-3 w-8 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (allLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Inbox className="h-10 w-10 mb-3 opacity-40" strokeWidth={1.5} />
        <p className="text-sm font-medium">Nenhum lead encontrado</p>
        <p className="text-xs mt-1">Ajuste os filtros ou aguarde novos leads.</p>
      </div>
    );
  }

  return (
    <div className="relative min-w-0 w-full flex-1 min-h-0 flex flex-col">
      {isMoving && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg">
          <div className="flex items-center gap-2 bg-card border rounded-lg px-4 py-2.5 shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs font-medium text-foreground">Movendo lead...</span>
          </div>
        </div>
      )}

      <KanbanProvider
        onDragEnd={handleDragEnd}
        onDragOver={() => {}}
        className="gap-3 overflow-x-auto overflow-y-hidden pb-4 flex-1 min-h-0"
        onDragStart={handleDragStart as any}
      >
        {columns.map(({ status, items: columnLeads, total: columnTotal }) => {
          const showMore = columnLeads.length < columnTotal;
          const remaining = columnTotal - columnLeads.length;

          return (
            <KanbanBoard
              key={status}
              id={status}
              className="!w-[260px] sm:!w-[280px] !min-w-[260px] sm:!min-w-[280px] rounded-xl bg-muted/50 dark:bg-muted/30 border border-border/40 flex flex-col max-h-full"
            >
              <div
                className="flex items-center justify-between p-3 border-b border-border/30 rounded-t-xl shrink-0"
                style={statusColorMap[status] ? {
                  backgroundColor: `${statusColorMap[status]}18`,
                } : undefined}
              >
                <div className="flex items-center gap-2">
                  {statusColorMap[status] && (
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: statusColorMap[status] }} />
                  )}
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {status}
                  </span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold tabular-nums">
                    {columnTotal}
                  </Badge>
                </div>
              </div>

              <KanbanCards items={columnLeads.map((l) => l.id)} className="min-h-[120px] p-2 gap-1.5 overflow-y-auto flex-1 min-h-0">
                {columnLeads.map((lead) => (
                  <ContextMenu key={lead.id}>
                    <ContextMenuTrigger asChild>
                      <KanbanCard
                        id={lead.id}
                        asHandle
                        className="cursor-grab active:cursor-grabbing bg-card border border-border/50 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30 transition-all duration-150 rounded-lg shadow-sm"
                        onClick={(e: React.MouseEvent) => {
                          const href = getLeadHref?.(lead);
                          if ((e.ctrlKey || e.metaKey) && href) {
                            e.preventDefault();
                            window.open(href, '_blank');
                            return;
                          }
                          if (e.button === 1 && href) {
                            e.preventDefault();
                            window.open(href, '_blank');
                            return;
                          }
                          onCardClick(lead);
                        }}
                      >
                        <CardContent lead={lead} currentUserId={currentUserId} isManager={isManager} />
                      </KanbanCard>
                    </ContextMenuTrigger>
                    {(onDeleteLead || onSendToCloser) && (
                      <ContextMenuContent>
                        {onSendToCloser && (
                          <ContextMenuItem
                            className="gap-2"
                            onClick={() => onSendToCloser(lead)}
                          >
                            <Send className="h-3.5 w-3.5" />
                            Enviar para Closer
                          </ContextMenuItem>
                        )}
                        {onDeleteLead && (
                          <ContextMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2"
                            onClick={() => onDeleteLead(lead)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir Lead
                          </ContextMenuItem>
                        )}
                      </ContextMenuContent>
                    )}
                  </ContextMenu>
                ))}

                {columnLeads.length === 0 && (
                  <div className="rounded-lg border-dashed border-2 border-border/30 p-8 text-center flex flex-col items-center gap-2">
                    <Plus className="h-4 w-4 text-muted-foreground/30" strokeWidth={1.5} />
                    <p className="text-xs text-muted-foreground/40">Nenhum lead</p>
                  </div>
                )}

                {showMore && (
                  <>
                    <ScrollSentinel onVisible={() => onLoadMore?.(status)} />
                    <button
                      type="button"
                      onClick={() => onLoadMore?.(status)}
                      className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                      Carregar mais {remaining}
                    </button>
                  </>
                )}
              </KanbanCards>
            </KanbanBoard>
          );
        })}

        <KanbanOverlay>
          {activeLead && <CardContent lead={activeLead} currentUserId={currentUserId} isManager={isManager} />}
        </KanbanOverlay>
      </KanbanProvider>
    </div>
  );
}
