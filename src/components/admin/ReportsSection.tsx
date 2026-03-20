import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminReports } from '@/hooks/useAdminReports';
import { Card, CardContent } from '@/components/ui/card';
import { useMemo } from 'react';
import {
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  CalendarCheck,
  CalendarCheck2,
  Target,
  BarChart3,
  Loader2,
  Info,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const fmt = (v: number) => v.toLocaleString('pt-BR');

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--muted))'];

const STATUS_COLORS: Record<string, string> = {
  'Novo': 'hsl(var(--chart-1))',
  'Em contato': 'hsl(var(--chart-2))',
  'Interesse': 'hsl(var(--chart-3))',
  'Interesse/Agendar Retorno': 'hsl(var(--chart-4))',
  'Oportunidade criada': 'hsl(var(--chart-5))',
  'Descartado': 'hsl(var(--muted))',
};

export const useReportsData = () => {
  return useAdminReports();
};

interface ReportsKPICardsProps {
  selectedSdrId?: string;
  dateRange?: { start: string; end: string };
}

export const ReportsKPICards = ({ selectedSdrId, dateRange }: ReportsKPICardsProps) => {
  const { metrics, isLoadingMetrics, error } = useAdminReports({ selectedSdrId, dateRange });

  // SDR meeting/SQO metrics
  const { data: sdrUserIds = [] } = useQuery({
    queryKey: ['sdr-ids-report-kpi'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('user_id').eq('role', 'sdr');
      return (data || []).map(r => r.user_id);
    },
    staleTime: 300_000,
  });

  const { data: meetingSqoMetrics } = useQuery({
    queryKey: ['sdr-meeting-sqo-kpi', selectedSdrId, sdrUserIds, dateRange?.start, dateRange?.end],
    queryFn: async () => {
      const filterStart = dateRange?.start || new Date().toISOString();
      const filterEnd = dateRange?.end || new Date().toISOString();
      const isAll = !selectedSdrId;

      // Total agendado (SQL) — meetings created in period
      let meetingsQ = supabase.from('meetings').select('id, lead_id')
        .gte('created_at', filterStart)
        .lte('created_at', filterEnd);
      if (!isAll) {
        meetingsQ = meetingsQ.eq('user_id', selectedSdrId);
      } else if (sdrUserIds.length > 0) {
        meetingsQ = meetingsQ.in('user_id', sdrUserIds);
      }
      const { data: meetings } = await meetingsQ;
      const uniqueMeetingLeads = new Set((meetings || []).map(m => m.lead_id));
      const agendados = uniqueMeetingLeads.size;

      // Reuniões confirmadas — activity logs with "confirmou presença"
      let confirmedQ = supabase.from('lead_activity_logs').select('id, lead_id')
        .eq('action_type', 'opportunity_created')
        .ilike('description', '%confirmou presença%')
        .gte('created_at', filterStart)
        .lte('created_at', filterEnd);
      if (!isAll) {
        confirmedQ = confirmedQ.eq('user_id', selectedSdrId);
      } else if (sdrUserIds.length > 0) {
        confirmedQ = confirmedQ.in('user_id', sdrUserIds);
      }
      const { data: confirmedLogs } = await confirmedQ;
      const uniqueConfirmed = new Set((confirmedLogs || []).map(l => l.lead_id));
      const confirmados = uniqueConfirmed.size;

      // Promovidos SQO — leads with sqo_approved_at in period
      let sqoQ = supabase.from('leads').select('id')
        .not('sqo_approved_at', 'is', null)
        .gte('sqo_approved_at', filterStart)
        .lte('sqo_approved_at', filterEnd);
      if (!isAll) {
        sqoQ = sqoQ.eq('owner_user_id', selectedSdrId);
      } else if (sdrUserIds.length > 0) {
        sqoQ = sqoQ.in('owner_user_id', sdrUserIds);
      }
      const { data: sqoLeads } = await sqoQ;
      const promotedSQO = sqoLeads?.length || 0;

      return { agendados, confirmados, promotedSQO };
    },
    enabled: sdrUserIds.length > 0 || !!selectedSdrId,
    staleTime: 30_000,
  });

  // SDR monthly SQO goal
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const { data: sdrGoalValue = 0 } = useQuery({
    queryKey: ['sdr-sqo-goal-admin', currentMonth, currentYear, selectedSdrId],
    queryFn: async () => {
      if (selectedSdrId) {
        const { data: individual } = await supabase
          .from('goals')
          .select('sqo_percentage')
          .eq('target_user_id', selectedSdrId)
          .eq('period_month', currentMonth)
          .eq('period_year', currentYear)
          .eq('goal_type', 'sdr')
          .maybeSingle();
        if (individual) return Math.round(Number(individual.sqo_percentage) || 0);
      }
      // Sum all individual SDR goals
      const { data: individualGoals } = await supabase
        .from('goals')
        .select('sqo_percentage, target_user_id')
        .not('target_user_id', 'is', null)
        .eq('period_month', currentMonth)
        .eq('period_year', currentYear)
        .eq('goal_type', 'sdr');

      if (individualGoals && individualGoals.length > 0) {
        return individualGoals.reduce((s, g) => s + Math.round(Number(g.sqo_percentage) || 0), 0);
      }

      // Fallback: team goal × SDR count
      const { data: teamGoal } = await supabase
        .from('goals')
        .select('sqo_percentage')
        .is('target_user_id', null)
        .eq('period_month', currentMonth)
        .eq('period_year', currentYear)
        .eq('goal_type', 'sdr')
        .maybeSingle();

      if (teamGoal) {
        const sdrCount = sdrUserIds.length || 1;
        return Math.round(Number(teamGoal.sqo_percentage) || 0) * sdrCount;
      }
      return 0;
    },
    staleTime: 60_000,
  });

  const totalSQO = meetingSqoMetrics?.promotedSQO || 0;
  const faltaParaMetaSQO = Math.max(0, sdrGoalValue - totalSQO);

  const projecaoSQO = useMemo(() => {
    const today = new Date();
    const daysPassed = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - daysPassed;
    if (daysPassed === 0) return 0;
    const dailyAvg = totalSQO / daysPassed;
    return Math.round(totalSQO + (dailyAvg * daysRemaining));
  }, [totalSQO]);

  if (isLoadingMetrics) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm text-destructive font-medium">Erro ao carregar métricas</p>
        <p className="text-xs text-muted-foreground mt-1">{String(error)}</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 mb-1 cursor-help">
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Total Agendado (SQL)</span>
                  <Info className="h-3 w-3 text-muted-foreground/50" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Leads únicos com reunião agendada no período</p>
              </TooltipContent>
            </Tooltip>
            <p className="text-2xl font-bold text-foreground">{fmt(meetingSqoMetrics?.agendados || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 mb-1 cursor-help">
                  <CalendarCheck2 className="h-4 w-4 text-[hsl(var(--chart-3))]" />
                  <span className="text-xs text-muted-foreground">Reuniões Confirmadas</span>
                  <Info className="h-3 w-3 text-muted-foreground/50" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Leads com presença confirmada pelo SDR no período</p>
              </TooltipContent>
            </Tooltip>
            <p className="text-2xl font-bold text-foreground">{fmt(meetingSqoMetrics?.confirmados || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 mb-1 cursor-help">
                  <Target className="h-4 w-4 text-[hsl(var(--chart-4))]" />
                  <span className="text-xs text-muted-foreground">Promovidos SQO</span>
                  <Info className="h-3 w-3 text-muted-foreground/50" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Leads que passaram na validação SQO (5 critérios) no período</p>
              </TooltipContent>
            </Tooltip>
            <p className="text-2xl font-bold text-foreground">{fmt(meetingSqoMetrics?.promotedSQO || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 mb-1 cursor-help">
                  <Target className="h-4 w-4 text-[hsl(var(--chart-2))]" />
                  <span className="text-xs text-muted-foreground">Falta para a Meta (SQO)</span>
                  <Info className="h-3 w-3 text-muted-foreground/50" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Total de SQO que falta para bater a meta mensal</p>
              </TooltipContent>
            </Tooltip>
            <p className={cn('text-2xl font-bold font-display', faltaParaMetaSQO > 0 ? 'text-[hsl(var(--chart-2))]' : 'text-[hsl(var(--chart-3))]')}>
              {fmt(faltaParaMetaSQO)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 mb-1 cursor-help">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Projeção</span>
                  <Info className="h-3 w-3 text-muted-foreground/50" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">SQO no período ÷ dias trabalhados × dias totais do mês</p>
              </TooltipContent>
            </Tooltip>
            <p className={cn('text-2xl font-bold font-display', projecaoSQO >= sdrGoalValue && sdrGoalValue > 0 ? 'text-[hsl(var(--chart-3))]' : 'text-foreground')}>
              {fmt(projecaoSQO)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 mb-1 cursor-help">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Leads no Período</span>
                  <Info className="h-3 w-3 text-muted-foreground/50" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Total de leads criados no período selecionado</p>
              </TooltipContent>
            </Tooltip>
            <p className="text-2xl font-bold text-foreground">{fmt(metrics?.totalLeads || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 mb-1 cursor-help">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Convertidos</span>
                  <Info className="h-3 w-3 text-muted-foreground/50" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Leads convertidos no período (taxa = convertidos ÷ total do período)</p>
              </TooltipContent>
            </Tooltip>
            <p className="text-2xl font-bold text-foreground">{fmt(metrics?.convertedThisMonth || 0)}</p>
            <span className="text-[10px] text-muted-foreground">Taxa: {metrics?.conversionRate || 0}%</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 mb-1 cursor-help">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-muted-foreground">Atrasados</span>
                  <Info className="h-3 w-3 text-muted-foreground/50" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Leads aguardando ação há mais tempo que o esperado</p>
              </TooltipContent>
            </Tooltip>
            <p className={cn("text-2xl font-bold", (metrics?.overdueLeads || 0) > 0 ? 'text-destructive' : 'text-foreground')}>
              {fmt(metrics?.overdueLeads || 0)}
            </p>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

interface ReportsChartsProps {
  dateRange?: { start: string; end: string };
  selectedSdrId?: string;
}

export const ReportsCharts = ({ dateRange, selectedSdrId }: ReportsChartsProps = {}) => {
  const { data: leadsByStatus = [], isLoading: isLoadingByStatus } = useQuery({
    queryKey: ['leadsByStatus', dateRange?.start, dateRange?.end, selectedSdrId],
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase.from('leads').select('status').limit(20000);
      if (dateRange?.start) q = q.gte('created_at', dateRange.start);
      if (dateRange?.end) q = q.lte('created_at', dateRange.end);
      if (selectedSdrId && selectedSdrId !== 'all') q = q.eq('owner_user_id', selectedSdrId);
      const { data, error } = await q;
      if (error) throw error;
      const statusCounts: Record<string, number> = {};
      data?.forEach(lead => { statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1; });
      return Object.entries(statusCounts).map(([status, count]) => ({ status, count }));
    },
  });

  const { data: leadsByType = [], isLoading: isLoadingByType } = useQuery({
    queryKey: ['leadsByType', dateRange?.start, dateRange?.end, selectedSdrId],
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase.from('leads').select('lead_type').limit(20000);
      if (dateRange?.start) q = q.gte('created_at', dateRange.start);
      if (dateRange?.end) q = q.lte('created_at', dateRange.end);
      if (selectedSdrId && selectedSdrId !== 'all') q = q.eq('owner_user_id', selectedSdrId);
      const { data, error } = await q;
      if (error) throw error;
      const typeCounts: Record<string, number> = {};
      data?.forEach(lead => { typeCounts[lead.lead_type] = (typeCounts[lead.lead_type] || 0) + 1; });
      return Object.entries(typeCounts).map(([type, count]) => ({ type, count }));
    },
  });

  const statusTotal = leadsByStatus.reduce((sum, s) => sum + s.count, 0);
  const typeTotal = leadsByType.reduce((sum, i) => sum + i.count, 0);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Leads by Status */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Leads por Status</span>
          </div>
          <div className="p-4">
            {isLoadingByStatus ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {leadsByStatus.map((entry, index) => {
                  const pct = statusTotal > 0 ? Math.round((entry.count / statusTotal) * 100) : 0;
                  const color = STATUS_COLORS[entry.status] || COLORS[index % COLORS.length];
                  return (
                    <div key={entry.status} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-xs font-medium text-foreground truncate">{entry.status}</span>
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {fmt(entry.count)} <span className="text-muted-foreground/60">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Leads by Type */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Leads por Tipo</span>
          </div>
          <div className="p-4">
            {isLoadingByType ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {leadsByType.map((item, index) => {
                  const percentage = typeTotal > 0 ? Math.round((item.count / typeTotal) * 100) : 0;
                  const color = COLORS[index % COLORS.length];
                  return (
                    <div key={item.type} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-xs font-medium text-foreground">{item.type}</span>
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {fmt(item.count)} <span className="text-muted-foreground/60">({percentage}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/** @deprecated Use ReportsKPICards and ReportsCharts separately */
export const ReportsSection = () => (
  <div className="space-y-4">
    <ReportsKPICards />
    <ReportsCharts />
  </div>
);
