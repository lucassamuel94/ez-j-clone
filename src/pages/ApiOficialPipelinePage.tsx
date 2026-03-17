import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useApiOficialDeals, useApiOficialMutations } from '@/hooks/useApiOficialPipeline';
import { ApiOficialDeal } from '@/services/apiOficialService';
import { usePipelineStatuses } from '@/hooks/usePipelineStatuses';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePermissions } from '@/hooks/usePermissions';
import { ProjectChecklist } from '@/components/projects/ProjectChecklist';
import { FieldConfig, ProjectViewConfig, loadFieldConfig, saveFieldConfig } from '@/components/projects/ProjectViewConfig';
import { CloserOpportunity } from '@/services/closerService';
import { NewApiOficialDealDialog } from '@/components/closer/NewApiOficialDealDialog';
import { BulkActionsBar } from '@/components/BulkActionsBar';
import { DeleteLeadDialog } from '@/components/DeleteLeadDialog';
import { LeadReassignDialog } from '@/components/LeadReassignDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLeadModal } from '@/hooks/useLeadModal';
import { LeadModal } from '@/components/LeadModal';
import { useUpdateLead } from '@/hooks/useLeads';
import { Lead } from '@/types/lead';

import {
  KanbanProvider,
  KanbanBoard,
  KanbanCard as KanbanDndCard,
  KanbanCards,
  KanbanOverlay,
} from '@/components/kibo-ui/kanban';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { GlobalSearchDropdown, GlobalSearchResult } from '@/components/GlobalSearchDropdown';
import { LeadAdvancedFilter, ActiveFilterChips } from '@/components/LeadAdvancedFilter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  LayoutList,
  LayoutGrid,
  MoreHorizontal,
  XCircle,
  StickyNote,
  ShieldCheck,
  Phone,
  Plus,
  Users,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = 'list' | 'kanban';
type ApiTab = 'ativos' | 'finalizados';
type SortOption = 'created_desc' | 'updated_desc' | 'company_asc';

// ─── Constants ───────────────────────────────────────────────────────────────

const TERMINAL_STAGES = new Set(['Não quer agora', 'Enviar Pós Venda']);

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'created_desc', label: 'Criação (recente)' },
  { value: 'updated_desc', label: 'Atualização (recente)' },
  { value: 'company_asc', label: 'Empresa (A-Z)' },
];

