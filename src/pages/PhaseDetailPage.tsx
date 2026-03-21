import { useState, useMemo, useEffect, useCallback, useRef, DragEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjectModal } from "@/hooks/useProjectModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { ProjectDetailModal } from "@/components/projects/ProjectDetailModal";
import { ProjectDeliveryDialog } from "@/components/projects/ProjectDeliveryDialog";
import { PauseReasonDialog, type TransitionType } from "@/components/projects/PauseReasonDialog";
import { ComplexityLevelDialog } from "@/components/projects/ComplexityLevelDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Wrapper that fetches full project data before opening DeliveryDialog
function DeliveryDialogWithFullData({ open, onOpenChange, projectId, onDelivered }: {
  open: boolean; onOpenChange: (o: boolean) => void; projectId: string; onDelivered: () => void;
}) {
  const { data: fullProject } = useQuery({
    queryKey: ['delivery-full-project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!projectId,
  });
  return <ProjectDeliveryDialog open={open} onOpenChange={onOpenChange} project={fullProject as any || {}} onDelivered={onDelivered} />;
}
import { PageHeader } from "@/components/PageHeader";
import { NewBMVerificationDialog } from "@/components/projects/NewBMVerificationDialog";
import {
  ProjectViewConfig,
  FieldConfig,
  loadFieldConfig,
  saveFieldConfig,
} from "@/components/projects/ProjectViewConfig";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover as DatePopover, PopoverContent as DatePopoverContent, PopoverTrigger as DatePopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { createCuradoriaProject } from "@/services/projectService";

import { usePhaseDetail, PhaseDetailItem } from "@/hooks/usePhaseDetail";
import { PhaseKanbanCard } from "@/components/projects/PhaseKanbanCard";
import { useUpdatePhaseStatus } from "@/hooks/useProjects";
import { useSystemUsers } from "@/hooks/useSystemUsers";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions } from "@/hooks/usePermissions";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";

import { PHASE_LABELS, PHASE_STATUSES, PHASES_BY_TYPE, PRIORITY_LABELS, ProjectPriority, ProjectType } from "@/types/project";
import { usePhaseStatuses } from "@/hooks/usePhaseStatuses";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  ChevronRight,
  Columns3,
  LayoutList,
  Users,
  User,
  Building2,
  ClipboardCheck,
  Palette,
  Code,
  GraduationCap,
  Rocket,
  Cog,
  Brain,
  RadioTower,
  ShieldCheck,
  Calendar,
  CalendarDays,
  Clock,
  Loader2,
  Search,
  Filter,
  Flame,
  Minus,
  SlidersHorizontal,
  MessageSquare,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  X,
  XCircle,
  Plus,
  Check,
  Download,
  Copy,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { useInfiniteColumnScroll } from "@/hooks/useInfiniteColumnScroll";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useSoftDeleteProject } from "@/hooks/useProjects";
import { formatDateBR } from "@/utils/dateFormat";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

const PHASE_ICONS: Record<string, React.ReactNode> = {
  validacao: <ClipboardCheck className="h-4.5 w-4.5" strokeWidth={1.5} />,
  ux_po: <Palette className="h-4.5 w-4.5" strokeWidth={1.5} />,
  dev_chatbot: <Code className="h-4.5 w-4.5" strokeWidth={1.5} />,
  treinamento: <GraduationCap className="h-4.5 w-4.5" strokeWidth={1.5} />,
  ativacao: <Rocket className="h-4.5 w-4.5" strokeWidth={1.5} />,
  automacao: <Cog className="h-4.5 w-4.5" strokeWidth={1.5} />,
  curadoria_ia: <Brain className="h-4.5 w-4.5" strokeWidth={1.5} />,
  go_live_assistido: <RadioTower className="h-4.5 w-4.5" strokeWidth={1.5} />,
  verificacao_bm: <ShieldCheck className="h-4.5 w-4.5" strokeWidth={1.5} />,
};

