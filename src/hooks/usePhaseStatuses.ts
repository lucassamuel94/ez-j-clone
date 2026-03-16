import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PHASE_STATUSES } from '@/types/project';

export interface PhaseStatus {
  id: string;
  phase_name: string;
  status_name: string;
  sort_order: number;
  is_system: boolean;
  color: string | null;
  created_at: string;
}

const QUERY_KEY = ['phase-statuses'];

export function usePhaseStatuses() {
  const queryClient = useQueryClient();

  const { data: allStatuses = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_phase_statuses' as any)
        .select('*')
        .order('phase_name')
        .order('sort_order');
      if (error) throw error;
      return (data || []) as unknown as PhaseStatus[];
    },
    staleTime: 5 * 60 * 1000,
  });

  /** Get status names for a phase, with fallback to hardcoded */
  function getStatusesForPhase(phaseName: string): string[] {
    const fromDb = allStatuses
      .filter((s) => s.phase_name === phaseName)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => s.status_name);
    if (fromDb.length > 0) return fromDb;
    return PHASE_STATUSES[phaseName] || [];
  }

  /** Get full status objects for a phase */
  function getStatusObjectsForPhase(phaseName: string): PhaseStatus[] {
    return allStatuses
      .filter((s) => s.phase_name === phaseName)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  const addStatus = useMutation({
    mutationFn: async (params: { phase_name: string; status_name: string; sort_order: number; color?: string }) => {
      const { error } = await supabase
        .from('project_phase_statuses' as any)
        .insert(params as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const updateStatus = useMutation({
    mutationFn: async (params: { id: string; status_name?: string; sort_order?: number; color?: string }) => {
      const { id, ...updates } = params;
      const { error } = await supabase
        .from('project_phase_statuses' as any)
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const deleteStatus = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_phase_statuses' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const reorderStatuses = useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      for (const item of items) {
        const { error } = await supabase
          .from('project_phase_statuses' as any)
          .update({ sort_order: item.sort_order } as any)
          .eq('id', item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    allStatuses,
    isLoading,
    getStatusesForPhase,
    getStatusObjectsForPhase,
    addStatus,
    updateStatus,
    deleteStatus,
    reorderStatuses,
  };
}
