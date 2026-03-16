import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Phone, PhoneCall, Calendar, CalendarCheck, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Building2, User, Clock, ExternalLink, Target, ShieldCheck } from 'lucide-react';
import { startOfDay, startOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SDRStats {
  callAttempts: number;
  completedCalls: number;
  totalScheduled: number;
  totalConfirmed: number;
  sqoApproved: number;
}

interface MeetingLeadData {
  id: string;
  name: string;
  company: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  phone: string | null;
  phone_2: string | null;
  email: string | null;
}

interface MeetingWithLead {
  id: string;
  title: string;
  meeting_datetime: string;
  executive_name: string;
  lead_id: string;
  user_id: string | null;
  leads: MeetingLeadData | null;
  sdr_profile?: {
    name: string;
  } | null;
}

interface ConfirmedLead {
  id: string;
  name: string;
  company: string;
  phone: string | null;
  email: string | null;
  updated_at: string;
  sdr_name?: string | null;
}

interface SDRStatsWithComparison {
  current: SDRStats;
  previous: SDRStats;
  scheduledMeetings: MeetingWithLead[];
  confirmedLeads: ConfirmedLead[];
  sqoApprovedLeads: ConfirmedLead[];
}

const getDateRangesFromProp = (dateRange: { start: string; end: string }) => {
  const startMs = new Date(dateRange.start).getTime();
  const endMs = new Date(dateRange.end).getTime();
  const durationMs = endMs - startMs;
  const previousStart = new Date(startMs - durationMs).toISOString();
  const previousEnd = dateRange.start;
  return {
    currentStart: dateRange.start,
    currentEnd: dateRange.end,
    previousStart,
    previousEnd,
  };
};

// ─── Consolidated RPC hook for counts ──────────────────────────
const useSDRStatsCounts = (dateRange: { start: string; end: string }, selectedSdrId?: string) => {
  return useQuery({
    queryKey: ['sdr-stats-counts-rpc', dateRange.start, dateRange.end, selectedSdrId],
    queryFn: async (): Promise<{ current: SDRStats; previous: SDRStats }> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const emptyStats = { callAttempts: 0, completedCalls: 0, totalScheduled: 0, totalConfirmed: 0, sqoApproved: 0 };
        return { current: emptyStats, previous: emptyStats };
      }

      const isAll = selectedSdrId === 'all';
      const targetUserId = (selectedSdrId && !isAll) ? selectedSdrId : (!selectedSdrId ? user.id : null);

      let userIds: string[] | null = null;
      if (targetUserId) {
        userIds = [targetUserId];
      } else if (isAll) {
        const { data: sdrRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'sdr');
        userIds = (sdrRoles || []).map(r => r.user_id);
        if (userIds.length === 0) {
          const emptyStats = { callAttempts: 0, completedCalls: 0, totalScheduled: 0, totalConfirmed: 0, sqoApproved: 0 };
          return { current: emptyStats, previous: emptyStats };
        }
      }

      const { currentStart, currentEnd, previousStart, previousEnd } = getDateRangesFromProp(dateRange);

      const { data, error } = await supabase.rpc('get_sdr_stats_comparison', {
        p_user_ids: userIds,
        p_current_start: currentStart,
        p_current_end: currentEnd,
        p_previous_start: previousStart,
        p_previous_end: previousEnd,
      });
      if (error) throw error;

      const result = data as unknown as { current: SDRStats; previous: SDRStats };
      return result;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};

// ─── Detail data hook (fetched on-demand when modal opens) ─────
const useSDRStatsDetails = (dateRange: { start: string; end: string }, selectedSdrId: string | undefined, modalType: ModalType) => {
  return useQuery({
    queryKey: ['sdr-stats-details', dateRange.start, dateRange.end, selectedSdrId, modalType],
    queryFn: async (): Promise<{ scheduledMeetings: MeetingWithLead[]; confirmedLeads: ConfirmedLead[]; sqoApprovedLeads: ConfirmedLead[] }> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { scheduledMeetings: [], confirmedLeads: [], sqoApprovedLeads: [] };

      const isAll = selectedSdrId === 'all';
      const targetUserId = (selectedSdrId && !isAll) ? selectedSdrId : (!selectedSdrId ? user.id : null);

      let sdrUserIds: string[] | null = null;
      if (isAll) {
        const { data: sdrRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'sdr');
        sdrUserIds = (sdrRoles || []).map(r => r.user_id);
        if (sdrUserIds.length === 0) return { scheduledMeetings: [], confirmedLeads: [], sqoApprovedLeads: [] };
      }

      const applyUserFilter = <T extends unknown>(query: T, col: string): T => {
        if (targetUserId) return (query as Record<string, Function>).eq(col, targetUserId) as T;
        if (sdrUserIds) return (query as Record<string, Function>).in(col, sdrUserIds) as T;
        return query;
      };

      const { currentStart, currentEnd } = getDateRangesFromProp(dateRange);
      let scheduledMeetings: MeetingWithLead[] = [];
      let confirmedLeads: ConfirmedLead[] = [];
      let sqoApprovedLeads: ConfirmedLead[] = [];

      // Only fetch what the modal needs
      if (modalType === 'scheduled') {
        const { data: rawMeetingData } = await applyUserFilter(
          supabase.from('meetings').select('id, title, meeting_datetime, executive_name, lead_id, user_id')
            .gte('created_at', currentStart).lte('created_at', currentEnd).limit(5000), 'user_id');

        const meetingLeadIds = [...new Set((rawMeetingData || []).map(m => m.lead_id).filter(Boolean))];
        const meetingLeadMap = new Map<string, MeetingLeadData>();
        if (meetingLeadIds.length > 0) {
          const { data: meetingLeads } = await supabase.from('leads').select('id, name, company, razao_social, nome_fantasia, phone, phone_2, email').in('id', meetingLeadIds);
          (meetingLeads || []).forEach(l => meetingLeadMap.set(l.id, l));
        }
        const meetingSdrIds = [...new Set((rawMeetingData || []).map(m => m.user_id).filter(Boolean))] as string[];
        const meetingSdrMap = new Map<string, string>();
        if (meetingSdrIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', meetingSdrIds);
          (profiles || []).forEach(p => meetingSdrMap.set(p.id, p.name));
        }
        scheduledMeetings = (rawMeetingData || []).map(m => ({
          ...m,
          leads: m.lead_id ? meetingLeadMap.get(m.lead_id) || null : null,
          sdr_profile: m.user_id ? { name: meetingSdrMap.get(m.user_id) || '' } : null,
        }));
      }

      if (modalType === 'confirmed') {
        const { data: currentConfirmedLogs } = await applyUserFilter(
          supabase.from('lead_activity_logs').select('id, lead_id, user_id, created_at')
            .eq('action_type', 'status_changed').eq('new_value', 'Oportunidade criada')
            .gte('created_at', currentStart).lte('created_at', currentEnd).limit(5000), 'user_id');

        const confirmedLeadIds = [...new Set((currentConfirmedLogs || []).map(l => l.lead_id).filter(Boolean))];
        const confirmedSdrMap = new Map<string, string>();
        (currentConfirmedLogs || []).forEach(log => { if (log.lead_id && log.user_id) confirmedSdrMap.set(log.lead_id, log.user_id); });

        if (confirmedLeadIds.length > 0) {
          const { data } = await supabase.from('leads').select('id, name, company, phone, email, updated_at').in('id', confirmedLeadIds).neq('status', 'Descartado');
          const sdrIds = [...new Set([...confirmedSdrMap.values()])];
          const sdrProfileMap = new Map<string, string>();
          if (sdrIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', sdrIds);
            (profiles || []).forEach(p => sdrProfileMap.set(p.id, p.name));
          }
          confirmedLeads = (data || []).map(lead => ({ ...lead, sdr_name: sdrProfileMap.get(confirmedSdrMap.get(lead.id) || '') || null }));
        }
      }

      if (modalType === 'sqo') {
        // Use sqo_approved_at for consistent SQO counting
        let sqoQuery = supabase.from('leads')
          .select('id, name, company, phone, email, updated_at, owner_user_id, sqo_approved_at')
          .not('sqo_approved_at', 'is', null)
          .gte('sqo_approved_at', currentStart)
          .lte('sqo_approved_at', currentEnd)
          .limit(5000);
        if (targetUserId) sqoQuery = sqoQuery.eq('owner_user_id', targetUserId);
        else if (sdrUserIds) sqoQuery = sqoQuery.in('owner_user_id', sdrUserIds);
        const { data: sqoLeadsData } = await sqoQuery;

        if (sqoLeadsData && sqoLeadsData.length > 0) {
          const sdrIds = [...new Set(sqoLeadsData.map(l => l.owner_user_id).filter(Boolean))];
          const sqoProfileMap = new Map<string, string>();
          if (sdrIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', sdrIds);
            (profiles || []).forEach(p => sqoProfileMap.set(p.id, p.name));
          }
          sqoApprovedLeads = sqoLeadsData.map(l => ({ ...l, sdr_name: sqoProfileMap.get(l.owner_user_id || '') || null }));
        }
      }

      return { scheduledMeetings, confirmedLeads, sqoApprovedLeads };
    },
    enabled: modalType !== null,
    staleTime: 30_000,
  });
};

const calculateChange = (current: number, previous: number): { percent: number; trend: 'up' | 'down' | 'neutral' } => {
  if (previous === 0) {
    if (current === 0) return { percent: 0, trend: 'neutral' };
    return { percent: 100, trend: 'up' };
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent > 0) return { percent, trend: 'up' };
  if (percent < 0) return { percent: Math.abs(percent), trend: 'down' };
  return { percent: 0, trend: 'neutral' };
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  previousValue: number;
  color: string;
  onClick?: () => void;
  clickable?: boolean;
}

const StatCard = ({ icon, label, value, previousValue, color, onClick, clickable }: StatCardProps) => {
  const change = calculateChange(value, previousValue);
  
  return (
    <Tooltip>
      <TooltipTrigger asChild tabIndex={0}>
          <Card 
          className={`transition-all ${clickable && value > 0 ? 'cursor-pointer hover:border-primary hover:shadow-md' : 'cursor-help'}`}
          onClick={clickable && value > 0 ? onClick : undefined}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${color}`}>
                {icon}
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
              {clickable && value > 0 && (
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-1 text-xs">
              {change.trend === 'up' && (
                <>
              <TrendingUp className="h-3 w-3 text-[hsl(var(--chart-3))]" />
                  <span className="text-[hsl(var(--chart-3))]">+{change.percent}%</span>
                </>
              )}
              {change.trend === 'down' && (
                <>
                  <TrendingDown className="h-3 w-3 text-destructive" />
                  <span className="text-destructive">-{change.percent}%</span>
                </>
              )}
              {change.trend === 'neutral' && (
                <>
                  <Minus className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">0%</span>
                </>
              )}
              <span className="text-muted-foreground ml-1">vs anterior</span>
            </div>
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent className="bg-popover border border-border">
        <div className="text-sm">
          <p className="font-medium text-foreground mb-1">{label}</p>
          <p className="text-xs text-muted-foreground">
            Período anterior: <span className="text-foreground font-medium">{previousValue}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Variação: <span className={change.trend === 'up' ? 'text-[hsl(var(--chart-3))]' : change.trend === 'down' ? 'text-destructive' : 'text-muted-foreground'} >
              {change.trend === 'up' ? '+' : change.trend === 'down' ? '-' : ''}{change.percent}%
            </span>
          </p>
          {clickable && value > 0 && (
            <p className="text-xs text-primary mt-2">Clique para ver detalhes</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

type ModalType = 'scheduled' | 'confirmed' | 'sqo' | null;

const GoalProgressBar = ({ label, current, goal }: { label: string; current: number; goal: number }) => {
  const percent = goal > 0 ? Math.min(Math.round((current / goal) * 100), 100) : 0;
  const isComplete = current >= goal && goal > 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${isComplete ? 'text-[hsl(var(--chart-3))]' : 'text-foreground'}`}>
          {current}/{goal} ({percent}%)
        </span>
      </div>
      <Progress value={percent} className="h-2 bg-border/40" />
    </div>
  );
};

