import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TeamMetrics {
  id: string;
  name: string;
  allocated_hours: number;
  capacity_hours: number;
  headcount: number;
  utilization_pct: number;
  wip_per_person: number;
  sla_rate: number;
  rework_rate: number;
  status: 'ok' | 'warning' | 'critical';
  main_bottleneck: string;
  active_projects: number;
}

export interface TeamsSummary {
  total_wip: number;
  avg_utilization: number;
  avg_sla: number;
  free_hours_total: number;
}

export interface TeamsData {
  summary: TeamsSummary;
  teams: TeamMetrics[];
}

async function fetchTeams(period: string): Promise<TeamsData> {
  const { data, error } = await supabase.functions.invoke('dashboard-teams', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period }),
  });
  if (error) throw error;
  return data as TeamsData;
}

export const useTeamCapacity = (period: string, enabled = true) => {
  return useQuery({
    queryKey: ['dashboard-teams', period],
    queryFn: () => fetchTeams(period),
    staleTime: 2 * 60_000,
    enabled,
  });
};
