import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PhaseDetailItem {
  id: string; // phase row id
  project_id: string;
  phase_name: string;
  status: string;
  assigned_user_id: string | null;
  sort_order: number;
  bm_data: Record<string, unknown> | null;
  is_active: boolean;
  project: {
    id: string;
    company_name: string;
    project_number: number;
    project_type: string;
    overall_status: string;
    priority: string;
    contact_name: string | null;
    created_at: string;
    current_phase: string | null;
    updated_at: string;
    due_date: string | null;
  } | null;
  assigned_user: {
    id: string;
    name: string;
  } | null;
}

export const usePhaseDetail = (phaseName: string | undefined, onlyMine: boolean, currentUserId?: string | null) => {
  return useQuery({
    queryKey: ['phase-detail', phaseName, onlyMine, currentUserId],
    queryFn: async () => {
      if (!phaseName) return [];

      let query = supabase
        .from('project_phases')
        .select(`
          id,
          project_id,
          phase_name,
          status,
          assigned_user_id,
          sort_order,
          bm_data,
          is_active,
          project:projects!project_phases_project_id_fkey (
            id,
            company_name,
            project_number,
            project_type,
            overall_status,
            priority,
            contact_name,
            created_at,
            current_phase,
            updated_at,
            due_date,
            deleted_at
          ),
          assigned_user:profiles!project_phases_assigned_user_id_fkey (
            id,
            name
          )
        `)
        .eq('phase_name', phaseName)
        .neq('status', 'CONCLUÍDO');

      if (onlyMine && currentUserId) {
        query = query.eq('assigned_user_id', currentUserId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter out phases where project is cancelled/completed, soft-deleted, or no longer active in this phase
      return (data || []).filter((item: unknown) => {
        const item_ = item as { project: { overall_status: string; deleted_at: string | null; current_phase: string | null } | null; status: string; is_active: boolean; phase_name: string };
        if (!item_.project) return false;
        if (item_.project.overall_status === 'cancelado' || item_.project.overall_status === 'concluido') return false;
        if (item_.project.deleted_at) return false;
        // Hide inactive phases that the project has already moved past
        if (!item_.is_active && item_.project.current_phase !== item_.phase_name) return false;
        // Hide inactive BACKLOG (phase not yet reached)
        if (item_.status === 'BACKLOG' && !item_.is_active) return false;
        return true;
      }) as PhaseDetailItem[];
    },
    enabled: !!phaseName && (!onlyMine || !!currentUserId),
    staleTime: 2 * 60_000, // 2 minutes
  });
};
