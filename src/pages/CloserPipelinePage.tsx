import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import type { SortingState } from '@tanstack/react-table';
import { useLeadModal } from '@/hooks/useLeadModal';
import { Link } from 'react-router-dom';
import { CloserKanbanView } from '@/components/closer/CloserKanbanView';
import { CloserTableView } from '@/components/closer/CloserTableView';
import { FieldConfig, ProjectViewConfig, loadFieldConfig, saveFieldConfig } from '@/components/projects/ProjectViewConfig';
import { PageHeader } from '@/components/PageHeader';
import { ProjectChecklist } from '@/components/projects/ProjectChecklist';
import { useCloserPipelinePaginated, useCloserTabCounts, useCloserMutations } from '@/hooks/useCloserPipeline';
import { useCloserKanbanByStage } from '@/hooks/useCloserKanbanByStage';
import { CloserStage, CloserOpportunity, bulkDeleteOpportunities, fetchFilteredOpportunityIds, detectProjectTypeFromProposal, createOpportunityFromNewLead, fetchCloserProfiles } from '@/services/closerService';
import { useCloserStages } from '@/hooks/useCloserStages';
import { isDealStuck } from '@/utils/behavioralScore';
import { formatTimeAgo, formatNextAction } from '@/utils/priorityCalculator';
import { LeadTemperature, LeadStatus } from '@/types/lead';
import { buildLeadFromOpportunity } from '@/utils/leadEmailHelper';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useUserRole } from '@/hooks/useUserRole';
import { CloserSelector } from '@/components/CloserSelector';
import { useUpdateLead } from '@/hooks/useLeads';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { fetchLeadById } from '@/services/leadService';
import { LeadModal } from '@/components/LeadModal';
import { NewLeadDialog } from '@/components/NewLeadDialog';
import { NewDealFromClientDialog } from '@/components/closer/NewDealFromClientDialog';
import { Lead } from '@/types/lead';

import { LeadAdvancedFilter, ActiveFilterChips } from '@/components/LeadAdvancedFilter';
import { BulkActionsBar } from '@/components/BulkActionsBar';
import { DeleteLeadDialog } from '@/components/DeleteLeadDialog';
import { LeadReassignDialog } from '@/components/LeadReassignDialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  BarChart3,
  Search,
  LayoutList,
  LayoutGrid,
  MoreHorizontal,
  ArrowRight,
  RotateCcw,
  Trophy,
  XCircle,
  MessageSquare,
  Calendar,
  User,
  Phone,
  Mail,
  Building2,
  Users,
  Monitor,
  CalendarX,
  FileText,
  Send,
  Handshake,
  FileSignature,
  Clock,
  CheckCircle2,
  Ban,
  CalendarClock,
  CalendarCheck,
  Calculator,
  Plus,
  AlertTriangle,
  Filter,
  X,
  StickyNote,
  Flame,
  Snowflake,
  Trash2,
  Download,
} from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { EmailComposeDialog } from '@/components/EmailComposeDialog';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppLayout } from '@/components/AppLayout';
import { GlobalSearchDropdown, GlobalSearchResult } from '@/components/GlobalSearchDropdown';

import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CloserDateRangeFilter } from '@/components/closer/CloserDateRangeFilter';
import { useExportOpportunitiesToExcel } from '@/hooks/useExportToExcel';

// ===== MODULE-LEVEL CONSTANTS (never recreated) =====

type CloserFilter = 'all' | CloserStage;
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

// These are now provided dynamically by useCloserStages inside the component

const STAGE_ICONS: Record<string, React.ReactNode> = {
  'all': <LayoutList className="h-3.5 w-3.5" />,
  'Demonstração': <Monitor className="h-3.5 w-3.5" />,
  'Apresentar proposta': <FileText className="h-3.5 w-3.5" />,
  'Proposta enviada': <Send className="h-3.5 w-3.5" />,
  'Negociação': <Handshake className="h-3.5 w-3.5" />,
  'Oportunidade quente': <Flame className="h-3.5 w-3.5" />,
  'Oportunidade Futura': <CalendarClock className="h-3.5 w-3.5" />,
  'Oportunidade fria': <Snowflake className="h-3.5 w-3.5" />,
  'Contrato enviado': <FileSignature className="h-3.5 w-3.5" />,
  'Aguardando pagamento': <Clock className="h-3.5 w-3.5" />,
  'Ganho': <CheckCircle2 className="h-3.5 w-3.5" />,
  'Perdido': <Ban className="h-3.5 w-3.5" />,
};

