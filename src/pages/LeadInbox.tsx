import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { Lead, FilterType, LeadTemperature, LeadStatus } from '@/types/lead';
import { useLeadsPaginated, useLeadTabCounts, useUpdateLead, useBulkDeleteLeads } from '@/hooks/useLeads';
import { bulkDiscardLeads } from '@/services/leadService';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { LeadAdvancedFilter, ActiveFilterChips } from '@/components/LeadAdvancedFilter';
import { LeadRow, LeadTableHeader } from '@/components/LeadRow';
import { LeadModal } from '@/components/LeadModal';
import { NewLeadDialog } from '@/components/NewLeadDialog';
import { NotificationPermissionPrompt, NotificationBanner } from '@/components/NotificationPermissionPrompt';
import { BulkActionsBar } from '@/components/BulkActionsBar';
import { LeadReassignDialog } from '@/components/LeadReassignDialog';
import { SendToCloserDialog } from '@/components/SendToCloserDialog';

import { DeleteLeadDialog } from '@/components/DeleteLeadDialog';
import { LostReasonDialog, DiscardReason } from '@/components/LostReasonDialog';
import { ScheduleReturnDialog, ScheduleReturnData } from '@/components/ScheduleReturnDialog';
import { MeetingConfirmationDialog, MeetingData } from '@/components/MeetingConfirmationDialog';
import { MeetingConfirmedDialog } from '@/components/MeetingConfirmedDialog';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Plus, 
  Inbox, 
  Loader2,
  Users,
  List,
  LayoutGrid,
  ArrowDownWideNarrow,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { findExistingActiveMeeting, updateExistingMeeting, updateExistingOpportunity } from '@/services/meetingService';
import { Link, useSearchParams } from 'react-router-dom';
import { useLeadModal } from '@/hooks/useLeadModal';
import { AppLayout } from '@/components/AppLayout';
import { GlobalSearchDropdown, GlobalSearchResult } from '@/components/GlobalSearchDropdown';
import { cn } from '@/lib/utils';

import { PageHeader } from '@/components/PageHeader';
import { SDRKanbanView, SDRSortOption } from '@/components/sdr/SDRKanbanView';
import { useSDRStages } from '@/hooks/useSDRStages';
import { useExportLeadsToExcel } from '@/hooks/useExportToExcel';
import { useKanbanLeadsByStatus } from '@/hooks/useKanbanLeadsByStatus';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useLeadInboxDialogs } from '@/hooks/useLeadInboxDialogs';

