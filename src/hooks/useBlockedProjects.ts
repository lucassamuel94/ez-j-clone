import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PausedProject {
  id: string;
  name: string;
  client: string;
  reason: string | null;
  responsible: string;
  paused_since: string;
  aging_days: number;
  action: 'escalar' | 'follow_up' | 'monitorar';
}

export interface CancelledProject {
  id: string;
  name: string;
  client: string;
  reason: string | null;
  cancelled_at: string;
}

export interface ReasonSummary {
  reason: string;
  count: number;
  pct: number;
}

export interface History6mEntry {
  month: string;
  paused_count: number;
  cancelled_count: number;
}

export interface BlockedData {
  paused: PausedProject[];
  cancelled: CancelledProject[];
  paused_reasons_summary: ReasonSummary[];
  cancelled_reasons_summary: ReasonSummary[];
  history_6m: History6mEntry[];
}

async function fetchBlocked(period: string): Promise<BlockedData> {
  const { data, error } = await supabase.functions.invoke('dashboard-blocked', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period }),
  });
  if (error) throw error;
  return data as BlockedData;
}

export const useBlockedProjects = (period: string, enabled = true) => {
  return useQuery({
    queryKey: ['dashboard-blocked', period],
    queryFn: () => fetchBlocked(period),
    staleTime: 2 * 60_000,
    enabled,
  });
};
