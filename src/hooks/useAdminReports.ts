import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export interface LeadsByStatus {
  status: string;
  count: number;
}

export interface LeadsByUser {
  user_id: string;
  user_name: string;
  total: number;
  converted: number;
  discarded: number;
}

export interface LeadsOverTime {
  date: string;
  count: number;
}

export interface DashboardMetrics {
  totalLeads: number;
  newLeadsThisMonth: number;
  convertedThisMonth: number;
  conversionRate: number;
  overdueLeads: number;
  averageResponseTime: number;
}

interface UseAdminReportsOptions {
  selectedSdrId?: string;
  dateRange?: { start: string; end: string };
}

export const useAdminReports = (options?: UseAdminReportsOptions) => {
  const { selectedSdrId, dateRange } = options || {};

  // Dashboard summary metrics — parallelized
  const { data: metrics, isLoading: isLoadingMetrics, error: metricsError } = useQuery({
    queryKey: ['adminMetrics', selectedSdrId, dateRange?.start, dateRange?.end],
    staleTime: 30_000,
    queryFn: async () => {
      const now = new Date();
      const rangeStart = dateRange?.start || startOfMonth(now).toISOString();
      const rangeEnd = dateRange?.end || endOfMonth(now).toISOString();

      // Build queries
      let totalQuery = supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd);
      if (selectedSdrId) totalQuery = totalQuery.eq('owner_user_id', selectedSdrId);

      let overdueQuery = supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .lt('next_action_at', now.toISOString())
        .not('status', 'in', '("Descartado","Oportunidade criada")');
      if (selectedSdrId) overdueQuery = overdueQuery.eq('owner_user_id', selectedSdrId);

      const convertedLogsQuery = supabase
        .from('lead_activity_logs')
        .select('lead_id')
        .eq('action_type', 'status_changed')
        .eq('new_value', 'Oportunidade criada')
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd)
        .limit(5000);

      // Execute all 3 in parallel
      const [totalResult, overdueResult, convertedLogsResult] = await Promise.all([
        totalQuery,
        overdueQuery,
        convertedLogsQuery,
      ]);

      if (totalResult.error) throw totalResult.error;
      if (overdueResult.error) throw overdueResult.error;
      if (convertedLogsResult.error) throw convertedLogsResult.error;

      const totalLeads = totalResult.count || 0;
      const overdueLeads = overdueResult.count || 0;
      const convertedLogs = convertedLogsResult.data;

      let convertedThisMonth = 0;
      if (selectedSdrId && convertedLogs && convertedLogs.length > 0) {
        const leadIds = [...new Set(convertedLogs.map(l => l.lead_id))];
        const { count, error } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .in('id', leadIds)
          .eq('owner_user_id', selectedSdrId);
        if (error) throw error;
        convertedThisMonth = count || 0;
      } else {
        const uniqueLeads = new Set(convertedLogs?.map(l => l.lead_id) || []);
        convertedThisMonth = uniqueLeads.size;
      }

      const newLeadsThisMonth = totalLeads;
      const conversionRate = newLeadsThisMonth > 0
        ? ((convertedThisMonth) / newLeadsThisMonth) * 100
        : 0;

      return {
        totalLeads,
        newLeadsThisMonth,
        convertedThisMonth,
        conversionRate: Math.round(conversionRate * 10) / 10,
        overdueLeads,
        averageResponseTime: 0,
      } as DashboardMetrics;
    },
  });

  // Leads by status — with proper limit
  const { data: leadsByStatus = [], isLoading: isLoadingByStatus } = useQuery({
    queryKey: ['leadsByStatus'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('status')
        .limit(20000);

      if (error) throw error;

      const statusCounts: Record<string, number> = {};
      data?.forEach(lead => {
        statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
      });

      return Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
      })) as LeadsByStatus[];
    },
  });

  // Leads by user (SDR performance)
  const { data: leadsByUser = [], isLoading: isLoadingByUser } = useQuery({
    queryKey: ['leadsByUser'],
    staleTime: 30_000,
    queryFn: async () => {
      const [leadsResult, profilesResult] = await Promise.all([
        supabase.from('leads').select('owner_user_id, status').limit(20000),
        supabase.from('profiles').select('id, name'),
      ]);

      if (leadsResult.error) throw leadsResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const leads = leadsResult.data;
      const profiles = profilesResult.data;

      const userStats: Record<string, { total: number; converted: number; discarded: number; name: string }> = {};

      profiles?.forEach(profile => {
        userStats[profile.id] = {
          total: 0,
          converted: 0,
          discarded: 0,
          name: profile.name,
        };
      });

      leads?.forEach(lead => {
        const userId = lead.owner_user_id || 'unassigned';
        if (!userStats[userId]) {
          userStats[userId] = { total: 0, converted: 0, discarded: 0, name: 'Não atribuído' };
        }
        userStats[userId].total++;
        if (lead.status === 'Oportunidade criada') userStats[userId].converted++;
        if (lead.status === 'Descartado') userStats[userId].discarded++;
      });

      return Object.entries(userStats)
        .filter(([_, stats]) => stats.total > 0)
        .map(([user_id, stats]) => ({
          user_id,
          user_name: stats.name,
          total: stats.total,
          converted: stats.converted,
          discarded: stats.discarded,
        })) as LeadsByUser[];
    },
  });

  // Leads created over time (last 6 months) — parallelized
  const { data: leadsOverTime = [], isLoading: isLoadingOverTime } = useQuery({
    queryKey: ['leadsOverTime'],
    staleTime: 30_000,
    queryFn: async () => {
      const monthDates = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));

      const results = await Promise.all(
        monthDates.map(async (monthDate) => {
          const monthStart = startOfMonth(monthDate).toISOString();
          const monthEnd = endOfMonth(monthDate).toISOString();

          const { count } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', monthStart)
            .lte('created_at', monthEnd);

          return {
            date: format(monthDate, 'MMM'),
            count: count || 0,
          };
        })
      );

      return results;
    },
  });

  // Leads by type (INBOUND vs OUTBOUND) — with proper limit
  const { data: leadsByType = [], isLoading: isLoadingByType } = useQuery({
    queryKey: ['leadsByType'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('lead_type')
        .limit(20000);

      if (error) throw error;

      const typeCounts: Record<string, number> = {};
      data?.forEach(lead => {
        typeCounts[lead.lead_type] = (typeCounts[lead.lead_type] || 0) + 1;
      });

      return Object.entries(typeCounts).map(([type, count]) => ({
        type,
        count,
      }));
    },
  });

  return {
    metrics,
    isLoadingMetrics,
    error: metricsError,
    leadsByStatus,
    isLoadingByStatus,
    leadsByUser,
    isLoadingByUser,
    leadsOverTime,
    isLoadingOverTime,
    leadsByType,
    isLoadingByType,
  };
};
