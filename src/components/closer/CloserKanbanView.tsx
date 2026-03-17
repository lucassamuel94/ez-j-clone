import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePipelineStatuses } from '@/hooks/usePipelineStatuses';
import {
  KanbanProvider,
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanOverlay } from
'@/components/kibo-ui/kanban';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { CloserOpportunity, CloserStage } from '@/services/closerService';
import { isDealStuck } from '@/utils/behavioralScore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FieldConfig } from '@/components/projects/ProjectViewConfig';
import {
  Building2,
  User,
  Calendar,
  Clock,
  Flame,
  Loader2,
  Plus,
  Snowflake,
  Thermometer,
  ChevronDown,
  Tag,
  Trash2,
  Zap,
  Send,
  FileText,
  Eye,
  CreditCard,
  Trophy,
  XCircle,
  Presentation,
} from 'lucide-react';
import { format, formatDistanceToNow, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ---------- Types ----------

type SortOption = 'value_desc' | 'created_desc' | 'next_action_asc' | 'temperature_desc' | 'last_contact_asc';

interface KanbanColumn {
  id: string;
  stage: CloserStage;
  items: CloserOpportunity[];
  total: number;
}

interface CloserKanbanViewProps {
  columns: KanbanColumn[];
  /** Used only for loading skeleton stage labels */
  visibleStages?: Set<string>;
  cardFields: FieldConfig[];
  sortBy: SortOption;
  onMoveStage: (id: string, stage: CloserStage) => void;
  onCardClick: (opp: CloserOpportunity) => void;
  onDeleteOpp?: (opp: CloserOpportunity) => void;
  getOppHref?: (opp: CloserOpportunity) => string;
  isMoving?: boolean;
  isLoading?: boolean;
  currentUserId?: string | null;
  canManage?: boolean;
  pipelineKey?: 'closer' | 'evolution';
  onLoadMore?: (stage: string) => void;
}

// ---------- Helpers ----------

const formatCurrency = (value: number) =>
new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

const TEMP_ORDER: Record<string, number> = { Quente: 3, Morno: 2, Frio: 1 };

const STAGE_PROGRESS: Record<string, number> = {
  'Demonstração': 15,
  'Demonstracao': 15,
  'Proposta enviada': 35,
  'Oportunidade Fria': 30,
  'Oportunidade Futura': 40,
  'Oportunidade Quente': 55,
  'Contrato enviado': 75,
  'Aguardando pagamento': 90,
  'Ganho': 100,
  'Perdido': 0
};

const STAGE_DISPLAY_LABELS: Record<string, string> = {
  'Proposta enviada': 'Enviar proposta'
};

function getStageProgress(stage: string): number {
  return STAGE_PROGRESS[stage] ?? 20;
}

function getInitials(name: string): string {
  return name.
  split(' ').
  map((n) => n[0]).
  join('').
  toUpperCase().
  slice(0, 2);
}

function getShortId(id: string): string {
  return id.slice(0, 6).toUpperCase();
}

function sortOpportunities(opps: CloserOpportunity[], sortBy: SortOption): CloserOpportunity[] {
  return [...opps].sort((a, b) => {
    switch (sortBy) {
      case 'value_desc':
        return (Number(b.deal_value) || 0) - (Number(a.deal_value) || 0);
      case 'created_desc':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'next_action_asc':{
          const aTime = a.lead_next_action_at ? new Date(a.lead_next_action_at).getTime() : Infinity;
          const bTime = b.lead_next_action_at ? new Date(b.lead_next_action_at).getTime() : Infinity;
          return aTime - bTime;
        }
      case 'temperature_desc':
        return (TEMP_ORDER[b.lead_temperature || ''] || 0) - (TEMP_ORDER[a.lead_temperature || ''] || 0);
      case 'last_contact_asc':{
          const aTime = a.lead_last_contact_at ? new Date(a.lead_last_contact_at).getTime() : 0;
          const bTime = b.lead_last_contact_at ? new Date(b.lead_last_contact_at).getTime() : 0;
          return aTime - bTime;
        }
      default:
        return 0;
    }
  });
}

// ---------- Temperature Badge ----------

function TemperatureBadge({ temperature }: {temperature: string | null | undefined;}) {
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
    </span>);
}