interface SDRStatsSectionProps {
  selectedSdrId?: string;
  dateRange: { start: string; end: string };
}

export const SDRStatsSection = ({ selectedSdrId, dateRange }: SDRStatsSectionProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [modalType, setModalType] = useState<ModalType>(null);
  const { data: statsCounts, isLoading } = useSDRStatsCounts(dateRange, selectedSdrId);
  const { data: details } = useSDRStatsDetails(dateRange, selectedSdrId, modalType);
  const navigate = useNavigate();
  const location = useLocation();

  // Build a combined stats object for rendering
  const stats = useMemo(() => {
    if (!statsCounts) return undefined;
    return {
      ...statsCounts,
      scheduledMeetings: details?.scheduledMeetings || [],
      confirmedLeads: details?.confirmedLeads || [],
      sqoApprovedLeads: details?.sqoApprovedLeads || [],
    } as SDRStatsWithComparison;
  }, [statsCounts, details]);

  const handleOpenLead = useCallback((leadId: string) => {
    setModalType(null);
    navigate(`${location.pathname}?lead=${leadId}`);
  }, [navigate, location.pathname]);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const targetUserId = (selectedSdrId && selectedSdrId !== 'all') ? selectedSdrId : undefined;

  // Fetch goals for current month - individual or team
  const { data: goal } = useQuery({
    queryKey: ['sdr-goal', currentMonth, currentYear, targetUserId],
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
        .maybeSingle();

      if (individual) return individual;

      const { data: team } = await supabase
        .from('goals')
        .select('*')
        .is('target_user_id', null)
        .eq('period_month', currentMonth)
        .eq('period_year', currentYear)
        .maybeSingle();

      return team;
    },
    staleTime: 60_000,
  });

  // Month stats for goal progress via RPC
  const monthDateRange = useMemo(() => {
    const now = new Date();
    return { start: startOfMonth(now).toISOString(), end: now.toISOString() };
  }, []);
  const { data: monthStatsCounts } = useSDRStatsCounts(monthDateRange, selectedSdrId);

  const goalProgress = useMemo(() => {
    if (!goal || !monthStatsCounts) return null;
    const scheduledGoal = goal.meetings_scheduled_goal;
    const showRate = Number(goal.meetings_held_percentage);
    const sqoGoal = Math.round(Number(goal.sqo_percentage));
    return {
      scheduled: { current: monthStatsCounts.current.totalScheduled, goal: scheduledGoal },
      held: { current: monthStatsCounts.current.totalScheduled, goal: showRate > 0 ? Math.round(scheduledGoal * showRate / 100) : scheduledGoal },
      sqo: { current: monthStatsCounts.current.totalConfirmed, goal: sqoGoal },
    };
  }, [goal, monthStatsCounts]);

  if (isLoading) {
    return (
      <div className="mb-4">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="flex-1 min-w-[160px] animate-pulse">
              <CardContent className="p-4 h-20 bg-muted/50" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-muted-foreground">Métricas de Ligações do SDR</h3>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2">
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>
        
        <CollapsibleContent>
          <TooltipProvider>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard
                icon={<Phone className="h-4 w-4 text-primary" />}
                label="Tentativas de ligação"
                value={stats?.current.callAttempts || 0}
                previousValue={stats?.previous.callAttempts || 0}
                color="bg-primary/10"
              />
              <StatCard
                icon={<PhoneCall className="h-4 w-4 text-primary" />}
                label="Ligações atendidas"
                value={stats?.current.completedCalls || 0}
                previousValue={stats?.previous.completedCalls || 0}
                color="bg-primary/10"
              />
              <StatCard
                icon={<Calendar className="h-4 w-4 text-primary" />}
                label="Total agendado"
                value={stats?.current.totalScheduled || 0}
                previousValue={stats?.previous.totalScheduled || 0}
                color="bg-primary/10"
                clickable
                onClick={() => setModalType('scheduled')}
              />
              <StatCard
                icon={<CalendarCheck className="h-4 w-4 text-primary" />}
                label="Total confirmado"
                value={stats?.current.totalConfirmed || 0}
                previousValue={stats?.previous.totalConfirmed || 0}
                color="bg-primary/10"
                clickable
                onClick={() => setModalType('confirmed')}
              />
              <StatCard
                icon={<ShieldCheck className="h-4 w-4 text-primary" />}
                label="SQO Aprovado"
                value={stats?.current.sqoApproved || 0}
                previousValue={stats?.previous.sqoApproved || 0}
                color="bg-primary/10"
                clickable
                onClick={() => setModalType('sqo')}
              />
            </div>
          </TooltipProvider>

          {/* Goal Progress Bars */}
          {goalProgress && (
            <div className="mt-3 p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Progresso das Metas (Mês)</span>
              </div>
              <div className="space-y-3">
                <GoalProgressBar
                  label="Agendamentos"
                  current={goalProgress.scheduled.current}
                  goal={goalProgress.scheduled.goal}
                />
                <GoalProgressBar
                  label="Reuniões Realizadas"
                  current={goalProgress.held.current}
                  goal={goalProgress.held.goal}
                />
                <GoalProgressBar
                  label="SQO (Oportunidades)"
                  current={goalProgress.sqo.current}
                  goal={goalProgress.sqo.goal}
                />
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Modal for Scheduled Meetings */}
      <Dialog open={modalType === 'scheduled'} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent className="max-w-4xl w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Reuniões Agendadas
              {(stats?.scheduledMeetings?.length ?? 0) > 0 && (
                <span className="bg-primary/10 text-primary text-xs font-semibold rounded-full px-2 py-0.5">
                  {stats!.scheduledMeetings.length}
                </span>
              )}
            </DialogTitle>
            {stats?.scheduledMeetings && stats.scheduledMeetings.length > 0 && (() => {
              const now = new Date();
              const todayStart = startOfDay(now);
              const todayEnd = new Date(todayStart.getTime() + 86400000);
              const todayCount = stats.scheduledMeetings.filter(m => {
                const d = new Date(m.meeting_datetime);
                return d >= todayStart && d < todayEnd;
              }).length;
              const pastCount = stats.scheduledMeetings.filter(m => new Date(m.meeting_datetime) < todayStart).length;
              return (
                <p className="text-xs text-muted-foreground">
                  {stats.scheduledMeetings.length} reuniões · {todayCount} hoje · {pastCount} passadas
                </p>
              );
            })()}
          </DialogHeader>
          <ScrollArea className="max-h-[600px]">
            <div className="space-y-2 pr-4">
              {stats?.scheduledMeetings && stats.scheduledMeetings.length > 0 ? (
                stats.scheduledMeetings.map((meeting) => {
                  const meetingDate = new Date(meeting.meeting_datetime);
                  const now = new Date();
                  const todayStart = startOfDay(now);
                  const todayEnd = new Date(todayStart.getTime() + 86400000);
                  const isPast = meetingDate < todayStart;
                  const isToday = meetingDate >= todayStart && meetingDate < todayEnd;
                  const companyName = meeting.leads?.razao_social || meeting.leads?.nome_fantasia || meeting.leads?.company || 'Empresa não informada';
                  const initials = companyName.replace(/[^a-zA-Z0-9À-ÿ ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
                  const sdrName = (meeting.sdr_profile as { name: string } | null)?.name;

                  return (
                    <button
                      key={meeting.id}
                      type="button"
                      onClick={() => (meeting.leads?.id || meeting.lead_id) && handleOpenLead(meeting.leads?.id || meeting.lead_id)}
                      className={cn(
                        "w-full text-left py-4 px-4 rounded-xl border transition-all duration-150 cursor-pointer group outline-none focus-visible:ring-0",
                        "border-l-[3px]",
                        isPast && "border-l-muted-foreground/30 opacity-50 border-border/50",
                        isToday && "border-l-primary bg-primary/[0.03] border-primary/20",
                        !isPast && !isToday && "border-l-[hsl(var(--chart-3))] border-border hover:border-border",
                        "hover:bg-accent/40 hover:shadow-sm",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-primary">{initials}</span>
                        </div>

                        {/* Left column: Company, Contact, Phone */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="font-semibold text-sm text-foreground capitalize truncate group-hover:text-primary transition-colors">
                            {companyName.toLowerCase()}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="capitalize truncate">{meeting.leads?.name || 'Contato não informado'}</span>
                          </div>
                          {(meeting.leads?.phone || meeting.leads?.phone_2) && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="font-mono">{[meeting.leads?.phone, meeting.leads?.phone_2].filter(Boolean).join(' / ')}</span>
                            </div>
                          )}
                        </div>

                        {/* Right column: Date, Roles */}
                        <div className="flex flex-col items-end gap-2 shrink-0 text-right">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                            <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{format(meetingDate, "dd/MM", { locale: ptBR })}</span>
                            <span className="text-muted-foreground">•</span>
                            <span>{format(meetingDate, "HH:mm")}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            {sdrName && (
                              <>
                                <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70">SDR</span>
                                <span className="font-medium text-foreground">{sdrName}</span>
                                <span className="mx-0.5">•</span>
                              </>
                            )}
                            <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70">Closer</span>
                            <span className="font-medium text-foreground">{meeting.executive_name}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma reunião agendada neste período</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Modal for Confirmed Leads */}
      <Dialog open={modalType === 'confirmed'} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent className="max-w-4xl w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Oportunidades Realizadas
              {(stats?.confirmedLeads?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{stats!.confirmedLeads.length}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[600px]">
            <div className="space-y-2 pr-4">
              {stats?.confirmedLeads && stats.confirmedLeads.length > 0 ? (
                stats.confirmedLeads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => handleOpenLead(lead.id)}
                    className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all duration-200 cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {lead.company}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <User className="h-3.5 w-3.5 shrink-0" />
                            <span>{lead.name}</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>{format(new Date(lead.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {lead.sdr_name && (
                          <Badge variant="outline" className="text-[10px]">
                            {lead.sdr_name}
                          </Badge>
                        )}
                        <Badge className="bg-primary/10 text-primary border-0 text-[10px]">
                          Oportunidade
                        </Badge>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarCheck className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma oportunidade realizada neste período</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Modal for SQO Approved Leads */}
      <Dialog open={modalType === 'sqo'} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent className="max-w-4xl w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              SQO Aprovados
              {(stats?.sqoApprovedLeads?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{stats!.sqoApprovedLeads.length}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[600px]">
            <div className="space-y-2 pr-4">
              {stats?.sqoApprovedLeads && stats.sqoApprovedLeads.length > 0 ? (
                stats.sqoApprovedLeads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => handleOpenLead(lead.id)}
                    className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all duration-200 cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {lead.company}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <User className="h-3.5 w-3.5 shrink-0" />
                            <span>{lead.name}</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>{format(new Date(lead.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {lead.sdr_name && (
                          <Badge variant="outline" className="text-[10px]">
                            {lead.sdr_name}
                          </Badge>
                        )}
                        <Badge className="bg-success/10 text-success border-0 text-[10px]">
                          SQO ✅
                        </Badge>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhum SQO aprovado neste período</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
