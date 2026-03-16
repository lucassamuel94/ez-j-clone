import { useState, useCallback, useReducer } from 'react';
import { Lead, LeadTemperature, LeadStatus } from '@/types/lead';
import { useQueryClient } from '@tanstack/react-query';
import { useUpdateLead, useBulkDeleteLeads } from '@/hooks/useLeads';
import { bulkDiscardLeads } from '@/services/leadService';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { MeetingData } from '@/components/MeetingConfirmationDialog';
import type { ScheduleReturnData } from '@/components/ScheduleReturnDialog';
import type { DiscardReason } from '@/components/LostReasonDialog';

// ── Dialog state reducer ──

interface DialogState {
  scheduleReturnOpen: boolean;
  meetingDialogOpen: boolean;
  confirmMeetingOpen: boolean;
  singleLostDialogOpen: boolean;
  deleteDialogOpen: boolean;
  bulkDiscardDialogOpen: boolean;
  reassignDialogOpen: boolean;
  newLeadDialogOpen: boolean;
}

type DialogAction =
  | { type: 'OPEN'; dialog: keyof DialogState }
  | { type: 'CLOSE'; dialog: keyof DialogState }
  | { type: 'CLOSE_ALL' };

const initialDialogState: DialogState = {
  scheduleReturnOpen: false,
  meetingDialogOpen: false,
  confirmMeetingOpen: false,
  singleLostDialogOpen: false,
  deleteDialogOpen: false,
  bulkDiscardDialogOpen: false,
  reassignDialogOpen: false,
  newLeadDialogOpen: false,
};

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case 'OPEN':
      return { ...state, [action.dialog]: true };
    case 'CLOSE':
      return { ...state, [action.dialog]: false };
    case 'CLOSE_ALL':
      return initialDialogState;
    default:
      return state;
  }
}

// ── Bulk selection reducer ──

interface BulkState {
  selectedIds: Set<string>;
  allFilteredSelected: boolean;
  isLoadingSelection: boolean;
}

type BulkAction =
  | { type: 'TOGGLE'; id: string; checked: boolean }
  | { type: 'SET_IDS'; ids: Set<string>; allFiltered?: boolean }
  | { type: 'CLEAR' }
  | { type: 'SET_LOADING'; loading: boolean };

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
      return { ...state, selectedIds: new Set(), allFilteredSelected: false };
    case 'SET_LOADING':
      return { ...state, isLoadingSelection: action.loading };
    default:
      return state;
  }
}

// ── Main hook ──

interface UseLeadInboxDialogsParams {
  searchParams_: Record<string, unknown>;
  activeFilter: string;
  selectedSdrId: string;
  debouncedSearch: string;
  advancedFilterStatuses: Set<string>;
  displayedLeads: Lead[];
  kanbanLeads: Lead[];
  refetch: () => void;
}

