import { useCallback, useMemo } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { fetchLeadsByStatus } from '@/services/leadService';
import { Lead, LeadStatus } from '@/types/lead';
import type { SDRSortOption } from '@/components/sdr/SDRKanbanView';
import { useSDRStages } from '@/hooks/useSDRStages';

interface UseKanbanLeadsByStatusParams {
  sdrId: string;
  search: string;
  sortBy: SDRSortOption;
  visibleStatuses: Set<string>;
  enabled: boolean;
  /** Pages loaded per column — controlled externally by useInfiniteColumnScroll */
  columnPages: Record<string, number>;
}

const PAGE_SIZE = 15;

export function useKanbanLeadsByStatus({
  sdrId,
  search,
  sortBy,
  visibleStatuses,
  enabled,
  columnPages,
}: UseKanbanLeadsByStatusParams) {
  const queryClient = useQueryClient();
  const { kanbanStatuses: allKanbanStatuses } = useSDRStages();

  const statuses = useMemo(
    () => allKanbanStatuses.filter((s) => visibleStatuses.has(s)),
    [visibleStatuses, allKanbanStatuses]
  );

  const sdrIdParam = useMemo(() => {
    if (sdrId === 'all' || !sdrId || sdrId === 'pending') return null;
    if (sdrId === 'unassigned') return '00000000-0000-0000-0000-000000000000';
    return sdrId;
  }, [sdrId]);

  const queries = useQueries({
    queries: statuses.map((status) => {
      const pages = columnPages[status] ?? 1;
      return {
        queryKey: ['kanban-leads', status, sdrIdParam, search, sortBy, pages],
        queryFn: () => fetchLeadsByStatus({
          status,
          sdrId: sdrIdParam,
          search,
          sort: sortBy,
          page: 1,
          pageSize: pages * PAGE_SIZE,
        }),
        enabled: enabled && sdrId !== 'pending',
        staleTime: 60_000,
        placeholderData: (prev: { leads: Lead[]; total: number } | undefined) => prev,
      };
    }),
  });

  const columns = useMemo(() => {
    return statuses.map((status, i) => ({
      id: status,
      status,
      items: queries[i]?.data?.leads ?? [],
      total: queries[i]?.data?.total ?? 0,
    }));
  }, [statuses, queries]);

  const allLeads = useMemo(() => {
    return columns.flatMap((c) => c.items);
  }, [columns]);

  const isLoading = queries.some((q) => q.isLoading && !q.data);

  /** Optimistically move a lead between columns in the cache */
  const optimisticMove = useCallback(
    (leadId: string, fromStatus: string, toStatus: string, updatedLead: Lead) => {
      // Update source column cache
      for (const status of [fromStatus, toStatus]) {
        queryClient.setQueriesData<{ leads: Lead[]; total: number }>(
          { queryKey: ['kanban-leads', status], exact: false },
          (prev) => {
            if (!prev) return prev;
            if (status === fromStatus) {
              return {
                total: Math.max(0, prev.total - 1),
                leads: prev.leads.filter((l) => l.id !== leadId),
              };
            }
            // toStatus — add lead at top
            return {
              total: prev.total + 1,
              leads: [updatedLead, ...prev.leads.filter((l) => l.id !== leadId)],
            };
          }
        );
      }
    },
    [queryClient]
  );

  const invalidateColumns = useCallback(
    (statuses: string[]) => {
      for (const status of statuses) {
        queryClient.invalidateQueries({ queryKey: ['kanban-leads', status] });
      }
    },
    [queryClient]
  );

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['kanban-leads'] });
  }, [queryClient]);

  return {
    columns,
    allLeads,
    isLoading,
    optimisticMove,
    invalidateColumns,
    invalidateAll,
  };
}