const STAGE_SHORT_LABELS: Record<string, string> = {
  'Apresentar proposta': 'Proposta',
  'Proposta enviada': 'Enviada',
  'Aguardando pagamento': 'Pagamento',
  'Contrato enviado': 'Contrato',
  'Oportunidade quente': 'Op. Quente',
  'Oportunidade Futura': 'Op. Futura',
  'Oportunidade fria': 'Op. Fria',
};

const STAGE_LABELS_MAP: Record<string, string> = {
  'Demonstração': 'Demonstração',
  'Apresentar proposta': 'Proposta',
  'Proposta enviada': 'Enviada',
  'Negociação': 'Negociação',
  'Oportunidade quente': 'Op. Quente',
  'Oportunidade Futura': 'Op. Futura',
  'Oportunidade fria': 'Op. Fria',
  'Contrato enviado': 'Contrato',
  'Aguardando pagamento': 'Pagamento',
  'Ganho': 'Ganho',
  'Perdido': 'Perdido',
};

const RETURN_OPTIONS = [
  'Cliente não entrou na reunião',
  'Cliente entrou mas decidiu remarcar',
  'Outro',
];

// ===== EXTRACTED SUB-COMPONENTS =====

const TemperatureDisplay = memo(({ temperature }: { temperature: LeadTemperature | null }) => {
  if (!temperature) return <span className="text-sm text-muted-foreground">—</span>;
  const bars = temperature === 'quente' ? 3 : temperature === 'morno' ? 2 : 1;
  const labels: Record<string, string> = { frio: 'Baixo', morno: 'Médio', quente: 'Alto' };
  const barColors: Record<string, string> = {
    frio: 'bg-destructive',
    morno: 'bg-[hsl(var(--chart-2))]',
    quente: 'bg-[hsl(var(--chart-3))]',
  };
  const textColors: Record<string, string> = {
    frio: 'text-destructive',
    morno: 'text-[hsl(var(--chart-2))]',
    quente: 'text-[hsl(var(--chart-3))]',
  };
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn("h-3 w-1.5 rounded-sm", i < bars ? barColors[temperature] : "bg-muted")} />
        ))}
      </div>
      <span className={cn("text-xs font-medium", textColors[temperature])}>
        {labels[temperature]}
      </span>
    </div>
  );
});

const MobileCardActions = memo(({ opp, onReturn, onLost, onNotes, onWon, onDelete }: {
  opp: CloserOpportunity;
  onReturn: () => void;
  onLost: () => void;
  onNotes: () => void;
  onWon: () => void;
  onDelete?: () => void;
}) => {
  const { user: currentUser } = useCurrentUser();
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const isTerminal = opp.stage === 'Ganho' || opp.stage === 'Perdido';
  const phones = useMemo(() => [opp.lead_phone, opp.lead_phone_2, opp.lead_phone_3, opp.lead_phone_4].filter(Boolean) as string[], [opp.lead_phone, opp.lead_phone_2, opp.lead_phone_3, opp.lead_phone_4]);

  const dialNumber = useCallback((phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const phoneWithoutPrefix = cleanPhone.startsWith('55') ? cleanPhone.slice(2) : cleanPhone;
    window.open(`tel:${phoneWithoutPrefix}`, '_self');
  }, []);

  const openWhatsApp = useCallback((phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    window.open(`https://web.whatsapp.com/send?phone=55${cleanPhone}`, '_blank');
  }, []);

  const leadForEmail = useMemo(() => buildLeadFromOpportunity(opp), [opp]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-11 w-11 -mr-2" aria-label="Mais ações">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {opp.lead_email && (
            <DropdownMenuItem onClick={() => setEmailDialogOpen(true)} className="gap-2 py-2.5">
              <Mail className="h-4 w-4" />
              Enviar E-mail
            </DropdownMenuItem>
          )}
          {phones.length > 0 && (
            <DropdownMenuItem onClick={() => openWhatsApp(phones[0])} className="gap-2 py-2.5">
              <WhatsAppIcon size={16} />
              WhatsApp
            </DropdownMenuItem>
          )}
          {phones.length > 0 && (
            <DropdownMenuItem onClick={() => dialNumber(phones[0])} className="gap-2 py-2.5">
              <Phone className="h-4 w-4" />
              Ligar
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onNotes} className="gap-2 py-2.5">
            <StickyNote className="h-4 w-4" />
            Notas
          </DropdownMenuItem>
          {!isTerminal && (
            <>
              <DropdownMenuItem onClick={onReturn} className="gap-2 py-2.5">
                <RotateCcw className="h-4 w-4" />
                Devolver ao SDR
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onWon} className="gap-2 py-2.5">
                <Trophy className="h-4 w-4" />
                Marcar Ganho
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLost} className="gap-2 py-2.5 text-destructive">
                <XCircle className="h-4 w-4" />
                Marcar Perdido
              </DropdownMenuItem>
            </>
          )}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="gap-2 py-2.5 text-destructive">
                <Trash2 className="h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EmailComposeDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        lead={leadForEmail}
        userName={currentUser?.name || ''}
        sdrName={opp.sdr_name || ''}
        closerName={opp.closer_name || ''}
      />
    </>
  );
});