export function useLeadInboxDialogs({
  searchParams_,
  activeFilter,
  selectedSdrId,
  debouncedSearch,
  advancedFilterStatuses,
  displayedLeads,
  kanbanLeads,
  refetch,
}: UseLeadInboxDialogsParams) {
  const queryClient = useQueryClient();
  const updateLeadMutation = useUpdateLead();
  const bulkDeleteMutation = useBulkDeleteLeads();
  const { user: currentUser } = useCurrentUser();
  const { isConnected: isCalendarConnected, createEvent: createCalendarEvent } = useGoogleCalendar();

  const [dialogs, dispatchDialog] = useReducer(dialogReducer, initialDialogState);
  const [bulk, dispatchBulk] = useReducer(bulkReducer, {
    selectedIds: new Set<string>(),
    allFilteredSelected: false,
    isLoadingSelection: false,
  });
  const [quickActionLead, setQuickActionLead] = useState<Lead | null>(null);
  const [sendToCloserLead, setSendToCloserLead] = useState<Lead | null>(null);

  // ── Dialog open/close helpers ──
  const openDialog = useCallback((d: keyof DialogState) => dispatchDialog({ type: 'OPEN', dialog: d }), []);
  const closeDialog = useCallback((d: keyof DialogState) => dispatchDialog({ type: 'CLOSE', dialog: d }), []);

  // ── Lead update handler ──
  const handleUpdateLead = useCallback((updatedLead: Lead) => {
    queryClient.setQueryData(['lead-by-id', updatedLead.id], updatedLead);
    queryClient.setQueryData(['leads-paginated', searchParams_], (prev: Record<string, unknown> | undefined) => {
      if (!prev) return prev;
      return {
        ...prev,
        leads: (prev.leads as Lead[]).map((l: Lead) => (l.id === updatedLead.id ? updatedLead : l)),
      };
    });
    updateLeadMutation.mutate(
      { id: updatedLead.id, updates: updatedLead },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
          queryClient.invalidateQueries({ queryKey: ['leads-paginated'] });
          queryClient.invalidateQueries({ queryKey: ['lead-by-id', updatedLead.id] });
        },
        onError: (error: Error) => {
          toast.error(error?.message || 'Erro ao atualizar lead');
          queryClient.invalidateQueries({ queryKey: ['leads-paginated'] });
          queryClient.invalidateQueries({ queryKey: ['lead-by-id', updatedLead.id] });
        },
      }
    );
  }, [queryClient, searchParams_, updateLeadMutation]);

  // ── Bulk selection handlers ──
  const handleLeadCheckChange = useCallback((leadId: string, checked: boolean) => {
    dispatchBulk({ type: 'TOGGLE', id: leadId, checked });
  }, []);

  const handleSelectAll = useCallback(() => {
    dispatchBulk({ type: 'SET_IDS', ids: new Set(displayedLeads.map(l => l.id)) });
  }, [displayedLeads]);

  const handleDeselectAll = useCallback(() => {
    dispatchBulk({ type: 'CLEAR' });
  }, []);

  const handleCheckAllChange = useCallback((checked: boolean) => {
    if (checked) handleSelectAll();
    else handleDeselectAll();
  }, [handleSelectAll, handleDeselectAll]);

  const fetchAllFilteredIds = useCallback(async (limit?: number) => {
    dispatchBulk({ type: 'SET_LOADING', loading: true });
    try {
      const sdrIdParam = selectedSdrId === 'all' ? null
        : selectedSdrId === 'unassigned' ? '00000000-0000-0000-0000-000000000000'
        : selectedSdrId;
      const { data, error } = await supabase.rpc('get_filtered_lead_ids', {
        p_tab: activeFilter,
        p_sdr_id: sdrIdParam,
        p_search: debouncedSearch.trim(),
        p_statuses: advancedFilterStatuses.size > 0 ? Array.from(advancedFilterStatuses) : null,
        p_limit: limit || null,
      } as Record<string, unknown>);
      if (error) throw error;
      return (data as string[]) || [];
    } catch (err) {
      console.error('Error fetching all filtered IDs:', err);
      toast.error('Erro ao carregar IDs filtrados. Tente novamente.');
      return null;
    } finally {
      dispatchBulk({ type: 'SET_LOADING', loading: false });
    }
  }, [selectedSdrId, activeFilter, debouncedSearch, advancedFilterStatuses]);

  const handleSelectAllFiltered = useCallback(async () => {
    const ids = await fetchAllFilteredIds();
    if (!ids || ids.length === 0) return;
    dispatchBulk({ type: 'SET_IDS', ids: new Set(ids), allFiltered: true });
  }, [fetchAllFilteredIds]);

  const handleSelectCustomCount = useCallback(async (count: number) => {
    const ids = await fetchAllFilteredIds(count);
    if (!ids) return;
    dispatchBulk({ type: 'SET_IDS', ids: new Set(ids) });
  }, [fetchAllFilteredIds]);

  const handleReassignComplete = useCallback(() => {
    dispatchBulk({ type: 'CLEAR' });
    refetch();
    queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
  }, [refetch, queryClient]);

  const handleBulkDelete = useCallback(async () => {
    const leadIdsToDelete = Array.from(bulk.selectedIds);
    try {
      await bulkDeleteMutation.mutateAsync(leadIdsToDelete);
      toast.success(`${leadIdsToDelete.length} lead(s) excluído(s) com sucesso`);
      dispatchBulk({ type: 'CLEAR' });
      closeDialog('deleteDialogOpen');
      queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
    } catch (error) {
      console.error('Error deleting leads:', error);
      toast.error('Erro ao excluir leads. Verifique suas permissões.');
    }
  }, [bulk.selectedIds, bulkDeleteMutation, queryClient, closeDialog]);

  const handleBulkDiscard = useCallback(async (reason: DiscardReason) => {
    const leadIdsToDiscard = Array.from(bulk.selectedIds);
    try {
      await bulkDiscardLeads(leadIdsToDiscard, reason.status);
      toast.success(`${leadIdsToDiscard.length} lead(s) marcado(s) como perdido(s)`);
      dispatchBulk({ type: 'CLEAR' });
      closeDialog('bulkDiscardDialogOpen');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
    } catch (error) {
      console.error('Error discarding leads:', error);
      toast.error('Erro ao marcar leads como perdidos.');
    }
  }, [bulk.selectedIds, refetch, queryClient, closeDialog]);

  // ── Quick action handlers ──
  const handleQuickScheduleReturn = useCallback((lead: Lead) => {
    setQuickActionLead(lead);
    openDialog('scheduleReturnOpen');
  }, [openDialog]);

  const handleQuickScheduleMeeting = useCallback(async (lead: Lead) => {
    const { canAdvanceToMeeting } = await import('@/utils/qualificationScore');
    const advanceCheck = canAdvanceToMeeting(lead);
    if (!advanceCheck.allowed) {
      toast.error(advanceCheck.reason);
      return;
    }
    setQuickActionLead(lead);
    openDialog('meetingDialogOpen');
  }, [openDialog]);

  const handleQuickConfirmMeeting = useCallback((lead: Lead) => {
    setQuickActionLead(lead);
    openDialog('confirmMeetingOpen');
  }, [openDialog]);

  const handleQuickRescheduleMeeting = useCallback((lead: Lead) => {
    setQuickActionLead(lead);
    openDialog('scheduleReturnOpen');
  }, [openDialog]);

  const handleQuickMarkLost = useCallback((lead: Lead) => {
    setQuickActionLead(lead);
    openDialog('singleLostDialogOpen');
  }, [openDialog]);

  const handleScheduleReturnConfirm = useCallback((data: ScheduleReturnData) => {
    if (!quickActionLead) return;
    const returnDate = new Date(data.date);
    const [hours, minutes] = data.time.split(':').map(Number);
    returnDate.setHours(hours, minutes, 0, 0);
    handleUpdateLead({
      ...quickActionLead,
      status: (quickActionLead.status || 'Em contato') as LeadStatus,
      next_action_at: returnDate,
      last_contact_at: new Date(),
    });
    closeDialog('scheduleReturnOpen');
    setQuickActionLead(null);
    toast.success('Retorno agendado com sucesso');
  }, [quickActionLead, handleUpdateLead, closeDialog]);

  const handleMeetingConfirm = useCallback(async (data: MeetingData) => {
    if (!quickActionLead) return;
    const meetingDate = new Date(data.meetingDate);
    const [hours, minutes] = data.meetingTime.split(':').map(Number);
    meetingDate.setHours(hours, minutes, 0, 0);
    const oneHourBefore = new Date(meetingDate.getTime() - 60 * 60 * 1000);

    handleUpdateLead({
      ...quickActionLead,
      status: 'Reunião Agendada' as LeadStatus,
      next_action_at: oneHourBefore,
    });

    let meetingRecordId: string | undefined;
    const { data: meetingRow } = await supabase.from('meetings').insert({
      lead_id: quickActionLead.id,
      executive_name: data.executiveName,
      meeting_datetime: meetingDate.toISOString(),
      title: data.meetingTitle,
      reminder_minutes_before: data.reminderMinutesBefore,
      user_id: quickActionLead.owner_user_id || currentUser?.id || null,
    }).select('id').single();
    meetingRecordId = meetingRow?.id;

    if (currentUser?.id) {
      supabase.from('opportunities').insert({
        lead_id: quickActionLead.id,
        created_by_user_id: currentUser.id,
        assigned_to_user_id: data.executiveUserId,
        sdr_user_id: currentUser.id,
        meeting_datetime: meetingDate.toISOString(),
        stage: 'Demonstração',
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['leads-paginated'] });
        queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
      });
    }

    const meetingEndDate = new Date(meetingDate.getTime() + 60 * 60 * 1000);
    const attendees = (data.inviteEmails || []).map((email: string) => ({ email }));
    const formattedDate = meetingDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedTime = meetingDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let meetLink: string | undefined;
    if (isCalendarConnected) {
      try {
        const calResult = await createCalendarEvent({
          summary: data.meetingTitle,
          start: { dateTime: meetingDate.toISOString() },
          end: { dateTime: meetingEndDate.toISOString() },
          attendees,
          description: `Empresa: ${quickActionLead.company}\nContato: ${quickActionLead.name}\nExecutivo: ${data.executiveName}`,
        });
        meetLink = calResult?.hangoutLink || calResult?.conferenceData?.entryPoints?.find((e: Record<string, string>) => e.entryPointType === 'video')?.uri;
        if (meetLink && meetingRecordId) {
          await supabase.from('meetings').update({ meet_link: meetLink } as Record<string, unknown>).eq('id', meetingRecordId);
        }
      } catch (err) {
        console.error('Google Calendar error:', err);
        toast.warning('Reunião salva, mas o evento do calendário não foi criado.');
      }
    } else if (attendees.length > 0) {
      toast.warning('Google Calendar não conectado. Convites .ics não foram enviados.');
    }

    if (attendees.length > 0) {
      try {
        await supabase.functions.invoke('send-meeting-invite', {
          body: {
            emails: data.inviteEmails,
            meetingTitle: data.meetingTitle,
            meetingDate: formattedDate,
            meetingTime: formattedTime,
            executiveName: data.executiveName,
            companyName: quickActionLead.company,
            sdrName: currentUser?.name || 'SDR',
            meetLink,
          },
        });
      } catch (err) {
        console.error('Email invite error:', err);
        toast.warning('Reunião salva, mas o e-mail de convite não foi enviado.');
      }
    }

    closeDialog('meetingDialogOpen');
    setQuickActionLead(null);
    toast.success('Reunião agendada com sucesso');
  }, [quickActionLead, currentUser, handleUpdateLead, isCalendarConnected, createCalendarEvent, queryClient, closeDialog]);

  const handleConfirmMeetingConfirm = useCallback(async () => {
    if (!quickActionLead || !currentUser) return;

    // Validate SQO before creating opportunity
    const { requireSQOApproval } = await import('@/utils/sqoValidation');
    const approved = await requireSQOApproval(quickActionLead);
    if (!approved) return;

    handleUpdateLead({
      ...quickActionLead,
      status: 'Oportunidade criada' as LeadStatus,
      last_contact_at: new Date(),
      attempts_count: quickActionLead.attempts_count + 1,
    });
    try {
      const { createOpportunityFromMeeting } = await import('@/services/closerService');
      await createOpportunityFromMeeting(quickActionLead.id, currentUser.id, null, new Date().toISOString(), 'Demonstração', true);
    } catch (error) {
      console.error('Error creating opportunity from quick action:', error);
    }
    try {
      await supabase.from('lead_notes').insert({
        lead_id: quickActionLead.id,
        user_id: currentUser.id,
        note: `[Reunião Realizada] (${currentUser.name}) Reunião realizada via ação rápida. Oportunidade criada.`,
      });
    } catch (error) {
      console.error('Error adding note:', error);
    }
    closeDialog('confirmMeetingOpen');
    setQuickActionLead(null);
    toast.success('Reunião realizada! Oportunidade criada no pipeline.');
  }, [quickActionLead, currentUser, handleUpdateLead, closeDialog]);

  const handleSingleLostConfirm = useCallback((reason: DiscardReason) => {
    if (!quickActionLead) return;
    handleUpdateLead({
      ...quickActionLead,
      status: 'Descartado' as LeadStatus,
      list_reason: reason.status,
      next_action_at: new Date('2099-12-31T23:59:59Z'),
    });
    closeDialog('singleLostDialogOpen');
    setQuickActionLead(null);
    toast.success('Lead marcado como perdido');
  }, [quickActionLead, handleUpdateLead, closeDialog]);

  const handleQuickTemperatureChange = useCallback((lead: Lead, temperature: LeadTemperature) => {
    handleUpdateLead({ ...lead, temperature });
    toast.success(`Score de Qualificação alterado para ${temperature === 'frio' ? 'Baixo' : temperature === 'morno' ? 'Médio' : 'Alto'}`);
  }, [handleUpdateLead]);

  const handleQuickStatusChange = useCallback((lead: Lead, status: string) => {
    const now = new Date();
    const activeStatuses = ['Ocupado', 'Sem retorno', 'Em contato'];
    const scheduleStatuses = ['Ocupado', 'Sem retorno', 'Agendar retorno'];
    const nextAction = activeStatuses.includes(status) && (!lead.next_action_at || new Date(String(lead.next_action_at)) < now)
      ? now
      : lead.next_action_at;
    if (scheduleStatuses.includes(status)) {
      handleUpdateLead({
        ...lead,
        status: status as LeadStatus,
        last_contact_at: now,
        next_action_at: nextAction,
        attempts_count: (lead.attempts_count || 0) + 1,
      });
      setQuickActionLead({ ...lead, status: status as LeadStatus });
      openDialog('scheduleReturnOpen');
      return;
    }
    handleUpdateLead({
      ...lead,
      status: status as LeadStatus,
      last_contact_at: now,
      next_action_at: nextAction,
      attempts_count: (lead.attempts_count || 0) + 1,
    });
    toast.success(`Status alterado para "${status}"`);
  }, [handleUpdateLead, openDialog]);

  const handleSingleDelete = useCallback((lead: Lead) => {
    dispatchBulk({ type: 'SET_IDS', ids: new Set([lead.id]) });
    openDialog('deleteDialogOpen');
  }, [openDialog]);

  const handleSendToCloser = useCallback((lead: Lead) => {
    setSendToCloserLead(lead);
  }, []);

  const handleSendToCloserSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['leads-paginated'] });
    queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
    queryClient.invalidateQueries({ queryKey: ['closer-opportunities-paginated'] });
    queryClient.invalidateQueries({ queryKey: ['closer-tab-counts'] });
    queryClient.invalidateQueries({ queryKey: ['closer-opportunities'] });
    setSendToCloserLead(null);
  }, [queryClient]);

  const handleKanbanMoveStatus = useCallback((leadId: string, newStatus: LeadStatus) => {
    const lead = kanbanLeads.find(l => l.id === leadId);
    if (!lead) return;
    const now = new Date();
    handleUpdateLead({
      ...lead,
      status: newStatus,
      last_contact_at: now,
      next_action_at: now,
    });
    toast.success(`Lead movido para "${newStatus}"`);
  }, [kanbanLeads, handleUpdateLead]);

  // ── Reset bulk selection on filter change ──
  const clearBulkSelection = useCallback(() => {
    dispatchBulk({ type: 'CLEAR' });
  }, []);

  return {
    // Dialog state
    dialogs,
    openDialog,
    closeDialog,

    // Bulk selection
    selectedLeadIds: bulk.selectedIds,
    allFilteredSelected: bulk.allFilteredSelected,
    isLoadingSelection: bulk.isLoadingSelection,
    handleLeadCheckChange,
    handleSelectAll,
    handleSelectAllFiltered,
    handleSelectCustomCount,
    handleDeselectAll,
    handleCheckAllChange,
    handleReassignComplete,
    handleBulkDelete,
    handleBulkDiscard,
    clearBulkSelection,
    isBulkDeleting: bulkDeleteMutation.isPending,

    // Quick actions
    quickActionLead,
    handleQuickScheduleReturn,
    handleQuickScheduleMeeting,
    handleQuickConfirmMeeting,
    handleQuickRescheduleMeeting,
    handleQuickMarkLost,
    handleScheduleReturnConfirm,
    handleMeetingConfirm,
    handleConfirmMeetingConfirm,
    handleSingleLostConfirm,
    handleQuickTemperatureChange,
    handleQuickStatusChange,
    handleSingleDelete,

    // Send to closer
    sendToCloserLead,
    handleSendToCloser,
    handleSendToCloserSuccess,

    // Lead update
    handleUpdateLead,

    // Kanban
    handleKanbanMoveStatus,
  };
}
