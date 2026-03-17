import { useQuery } from '@tanstack/react-query';

export interface ApiFunnel {
  requested: number;
  verified: number;
  pending: number;
  active: number;
  conversion_rate: number;
}

export interface BlockedReason {
  reason: string;
  count: number;
  pct: number;
}

export interface AwaitingItem {
  id: string;
  project_name: string;
  client: string;
  verified_at: string;
  waiting_days: number;
  blocked_reason: string | null;
}

export interface HistoryMonth {
  month: string;
  avg_days: number;
}

export interface ApiActivationsData {
  funnel: ApiFunnel;
  avg_days_to_activate: number;
  blocked_reasons: BlockedReason[];
  awaiting: AwaitingItem[];
  history_6m: HistoryMonth[];
}

async function fetchApiActivations(period: string): Promise<ApiActivationsData> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const resp = await fetch(
    `https://${projectId}.supabase.co/functions/v1/dashboard-api-activations?period=${period}`,
    {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!resp.ok) throw new Error('Erro ao buscar dados de ativação');
  return resp.json();
}

export function useApiActivations(period: string, enabled = true) {
  return useQuery({
    queryKey: ['api-activations', period],
    queryFn: () => fetchApiActivations(period),
    staleTime: 60_000,
    enabled,
  });
}