// ===== MAIN COMPONENT =====

const CloserPipelinePage = () => {
  const { user: currentUser } = useCurrentUser();
  const { isAdmin, isManager } = useAdminUsers();
  const { canAccessBoth } = useUserRole();
  const isMobile = useIsMobile();
  const canFilterByCloser = isAdmin || isManager;
  const { stages: dynamicStages, defaultOppFilter, activeStages } = useCloserStages();
  const ALL_STAGES_SET = useMemo(() => new Set(dynamicStages), [dynamicStages]);

  const { moveStage, returnToSdr, markLost, markWon, updateNotes, invalidateAll } = useCloserMutations();
  const updateLeadMutation = useUpdateLead();
  const queryClient = useQueryClient();
  const { exportOpportunities, isExporting: isExportingOpps } = useExportOpportunitiesToExcel();

  const debouncedSearch = '';
  const [activeTab, setActiveTab] = useState<CloserTab>(() => {
    return (localStorage.getItem('closer_active_tab') as CloserTab) || 'oportunidades';
  });
  const HIGHLIGHT_DEFAULTS = defaultOppFilter;
  const [advancedFilterStatuses, _setAdvancedFilterStatuses] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('closer_advanced_filters');
    return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
  });
  // When dynamic stages load and user has no saved filter, apply defaults.
  // Also validate saved filter against current dynamic stages (admin may have added/removed stages).
  const defaultsApplied = useRef(false);
  useEffect(() => {
    if (!defaultsApplied.current && defaultOppFilter.size > 0) {
      const saved = localStorage.getItem('closer_advanced_filters');
      if (!saved) {
        _setAdvancedFilterStatuses(new Set(HIGHLIGHT_DEFAULTS));
      } else {
        const savedSet = new Set<string>(JSON.parse(saved));
        const allStages = new Set(dynamicStages);
        let hasInvalid = false;
        for (const s of savedSet) {
          if (!allStages.has(s)) {
            savedSet.delete(s);
            hasInvalid = true;
          }
        }
        if (hasInvalid) {
          const next = savedSet.size > 0 ? savedSet : HIGHLIGHT_DEFAULTS;
          _setAdvancedFilterStatuses(next);
          localStorage.setItem('closer_advanced_filters', JSON.stringify([...next]));
        }
      }
      defaultsApplied.current = true;
    }
  }, [defaultOppFilter, dynamicStages]);
  const setAdvancedFilterStatuses = useCallback((v: Set<string>) => {
    _setAdvancedFilterStatuses(v);
    localStorage.setItem('closer_advanced_filters', JSON.stringify([...v]));
  }, []);
  const [meetingDateRange, setMeetingDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [wonDateRange, setWonDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  
  const [selectedCloserId, setSelectedCloserId] = useState('pending');
  const [viewMode, setViewMode] = useState<CloserViewMode>(() => {
    return (localStorage.getItem('closer_view_mode') as CloserViewMode) || 'list';
  });
  const [kanbanSortBy, setKanbanSortBy] = useState<SortOption>(() => {
    return (localStorage.getItem('closer_kanban_sort') as SortOption) || 'value_desc';
  });
  const [kanbanCardFields, setKanbanCardFields] = useState<FieldConfig[]>(() =>
    loadFieldConfig('closer-kanban', KANBAN_CARD_DEFAULTS)
  );


  // Default closer filter: admins see all, others see own
  const closerDefaultSet = useRef(false);
  useEffect(() => {
    if (!closerDefaultSet.current && currentUser?.id) {
      setSelectedCloserId(isAdmin ? 'all' : currentUser.id);
      closerDefaultSet.current = true;
    }
  }, [currentUser?.id, isAdmin]);

  const [currentPage, setCurrentPage] = useState(1);
  const [tableSorting, setTableSorting] = useState<SortingState>([]);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('closer_items_per_page');
    return saved ? Number(saved) : 20;
  });

  // Build server-side params
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

  const sortColumn = tableSorting.length > 0 ? tableSorting[0].id : null;
  const sortDirection = tableSorting.length > 0 ? (tableSorting[0].desc ? 'desc' : 'asc') : 'asc';

  const { opportunities: paginatedOpps, total: totalResults, isLoading, isFetching } = useCloserPipelinePaginated({
    tab: activeTab,
    closerId: closerIdParam,
    search: debouncedSearch,
    stages: stagesParam,
    meetingFrom: activeTab === 'reunioes' && meetingDateRange.from ? startOfDay(meetingDateRange.from).toISOString() : null,
    meetingTo: activeTab === 'reunioes' && meetingDateRange.to ? endOfDay(meetingDateRange.to).toISOString() : null,
    wonFrom: activeTab === 'vendas' && wonDateRange.from ? startOfDay(wonDateRange.from).toISOString() : null,
    wonTo: activeTab === 'vendas' && wonDateRange.to ? endOfDay(wonDateRange.to).toISOString() : null,
    page: currentPage,
    pageSize: itemsPerPage,
    sortColumn,
    sortDirection,
  });

  // Tab counts from server
  const tabCounts = useCloserTabCounts(closerIdParam);

  // Kanban data (only loaded when kanban is active) — server-side per-stage pagination
  const isKanbanActive = viewMode === 'kanban' && activeTab === 'oportunidades';
  const [kanbanColumnPages, setKanbanColumnPages] = useState<Record<string, number>>({});
  const handleKanbanLoadMore = useCallback((stage: string) => {
    setKanbanColumnPages((prev) => ({ ...prev, [stage]: (prev[stage] ?? 1) + 1 }));
  }, []);
  const kanbanVisibleStages = advancedFilterStatuses.size > 0 ? advancedFilterStatuses : ALL_STAGES_SET;
  const { columns: kanbanColumns, isLoading: kanbanLoading } = useCloserKanbanByStage({
    closerId: closerIdParam,
    search: debouncedSearch,
    sortBy: kanbanSortBy,
    opportunityType: 'new_business',
    orderedStages: dynamicStages,
    visibleStages: kanbanVisibleStages,
    enabled: isKanbanActive && selectedCloserId !== 'pending',
    columnPages: kanbanColumnPages,
  });

  // For pagination display
  const totalPages = Math.ceil(totalResults / itemsPerPage);

  // Reset to first page whenever core filters change
  useEffect(() => {
    setCurrentPage(1);
    setMobileLoadedPages(1);
  }, [selectedCloserId, stagesParam, meetingDateRange.from, meetingDateRange.to, wonDateRange.from, wonDateRange.to, debouncedSearch]);

  // Reset kanban column pages when filters change
  useEffect(() => {
    setKanbanColumnPages({});
  }, [closerIdParam, debouncedSearch, kanbanSortBy, advancedFilterStatuses]);

  // Keep page in bounds when filters reduce total results
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(totalResults / itemsPerPage));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
      setMobileLoadedPages(1);
    }
  }, [currentPage, totalResults, itemsPerPage]);

  // Mobile-specific states
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileCloserFilterOpen, setMobileCloserFilterOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [mobileLoadedPages, setMobileLoadedPages] = useState(1);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lead modal via URL — use modalLead directly, no redundant selectedLead state
  const { lead: modalLead, opportunity: modalOpp, isOpen: leadModalOpen, openLead, closeLead } = useLeadModal();

  // Dialog states
  const [globalSearchReadOnly, setGlobalSearchReadOnly] = useState(false);
  const [newLeadDialogOpen, setNewLeadDialogOpen] = useState(false);
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

  // Bulk selection state
  const canBulkSelect = isAdmin || isManager;
  const [selectedOppIds, setSelectedOppIds] = useState<Set<string>>(new Set());
  const [allFilteredSelected, setAllFilteredSelected] = useState(false);
  const [isLoadingSelection, setIsLoadingSelection] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Clear selection on filter change
  useEffect(() => {
    setSelectedOppIds(new Set());
    setAllFilteredSelected(false);
    setBulkMode(false);
  }, [advancedFilterStatuses, debouncedSearch, activeTab]);

  // ===== MEMOIZED HANDLERS =====

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab as CloserTab);
    setCurrentPage(1);
    setMobileLoadedPages(1);
    setSelectedOppIds(new Set());
    setAllFilteredSelected(false);
    setBulkMode(false);
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
      const ids = await fetchFilteredOpportunityIds({
        tab: activeTab,
        closerId: closerIdParam,
        search: debouncedSearch.trim(),
        stages: stagesParam,
        meetingFrom: activeTab === 'reunioes' && meetingDateRange.from ? startOfDay(meetingDateRange.from).toISOString() : null,
        meetingTo: activeTab === 'reunioes' && meetingDateRange.to ? endOfDay(meetingDateRange.to).toISOString() : null,
        wonFrom: activeTab === 'vendas' && wonDateRange.from ? startOfDay(wonDateRange.from).toISOString() : null,
        wonTo: activeTab === 'vendas' && wonDateRange.to ? endOfDay(wonDateRange.to).toISOString() : null,
        limit,
      });
      return ids;
    } catch (err) {
      console.error('Error fetching all filtered opp IDs:', err);
      return [];
    } finally {
      setIsLoadingSelection(false);
    }
  }, [activeTab, closerIdParam, debouncedSearch, stagesParam, meetingDateRange, wonDateRange]);

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
    if (checked) {
      setSelectedOppIds(new Set(paginatedOpps.map(o => o.id)));
    } else {
      setSelectedOppIds(new Set());
    }
  }, [paginatedOpps]);

  const handleBulkDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await bulkDeleteOpportunities(Array.from(selectedOppIds));
      toast.success(`${selectedOppIds.size} oportunidade(s) excluída(s)`);
      setSelectedOppIds(new Set());
      setAllFilteredSelected(false);
      setDeleteDialogOpen(false);
      setBulkMode(false);
      invalidateAll();
    } catch {
      toast.error('Erro ao excluir oportunidades');
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
    setBulkMode(false);
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
    try {
      const projectType = await detectProjectTypeFromProposal(opp.id);
      setDetectedProjectType(projectType);
    } catch {
      setDetectedProjectType(null);
    }
    setChecklistOpp(opp);
    setChecklistOpen(true);
  }, []);

  const handleChecklistSuccess = useCallback(() => {
    if (checklistOpp) {
      markWon.mutate(checklistOpp.id);
    }
  }, [checklistOpp, markWon]);

  const getOppHref = useCallback((opp: CloserOpportunity) => {
    return `/closer?lead=${opp.lead_id}&opp=${opp.id}`;
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
    queryClient.setQueryData<Lead[]>(['leads'], (prev) => {
      if (!prev) return prev;
      return prev.map((l) => (l.id === updatedLead.id ? updatedLead : l));
    });
    updateLeadMutation.mutate(
      { id: updatedLead.id, updates: updatedLead },
      {
        onSuccess: () => {
          // Re-confirm caches match DB after successful persist
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          queryClient.invalidateQueries({ queryKey: ['lead-by-id', updatedLead.id] });
          queryClient.invalidateQueries({ queryKey: ['closer-pipeline'] });
        },
        onError: (error: any) => {
          const message = error?.message || 'Erro ao atualizar lead';
          toast.error(message);
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          queryClient.invalidateQueries({ queryKey: ['lead-by-id', updatedLead.id] });
        },
      }
    );
  }, [queryClient, updateLeadMutation]);

  const handleLongPressStart = useCallback((oppId: string) => {
    if (!canBulkSelect || !isMobile) return;
    longPressTimerRef.current = setTimeout(() => {
      setBulkMode(true);
      setSelectedOppIds(new Set([oppId]));
    }, 500);
  }, [canBulkSelect, isMobile]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleNewLeadCreated = useCallback(async (leadId: string) => {
    if (!currentUser?.id) return;
    try {
      await createOpportunityFromNewLead(leadId, currentUser.id);
      invalidateAll();
      toast.success('Oportunidade criada automaticamente');
    } catch (err) {
      console.error('Error creating opportunity:', err);
      toast.error('Lead criado, mas erro ao criar oportunidade');
    }
  }, [currentUser?.id, invalidateAll]);

  // Stats from tab counts
  const activeCount = tabCounts.totalActive;
  const wonCount = tabCounts.totalWon;
  const lostCount = tabCounts.totalLost;

  // Get profiles that have opportunities assigned to them
  const { data: closerProfiles = [] } = useQuery({
    queryKey: ['closer-filter-profiles'],
    queryFn: fetchCloserProfiles,
    staleTime: 5 * 60 * 1000,
  });

  const hasMoreMobile = isMobile && (mobileLoadedPages * itemsPerPage) < totalResults;

  const totalAll = tabCounts.oportunidades + tabCounts.reunioes + tabCounts.vendas + tabCounts.totalLost;

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

      <main className={cn("px-3 sm:px-4 py-3 sm:py-4", viewMode === 'kanban' && activeTab === 'oportunidades' ? 'flex-1 min-h-0 flex flex-col overflow-hidden' : 'pb-20')}>
        {/* === MOBILE HEADER === */}
        <div className="sm:hidden">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-2">
            {mobileSearchOpen ? (
              <div className="flex items-center gap-2 py-2">
                <GlobalSearchDropdown
                  onSelect={(r) => { handleGlobalSearchSelect(r); setMobileSearchOpen(false); }}
                  placeholder="Busca global..."
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 flex-shrink-0"
                  onClick={() => setMobileSearchOpen(false)}
                  aria-label="Fechar busca"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Handshake className="h-5 w-5 text-primary" />
                  <h1 className="text-lg font-semibold text-foreground">Oportunidades</h1>
                  <Badge variant="secondary" className="text-xs tabular-nums">
                    {totalAll}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setMobileSearchOpen(true)} aria-label="Buscar">
                  </Button>
                  {canFilterByCloser && (
                    <DropdownMenu open={mobileCloserFilterOpen} onOpenChange={setMobileCloserFilterOpen}>
                      <DropdownMenuTrigger asChild>
                        <Button variant={selectedCloserId !== 'all' ? 'secondary' : 'ghost'} size="icon" className="h-11 w-11" aria-label="Filtrar por Closer">
                          <Filter className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => setSelectedCloserId('all')} className={cn(selectedCloserId === 'all' && 'bg-accent')}>
                          Todos os Closers
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSelectedCloserId('unassigned')} className={cn(selectedCloserId === 'unassigned' && 'bg-accent')}>
                          Não atribuídos
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {closerProfiles.map((profile) => (
                          <DropdownMenuItem key={profile.id} onClick={() => setSelectedCloserId(profile.id)} className={cn(selectedCloserId === profile.id && 'bg-accent')}>
                            {profile.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {bulkMode && canBulkSelect && (
                    <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => { setBulkMode(false); setSelectedOppIds(new Set()); }} aria-label="Sair do modo seleção">
                      <X className="h-5 w-5" />
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" className="h-11 w-11" aria-label="Nova Oportunidade">
                        <Plus className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setNewLeadDialogOpen(true)}>
                        <User className="h-4 w-4 mr-2" />
                        Novo Lead
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setNewDealDialogOpen(true)}>
                        <Building2 className="h-4 w-4 mr-2" />
                        Cliente da Base
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-3">
            <TabsList className="w-full h-9">
              <TabsTrigger value="oportunidades" className="flex-1 text-xs gap-1">
                Oportunidades
                <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-0.5">{tabCounts.oportunidades}</Badge>
              </TabsTrigger>
              <TabsTrigger value="reunioes" className="flex-1 text-xs gap-1">
                Reuniões
                <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-0.5">{tabCounts.reunioes}</Badge>
              </TabsTrigger>
              <TabsTrigger value="vendas" className="flex-1 text-xs gap-1">
                Vendas
                <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-0.5">{tabCounts.vendas}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {activeTab === 'reunioes' && (
            <div className="mb-3">
              <CloserDateRangeFilter dateRange={meetingDateRange} onDateRangeChange={setMeetingDateRange} label="Reunião" />
            </div>
          )}
          {activeTab === 'vendas' && (
            <div className="mb-3">
              <CloserDateRangeFilter dateRange={wonDateRange} onDateRangeChange={setWonDateRange} label="Ganho em" />
            </div>
          )}

          {/* Mobile Cards List */}
          <div className="divide-y divide-border/50">
            {paginatedOpps.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm">Nenhuma oportunidade encontrada</p>
              </div>
            ) : (
              paginatedOpps.map((opp) => {
                const isTerminal = opp.stage === 'Ganho' || opp.stage === 'Perdido';
                const stuckInfo = isDealStuck(opp);
                const isOverdue = !isTerminal && opp.lead_next_action_at && new Date(opp.lead_next_action_at) < new Date();
                const isSelected = selectedOppIds.has(opp.id);

                return (
                  <div
                    key={opp.id}
                    className={cn(
                      "px-4 py-4 transition-colors active:bg-accent/30",
                      isSelected && 'bg-primary/5',
                      !isTerminal && stuckInfo.stuck && 'border-l-2 border-l-[hsl(var(--chart-2))]',
                    )}
                    onClick={(e) => {
                      if (bulkMode) {
                        handleOppCheckChange(opp.id, !isSelected);
                      } else if (e.ctrlKey || e.metaKey) {
                        window.open(getOppHref(opp), '_blank');
                      } else {
                        handleOpenLeadModal(opp);
                      }
                    }}
                    onTouchStart={() => handleLongPressStart(opp.id)}
                    onTouchEnd={handleLongPressEnd}
                    onTouchCancel={handleLongPressEnd}
                  >
                    <div className="flex items-start gap-3">
                      {bulkMode && canBulkSelect && (
                        <div className="flex-shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isSelected} onCheckedChange={(checked) => handleOppCheckChange(opp.id, !!checked)} className="h-5 w-5" />
                        </div>
                      )}

                      <div className="flex-shrink-0 pt-1.5">
                        {(() => {
                          const now = new Date();
                          const endOfToday = new Date(now);
                          endOfToday.setHours(23, 59, 59, 999);
                          const nextAction = opp.lead_next_action_at ? new Date(opp.lead_next_action_at) : null;
                          const isDueToday = !isTerminal && nextAction && nextAction >= now && nextAction <= endOfToday;
                          
                          if (isOverdue) return <span className="inline-flex w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />;
                          if (isDueToday) return <span className="inline-flex w-2.5 h-2.5 rounded-full bg-chart-1" />;
                          return <span className="inline-flex w-2.5 h-2.5 rounded-full bg-muted-foreground/20" />;
                        })()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[15px] font-semibold text-foreground leading-tight truncate">
                            {opp.lead_company || '—'}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {Number(opp.deal_value) > 0 && (
                              <span className="text-sm font-medium tabular-nums text-foreground">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(opp.deal_value))}
                              </span>
                            )}
                            {!bulkMode && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <MobileCardActions
                                  opp={opp}
                                  onReturn={() => handleOpenReturn(opp)}
                                  onLost={() => handleOpenLost(opp)}
                                  onNotes={() => handleOpenNotes(opp)}
                                  onWon={() => handleOpenChecklist(opp)}
                                  onDelete={(isAdmin || isManager) ? () => handleOpenSingleDelete(opp) : undefined}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground truncate mb-2">
                          {opp.lead_name || '—'}
                        </p>

                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                            {STAGE_ICONS[opp.stage]}
                            {STAGE_LABELS_MAP[opp.stage] || opp.stage}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {opp.lead_next_action_at && (
                            <span className={cn(isOverdue && 'text-destructive font-medium')}>
                              {formatNextAction(new Date(opp.lead_next_action_at), opp.lead_status || '')}
                            </span>
                          )}
                          {opp.lead_temperature && (
                            <>
                              <span className="text-border">·</span>
                              <TemperatureDisplay temperature={opp.lead_temperature as LeadTemperature} />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {hasMoreMobile && (
            <div className="py-6 flex justify-center">
              <Button variant="outline" className="h-11 px-8" onClick={() => setMobileLoadedPages(p => p + 1)}>
                Carregar mais
              </Button>
            </div>
          )}

          {totalResults > 0 && (
            <p className="text-center text-xs text-muted-foreground py-3">
              {Math.min(mobileLoadedPages * itemsPerPage, totalResults)} de {totalResults}
            </p>
          )}
        </div>

        {/* === DESKTOP LAYOUT (sm+) === */}
        <div className={cn("hidden sm:flex sm:flex-col", viewMode === 'kanban' && activeTab === 'oportunidades' ? 'flex-1 min-h-0' : '')}>
          <PageHeader
            icon={<Handshake className="h-5 w-5" />}
            title="Oportunidades"
            actions={
              <div className="flex items-center gap-2">
                {(isAdmin || isManager) && (
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
                          meetingFrom: activeTab === 'reunioes' && meetingDateRange.from ? startOfDay(meetingDateRange.from).toISOString() : null,
                          meetingTo: activeTab === 'reunioes' && meetingDateRange.to ? endOfDay(meetingDateRange.to).toISOString() : null,
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
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="h-8 text-xs font-medium">
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      <span className="hidden sm:inline">Nova Oportunidade</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setNewLeadDialogOpen(true)}>
                      <User className="h-4 w-4 mr-2" />
                      Novo Lead
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewDealDialogOpen(true)}>
                      <Building2 className="h-4 w-4 mr-2" />
                      Cliente da Base
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
            toolbar={
              <div className="space-y-3">
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                  <TabsList className="h-9">
                    <TabsTrigger value="oportunidades" className="text-xs gap-1.5 px-4">
                      Oportunidades
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{tabCounts.oportunidades}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="reunioes" className="text-xs gap-1.5 px-4">
                      Próximas Reuniões
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{tabCounts.reunioes}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="vendas" className="text-xs gap-1.5 px-4">
                      Vendas Realizadas
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{tabCounts.vendas}</Badge>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Row 1: Filter chips */}
                {activeTab === 'oportunidades' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <LeadAdvancedFilter selectedStatuses={advancedFilterStatuses} onSelectedStatusesChange={setAdvancedFilterStatuses} mode="closer" />
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
                )}
                {activeTab === 'reunioes' && (
                  <CloserDateRangeFilter dateRange={meetingDateRange} onDateRangeChange={setMeetingDateRange} label="Reunião" />
                )}
                {activeTab === 'vendas' && (
                  <CloserDateRangeFilter dateRange={wonDateRange} onDateRangeChange={setWonDateRange} label="Ganho em" />
                )}

                {/* Row 2: Search + controls */}
                <div className="flex items-center gap-2">
                  <GlobalSearchDropdown
                    onSelect={handleGlobalSearchSelect}
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
                          <Select value={kanbanSortBy} onValueChange={(v) => { setKanbanSortBy(v as SortOption); localStorage.setItem('closer_kanban_sort', v); }}>
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
                            onFieldsChange={(f) => { setKanbanCardFields(f); saveFieldConfig('closer-kanban', f); }}
                            defaultFields={KANBAN_CARD_DEFAULTS}
                          />
                        </>
                      )}
                      <div className="flex items-center border border-border/60 rounded-md overflow-hidden">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => { setViewMode('list'); localStorage.setItem('closer_view_mode', 'list'); }}>
                              <LayoutList className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">Lista</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => { setViewMode('kanban'); localStorage.setItem('closer_view_mode', 'kanban'); }}>
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
              onDeleteOpp={(isAdmin || isManager) ? handleOpenSingleDelete : undefined}
              getOppHref={getOppHref}
              isMoving={moveStage.isPending}
              isLoading={kanbanLoading}
              currentUserId={currentUser?.id ?? null}
              isManager={isAdmin || isManager}
              onLoadMore={handleKanbanLoadMore}
            />
          )}

          {(viewMode === 'list' || activeTab !== 'oportunidades') && (
            <>
              <CloserTableView
                opportunities={paginatedOpps}
                canBulkSelect={canBulkSelect}
                isAdmin={isAdmin}
                isManager={isManager}
                selectedOppIds={selectedOppIds}
                onOppCheckChange={handleOppCheckChange}
                onCheckAllChange={handleCheckAllChange}
                onCardClick={handleOpenLeadModal}
                getOppHref={getOppHref}
                onReturn={handleOpenReturn}
                onLost={handleOpenLost}
                onNotes={handleOpenNotes}
                onWon={handleOpenChecklist}
                onDelete={(isAdmin || isManager) ? handleOpenSingleDelete : undefined}
                onStageChange={(id, stage) => moveStage.mutate({ id, stage })}
                tab={activeTab}
                sorting={tableSorting}
                onSortingChange={(s) => { setTableSorting(s); setCurrentPage(1); }}
              />

              {totalResults > 0 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Mostrar</span>
                    <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); localStorage.setItem('closer_items_per_page', v); }}>
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
                  onClick={() => {
                    setReason(option === 'Outro' ? '' : option);
                    setReturnSelected(option);
                  }}
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
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Adicione observações sobre esta oportunidade..." className="bg-background min-h-[120px]" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => { if (selectedOpp) updateNotes.mutate({ id: selectedOpp.id, notes }); setNotesDialogOpen(false); }}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Actions Bar */}
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
          showDelete={isAdmin || isManager}
        />
      )}

      {/* Reassign Dialog */}
      <LeadReassignDialog
        open={reassignDialogOpen}
        onOpenChange={setReassignDialogOpen}
        selectedLeadIds={Array.from(selectedOppIds)}
        onReassignComplete={handleReassignComplete}
        mode="closer"
      />

      {/* Delete Dialog */}
      <DeleteLeadDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        leadCount={selectedOppIds.size}
        onConfirm={handleBulkDelete}
        isDeleting={isDeleting}
        entityLabel="Oportunidade"
      />

      {/* Lead Detail Modal */}
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

      <NewLeadDialog
        open={newLeadDialogOpen}
        onOpenChange={setNewLeadDialogOpen}
        onLeadCreated={handleNewLeadCreated}
      />
      <NewDealFromClientDialog
        open={newDealDialogOpen}
        onOpenChange={setNewDealDialogOpen}
        onSuccess={(leadId, oppId) => { openLead(leadId, oppId); }}
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
      {/* Centro de Ações do Closer */}
      <div className="fixed right-6 bottom-6 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="lg" className="rounded-full shadow-lg hover:shadow-xl transition-all gap-2 px-5 h-11">
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">Ações</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-56 mb-2">
            <DropdownMenuItem asChild>
              <Link to="/simulator?type=ez-chat" className="gap-2 cursor-pointer">
                <Calculator className="h-4 w-4" />
                Simulador EZ Chat
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/simulator/evolucao" className="gap-2 cursor-pointer">
                <Calculator className="h-4 w-4" />
                Simulador Evolução
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/simulator?type=ez-call" className="gap-2 cursor-pointer">
                <Calculator className="h-4 w-4" />
                Simulador EZ Call
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/proposals" className="gap-2 cursor-pointer">
                <FileText className="h-4 w-4" />
                Histórico de Propostas
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </div>
    </AppLayout>
  );
};

export default CloserPipelinePage;
