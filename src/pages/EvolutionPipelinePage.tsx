import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { useLeadModal } from '@/hooks/useLeadModal';
import { Link } from 'react-router-dom';
import { CloserKanbanView } from '@/components/closer/CloserKanbanView';
import { CloserTableView } from '@/components/closer/CloserTableView';
import { FieldConfig, ProjectViewConfig, loadFieldConfig, saveFieldConfig } from '@/components/projects/ProjectViewConfig';
import { PageHeader } from '@/components/PageHeader';
import { ProjectChecklist } from '@/components/projects/ProjectChecklist';
import { useCloserPipelinePaginated, useCloserTabCounts, useCloserMutations } from '@/hooks/useCloserPipeline';
import { useCloserKanbanByStage } from '@/hooks/useCloserKanbanByStage';
import { CloserStage, CloserOpportunity, bulkDeleteOpportunities } from '@/services/closerService';
import { useEvolutionStages } from '@/hooks/useEvolutionStages';
import { isDealStuck } from '@/utils/behavioralScore';
import { formatTimeAgo, formatNextAction } from '@/utils/priorityCalculator';
import { LeadTemperature } from '@/types/lead';
import { buildLeadFromOpportunity } from '@/utils/leadEmailHelper';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePermissions } from '@/hooks/usePermissions';
import { CloserSelector } from '@/components/CloserSelector';
import { useUpdateLead } from '@/hooks/useLeads';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { fetchLeadById } from '@/services/leadService';
import { LeadModal } from '@/components/LeadModal';
import { NewDealFromClientDialog } from '@/components/closer/NewDealFromClientDialog';
import { Lead } from '@/types/lead';

import { LeadAdvancedFilter, ActiveFilterChips } from '@/components/LeadAdvancedFilter';
import { BulkActionsBar } from '@/components/BulkActionsBar';
import { DeleteLeadDialog } from '@/components/DeleteLeadDialog';
import { LeadReassignDialog } from '@/components/LeadReassignDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
} from '@/components/ui/pagination';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Loader2,
  Search,
  LayoutList,
  LayoutGrid,
  MoreHorizontal,
  RotateCcw,
  Trophy,
  XCircle,
  Building2,
  Users,
  Plus,
  Filter,
  X,
  StickyNote,
  Trash2,
  Download,
  TrendingUp,
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { AppLayout } from '@/components/AppLayout';
import { GlobalSearchDropdown, GlobalSearchResult } from '@/components/GlobalSearchDropdown';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CloserDateRangeFilter } from '@/components/closer/CloserDateRangeFilter';
import { useExportOpportunitiesToExcel } from '@/hooks/useExportToExcel';

type CloserTab = 'oportunidades' | 'reunioes' | 'vendas';
type CloserViewMode = 'list' | 'kanban';
type SortOption = 'value_desc' | 'created_desc' | 'next_action_asc' | 'temperature_desc' | 'last_contact_asc';

const KANBAN_CARD_DEFAULTS: FieldConfig[] = [
  { id: 'company', label: 'Empresa', visible: true, required: true },
  { id: 'contact', label: 'Contato', visible: true },
  { id: 'deal_value', label: 'Valor', visible: true },
  { id: 'temperature', label: 'Temperatura', visible: true },
  { id: 'meeting', label: 'Reunião', visible: true },
  { id: 'next_action', label: 'Próxima Ação', visible: true },
  { id: 'sdr', label: 'SDR', visible: false },
  { id: 'closer', label: 'Closer', visible: false },
  { id: 'updated_at', label: 'Atualizado em', visible: false },
  { id: 'notes', label: 'Notas', visible: false },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'value_desc', label: 'Valor (maior)' },
  { value: 'created_desc', label: 'Criação (recente)' },
  { value: 'next_action_asc', label: 'Ação (urgente)' },
  { value: 'temperature_desc', label: 'Temperatura (quente)' },
  { value: 'last_contact_asc', label: 'Contato (antigo)' },
];

// Stages are now dynamic via useEvolutionStages hook inside the component

const RETURN_OPTIONS = [
  'Cliente não entrou na reunião',
  'Cliente entrou mas decidiu remarcar',
  'Outro',
];

