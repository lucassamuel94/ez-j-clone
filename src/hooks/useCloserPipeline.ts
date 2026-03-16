import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  updateOpportunityStage, 
  updateOpportunityNotes,
  returnLeadToSdr, 
  markOpportunityLost,
  markOpportunityWon,
  CloserStage,
  CloserOpportunity,
  fetchCloserOpportunities,
  normalizeStage,
} from '@/services/closerService';
import { toast } from 'sonner';

export interface CloserPaginationParams {
  tab: string;
  closerId?: string | null;
  search?: string;
  stages?: string[];
  meetingFrom?: string | null;
  meetingTo?: string | null;
  wonFrom?: string | null;
  wonTo?: string | null;
  page: number;
  pageSize: number;
  opportunityType?: string;
  sortColumn?: string | null;
  sortDirection?: 'asc' | 'desc';
}

export const useCloserPipelinePaginated = (params: CloserPaginationParams) => {
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['closer-opportunities-paginated', params],
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc('search_opportunities_paginated', {
        p_tab: params.tab,
        p_closer_id: params.closerId || null,
        p_search: params.search || '',
        p_stages: params.stages && params.stages.length > 0 ? params.stages : null,
        p_meeting_from: params.meetingFrom || null,
        p_meeting_to: params.meetingTo || null,
        p_won_from: params.wonFrom || null,
        p_won_to: params.wonTo || null,
        p_page: params.page,
        p_page_size: params.pageSize,
        p_opportunity_type: params.opportunityType || 'new_business',
        p_sort_column: params.sortColumn || null,
        p_sort_direction: params.sortDirection || 'asc',
      } as any);
      
      if (error) throw error;
      
      const parsed = result as any;
      return {
        total: parsed.total as number,
        data: (parsed.data || []).map(mapRpcRowToOpportunity),
      };
    },
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  return {
    opportunities: data?.data || [],
    total: data?.total || 0,
    isLoading,
    isFetching,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['closer-opportunities-paginated'] }),
  };
};

export const useCloserTabCounts = (closerId?: string | null, opportunityType?: string) => {
  const { data } = useQuery({
    queryKey: ['closer-tab-counts', closerId, opportunityType],
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc('get_opportunity_tab_counts', {
        p_closer_id: closerId || null,
        p_opportunity_type: opportunityType || 'new_business',
      } as any);
      if (error) throw error;
      return result as any;
    },
    staleTime: 30_000,
  });

  return {
    oportunidades: data?.oportunidades || 0,
    reunioes: data?.reunioes || 0,
    vendas: data?.vendas || 0,
    totalActive: data?.total_active || 0,
    totalWon: data?.total_won || 0,
    totalLost: data?.total_lost || 0,
  };
};

// Keep full-load hook for kanban only
export const useCloserKanbanData = (enabled: boolean, closerId?: string | null, search?: string, opportunityType?: string) => {
  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['closer-kanban-data', closerId, search, opportunityType],
    queryFn: async () => {
      const all = await fetchCloserOpportunities();
      let filtered = all.filter(o => (o as any).opportunity_type === (opportunityType || 'new_business'));
      if (closerId && closerId !== 'all') {
        const UNASSIGNED_SENTINEL = '00000000-0000-0000-0000-000000000000';
        if (closerId === UNASSIGNED_SENTINEL) {
          filtered = filtered.filter(o => !o.assigned_to_user_id);
        } else {
          filtered = filtered.filter(o => o.assigned_to_user_id === closerId);
        }
      }
      if (search?.trim()) {
        const q = search.toLowerCase().replace(/[.\-\/]/g, '');
        filtered = filtered.filter(o => {
          const fields = [o.lead_name, o.lead_company, o.lead_razao_social, o.lead_nome_fantasia, o.lead_whatsapp, o.lead_phone, o.lead_email, o.sdr_name, o.closer_name];
          return fields.some(f => f?.toLowerCase().includes(q)) ||
            (o as any).lead_cnpj?.replace(/[.\-\/]/g, '').includes(q);
        });
      }
      return filtered;
    },
    enabled,
    staleTime: 60_000,
  });

  return { opportunities, isLoading };
};

// Mutations hook (shared)
export const useCloserMutations = () => {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['closer-opportunities-paginated'] });
    queryClient.invalidateQueries({ queryKey: ['closer-tab-counts'] });
    queryClient.invalidateQueries({ queryKey: ['closer-kanban-data'] });
    queryClient.invalidateQueries({ queryKey: ['closer-kanban'] });
    // Legacy key used by other parts of the app
    queryClient.invalidateQueries({ queryKey: ['closer-opportunities'] });
  };

  const moveStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: CloserStage }) =>
      updateOpportunityStage(id, stage),
    onSuccess: () => { invalidateAll(); toast.success('Status atualizado'); },
    onError: () => toast.error('Erro ao atualizar estágio'),
  });

  const updateNotes = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      updateOpportunityNotes(id, notes),
    onSuccess: invalidateAll,
    onError: () => toast.error('Erro ao salvar notas'),
  });

  const returnToSdr = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      returnLeadToSdr(id, reason),
    onSuccess: () => {
      invalidateAll();
      toast.success('Lead devolvido ao SDR para reagendamento');
    },
    onError: () => toast.error('Erro ao devolver lead'),
  });

  const markLost = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      markOpportunityLost(id, reason),
    onSuccess: () => { invalidateAll(); toast.success('Oportunidade marcada como perdida'); },
    onError: () => toast.error('Erro ao marcar como perdida'),
  });

  const markWon = useMutation({
    mutationFn: (id: string) => markOpportunityWon(id),
    onSuccess: () => { invalidateAll(); toast.success('🎉 Oportunidade ganha!'); },
    onError: () => toast.error('Erro ao marcar como ganha'),
  });

  return { moveStage, updateNotes, returnToSdr, markLost, markWon, invalidateAll };
};

function mapRpcRowToOpportunity(row: any): CloserOpportunity {
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
    opportunity_type: row.opportunity_type || 'new_business',
    expected_close_date: row.expected_close_date || null,
    decision_maker_identified: row.decision_maker_identified || false,
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

// Backwards-compatible hook for pages that still need the full opportunity list
export const useCloserPipeline = () => {
  const queryClient = useQueryClient();
  const mutations = useCloserMutations();

  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['closer-opportunities'],
    queryFn: fetchCloserOpportunities,
    staleTime: 30_000,
  });

  return {
    opportunities,
    isLoading,
    ...mutations,
  };
};