const priorityConfig: Record<string, { badge: string }> = {
  urgente: { badge: "bg-destructive/10 text-destructive border-destructive/20" },
  alta: { badge: "bg-chart-5/10 text-chart-5 border-chart-5/20" },
  media: { badge: "bg-primary/10 text-primary border-primary/20" },
  baixa: { badge: "bg-muted/30 text-muted-foreground border-border/40" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

type ViewMode = "kanban" | "list";
type DeadlineStatus = "overdue" | "near" | "ok";

function getDeadlineStatus(dueDate: string | null | undefined): DeadlineStatus {
  if (!dueDate) return "ok";
  const now = new Date();
  const d = new Date(dueDate);
  if (d < now) return "overdue";
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (d <= in7days) return "near";
  return "ok";
}

const COMING_SOON_PHASES = new Set<string>();

const PHASE_FILTERS_KEY = "phase-detail-filters";

function loadPhaseFilters(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PHASE_FILTERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePhaseFilters(f: Record<string, string>) {
  localStorage.setItem(PHASE_FILTERS_KEY, JSON.stringify(f));
}

const DEFAULT_PHASE_KANBAN_FIELDS: FieldConfig[] = [
  { id: "company_name", label: "Empresa", visible: true, required: true },
  { id: "project_number", label: "Nº do Projeto", visible: true },
  { id: "priority", label: "Prioridade", visible: true },
  { id: "created_at", label: "Data de Criação", visible: true },
  { id: "updated_at", label: "Atualizado em", visible: false },
  { id: "assigned_user", label: "Responsável", visible: true },
  { id: "contact_name", label: "Contato", visible: false },
  { id: "status", label: "Status", visible: false },
  { id: "last_comment", label: "Último comentário", visible: false },
  { id: "tags", label: "Tags", visible: false },
];

const DEFAULT_PHASE_LIST_COLUMNS: FieldConfig[] = [
  { id: "company_name", label: "Empresa", visible: true, required: true },
  { id: "project_number", label: "Nº", visible: true },
  { id: "status", label: "Status", visible: true },
  { id: "priority", label: "Prioridade", visible: true },
  { id: "assigned_user", label: "Responsável", visible: true },
  { id: "created_at", label: "Criado em", visible: true },
  { id: "updated_at", label: "Atualizado em", visible: false },
  { id: "contact_name", label: "Contato", visible: false },
  { id: "last_comment", label: "Último comentário", visible: false },
  { id: "tags", label: "Tags", visible: false },
];

type SortBy = "created_at" | "updated_at" | "due_date" | "priority" | "name";

const PRIORITY_ORDER: Record<string, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };

type QuickFilterKey = "todos" | "urgente" | "media" | "7dias";

const QUICK_FILTER_META: Record<
  Exclude<QuickFilterKey, "todos">,
  { label: string; icon: React.ReactNode; chipClass: string }
> = {
  urgente: {
    label: "Urgente",
    icon: <Flame className="h-3.5 w-3.5" strokeWidth={1.5} />,
    chipClass: "bg-destructive/10 text-destructive",
  },
  media: {
    label: "Média",
    icon: <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />,
    chipClass: "bg-primary/10 text-primary",
  },
  "7dias": {
    label: "7 dias",
    icon: <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.5} />,
    chipClass: "bg-chart-5/10 text-chart-5",
  },
};

// ──────── New Curadoria Dialog (inline) ────────
function NewCuradoriaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const { data: systemUsers = [] } = useSystemUsers();
  const [saving, setSaving] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<{ id: string; company_name: string; cnpj: string | null } | null>(null);
  const [accountResults, setAccountResults] = useState<{ id: string; company_name: string; cnpj: string | null }[]>([]);
  const [searchingAccounts, setSearchingAccounts] = useState(false);
  const [assignedUserId, setAssignedUserId] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetForm = useCallback(() => {
    setCompanySearch('');
    setSelectedAccount(null);
    setAccountResults([]);
    setAssignedUserId('');
    setDueDate(undefined);
    setContactName('');
    setContactPhone('');
    setContactEmail('');
    setNotes('');
  }, []);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  const handleCompanySearch = useCallback((value: string) => {
    setCompanySearch(value);
    setSelectedAccount(null);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length < 2) { setAccountResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearchingAccounts(true);
      try {
        const { data } = await supabase
          .from('accounts')
          .select('id, company_name, cnpj')
          .or(`company_name.ilike.%${value}%,cnpj.ilike.%${value}%`)
          .limit(10);
        setAccountResults(data || []);
      } catch { setAccountResults([]); }
      finally { setSearchingAccounts(false); }
    }, 400);
  }, []);

  const selectAccount = useCallback((acc: { id: string; company_name: string; cnpj: string | null }) => {
    setSelectedAccount(acc);
    setCompanySearch(acc.company_name);
    setAccountResults([]);
  }, []);

  const isValid = !!((selectedAccount || companySearch.trim()) && dueDate && contactName.trim());

  const handleSubmit = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const projectId = await createCuradoriaProject({
        companyName: selectedAccount?.company_name || companySearch.trim(),
        cnpj: selectedAccount?.cnpj || undefined,
        assignedUserId: assignedUserId || undefined,
        dueDate: dueDate!.toISOString().split('T')[0],
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success('Projeto de curadoria criado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['phase-detail'] });
      queryClient.invalidateQueries({ queryKey: ['phase-project-counts'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar projeto';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">Novo projeto de curadoria</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Criar projeto diretamente na fase Curadoria IA</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Empresa */}
          <div className="space-y-1.5 relative">
            <Label className="text-xs font-medium">Empresa <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                value={companySearch}
                onChange={(e) => handleCompanySearch(e.target.value)}
                className="h-9 text-sm"
              />
              {searchingAccounts && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {accountResults.length > 0 && !selectedAccount && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {accountResults.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    className="flex flex-col w-full px-3 py-2 hover:bg-accent transition-colors text-left"
                    onClick={() => selectAccount(acc)}
                  >
                    <span className="text-sm font-medium">{acc.company_name}</span>
                    {acc.cnpj && <span className="text-xs text-muted-foreground">{acc.cnpj}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Responsável */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Responsável</Label>
            <Select value={assignedUserId} onValueChange={setAssignedUserId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {systemUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prazo */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Prazo <span className="text-destructive">*</span></Label>
            <DatePopover>
              <DatePopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full h-9 text-sm justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                  <Calendar className="h-4 w-4 mr-2" />
                  {dueDate ? format(dueDate, "dd/MM/yyyy") : "Selecione a data"}
                </Button>
              </DatePopoverTrigger>
              <DatePopoverContent className="w-auto p-0" align="start">
                <CalendarPicker mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" />
              </DatePopoverContent>
            </DatePopover>
          </div>

          {/* Contato */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium">Nome do contato <span className="text-destructive">*</span></Label>
              <Input placeholder="Nome completo" value={contactName} onChange={(e) => setContactName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Telefone</Label>
              <Input placeholder="(00) 00000-0000" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="h-9 text-sm" type="tel" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email</Label>
              <Input placeholder="email@empresa.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="h-9 text-sm" type="email" />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Observações</Label>
            <Textarea placeholder="Informações adicionais..." value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[80px] text-sm" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!isValid || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Criar projeto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PhaseDetailPage = () => {
  const { phaseName } = useParams<{ phaseName: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const updatePhaseStatus = useUpdatePhaseStatus();
  const isMobile = useIsMobile();

  const savedFilters = loadPhaseFilters();
  const [onlyMine, setOnlyMine] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>((savedFilters.viewMode as ViewMode) || "kanban");
  const [search, setSearch] = useState("");
  const [assignedFilter, setAssignedFilter] = useState<string[]>([]);
  const [quickFilters, setQuickFilters] = useState<Set<QuickFilterKey>>(new Set(["todos"]));
  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const { project: modalProject, isOpen: detailOpen, openProject, closeProject } = useProjectModal();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [newBmOpen, setNewBmOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newCuradoriaOpen, setNewCuradoriaOpen] = useState(false);
  
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [pendingDeliveryDrop, setPendingDeliveryDrop] = useState<{
    item: PhaseDetailItem; oldStatus: string;
  } | null>(null);

  const [kanbanFields, setKanbanFields] = useState<FieldConfig[]>(() =>
    loadFieldConfig("phase-kanban-fields", DEFAULT_PHASE_KANBAN_FIELDS),
  );
  const [listColumns, setListColumns] = useState<FieldConfig[]>(() =>
    loadFieldConfig("phase-list-columns", DEFAULT_PHASE_LIST_COLUMNS),
  );

  const handleKanbanFieldsChange = useCallback((fields: FieldConfig[]) => {
    setKanbanFields(fields);
    saveFieldConfig("phase-kanban-fields", fields);
  }, []);
  const handleListColumnsChange = useCallback((cols: FieldConfig[]) => {
    setListColumns(cols);
    saveFieldConfig("phase-list-columns", cols);
  }, []);

  useEffect(() => {
    savePhaseFilters({ viewMode });
  }, [viewMode]);

  const { data: systemUsers } = useSystemUsers();
  const { user: currentUser } = useCurrentUser();
  const { hasPermission } = usePermissions();
  const { data: items, isLoading } = usePhaseDetail(phaseName, onlyMine, currentUser?.id);
  const canCreateProject = hasPermission('access_admin') || hasPermission('view_project_phases');
  
  const showCreateButton = canCreateProject && (phaseName === 'validacao' || phaseName === 'ux_po');
  const isCuradoriaPhase = phaseName === 'curadoria_ia';
  const [userSearch, setUserSearch] = useState("");

  // D&D state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const { getStatusesForPhase } = usePhaseStatuses();
  const statuses = phaseName ? getStatusesForPhase(phaseName) : [];
  const phaseLabel = phaseName ? PHASE_LABELS[phaseName] || phaseName : "";

  // Dynamic document title
  useEffect(() => {
    const projectName = modalProject?.company_name;
    document.title = projectName
      ? `${projectName} — ${phaseLabel} | EZ Journey`
      : `${phaseLabel} | EZ Journey`;
    return () => { document.title = "EZ Journey"; };
  }, [modalProject?.company_name, phaseLabel]);

  // Quick filter toggle
  const toggleQuickFilter = useCallback((key: QuickFilterKey) => {
    setQuickFilters((prev) => {
      const next = new Set(prev);
      if (key === "todos") {
        // "Todos" clears everything
        return new Set(["todos"]);
      }
      next.delete("todos");
      if (next.has(key)) {
        next.delete(key);
        if (next.size === 0) next.add("todos");
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setQuickFilters(new Set(["todos"]));
    setAssignedFilter([]);
    setOnlyMine(false);
    setSearch("");
  }, []);

  const hasActiveFilters = !quickFilters.has("todos") || assignedFilter.length > 0 || search.trim().length > 0;

  // Active filter chips data
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; chipClass: string; onRemove: () => void }[] = [];
    (["urgente", "media", "7dias"] as const).forEach((k) => {
      if (quickFilters.has(k)) {
        const meta = QUICK_FILTER_META[k];
        chips.push({
          key: k,
          label: meta.label,
          chipClass: meta.chipClass,
          onRemove: () => toggleQuickFilter(k),
        });
      }
    });
    if (assignedFilter.length > 0) {
      const names = assignedFilter.map((id) => systemUsers?.find((u) => u.id === id)?.name || id).join(", ");
      chips.push({
        key: "assigned",
        label: `Resp: ${names}`,
        chipClass: "bg-muted text-foreground",
        onRemove: () => setAssignedFilter([]),
      });
    }
    return chips;
  }, [quickFilters, assignedFilter, systemUsers, toggleQuickFilter]);

  // Apply local filters + sort
  const filteredItems = useMemo(() => {
    if (!items) return [];
    let result = [...items];

    // Search — expanded to company, project number, assigned user, priority
    if (search.trim()) {
      const q = search.toLowerCase().replace(/[.\-\/]/g, "");
      result = result.filter((i) => {
        const cn = i.project?.company_name?.toLowerCase() || "";
        const pn = `proj-${String(i.project?.project_number || 0).padStart(4, "0")}`;
        const un = i.assigned_user?.name?.toLowerCase() || "";
        const pr = i.project?.priority?.toLowerCase() || "";
        return cn.includes(q) || pn.includes(q) || un.includes(q) || pr.includes(q);
      });
    }

    // Quick filters
    if (quickFilters.has("urgente")) {
      result = result.filter((i) => i.project?.priority === "urgente");
    }
    if (quickFilters.has("media")) {
      result = result.filter((i) => i.project?.priority === "media");
    }
    if (quickFilters.has("7dias")) {
      const now = new Date();
      const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      result = result.filter((i) => {
        if (!i.project?.due_date) return false;
        const d = new Date(i.project.due_date);
        return d <= in7d;
      });
    }

    // Assigned multi-select
    if (assignedFilter.length > 0) {
      result = result.filter((i) => i.assigned_user_id && assignedFilter.includes(i.assigned_user_id));
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "priority") {
        const aP = PRIORITY_ORDER[a.project?.priority || ""] || 0;
        const bP = PRIORITY_ORDER[b.project?.priority || ""] || 0;
        return sortDir === "desc" ? bP - aP : aP - bP;
      }
      if (sortBy === "name") {
        const aName = a.project?.company_name || "";
        const bName = b.project?.company_name || "";
        return sortDir === "asc" ? aName.localeCompare(bName) : bName.localeCompare(aName);
      }
      const aVal =
        sortBy === "created_at"
          ? a.project?.created_at
          : sortBy === "updated_at"
            ? a.project?.updated_at
            : a.project?.due_date;
      const bVal =
        sortBy === "created_at"
          ? b.project?.created_at
          : sortBy === "updated_at"
            ? b.project?.updated_at
            : b.project?.due_date;
      const aTime = aVal ? new Date(aVal).getTime() : 0;
      const bTime = bVal ? new Date(bVal).getTime() : 0;
      return sortDir === "asc" ? aTime - bTime : bTime - aTime;
    });
    return result;
  }, [items, search, quickFilters, assignedFilter, sortBy, sortDir]);

  const totalAllItems = items?.length || 0;

  // Deadline counters (from ALL items, not filtered)
  const { overdueCount, nearCount } = useMemo(() => {
    let overdue = 0,
      near = 0;
    (items || []).forEach((i) => {
      const s = getDeadlineStatus(i.project?.due_date);
      if (s === "overdue") overdue++;
      else if (s === "near") near++;
    });
    return { overdueCount: overdue, nearCount: near };
  }, [items]);

  const grouped = useMemo(() => {
    return statuses.map((status) => ({
      key: status,
      label: status,
      items: filteredItems.filter((i) => i.status === status),
    }));
  }, [filteredItems, statuses]);

  // Unified last-comments query shared between Kanban & List
  const showLastComment = kanbanFields.some(f => f.id === 'last_comment' && f.visible)
    || listColumns.some(f => f.id === 'last_comment' && f.visible);

  const allProjectIds = useMemo(() => filteredItems.map(i => i.project_id), [filteredItems]);

  const { data: lastCommentsData } = useQuery({
    queryKey: ['phase-last-comments', allProjectIds],
    queryFn: async () => {
      if (allProjectIds.length === 0) return [];
      const { data, error } = await supabase
        .from('project_activity_logs')
        .select('project_id, description')
        .in('project_id', allProjectIds)
        .eq('action_type', 'observation')
        .order('created_at', { ascending: false })
        .limit(allProjectIds.length * 3);
      if (error) throw error;
      return data || [];
    },
    enabled: allProjectIds.length > 0 && showLastComment,
    staleTime: 30_000,
  });

  const lastCommentMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!lastCommentsData) return map;
    for (const row of lastCommentsData) {
      if (!map.has(row.project_id)) {
        map.set(row.project_id, row.description);
      }
    }
    return map;
  }, [lastCommentsData]);

  const totalCount = filteredItems.length;
  const isComingSoon = phaseName ? COMING_SOON_PHASES.has(phaseName) : false;

  const isBMPhase = phaseName === "verificacao_bm";

  const handleSelect = (item: PhaseDetailItem) => {
    if (item.project) {
      openProject(item.project.id);
    }
  };

  // D&D handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, item: PhaseDetailItem) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.id);
    setDraggedId(item.id);
  };
  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverColumn(null);
  };
  const handleDragOver = (e: DragEvent<HTMLDivElement>, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(colKey);
  };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverColumn(null);
  };
  const [pauseReasonOpen, setPauseReasonOpen] = useState(false);
  const [pauseReasonType, setPauseReasonType] = useState<TransitionType>("pause");
  const [pendingPauseItem, setPendingPauseItem] = useState<{ item: PhaseDetailItem; targetStatus: string } | null>(null);

  // Complexity level dialog state
  const [complexityDialogOpen, setComplexityDialogOpen] = useState(false);
  const [pendingComplexityItem, setPendingComplexityItem] = useState<{ item: PhaseDetailItem; targetStatus: string } | null>(null);

  // IA confirmation dialog state (dev_chatbot → CONCLUÍDO)
  const [iaDialogOpen, setIaDialogOpen] = useState(false);
  const [iaDialogValue, setIaDialogValue] = useState<boolean | null>(null);
  const [pendingIaItem, setPendingIaItem] = useState<PhaseDetailItem | null>(null);
  const [iaDialogLoading, setIaDialogLoading] = useState(false);

  const executePhaseStatusUpdate = (item: PhaseDetailItem, targetStatus: string, reason?: string) => {
    setTransitioning(true);
    updatePhaseStatus.mutate(
      {
        phaseId: item.id,
        projectId: item.project_id,
        phaseName: item.phase_name,
        newStatus: targetStatus,
        oldStatus: item.status,
        reason,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["phase-detail"] });
          queryClient.invalidateQueries({ queryKey: ["projects"] });
          queryClient.invalidateQueries({ queryKey: ["phase-project-counts"] });
          setTransitioning(false);
        },
        onError: (err: Error) => {
          setTransitioning(false);
          if (err.message?.includes('complexidade')) {
            setPendingComplexityItem({ item, targetStatus });
            setComplexityDialogOpen(true);
          }
        },
      },
    );
  };

  const executeWithPauseCheck = (item: PhaseDetailItem, targetStatus: string) => {
    const upper = targetStatus.toUpperCase();
    if (["PAUSADO", "EM PAUSA"].includes(upper)) {
      setPendingPauseItem({ item, targetStatus });
      setPauseReasonType("pause");
      setPauseReasonOpen(true);
      return;
    }
    if (upper === "CANCELADO") {
      setPendingPauseItem({ item, targetStatus });
      setPauseReasonType("cancel");
      setPauseReasonOpen(true);
      return;
    }
    // IA confirmation for dev_chatbot → CONCLUÍDO (venda, evolucao, migracao)
    if (
      upper === "CONCLUÍDO" &&
      item.phase_name === "dev_chatbot" &&
      item.project?.project_type &&
      ["venda", "evolucao", "migracao"].includes(item.project.project_type)
    ) {
      setPendingIaItem(item);
      // Pre-fill with current has_ai value
      (async () => {
        const { data } = await supabase
          .from("projects")
          .select("has_ai")
          .eq("id", item.project_id)
          .single();
        setIaDialogValue(data?.has_ai ?? null);
        setIaDialogOpen(true);
      })();
      return;
    }
    executePhaseStatusUpdate(item, targetStatus);
  };

  const handleIaDialogConfirm = async () => {
    if (iaDialogValue === null || !pendingIaItem) return;
    setIaDialogLoading(true);
    try {
      // Save has_ai value
      await supabase
        .from("projects")
        .update({ has_ai: iaDialogValue } as any)
        .eq("id", pendingIaItem.project_id);
      // Proceed with phase completion
      executePhaseStatusUpdate(pendingIaItem, "CONCLUÍDO");
      setIaDialogOpen(false);
      setPendingIaItem(null);
    } catch {
      toast.error("Erro ao salvar informação de IA");
    } finally {
      setIaDialogLoading(false);
    }
  };

  const handleDeliveryCompleted = () => {
    if (pendingDeliveryDrop) {
      const drop = pendingDeliveryDrop;
      const projType = drop.item.project?.project_type as ProjectType | undefined;

      executePhaseStatusUpdate(drop.item, "CONCLUÍDO");
      setPendingDeliveryDrop(null);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, targetStatus: string) => {
    e.preventDefault();
    const phaseId = e.dataTransfer.getData("text/plain");
    setDraggedId(null);
    setDragOverColumn(null);

    const item = items?.find((i) => i.id === phaseId);
    if (!item || item.status === targetStatus) return;

    // Item 2: Intercept delivery form for CONCLUÍDO on dev_chatbot or last phase
    if (targetStatus === "CONCLUÍDO" && phaseName) {
      const projType = item.project?.project_type as ProjectType | undefined;
      if (projType) {
        const allPhases = PHASES_BY_TYPE[projType];
        const isLastPhase = allPhases[allPhases.length - 1] === phaseName;
        const requiresDeliveryForm = isLastPhase && phaseName !== "go_live_assistido";
        if (requiresDeliveryForm) {
          setPendingDeliveryDrop({ item, oldStatus: item.status });
          setDeliveryDialogOpen(true);
          return;
        }
      }
    }

    executeWithPauseCheck(item, targetStatus);
  };

  const toggleSortDir = () => setSortDir((d) => (d === "asc" ? "desc" : "asc"));

  // ── Shared filter controls (used in both desktop inline and mobile Sheet) ──
  const renderQuickFilterButtons = (vertical = false) => (
    <div className={cn("flex gap-1.5 flex-wrap", vertical && "flex-col")}>
      {/* Todos */}
      <Button
        variant={quickFilters.has("todos") ? "default" : "ghost"}
        size="sm"
        className={cn("h-8 text-xs font-medium gap-1.5 rounded-lg px-3.5 transition-all duration-200", vertical && "justify-start")}
        onClick={() => toggleQuickFilter("todos")}
      >
        Todos
      </Button>
      {/* Urgente */}
      <Button
        variant={quickFilters.has("urgente") ? "default" : "ghost"}
        size="sm"
        className={cn(
          "h-8 text-xs font-medium gap-1.5 rounded-lg px-3.5 transition-all duration-200",
          quickFilters.has("urgente") &&
            "bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive",
          vertical && "justify-start",
        )}
        onClick={() => toggleQuickFilter("urgente")}
      >
        <Flame className="h-3.5 w-3.5" strokeWidth={1.5} /> Urgente
      </Button>
      {/* Média */}
      <Button
        variant={quickFilters.has("media") ? "default" : "ghost"}
        size="sm"
        className={cn(
          "h-8 text-xs font-medium gap-1.5 rounded-lg px-3.5 transition-all duration-200",
          quickFilters.has("media") && "bg-primary hover:bg-primary/90 text-primary-foreground border-primary",
          vertical && "justify-start",
        )}
        onClick={() => toggleQuickFilter("media")}
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={1.5} /> Média
      </Button>
      {/* 7 dias */}
      <Button
        variant={quickFilters.has("7dias") ? "default" : "ghost"}
        size="sm"
        className={cn(
          "h-8 text-xs font-medium gap-1.5 rounded-lg px-3.5 transition-all duration-200",
          quickFilters.has("7dias") && "bg-chart-5 hover:bg-chart-5/90 text-primary-foreground border-chart-5",
          vertical && "justify-start",
        )}
        onClick={() => toggleQuickFilter("7dias")}
      >
        <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.5} /> 7 dias
      </Button>
    </div>
  );

  const renderResponsavelPopover = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 text-xs font-medium gap-1.5 rounded-lg px-3.5 transition-all duration-200",
            assignedFilter.length > 0 && "border border-primary/30 text-primary bg-primary/5",
          )}
          disabled={onlyMine}
        >
          <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
          {assignedFilter.length === 0
            ? "Responsável"
            : `${assignedFilter.length} selecionado${assignedFilter.length > 1 ? "s" : ""}`}
          {assignedFilter.length > 0 && (
            <button
              className="ml-0.5 rounded-full hover:bg-muted p-0.5"
              onClick={(e) => {
                e.stopPropagation();
                setAssignedFilter([]);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        {/* Search */}
        <div className="p-2 border-b border-border/40">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
            <Input
              placeholder="Buscar agente..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="h-7 pl-7 text-xs bg-muted/30 border-border/30"
            />
          </div>
        </div>
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Responsáveis</span>
          {assignedFilter.length > 0 && (
            <button className="text-[10px] text-primary hover:underline" onClick={() => setAssignedFilter([])}>
              Limpar
            </button>
          )}
        </div>
        <div className="space-y-0.5 max-h-[240px] overflow-y-auto px-1 pb-1">
          {/* "Eu" shortcut */}
          {currentUser &&
            (() => {
              const checked = assignedFilter.includes(currentUser.id);
              return (
                <button
                  className={cn(
                    "flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs transition-colors text-left border-b border-border/20 mb-0.5 pb-2",
                    checked ? "bg-primary/10 text-foreground" : "hover:bg-muted/50 text-muted-foreground",
                  )}
                  onClick={() =>
                    setAssignedFilter((prev) =>
                      prev.includes(currentUser.id)
                        ? prev.filter((id) => id !== currentUser.id)
                        : [...prev, currentUser.id],
                    )
                  }
                >
                  {currentUser.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="Eu" className="h-5 w-5 rounded-full object-cover shrink-0" />
                  ) : (
                    <span
                      className={cn(
                        "flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0",
                        checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {currentUser.name
                        .split(" ")
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                  )}
                  <span className="truncate font-medium">Eu</span>
                  {checked && <Check className="h-3 w-3 ml-auto text-primary shrink-0" />}
                </button>
              );
            })()}
          {(systemUsers || [])
            .filter((u) => !userSearch.trim() || u.name.toLowerCase().includes(userSearch.toLowerCase()))
            .map((u) => {
              const checked = assignedFilter.includes(u.id);
              const initials = u.name
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase();
              return (
                <button
                  key={u.id}
                  className={cn(
                    "flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs transition-colors text-left",
                    checked ? "bg-primary/10 text-foreground" : "hover:bg-muted/50 text-muted-foreground",
                  )}
                  onClick={() =>
                    setAssignedFilter((prev) =>
                      prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id],
                    )
                  }
                >
                  <Checkbox checked={checked} className="h-3.5 w-3.5" />
                  <Avatar className="h-5 w-5 text-[8px] flex-shrink-0">
                    {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.name} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-[8px]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{u.name}</span>
                </button>
              );
            })}
          {(systemUsers || []).filter(
            (u) => !userSearch.trim() || u.name.toLowerCase().includes(userSearch.toLowerCase()),
          ).length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum agente encontrado</p>}
        </div>
      </PopoverContent>
    </Popover>
  );

  const renderSortControls = () => (
    <div className="flex items-center gap-1">
      <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
        <SelectTrigger className="h-8 w-[130px] text-xs font-medium border-border/30 bg-surface-subtle rounded-lg">
          <ArrowUpDown className="h-3.5 w-3.5 mr-1 text-muted-foreground/50" strokeWidth={1.5} />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="created_at">Criação</SelectItem>
          <SelectItem value="updated_at">Atualização</SelectItem>
          <SelectItem value="due_date">Vencimento</SelectItem>
          <SelectItem value="priority">Prioridade</SelectItem>
          <SelectItem value="name">Nome (A-Z)</SelectItem>
        </SelectContent>
      </Select>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={toggleSortDir}>
              {sortDir === "asc" ? (
                <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              ) : (
                <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {sortDir === "asc" ? "Crescente" : "Decrescente"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  return (
    <AppLayout>
      <div className="h-full flex flex-col bg-background overflow-hidden">
        <div className="w-full px-5 md:px-6 py-4 md:py-5 flex flex-col flex-1 min-h-0 gap-0">
          <PageHeader
            icon={phaseName && PHASE_ICONS[phaseName]}
            title={phaseLabel}
            count={totalAllItems}
            badges={
              <>
                
                {overdueCount > 0 && (
                  <Badge className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/15 gap-1 font-medium">
                    <AlertTriangle className="h-3 w-3" strokeWidth={1.5} />
                    {overdueCount} atrasado{overdueCount > 1 ? "s" : ""}
                  </Badge>
                )}
                {nearCount > 0 && (
                  <Badge className="text-[10px] px-2 py-0.5 rounded-full bg-chart-5/10 text-chart-5 border-chart-5/20 hover:bg-chart-5/15 gap-1 font-medium">
                    <CalendarDays className="h-3 w-3" strokeWidth={1.5} />
                    {nearCount} próximo{nearCount > 1 ? "s" : ""}
                  </Badge>
                )}
                {isComingSoon && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium border-chart-5/30 text-chart-5 bg-chart-5/5"
                  >
                    Em breve
                  </Badge>
                )}
              </>
            }
            actions={
              <>
                {showCreateButton && (
                  <Button size="sm" className="h-8 text-xs gap-1.5 rounded-lg" onClick={() => setNewProjectOpen(true)}>
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Novo Projeto
                  </Button>
                )}
                {isBMPhase && (
                  <Button size="sm" className="h-8 text-xs gap-1.5 rounded-lg" onClick={() => setNewBmOpen(true)}>
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Nova Verificação
                  </Button>
                )}
                {isCuradoriaPhase && canCreateProject && (
                  <Button size="sm" className="h-8 text-xs gap-1.5 rounded-lg" onClick={() => setNewCuradoriaOpen(true)}>
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Novo projeto de curadoria
                  </Button>
                )}
                <div className="flex items-center bg-muted/30 rounded-xl p-1 border border-border/30">
                  <button
                    onClick={() => setViewMode("kanban")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                      viewMode === "kanban"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground/60 hover:text-foreground",
                    )}
                  >
                    <Columns3 className="h-3.5 w-3.5" strokeWidth={1.5} /> Kanban
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                      viewMode === "list"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground/60 hover:text-foreground",
                    )}
                  >
                    <LayoutList className="h-3.5 w-3.5" strokeWidth={1.5} /> Lista
                  </button>
                </div>
              </>
            }
            toolbar={
              <>
                <div className="flex items-center gap-2 flex-wrap justify-between">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40"
                      strokeWidth={1.5}
                    />
                    <Input
                      placeholder="Buscar por empresa, PROJ-XXXX, responsável..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 sm:h-9 pl-9 pr-8 text-xs font-normal bg-surface-subtle border-border/30 rounded-xl placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/30 transition-all"
                    />
                    {search && (
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setSearch("")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Desktop: Quick filters + dropdowns inline */}
                  <div className="hidden md:flex items-center gap-2">
                    {renderQuickFilterButtons()}
                    <div className="h-5 w-px bg-border/40" />
                    {renderResponsavelPopover()}
                    {renderSortControls()}
                    {viewMode === "kanban" ? (
                      <ProjectViewConfig
                        title="Configurar Card"
                        fields={kanbanFields}
                        onFieldsChange={handleKanbanFieldsChange}
                        defaultFields={DEFAULT_PHASE_KANBAN_FIELDS}
                      />
                    ) : (
                      <ProjectViewConfig
                        title="Configurar Colunas"
                        fields={listColumns}
                        onFieldsChange={handleListColumnsChange}
                        defaultFields={DEFAULT_PHASE_LIST_COLUMNS}
                      />
                    )}
                  </div>

                  {/* Mobile: Filter button → Sheet */}
                  <div className="md:hidden">
                    <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
                      <SheetTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 text-xs font-medium gap-1.5 rounded-lg relative">
                          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
                          Filtros
                          {hasActiveFilters && !quickFilters.has("todos") && (
                            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
                              {activeChips.length}
                            </span>
                          )}
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="right" className="w-[300px] sm:w-[360px]">
                        <SheetHeader>
                          <SheetTitle>Filtros</SheetTitle>
                        </SheetHeader>
                        <div className="mt-6 space-y-6">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Filtros rápidos
                            </p>
                            {renderQuickFilterButtons(true)}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Responsável
                            </p>
                            {renderResponsavelPopover()}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Ordenar por
                            </p>
                            {renderSortControls()}
                          </div>
                          <div>
                            {viewMode === "kanban" ? (
                              <ProjectViewConfig
                                title="Configurar Card"
                                fields={kanbanFields}
                                onFieldsChange={handleKanbanFieldsChange}
                                defaultFields={DEFAULT_PHASE_KANBAN_FIELDS}
                              />
                            ) : (
                              <ProjectViewConfig
                                title="Configurar Colunas"
                                fields={listColumns}
                                onFieldsChange={handleListColumnsChange}
                                defaultFields={DEFAULT_PHASE_LIST_COLUMNS}
                              />
                            )}
                          </div>
                          <Button className="w-full" onClick={() => setMobileFilterOpen(false)}>
                            Aplicar
                          </Button>
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>

                {/* Active filter chips */}
                {(activeChips.length > 0 || (hasActiveFilters && totalCount !== totalAllItems)) && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {activeChips.map((chip) => (
                      <Badge
                        key={chip.key}
                        variant="secondary"
                        className={cn("text-xs px-2.5 py-1 gap-1.5 cursor-default rounded-full", chip.chipClass)}
                      >
                        {chip.label}
                        <button className="hover:opacity-70 transition-opacity" onClick={chip.onRemove}>
                          <X className="h-3 w-3" strokeWidth={1.5} />
                        </button>
                      </Badge>
                    ))}
                    {activeChips.length > 0 && (
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        onClick={clearAllFilters}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Limpar todos
                      </button>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      Mostrando <strong className="text-foreground">{totalCount}</strong> de {totalAllItems} projetos
                    </span>
                  </div>
                )}
              </>
            }
          />

          {/* Content */}
          {isComingSoon ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <div className="rounded-2xl bg-chart-5/10 p-4 mb-4">
                <Clock className="h-10 w-10 text-chart-5" strokeWidth={1.5} />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Etapa em desenvolvimento</h2>
              <p className="text-sm text-muted-foreground/70 max-w-md text-center">
                A etapa <strong className="text-foreground">{phaseLabel}</strong> estará disponível em breve. Estamos trabalhando para trazer essa
                funcionalidade para você.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-[280px] flex-shrink-0">
                  <Skeleton className="h-4 w-20 mb-3" />
                  <Skeleton className="h-24 w-full mb-2" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ))}
            </div>
          ) : viewMode === "kanban" ? (
            <div className="flex-1 min-h-0">
              <PhaseKanban
                grouped={grouped}
                draggedId={draggedId}
                dragOverColumn={dragOverColumn}
                transitioning={transitioning}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onSelect={handleSelect}
                kanbanFields={kanbanFields}
                lastCommentMap={lastCommentMap}
              />
            </div>
          ) : (
            <PhaseListView grouped={grouped} onSelect={handleSelect} listColumns={listColumns} lastCommentMap={lastCommentMap} />
          )}

          {/* Detail modal */}
          <ProjectDetailModal
            project={modalProject}
            open={detailOpen}
            onOpenChange={(open) => {
              if (!open) {
                closeProject();
                queryClient.invalidateQueries({ queryKey: ["phase-detail"] });
              }
            }}
          />

          {/* Item 2: Delivery dialog for D&D — fetches full project data */}
          {pendingDeliveryDrop && (
            <DeliveryDialogWithFullData
              open={deliveryDialogOpen}
              onOpenChange={(open) => {
                setDeliveryDialogOpen(open);
                if (!open) setPendingDeliveryDrop(null);
              }}
              projectId={pendingDeliveryDrop.item.project_id}
              onDelivered={handleDeliveryCompleted}
            />
          )}


          {/* New BM Verification Dialog */}
          <NewBMVerificationDialog open={newBmOpen} onOpenChange={setNewBmOpen} />
          <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
          {/* New Curadoria Dialog */}
          <NewCuradoriaDialog open={newCuradoriaOpen} onOpenChange={setNewCuradoriaOpen} />
        </div>
      </div>

      <PauseReasonDialog
        open={pauseReasonOpen}
        type={pauseReasonType}
        onConfirm={(reason) => {
          setPauseReasonOpen(false);
          if (pendingPauseItem) {
            executePhaseStatusUpdate(pendingPauseItem.item, pendingPauseItem.targetStatus, reason);
            setPendingPauseItem(null);
          }
        }}
        onCancel={() => {
          setPauseReasonOpen(false);
          setPendingPauseItem(null);
        }}
      />

      <ComplexityLevelDialog
        open={complexityDialogOpen}
        onOpenChange={(v) => {
          setComplexityDialogOpen(v);
          if (!v) setPendingComplexityItem(null);
        }}
        projectId={pendingComplexityItem?.item.project_id || ''}
        onSaved={() => {
          if (pendingComplexityItem) {
            executePhaseStatusUpdate(pendingComplexityItem.item, pendingComplexityItem.targetStatus);
            setPendingComplexityItem(null);
          }
        }}
      />

      {/* IA confirmation dialog for dev_chatbot completion */}
      <AlertDialog open={iaDialogOpen} onOpenChange={(v) => { if (!v) { setIaDialogOpen(false); setPendingIaItem(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Este projeto utiliza IA?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ao concluir a fase de Dev Chatbot, informe se o projeto utiliza Inteligência Artificial. Isso determina as próximas etapas do projeto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 py-2">
            <Button
              variant={iaDialogValue === true ? "default" : "outline"}
              className="flex-1"
              onClick={() => setIaDialogValue(true)}
            >
              <Check className="h-4 w-4 mr-1.5" />
              Sim, utiliza IA
            </Button>
            <Button
              variant={iaDialogValue === false ? "default" : "outline"}
              className="flex-1"
              onClick={() => setIaDialogValue(false)}
            >
              <X className="h-4 w-4 mr-1.5" />
              Não utiliza IA
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingIaItem(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={iaDialogValue === null || iaDialogLoading}
              onClick={(e) => { e.preventDefault(); handleIaDialogConfirm(); }}
            >
              {iaDialogLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Confirmar e concluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

// ──────── Scroll Sentinel ────────
function ScrollSentinel({ onVisible }: { onVisible: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onVisible(); },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible]);
  return <div ref={ref} className="h-1 w-full shrink-0" />;
}

// ──────── Kanban View ────────
function PhaseKanban({
  grouped,
  draggedId,
  dragOverColumn,
  transitioning,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onSelect,
  kanbanFields,
  lastCommentMap,
}: {
  grouped: { key: string; label: string; items: PhaseDetailItem[] }[];
  draggedId: string | null;
  dragOverColumn: string | null;
  transitioning: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>, item: PhaseDetailItem) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent<HTMLDivElement>, colKey: string) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>, targetStatus: string) => void;
  onSelect: (item: PhaseDetailItem) => void;
  kanbanFields: FieldConfig[];
  lastCommentMap: Map<string, string>;
}) {
  const visibleFieldIds = useMemo(
    () => new Set(kanbanFields.filter((f) => f.visible).map((f) => f.id)),
    [kanbanFields]
  );
  const softDelete = useSoftDeleteProject();

  const handleSoftDelete = useCallback(
    (projectId: string, currentStatus: string) => {
      softDelete.mutate({ projectId, currentStatus });
    },
    [softDelete]
  );

  const stableOnSelect = useCallback(
    (item: PhaseDetailItem) => onSelect(item),
    [onSelect]
  );

  // Infinite scroll
  const infiniteColumns = useMemo(() => grouped.map((g) => ({ id: g.key, items: g.items })), [grouped]);
  const { getVisibleItems, hasMore, loadMore, remainingCount } = useInfiniteColumnScroll(infiniteColumns);

  if (grouped.every((g) => g.items.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Building2 className="h-10 w-10 mb-3 opacity-40" strokeWidth={1.5} />
        <p className="text-sm font-medium">Nenhum projeto nesta etapa</p>
        <p className="text-xs mt-1">Ajuste o filtro ou aguarde novos projetos.</p>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      {transitioning && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg">
          <div className="flex items-center gap-2 bg-card border rounded-lg px-4 py-2.5 shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs font-medium text-foreground">Movendo...</span>
          </div>
        </div>
      )}
      <ScrollArea className="w-full flex-1">
        <div className="flex gap-3 pb-4 min-w-max h-full pt-2">
          {grouped.map((col) => {
            const visibleItems = getVisibleItems(col.key, col.items);
            const showMore = hasMore(col.key, col.items.length);
            const remaining = remainingCount(col.key, col.items.length);

            return (
              <div
                key={col.key}
                className={cn(
                  "w-[260px] sm:w-[280px] flex-shrink-0 rounded-xl bg-muted/50 dark:bg-muted/30 border border-border/40 flex flex-col max-h-full transition-all duration-200",
                  dragOverColumn === col.key && draggedId && "ring-2 ring-primary/20",
                )}
                onDragOver={(e) => onDragOver(e, col.key)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, col.key)}
              >
                {/* Column header */}
                <div className="flex items-center gap-2 p-3 border-b border-border/30 rounded-t-xl shrink-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-primary" />
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{col.label}</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold tabular-nums ml-auto">
                    {col.items.length}
                  </Badge>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-1.5 min-h-[120px] flex-1 overflow-y-auto">
                  {visibleItems.map((item) => (
                    <PhaseKanbanCard
                      key={item.id}
                      item={item}
                      isDragged={draggedId === item.id}
                      visibleFieldIds={visibleFieldIds}
                      lastComment={lastCommentMap.get(item.project_id)}
                      onSelect={stableOnSelect}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onSoftDelete={handleSoftDelete}
                    />
                  ))}

                  {visibleItems.length === 0 && (
                    <div className="rounded-lg border-dashed border-2 border-border/30 p-8 text-center flex flex-col items-center gap-2">
                      <Plus className="h-4 w-4 text-muted-foreground/30" strokeWidth={1.5} />
                      <p className="text-xs text-muted-foreground/40">Nenhum projeto</p>
                    </div>
                  )}

                  {showMore && (
                    <>
                      <ScrollSentinel onVisible={() => loadMore(col.key)} />
                      <button
                        type="button"
                        onClick={() => loadMore(col.key)}
                        className="flex items-center justify-center gap-1.5 py-2 w-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                        Carregar mais {remaining}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

// ──────── List View (Flat Table) ────────
function PhaseListView({
  grouped,
  onSelect,
  listColumns,
  lastCommentMap,
}: {
  grouped: { key: string; label: string; items: PhaseDetailItem[] }[];
  onSelect: (item: PhaseDetailItem) => void;
  listColumns: FieldConfig[];
  lastCommentMap: Map<string, string>;
}) {
  const visibleCols = listColumns.filter((c) => c.visible);
  const allItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  if (allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Building2 className="h-10 w-10 mb-3 opacity-40" strokeWidth={1.5} />
        <p className="text-sm font-medium">Nenhum projeto nesta etapa</p>
      </div>
    );
  }

  const renderCell = (col: FieldConfig, item: PhaseDetailItem) => {
    switch (col.id) {
      case "company_name":
        return (
          <TableCell key={col.id} className="text-sm font-medium text-foreground">
            {item.project?.company_name || "Sem nome"}
          </TableCell>
        );
      case "project_number":
        return (
          <TableCell key={col.id} className="text-xs font-mono text-muted-foreground">
            #{item.project?.project_number}
          </TableCell>
        );
      case "status":
        return (
          <TableCell key={col.id}>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 rounded-full border-border/30 font-normal">
              {item.status}
            </Badge>
          </TableCell>
        );
      case "priority":
        return (
          <TableCell key={col.id}>
            {item.project?.priority ? (
              <Badge
                variant="outline"
                className={cn("text-[10px] px-1.5 py-0 h-5 border rounded-full", priorityConfig[item.project.priority]?.badge)}
              >
                {PRIORITY_LABELS[item.project.priority as ProjectPriority] || item.project.priority}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground/30">—</span>
            )}
          </TableCell>
        );
      case "assigned_user":
        return (
          <TableCell key={col.id}>
            <div className="flex items-center gap-2">
              {item.assigned_user ? (
                <>
                  <Avatar className="h-5 w-5 text-[8px] flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-[8px]">
                      {getInitials(item.assigned_user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">{item.assigned_user.name}</span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground/30">—</span>
              )}
            </div>
          </TableCell>
        );
      case "created_at":
        return (
          <TableCell key={col.id} className="text-xs text-muted-foreground">
            {item.project?.created_at ? formatDateBR(item.project.created_at) : "—"}
          </TableCell>
        );
      case "updated_at":
        return (
          <TableCell key={col.id} className="text-xs text-muted-foreground">
            {item.project?.updated_at ? formatDateBR(item.project.updated_at) : "—"}
          </TableCell>
        );
      case "contact_name":
        return (
          <TableCell key={col.id} className="text-xs text-muted-foreground truncate max-w-[150px]">
            {item.project?.contact_name || "—"}
          </TableCell>
        );
      case "last_comment": {
        const comment = lastCommentMap.get(item.project_id);
        return (
          <TableCell key={col.id}>
            {comment ? (
              <div className="flex items-start gap-1.5 max-w-[200px]">
                <MessageSquare className="h-3 w-3 text-muted-foreground/30 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                <span className="text-xs text-muted-foreground truncate">{comment}</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/20">—</span>
            )}
          </TableCell>
        );
      }
      default:
        return <TableCell key={col.id}>—</TableCell>;
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="border border-border/20 rounded-xl overflow-hidden bg-card dark:bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-surface-subtle dark:bg-muted/15">
              {visibleCols.map((col) => (
                <TableHead
                  key={col.id}
                  className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 h-8"
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.filter((group) => group.items.length > 0).map((group) => (
              <>
                {/* Group separator row */}
                <TableRow key={`group-${group.key}`} className="hover:bg-transparent border-b-0">
                  <TableCell
                    colSpan={visibleCols.length}
                    className="py-1.5 px-4 bg-[#F5F3F7]/60 dark:bg-muted/10 border-b border-border/10"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/50 flex-shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        {group.label}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground/35 tabular-nums">
                        {group.items.length}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
                {group.items.map((item) => {
                  const deadline = getDeadlineStatus(item.project?.due_date);
                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        "cursor-pointer hover:bg-[#F5F3F7] dark:hover:bg-muted/20 transition-colors duration-150",
                        deadline === "overdue" && "bg-destructive/5",
                        deadline === "near" && "bg-chart-5/5",
                      )}
                      onClick={() => onSelect(item)}
                    >
                      {visibleCols.map((col) => renderCell(col, item))}
                    </TableRow>
                  );
                })}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default PhaseDetailPage;
