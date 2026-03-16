import { useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Lead } from '@/types/lead';
import { cn } from '@/lib/utils';

import {
  Flame,
  AlertTriangle,
  TrendingUp,
  Phone,
  Clock,
  Target,
  Trophy,
  Zap,
  CalendarCheck,
  CalendarDays,
  PhoneCall,
  ShieldCheck,
  Activity,
  Timer,
  BarChart3,
  Users,
} from 'lucide-react';
import { startOfMonth, startOfDay, differenceInBusinessDays, addMonths } from 'date-fns';

interface SDRExecutionDashboardProps {
  selectedSdrId?: string;
  onLeadClick: (lead: Lead) => void;
  dateRange?: { start: string; end: string; label: string };
}

// ─── Centralized auth user hook ────────────────────────────────
const useAuthUserId = () => {
  return useQuery({
    queryKey: ['auth-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
};

// ─── Conversion Rate Card ──────────────────────────────────────
const ConversionRateCard = memo(({ label, rate, threshold, icon }: { label: string; rate: number; threshold: { red: number; yellow: number }; icon: React.ReactNode }) => {
  const color = rate < threshold.red ? 'text-destructive' : rate < threshold.yellow ? 'text-[hsl(var(--chart-2))]' : 'text-[hsl(var(--chart-3))]';
  const bgColor = rate < threshold.red ? 'bg-destructive/10' : rate < threshold.yellow ? 'bg-[hsl(var(--chart-2))]/10' : 'bg-[hsl(var(--chart-3))]/10';
  const badgeConfig = rate < threshold.red
    ? { label: '⚠ Abaixo', cls: 'border-destructive/30 text-destructive bg-destructive/5' }
    : rate < threshold.yellow
    ? { label: '⚠ Mediano', cls: 'border-warning/30 text-warning bg-warning/5' }
    : { label: '✓ Acima', cls: 'border-success/30 text-success bg-success/5' };

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-md border bg-card">
      <div className="p-1.5 rounded-md bg-[#f1effe]">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
        <p className={cn('text-base font-bold leading-tight', color)}>{rate.toFixed(1)}%</p>
      </div>
      <Badge variant="outline" className={cn('text-[10px] shrink-0', badgeConfig.cls)}>
        {badgeConfig.label}
      </Badge>
    </div>
  );
});
ConversionRateCard.displayName = 'ConversionRateCard';

// ─── Daily Goal Bar ────────────────────────────────────────────
const DailyGoalBar = memo(({ label, current, goal, icon, tooltip }: { label: string; current: number; goal: number; icon: React.ReactNode; tooltip?: string }) => {
  const percent = goal > 0 ? Math.min(Math.round((current / goal) * 100), 100) : 0;
  const isComplete = current >= goal && goal > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {tooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help border-b border-dashed border-muted-foreground/50">{label}</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span>{label}</span>
          )}
        </div>
        <span className={cn('text-xs font-semibold', isComplete ? 'text-[hsl(var(--chart-3))]' : 'text-foreground')}>
          {current}/{goal}
        </span>
      </div>
      <Progress value={percent} className="h-2 bg-border/40" />
    </div>
  );
});
DailyGoalBar.displayName = 'DailyGoalBar';

