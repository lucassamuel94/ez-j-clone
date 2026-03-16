import { useState, useCallback, useReducer, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CloserOpportunity, bulkDeleteOpportunities } from '@/services/closerService';
import { useCloserMutations } from '@/hooks/useCloserPipeline';
import { useUpdateLead } from '@/hooks/useLeads';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Lead } from '@/types/lead';

// ── Dialog state reducer ──

interface DialogState {
  returnDialogOpen: boolean;
  lostDialogOpen: boolean;
  notesDialogOpen: boolean;
  checklistOpen: boolean;
  deleteDialogOpen: boolean;
  reassignDialogOpen: boolean;
  newLeadDialogOpen: boolean;
  newDealDialogOpen: boolean;
}

type DialogAction =
  | { type: 'OPEN'; dialog: keyof DialogState }
  | { type: 'CLOSE'; dialog: keyof DialogState };

const initialDialogState: DialogState = {
  returnDialogOpen: false,
  lostDialogOpen: false,
  notesDialogOpen: false,
  checklistOpen: false,
  deleteDialogOpen: false,
  reassignDialogOpen: false,
  newLeadDialogOpen: false,
  newDealDialogOpen: false,
};

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case 'OPEN':
      return { ...state, [action.dialog]: true };
    case 'CLOSE':
      return { ...state, [action.dialog]: false };
    default:
      return state;
  }
}

// ── Bulk selection reducer ──

interface BulkState {
  selectedIds: Set<string>;
  allFilteredSelected: boolean;
  isLoadingSelection: boolean;
  isDeleting: boolean;
  bulkMode: boolean;
}

type BulkAction =
  | { type: 'TOGGLE'; id: string; checked: boolean }
  | { type: 'SET_IDS'; ids: Set<string>; allFiltered?: boolean }
  | { type: 'CLEAR' }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_DELETING'; deleting: boolean }
  | { type: 'SET_BULK_MODE'; mode: boolean };

function bulkReducer(state: BulkState, action: BulkAction): BulkState {
  switch (action.type) {
    case 'TOGGLE': {
      const newSet = new Set(state.selectedIds);
      if (action.checked) newSet.add(action.id);
      else newSet.delete(action.id);
      return { ...state, selectedIds: newSet };
    }
    case 'SET_IDS':
      return { ...state, selectedIds: action.ids, allFilteredSelected: action.allFiltered ?? false };
    case 'CLEAR':
      return { ...state, selectedIds: new Set(), allFilteredSelected: false, bulkMode: false };
    case 'SET_LOADING':
      return { ...state, isLoadingSelection: action.loading };
    case 'SET_DELETING':
      return { ...state, isDeleting: action.deleting };
    case 'SET_BULK_MODE':
      return { ...state, bulkMode: action.mode };
    default:
      return state;
  }
}

// ── Main hook ──

interface UseCloserPipelineDialogsParams {
  paginatedOpps: CloserOpportunity[];
  activeTab: string;
  closerIdParam: string | null;
  debouncedSearch: string;
  stagesParam?: string[];
  meetingDateRange: { from: Date | undefined; to: Date | undefined };
  wonDateRange: { from: Date | undefined; to: Date | undefined };
  isAdmin: boolean;
  isManager: boolean;
  isMobile: boolean;
}