const KANBAN_CARD_DEFAULTS: FieldConfig[] = [
  { id: 'company', label: 'Empresa', visible: true, required: true },
  { id: 'contact', label: 'Contato', visible: true },
  { id: 'cnpj', label: 'CNPJ', visible: true },
  { id: 'phone', label: 'Telefone', visible: true },
  { id: 'closer', label: 'Closer', visible: true },
  { id: 'updated_at', label: 'Atualização', visible: true },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sortDeals(deals: ApiOficialDeal[], sortBy: SortOption): ApiOficialDeal[] {
  return [...deals].sort((a, b) => {
    if (sortBy === 'created_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === 'updated_desc') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    if (sortBy === 'company_asc') return (a.lead_company || a.lead_name || '').localeCompare(b.lead_company || b.lead_name || '');
    return 0;
  });
}

// ─── Kanban card ─────────────────────────────────────────────────────────────

const ApiOficialCardContent = memo(({ deal, cardFields }: { deal: ApiOficialDeal; cardFields: FieldConfig[] }) => {
  const isVisible = (id: string) => cardFields.find(f => f.id === id)?.visible !== false;
  const timeAgo = formatDistanceToNow(new Date(deal.updated_at), { addSuffix: false, locale: ptBR });

  return (
    <div className="px-3 py-2.5 space-y-1.5">
      {isVisible('company') && (
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate flex-1 leading-tight">
            {deal.lead_company || deal.lead_name || 'Sem nome'}
          </span>
        </div>
      )}

      {isVisible('contact') && deal.lead_name && deal.lead_company && (
        <span className="text-xs text-foreground/70 truncate max-w-[140px] block">
          Contato: {deal.lead_name}
        </span>
      )}

      {isVisible('cnpj') && deal.lead_cnpj && (
        <span className="text-[10px] text-muted-foreground font-mono block">{deal.lead_cnpj}</span>
      )}

      {isVisible('phone') && deal.lead_phone && (
        <div className="flex items-center gap-1 text-[11px] text-foreground/70">
          <Phone className="h-2.5 w-2.5" />
          {deal.lead_phone}
        </div>
      )}

      {isVisible('closer') && deal.closer_name && (
        <div className="text-[11px] text-foreground/50">Closer: {deal.closer_name}</div>
      )}

      {isVisible('updated_at') && (
        <div className="text-[10px] text-foreground/50">Última atualização: {timeAgo}</div>
      )}
    </div>
  );
});
ApiOficialCardContent.displayName = 'ApiOficialCardContent';

// ─── Page ─────────────────────────────────────────────────────────────────────

const ApiOficialPipelinePage = () => {
  const { user: currentUser } = useCurrentUser();
  const { hasPermission } = usePermissions();
  const canFilterByCloser = hasPermission('access_admin');
  const canBulkSelect = hasPermission('access_admin');

  const { moveStage, lostMutation, updateNotes, createDeal, deleteDeal, invalidateAll } = useApiOficialMutations();
  const { getStatusesForPipeline, getColorMap } = usePipelineStatuses();
  const { lead: modalLead, isOpen: leadModalOpen, openLead, closeLead } = useLeadModal();
  const updateLeadMutation = useUpdateLead();
  const queryClient = useQueryClient();

  // Closer profiles for filter
  const { data: closerProfiles = [] } = useQuery({
    queryKey: ['closer-profiles-filter'],
    queryFn: async () => {
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['closer', 'admin', 'manager'] as any[]);
      if (!roleRows?.length) return [];
      const ids = roleRows.map((r: any) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', ids)
        .eq('active', true)
        .order('name');
      return (profiles || []) as { id: string; name: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const stages = useMemo(() => getStatusesForPipeline('api_oficial'), [getStatusesForPipeline]);
  const colorMap = useMemo(() => getColorMap('api_oficial'), [getColorMap]);
  const kanbanStages = useMemo(() => stages.filter(s => !TERMINAL_STAGES.has(s)), [stages]);

  // ─── UI state ───────────────────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState<ApiTab>('ativos');
  const [selectedCloserId, setSelectedCloserId] = useState('pending');
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem('api_oficial_view_mode') as ViewMode) || 'kanban'
  );
  const [kanbanSortBy, setKanbanSortBy] = useState<SortOption>(() =>
    (localStorage.getItem('api_oficial_kanban_sort') as SortOption) || 'created_desc'
  );
  const [kanbanCardFields, setKanbanCardFields] = useState<FieldConfig[]>(() =>
    loadFieldConfig('api-oficial-kanban', KANBAN_CARD_DEFAULTS)
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('api_oficial_items_per_page');
    return saved ? Number(saved) : 20;
  });

  // Bulk selection
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dialogs
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<ApiOficialDeal | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [newDealDialogOpen, setNewDealDialogOpen] = useState(false);

  // Kanban drag
  const [activeId, setActiveId] = useState<string | null>(null);

  // Default closer on mount
  const closerDefaultSet = useRef(false);
  useEffect(() => {
    if (!closerDefaultSet.current && currentUser?.id) {
      setSelectedCloserId(hasPermission('access_admin') ? 'all' : currentUser.id);
      closerDefaultSet.current = true;
    }
  }, [currentUser?.id, hasPermission]);

  // Reset page / selection on tab or filter change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedDealIds(new Set());
  }, [activeTab, selectedStatuses, searchTerm]);

  // ─── Data ───────────────────────────────────────────────────────────────────

  const closerIdParam = selectedCloserId === 'all' || selectedCloserId === 'pending'
    ? undefined
    : selectedCloserId === 'unassigned' ? undefined : selectedCloserId;

  const { data: deals = [], isLoading } = useApiOficialDeals(closerIdParam, searchTerm || undefined);

  const activeDeals = useMemo(() => deals.filter(d => !TERMINAL_STAGES.has(d.stage)), [deals]);
  const finalizedDeals = useMemo(() => deals.filter(d => TERMINAL_STAGES.has(d.stage)), [deals]);

  const tabDeals = activeTab === 'ativos' ? activeDeals : finalizedDeals;

  const filteredDeals = useMemo(() => {
    if (selectedStatuses.size === 0) return tabDeals;
    return tabDeals.filter(d => selectedStatuses.has(d.stage));
  }, [tabDeals, selectedStatuses]);

  const sortedDeals = useMemo(() => sortDeals(filteredDeals, kanbanSortBy), [filteredDeals, kanbanSortBy]);

  // Pagination (list view)
  const totalResults = sortedDeals.length;
  const totalPages = Math.ceil(totalResults / itemsPerPage);
  const paginatedDeals = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedDeals.slice(start, start + itemsPerPage);
  }, [sortedDeals, currentPage, itemsPerPage]);

  // Kanban grouping
  const dealsByStage = useMemo(() => {
    const map: Record<string, ApiOficialDeal[]> = {};
    kanbanStages.forEach(s => { map[s] = []; });
    sortedDeals.forEach(d => { if (map[d.stage]) map[d.stage].push(d); });
    return map;
  }, [sortedDeals, kanbanStages]);

  const isKanbanActive = viewMode === 'kanban' && activeTab === 'ativos';

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleGlobalSearchSelect = useCallback((result: GlobalSearchResult) => {
    openLead(result.lead_id, result.opportunity_id || undefined);
  }, [openLead]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab as ApiTab);
    setCurrentPage(1);
    setSelectedDealIds(new Set());
  }, []);

  const handleMove = useCallback((dealId: string, stage: string) => {
    moveStage.mutate({ dealId, stage });
  }, [moveStage]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const dealId = String(active.id);
    const overId = String(over.id);
    let targetStage: string | null = null;
    if (kanbanStages.includes(overId)) {
      targetStage = overId;
    } else {
      const targetDeal = deals.find(d => d.id === overId);
      if (targetDeal) targetStage = targetDeal.stage;
    }
    if (!targetStage) return;
    const sourceDeal = deals.find(d => d.id === dealId);
    if (!sourceDeal || sourceDeal.stage === targetStage) return;
    handleMove(dealId, targetStage);
  }, [kanbanStages, deals, handleMove]);

  const handleLostOpen = useCallback((deal: ApiOficialDeal) => {
    setSelectedDeal(deal);
    setReason('');
    setLostDialogOpen(true);
  }, []);

  const handleLostConfirm = useCallback(() => {
    if (!selectedDeal || !reason.trim()) return;
    lostMutation.mutate({ dealId: selectedDeal.id, reason });
    setLostDialogOpen(false);
  }, [selectedDeal, reason, lostMutation]);

  const handleNotesOpen = useCallback((deal: ApiOficialDeal) => {
    setSelectedDeal(deal);
    setNotes(deal.notes || '');
    setNotesDialogOpen(true);
  }, []);

  const handleNotesSave = useCallback(() => {
    if (!selectedDeal) return;
    updateNotes.mutate({ dealId: selectedDeal.id, notes });
    setNotesDialogOpen(false);
  }, [selectedDeal, notes, updateNotes]);

  const handleChecklistOpen = useCallback((deal: ApiOficialDeal) => {
    setSelectedDeal(deal);
    setChecklistOpen(true);
  }, []);

  const handleChecklistSuccess = useCallback(() => {
    if (selectedDeal) moveStage.mutate({ dealId: selectedDeal.id, stage: 'Enviar Pós Venda' });
    setChecklistOpen(false);
    toast.success('Projeto criado e deal finalizado');
  }, [selectedDeal, moveStage]);

  const handleOpenLeadModal = useCallback((deal: ApiOficialDeal) => {
    openLead(deal.lead_id);
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
      }
    );
  }, [queryClient, updateLeadMutation]);

  // Bulk selection
  const handleDealCheckChange = useCallback((dealId: string, checked: boolean) => {
    setSelectedDealIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(dealId); else next.delete(dealId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedDealIds(new Set(paginatedDeals.map(d => d.id)));
  }, [paginatedDeals]);

  const handleDeselectAll = useCallback(() => {
    setSelectedDealIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await Promise.all(Array.from(selectedDealIds).map(id => deleteDeal.mutateAsync(id)));
      toast.success(`${selectedDealIds.size} deal(s) excluído(s)`);
      setSelectedDealIds(new Set());
      setDeleteDialogOpen(false);
      invalidateAll();
    } catch {
      toast.error('Erro ao excluir deals');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedDealIds, deleteDeal, invalidateAll]);

  const handleReassignComplete = useCallback(() => {
    setSelectedDealIds(new Set());
    invalidateAll();
  }, [invalidateAll]);

  // Modal deal
  const modalDeal = useMemo(() => {
    if (!modalLead) return null;
    return deals.find(d => d.lead_id === modalLead.id) || null;
  }, [modalLead, deals]);

  const handleApiOficialStageChange = useCallback((stage: string) => {
    if (!modalDeal) return;
    moveStage.mutate({ dealId: modalDeal.id, stage });
  }, [modalDeal, moveStage]);

  // Checklist mock opportunity
  const checklistOpportunity = useMemo((): CloserOpportunity | null => {
    if (!selectedDeal) return null;
    return {
      id: selectedDeal.id,
      lead_id: selectedDeal.lead_id,
      lead_name: selectedDeal.lead_name || '',
      lead_company: selectedDeal.lead_company || '',
      lead_cnpj: selectedDeal.lead_cnpj || '',
      lead_phone: selectedDeal.lead_phone || '',
      lead_email: selectedDeal.lead_email || '',
      lead_website: selectedDeal.lead_website || '',
      lead_razao_social: selectedDeal.lead_company || '',
      assigned_to_user_id: selectedDeal.assigned_to_user_id || '',
      closer_name: selectedDeal.closer_name || '',
      sdr_name: selectedDeal.sdr_name || '',
      sdr_user_id: selectedDeal.sdr_user_id || '',
      stage: selectedDeal.stage,
      created_at: selectedDeal.created_at,
      updated_at: selectedDeal.updated_at,
    } as CloserOpportunity;
  }, [selectedDeal]);

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className={cn('bg-background', isKanbanActive ? 'h-full flex flex-col' : 'h-full')}>
        <main className={cn('px-4 py-4', isKanbanActive ? 'flex-1 min-h-0 flex flex-col overflow-hidden' : 'pb-20')}>
          <div className={cn('flex flex-col', isKanbanActive ? 'flex-1 min-h-0' : '')}>

            <PageHeader
              icon={<ShieldCheck className="h-5 w-5" />}
              title="API Oficial"
              actions={
                <Button size="sm" className="h-8 gap-1.5 text-xs font-medium" onClick={() => setNewDealDialogOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Nova Solicitação</span>
                </Button>
              }
              toolbar={
                <div className="space-y-3">
                  {/* Tabs */}
                  <Tabs value={activeTab} onValueChange={handleTabChange}>
                    <TabsList className="h-9">
                      <TabsTrigger value="ativos" className="text-xs gap-1.5 px-4">
                        Ativos
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{activeDeals.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="finalizados" className="text-xs gap-1.5 px-4">
                        Finalizados
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{finalizedDeals.length}</Badge>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {/* Filters row */}
                  <div className="flex items-center gap-2">
                    <GlobalSearchDropdown
                      onSelect={handleGlobalSearchSelect}
                      onSearchChange={setSearchTerm}
                      placeholder="Busca global..."
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
                            {closerProfiles.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {activeTab === 'ativos' && (
                      <>
                        {viewMode === 'kanban' && (
                          <>
                            <Select
                              value={kanbanSortBy}
                              onValueChange={(v) => {
                                setKanbanSortBy(v as SortOption);
                                localStorage.setItem('api_oficial_kanban_sort', v);
                              }}
                            >
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
                              onFieldsChange={(f) => { setKanbanCardFields(f); saveFieldConfig('api-oficial-kanban', f); }}
                              defaultFields={KANBAN_CARD_DEFAULTS}
                            />
                          </>
                        )}

                        <LeadAdvancedFilter
                          selectedStatuses={selectedStatuses}
                          onSelectedStatusesChange={setSelectedStatuses}
                          mode="closer"
                        />

                        <div className="flex items-center border border-border/60 rounded-md overflow-hidden">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                size="icon"
                                className="h-8 w-8 rounded-none"
                                onClick={() => { setViewMode('list'); localStorage.setItem('api_oficial_view_mode', 'list'); }}
                              >
                                <LayoutList className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Lista</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                                size="icon"
                                className="h-8 w-8 rounded-none"
                                onClick={() => { setViewMode('kanban'); localStorage.setItem('api_oficial_view_mode', 'kanban'); }}
                              >
                                <LayoutGrid className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Kanban</TooltipContent>
                          </Tooltip>
                        </div>
                      </>
                    )}
                  </div>

                  <ActiveFilterChips
                    selectedStatuses={selectedStatuses}
                    onRemove={(s) => {
                      const next = new Set(selectedStatuses);
                      next.delete(s);
                      setSelectedStatuses(next);
                    }}
                    onClearAll={() => setSelectedStatuses(new Set())}
                  />
                </div>
              }
            />

            {/* ── Kanban ──────────────────────────────────────────────────── */}

            {isKanbanActive && (
              <KanbanProvider
                onDragEnd={handleDragEnd}
                onDragOver={() => {}}
                onDragStart={(event) => setActiveId(String(event.active.id))}
                className="gap-3 overflow-x-auto overflow-y-hidden pb-4 min-h-[500px]"
              >
                {kanbanStages.map(stage => {
                  const stageDeals = dealsByStage[stage] || [];
                  const color = colorMap[stage];
                  return (
                    <KanbanBoard
                      key={stage}
                      id={stage}
                      className="!w-[260px] sm:!w-[280px] !min-w-[260px] sm:!min-w-[280px] rounded-xl bg-muted/50 dark:bg-muted/30 border border-border/40 flex flex-col max-h-full"
                    >
                      <div
                        className="flex items-center justify-between p-3 border-b border-border/30 rounded-t-xl shrink-0"
                        style={color ? { backgroundColor: `${color}18` } : undefined}
                      >
                        <div className="flex items-center gap-2">
                          {color && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
                          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{stage}</span>
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold tabular-nums">
                            {stageDeals.length}
                          </Badge>
                        </div>
                      </div>

                      <KanbanCards items={stageDeals.map(d => d.id)} className="min-h-[120px] p-2 gap-1.5 overflow-y-auto flex-1">
                        {stageDeals.map(deal => (
                          <ContextMenu key={deal.id}>
                            <ContextMenuTrigger asChild>
                              <KanbanDndCard
                                id={deal.id}
                                asHandle
                                className="cursor-grab active:cursor-grabbing bg-card border border-border/50 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30 transition-all duration-150 rounded-lg shadow-sm"
                                onClick={() => handleOpenLeadModal(deal)}
                              >
                                <ApiOficialCardContent deal={deal} cardFields={kanbanCardFields} />
                              </KanbanDndCard>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              {kanbanStages.filter(s => s !== deal.stage).map(s => (
                                <ContextMenuItem key={s} onClick={() => handleMove(deal.id, s)}>
                                  Mover para {s}
                                </ContextMenuItem>
                              ))}
                              <ContextMenuItem onClick={() => handleChecklistOpen(deal)}>
                                <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                                Enviar Pós Venda
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => handleNotesOpen(deal)}>
                                <StickyNote className="h-3.5 w-3.5 mr-2" />
                                Notas
                              </ContextMenuItem>
                              <ContextMenuItem
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={() => handleLostOpen(deal)}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-2" />
                                Não quer agora
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        ))}

                        {stageDeals.length === 0 && (
                          <div className="rounded-lg border-dashed border-2 border-border/30 p-8 text-center flex flex-col items-center gap-2">
                            <Plus className="h-4 w-4 text-muted-foreground/30" strokeWidth={1.5} />
                            <p className="text-xs text-muted-foreground/40">Nenhum deal</p>
                          </div>
                        )}
                      </KanbanCards>
                    </KanbanBoard>
                  );
                })}

                <KanbanOverlay>
                  {activeId && deals.find(d => d.id === activeId) && (
                    <ApiOficialCardContent deal={deals.find(d => d.id === activeId)!} cardFields={kanbanCardFields} />
                  )}
                </KanbanOverlay>
              </KanbanProvider>
            )}

            {/* ── List view ───────────────────────────────────────────────── */}

            {!isKanbanActive && (
              <>
                <div className="border border-border rounded-xl overflow-hidden mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {canBulkSelect && (
                          <TableHead className="w-10">
                            <input
                              type="checkbox"
                              checked={paginatedDeals.length > 0 && paginatedDeals.every(d => selectedDealIds.has(d.id))}
                              onChange={(e) => e.target.checked ? handleSelectAll() : handleDeselectAll()}
                              className="h-4 w-4 rounded border-border"
                            />
                          </TableHead>
                        )}
                        <TableHead className="text-xs">Empresa</TableHead>
                        <TableHead className="text-xs">Contato</TableHead>
                        <TableHead className="text-xs">CNPJ</TableHead>
                        <TableHead className="text-xs">Estágio</TableHead>
                        <TableHead className="text-xs">Closer</TableHead>
                        <TableHead className="text-xs">Criado em</TableHead>
                        <TableHead className="text-xs w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedDeals.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={canBulkSelect ? 8 : 7} className="text-center py-12 text-muted-foreground">
                            Nenhum deal encontrado
                          </TableCell>
                        </TableRow>
                      ) : paginatedDeals.map(deal => {
                        const color = colorMap[deal.stage];
                        return (
                          <TableRow
                            key={deal.id}
                            className="hover:bg-muted/30 cursor-pointer"
                            onClick={() => handleOpenLeadModal(deal)}
                          >
                            {canBulkSelect && (
                              <TableCell onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedDealIds.has(deal.id)}
                                  onChange={(e) => handleDealCheckChange(deal.id, e.target.checked)}
                                  className="h-4 w-4 rounded border-border"
                                />
                              </TableCell>
                            )}
                            <TableCell className="text-sm font-medium">{deal.lead_company || deal.lead_name || '—'}</TableCell>
                            <TableCell>
                              <div className="text-xs">
                                <p>{deal.lead_name || '—'}</p>
                                {deal.lead_email && <p className="text-muted-foreground">{deal.lead_email}</p>}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">{deal.lead_cnpj || '—'}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="text-[10px]"
                                style={color ? { borderColor: `${color}33`, color, backgroundColor: `${color}15` } : undefined}
                              >
                                {deal.stage}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{deal.closer_name || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{format(new Date(deal.created_at), 'dd/MM/yyyy')}</TableCell>
                            <TableCell onClick={e => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {kanbanStages.filter(s => s !== deal.stage).map(stage => (
                                    <DropdownMenuItem key={stage} onClick={() => handleMove(deal.id, stage)}>
                                      Mover para {stage}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuItem onClick={() => handleChecklistOpen(deal)}>
                                    <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                                    Enviar Pós Venda
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleNotesOpen(deal)}>
                                    <StickyNote className="h-3.5 w-3.5 mr-2" />
                                    Notas
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleLostOpen(deal)} className="text-destructive">
                                    <XCircle className="h-3.5 w-3.5 mr-2" />
                                    Não quer agora
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {totalResults > 0 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Mostrar</span>
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={(v) => {
                          setItemsPerPage(Number(v));
                          setCurrentPage(1);
                          localStorage.setItem('api_oficial_items_per_page', v);
                        }}
                      >
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
                        Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, totalResults)} a {Math.min(currentPage * itemsPerPage, totalResults)} de {totalResults}
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

        {/* ── Bulk Actions Bar ─────────────────────────────────────────────── */}

        {canBulkSelect && (
          <BulkActionsBar
            selectedCount={selectedDealIds.size}
            totalCount={paginatedDeals.length}
            totalFilteredCount={totalResults}
            allFilteredSelected={false}
            isLoadingSelection={false}
            onSelectAll={handleSelectAll}
            onSelectAllFiltered={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onReassign={() => setReassignDialogOpen(true)}
            onDelete={() => setDeleteDialogOpen(true)}
            showDelete={hasPermission('access_admin')}
          />
        )}

        {/* ── Dialogs ──────────────────────────────────────────────────────── */}

        <Dialog open={lostDialogOpen} onOpenChange={setLostDialogOpen}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle>Não quer agora</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Label className="text-xs font-medium">Motivo</Label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Descreva o motivo..."
                className="min-h-[80px]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLostDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleLostConfirm} disabled={!reason.trim() || lostMutation.isPending}>
                {lostMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle>Notas — {selectedDeal?.lead_company || selectedDeal?.lead_name}</DialogTitle>
            </DialogHeader>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Adicione notas..."
              className="min-h-[120px]"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleNotesSave} disabled={updateNotes.isPending}>
                {updateNotes.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {checklistOpportunity && (
          <ProjectChecklist
            open={checklistOpen}
            onOpenChange={setChecklistOpen}
            opportunity={checklistOpportunity}
            onSuccess={handleChecklistSuccess}
            defaultProjectType="api_oficial"
          />
        )}

        <NewApiOficialDealDialog
          open={newDealDialogOpen}
          onOpenChange={setNewDealDialogOpen}
          onSuccess={() => invalidateAll()}
        />

        <LeadReassignDialog
          open={reassignDialogOpen}
          onOpenChange={setReassignDialogOpen}
          selectedLeadIds={Array.from(selectedDealIds)}
          onReassignComplete={handleReassignComplete}
          mode="closer"
        />

        <DeleteLeadDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          leadCount={selectedDealIds.size}
          onConfirm={handleBulkDelete}
          isDeleting={isDeleting}
          entityLabel="Deal"
        />

        <LeadModal
          lead={modalLead}
          open={leadModalOpen}
          onClose={closeLead}
          onUpdateLead={handleUpdateLead}
          mode="api_oficial"
          onOpportunityStageChange={() => { invalidateAll(); }}
          apiOficialStage={modalDeal?.stage}
          onApiOficialStageChange={handleApiOficialStageChange}
          apiOficialCreatedAt={modalDeal?.created_at}
        />
      </div>
    </AppLayout>
  );
};

export default ApiOficialPipelinePage;