export const SDRExecutionDashboard = memo(({ selectedSdrId, onLeadClick, dateRange }: SDRExecutionDashboardProps) => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthStart = startOfMonth(now).toISOString();

  const { data: authUserId } = useAuthUserId();

  // ─── Resolve user IDs for queries ────────────────────────────
  const { data: sdrUserIds } = useQuery({
    queryKey: ['sdr-user-ids-for-exec'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('user_id').eq('role', 'sdr');
      return (data || []).map((r) => r.user_id);
    },
    staleTime: 300_000,
    enabled: selectedSdrId === 'all',
  });

  // Build the user_ids array for the RPC
  const rpcUserIds = useMemo(() => {
    if (selectedSdrId && selectedSdrId !== 'all') return [selectedSdrId];
    if (selectedSdrId === 'all' && sdrUserIds && sdrUserIds.length > 0) return sdrUserIds;
    if (!selectedSdrId && authUserId) return [authUserId];
    return null;
  }, [selectedSdrId, sdrUserIds, authUserId]);

  const filterStart = dateRange?.start || startOfDay(now).toISOString();
  const filterLabel = dateRange?.label || 'Hoje';

  // ─── SINGLE RPC: All execution stats ─────────────────────────
  const { data: execStats } = useQuery({
    queryKey: ['exec-stats-rpc', rpcUserIds, filterStart, monthStart],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sdr_execution_stats', {
        p_user_ids: rpcUserIds,
        p_period_start: filterStart,
        p_month_start: monthStart,
      });
      if (error) throw error;
      return data as {
        period_calls: number;
        period_connected: number;
        period_meetings: number;
        period_sqo: number;
        month_calls: number;
        month_connected: number;
        month_meetings: number;
        month_sqo: number;
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: !!authUserId && rpcUserIds !== null,
  });

  // ─── Alert counts via RPC ────────────────────────────────────
  const effectiveSdrId = useMemo(() => {
    if (selectedSdrId && selectedSdrId !== 'all') return selectedSdrId;
    if (!selectedSdrId && authUserId) return authUserId;
    return null;
  }, [selectedSdrId, authUserId]);

  const { data: alertCounts } = useQuery({
    queryKey: ['sdr-alert-counts', effectiveSdrId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sdr_alert_counts', {
        p_sdr_id: effectiveSdrId,
      });
      if (error) throw error;
      return data as { hot: number; overdue: number; noTask: number };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: !!authUserId,
  });

  // ─── Fetch goal ──────────────────────────────────────────────
  const { data: goal } = useQuery({
    queryKey: ['exec-goal', currentMonth, currentYear, selectedSdrId],
    queryFn: async () => {
      if (!authUserId) return null;
      const isAll = selectedSdrId === 'all';
      const targetId = selectedSdrId && !isAll ? selectedSdrId : !selectedSdrId ? authUserId : null;

      if (targetId) {
        const { data: individual } = await supabase
          .from('goals')
          .select('*')
          .eq('target_user_id', targetId)
          .eq('period_month', currentMonth)
          .eq('period_year', currentYear)
          .eq('goal_type', 'sdr')
          .maybeSingle();
        if (individual) return individual;
      }

      const { data: team } = await supabase
        .from('goals')
        .select('*')
        .is('target_user_id', null)
        .eq('period_month', currentMonth)
        .eq('period_year', currentYear)
        .eq('goal_type', 'sdr')
        .maybeSingle();
      return team;
    },
    staleTime: 60_000,
    enabled: !!authUserId,
  });

  // ─── Fetch team ranking ──────────────────────────────────────
  const { data: ranking = [] } = useQuery({
    queryKey: ['exec-ranking', currentMonth, currentYear],
    queryFn: async () => {
      if (!authUserId) return [];

      const { data: sdrRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'sdr');
      const allSdrIds = (sdrRoles || []).map((r) => r.user_id);
      if (allSdrIds.length === 0) return [];
      const { data: profiles } = await supabase.from('profiles').select('id, name').eq('active', true).in('id', allSdrIds);
      if (!profiles || profiles.length === 0) return [];

      const { data: allMeetings } = await supabase.from('meetings').select('user_id').gte('created_at', monthStart).limit(50000);
      const { data: allCalls } = await supabase.from('interactions').select('user_id').eq('direction', 'outbound').gte('occurred_at', monthStart).limit(50000);

      // Confirmed meetings (lead confirmou presença)
      const { data: confirmedLogs } = await supabase
        .from('lead_activity_logs')
        .select('user_id')
        .eq('action_type', 'opportunity_created')
        .ilike('description', '%confirmou presença%')
        .gte('created_at', monthStart)
        .limit(50000);
      const confirmedByUser = new Map<string, number>();
      (confirmedLogs || []).forEach((l) => {
        if (l.user_id) confirmedByUser.set(l.user_id, (confirmedByUser.get(l.user_id) || 0) + 1);
      });

      // Use sqo_approved_at for consistent SQO counting
      const { data: sqoLeads } = await supabase
        .from('leads')
        .select('id, owner_user_id')
        .not('sqo_approved_at', 'is', null)
        .gte('sqo_approved_at', monthStart)
        .limit(50000);
      const sqoByOwner = new Map<string, number>();
      (sqoLeads || []).forEach((l) => {
        sqoByOwner.set(l.owner_user_id, (sqoByOwner.get(l.owner_user_id) || 0) + 1);
      });

      const sdrScores = profiles.map((p) => {
        const meetings = (allMeetings || []).filter((m) => m.user_id === p.id).length;
        const attempts = (allCalls || []).filter((c) => c.user_id === p.id).length;
        const confirmedCount = confirmedByUser.get(p.id) || 0;
        const sqoCount = sqoByOwner.get(p.id) || 0;
        const conversionRate = attempts > 0 ? (meetings / attempts) * 100 : 0;
        const score = sqoCount * 0.4 * 25 + meetings * 0.3 * 10 + conversionRate * 0.2 + attempts * 0.1;
        return { id: p.id, name: p.name, meetings, confirmed: confirmedCount, sqo: sqoCount, conversionRate, score };
      });

      return sdrScores.sort((a, b) => b.score - a.score);
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
    enabled: !!authUserId,
  });

  // ─── Team-wide totals (RPC, bypasses RLS) ───────────────────
  const { data: teamTotals = { totalAgendado: 0, totalConfirmado: 0, totalSQO: 0 } } = useQuery({
    queryKey: ['sdr-team-totals', monthStart],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sdr_team_totals' as never);
      if (error) throw error;
      const d = data as Record<string, number> | null;
      return {
        totalAgendado: Number(d?.total_agendado) || 0,
        totalConfirmado: Number(d?.total_confirmado) || 0,
        totalSQO: Number(d?.total_sqo) || 0,
      };
    },
    staleTime: 60_000,
  });

  // ─── Computed Values from single RPC ─────────────────────────
  const callAttempts = execStats?.period_calls ?? 0;
  const meetingsToday = execStats?.period_meetings ?? 0;
  const connectedToday = execStats?.period_connected ?? 0;
  const connectionRate = callAttempts > 0 ? (connectedToday / callAttempts) * 100 : 0;
  const meetingConversionRate = callAttempts > 0 ? (meetingsToday / callAttempts) * 100 : 0;
  const filteredSqoCount = execStats?.period_sqo ?? 0;

  const monthMeetingsCount = execStats?.month_meetings ?? 0;
  const monthConfirmed = execStats?.month_sqo ?? 0;
  const sqoRate = monthMeetingsCount > 0 ? (monthConfirmed / monthMeetingsCount) * 100 : 0;

  const monthlyMeetingGoal = goal?.meetings_scheduled_goal || 0;
  const monthlySqoGoal = Math.round(Number(goal?.sqo_percentage || 0));
  const businessDaysInMonth = 22;
  const dailyMeetingGoal = Math.ceil(monthlyMeetingGoal / businessDaysInMonth);
  const CALLS_PER_MEETING_MULTIPLIER = 16;
  const dailyCallGoal = dailyMeetingGoal * CALLS_PER_MEETING_MULTIPLIER;
  const dailySqoGoal = Math.max(1, Math.ceil(monthlySqoGoal / businessDaysInMonth));

  const hourNow = now.getHours();
  const workStartHour = 9;
  const workEndHour = 17;
  const hoursWorked = Math.max(0, Math.min(hourNow - workStartHour, workEndHour - workStartHour));
  const totalWorkHours = workEndHour - workStartHour;
  const idealCallsPerHour = dailyCallGoal / totalWorkHours;
  const expectedCallsNow = Math.round(idealCallsPerHour * hoursWorked);
  const pacePercent = expectedCallsNow > 0 ? (callAttempts / expectedCallsNow) * 100 : 100;
  const paceStatus = pacePercent < 80 ? 'behind' : pacePercent > 110 ? 'ahead' : 'on_track';

  const monthStartDate = startOfMonth(now);
  const nextMonthStart = addMonths(monthStartDate, 1);
  const totalBusinessDays = differenceInBusinessDays(nextMonthStart, monthStartDate);
  const elapsedBusinessDays = differenceInBusinessDays(now, monthStartDate);
  const remainingBusinessDays = Math.max(1, totalBusinessDays - elapsedBusinessDays);

  const currentMonthMeetings = monthMeetingsCount;
  const meetingsNeededPerDay = monthlyMeetingGoal > 0 ? Math.max(0, Math.ceil((monthlyMeetingGoal - currentMonthMeetings) / remainingBusinessDays)) : 0;

  const projectedTotal = elapsedBusinessDays > 0 ? Math.round((currentMonthMeetings / elapsedBusinessDays) * totalBusinessDays) : 0;
  const projectedPercent = monthlyMeetingGoal > 0 ? Math.round((projectedTotal / monthlyMeetingGoal) * 100) : 100;

  const myId = selectedSdrId && selectedSdrId !== 'all' ? selectedSdrId : authUserId;
  const myRankIndex = ranking.findIndex((r) => r.id === myId);
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;
  const teamAvg = ranking.length > 0 ? ranking.reduce((sum, r) => sum + r.score, 0) / ranking.length : 0;
  const myScore = myRankIndex >= 0 ? ranking[myRankIndex].score : 0;
  const vsTeamPercent = teamAvg > 0 ? Math.round(((myScore - teamAvg) / teamAvg) * 100) : 0;

  const hotCount = alertCounts?.hot ?? 0;
  const overdueCount = alertCounts?.overdue ?? 0;
  const noTaskCount = alertCounts?.noTask ?? 0;

  return (
    <div className="space-y-3">
      {/* ─── Team Summary Bar (always monthly) ─────────────────── */}
      {ranking.length > 0 && (
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Resultado da Equipe — Mês Atual</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 rounded-lg bg-card border border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Agendados</p>
                <p className="text-xl font-bold text-foreground tabular-nums mt-0.5">{teamTotals.totalAgendado}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-card border border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Confirmados</p>
                <p className="text-xl font-bold text-foreground tabular-nums mt-0.5">{teamTotals.totalConfirmado}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-card border border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">SQO</p>
                <p className="text-xl font-bold text-foreground tabular-nums mt-0.5">{teamTotals.totalSQO}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Critical Alerts Bar ──────────────────────────────── */}
      {(hotCount > 0 || overdueCount > 0 || noTaskCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {hotCount > 0 && (
            <Badge variant="outline" className="text-xs border-destructive/30 text-destructive bg-destructive/5 gap-1.5 py-1">
              <Flame className="h-3 w-3" /> {hotCount} leads quentes pendentes
            </Badge>
          )}
          {overdueCount > 0 && (
            <Badge variant="outline" className="text-xs border-destructive/30 text-destructive bg-destructive/5 gap-1.5 py-1">
              <AlertTriangle className="h-3 w-3" /> {overdueCount} tarefas atrasadas
            </Badge>
          )}
          {noTaskCount > 0 && (
            <Badge variant="outline" className="text-xs border-muted-foreground/30 text-muted-foreground gap-1.5 py-1">
              <Clock className="h-3 w-3" /> {noTaskCount} leads sem próxima ação
            </Badge>
          )}
        </div>
      )}

      {/* ─── Main Grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* ─── Conversion Rates ──────────────────────────────────── */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Taxas de Conversão</span>
              <Badge variant="outline" className="text-[10px] ml-auto">{filterLabel}</Badge>
            </div>
            <div className="space-y-2">
              <ConversionRateCard label="Taxa de Conexão" rate={connectionRate} threshold={{ red: 20, yellow: 40 }} icon={<PhoneCall className="h-4 w-4 text-primary" />} />
              <ConversionRateCard label="Conversão p/ Reunião" rate={meetingConversionRate} threshold={{ red: 15, yellow: 30 }} icon={<CalendarCheck className="h-4 w-4 text-primary" />} />
              <ConversionRateCard label="Taxa de SQO" rate={sqoRate} threshold={{ red: 20, yellow: 35 }} icon={<ShieldCheck className="h-4 w-4 text-primary" />} />
            </div>
          </CardContent>
        </Card>

        {/* ─── Daily Execution Panel ─────────────────────────────── */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Execução do Dia</span>
            </div>
            <div className="space-y-3">
              <DailyGoalBar label="Tentativas" current={callAttempts} goal={dailyCallGoal} icon={<Phone className="h-3 w-3" />} tooltip="Meta diária = (Meta mensal de reuniões ÷ 22 dias úteis) × 16 tentativas por reunião" />
              <DailyGoalBar label="Reuniões agendadas" current={meetingsToday} goal={dailyMeetingGoal} icon={<CalendarCheck className="h-3 w-3" />} />
              <DailyGoalBar label="SQO gerado" current={filteredSqoCount} goal={dailySqoGoal} icon={<ShieldCheck className="h-3 w-3" />} />
            </div>

            {/* Pace Indicator */}
            <div
              className={cn(
                'mt-3 p-2 rounded-lg text-xs flex items-center gap-2',
                paceStatus === 'behind'
                  ? 'bg-[hsl(var(--chart-2))]/10 text-[hsl(var(--chart-2))]'
                  : paceStatus === 'ahead'
                    ? 'bg-[hsl(var(--chart-3))]/10 text-[hsl(var(--chart-3))]'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {paceStatus === 'behind' ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Ritmo abaixo do esperado para {hoursWorked}h trabalhadas ({callAttempts}/{expectedCallsNow} tentativas)
                  </span>
                </>
              ) : paceStatus === 'ahead' ? (
                <>
                  <Zap className="h-3.5 w-3.5 shrink-0" />
                  <span>🔥 Ritmo acima do esperado! Continue assim.</span>
                </>
              ) : (
                <>
                  <Timer className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Ritmo ok — {callAttempts}/{expectedCallsNow} tentativas até agora
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── Monthly Projection + Ranking ──────────────────────── */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Projeção Mensal</span>
            </div>

            {monthlyMeetingGoal > 0 ? (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Agendamentos no mês</span>
                    <span className="font-medium text-foreground">
                      {currentMonthMeetings}/{monthlyMeetingGoal}
                    </span>
                  </div>
                  <Progress value={Math.min(100, Math.round((currentMonthMeetings / monthlyMeetingGoal) * 100))} className="h-2 bg-border/40" />
                </div>

                <div className="p-2 rounded-lg text-xs text-muted-foreground space-y-1 bg-muted/50">
                  <p>
                    <CalendarDays className="h-3.5 w-3.5 inline-block mr-1 text-muted-foreground" /> <span className="font-medium text-foreground">{remainingBusinessDays}</span> dias úteis restantes
                  </p>
                  <p>
                    <Target className="h-3.5 w-3.5 inline-block mr-1 text-muted-foreground" /> Precisa de <span className="font-medium text-foreground">{meetingsNeededPerDay}</span> reuniões/dia útil
                  </p>
                </div>

                {projectedPercent < 100 && elapsedBusinessDays > 2 && (
                  <div className="p-2 rounded-lg bg-[hsl(var(--chart-2))]/10 text-xs text-[hsl(var(--chart-2))] flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>⚠ Mantendo esse ritmo, você fechará o mês com {projectedPercent}% da meta.</span>
                  </div>
                )}

                {projectedPercent >= 100 && elapsedBusinessDays > 2 && (
                  <div className="p-2 rounded-lg bg-[hsl(var(--chart-3))]/10 text-xs text-[hsl(var(--chart-3))] flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                    <span>Projeção: {projectedPercent}% da meta — no caminho certo!</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma meta configurada para este mês.</p>
            )}

            {/* Ranking */}
            {ranking.length > 1 && myRank && (
              <div className="mt-4 pt-3 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-foreground">Ranking do Time</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Sua posição: <span className="font-bold text-foreground text-sm">#{myRank}</span> de {ranking.length} SDRs
                  </div>
                  {vsTeamPercent < 0 && (
                    <Badge variant="outline" className="text-[10px] border-[hsl(var(--chart-2))]/30 text-[hsl(var(--chart-2))]">
                      {vsTeamPercent}% vs média
                    </Badge>
                  )}
                  {vsTeamPercent > 0 && (
                    <Badge variant="outline" className="text-[10px] border-[hsl(var(--chart-3))]/30 text-[hsl(var(--chart-3))]">
                      +{vsTeamPercent}% vs média
                    </Badge>
                  )}
                </div>
                {vsTeamPercent < -15 && (
                  <p className="text-[11px] text-[hsl(var(--chart-2))] mt-1">
                    ⚠ Sua performance está {Math.abs(vsTeamPercent)}% abaixo da média do time.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

SDRExecutionDashboard.displayName = 'SDRExecutionDashboard';