export function useCloserPipelineDialogs({
  paginatedOpps,
  activeTab,
  closerIdParam,
  debouncedSearch,
  stagesParam,
  meetingDateRange,
  wonDateRange,
  isAdmin,
  isManager,
  isMobile,
}: UseCloserPipelineDialogsParams) {
  const queryClient = useQueryClient();
  const { moveStage, returnToSdr, markLost, markWon, updateNotes, invalidateAll } = useCloserMutations();
  const updateLeadMutation = useUpdateLead();
  const { user: currentUser } = useCurrentUser();

  const [dialogs, dispatchDialog] = useReducer(dialogReducer, initialDialogState);
  const [bulk, dispatchBulk] = useReducer(bulkReducer, {
    selectedIds: new Set<string>(),
    allFilteredSelected: false,
    isLoadingSelection: false,
    isDeleting: false,
    bulkMode: false,
  });

  const [selectedOpp, setSelectedOpp] = useState<CloserOpportunity | null>(null);
  const [checklistOpp, setChecklistOpp] = useState<CloserOpportunity | null>(null);
  const [reason, setReason] = useState('');
  const [returnSelected, setReturnSelected] = useState('');
  const [notes, setNotes] = useState('');
  const [detectedProjectType, setDetectedProjectType] = useState<string | null>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openDialog = useCallback((d: keyof DialogState) => dispatchDialog({ type: 'OPEN', dialog: d }), []);
  const closeDialog = useCallback((d: keyof DialogState) => dispatchDialog({ type: 'CLOSE', dialog: d }), []);

  // ── Bulk selection ──
  const handleOppCheckChange = useCallback((oppId: string, checked: boolean) => {
    dispatchBulk({ type: 'TOGGLE', id: oppId, checked });
  }, []);

  const handleSelectAll = useCallback(() => {
    dispatchBulk({ type: 'SET_IDS', ids: new Set(paginatedOpps.map(o => o.id)) });
  }, [paginatedOpps]);

  const handleDeselectAll = useCallback(() => {
    dispatchBulk({ type: 'CLEAR' });
  }, []);

  const handleCheckAllChange = useCallback((checked: boolean) => {
    if (checked) dispatchBulk({ type: 'SET_IDS', ids: new Set(paginatedOpps.map(o => o.id)) });
    else dispatchBulk({ type: 'SET_IDS', ids: new Set() });
  }, [paginatedOpps]);

  const fetchAllFilteredOppIds = useCallback(async (limit?: number) => {
    dispatchBulk({ type: 'SET_LOADING', loading: true });
    try {
      const { startOfDay, endOfDay } = await import('date-fns');
      const { data, error } = await supabase.rpc('get_filtered_opportunity_ids', {
        p_tab: activeTab,
        p_closer_id: closerIdParam,
        p_search: debouncedSearch.trim(),
        p_stages: stagesParam || null,
        p_meeting_from: activeTab === 'reunioes' && meetingDateRange.from ? startOfDay(meetingDateRange.from).toISOString() : null,
        p_meeting_to: activeTab === 'reunioes' && meetingDateRange.to ? endOfDay(meetingDateRange.to).toISOString() : null,
        p_won_from: activeTab === 'vendas' && wonDateRange.from ? startOfDay(wonDateRange.from).toISOString() : null,
        p_won_to: activeTab === 'vendas' && wonDateRange.to ? endOfDay(wonDateRange.to).toISOString() : null,
        p_limit: limit || null,
      } as Record<string, unknown>);
      if (error) throw error;
      return (data as string[]) || [];
    } catch (err) {
      console.error('Error fetching all filtered opp IDs:', err);
      return [];
    } finally {
      dispatchBulk({ type: 'SET_LOADING', loading: false });
    }
  }, [activeTab, closerIdParam, debouncedSearch, stagesParam, meetingDateRange, wonDateRange]);

  const handleSelectAllFiltered = useCallback(async () => {
    const ids = await fetchAllFilteredOppIds();
    dispatchBulk({ type: 'SET_IDS', ids: new Set(ids), allFiltered: true });
  }, [fetchAllFilteredOppIds]);

  const handleSelectCustomCount = useCallback(async (count: number) => {
    const ids = await fetchAllFilteredOppIds(count);
    dispatchBulk({ type: 'SET_IDS', ids: new Set(ids) });
  }, [fetchAllFilteredOppIds]);

  const handleBulkDelete = useCallback(async () => {
    dispatchBulk({ type: 'SET_DELETING', deleting: true });
    try {
      await bulkDeleteOpportunities(Array.from(bulk.selectedIds));
      toast.success(`${bulk.selectedIds.size} oportunidade(s) excluída(s)`);
      dispatchBulk({ type: 'CLEAR' });
      closeDialog('deleteDialogOpen');
      invalidateAll();
    } catch {
      toast.error('Erro ao excluir oportunidades');
    } finally {
      dispatchBulk({ type: 'SET_DELETING', deleting: false });
    }
  }, [bulk.selectedIds, invalidateAll, closeDialog]);

  const handleOpenSingleDelete = useCallback((opp: CloserOpportunity) => {
    dispatchBulk({ type: 'SET_IDS', ids: new Set([opp.id]) });
    openDialog('deleteDialogOpen');
  }, [openDialog]);

  const handleReassignComplete = useCallback(() => {
    dispatchBulk({ type: 'CLEAR' });
    invalidateAll();
  }, [invalidateAll]);

  // ── Opportunity action handlers ──
  const handleOpenReturn = useCallback((opp: CloserOpportunity) => {
    setSelectedOpp(opp);
    setReason('');
    setReturnSelected('');
    openDialog('returnDialogOpen');
  }, [openDialog]);

  const handleOpenLost = useCallback((opp: CloserOpportunity) => {
    setSelectedOpp(opp);
    setReason('');
    openDialog('lostDialogOpen');
  }, [openDialog]);

  const handleOpenNotes = useCallback((opp: CloserOpportunity) => {
    setSelectedOpp(opp);
    setNotes(opp.closer_notes || '');
    openDialog('notesDialogOpen');
  }, [openDialog]);

  const handleOpenChecklist = useCallback(async (opp: CloserOpportunity) => {
    try {
      const { data: latestProposal } = await supabase
        .from('proposals')
        .select('product_type')
        .eq('opportunity_id', opp.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestProposal?.product_type) {
        setDetectedProjectType(latestProposal.product_type === 'evolucao_ez_chat' ? 'evolucao' : 'venda');
      } else {
        setDetectedProjectType(null);
      }
    } catch {
      setDetectedProjectType(null);
    }
    setChecklistOpp(opp);
    openDialog('checklistOpen');
  }, [openDialog]);

  const handleChecklistSuccess = useCallback(() => {
    if (checklistOpp) markWon.mutate(checklistOpp.id);
  }, [checklistOpp, markWon]);

  const handleUpdateLead = useCallback((updatedLead: Lead) => {
    queryClient.setQueryData(['lead-by-id', updatedLead.id], updatedLead);
    queryClient.setQueryData<Lead[]>(['leads'], (prev) => {
      if (!prev) return prev;
      return prev.map((l) => (l.id === updatedLead.id ? updatedLead : l));
    });
    updateLeadMutation.mutate(
      { id: updatedLead.id, updates: updatedLead },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          queryClient.invalidateQueries({ queryKey: ['lead-by-id', updatedLead.id] });
          queryClient.invalidateQueries({ queryKey: ['closer-pipeline'] });
        },
        onError: (error: Error) => {
          toast.error(error?.message || 'Erro ao atualizar lead');
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          queryClient.invalidateQueries({ queryKey: ['lead-by-id', updatedLead.id] });
        },
      }
    );
  }, [queryClient, updateLeadMutation]);

  const handleLongPressStart = useCallback((oppId: string) => {
    if (!(isAdmin || isManager) || !isMobile) return;
    longPressTimerRef.current = setTimeout(() => {
      dispatchBulk({ type: 'SET_BULK_MODE', mode: true });
      dispatchBulk({ type: 'SET_IDS', ids: new Set([oppId]) });
    }, 500);
  }, [isAdmin, isManager, isMobile]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleNewLeadCreated = useCallback(async (leadId: string) => {
    if (!currentUser?.id) return;
    try {
      // Validate SQO before creating opportunity
      const { data: lead } = await supabase.from('leads').select('sqo_pain_category, sqo_pain_clear, sqo_pain_financial_impact, sqo_urgency, sqo_budget, sqo_decision_maker, sqo_icp_fit').eq('id', leadId).single();
      const { requireSQOApproval } = await import('@/utils/sqoValidation');
      const approved = await requireSQOApproval(lead || {});
      if (!approved) return;

      await supabase.from('opportunities').insert({
        lead_id: leadId,
        created_by_user_id: currentUser.id,
        assigned_to_user_id: currentUser.id,
        sdr_user_id: currentUser.id,
        stage: 'Demonstração',
      });
      await supabase.from('leads').update({ status: 'Oportunidade criada' as unknown as Lead['status'] }).eq('id', leadId);
      invalidateAll();
      toast.success('Oportunidade criada automaticamente');
    } catch (err) {
      console.error('Error creating opportunity:', err);
      toast.error('Lead criado, mas erro ao criar oportunidade');
    }
  }, [currentUser?.id, invalidateAll]);

  const clearBulkSelection = useCallback(() => {
    dispatchBulk({ type: 'CLEAR' });
  }, []);

  return {
    // Dialog state
    dialogs,
    openDialog,
    closeDialog,

    // Bulk state
    selectedOppIds: bulk.selectedIds,
    allFilteredSelected: bulk.allFilteredSelected,
    isLoadingSelection: bulk.isLoadingSelection,
    isDeleting: bulk.isDeleting,
    bulkMode: bulk.bulkMode,
    setBulkMode: (mode: boolean) => dispatchBulk({ type: 'SET_BULK_MODE', mode }),
    handleOppCheckChange,
    handleSelectAll,
    handleSelectAllFiltered,
    handleSelectCustomCount,
    handleDeselectAll,
    handleCheckAllChange,
    handleBulkDelete,
    handleOpenSingleDelete,
    handleReassignComplete,
    clearBulkSelection,

    // Opportunity actions
    selectedOpp,
    checklistOpp,
    reason,
    setReason,
    returnSelected,
    setReturnSelected,
    notes,
    setNotes,
    detectedProjectType,
    handleOpenReturn,
    handleOpenLost,
    handleOpenNotes,
    handleOpenChecklist,
    handleChecklistSuccess,
    handleUpdateLead,
    handleNewLeadCreated,

    // Mobile
    handleLongPressStart,
    handleLongPressEnd,

    // Mutations (pass-through)
    moveStage,
    returnToSdr,
    markLost,
    markWon,
    updateNotes,
    invalidateAll,
  };
}
