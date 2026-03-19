import { useCallback, useMemo } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CloserOpportunity, CloserStage, mapRpcRowToOpportunity } from '@/services/closerService';

type SortOption = 'value_desc' | 'created_desc' | 'next_action_asc' | 'temperature_desc' | 'last_contact_asc';

interface UseCloserKanbanByStageParams {
  closerId: string | null;
  search: string;
  sortBy: SortOption;
  opportunityType: string;
  /** Ordered list of all possible stages (from useCloserStages / useEvolutionStages) */
  orderedStages: string[];
  /** Only query stages present in this set */
  visibleStages: Set<string>;
  enabled: boolean;
  /** Pages loaded per column — controlled externally */
  columnPages: Record<string, number>;
  meetingFrom?: string | null;
  meetingTo?:   string | null;
  wonFrom?:     string | null;
  wonTo?:       string | null;
}

const PAGE_SIZE = 15;

export function useCloserKanbanByStage({
  closerId,
  search,
  sortBy,
  opportunityType,
  orderedStages,
  visibleStages,
  enabled,
  columnPages,
  meetingFrom = null,
  meetingTo = null,
  wonFrom = null,
  wonTo = null,
}: UseCloserKanbanByStageParams) {
  const queryClient = useQueryClient();

  const stages = useMemo(
    () => orderedStages.filter((s) => visibleStages.has(s)),
    [orderedStages, visibleStages]
  );

  const queries = useQueries({
    queries: stages.map((stage) => {
      const pages = columnPages[stage] ?? 1;
      return {
        queryKey: ['closer-kanban', stage, closerId, search, sortBy, opportunityType, pages,
                   meetingFrom, meetingTo, wonFrom, wonTo],
        queryFn: async () => {
          const { data: result, error } = await (supabase.rpc as any)('search_opportunities_kanban', {
            p_stage: stage,
            p_closer_id: closerId || null,
            p_search: search || '',
            p_opportunity_type: opportunityType || 'new_business',
            p_page: 1,
            p_page_size: pages * PAGE_SIZE,
            p_sort: sortBy || 'created_desc',
            p_meeting_from: meetingFrom || null,
            p_meeting_to:   meetingTo   || null,
            p_won_from:     wonFrom     || null,
            p_won_to:       wonTo       || null,
          });
          if (error) throw error;
          const parsed = result as any;
          return {
            total: parsed.total as number,
            data: (parsed.data || []).map(mapRpcRowToOpportunity),
          };
        },
        enabled: enabled && !!stage,
        staleTime: 60_000,
        placeholderData: (prev: { total: number; data: CloserOpportunity[] } | undefined) => prev,
      };
    }),
  });

  const columns = useMemo(
    () =>
      stages.map((stage, i) => ({
        id: stage,
        stage: stage as CloserStage,
        items: queries[i]?.data?.data ?? [],
        total: queries[i]?.data?.total ?? 0,
      })),
    [stages, queries]
  );

  const isLoading = queries.some((q) => q.isLoading && !q.data);

  /** Optimistically move an opportunity between stage columns in the cache */
  const optimisticMove = useCallback(
    (oppId: string, fromStage: string, toStage: string, updatedOpp: CloserOpportunity) => {
      for (const stage of [fromStage, toStage]) {
        queryClient.setQueriesData<{ total: number; data: CloserOpportunity[] }>(
          { queryKey: ['closer-kanban', stage], exact: false },
          (prev) => {
            if (!prev) return prev;
            if (stage === fromStage) {
              return {
                total: Math.max(0, prev.total - 1),
                data: prev.data.filter((o) => o.id !== oppId),
              };
            }
            return {
              total: prev.total + 1,
              data: [updatedOpp, ...prev.data.filter((o) => o.id !== oppId)],
            };
          }
        );
      }
    },
    [queryClient]
  );

  const invalidateColumns = useCallback(
    (stagesToInvalidate: string[]) => {
      for (const stage of stagesToInvalidate) {
        queryClient.invalidateQueries({ queryKey: ['closer-kanban', stage] });
      }
    },
    [queryClient]
  );

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['closer-kanban'] });
  }, [queryClient]);

  return { columns, isLoading, optimisticMove, invalidateColumns, invalidateAll };
}
