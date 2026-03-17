import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WorkloadSummary {
  total_capacity_hours: number;
  total_allocated_hours: number;
  total_free_hours: number;
  avg_utilization_pct: number;
}

export interface TeamWeekEntry {
  week: string;
  start_date: string;
  end_date: string;
  active_projects: number;
  allocated_hours: number;
  capacity_hours: number;
  utilization_pct: number;
}

export interface WeeklyFlowEntry {
  week: string;
  start_date: string | null;
  end_date: string | null;
  new_projects: number;
  delivered: number;
  balance: number;
  wip_end: number;
  is_projection: boolean;
}

export interface WorkloadAlert {
  team: string;
  week: string;
  utilization_pct: number;
  message: string;
}

export interface WorkloadData {
  summary: WorkloadSummary;
  teams_weekly: Record<string, TeamWeekEntry[]>;
  weekly_flow: WeeklyFlowEntry[];
  alerts: WorkloadAlert[];
}

function periodToMonth(period: string): string {
  const now = new Date();
  if (period === 'month') {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  // For week/quarter, still default to current month
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function fetchWorkload(period: string): Promise<WorkloadData> {
  const month = periodToMonth(period);
  const { data, error } = await supabase.functions.invoke(`dashboard-workload?month=${month}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (error) throw error;
  return data as WorkloadData;
}

export const useWorkload = (period: string, enabled = true) => {
  return useQuery({
    queryKey: ['dashboard-workload', period],
    queryFn: () => fetchWorkload(period),
    staleTime: 2 * 60_000,
    enabled,
  });
};
