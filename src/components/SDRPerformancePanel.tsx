import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, TrendingUp, Clock, Target, XCircle, Users, CalendarCheck, CalendarCheck2, Info } from 'lucide-react';
import { subDays, startOfMonth } from 'date-fns';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { SDRPerformanceDetailModal, MetricType } from './SDRPerformanceDetailModal';

interface SDRPerformancePanelProps {
  selectedSdrId?: string;
  dateRange?: { start: string; end: string; label: string };
}

export const SDRPerformancePanel = ({ selectedSdrId, dateRange }: SDRPerformancePanelProps) => {
  const [detailModal, setDetailModal] = useState<{ sdrId: string; sdrName: string; metric: MetricType } | null>(null);

  const now = new Date();
  const filterStart = dateRange?.start || startOfMonth(now).toISOString();
  const filterEnd = dateRange?.end || now.toISOString();
  const fiveDaysAgo = subDays(now, 5).toISOString();

  // Get SDR user IDs for filtering
  const { data: sdrUserIds = [] } = useQuery({
    queryKey: ['sdr-ids-perf'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('user_id').eq('role', 'sdr');
      return (data || []).map(r => r.user_id);
    },
    staleTime: 300000,
  });

  const isAll = !selectedSdrId || selectedSdrId === 'all';

  // Fetch leads owned by SDR(s) that are active
  const { data: metrics } = useQuery({
    queryKey: ['sdr-perf-metrics', selectedSdrId, sdrUserIds, filterStart, filterEnd],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { totalLeads: 0, stalledLeads: 0, lostWithoutAttempt: 0, promotedSQO: 0 };

      // Build base filter
      const buildQuery = (select: string) => {
        let q = supabase.from('leads').select(select);
        if (!isAll) {
          q = q.eq('owner_user_id', selectedSdrId);
        } else if (sdrUserIds.length > 0) {
          q = q.in('owner_user_id', sdrUserIds);
        }
        return q;
      };

      // Total active leads (not Descartado, not Oportunidade criada)
      const { data: activeLeads } = await buildQuery('id, updated_at, attempts_count, status')
        .not('status', 'in', '("Descartado","Oportunidade criada")');

      const active = activeLeads || [];
      const totalLeads = active.length;

      // Stalled: active leads not updated in 5+ days
      const stalledLeads = active.filter((l: any) => l.updated_at && l.updated_at < fiveDaysAgo).length;

      // Lost without minimum attempts (Descartado with attempts_count < 3)
      let lostQ = supabase.from('leads').select('id', { count: 'exact', head: true })
        .eq('status', 'Descartado')
        .lt('attempts_count', 3)
        .gte('updated_at', filterStart)
        .lte('updated_at', filterEnd);
      if (!isAll) {
        lostQ = lostQ.eq('owner_user_id', selectedSdrId!);
      } else if (sdrUserIds.length > 0) {
        lostQ = lostQ.in('owner_user_id', sdrUserIds);
      }
      const { count: lostCount } = await lostQ;

      const lostWithoutAttempt = lostCount || 0;

      // Promoted to SQO in period (sqo_approved_at)
      const { data: sqoLeads } = await buildQuery('id')
        .not('sqo_approved_at', 'is', null)
        .gte('sqo_approved_at', filterStart)
        .lte('sqo_approved_at', filterEnd);

      const promotedSQO = sqoLeads?.length || 0;

      // Meetings scheduled in selected period
      let meetingsQuery = supabase.from('meetings').select('id')
        .gte('created_at', filterStart)
        .lte('created_at', filterEnd);
      if (!isAll) {
        meetingsQuery = meetingsQuery.eq('user_id', selectedSdrId);
      } else if (sdrUserIds.length > 0) {
        meetingsQuery = meetingsQuery.in('user_id', sdrUserIds);
      }
      const { data: monthMeetings } = await meetingsQuery;
      const meetingsCount = monthMeetings?.length || 0;

      // SQO count for rate uses same period (sqo_approved_at)
      const { data: sqoMonthLeads } = await buildQuery('id')
        .not('sqo_approved_at', 'is', null)
        .gte('sqo_approved_at', filterStart)
        .lte('sqo_approved_at', filterEnd);
      const sqoForRate = sqoMonthLeads?.length || 0;

      return { totalLeads, stalledLeads, lostWithoutAttempt, promotedSQO, meetingsCount, sqoForRate };
    },
    enabled: sdrUserIds.length > 0 || !isAll,
    refetchInterval: 60000,
  });

  // Get only SDR-role user IDs for the breakdown (exclude admin/manager)
  const { data: sdrOnlyIds = [] } = useQuery({
    queryKey: ['sdr-only-ids-breakdown'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('user_id').eq('role', 'sdr');
      return (data || []).map(r => r.user_id);
    },
    staleTime: 300000,
  });

  // Fetch per-SDR breakdown when viewing all
  const { data: perSdrBreakdown = [] } = useQuery({
    queryKey: ['sdr-perf-breakdown', sdrOnlyIds, filterStart, filterEnd],
    queryFn: async () => {
      if (sdrOnlyIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('active', true)
        .in('id', sdrOnlyIds);

      if (!profiles || profiles.length === 0) return [];

      // Get all active leads for all SDRs
      const { data: allLeads } = await supabase
        .from('leads')
        .select('id, owner_user_id, updated_at, attempts_count, status')
        .in('owner_user_id', sdrOnlyIds)
        .not('status', 'in', '("Descartado","Oportunidade criada")');

      // Get SQO in period (using sqo_approved_at)
      const { data: sqoLeads } = await supabase
        .from('leads')
        .select('id, owner_user_id')
        .in('owner_user_id', sdrOnlyIds)
        .not('sqo_approved_at', 'is', null)
        .gte('sqo_approved_at', filterStart)
        .lte('sqo_approved_at', filterEnd);

      // Get meetings scheduled in period
      const { data: scheduledMeetings } = await supabase
        .from('meetings')
        .select('id, user_id, lead_id')
        .in('user_id', sdrOnlyIds)
        .gte('created_at', filterStart)
        .lte('created_at', filterEnd);

      // Get confirmed (SDR clicked "Reunião Confirmada") in period via activity logs
      const { data: confirmedLogs } = await supabase
        .from('lead_activity_logs')
        .select('id, lead_id, user_id')
        .eq('action_type', 'opportunity_created')
        .ilike('description', '%confirmou presença%')
        .gte('created_at', filterStart)
        .lte('created_at', filterEnd)
        .in('user_id', sdrOnlyIds);

      return profiles.map(p => {
        const myLeads = (allLeads || []).filter(l => l.owner_user_id === p.id);
        const stalled = myLeads.filter(l => l.updated_at && l.updated_at < fiveDaysAgo).length;
        const sqo = (sqoLeads || []).filter(l => l.owner_user_id === p.id).length;
        const myMeetings = (scheduledMeetings || []).filter(m => m.user_id === p.id);
        const uniqueMeetingLeads = new Set(myMeetings.map(m => m.lead_id));
        const agendados = uniqueMeetingLeads.size;
        const confirmedLeadIds = new Set((confirmedLogs || []).filter(l => l.user_id === p.id).map(l => l.lead_id));
        const confirmados = confirmedLeadIds.size;
        return { id: p.id, name: p.name, totalLeads: myLeads.length, stalledLeads: stalled, sqo, agendados, confirmados };
      }).sort((a, b) => b.agendados - a.agendados);
    },
    enabled: isAll && sdrOnlyIds.length > 0,
    refetchInterval: 120000,
  });

  const totals = metrics || { totalLeads: 0, stalledLeads: 0, lostWithoutAttempt: 0, promotedSQO: 0, meetingsCount: 0, sqoForRate: 0 };
  const sqoRate = totals.meetingsCount > 0 ? Math.round((totals.sqoForRate / totals.meetingsCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Metrics Cards */}
      <TooltipProvider delayDuration={300}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 mb-1 cursor-help">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">% SQO</span>
                    <Info className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">SQOs aprovados (5 critérios) no período ÷ Reuniões agendadas × 100</p>
                </TooltipContent>
              </Tooltip>
              <p className="text-2xl font-bold text-foreground">{sqoRate}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 mb-1 cursor-help">
                    <Clock className="h-4 w-4 text-[hsl(var(--chart-2))]" />
                    <span className="text-xs text-muted-foreground">Parados (5d+)</span>
                    <Info className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Leads ativos sem atualização há mais de 5 dias</p>
                </TooltipContent>
              </Tooltip>
              <p className={cn("text-2xl font-bold", totals.stalledLeads > 0 ? 'text-[hsl(var(--chart-2))]' : 'text-foreground')}>
                {totals.stalledLeads}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 mb-1 cursor-help">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-xs text-muted-foreground">Perdidos s/ tentativa</span>
                    <Info className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Leads descartados com menos de 3 tentativas no período</p>
                </TooltipContent>
              </Tooltip>
              <p className={cn("text-2xl font-bold", totals.lostWithoutAttempt > 0 ? 'text-destructive' : 'text-foreground')}>
                {totals.lostWithoutAttempt}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 mb-1 cursor-help">
                    <TrendingUp className="h-4 w-4 text-[hsl(var(--chart-3))]" />
                    <span className="text-xs text-muted-foreground">Promovidos SQO</span>
                    <Info className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Leads aprovados como SQO (5 critérios) no período</p>
                </TooltipContent>
              </Tooltip>
              <p className="text-2xl font-bold text-foreground">{totals.promotedSQO}</p>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>

      {/* Per-SDR breakdown */}
      {isAll && perSdrBreakdown.length > 1 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Performance por SDR</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">SDR</th>
                     <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">Agendados (SQL)</th>
                     <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">Reuniões confirmadas</th>
                     <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">SQO</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {perSdrBreakdown.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-foreground">{s.name}</td>
                      <td className="text-center px-3 py-2.5">
                        <button onClick={() => setDetailModal({ sdrId: s.id, sdrName: s.name, metric: 'agendados' })} className="text-primary font-semibold hover:underline cursor-pointer">{s.agendados}</button>
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <button onClick={() => setDetailModal({ sdrId: s.id, sdrName: s.name, metric: 'confirmados' })} className="text-[hsl(var(--chart-3))] font-semibold hover:underline cursor-pointer">{s.confirmados}</button>
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <button onClick={() => setDetailModal({ sdrId: s.id, sdrName: s.name, metric: 'sqo' })} className="text-[hsl(var(--chart-3))] font-semibold hover:underline cursor-pointer">{s.sqo}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {detailModal && (
        <SDRPerformanceDetailModal
          open={!!detailModal}
          onOpenChange={(open) => !open && setDetailModal(null)}
          sdrId={detailModal.sdrId}
          sdrName={detailModal.sdrName}
          metricType={detailModal.metric}
          filterStart={filterStart}
        />
      )}
    </div>
  );
};