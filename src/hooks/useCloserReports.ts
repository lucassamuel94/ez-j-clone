import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CloserMetrics {
  totalOpportunities: number;
  won: number;
  revenue: number;
  lost: number;
  conversionRate: number;
  avgTicket: number;
  avgCycleDays: number;
  activePipelineValue: number;
}

export interface CloserBreakdownRow {
  id: string;
  name: string;
  opportunities: number;
  won: number;
  lost: number;
  revenue: number;
  pendingContractsValue: number;
  rate: number;
  avgCycleDays: number;
}

export interface StageDistribution {
  stage: string;
  count: number;
}

export interface LostReasonDistribution {
  reason: string;
  count: number;
}

interface UseCloserReportsOptions {
  closerId?: string;
  dateRange?: { start: string; end: string };
}

export const useCloserReportMetrics = (options?: UseCloserReportsOptions) => {
  const { closerId, dateRange } = options || {};

  return useQuery({
    queryKey: ['closer-report-metrics', closerId, dateRange?.start, dateRange?.end],
    staleTime: 30_000,
    queryFn: async (): Promise<CloserMetrics> => {
      const now = new Date();
      const rangeStart = dateRange?.start || now.toISOString();
      const rangeEnd = dateRange?.end || now.toISOString();

      const { data, error } = await supabase.rpc('get_closer_report_metrics' as any, {
        p_closer_id: closerId || null,
        p_range_start: rangeStart,
        p_range_end: rangeEnd,
      });

      if (error) throw error;

      const d = data as any;
      return {
        totalOpportunities: Number(d.total_opportunities) || 0,
        won: Number(d.won) || 0,
        revenue: Number(d.revenue) || 0,
        lost: Number(d.lost) || 0,
        conversionRate: Number(d.conversion_rate) || 0,
        avgTicket: Number(d.avg_ticket) || 0,
        avgCycleDays: Number(d.avg_cycle_days) || 0,
        activePipelineValue: Number(d.active_pipeline_value) || 0,
      };
    },
  });
};

export const useCloserPerformanceBreakdown = (dateRange?: { start: string; end: string }) => {
  return useQuery({
    queryKey: ['closer-perf-breakdown', dateRange?.start, dateRange?.end],
    staleTime: 30_000,
    queryFn: async (): Promise<CloserBreakdownRow[]> => {
      const rangeStart = dateRange?.start || null;
      const rangeEnd = dateRange?.end || null;

      const { data, error } = await supabase.rpc('get_closer_performance_breakdown' as any, {
        p_range_start: rangeStart,
        p_range_end: rangeEnd,
      });

      if (error) throw error;

      const rows = (data || []).map((row: any) => ({
        id: row.closer_id,
        name: row.closer_name,
        opportunities: Number(row.opportunities),
        won: Number(row.won),
        lost: Number(row.lost),
        revenue: 0, // will be overridden with proposals data
        pendingContractsValue: 0, // will be calculated below
        rate: Number(row.rate),
        avgCycleDays: Number(row.avg_cycle_days) || 0,
      }));

      // Fix revenue: sum setup_total from proposals linked to won opportunities per closer
      const closerIds = rows.map((r: CloserBreakdownRow) => r.id).filter(Boolean);
      if (closerIds.length === 0) return rows;

      // Get won opportunities for all closers in range (include deal_value as fallback)
      let wonQ = supabase.from('opportunities')
        .select('id, assigned_to_user_id, deal_value')
        .eq('returned_to_sdr', false)
        .eq('stage', 'Ganho')
        .in('assigned_to_user_id', closerIds);
      if (rangeStart) wonQ = wonQ.gte('won_at', rangeStart);
      if (rangeEnd) wonQ = wonQ.lte('won_at', rangeEnd);
      const { data: wonOpps } = await wonQ.limit(5000);

      if (!wonOpps || wonOpps.length === 0) return rows;

      const oppIds = wonOpps.map(o => o.id);
      const oppToCloser: Record<string, string> = {};
      const oppDealValue: Record<string, number> = {};
      wonOpps.forEach(o => {
        oppToCloser[o.id] = o.assigned_to_user_id || '';
        oppDealValue[o.id] = Number(o.deal_value || 0);
      });

      // Get proposals setup_total for these won opportunities
      const { data: proposals } = await supabase
        .from('proposals')
        .select('opportunity_id, setup_total')
        .in('opportunity_id', oppIds.slice(0, 500))
        .limit(5000);

      // Build set of opp IDs that have proposals
      const oppsWithProposal = new Set<string>();
      const revenueByCloser: Record<string, number> = {};
      (proposals || []).forEach(p => {
        const cId = oppToCloser[p.opportunity_id || ''];
        if (cId) {
          oppsWithProposal.add(p.opportunity_id || '');
          revenueByCloser[cId] = (revenueByCloser[cId] || 0) + Number(p.setup_total || 0);
        }
      });

      // Fallback: for won opps without proposals, use deal_value
      wonOpps.forEach(o => {
        if (!oppsWithProposal.has(o.id) && oppDealValue[o.id] > 0) {
          const cId = oppToCloser[o.id];
          if (cId) revenueByCloser[cId] = (revenueByCloser[cId] || 0) + oppDealValue[o.id];
        }
      });

      // Fetch pending contracts (Contrato enviado + Aguardando pagamento) per closer
      const pendingStages = ['Contrato enviado', 'Aguardando pagamento'];
      let pendingQ = supabase.from('opportunities')
        .select('assigned_to_user_id, deal_value')
        .eq('returned_to_sdr', false)
        .in('stage', pendingStages)
        .in('assigned_to_user_id', closerIds);
      if (rangeStart) pendingQ = pendingQ.gte('created_at', rangeStart);
      if (rangeEnd) pendingQ = pendingQ.lte('created_at', rangeEnd);
      const { data: pendingOpps } = await pendingQ.limit(5000);

      const pendingByCloser: Record<string, number> = {};
      (pendingOpps || []).forEach(o => {
        const cId = o.assigned_to_user_id || '';
        pendingByCloser[cId] = (pendingByCloser[cId] || 0) + Number(o.deal_value || 0);
      });

      return rows.map((r: CloserBreakdownRow) => ({
        ...r,
        revenue: revenueByCloser[r.id] || 0,
        pendingContractsValue: pendingByCloser[r.id] || 0,
      }));
    },
  });
};