// ---------- Stage Icon ----------

const STAGE_ICONS: Record<string, React.ReactNode> = {
  'Demonstração': <Presentation className="h-3 w-3" />,
  'Demonstracao': <Presentation className="h-3 w-3" />,
  'Proposta enviada': <Send className="h-3 w-3" />,
  'Oportunidade Fria': <Snowflake className="h-3 w-3" />,
  'Oportunidade Futura': <Eye className="h-3 w-3" />,
  'Oportunidade Quente': <Zap className="h-3 w-3" />,
  'Contrato enviado': <FileText className="h-3 w-3" />,
  'Aguardando pagamento': <CreditCard className="h-3 w-3" />,
  'Ganho': <Trophy className="h-3 w-3" />,
  'Perdido': <XCircle className="h-3 w-3" />,
};

function StageBadge({ stage }: {stage: string;}) {
  const icon = STAGE_ICONS[stage] || <Tag className="h-3 w-3" />;
  const isCold = /oportunidade fria/i.test(stage);
  return (
    <span className={cn('inline-flex items-center', isCold ? 'text-info' : 'text-primary')} title={STAGE_DISPLAY_LABELS[stage] || stage}>
      {icon}
    </span>);
}

// ---------- Kanban Card Content ----------

function CardContent({ opp, fields, proposalType, currentUserId, canManage, evolutionCount }: {opp: CloserOpportunity;fields: FieldConfig[];proposalType?: string;currentUserId?: string | null;canManage?: boolean;evolutionCount?: number;}) {
  const visibleFields = new Set(fields.filter((f) => f.visible).map((f) => f.id));
  const stuckInfo = isDealStuck(opp);
  const isTerminal = opp.stage === 'Ganho' || opp.stage === 'Perdido';
  const hasMeeting = !!opp.meeting_datetime;
  const hasFutureMeeting = hasMeeting && new Date(opp.meeting_datetime!) > new Date();
  const hasNextAction = !!opp.lead_next_action_at;
  const nextActionIsFuture = hasNextAction && new Date(opp.lead_next_action_at!) > new Date();
  const hasSchedule = hasFutureMeeting || nextActionIsFuture;
  // "Atrasado" only when next_action is past AND there's a meeting (evidence of real commitment)
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const nextActionIsRecent = hasNextAction && !nextActionIsFuture && (Date.now() - new Date(opp.lead_next_action_at!).getTime()) < SEVEN_DAYS_MS;
  const isOverdue = !isTerminal && hasNextAction && !nextActionIsFuture && (hasMeeting || nextActionIsRecent);
  const progress = getStageProgress(opp.stage);

  const timeAgo = formatDistanceToNow(new Date(opp.updated_at), { addSuffix: false, locale: ptBR });
  const closerFirst = opp.closer_name?.split(' ')[0];

  return (
    <div className={cn(
      'px-3 py-2.5 space-y-1.5',
      stuckInfo.stuck && ''
    )}>
      {/* Line 1: ID + Company */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-xs font-semibold text-foreground truncate flex-1 leading-tight">
          {opp.lead_company || '—'}
        </span>
        {isOverdue &&
          <span className="inline-flex w-2 h-2 rounded-full bg-destructive animate-pulse shrink-0" />
        }
      </div>

      {/* Line 2: Contact + Stage badge */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {visibleFields.has('contact') && opp.lead_name &&
          <span className="text-xs text-foreground/70 truncate max-w-[140px]">
            Contato: {opp.lead_name}
          </span>
        }
        {proposalType === 'evolucao_ez_chat' &&
          <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-px rounded-full bg-chart-2/20 text-chart-2">
            <Tag className="h-2.5 w-2.5" />
            Evolução
          </span>
        }
        {visibleFields.has('temperature') && <TemperatureBadge temperature={opp.lead_temperature} />}
        {evolutionCount !== undefined && evolutionCount >= 2 &&
          <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-px rounded-full bg-warning/15 text-warning">
            {evolutionCount} evo ativas
          </span>
        }
      </div>

      {/* Value */}
      {visibleFields.has('deal_value') && Number(opp.deal_value) > 0 &&
        <div className="text-[11px] flex items-center gap-1">
          <span className="text-foreground/50">Valor setup:</span>
          <span className="font-bold tabular-nums text-foreground">
            {formatCurrency(Number(opp.deal_value))}
          </span>
        </div>
      }

      {/* Meeting / schedule info */}
      {!isTerminal &&
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          {(hasFutureMeeting || (hasMeeting && isOverdue)) &&
            <span className="text-foreground/70 flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" />
              {format(new Date(opp.meeting_datetime!), 'dd/MM HH:mm', { locale: ptBR })}
            </span>
          }
          {nextActionIsFuture && !hasMeeting &&
            <span className="text-foreground/70 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {format(new Date(opp.lead_next_action_at!), 'dd/MM HH:mm', { locale: ptBR })}
            </span>
          }
          {isOverdue &&
            <span className="text-destructive font-medium text-[10px] bg-destructive/10 px-1.5 py-px rounded-full">Atrasado</span>
          }
          {!hasSchedule && !isOverdue &&
            <span className="text-warning font-medium text-[10px] bg-warning/15 px-1.5 py-px rounded-full">Sem agendamento</span>
          }
        </div>
      }

      {/* Last contact */}
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

function ScrollSentinel({ onVisible }: {onVisible: () => void;}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onVisible();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible]);

  return <div ref={ref} className="h-1 w-full shrink-0" />;
}

// ---------- Main Component ----------

export function CloserKanbanView({
  columns,
  visibleStages,
  cardFields,
  sortBy,
  onMoveStage,
  onCardClick,
  onDeleteOpp,
  getOppHref,
  isMoving = false,
  isLoading = false,
  currentUserId,
  canManage = false,
  pipelineKey = 'closer',
  onLoadMore,
}: CloserKanbanViewProps) {
  const [activeOpp, setActiveOpp] = useState<CloserOpportunity | null>(null);
  const { getColorMap } = usePipelineStatuses();
  const stageColorMap = useMemo(() => getColorMap(pipelineKey === 'evolution' ? 'evolution' as 'sdr' : 'closer'), [getColorMap, pipelineKey]);

  // Flatten all loaded opportunities for proposal/evolution queries and drag map
  const allOpportunities = useMemo(() => columns.flatMap((c) => c.items), [columns]);

  // Fetch latest proposal types for badges
  const oppIds = useMemo(() => allOpportunities.map((o) => o.id), [allOpportunities]);
  // Use a stable fingerprint based on count + first/last IDs instead of joining all IDs
  const oppFingerprint = useMemo(() => {
    if (oppIds.length === 0) return '';
    return `${oppIds.length}:${oppIds[0]}:${oppIds[oppIds.length - 1]}`;
  }, [oppIds]);
  const { data: proposalTypeMap = {} } = useQuery({
    queryKey: ['kanban-proposal-types', oppFingerprint],
    queryFn: async () => {
      if (oppIds.length === 0) return {};
      const { data } = await supabase.
      from('proposals').
      select('opportunity_id, product_type, created_at').
      in('opportunity_id', oppIds).
      order('created_at', { ascending: false });
      if (!data) return {};
      const map: Record<string, string> = {};
      for (const row of data) {
        if (row.opportunity_id && !map[row.opportunity_id]) {
          map[row.opportunity_id] = row.product_type;
        }
      }
      return map;
    },
    staleTime: 60_000,
    enabled: oppIds.length > 0
  });

  // Batch query: count active evolutions per CNPJ for evolution-type opps
  const evolutionCnpjs = useMemo(() => {
    const cnpjs = new Set<string>();
    for (const o of allOpportunities) {
      if (o.opportunity_type === 'evolution' && o.lead_cnpj) {
        const clean = o.lead_cnpj.replace(/\D/g, '');
        if (clean.length === 14) cnpjs.add(clean);
      }
    }
    return Array.from(cnpjs);
  }, [allOpportunities]);

  const { data: evolutionCountMap = {} } = useQuery<Record<string, number>>({
    queryKey: ['kanban-evolution-counts', [...evolutionCnpjs].sort().join(',')],
    queryFn: async () => {
      if (evolutionCnpjs.length === 0) return {};
      // Get leads by CNPJs
      const { data: leads } = await supabase
        .from('leads')
        .select('id, cnpj')
        .in('cnpj', evolutionCnpjs);
      if (!leads || leads.length === 0) return {};

      const leadIds = leads.map(l => l.id);
      const leadCnpjMap = new Map<string, string>();
      leads.forEach(l => { if (l.cnpj) leadCnpjMap.set(l.id, l.cnpj.replace(/\D/g, '')); });

      const { data: opps } = await supabase
        .from('opportunities')
        .select('id, lead_id')
        .in('lead_id', leadIds)
        .not('stage', 'eq', 'Perdido')
        .eq('opportunity_type', 'evolution')
        .limit(5000);

      if (!opps) return {};
      const counts: Record<string, number> = {};
      for (const opp of opps) {
        const cnpj = leadCnpjMap.get(opp.lead_id);
        if (cnpj) counts[cnpj] = (counts[cnpj] || 0) + 1;
      }
      return counts;
    },
    staleTime: 60_000,
    enabled: evolutionCnpjs.length > 0,
  });

  // Helper to get evolution count for an opp
  const getEvolutionCount = useCallback((opp: CloserOpportunity): number | undefined => {
    if (opp.opportunity_type !== 'evolution' || !opp.lead_cnpj) return undefined;
    const clean = opp.lead_cnpj.replace(/\D/g, '');
    return evolutionCountMap[clean];
  }, [evolutionCountMap]);

  // Valid stage names derived from columns (used for drag-drop target detection)
  const validStages = useMemo(() => new Set(columns.map((c) => c.stage)), [columns]);

  const oppMap = useMemo(() => {
    const map = new Map<string, CloserOpportunity>();
    allOpportunities.forEach((o) => map.set(o.id, o));
    return map;
  }, [allOpportunities]);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveOpp(null);
    const { active, over } = event;
    if (!over) return;

    const activeOppId = String(active.id);
    const overId = String(over.id);

    let targetStage: CloserStage | null = null;
    if (validStages.has(overId as CloserStage)) {
      targetStage = overId as CloserStage;
    } else {
      const targetOpp = oppMap.get(overId);
      if (targetOpp) targetStage = targetOpp.stage;
    }

    if (!targetStage) return;
    const sourceOpp = oppMap.get(activeOppId);
    if (!sourceOpp || sourceOpp.stage === targetStage) return;
    onMoveStage(activeOppId, targetStage);
  };

  const handleDragStart = (event: any) => {
    const opp = oppMap.get(String(event.active.id));
    if (opp) setActiveOpp(opp);
  };

  if (isLoading) {
    const skeletonStages = columns.length > 0
      ? columns.map((c) => c.stage).slice(0, 6)
      : Array.from(visibleStages ?? []).slice(0, 6);
    return (
      <div className="flex gap-3 overflow-x-auto pb-4">
        {skeletonStages.map((stage) => (
          <div key={stage} className="!w-[260px] sm:!w-[280px] !min-w-[260px] sm:!min-w-[280px] rounded-xl bg-muted/30 border border-border/40 flex-shrink-0">
            <div className="flex items-center justify-between p-3 border-b border-border/30">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {stage}
                </span>
              </div>
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

  if (!isLoading && columns.every((c) => c.total === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Building2 className="h-10 w-10 mb-3 opacity-40" strokeWidth={1.5} />
        <p className="text-sm font-medium">Nenhuma oportunidade encontrada</p>
        <p className="text-xs mt-1">Ajuste os filtros ou aguarde novas oportunidades.</p>
      </div>);

  }

  return (
    <div className="relative min-w-0 w-full flex-1 min-h-0 flex flex-col">
      {isMoving &&
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg">
          <div className="flex items-center gap-2 bg-card border rounded-lg px-4 py-2.5 shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs font-medium text-foreground">Movendo oportunidade...</span>
          </div>
        </div>
      }

      <KanbanProvider
        onDragEnd={handleDragEnd}
        onDragOver={() => {}}
        className="gap-3 overflow-x-auto overflow-y-hidden pb-4 flex-1 min-h-0"
        onDragStart={handleDragStart as any}>

        {columns.map(({ stage, items: allOpps, total: serverTotal }) => {
          const totalValue = allOpps.reduce((sum, o) => sum + (Number(o.deal_value) || 0), 0);
          const showMore = allOpps.length < serverTotal;
          const remaining = serverTotal - allOpps.length;

          return (
            <KanbanBoard
              key={stage}
              id={stage}
              className="!w-[260px] sm:!w-[280px] !min-w-[260px] sm:!min-w-[280px] rounded-xl bg-muted/50 dark:bg-muted/30 border border-border/40 flex flex-col max-h-full">

              <div
                className="flex items-center justify-between p-3 border-b border-border/30 rounded-t-xl shrink-0"
                style={stageColorMap[stage] ? {
                  backgroundColor: `${stageColorMap[stage]}18`,
                } : undefined}
              >
                <div className="flex items-center gap-2">
                  {stageColorMap[stage] && (
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stageColorMap[stage] }} />
                  )}
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {STAGE_DISPLAY_LABELS[stage] || stage}
                  </span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold tabular-nums">
                    {serverTotal}
                  </Badge>
                </div>
                {totalValue > 0 &&
                <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                    {formatCurrency(totalValue)}
                  </span>
                }
              </div>

              <KanbanCards items={allOpps.map((o) => o.id)} className="min-h-[120px] p-2 gap-1.5 overflow-y-auto flex-1 min-h-0">
                {allOpps.map((opp) =>
                <ContextMenu key={opp.id}>
                  <ContextMenuTrigger asChild>
                    <KanbanCard
                      id={opp.id}
                      asHandle
                      className="cursor-grab active:cursor-grabbing bg-card border border-border/50 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30 transition-all duration-150 rounded-lg shadow-sm"
                      onClick={(e: React.MouseEvent) => {
                        const href = getOppHref?.(opp);
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
                        onCardClick(opp);
                      }}>

                        <CardContent opp={opp} fields={cardFields} proposalType={proposalTypeMap[opp.id]} currentUserId={currentUserId} canManage={canManage} evolutionCount={getEvolutionCount(opp)} />
                      </KanbanCard>
                  </ContextMenuTrigger>
                  {onDeleteOpp && (
                    <ContextMenuContent>
                      <ContextMenuItem
                        className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2"
                        onClick={() => onDeleteOpp(opp)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir Oportunidade
                      </ContextMenuItem>
                    </ContextMenuContent>
                  )}
                </ContextMenu>
                )}

                {allOpps.length === 0 &&
                <div className="rounded-lg border-dashed border-2 border-border/30 p-8 text-center flex flex-col items-center gap-2">
                    <Plus className="h-4 w-4 text-muted-foreground/30" strokeWidth={1.5} />
                    <p className="text-xs text-muted-foreground/40">Nenhuma oportunidade</p>
                  </div>
                }

                {showMore &&
                <>
                    <ScrollSentinel onVisible={() => onLoadMore?.(stage)} />
                    <button
                    type="button"
                    onClick={() => onLoadMore?.(stage)}
                    className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50">

                      <ChevronDown className="h-3.5 w-3.5" />
                      Carregar mais {remaining}
                    </button>
                  </>
                }
              </KanbanCards>
            </KanbanBoard>);

        })}

        <KanbanOverlay>
          {activeOpp && <CardContent opp={activeOpp} fields={cardFields} proposalType={proposalTypeMap[activeOpp.id]} currentUserId={currentUserId} canManage={canManage} evolutionCount={getEvolutionCount(activeOpp)} />}
        </KanbanOverlay>
      </KanbanProvider>
    </div>);

}