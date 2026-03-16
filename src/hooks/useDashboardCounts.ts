import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DashboardCounts {
  newLeadsCount: number;
  activeOppsCount: number;
}

async function fetchDashboardCounts(): Promise<DashboardCounts> {
  const [leadsRes, oppsRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Novo'),
    supabase
      .from('opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('returned_to_sdr', false)
      .not('stage', 'in', '("Ganho","Perdido")'),
  ]);

  return {
    newLeadsCount: leadsRes.count ?? 0,
    activeOppsCount: oppsRes.count ?? 0,
  };
}

export const useDashboardCounts = () => {
  return useQuery({
    queryKey: ['dashboard-counts'],
    queryFn: fetchDashboardCounts,
    staleTime: 60_000,
  });
};