const LeadInbox = () => {
  // Register service worker for push notifications
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const updateLeadMutation = useUpdateLead();
  const bulkDeleteMutation = useBulkDeleteLeads();
  const { hasPermission } = usePermissions();
  const { user: currentUser } = useCurrentUser();
  const { role: currentRole, isManager } = useUserRole();
  const { isConnected: isCalendarConnected, createEvent: createCalendarEvent, updateEvent: updateCalendarEvent } = useGoogleCalendar();
  
  const { lead: selectedLead, opportunity: modalOpp, isOpen: drawerOpen, openLead, closeLead } = useLeadModal();
  const { exportLeads, isExporting: isExportingLeads } = useExportLeadsToExcel();
  const [globalSearchReadOnly, setGlobalSearchReadOnly] = useState(false);
  const [newLeadDialogOpen, setNewLeadDialogOpen] = useState(false);
  const [activeFilter, _setActiveFilter] = useState<FilterType>(() => {
    return (localStorage.getItem('sdr_active_filter') as FilterType) || 'today';
  });
  const setActiveFilter = useCallback((v: FilterType) => {
    localStorage.setItem('sdr_active_filter', v);
    _setActiveFilter(v);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [advancedFilterStatuses, _setAdvancedFilterStatuses] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('sdr_advanced_filters');
    if (saved) return new Set<string>(JSON.parse(saved));
    return new Set<string>([
      'Novo', 'Devolvido pelo Closer', 'Lead Quente', 'Reunião agendada',
      'Reunião Confirmada', 'Oportunidade criada', 'Oportunidade Futura',
      'Reciclagem', 'Descartado', 'Ocupado', 'Sem retorno', 'Agendar retorno', 'Em contato',
    ]);
  });
  const setAdvancedFilterStatuses = useCallback((v: Set<string>) => {
    _setAdvancedFilterStatuses(v);
    localStorage.setItem('sdr_advanced_filters', JSON.stringify([...v]));
  }, []);

  // Debounce search query for server-side filtering
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('sdr_items_per_page');
    return saved ? Number(saved) : 20;
  });
  const [selectedSdrId, _setSelectedSdrId] = useState<string>(() => {
    return localStorage.getItem('sdr_selected_sdr_id') || 'pending';
  });
  const setSelectedSdrId = useCallback((v: string) => {
    localStorage.setItem('sdr_selected_sdr_id', v);
    _setSelectedSdrId(v);
  }, []);
  
  // Bulk selection state
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [allFilteredSelected, setAllFilteredSelected] = useState(false);
  const [isLoadingSelection, setIsLoadingSelection] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDiscardDialogOpen, setBulkDiscardDialogOpen] = useState(false);
  
  // Quick action dialog states
  const [quickActionLead, setQuickActionLead] = useState<Lead | null>(null);
  const [scheduleReturnOpen, setScheduleReturnOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [confirmMeetingOpen, setConfirmMeetingOpen] = useState(false);
  const [singleLostDialogOpen, setSingleLostDialogOpen] = useState(false);
  
  // Send to Closer state
  const [sendToCloserLead, setSendToCloserLead] = useState<Lead | null>(null);
  // View mode (list | kanban)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(() => {
    return (localStorage.getItem('sdr_view_mode') as 'list' | 'kanban') || 'list';
  });
  const [kanbanSortBy, setKanbanSortBy] = useState<SDRSortOption>(() => {
    return (localStorage.getItem('sdr_kanban_sort') as SDRSortOption) || 'next_action_asc';
  });

  // Persist view mode & sort
  useEffect(() => { localStorage.setItem('sdr_view_mode', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('sdr_kanban_sort', kanbanSortBy); }, [kanbanSortBy]);

  // Kanban default visible statuses (all except terminal)
  const { kanbanStatuses: dynamicSDRStatuses, defaultVisibleStatuses: defaultKanbanVisible } = useSDRStages();
  const [kanbanVisibleStatuses, setKanbanVisibleStatuses] = useState<Set<string>>(new Set());

  // Sync visible statuses whenever dynamic stages change.
  // Also validate saved advanced filter against current dynamic stages (admin may have added/removed stages).
  const sdrDefaultsApplied = useRef(false);
  useEffect(() => {
    if (defaultKanbanVisible.size > 0) {
      setKanbanVisibleStatuses(defaultKanbanVisible);
    }
    if (!sdrDefaultsApplied.current && dynamicSDRStatuses.length > 0) {
      const saved = localStorage.getItem('sdr_advanced_filters');
      if (!saved) {
        // Default: all stages selected (exclude terminal like Perdido)
        _setAdvancedFilterStatuses(new Set(defaultKanbanVisible));
      } else {
        const savedSet = new Set<string>(JSON.parse(saved));
        const allStages = new Set<string>(dynamicSDRStatuses);
        let hasInvalid = false;
        for (const s of savedSet) {
          if (!allStages.has(s)) {
            savedSet.delete(s);
            hasInvalid = true;
          }
        }
        if (hasInvalid) {
          const next = savedSet.size > 0 ? savedSet : new Set(defaultKanbanVisible);
          _setAdvancedFilterStatuses(next);
          localStorage.setItem('sdr_advanced_filters', JSON.stringify([...next]));
        }
      }
      sdrDefaultsApplied.current = true;
    }
  }, [defaultKanbanVisible, dynamicSDRStatuses]);
  
  // All users can select leads; admin/manager get extra actions
  const canBulkSelect = true;
  const canBulkReassign = hasPermission('access_admin') || hasPermission('view_sdr_leads') || hasPermission('reassign_ownership');

  // Set default SDR filter: admin/manager see all, others see own leads
  useEffect(() => {
    if (selectedSdrId !== 'pending') return;
    if (!currentUser) return;
    if (hasPermission('access_admin')) {
      setSelectedSdrId('all');
    } else {
      setSelectedSdrId(currentUser.id);
    }
  }, [currentUser, hasPermission, selectedSdrId]);


  // ═══ Server-side paginated data ═══
  const searchParams_ = useMemo(() => ({
    tab: activeFilter,
    sdrId: selectedSdrId,
    search: debouncedSearch,
    statuses: advancedFilterStatuses.size > 0 ? Array.from(advancedFilterStatuses) : null,
    page: currentPage,
    pageSize: itemsPerPage,
  }), [activeFilter, selectedSdrId, debouncedSearch, advancedFilterStatuses, currentPage, itemsPerPage]);

  const { data: paginatedResult, isLoading, isError: isLeadsError, error: leadsError, refetch } = useLeadsPaginated(searchParams_);
  const { data: tabCounts } = useLeadTabCounts(selectedSdrId);

  // ═══ Kanban data (server-side paginated per column) ═══
  const [kanbanColumnPages, setKanbanColumnPages] = useState<Record<string, number>>({});

  // Reset column pages when filters change
  useEffect(() => {
    setKanbanColumnPages({});
  }, [selectedSdrId, debouncedSearch, kanbanSortBy, advancedFilterStatuses]);

  const kanbanVisibleStatusesMerged = useMemo(() => {
    if (advancedFilterStatuses.size > 0) {
      // Intersect kanban visible with advanced filter
      return new Set([...kanbanVisibleStatuses].filter(s => advancedFilterStatuses.has(s)));
    }
    return kanbanVisibleStatuses;
  }, [kanbanVisibleStatuses, advancedFilterStatuses]);

  const {
    columns: kanbanColumns,
    allLeads: kanbanAllLeads,
    isLoading: isKanbanLoading,
    optimisticMove,
    invalidateColumns,
    invalidateAll: invalidateAllKanban,
  } = useKanbanLeadsByStatus({
    sdrId: selectedSdrId,
    search: debouncedSearch,
    sortBy: kanbanSortBy,
    visibleStatuses: kanbanVisibleStatusesMerged,
    enabled: viewMode === 'kanban',
    columnPages: kanbanColumnPages,
  });

  const handleKanbanLoadMore = useCallback((status: string) => {
    setKanbanColumnPages(prev => ({
      ...prev,
      [status]: (prev[status] ?? 1) + 1,
    }));
  }, []);

  const displayedLeads = paginatedResult?.leads || [];
  const totalFiltered = paginatedResult?.total || 0;
  const totalPages = Math.ceil(totalFiltered / itemsPerPage);

  // Stats from tab counts (no need to load all leads)
  const stats = useMemo(() => tabCounts || {
    total: 0, overdue: 0, today: 0, new: 0, in_contact_return: 0,
    devolvido_closer: 0, ocupado: 0, nao_atendeu: 0, sem_retorno: 0,
    agendar_retorno: 0, scheduled: 0, confirmed: 0, future_opportunity: 0, discarded: 0,
  }, [tabCounts]);

  // Fetch SDR/manager/admin profiles for the filter
  const { data: sdrProfiles = [] } = useQuery({
    queryKey: ['sdrProfiles'],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['sdr', 'manager', 'admin']);
      if (roleError) throw roleError;

      const userIds = [...new Set((roleData || []).map(r => r.user_id))];
      if (userIds.length === 0) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('active', true)
        .in('id', userIds)
        .order('name');
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });

  // selectedLead is now derived directly from useLeadModal (URL-driven)

  // Handle filter param from URL
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'overdue') {
      setActiveFilter('overdue');
      searchParams.delete('filter');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const canFilterBySdr = hasPermission('access_admin');

  // For non-admin/manager: filter profiles to same role only
  const visibleProfiles = useMemo(() => {
    if (canFilterBySdr) return sdrProfiles;
    if (!currentUser || !currentRole) return [];
    return sdrProfiles.filter(p => p.id === currentUser.id);
  }, [sdrProfiles, canFilterBySdr, currentUser, currentRole]);

  // Reset to page 1 when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, debouncedSearch, itemsPerPage, selectedSdrId, advancedFilterStatuses]);

  // Clear selection when filter changes (including SDR filter)
  useEffect(() => {
    setSelectedLeadIds(new Set());
    setAllFilteredSelected(false);
  }, [activeFilter, debouncedSearch, advancedFilterStatuses, selectedSdrId]);

  // Bulk selection handlers
  const handleLeadCheckChange = useCallback((leadId: string, checked: boolean) => {
    setSelectedLeadIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(leadId);
      } else {
        newSet.delete(leadId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = displayedLeads.map(lead => lead.id);
    setSelectedLeadIds(new Set(allIds));
    setAllFilteredSelected(false);
  }, [displayedLeads]);

  const fetchAllFilteredIds = useCallback(async (limit?: number) => {
    setIsLoadingSelection(true);
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
      } as any);
      if (error) throw error;
      return (data as string[]) || [];
    } catch (err) {
      console.error('Error fetching all filtered IDs:', err);
      toast.error('Erro ao carregar IDs filtrados. Tente novamente.');
      return null;
    } finally {
      setIsLoadingSelection(false);
    }
  }, [selectedSdrId, activeFilter, debouncedSearch, advancedFilterStatuses]);

  const handleSelectAllFiltered = useCallback(async () => {
    const ids = await fetchAllFilteredIds();
    if (!ids || ids.length === 0) {
      // Don't mark allFilteredSelected if fetch failed or returned empty
      return;
    }
    setSelectedLeadIds(new Set(ids));
    setAllFilteredSelected(true);
  }, [fetchAllFilteredIds]);

  const handleSelectCustomCount = useCallback(async (count: number) => {
    const ids = await fetchAllFilteredIds(count);
    if (!ids) return;
    setSelectedLeadIds(new Set(ids));
    setAllFilteredSelected(false);
  }, [fetchAllFilteredIds]);

  const handleDeselectAll = useCallback(() => {
    setSelectedLeadIds(new Set());
    setAllFilteredSelected(false);
  }, []);

  const handleCheckAllChange = useCallback((checked: boolean) => {
    if (checked) {
      handleSelectAll();
    } else {
      handleDeselectAll();
    }
  }, [handleSelectAll, handleDeselectAll]);

  const handleReassignComplete = useCallback(() => {
    setSelectedLeadIds(new Set());
    setAllFilteredSelected(false);
    refetch();
    queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
  }, [refetch, queryClient]);

  const handleBulkDelete = useCallback(async () => {
    const leadIdsToDelete = Array.from(selectedLeadIds);
    try {
      await bulkDeleteMutation.mutateAsync(leadIdsToDelete);
      toast.success(`${leadIdsToDelete.length} lead(s) excluído(s) com sucesso`);
      setSelectedLeadIds(new Set());
      setAllFilteredSelected(false);
      setDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
    } catch (error) {
      console.error('Error deleting leads:', error);
      toast.error('Erro ao excluir leads. Verifique suas permissões.');
    }
  }, [selectedLeadIds, bulkDeleteMutation, queryClient]);

  const handleBulkDiscard = useCallback(async (reason: DiscardReason) => {
    const leadIdsToDiscard = Array.from(selectedLeadIds);
    try {
      await bulkDiscardLeads(leadIdsToDiscard, reason.status);
      toast.success(`${leadIdsToDiscard.length} lead(s) marcado(s) como perdido(s)`);
      setSelectedLeadIds(new Set());
      setAllFilteredSelected(false);
      setBulkDiscardDialogOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
    } catch (error) {
      console.error('Error discarding leads:', error);
      toast.error('Erro ao marcar leads como perdidos.');
    }
  }, [selectedLeadIds, refetch, queryClient]);

  // Quick action handlers from LeadRow dropdown
  const handleQuickScheduleReturn = useCallback((lead: Lead) => {
    setQuickActionLead(lead);
    setScheduleReturnOpen(true);
  }, []);

  const handleQuickScheduleMeeting = useCallback(async (lead: Lead) => {
    const { canAdvanceToMeeting } = await import('@/utils/qualificationScore');
    const advanceCheck = canAdvanceToMeeting(lead);
    if (!advanceCheck.allowed) {
      toast.error(advanceCheck.reason);
      return;
    }
    setQuickActionLead(lead);
    setMeetingDialogOpen(true);
  }, []);

  const handleQuickConfirmMeeting = useCallback((lead: Lead) => {
    setQuickActionLead(lead);
    setConfirmMeetingOpen(true);
  }, []);

  const handleQuickRescheduleMeeting = useCallback((lead: Lead) => {
    setQuickActionLead(lead);
    setScheduleReturnOpen(true);
  }, []);

  const handleQuickMarkLost = useCallback((lead: Lead) => {
    setQuickActionLead(lead);
    setSingleLostDialogOpen(true);
  }, []);

  const handleLeadClick = useCallback((lead: Lead) => {
    setGlobalSearchReadOnly(false);
    openLead(lead.id);
  }, [openLead]);

  const handleUpdateLead = useCallback((updatedLead: Lead) => {
    // Optimistically update the lead-by-id cache so the modal reflects changes immediately
    queryClient.setQueryData(['lead-by-id', updatedLead.id], updatedLead);

    // Optimistically update the paginated cache
    queryClient.setQueryData(['leads-paginated', searchParams_], (prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        leads: prev.leads.map((l: Lead) => (l.id === updatedLead.id ? updatedLead : l)),
      };
    });

    updateLeadMutation.mutate(
      {
        id: updatedLead.id,
        updates: updatedLead,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
          // Re-confirm caches match DB after successful persist
          queryClient.invalidateQueries({ queryKey: ['leads-paginated'] });
          queryClient.invalidateQueries({ queryKey: ['lead-by-id', updatedLead.id] });
        },
        onError: (error: any) => {
          const message = error?.message || 'Erro ao atualizar lead';
          toast.error(message);
          // Revert optimistic updates by refetching from DB
          queryClient.invalidateQueries({ queryKey: ['leads-paginated'] });
          queryClient.invalidateQueries({ queryKey: ['lead-by-id', updatedLead.id] });
        },
      }
    );
  }, [queryClient, searchParams_, updateLeadMutation]);

  const handleScheduleReturnConfirm = useCallback((data: ScheduleReturnData) => {
    if (!quickActionLead) return;
    const returnDate = new Date(data.date);
    const [hours, minutes] = data.time.split(':').map(Number);
    returnDate.setHours(hours, minutes, 0, 0);

    handleUpdateLead({
      ...quickActionLead,
      status: (quickActionLead.status || 'Em contato') as any,
      next_action_at: returnDate.toISOString(),
      last_contact_at: new Date().toISOString(),
    });
    setScheduleReturnOpen(false);
    setQuickActionLead(null);
    toast.success('Retorno agendado com sucesso');
  }, [quickActionLead, handleUpdateLead]);

  const handleMeetingConfirm = useCallback(async (data: MeetingData) => {
    if (!quickActionLead) return;
    const meetingDate = new Date(data.meetingDate);
    const [hours, minutes] = data.meetingTime.split(':').map(Number);
    meetingDate.setHours(hours, minutes, 0, 0);
    const oneHourBefore = new Date(meetingDate.getTime() - 60 * 60 * 1000);

    // Check for existing meeting to avoid duplication
    const existing = await findExistingActiveMeeting(quickActionLead.id);
    let meetingRecordId: string | undefined;

    if (existing) {
      await updateExistingMeeting({
        meetingId: existing.id,
        meetingDatetime: meetingDate.toISOString(),
        title: data.meetingTitle,
        executiveName: data.executiveName,
      });
      meetingRecordId = existing.id;

      if (existing.opportunity_id) {
        await updateExistingOpportunity({
          opportunityId: existing.opportunity_id,
          meetingDatetime: meetingDate.toISOString(),
          assignedToUserId: data.executiveUserId,
        });
      } else if (currentUser?.id) {
        const { error: oppError } = await supabase.from('opportunities').insert({
          lead_id: quickActionLead.id,
          created_by_user_id: currentUser.id,
          assigned_to_user_id: data.executiveUserId,
          sdr_user_id: currentUser.id,
          meeting_datetime: meetingDate.toISOString(),
          stage: 'Demonstração',
        });
        if (oppError) {
          console.error('Error creating opportunity for existing meeting:', oppError);
          toast.error('Erro ao criar oportunidade no pipeline do Closer. Tente novamente.');
        } else {
          queryClient.invalidateQueries({ queryKey: ['leads-paginated'] });
          queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
        }
      }
    } else {
      const { data: meetingRow } = await supabase.from('meetings').insert({
        lead_id: quickActionLead.id,
        executive_name: data.executiveName,
        meeting_datetime: meetingDate.toISOString(),
        title: data.meetingTitle,
        reminder_minutes_before: data.reminderMinutesBefore,
        user_id: currentUser?.id || null,
      }).select('id').single();
      meetingRecordId = meetingRow?.id;

      if (currentUser?.id) {
        const { error: oppError } = await supabase.from('opportunities').insert({
          lead_id: quickActionLead.id,
          created_by_user_id: currentUser.id,
          assigned_to_user_id: data.executiveUserId,
          sdr_user_id: currentUser.id,
          meeting_datetime: meetingDate.toISOString(),
          stage: 'Demonstração',
        });
        if (oppError) {
          toast.error('Erro ao criar oportunidade no pipeline do Closer. Tente novamente.');
          setMeetingDialogOpen(false);
          setQuickActionLead(null);
          return;
        }
        queryClient.invalidateQueries({ queryKey: ['leads-paginated'] });
        queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
      }
    }

    handleUpdateLead({
      ...quickActionLead,
      status: 'Reunião agendada' as LeadStatus,
      next_action_at: oneHourBefore.toISOString(),
    });

    const meetingEndDate = new Date(meetingDate.getTime() + 60 * 60 * 1000);
    const attendees = (data.inviteEmails || []).map(email => ({ email }));
    const formattedDate = meetingDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedTime = meetingDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let meetLink: string | undefined;
    if (isCalendarConnected) {
      try {
        const calendarPayload = {
          summary: data.meetingTitle,
          start: { dateTime: meetingDate.toISOString() },
          end: { dateTime: meetingEndDate.toISOString() },
          attendees,
          description: `Empresa: ${quickActionLead.company}\nContato: ${quickActionLead.name}\nExecutivo: ${data.executiveName}`,
        };

        let calResult: Record<string, unknown> | undefined;
        if (existing?.google_calendar_event_id) {
          calResult = await updateCalendarEvent(existing.google_calendar_event_id, calendarPayload) as Record<string, unknown>;
        } else {
          calResult = await createCalendarEvent(calendarPayload) as Record<string, unknown>;
        }

        const entryPoints = (calResult?.conferenceData as Record<string, Record<string, string>[]> | undefined)?.entryPoints;
        meetLink = (calResult?.hangoutLink as string) || entryPoints?.find((e) => e.entryPointType === 'video')?.uri;
        if (meetingRecordId) {
          await supabase.from('meetings').update({
            meet_link: meetLink || null,
            google_calendar_event_id: (calResult?.id as string) || existing?.google_calendar_event_id || null,
          } as Record<string, unknown>).eq('id', meetingRecordId);
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

    setMeetingDialogOpen(false);
    setQuickActionLead(null);
    toast.success(existing ? 'Reunião reagendada com sucesso' : 'Reunião agendada com sucesso');
  }, [quickActionLead, currentUser, handleUpdateLead, isCalendarConnected, createCalendarEvent, updateCalendarEvent, queryClient]);

  const handleConfirmMeetingConfirm = useCallback(async () => {
    if (!quickActionLead || !currentUser) return;
    handleUpdateLead({
      ...quickActionLead,
      status: 'Oportunidade criada' as any,
      last_contact_at: new Date().toISOString(),
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

    setConfirmMeetingOpen(false);
    setQuickActionLead(null);
    toast.success('Reunião realizada! Oportunidade criada no pipeline.');
  }, [quickActionLead, currentUser, handleUpdateLead]);

  const handleSingleLostConfirm = useCallback((reason: DiscardReason) => {
    if (!quickActionLead) return;
    handleUpdateLead({
      ...quickActionLead,
      status: 'Descartado' as any,
      list_reason: reason.status,
      next_action_at: '2099-12-31T23:59:59Z',
    });
    setSingleLostDialogOpen(false);
    setQuickActionLead(null);
    toast.success('Lead marcado como perdido');
  }, [quickActionLead, handleUpdateLead]);

  const handleQuickTemperatureChange = useCallback((lead: Lead, temperature: LeadTemperature) => {
    handleUpdateLead({
      ...lead,
      temperature,
    });
    toast.success(`Score de Qualificação alterado para ${temperature === 'frio' ? 'Baixo' : temperature === 'morno' ? 'Médio' : 'Alto'}`);
  }, [handleUpdateLead]);

  const handleQuickStatusChange = useCallback((lead: Lead, status: string) => {
    const now = new Date().toISOString();
    const activeStatuses = ['Ocupado', 'Sem retorno', 'Em contato'];
    const scheduleStatuses = ['Ocupado', 'Sem retorno', 'Agendar retorno'];
    const nextAction = activeStatuses.includes(status) && (!lead.next_action_at || lead.next_action_at < now)
      ? now
      : lead.next_action_at;
    if (scheduleStatuses.includes(status)) {
      handleUpdateLead({
        ...lead,
        status: status as any,
        last_contact_at: now,
        next_action_at: nextAction,
        attempts_count: (lead.attempts_count || 0) + 1,
      });
      setQuickActionLead({ ...lead, status: status as any });
      setScheduleReturnOpen(true);
      return;
    }
    handleUpdateLead({
      ...lead,
      status: status as any,
      last_contact_at: now,
      next_action_at: nextAction,
      attempts_count: (lead.attempts_count || 0) + 1,
    });
    toast.success(`Status alterado para "${status}"`);
  }, [handleUpdateLead]);

  const handleSingleDelete = useCallback((lead: Lead) => {
    setSelectedLeadIds(new Set([lead.id]));
    setDeleteDialogOpen(true);
  }, []);

  // Send to Closer handler
  const handleSendToCloser = useCallback((lead: Lead) => {
    setSendToCloserLead(lead);
  }, []);

  const handleSendToCloserSuccess = useCallback(() => {
    invalidateAllKanban();
    queryClient.invalidateQueries({ queryKey: ['leads-paginated'] });
    queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
    queryClient.invalidateQueries({ queryKey: ['closer-opportunities-paginated'] });
    queryClient.invalidateQueries({ queryKey: ['closer-tab-counts'] });
    queryClient.invalidateQueries({ queryKey: ['closer-opportunities'] });
    setSendToCloserLead(null);
  }, [queryClient, invalidateAllKanban]);

  // Kanban move handler
  const [isKanbanMoving, setIsKanbanMoving] = useState(false);
  const handleKanbanMoveStatus = useCallback(async (leadId: string, newStatus: LeadStatus) => {
    const lead = kanbanAllLeads.find(l => l.id === leadId);
    if (!lead) return;

    // "Reunião agendada" requires the meeting dialog — same validation as Quick Action
    if (newStatus === 'Reunião agendada') {
      const { canAdvanceToMeeting } = await import('@/utils/qualificationScore');
      const advanceCheck = canAdvanceToMeeting(lead);
      if (!advanceCheck.allowed) {
        toast.error(advanceCheck.reason);
        return;
      }
      setQuickActionLead(lead);
      setMeetingDialogOpen(true);
      return; // status only changes after meeting dialog is confirmed
    }

    setIsKanbanMoving(true);
    const now = new Date().toISOString();
    const updatedLead = {
      ...lead,
      status: newStatus,
      last_contact_at: now,
      next_action_at: now,
    };

    // Optimistic cache update for both columns
    optimisticMove(leadId, lead.status, newStatus, updatedLead);

    handleUpdateLead(updatedLead);

    // Invalidate both columns after a short delay to let persist complete
    setTimeout(() => {
      setIsKanbanMoving(false);
      invalidateColumns([lead.status, newStatus]);
      queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
    }, 500);
    toast.success(`Lead movido para "${newStatus}"`);
  }, [kanbanAllLeads, handleUpdateLead, optimisticMove, invalidateColumns, queryClient]);

  const handleGlobalSearchSelect = useCallback((result: GlobalSearchResult) => {
    setGlobalSearchReadOnly(true);
    openLead(result.lead_id, result.opportunity_id || undefined);
  }, [openLead]);

  // Cockpit data from tab counts (no full dataset needed)
  const sdrCockpitData = useMemo(() => ({
    leadsToday: (stats.today || 0) + (stats.overdue || 0),
    overdueLeads: stats.overdue || 0,
    hotLeads: 0, // Would need a separate count if needed
    conversionRate: stats.total > 0 ? ((stats.confirmed || 0) / stats.total) * 100 : 0,
  }), [stats]);

  // Handle error state
  if (isLeadsError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-muted-foreground">Erro ao carregar leads.</p>
          <p className="text-xs text-muted-foreground">{(leadsError as any)?.message || 'Erro desconhecido'}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
            <Button variant="outline" size="sm" onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}>
              Fazer login novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && !paginatedResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando leads...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className={cn("bg-background", viewMode === 'kanban' ? 'h-full flex flex-col' : 'h-full')}>
        {/* Notification Permission Prompt */}
        <NotificationPermissionPrompt />
        
        {/* Notification Banner */}
        <NotificationBanner />

        {/* Lead List */}
        <main className={cn("px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4", viewMode === 'kanban' ? 'flex-1 min-h-0 flex flex-col overflow-hidden' : 'pb-20')}>
          {/* ═══ PageHeader ═══ */}
          <PageHeader
            icon={<Inbox className="h-5 w-5" />}
            title="Leads"
            count={totalFiltered}
            actions={
              <div className="flex items-center gap-2">
                {(hasPermission('access_admin')) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-medium"
                        disabled={isExportingLeads}
                        onClick={() => exportLeads({
                          tab: activeFilter,
                          sdrId: selectedSdrId === 'pending' ? 'all' : selectedSdrId,
                          search: debouncedSearch,
                          statuses: advancedFilterStatuses.size > 0 ? Array.from(advancedFilterStatuses) : null,
                        })}
                      >
                        {isExportingLeads ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Exportar para Excel</TooltipContent>
                  </Tooltip>
                )}
                
                {activeFilter !== 'discarded' && activeFilter !== 'confirmed' && (
                  <Button size="sm" className="h-8 text-xs font-medium" onClick={() => setNewLeadDialogOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    <span className="hidden sm:inline">Novo Lead</span>
                  </Button>
                )}
              </div>
            }
            toolbar={
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <LeadAdvancedFilter
                    selectedStatuses={advancedFilterStatuses}
                    onSelectedStatusesChange={setAdvancedFilterStatuses}
                    mode="sdr"
                  />
                  <ActiveFilterChips
                    selectedStatuses={advancedFilterStatuses}
                    onRemove={(s) => {
                      const next = new Set(advancedFilterStatuses);
                      next.delete(s);
                      setAdvancedFilterStatuses(next);
                    }}
                    onClearAll={() => setAdvancedFilterStatuses(new Set())}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <GlobalSearchDropdown
                    onSelect={handleGlobalSearchSelect}
                    onSearchChange={setSearchQuery}
                    placeholder="Buscar leads..."
                    className="flex-1 min-w-[140px]"
                  />
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                    <Select
                      value={selectedSdrId}
                      onValueChange={(val) => {
                        if (!canFilterBySdr && val !== 'all' && val !== 'unassigned' && val !== currentUser?.id) return;
                        setSelectedSdrId(val);
                      }}
                    >
                      <SelectTrigger className="w-[130px] sm:w-[160px] h-8 text-xs font-medium">
                        <SelectValue placeholder="Filtrar por SDR" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os SDRs</SelectItem>
                        <SelectItem value="unassigned">Não atribuídos</SelectItem>
                        {(canFilterBySdr ? sdrProfiles : visibleProfiles).map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {viewMode === 'kanban' && (
                    <Select value={kanbanSortBy} onValueChange={(v) => setKanbanSortBy(v as SDRSortOption)}>
                      <SelectTrigger className="w-[140px] h-8 text-xs font-medium">
                        <ArrowDownWideNarrow className="h-3.5 w-3.5 mr-1.5" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="next_action_asc">Próxima ação</SelectItem>
                        <SelectItem value="priority_desc">Prioridade</SelectItem>
                        <SelectItem value="created_desc">Criação</SelectItem>
                        <SelectItem value="temperature_desc">Temperatura</SelectItem>
                        <SelectItem value="last_contact_asc">Último contato</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'list' | 'kanban')} className="h-8">
                    <ToggleGroupItem value="list" aria-label="Lista" className="h-8 w-8 p-0">
                      <List className="h-3.5 w-3.5" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="kanban" aria-label="Kanban" className="h-8 w-8 p-0">
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            }
          />

          {/* ═══ Kanban or Table ═══ */}
          {viewMode === 'kanban' ? (
            <SDRKanbanView
              columns={kanbanColumns}
              visibleStatuses={kanbanVisibleStatusesMerged}
              onMoveStatus={handleKanbanMoveStatus}
              onCardClick={handleLeadClick}
              onDeleteLead={(hasPermission('access_admin')) ? handleSingleDelete : undefined}
              onSendToCloser={(hasPermission('access_admin')) ? handleSendToCloser : undefined}
              getLeadHref={(lead) => `/leads?lead=${lead.id}`}
              isMoving={isKanbanMoving}
              isLoading={isKanbanLoading}
              currentUserId={currentUser?.id ?? null}
              canManage={hasPermission('access_admin')}
              onLoadMore={handleKanbanLoadMore}
            />
          ) : (
            <>
              {/* ═══ Lead Table ═══ */}
              <div className="bg-card rounded-lg border shadow-sm overflow-x-auto">
                <LeadTableHeader
                  showCheckbox={canBulkSelect}
                  allChecked={displayedLeads.length > 0 && displayedLeads.every(l => selectedLeadIds.has(l.id))}
                  onCheckAllChange={handleCheckAllChange}
                />
                
                {displayedLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Inbox className="h-10 w-10 text-muted-foreground/30 mb-4" />
                    <h3 className="text-sm font-medium text-foreground mb-1">
                      Nenhum lead encontrado
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Não há leads nesta categoria
                    </p>
                    <Button size="sm" className="h-8 text-xs" onClick={() => setNewLeadDialogOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Adicionar Lead
                    </Button>
                  </div>
                ) : (
                  displayedLeads.map((lead) => (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      onClick={handleLeadClick}
                      href={`/leads?lead=${lead.id}`}
                      isSelected={selectedLead?.id === lead.id && drawerOpen}
                      showCheckbox={canBulkSelect}
                      isChecked={selectedLeadIds.has(lead.id)}
                      onCheckChange={handleLeadCheckChange}
                      canEditSdr={isManager || !lead.owner_user_id || lead.owner_user_id === currentUser?.id}
                      selfAssignOnly={!isManager && !lead.owner_user_id}
                      sdrOnly={!isManager && lead.owner_user_id === currentUser?.id}
                      onScheduleReturn={handleQuickScheduleReturn}
                      onScheduleMeeting={handleQuickScheduleMeeting}
                      onConfirmMeeting={handleQuickConfirmMeeting}
                      onMarkLost={handleQuickMarkLost}
                      onRescheduleMeeting={handleQuickRescheduleMeeting}
                      onTemperatureChange={handleQuickTemperatureChange}
                      onStatusChange={handleQuickStatusChange}
                      onDelete={(hasPermission('access_admin')) ? handleSingleDelete : undefined}
                      onSendToCloser={(hasPermission('access_admin')) ? handleSendToCloser : undefined}
                    />
                  ))
                )}
              </div>

              {/* ═══ Pagination ═══ */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Mostrar</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      const num = Number(value);
                      setItemsPerPage(num);
                      localStorage.setItem('sdr_items_per_page', value);
                    }}
                  >
                    <SelectTrigger className="w-[70px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>por página</span>
                </div>

                <div className="text-xs text-muted-foreground">
                  Mostrando {displayedLeads.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} a {Math.min(currentPage * itemsPerPage, totalFiltered)} de {totalFiltered} leads
                </div>

                {totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              onClick={() => setCurrentPage(pageNum)}
                              isActive={currentPage === pageNum}
                              className="cursor-pointer"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      
                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </div>
            </>
          )}
        </main>

      {/* Lead Modal */}
      <LeadModal
        lead={selectedLead}
        open={drawerOpen}
        onClose={() => { closeLead(); setGlobalSearchReadOnly(false); }}
        onUpdateLead={handleUpdateLead}
        mode={modalOpp ? 'closer' : 'sdr'}
        opportunity={modalOpp as any}
        onOpportunityStageChange={() => {}}
        readOnly={globalSearchReadOnly}
      />

      {/* New Lead Dialog */}
      <NewLeadDialog
        open={newLeadDialogOpen}
        onOpenChange={setNewLeadDialogOpen}
        onLeadCreated={(leadId) => {
          setSearchParams({ lead: leadId }, { replace: true });
          queryClient.invalidateQueries({ queryKey: ['leads-paginated'] });
          queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
        }}
      />

      {/* Bulk Actions Bar */}
      {canBulkSelect && (
        <BulkActionsBar
          selectedCount={selectedLeadIds.size}
          totalCount={displayedLeads.length}
          totalFilteredCount={totalFiltered}
          allFilteredSelected={allFilteredSelected}
          isLoadingSelection={isLoadingSelection}
          onSelectAll={handleSelectAll}
          onSelectAllFiltered={handleSelectAllFiltered}
          onSelectCustomCount={handleSelectCustomCount}
          onDeselectAll={handleDeselectAll}
          onReassign={canBulkReassign ? () => setReassignDialogOpen(true) : undefined}
          onDelete={(hasPermission('access_admin')) ? () => setDeleteDialogOpen(true) : undefined}
          onDiscard={() => setBulkDiscardDialogOpen(true)}
          showDelete={hasPermission('access_admin')}
          showReassign={canBulkReassign}
          showDiscard={true}
        />
      )}

      {/* Lead Reassign Dialog */}
      <LeadReassignDialog
        open={reassignDialogOpen}
        onOpenChange={setReassignDialogOpen}
        selectedLeadIds={Array.from(selectedLeadIds)}
        onReassignComplete={handleReassignComplete}
      />

      {/* Bulk Delete Dialog - only for admin */}
      <DeleteLeadDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        leadCount={selectedLeadIds.size}
        onConfirm={handleBulkDelete}
        isDeleting={bulkDeleteMutation.isPending}
      />

      {/* Bulk Discard Dialog */}
      <LostReasonDialog
        open={bulkDiscardDialogOpen}
        onOpenChange={setBulkDiscardDialogOpen}
        onConfirm={handleBulkDiscard}
        selectedCount={selectedLeadIds.size}
      />

      {/* Quick Action Dialogs */}
      <ScheduleReturnDialog
        open={scheduleReturnOpen}
        onOpenChange={setScheduleReturnOpen}
        onConfirm={handleScheduleReturnConfirm}
      />

      <MeetingConfirmationDialog
        open={meetingDialogOpen}
        onOpenChange={setMeetingDialogOpen}
        onConfirm={handleMeetingConfirm}
        companyName={quickActionLead?.razao_social || quickActionLead?.company || ''}
        contactEmail={quickActionLead?.email || undefined}
      />

      <MeetingConfirmedDialog
        open={confirmMeetingOpen}
        onOpenChange={setConfirmMeetingOpen}
        onConfirm={handleConfirmMeetingConfirm}
        companyName={quickActionLead?.razao_social || quickActionLead?.company || ''}
      />

      <LostReasonDialog
        open={singleLostDialogOpen}
        onOpenChange={setSingleLostDialogOpen}
        onConfirm={handleSingleLostConfirm}
      />

      {/* Send to Closer Dialog */}
      <SendToCloserDialog
        open={!!sendToCloserLead}
        onOpenChange={(open) => { if (!open) setSendToCloserLead(null); }}
        leadId={sendToCloserLead?.id || ''}
        leadName={sendToCloserLead?.company || sendToCloserLead?.name || ''}
        onSuccess={handleSendToCloserSuccess}
      />
      </div>
    </AppLayout>
  );
};

export default LeadInbox;
