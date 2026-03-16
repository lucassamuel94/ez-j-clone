import { useCallback, useMemo } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CloserOpportunity, CloserStage, normalizeStage } from '@/services/closerService';

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
        queryKey: ['closer-kanban', stage, closerId, search, sortBy, opportunityType, pages],
        queryFn: async () => {
          const { data: result, error } = await (supabase.rpc as any)('search_opportunities_kanban', {
            p_stage: stage,
            p_closer_id: closerId || null,
            p_search: search || '',
            p_opportunity_type: opportunityType || 'new_business',
            p_page: 1,
            p_page_size: pages * PAGE_SIZE,
            p_sort: sortBy || 'created_desc',
          });
          if (error) throw error;
          const parsed = result as any;
          return {
            total: parsed.total as number,
            data: (parsed.data || []).map(mapRpcRow),
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

function mapRpcRow(row: any): CloserOpportunity {
  return {
    id: row.id,
    lead_id: row.lead_id,
    stage: normalizeStage(row.stage) as CloserStage,
    created_by_user_id: row.created_by_user_id,
    assigned_to_user_id: row.assigned_to_user_id,
    sdr_user_id: row.sdr_user_id,
    closer_notes: row.closer_notes,
    returned_to_sdr: row.returned_to_sdr || false,
    return_reason: row.return_reason,
    lost_reason: row.lost_reason,
    meeting_datetime: row.meeting_datetime,
    deal_value: Number(row.deal_value) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    active_objection: row.active_objection || null,
    expected_close_date: row.expected_close_date || null,
    decision_maker_identified: row.decision_maker_identified || false,
    won_at: row.won_at || null,
    opportunity_type: row.opportunity_type || 'new_business',
    lead_name: row.lead_name,
    lead_company: row.lead_company,
    lead_razao_social: row.lead_razao_social,
    lead_nome_fantasia: row.lead_nome_fantasia,
    lead_cnpj: row.lead_cnpj,
    lead_whatsapp: row.lead_whatsapp,
    lead_phone: row.lead_phone,
    lead_phone_2: row.lead_phone_2,
    lead_phone_3: row.lead_phone_3,
    lead_phone_4: row.lead_phone_4,
    lead_email: row.lead_email,
    lead_temperature: row.lead_temperature,
    lead_last_contact_at: row.lead_last_contact_at,
    lead_next_action_at: row.lead_next_action_at,
    lead_status: row.lead_status,
    lead_website: row.lead_website,
    sdr_name: row.sdr_name,
    closer_name: row.closer_name,
  };
}
