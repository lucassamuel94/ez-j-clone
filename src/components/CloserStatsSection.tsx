import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus, Target, AlertTriangle, CalendarCheck, Clock, DollarSign, Percent, BarChart3 } from 'lucide-react';
import { startOfDay, startOfWeek, startOfMonth, endOfDay, subDays, subWeeks, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

export type CloserPeriodType = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom';

type PeriodType = CloserPeriodType;

interface CloserStats {
  meetingsHeld: number;
  awaitingPaymentQty: number;
  awaitingPaymentValue: number;
  wonQty: number;
  wonValue: number;
  conversionRate: number;
  avgTicket: number;
}

interface CloserStatsWithComparison {
  current: CloserStats;
  previous: CloserStats;
}

const getDateRanges = (period: PeriodType, customRange?: DateRange) => {
  const now = new Date();
  switch (period) {
    case 'today': {
      const todayStart = startOfDay(now);
      const yesterdayStart = subDays(todayStart, 1);
      return { currentStart: todayStart.toISOString(), currentEnd: now.toISOString(), previousStart: yesterdayStart.toISOString(), previousEnd: todayStart.toISOString() };
    }
    case 'yesterday': {
      const yesterdayStart = subDays(startOfDay(now), 1);
      const yesterdayEnd = startOfDay(now);
      const prevStart = subDays(yesterdayStart, 1);
      return { currentStart: yesterdayStart.toISOString(), currentEnd: yesterdayEnd.toISOString(), previousStart: prevStart.toISOString(), previousEnd: yesterdayStart.toISOString() };
    }
    case '7d': {
      const start = subDays(startOfDay(now), 6);
      const prevStart = subDays(start, 7);
      return { currentStart: start.toISOString(), currentEnd: now.toISOString(), previousStart: prevStart.toISOString(), previousEnd: start.toISOString() };
    }
    case '30d': {
      const start = subDays(startOfDay(now), 29);
      const prevStart = subDays(start, 30);
      return { currentStart: start.toISOString(), currentEnd: now.toISOString(), previousStart: prevStart.toISOString(), previousEnd: start.toISOString() };
    }
    case 'month': {
      const monthStart = startOfMonth(now);
      const previousMonthStart = subMonths(monthStart, 1);
      return { currentStart: monthStart.toISOString(), currentEnd: now.toISOString(), previousStart: previousMonthStart.toISOString(), previousEnd: monthStart.toISOString() };
    }
    case 'custom': {
      if (customRange?.from) {
        const from = startOfDay(customRange.from);
        const to = customRange.to ? endOfDay(customRange.to) : endOfDay(customRange.from);
        const rangeDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
        const prevEnd = from;
        const prevStart = subDays(prevEnd, rangeDays);
        return { currentStart: from.toISOString(), currentEnd: to.toISOString(), previousStart: prevStart.toISOString(), previousEnd: prevEnd.toISOString() };
      }
      const todayStart = startOfDay(now);
      const yesterdayStart = subDays(todayStart, 1);
      return { currentStart: todayStart.toISOString(), currentEnd: now.toISOString(), previousStart: yesterdayStart.toISOString(), previousEnd: todayStart.toISOString() };
    }
  }
};

const fetchPeriodStats = async (
  userId: string,
  start: string,
  end: string,
  endOp: 'lte' | 'lt' = 'lte',
): Promise<CloserStats> => {
  let totalQ = supabase
    .from('opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('assigned_to_user_id', userId)
    .eq('returned_to_sdr', false)
    .gte('created_at', start);
  totalQ = endOp === 'lte' ? totalQ.lte('created_at', end) : totalQ.lt('created_at', end);

  let awaitQ = supabase
    .from('opportunities')
    .select('deal_value')
    .eq('assigned_to_user_id', userId)
    .eq('returned_to_sdr', false)
    .eq('stage', 'Aguardando pagamento')
    .gte('created_at', start)
    .limit(20000);
  awaitQ = endOp === 'lte' ? awaitQ.lte('created_at', end) : awaitQ.lt('created_at', end);

  let wonQ = supabase
    .from('opportunities')
    .select('id, deal_value')
    .eq('assigned_to_user_id', userId)
    .eq('returned_to_sdr', false)
    .eq('stage', 'Ganho')
    .gte('won_at', start)
    .limit(20000);
  wonQ = endOp === 'lte' ? wonQ.lte('won_at', end) : wonQ.lt('won_at', end);

  const [totalRes, awaitRes, wonRes] = await Promise.all([totalQ, awaitQ, wonQ]);

  const totalCount = totalRes.count ?? 0;
  const awaitData = awaitRes.data ?? [];
  const wonData = wonRes.data ?? [];
  const wonQty = wonData.length;

  // Fetch proposal setup_total for won opportunities (same logic as Ranking)
  let wonValue = 0;
  if (wonQty > 0) {
    const wonIds = wonData.map((o: any) => o.id).filter(Boolean);
    const { data: proposals } = await supabase
      .from('proposals')
      .select('opportunity_id, setup_total')
      .in('opportunity_id', wonIds.slice(0, 500))
      .limit(5000);

    const proposalMap: Record<string, number> = {};
    (proposals || []).forEach((p: any) => {
      if (p.opportunity_id) {
        proposalMap[p.opportunity_id] = (proposalMap[p.opportunity_id] || 0) + Number(p.setup_total || 0);
      }
    });

    wonValue = wonData.reduce((sum, o: any) => {
      const proposalValue = proposalMap[o.id];
      return sum + (proposalValue != null && proposalValue > 0 ? proposalValue : (Number(o.deal_value) || 0));
    }, 0);
  }

  return {
    meetingsHeld: totalCount,
    awaitingPaymentQty: awaitData.length,
    awaitingPaymentValue: awaitData.reduce((sum, o) => sum + (Number(o.deal_value) || 0), 0),
    wonQty,
    wonValue,
    conversionRate: totalCount > 0 ? (wonQty / totalCount) * 100 : 0,
    avgTicket: wonQty > 0 ? wonValue / wonQty : 0,
  };
};

const useCloserStats = (period: PeriodType, selectedCloserId?: string, customRange?: DateRange) => {
  return useQuery({
    queryKey: ['closer-stats', period, selectedCloserId, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async (): Promise<CloserStatsWithComparison> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const empty: CloserStats = { meetingsHeld: 0, awaitingPaymentQty: 0, awaitingPaymentValue: 0, wonQty: 0, wonValue: 0, conversionRate: 0, avgTicket: 0 };
        return { current: empty, previous: empty };
      }

      const targetUserId = (selectedCloserId && selectedCloserId !== 'all') ? selectedCloserId : user.id;
      const { currentStart, currentEnd, previousStart, previousEnd } = getDateRanges(period, customRange);

      const [current, previous] = await Promise.all([
        fetchPeriodStats(targetUserId, currentStart, currentEnd, 'lte'),
        fetchPeriodStats(targetUserId, previousStart, previousEnd, 'lt'),
      ]);

      return { current, previous };
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
};

const calculateChange = (current: number, previous: number) => {
  if (previous === 0) {
    if (current === 0) return { percent: 0, trend: 'neutral' as const };
    return { percent: 100, trend: 'up' as const };
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent > 0) return { percent, trend: 'up' as const };
  if (percent < 0) return { percent: Math.abs(percent), trend: 'down' as const };
  return { percent: 0, trend: 'neutral' as const };
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

/* ─── Metric Card (marketing style) ─── */
interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  numericCurrent: number;
  numericPrevious: number;
}

const MetricCard = ({ label, value, subtitle, icon, numericCurrent, numericPrevious }: MetricCardProps) => {
  const change = calculateChange(numericCurrent, numericPrevious);

  return (
    <Card className="border border-border rounded-2xl shadow-sm hover:shadow-md transition-all duration-200">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
          {change.trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-success" />}
          {change.trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
          {change.trend === 'neutral' && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
};

/* ─── Goal Progress Card ─── */
const GoalProgressCard = ({ current, goal }: { current: CloserStats; goal: any }) => {
  if (!goal) return null;

  const revenueGoal = Number(goal.setup_revenue_goal) || 0;
  const conversionGoal = Number(goal.conversion_percentage) || 0;

  if (revenueGoal === 0 && conversionGoal === 0) return null;

  const revenuePercent = revenueGoal > 0 ? Math.min(100, Math.round((current.wonValue / revenueGoal) * 100)) : 0;
  const conversionPercent = conversionGoal > 0 ? Math.min(100, Math.round((current.conversionRate / conversionGoal) * 100)) : 0;

  // Daily target projection
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = now.getDate();
  const expectedPercent = Math.round((daysPassed / daysInMonth) * 100);
  const behindTarget = revenuePercent < expectedPercent - 10;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Metas do Mês</span>
        </div>

        {revenueGoal > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Receita</span>
              <span className={cn('font-medium tabular-nums', revenuePercent >= 100 ? 'text-[hsl(var(--chart-3))]' : 'text-foreground')}>
                {formatCurrency(current.wonValue)} / {formatCurrency(revenueGoal)} ({revenuePercent}%)
              </span>
            </div>
            <Progress value={revenuePercent} className="h-1.5 bg-border/40" />
          </div>
        )}

        {conversionGoal > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Conversão</span>
              <span className={cn('font-medium tabular-nums', conversionPercent >= 100 ? 'text-[hsl(var(--chart-3))]' : 'text-foreground')}>
                {current.conversionRate.toFixed(1)}% / {conversionGoal}% ({conversionPercent}%)
              </span>
            </div>
            <Progress value={conversionPercent} className="h-1.5 bg-border/40" />
          </div>
        )}

        {behindTarget && revenueGoal > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--chart-2))]">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span>Ritmo abaixo do esperado para o dia {daysPassed}/{daysInMonth}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/* ─── Main Section ─── */
interface CloserStatsSectionProps {
  selectedCloserId?: string;
  period: PeriodType;
  onPeriodChange: (p: PeriodType) => void;
  customRange?: DateRange;
}

export const CloserStatsSection = ({ selectedCloserId, period, onPeriodChange, customRange }: CloserStatsSectionProps) => {
  const { data: stats, isLoading } = useCloserStats(period, selectedCloserId, customRange);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const targetUserId = (selectedCloserId && selectedCloserId !== 'all') ? selectedCloserId : undefined;

  // Fetch closer goal
  const { data: goal } = useQuery({
    queryKey: ['closer-goal', currentMonth, currentYear, targetUserId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const userId = targetUserId || user.id;

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

  // Month stats for goal progress
  const { data: monthStats } = useCloserStats('month', selectedCloserId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="min-w-[120px] flex-shrink-0 h-[62px] rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ─── Goal Progress Card ─── */}
      {monthStats && <GoalProgressCard current={monthStats.current} goal={goal} />}
    </div>
  );
};
