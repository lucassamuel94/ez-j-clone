import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ALL_PHASES } from '@/types/project';

export interface PhaseCount {
  phase_name: string;
  count: number;
}

export const usePhaseProjectCounts = () => {
  return useQuery({
    queryKey: ['phase-project-counts'],
    queryFn: async () => {
      // Fetch phases with project overall_status to filter properly
      const { data, error } = await supabase
        .from('project_phases')
        .select('phase_name, project_id, is_active, status, project:projects!project_phases_project_id_fkey(overall_status, deleted_at)')
        .neq('status', 'CONCLUÍDO');

      if (error) throw error;

      // Group by phase_name, count distinct project_ids excluding cancelled/completed/delivered/deleted projects
      // Also exclude inactive BACKLOG phases (not yet reached)
      const countMap = new Map<string, Set<string>>();
      (data || []).forEach((row: any) => {
        const projectStatus = row.project?.overall_status;
        if (projectStatus === 'cancelado' || projectStatus === 'concluido' || projectStatus === 'entregue') return;
        if (row.project?.deleted_at) return;
        if (row.status === 'BACKLOG' && !row.is_active) return;
        if (!countMap.has(row.phase_name)) {
          countMap.set(row.phase_name, new Set());
        }
        countMap.get(row.phase_name)!.add(row.project_id);
      });

      const result: PhaseCount[] = ALL_PHASES.map(phase => ({
        phase_name: phase,
        count: countMap.get(phase)?.size || 0,
      }));

      return result;
    },
    staleTime: 5 * 60 * 1000, // 5min — sidebar counts don't need aggressive polling
    gcTime: 10 * 60 * 1000,
  });
};

export interface PhaseProject {
  id: string;
  project_id: string;
  phase_name: string;
  status: string;
  assigned_user_id: string | null;
  project: {
    id: string;
    company_name: string;
    project_number: number;
    overall_status: string;
  } | null;
  assigned_user: {
    name: string;
  } | null;
}

export const usePhaseProjects = (phaseName: string | null) => {
  return useQuery({
    queryKey: ['phaseProjects', phaseName],
    queryFn: async () => {
      if (!phaseName) return [];

      const { data, error } = await supabase
        .from('project_phases')
        .select(`
          id, project_id, phase_name, status, assigned_user_id,
          project:projects!project_phases_project_id_fkey(id, company_name, project_number, overall_status),
          assigned_user:profiles!project_phases_assigned_user_id_fkey(name)
        `)
        .eq('phase_name', phaseName)
        .neq('status', 'CONCLUÍDO')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as PhaseProject[];
    },
    enabled: !!phaseName,
  });
};