const EvolutionPipelinePage = () => {
  const { user: currentUser } = useCurrentUser();
  const { hasPermission } = usePermissions();
  const isMobile = useIsMobile();
  const canFilterByCloser = hasPermission('access_admin');
  const { stages: evoStages, activeStages: evoActiveStages, allStagesSet: ALL_EVO_STAGES_SET, defaultOppFilter } = useEvolutionStages();

  const { moveStage, returnToSdr, markLost, markWon, updateNotes, invalidateAll } = useCloserMutations();
  const updateLeadMutation = useUpdateLead();
  const queryClient = useQueryClient();
  const { exportOpportunities, isExporting: isExportingOpps } = useExportOpportunitiesToExcel();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);
  const [activeTab, setActiveTab] = useState<CloserTab>('oportunidades');
  const [advancedFilterStatuses, setAdvancedFilterStatuses] = useState<Set<string>>(new Set());
  const [wonDateRange, setWonDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });

  // Sync default filter when stages load from DB
  useEffect(() => {
    if (defaultOppFilter.size > 0 && advancedFilterStatuses.size === 0) {
      setAdvancedFilterStatuses(defaultOppFilter);
    }
  }, [defaultOppFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedCloserId, setSelectedCloserId] = useState('pending');
  const [viewMode, setViewMode] = useState<CloserViewMode>(() => {
    return (localStorage.getItem('evo_view_mode') as CloserViewMode) || 'list';
  });
  const [kanbanSortBy, setKanbanSortBy] = useState<SortOption>(() => {
    return (localStorage.getItem('evo_kanban_sort') as SortOption) || 'value_desc';
  });
  const [kanbanCardFields, setKanbanCardFields] = useState<FieldConfig[]>(() =>
    loadFieldConfig('evo-kanban', KANBAN_CARD_DEFAULTS)
  );

  const closerDefaultSet = useRef(false);
  useEffect(() => {
    if (!closerDefaultSet.current && currentUser?.id) {
      setSelectedCloserId(hasPermission('access_admin') ? 'all' : currentUser.id);
      closerDefaultSet.current = true;
    }
  }, [currentUser?.id, hasPermission]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('evo_items_per_page');
    return saved ? Number(saved) : 20;
  });

  const closerIdParam = selectedCloserId === 'all' || selectedCloserId === 'pending'
    ? null
    : selectedCloserId === 'unassigned'
      ? '00000000-0000-0000-0000-000000000000'
      : selectedCloserId;

  const stagesParam = useMemo(() => {
    if (activeTab === 'oportunidades' && advancedFilterStatuses.size > 0) {
      return Array.from(advancedFilterStatuses);
    }
    return undefined;
  }, [activeTab, advancedFilterStatuses]);

  const { opportunities: paginatedOpps, total: totalResults, isLoading, isFetching } = useCloserPipelinePaginated({
    tab: activeTab,
    closerId: closerIdParam,
    search: debouncedSearch,
    stages: stagesParam,
    meetingFrom: null,
    meetingTo: null,
    wonFrom: activeTab === 'vendas' && wonDateRange.from ? startOfDay(wonDateRange.from).toISOString() : null,
    wonTo: activeTab === 'vendas' && wonDateRange.to ? endOfDay(wonDateRange.to).toISOString() : null,
    page: currentPage,
    pageSize: itemsPerPage,
    opportunityType: 'evolution',
  });

  const tabCounts = useCloserTabCounts(closerIdParam, 'evolution');

  const isKanbanActive = viewMode === 'kanban' && activeTab === 'oportunidades';
  const [kanbanColumnPages, setKanbanColumnPages] = useState<Record<string, number>>({});
  const handleKanbanLoadMore = useCallback((stage: string) => {
    setKanbanColumnPages((prev) => ({ ...prev, [stage]: (prev[stage] ?? 1) + 1 }));
  }, []);
  const kanbanVisibleStages = advancedFilterStatuses.size > 0 ? advancedFilterStatuses : ALL_EVO_STAGES_SET;
  const { columns: kanbanColumns, isLoading: kanbanLoading } = useCloserKanbanByStage({
    closerId: closerIdParam,
    search: debouncedSearch,
    sortBy: kanbanSortBy,
    opportunityType: 'evolution',
    orderedStages: evoActiveStages,
    visibleStages: kanbanVisibleStages,
    enabled: isKanbanActive && selectedCloserId !== 'pending',
    columnPages: kanbanColumnPages,
  });

  const totalPages = Math.ceil(totalResults / itemsPerPage);

  const { lead: modalLead, opportunity: modalOpp, isOpen: leadModalOpen, openLead, closeLead } = useLeadModal();

  const [globalSearchReadOnly, setGlobalSearchReadOnly] = useState(false);
  const [newDealDialogOpen, setNewDealDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checklistOpp, setChecklistOpp] = useState<CloserOpportunity | null>(null);
  const [selectedOpp, setSelectedOpp] = useState<CloserOpportunity | null>(null);
  const [reason, setReason] = useState('');
  const [returnSelected, setReturnSelected] = useState('');
  const [notes, setNotes] = useState('');
  const [detectedProjectType, setDetectedProjectType] = useState<string | null>(null);

  const canBulkSelect = hasPermission('access_admin');
  const [selectedOppIds, setSelectedOppIds] = useState<Set<string>>(new Set());
  const [allFilteredSelected, setAllFilteredSelected] = useState(false);
  const [isLoadingSelection, setIsLoadingSelection] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setSelectedOppIds(new Set());
    setAllFilteredSelected(false);
  }, [advancedFilterStatuses, debouncedSearch, activeTab]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab as CloserTab);
    setCurrentPage(1);
    setSelectedOppIds(new Set());
    setAllFilteredSelected(false);
  }, []);

  const handleOppCheckChange = useCallback((oppId: string, checked: boolean) => {
    setSelectedOppIds(prev => {
      const newSet = new Set(prev);
      if (checked) newSet.add(oppId); else newSet.delete(oppId);
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedOppIds(new Set(paginatedOpps.map(o => o.id)));
    setAllFilteredSelected(false);
  }, [paginatedOpps]);

  const handleDeselectAll = useCallback(() => {
    setSelectedOppIds(new Set());
    setAllFilteredSelected(false);
  }, []);

  const fetchAllFilteredOppIds = useCallback(async (limit?: number) => {
    setIsLoadingSelection(true);
    try {
      const { data, error } = await supabase.rpc('get_filtered_opportunity_ids', {
        p_tab: activeTab,
        p_closer_id: closerIdParam,
        p_search: debouncedSearch.trim(),
        p_stages: stagesParam || null,
        p_meeting_from: null,
        p_meeting_to: null,
        p_won_from: activeTab === 'vendas' && wonDateRange.from ? startOfDay(wonDateRange.from).toISOString() : null,
        p_won_to: activeTab === 'vendas' && wonDateRange.to ? endOfDay(wonDateRange.to).toISOString() : null,
        p_limit: limit || null,
        p_opportunity_type: 'evolution',
      } as any);
      if (error) throw error;
      return (data as string[]) || [];
    } catch (err) {
      console.error('Error fetching all filtered opp IDs:', err);
      return [];
    } finally {
      setIsLoadingSelection(false);
    }
  }, [activeTab, closerIdParam, debouncedSearch, stagesParam, wonDateRange]);

  const handleSelectAllFiltered = useCallback(async () => {
    const ids = await fetchAllFilteredOppIds();
    setSelectedOppIds(new Set(ids));
    setAllFilteredSelected(true);
  }, [fetchAllFilteredOppIds]);

  const handleSelectCustomCount = useCallback(async (count: number) => {
    const ids = await fetchAllFilteredOppIds(count);
    setSelectedOppIds(new Set(ids));
    setAllFilteredSelected(false);
  }, [fetchAllFilteredOppIds]);

  const handleCheckAllChange = useCallback((checked: boolean) => {
    if (checked) setSelectedOppIds(new Set(paginatedOpps.map(o => o.id)));
    else setSelectedOppIds(new Set());
  }, [paginatedOpps]);

  const handleBulkDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await bulkDeleteOpportunities(Array.from(selectedOppIds));
      toast.success(`${selectedOppIds.size} evolução(ões) excluída(s)`);
      setSelectedOppIds(new Set());
      setAllFilteredSelected(false);
      setDeleteDialogOpen(false);
      invalidateAll();
    } catch {
      toast.error('Erro ao excluir evoluções');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedOppIds, invalidateAll]);

  const handleOpenSingleDelete = useCallback((opp: CloserOpportunity) => {
    setSelectedOppIds(new Set([opp.id]));
    setDeleteDialogOpen(true);
  }, []);

  const handleReassignComplete = useCallback(() => {
    setSelectedOppIds(new Set());
    setAllFilteredSelected(false);
    invalidateAll();
  }, [invalidateAll]);

  const handleOpenReturn = useCallback((opp: CloserOpportunity) => {
    setSelectedOpp(opp);
    setReason('');
    setReturnSelected('');
    setReturnDialogOpen(true);
  }, []);

  const handleOpenLost = useCallback((opp: CloserOpportunity) => {
    setSelectedOpp(opp);
    setReason('');
    setLostDialogOpen(true);
  }, []);

  const handleOpenNotes = useCallback((opp: CloserOpportunity) => {
    setSelectedOpp(opp);
    setNotes(opp.closer_notes || '');
    setNotesDialogOpen(true);
  }, []);

  const handleOpenChecklist = useCallback(async (opp: CloserOpportunity) => {
    setDetectedProjectType('evolucao');
    setChecklistOpp(opp);
    setChecklistOpen(true);
  }, []);

  const handleChecklistSuccess = useCallback(() => {
    if (checklistOpp) markWon.mutate(checklistOpp.id);
  }, [checklistOpp, markWon]);

  const getOppHref = useCallback((opp: CloserOpportunity) => {
    return `/closer/evolucao?lead=${opp.lead_id}&opp=${opp.id}`;
  }, []);

  const handleOpenLeadModal = useCallback((opp: CloserOpportunity) => {
    setGlobalSearchReadOnly(false);
    openLead(opp.lead_id, opp.id);
  }, [openLead]);

  const handleGlobalSearchSelect = useCallback((result: GlobalSearchResult) => {
    setGlobalSearchReadOnly(true);
    openLead(result.lead_id, result.opportunity_id || undefined);
  }, [openLead]);

  const handleUpdateLead = useCallback((updatedLead: Lead) => {
    queryClient.setQueryData(['lead-by-id', updatedLead.id], updatedLead);
    updateLeadMutation.mutate(
      { id: updatedLead.id, updates: updatedLead },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          queryClient.invalidateQueries({ queryKey: ['lead-by-id', updatedLead.id] });
        },
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Erro ao atualizar lead';
          toast.error(message);
        },
      }
    );
  }, [queryClient, updateLeadMutation]);

  const { data: closerProfiles = [] } = useQuery({
    queryKey: ['closer-filter-profiles'],
    queryFn: async () => {
      const { data: opps } = await supabase
        .from('opportunities')
        .select('assigned_to_user_id')
        .eq('returned_to_sdr', false)
        .not('assigned_to_user_id', 'is', null);
      if (!opps || opps.length === 0) return [];
      const userIds = [...new Set(opps.map(o => o.assigned_to_user_id).filter(Boolean))] as string[];
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds)
        .eq('active', true)
        .order('name');
      return profiles || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className={cn("bg-background", viewMode === 'kanban' && activeTab === 'oportunidades' ? 'h-full flex flex-col' : 'h-full')}>
        <main className={cn("px-4 py-4", viewMode === 'kanban' && activeTab === 'oportunidades' ? 'flex-1 min-h-0 flex flex-col overflow-hidden' : 'pb-20')}>

          {/* === DESKTOP LAYOUT === */}
          <div className={cn("flex flex-col", viewMode === 'kanban' && activeTab === 'oportunidades' ? 'flex-1 min-h-0' : '')}>
            <PageHeader
              icon={<TrendingUp className="h-5 w-5" />}
              title="Evoluções"
              actions={
                <div className="flex items-center gap-2">
                  {(hasPermission('access_admin')) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-medium"
                          disabled={isExportingOpps}
                          onClick={() => exportOpportunities({
                            tab: activeTab,
                            closerId: selectedCloserId === 'pending' ? 'all' : selectedCloserId,
                            search: debouncedSearch,
                            stages: stagesParam,
                            meetingFrom: null,
                            meetingTo: null,
                            wonFrom: activeTab === 'vendas' && wonDateRange.from ? startOfDay(wonDateRange.from).toISOString() : null,
                            wonTo: activeTab === 'vendas' && wonDateRange.to ? endOfDay(wonDateRange.to).toISOString() : null,
                          })}
                        >
                          {isExportingOpps ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Exportar para Excel</TooltipContent>
                    </Tooltip>
                  )}
                  <Button size="sm" className="h-8 text-xs font-medium" onClick={() => setNewDealDialogOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    <span className="hidden sm:inline">Nova Evolução</span>
                  </Button>
                </div>
              }
              toolbar={
                <div className="space-y-3">
                  <Tabs value={activeTab} onValueChange={handleTabChange}>
                    <TabsList className="h-9">
                      <TabsTrigger value="oportunidades" className="text-xs gap-1.5 px-4">
                        Evoluções
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{tabCounts.oportunidades}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="vendas" className="text-xs gap-1.5 px-4">
                        Ganhas
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{tabCounts.vendas}</Badge>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {activeTab === 'vendas' && (
                    <CloserDateRangeFilter dateRange={wonDateRange} onDateRangeChange={setWonDateRange} label="Ganho em" />
                  )}

                  <div className="flex items-center gap-2">
                    <GlobalSearchDropdown
                      onSelect={handleGlobalSearchSelect}
                      onSearchChange={setSearchQuery}
                      placeholder="Buscar leads e oportunidades..."
                      className="flex-1 min-w-[140px]"
                    />
                    {canFilterByCloser && (
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                        <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
                          <SelectTrigger className="w-[130px] sm:w-[160px] h-8 text-xs font-medium">
                            <SelectValue placeholder="Filtrar por Closer" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os Closers</SelectItem>
                            <SelectItem value="unassigned">Não atribuídos</SelectItem>
                            {closerProfiles.map((profile) => (
                              <SelectItem key={profile.id} value={profile.id}>{profile.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {activeTab === 'oportunidades' && (
                      <>
                        {viewMode === 'kanban' && (
                          <>
                            <Select value={kanbanSortBy} onValueChange={(v) => { setKanbanSortBy(v as SortOption); localStorage.setItem('evo_kanban_sort', v); }}>
                              <SelectTrigger className="w-[140px] h-8 text-xs font-medium">
                                <SelectValue placeholder="Classificar" />
                              </SelectTrigger>
                              <SelectContent>
                                {SORT_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <ProjectViewConfig
                              title="Campos do Card"
                              fields={kanbanCardFields}
                              onFieldsChange={(f) => { setKanbanCardFields(f); saveFieldConfig('evo-kanban', f); }}
                              defaultFields={KANBAN_CARD_DEFAULTS}
                            />
                          </>
                        )}
                        <div className="flex items-center border border-border/60 rounded-md overflow-hidden">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => { setViewMode('list'); localStorage.setItem('evo_view_mode', 'list'); }}>
                                <LayoutList className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Lista</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => { setViewMode('kanban'); localStorage.setItem('evo_view_mode', 'kanban'); }}>
                                <LayoutGrid className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Kanban</TooltipContent>
                          </Tooltip>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              }
            />

            {viewMode === 'kanban' && activeTab === 'oportunidades' && (
              <CloserKanbanView
                columns={kanbanColumns}
                visibleStages={kanbanVisibleStages}
                cardFields={kanbanCardFields}
                sortBy={kanbanSortBy}
                onMoveStage={(id, stage) => moveStage.mutate({ id, stage })}
                onCardClick={handleOpenLeadModal}
                onDeleteOpp={(hasPermission('access_admin')) ? handleOpenSingleDelete : undefined}
                getOppHref={getOppHref}
                isMoving={moveStage.isPending}
                isLoading={kanbanLoading}
                currentUserId={currentUser?.id ?? null}
                canManage={hasPermission('access_admin')}
                pipelineKey="evolution"
                onLoadMore={handleKanbanLoadMore}
              />
            )}

            {(viewMode === 'list' || activeTab !== 'oportunidades') && (
              <>
                <CloserTableView
                  opportunities={paginatedOpps}
                  canBulkSelect={canBulkSelect}
                  canManage={hasPermission('access_admin')}
                  selectedOppIds={selectedOppIds}
                  onOppCheckChange={handleOppCheckChange}
                  onCheckAllChange={handleCheckAllChange}
                  onCardClick={handleOpenLeadModal}
                  getOppHref={getOppHref}
                  onReturn={handleOpenReturn}
                  onLost={handleOpenLost}
                  onNotes={handleOpenNotes}
                  onWon={handleOpenChecklist}
                  onDelete={(hasPermission('access_admin')) ? handleOpenSingleDelete : undefined}
                  onStageChange={(id, stage) => moveStage.mutate({ id, stage })}
                  tab={activeTab}
                />

                {totalResults > 0 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Mostrar</span>
                      <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); localStorage.setItem('evo_items_per_page', v); }}>
                        <SelectTrigger className="w-20 h-8 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                      <span>por página</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, totalResults)} de {totalResults}
                      </span>
                      {totalPages > 1 && (
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p - 1))} />
                            </PaginationItem>
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(page => (
                              <PaginationItem key={page}>
                                <PaginationLink isActive={page === currentPage} onClick={() => setCurrentPage(page)}>
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            ))}
                            <PaginationItem>
                              <PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* Return to SDR Dialog */}
        <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
          <DialogContent className="bg-card sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Devolver Lead ao SDR</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Label>Motivo da devolução *</Label>
              <div className="space-y-2">
                {RETURN_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => { setReason(option === 'Outro' ? '' : option); setReturnSelected(option); }}
                    className={cn(
                      "w-full text-left text-sm py-2.5 px-3 rounded-md border transition-all",
                      returnSelected === option
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-card border-border hover:border-primary/50 hover:bg-muted/50'
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {returnSelected === 'Outro' && (
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Descreva o motivo..." className="min-h-[80px] bg-background" autoFocus />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setReturnDialogOpen(false); setReturnSelected(''); }}>Cancelar</Button>
              <Button
                disabled={!returnSelected || (returnSelected === 'Outro' && !reason.trim())}
                onClick={() => {
                  if (selectedOpp) {
                    const finalReason = returnSelected === 'Outro' ? reason : returnSelected;
                    returnToSdr.mutate({ id: selectedOpp.id, reason: finalReason });
                  }
                  setReturnDialogOpen(false);
                  setReturnSelected('');
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Devolver
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lost Dialog */}
        <Dialog open={lostDialogOpen} onOpenChange={setLostDialogOpen}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle>Marcar como Perdido</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Label>Motivo da perda *</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Sem budget, escolheu concorrente, timing errado..." className="bg-background" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLostDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" disabled={!reason.trim()} onClick={() => { if (selectedOpp) markLost.mutate({ id: selectedOpp.id, reason }); setLostDialogOpen(false); }}>
                <XCircle className="h-4 w-4 mr-2" />
                Confirmar Perda
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Notes Dialog */}
        <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle>Notas - {selectedOpp?.lead_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Adicione observações..." className="bg-background min-h-[120px]" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => { if (selectedOpp) updateNotes.mutate({ id: selectedOpp.id, notes }); setNotesDialogOpen(false); }}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {canBulkSelect && (
          <BulkActionsBar
            selectedCount={selectedOppIds.size}
            totalCount={paginatedOpps.length}
            totalFilteredCount={totalResults}
            allFilteredSelected={allFilteredSelected}
            isLoadingSelection={isLoadingSelection}
            onSelectAll={handleSelectAll}
            onSelectAllFiltered={handleSelectAllFiltered}
            onSelectCustomCount={handleSelectCustomCount}
            onDeselectAll={handleDeselectAll}
            onReassign={() => setReassignDialogOpen(true)}
            onDelete={() => setDeleteDialogOpen(true)}
            showDelete={hasPermission('access_admin')}
          />
        )}

        <LeadReassignDialog
          open={reassignDialogOpen}
          onOpenChange={setReassignDialogOpen}
          selectedLeadIds={Array.from(selectedOppIds)}
          onReassignComplete={handleReassignComplete}
          mode="closer"
        />

        <DeleteLeadDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          leadCount={selectedOppIds.size}
          onConfirm={handleBulkDelete}
          isDeleting={isDeleting}
          entityLabel="Evolução"
        />

        <LeadModal
          lead={modalLead}
          open={leadModalOpen}
          onClose={() => { closeLead(); setGlobalSearchReadOnly(false); }}
          onUpdateLead={handleUpdateLead}
          mode={modalOpp ? 'closer' : 'sdr'}
          opportunity={modalOpp as any}
          onOpportunityStageChange={() => { invalidateAll(); }}
          readOnly={globalSearchReadOnly}
        />

        <NewDealFromClientDialog
          open={newDealDialogOpen}
          onOpenChange={setNewDealDialogOpen}
          onSuccess={(leadId, oppId) => { openLead(leadId, oppId); }}
          opportunityType="evolution"
        />
        {checklistOpp && (
          <ProjectChecklist
            open={checklistOpen}
            onOpenChange={setChecklistOpen}
            opportunity={checklistOpp}
            onSuccess={handleChecklistSuccess}
            defaultProjectType={detectedProjectType as any}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default EvolutionPipelinePage;
