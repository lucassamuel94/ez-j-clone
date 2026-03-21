import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const STALE_TIME = 5 * 60_000;

export function useMyResults(userId: string, role: string, month: number, year: number) {
  const startOfMonth = new Date(year, month - 1, 1).toISOString();
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

  const goalQuery = useQuery({
    queryKey: ['my-results-goal', userId, role, month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goals')
        .select('meetings_scheduled_goal')
        .eq('goal_type', role)
        .eq('period_month', month)
        .eq('period_year', year)
        .or(`target_user_id.eq.${userId},target_user_id.is.null`)
        .order('target_user_id', { ascending: false, nullsFirst: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!userId && !!role,
    staleTime: STALE_TIME,
  });

  const completedQuery = useQuery({
    queryKey: ['my-results-completed', userId, month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_phases')
        .select('id, project_id, phase_name, status, started_at, completed_at, projects!inner(id, company_name, project_type, project_number, due_date, complexity_level)')
        .eq('assigned_user_id', userId)
        .eq('status', 'CONCLUÍDO')
        .gte('completed_at', startOfMonth)
        .lte('completed_at', endOfMonth);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    staleTime: STALE_TIME,
  });

  const activeQuery = useQuery({
    queryKey: ['my-results-active', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_phases')
        .select('id, project_id, phase_name, status, started_at, projects!inner(id, company_name, project_type, project_number, due_date, complexity_level, overall_status)')
        .eq('assigned_user_id', userId)
        .neq('status', 'CONCLUÍDO')
        .neq('status', 'BACKLOG')
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    staleTime: STALE_TIME,
  });

  return {
    goal: goalQuery.data,
    completedPhases: completedQuery.data,
    activePhases: activeQuery.data,
    isLoading: goalQuery.isLoading || completedQuery.isLoading || activeQuery.isLoading,
  };
}