export const useCloserStageDistribution = (closerId?: string, dateRange?: { start: string; end: string }) => {
  return useQuery({
    queryKey: ['closer-stage-dist', closerId, dateRange?.start, dateRange?.end],
    staleTime: 30_000,
    queryFn: async (): Promise<StageDistribution[]> => {
      let q = supabase.from('opportunities').select('stage').eq('returned_to_sdr', false).limit(20000);
      if (closerId) q = q.eq('assigned_to_user_id', closerId);
      if (dateRange) {
        q = q.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
      }
      const { data, error } = await q;
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach(o => { counts[o.stage] = (counts[o.stage] || 0) + 1; });
      return Object.entries(counts).map(([stage, count]) => ({ stage, count }));
    },
  });
};

export const useCloserLostReasons = (closerId?: string, dateRange?: { start: string; end: string }) => {
  return useQuery({
    queryKey: ['closer-lost-reasons', closerId, dateRange?.start, dateRange?.end],
    staleTime: 30_000,
    queryFn: async (): Promise<LostReasonDistribution[]> => {
      let q = supabase.from('opportunities').select('lost_reason')
        .eq('returned_to_sdr', false)
        .eq('stage', 'Perdido')
        .not('lost_reason', 'is', null)
        .limit(20000);
      if (closerId) q = q.eq('assigned_to_user_id', closerId);
      if (dateRange) {
        q = q.gte('updated_at', dateRange.start).lte('updated_at', dateRange.end);
      }
      const { data, error } = await q;
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach(o => { counts[o.lost_reason!] = (counts[o.lost_reason!] || 0) + 1; });
      return Object.entries(counts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);
    },
  });
};

// ── Activity Metrics ──────────────────────────────────────────────────

export interface CloserActivityMetrics {
  opportunitiesWorked: number;
  totalActivities: number;
  activitiesByType: Record<string, number>;
  meetingsHeld: number;
  proposalsSent: number;
  proposalsNew: number;
  proposalsEvolution: number;
}

interface ActivityOptions {
  closerId?: string;
  dateRange?: { start: string; end: string };
}

export const useCloserActivityMetrics = (options?: ActivityOptions) => {
  const { closerId, dateRange } = options || {};

  const result = useQuery({
    queryKey: ['closer-activity-metrics-rpc', closerId, dateRange?.start, dateRange?.end],
    staleTime: 30_000,
    queryFn: async (): Promise<CloserActivityMetrics> => {
      const { data, error } = await supabase.rpc('get_closer_activity_metrics' as any, {
        p_closer_id: closerId || null,
        p_range_start: dateRange?.start || null,
        p_range_end: dateRange?.end || null,
      });

      if (error) throw error;

      const d = data as Record<string, unknown>;
      const byType = (d.activities_by_type || {}) as Record<string, number>;

      return {
        opportunitiesWorked: Number(d.opportunities_worked) || 0,
        totalActivities: Number(d.total_activities) || 0,
        activitiesByType: byType,
        meetingsHeld: Number(d.meetings_held) || 0,
        proposalsSent: Number(d.proposals_total) || 0,
        proposalsNew: Number(d.proposals_new) || 0,
        proposalsEvolution: Number(d.proposals_evolution) || 0,
      };
    },
  });

  return { data: result.data || {
    opportunitiesWorked: 0,
    totalActivities: 0,
    activitiesByType: {},
    meetingsHeld: 0,
    proposalsSent: 0,
    proposalsNew: 0,
    proposalsEvolution: 0,
  }, isLoading: result.isLoading };
};

// ── Per-Closer Activity Breakdown ─────────────────────────────────────

export interface CloserActivityBreakdownRow {
  id: string;
  name: string;
  opportunitiesWorked: number;
  activities: number;
  calls: number;
  emails: number;
  stageChanges: number;
  meetings: number;
  proposals: number;
}

export const useCloserActivityBreakdown = (dateRange?: { start: string; end: string }) => {
  return useQuery({
    queryKey: ['closer-activity-breakdown-rpc', dateRange?.start, dateRange?.end],
    staleTime: 30_000,
    queryFn: async (): Promise<CloserActivityBreakdownRow[]> => {
      const { data, error } = await supabase.rpc('get_closer_activity_breakdown' as any, {
        p_range_start: dateRange?.start || null,
        p_range_end: dateRange?.end || null,
      });

      if (error) throw error;

      return ((data as Record<string, unknown>[]) || []).map((row) => ({
        id: String(row.closer_id),
        name: String(row.closer_name),
        opportunitiesWorked: Number(row.opportunities_worked) || 0,
        activities: Number(row.activities) || 0,
        calls: Number(row.calls) || 0,
        emails: Number(row.emails) || 0,
        stageChanges: Number(row.stage_changes) || 0,
        meetings: Number(row.meetings) || 0,
        proposals: Number(row.proposals) || 0,
      }));
    },
  });
};
