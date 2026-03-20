import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CloserOpportunity } from '@/services/closerService';
import { isDealStuck } from '@/utils/behavioralScore';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { RevenueDetailModal, RevenueDetailItem } from '@/components/closer/RevenueDetailModal';
import {
  DollarSign,
  AlertTriangle,
  Flame,
  Trophy,
  Clock,
  ExternalLink,
  Users,
} from 'lucide-react';
import { startOfMonth } from 'date-fns';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

const getBusinessDaysRemaining = (): number => {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  let count = 0;
  for (let d = new Date(now); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return Math.max(1, count);
};

interface CloserRevenueDashboardProps {
  opportunities: CloserOpportunity[];
  onOpenLead: (opp: CloserOpportunity) => void;
  selectedCloserId?: string;
}

export const CloserRevenueDashboard = ({ opportunities, onOpenLead, selectedCloserId }: CloserRevenueDashboardProps) => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthStart = startOfMonth(now).toISOString();
  const isMobile = useIsMobile();
  const [detailModal, setDetailModal] = useState<{ open: boolean; title: string; items: RevenueDetailItem[] }>({ open: false, title: '', items: [] });


  // Fetch MRR from proposals (per closer for ranking) — uses max total_monthly per opportunity
  const { data: mrrByCloser = {} } = useQuery({
    queryKey: ['closer-mrr-by-closer', monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from('proposals')
        .select('total_monthly, opportunity_id, opportunities!inner(assigned_to_user_id, stage, won_at)')
        .gte('created_at', monthStart)
        .limit(20000);
      // For each opportunity, keep the max total_monthly; group by closer
      const oppMax: Record<string, { uid: string; val: number }> = {};
      (data || []).forEach((p: Record<string, unknown>) => {
        const opp = p.opportunities as Record<string, unknown> | null;
        const uid = opp?.assigned_to_user_id as string | undefined;
        const oppId = p.opportunity_id as string | undefined;
        const stage = opp?.stage as string | undefined;
        if (!uid || !oppId || stage !== 'Ganho') return;
        const val = Number(p.total_monthly) || 0;
        if (!oppMax[oppId] || val > oppMax[oppId].val) {
          oppMax[oppId] = { uid, val };
        }
      });
      const map: Record<string, number> = {};
      Object.values(oppMax).forEach(({ uid, val }) => {
        map[uid] = (map[uid] || 0) + val;
      });
      return map;
    },
  });

  const mrr = useMemo(() => {
    if (selectedCloserId) return mrrByCloser[selectedCloserId] || 0;
    return Object.values(mrrByCloser).reduce((sum, v) => sum + v, 0);
  }, [mrrByCloser, selectedCloserId]);

  const teamMrr = useMemo(() => Object.values(mrrByCloser).reduce((sum, v) => sum + v, 0), [mrrByCloser]);

  // Fetch closer goal
  const { data: goal } = useQuery({
    queryKey: ['closer-goal-revenue', currentMonth, currentYear, selectedCloserId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const userId = selectedCloserId || user.id;

      const { data: individual } = await supabase
        .from('goals')
        .select('*')
        .eq('target_user_id', userId)
        .eq('period_month', currentMonth)
        .eq('period_year', currentYear)
        .eq('goal_type', 'closer')
        .maybeSingle();

      if (individual) return individual;

      const { data: team } = await supabase
        .from('goals')
        .select('*')
        .is('target_user_id', null)
        .eq('period_month', currentMonth)
        .eq('period_year', currentYear)
        .eq('goal_type', 'closer')
        .maybeSingle();

      return team;
    },
  });

  // Fetch proposal setup_total AND total_monthly for ALL opportunities
  const allOppIds = useMemo(() => opportunities.map(o => o.id), [opportunities]);
  const { data: proposalMaps = { setup: {}, mrr: {} } } = useQuery({
    queryKey: ['closer-proposal-map', allOppIds.length],
    queryFn: async () => {
      const setup: Record<string, number> = {};
      const mrr: Record<string, number> = {};
      if (allOppIds.length === 0) return { setup, mrr };
      for (let i = 0; i < allOppIds.length; i += 500) {
        const chunk = allOppIds.slice(i, i + 500);
        const { data: proposals } = await supabase
          .from('proposals')
          .select('opportunity_id, setup_total, total_monthly, status, created_at')
          .in('opportunity_id', chunk)
          .order('created_at', { ascending: false })
          .limit(5000);
        (proposals || []).forEach(p => {
          if (p.opportunity_id) {
            // Setup: use only the LATEST proposal per opportunity (first seen = most recent due to DESC order)
            if (!(p.opportunity_id in setup)) {
              setup[p.opportunity_id] = Number(p.setup_total || 0);
            }
            // MRR: keep the highest total_monthly across all proposals
            const monthlyVal = Number(p.total_monthly || 0);
            if (monthlyVal > (mrr[p.opportunity_id] || 0)) {
              mrr[p.opportunity_id] = monthlyVal;
            }
          }
        });
      }
      return { setup, mrr };
    },
    enabled: allOppIds.length > 0,
  });
  const proposalRevenueMap = proposalMaps.setup;
  const proposalMrrMap = proposalMaps.mrr;

  // Filter by selected closer FIRST — all metrics must use filteredOpps
  const filteredOpps = useMemo(() => {
    return selectedCloserId
      ? opportunities.filter(o => o.assigned_to_user_id === selectedCloserId)
      : opportunities;
  }, [opportunities, selectedCloserId]);

  // Revenue metrics
  const monthOpps = useMemo(() => {
    return filteredOpps.filter(o => new Date(o.created_at) >= new Date(monthStart));
  }, [filteredOpps, monthStart]);

  const wonOpps = useMemo(() => {
    return filteredOpps.filter(o =>
      o.stage === 'Ganho' && o.won_at && new Date(o.won_at) >= new Date(monthStart)
    );
  }, [filteredOpps, monthStart]);

  // Use proposal setup_total when available (same logic as Ranking)
  const revenueClosed = wonOpps.reduce((sum, o) => {
    const proposalValue = proposalRevenueMap[o.id];
    return sum + (proposalValue != null && proposalValue > 0 ? proposalValue : (Number(o.deal_value) || 0));
  }, 0);
  const totalMeetings = monthOpps.length;
  const closeRate = totalMeetings > 0 ? (wonOpps.length / totalMeetings) * 100 : 0;
  const avgTicket = wonOpps.length > 0 ? revenueClosed / wonOpps.length : 0;

  const avgCycleDays = useMemo(() => {
    const wonWithDates = wonOpps.filter(o => o.created_at);
    if (wonWithDates.length === 0) return 0;
    const totalDays = wonWithDates.reduce((sum, o) => {
      return sum + (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24);
    }, 0);
    return Math.round(totalDays / wonWithDates.length);
  }, [wonOpps]);

  const goalValue = Number(goal?.setup_revenue_goal) || 0;
  const remaining = Math.max(0, goalValue - revenueClosed);
  const businessDaysLeft = getBusinessDaysRemaining();
  const dailyNeeded = remaining / businessDaysLeft;

  const activeOpps = filteredOpps.filter(o => o.stage !== 'Ganho' && o.stage !== 'Perdido');
  const pendingContractOpps = activeOpps.filter(o => o.stage === 'Contrato enviado' || o.stage === 'Aguardando pagamento');

  const getOppValue = (o: CloserOpportunity) => {
    const proposalValue = proposalRevenueMap[o.id];
    return proposalValue != null && proposalValue > 0 ? proposalValue : (Number(o.deal_value) || 0);
  };

  const getOppMrr = (o: CloserOpportunity) => proposalMrrMap[o.id] || 0;

  const getOppName = (o: CloserOpportunity) =>
    o.lead_razao_social || o.lead_nome_fantasia || o.lead_company || o.lead_name || '—';

  const buildItems = (opps: CloserOpportunity[], showCloser = false, extraProposalMap?: Record<string, { setup: number; mrr: number }>): RevenueDetailItem[] =>
    opps.map(o => {
      const extra = extraProposalMap?.[o.id];
      const setup = extra ? (extra.setup > 0 ? extra.setup : (Number(o.deal_value) || 0)) : getOppValue(o);
      const mrr = extra ? extra.mrr : getOppMrr(o);
      return {
        id: o.id,
        name: getOppName(o),
        closerName: showCloser ? (o.closer_name || undefined) : undefined,
        setup,
        mrr,
        stage: o.stage,
      };
    }).sort((a, b) => b.setup - a.setup);

  const openDetail = (title: string, opps: CloserOpportunity[], showCloser = false) => {
    setDetailModal({ open: true, title, items: buildItems(opps, showCloser) });
  };

  // Fetch proposals directly from DB for won opps (ensures correct values even if not in pipeline cache)
  const openDetailWithFetch = async (title: string, opps: CloserOpportunity[], showCloser = false) => {
    const oppIds = opps.map(o => o.id).filter(Boolean);
    if (oppIds.length === 0) {
      setDetailModal({ open: true, title, items: [] });
      return;
    }
    const { data: proposals } = await supabase
      .from('proposals')
      .select('opportunity_id, setup_total, total_monthly, created_at')
      .in('opportunity_id', oppIds.slice(0, 500))
      .order('created_at', { ascending: false })
      .limit(5000);

    const extraMap: Record<string, { setup: number; mrr: number }> = {};
    (proposals || []).forEach((p: any) => {
      if (p.opportunity_id && !(p.opportunity_id in extraMap)) {
        extraMap[p.opportunity_id] = {
          setup: Number(p.setup_total || 0),
          mrr: Number(p.total_monthly || 0),
        };
      }
    });

    setDetailModal({ open: true, title, items: buildItems(opps, showCloser, extraMap) });
  };

  const handleDetailItemClick = (oppId: string) => {
    const opp = opportunities.find(o => o.id === oppId);
    if (opp) {
      setDetailModal(prev => ({ ...prev, open: false }));
      onOpenLead(opp);
    }
  };

  const pendingContractsValue = pendingContractOpps.reduce((sum, o) => sum + getOppValue(o), 0);
  const pipelineValue = activeOpps.reduce((sum, o) => sum + getOppValue(o), 0);

  // ─── Team-wide totals (RPC, bypasses RLS) ───────────
  const { data: teamTotals = { teamRevenue: 0, teamPipeline: 0, teamPendingContracts: 0, pendingCount: 0, activeCount: 0 } } = useQuery({
    queryKey: ['closer-team-totals', monthStart],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_closer_team_totals' as never);
      if (error) throw error;
      const d = data as Record<string, number> | null;
      return {
        teamRevenue: Number(d?.team_revenue) || 0,
        teamPipeline: Number(d?.team_pipeline) || 0,
        teamPendingContracts: Number(d?.team_pending_contracts) || 0,
        pendingCount: Number(d?.pending_count) || 0,
        activeCount: Number(d?.active_count) || 0,
      };
    },
  });

  const daysPassed = now.getDate();
  const projectedRevenue = daysPassed > 0 ? (revenueClosed / daysPassed) * new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() : 0;
  const projectionPercent = goalValue > 0 ? Math.round((projectedRevenue / goalValue) * 100) : 0;

  // Ranking via RPC (SECURITY DEFINER — all closers see full ranking)
  const { data: ranking = [] } = useQuery({
    queryKey: ['closer-ranking-rpc'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_closer_ranking' as never);
      if (error) throw error;
      const rows = (data || []) as Array<{
        closer_id: string;
        closer_name: string;
        won_count: number;
        total_count: number;
        setup_revenue: number;
        mrr_revenue: number;
      }>;
      return rows.map(r => ({
        id: r.closer_id as string,
        name: r.closer_name as string,
        won: Number(r.won_count) || 0,
        total: Number(r.total_count) || 0,
        revenue: Number(r.setup_revenue) || 0,
        mrr: Number(r.mrr_revenue) || 0,
        closeRate: Number(r.total_count) > 0 ? (Number(r.won_count) / Number(r.total_count)) * 100 : 0,
        score: 0,
      }));
    },
    staleTime: 30_000,
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-id-closer'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id;
    },
  });

  const targetId = selectedCloserId || currentUser;
  const myRankPosition = ranking.findIndex(r => r.id === targetId) + 1;


  // Stuck deals & alerts
  const stuckDeals = useMemo(() => activeOpps.map(opp => ({ opp, ...isDealStuck(opp) })).filter(d => d.stuck), [activeOpps]);
  const noNextAction = activeOpps.filter(o => !o.lead_next_action_at).length;
  const overdueDeals = activeOpps.filter(o => o.lead_next_action_at && new Date(o.lead_next_action_at) < now).length;
  const hasAlerts = stuckDeals.length > 0 || noNextAction > 0 || overdueDeals > 0;

  // Team-wide opps (unfiltered) for drill-down
  // Team won opps include evolutions (for revenue drill-down)
  const teamWonOpps = useMemo(() => {
    const monthStartDate = new Date(monthStart);
    return opportunities.filter(o =>
      o.stage === 'Ganho' && o.won_at && new Date(o.won_at) >= monthStartDate
    );
  }, [opportunities, monthStart]);

  const teamAllActiveOpps = useMemo(() => opportunities.filter(o => o.stage !== 'Ganho' && o.stage !== 'Perdido'), [opportunities]);
  const teamPendingContractOpps = useMemo(() => teamAllActiveOpps.filter(o => o.stage === 'Contrato enviado' || o.stage === 'Aguardando pagamento'), [teamAllActiveOpps]);

  /* ─── Revenue metrics data ─── */
  const metrics = [
    { label: 'Reuniões', value: String(totalMeetings), color: '', tooltip: 'Total de oportunidades realizadas no mês' },
    { label: 'Setup Fechado', value: formatCurrency(revenueClosed), color: '' },
    { label: 'MRR Gerado', value: formatCurrency(mrr), color: '', tooltip: 'Receita Mensal Recorrente gerada pelos deals ganhos no período' },
    { label: 'Meta Mensal', value: formatCurrency(goalValue), color: '' },
    { label: 'Rec. Projetada', value: formatCurrency(projectedRevenue), color: projectedRevenue >= goalValue ? 'text-[hsl(var(--chart-3))]' : 'text-[hsl(var(--chart-2))]' },
    { label: 'Taxa Fechamento', value: `${closeRate.toFixed(1)}%`, color: closeRate >= 30 ? 'text-[hsl(var(--chart-3))]' : closeRate >= 15 ? 'text-[hsl(var(--chart-2))]' : 'text-destructive', tooltip: 'Percentual de oportunidades ganhas sobre o total de oportunidades no período' },
    { label: 'Ticket Médio', value: formatCurrency(avgTicket), color: '' },
    { label: 'Ciclo Médio', value: `${avgCycleDays}d`, color: '', tooltip: 'Tempo médio em dias entre a criação da oportunidade e o fechamento (ganho)' },
    { label: 'Aguardando', value: `${pendingContractOpps.length}`, color: pendingContractOpps.length > 0 ? 'text-[hsl(var(--chart-2))]' : '', tooltip: `${formatCurrency(pendingContractsValue)} em contratos pendentes` },
  ];

  return (
    <div className="space-y-3">
      {/* ─── Alerts Banner (top-level, conditional) ─── */}
      {hasAlerts && (
        <div className="flex gap-2 overflow-x-auto pb-1 snap-x scrollbar-none -mx-1 px-1">
          {stuckDeals.length > 0 && (
            <div className="flex items-center gap-2 min-w-fit flex-shrink-0 snap-start rounded-lg bg-destructive/8 px-3 py-2 min-h-[44px]">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive/70 flex-shrink-0" />
              <span className="text-xs font-medium text-destructive/80">Deals travados</span>
              <Badge variant="outline" className="text-[10px] border-destructive/20 text-destructive/80 bg-transparent">{stuckDeals.length}</Badge>
            </div>
          )}
          {noNextAction > 0 && (
            <div className="flex items-center gap-2 min-w-fit flex-shrink-0 snap-start rounded-lg bg-[hsl(var(--chart-2))]/8 px-3 py-2 min-h-[44px]">
              <Clock className="h-3.5 w-3.5 text-[hsl(var(--chart-2))] flex-shrink-0" />
              <span className="text-xs font-medium text-[hsl(var(--chart-2))]">Sem próxima ação</span>
              <Badge variant="outline" className="text-[10px] border-[hsl(var(--chart-2))]/20 text-[hsl(var(--chart-2))] bg-transparent">{noNextAction}</Badge>
            </div>
          )}
          {overdueDeals > 0 && (
            <div className="flex items-center gap-2 min-w-fit flex-shrink-0 snap-start rounded-lg bg-destructive/8 px-3 py-2 min-h-[44px]">
              <Clock className="h-3.5 w-3.5 text-destructive/70 flex-shrink-0" />
              <span className="text-xs font-medium text-destructive/80">Atrasados</span>
              <Badge variant="outline" className="text-[10px] border-destructive/20 text-destructive/80 bg-transparent">{overdueDeals}</Badge>
            </div>
          )}
        </div>
      )}

      {/* ─── Revenue Block ─── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="h-4 w-4 text-[hsl(var(--chart-2))]" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Receita do Mês{ranking.find(r => r.id === targetId)?.name ? ` — ${ranking.find(r => r.id === targetId)?.name}` : ''}
            </span>
          </div>

          <TooltipProvider>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              {metrics.map(m => (
                <div key={m.label}>
                  {m.tooltip ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground cursor-help inline-flex items-center gap-1">
                          {m.label}
                          <span className="text-muted-foreground/40">ⓘ</span>
                        </p>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs">{m.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{m.label}</p>
                  )}
                  <p className={cn('text-base font-bold tabular-nums', m.color || 'text-foreground')}>{m.value}</p>
                </div>
              ))}
            </div>
          </TooltipProvider>

          {/* Pipeline summary */}
          <div className="pt-3 border-t space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Pipeline ativo: <span className="font-semibold text-foreground tabular-nums">{formatCurrency(pipelineValue)}</span> em {activeOpps.length} deals
              </span>
            </div>
            {pendingContractOpps.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center justify-between text-xs w-full text-left rounded-md px-1 -mx-1 py-0.5 hover:bg-accent transition-colors cursor-pointer min-h-[32px]">
                    <span className="text-muted-foreground">
                      Contratos pendentes: <span className="font-semibold text-[hsl(var(--chart-2))] tabular-nums">{formatCurrency(pendingContractsValue)}</span> em {pendingContractOpps.length} deals
                    </span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground/50 flex-shrink-0 ml-2" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 p-0 max-h-[320px] overflow-auto">
                  <div className="p-3 border-b">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Contratos Pendentes</p>
                  </div>
                  <div className="divide-y">
                    {pendingContractOpps.map(opp => (
                      <button
                        key={opp.id}
                        onClick={() => onOpenLead(opp)}
                        className="flex items-center justify-between w-full text-left px-3 py-2.5 hover:bg-accent transition-colors min-h-[44px]"
                      >
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-xs font-medium text-foreground truncate">
                            {opp.lead_razao_social || opp.lead_nome_fantasia || opp.lead_company || opp.lead_name || '—'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{opp.stage}</p>
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-foreground flex-shrink-0">
                          {formatCurrency(getOppValue(opp))}
                        </span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Daily target hint */}
          {goalValue > 0 && remaining > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Meta diária restante: <span className="font-semibold text-foreground tabular-nums">{formatCurrency(dailyNeeded)}</span>/dia útil
            </p>
          )}
          {projectionPercent > 0 && projectionPercent < 100 && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-[hsl(var(--chart-2))]">
              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
              Projeção: {projectionPercent}% da meta
            </div>
          )}
        </CardContent>
      </Card>


      {/* ─── Team Summary Bar (always monthly, unfiltered) ─── */}
      {opportunities.length > 0 && (
        <Card className="border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Resultado da Equipe — Mês Atual</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button onClick={() => openDetailWithFetch('Setup Fechado — Equipe', teamWonOpps, true)} className="text-center p-2 rounded-lg bg-[#f1f1f8] dark:bg-muted/30 border border-border/50 hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Setup Fechado</p>
                <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">{formatCurrency(teamTotals.teamRevenue)}</p>
              </button>
              <div className="text-center p-2 rounded-lg bg-[#f1f1f8] dark:bg-muted/30 border border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">MRR Gerado</p>
                <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">{formatCurrency(teamMrr)}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-[#f1f1f8] dark:bg-muted/30 border border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pipeline Ativo</p>
                <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">{formatCurrency(teamTotals.teamPipeline)}</p>
                <p className="text-[10px] text-muted-foreground">{teamTotals.activeCount} deals</p>
              </div>
              <button onClick={() => openDetailWithFetch('Contratos Pendentes — Equipe', teamPendingContractOpps, true)} className="text-center p-2 rounded-lg bg-[#f1f1f8] dark:bg-muted/30 border border-border/50 hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contratos Pendentes</p>
                <p className="text-lg font-bold text-[hsl(var(--chart-2))] tabular-nums mt-0.5">{formatCurrency(teamTotals.teamPendingContracts)}</p>
                <p className="text-[10px] text-muted-foreground">{teamTotals.pendingCount} deals</p>
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Ranking (always visible, sorted by revenue) ─── */}
      {ranking.length > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-[#636c7d]" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#636c7d]">Ranking Closers</span>
              {myRankPosition > 0 && (
                <Badge variant="outline" className="text-[10px] tabular-nums">#{myRankPosition}</Badge>
              )}
            </div>
            <div className="grid grid-cols-[20px_1fr_100px_80px] gap-x-4 items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 pb-1">
              <span></span>
              <span>Closer</span>
              <span className="text-right">Setup</span>
              <span className="text-right">MRR</span>
            </div>
            <div className="space-y-1">
              {ranking.map((r, idx) => (
                <div
                  key={r.id}
                  className={cn(
                    'grid grid-cols-[20px_1fr_100px_80px] gap-x-4 items-center text-xs px-2 py-1.5 rounded-md min-h-[36px]',
                    r.id === targetId && 'ring-1 ring-primary/30',
                    idx % 2 === 1 && 'bg-[#f1f1f8] dark:bg-muted/30'
                  )}
                >
                  <span className={cn('font-bold tabular-nums', idx === 0 ? 'text-[#D4A017]' : idx === 1 ? 'text-[#8E8E93]' : idx === 2 ? 'text-[#A0522D]' : 'text-muted-foreground')}>
                    #{idx + 1}
                  </span>
                  <span className="truncate text-foreground">{r.name}</span>
                  <button
                    onClick={() => {
                      const closerWonOpps = opportunities.filter(o => o.assigned_to_user_id === r.id && o.stage === 'Ganho' && o.won_at && new Date(o.won_at) >= new Date(monthStart));
                      openDetailWithFetch(`Setup Fechado — ${r.name}`, closerWonOpps);
                    }}
                    className="font-medium tabular-nums text-foreground text-right hover:text-primary transition-colors cursor-pointer"
                  >
                    {formatCurrency(r.revenue)}
                  </button>
                  <span className="font-medium tabular-nums text-muted-foreground text-right">{formatCurrency(r.mrr)}</span>
                </div>
              ))}
            </div>
            {/* Totals row */}
            <div className="grid grid-cols-[20px_1fr_100px_80px] gap-x-4 items-center text-xs px-2 py-2 mt-1 border-t border-border font-bold">
              <span></span>
              <span className="text-foreground">Total</span>
              <span className="tabular-nums text-foreground text-right">{formatCurrency(ranking.reduce((s, r) => s + r.revenue, 0))}</span>
              <span className="tabular-nums text-muted-foreground text-right">{formatCurrency(ranking.reduce((s, r) => s + r.mrr, 0))}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <RevenueDetailModal
        open={detailModal.open}
        onOpenChange={(open) => setDetailModal(prev => ({ ...prev, open }))}
        title={detailModal.title}
        items={detailModal.items}
        onItemClick={handleDetailItemClick}
      />
    </div>
  );
};
