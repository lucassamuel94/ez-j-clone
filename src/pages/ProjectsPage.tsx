import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ProjectFilters } from "@/components/projects/ProjectFilters";
import { ProjectListView } from "@/components/projects/ProjectListView";
import { MyQueueTab } from "@/components/projects/MyQueueTab";
import { ProjectDetailModal } from "@/components/projects/ProjectDetailModal";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { ProjectTrashView } from "@/components/projects/ProjectTrashView";
import { ProjectImportDialog } from "@/components/projects/ProjectImportDialog";
import { GlobalSearchDropdown, GlobalSearchResult } from "@/components/GlobalSearchDropdown";
import { LeadModal } from "@/components/LeadModal";
import { useLeadModal } from "@/hooks/useLeadModal";
import { useUpdateLead } from "@/hooks/useLeads";
import { PageHeader } from "@/components/PageHeader";
import { ProjectsDashboard } from "@/components/projects/ProjectsDashboard";
import {
  ProjectViewConfig,
  FieldConfig,
  loadFieldConfig,
  saveFieldConfig,
} from "@/components/projects/ProjectViewConfig";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects, useUserAssignedProjectIds, useUserPhaseAssignments } from "@/hooks/useProjects";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjectModal } from "@/hooks/useProjectModal";
import { usePosVendaDashboard } from "@/hooks/usePosVendaDashboard";
import { useBlockedProjects } from "@/hooks/useBlockedProjects";
import { useTeamCapacity } from "@/hooks/useTeamCapacity";
import { useApiActivations } from "@/hooks/useApiActivations";
import { useWorkload } from "@/hooks/useWorkload";
import { Loader2, FolderKanban, Plus, Upload, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

const PosVendaResumoTab = lazy(() => import("@/components/posvenda/PosVendaResumoTab"));
const PosVendaFilaTab = lazy(() => import("@/components/posvenda/PosVendaFilaTab"));
const PosVendaTravadosTab = lazy(() => import("@/components/posvenda/PosVendaTravadosTab"));
const PosVendaEquipesTab = lazy(() => import("@/components/posvenda/PosVendaEquipesTab"));
const PosVendaApiActivationTab = lazy(() => import("@/components/posvenda/PosVendaApiActivationTab"));
const PosVendaWorkloadTab = lazy(() => import("@/components/posvenda/PosVendaWorkloadTab"));

// ── Constants ──
const FILTERS_STORAGE_KEY = "projects-filters";
const TAB_STORAGE_KEY = "projects-active-tab-v2";

type UnifiedPeriod = "today" | "week" | "month" | "last_month" | "quarter" | "last_quarter" | "semester";
type Tab = "queue" | "overview" | "dashboard" | "operacional" | "api" | "carga";
type OperacionalSubTab = "fila" | "travados" | "equipes";

const PERIOD_OPTIONS: { value: UnifiedPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "last_month", label: "Mês anterior" },
  { value: "quarter", label: "Este trimestre" },
  { value: "last_quarter", label: "Último trimestre" },
  { value: "semester", label: "Este semestre" },
];

// Map unified period to the hook's expected values
function periodToHookPeriod(p: UnifiedPeriod): "week" | "month" | "quarter" {
  if (p === "today" || p === "week") return "week";
  if (p === "month" || p === "last_month") return "month";
  return "quarter";
}

// Tabs that use the period selector
const TABS_WITH_PERIOD = new Set<Tab>(["dashboard", "operacional", "carga", "overview"]);

// Role-based tab visibility
const ADMIN_TABS = new Set<Tab>(["overview", "dashboard", "operacional", "carga"]);
const API_TAB_ROLES = new Set(["admin", "head_pos_venda", "verificacao_bm"]);

interface TabOption {
  value: Tab;
  label: string;
}

function getVisibleTabs(role: string | null | undefined): TabOption[] {
  const tabs: TabOption[] = [{ value: "queue", label: "Minha Fila" }];

  const r = role || "";
  const isAdminLike = r === "admin" || r === "head_pos_venda" || r === "ux_po";

  if (isAdminLike) {
    tabs.push({ value: "overview", label: "Visão Geral" });
    tabs.push({ value: "dashboard", label: "Dashboard" });
    tabs.push({ value: "operacional", label: "Operacional" });
  }

  if (API_TAB_ROLES.has(r)) {
    tabs.push({ value: "api", label: "Ativação API" });
  }

  if (isAdminLike) {
    tabs.push({ value: "carga", label: "Carga" });
  }

  return tabs;
}

function getDefaultTab(role: string | null | undefined): Tab {
  const r = role || "";
  const isAdminLike = r === "admin" || r === "head_pos_venda" || r === "ux_po";
  return isAdminLike ? "dashboard" : "queue";
}

const DEFAULT_LIST_COLUMNS: FieldConfig[] = [
  { id: "project_number", label: "Nº", visible: true, required: true },
  { id: "company_name", label: "Empresa", visible: true, required: true },
  { id: "project_type", label: "Tipo", visible: true },
  { id: "current_phase", label: "Fase Atual", visible: true },
  { id: "overall_status", label: "Status", visible: true },
  { id: "priority", label: "Prioridade", visible: true },
  { id: "contact_name", label: "Contato", visible: true },
  { id: "created_at", label: "Criado em", visible: true },
  { id: "updated_at", label: "Atualizado em", visible: false },
  { id: "last_comment", label: "Último comentário", visible: false },
];

function loadFilters(): Record<string, string> {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveFilters(filters: Record<string, string>) {
  localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
}

const ProjectsPage = () => {
  const { data: projects, isLoading } = useProjects();
  const { hasPermission } = usePermissions();
  const isAdmin = hasPermission("access_admin");
  const { user: currentUser } = useCurrentUser();
  const { role } = useUserRole();
  const { data: assignedProjectIds } = useUserAssignedProjectIds(currentUser?.id);
  const queryClient = useQueryClient();

  // ── Visible tabs based on role ──
  const visibleTabs = useMemo(() => getVisibleTabs(role), [role]);

  // ── Active tab with localStorage persistence ──
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const saved = localStorage.getItem(TAB_STORAGE_KEY) as Tab | null;
    if (saved && visibleTabs.some((t) => t.value === saved)) return saved;
    return getDefaultTab(role);
  });

  // Update if saved tab not visible for role
  useEffect(() => {
    if (!visibleTabs.some((t) => t.value === activeTab)) {
      setActiveTab(getDefaultTab(role));
    }
  }, [visibleTabs, activeTab, role]);

  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  // ── Period selector ──
  const [period, setPeriod] = useState<UnifiedPeriod>("month");
  const hookPeriod = periodToHookPeriod(period);
  const showPeriod = TABS_WITH_PERIOD.has(activeTab);

  // ── Global search ──
  const [globalSearch, setGlobalSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(globalSearch), 300);
    return () => clearTimeout(t);
  }, [globalSearch]);

  // ── List filters (for overview tab) ──
  const [search, setSearch] = useState(() => loadFilters().search || "");
  const [typeFilter, setTypeFilter] = useState(() => loadFilters().typeFilter || "all");
  const [phaseFilter, setPhaseFilter] = useState(() => loadFilters().phaseFilter || "all");
  const [statusFilter, setStatusFilter] = useState(() => loadFilters().statusFilter || "all");
  const [priorityFilter, setPriorityFilter] = useState(() => loadFilters().priorityFilter || "all");
  const [ownerFilter, setOwnerFilter] = useState(() => loadFilters().ownerFilter || "all");

  useEffect(() => {
    saveFilters({ search, typeFilter, phaseFilter, statusFilter, priorityFilter, ownerFilter });
  }, [search, typeFilter, phaseFilter, statusFilter, priorityFilter, ownerFilter]);

  // ── Modals ──
  const { project: modalProject, isOpen: detailOpen, openProject, closeProject } = useProjectModal();
  const { lead: globalLead, opportunity: globalOpp, isOpen: globalLeadOpen, openLead: openGlobalLead, closeLead: closeGlobalLead } = useLeadModal();
  const updateLeadMutation = useUpdateLead();
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const handleGlobalSearchSelect = useCallback(
    (result: GlobalSearchResult) => openGlobalLead(result.lead_id, result.opportunity_id || undefined),
    [openGlobalLead],
  );
  const handleUpdateLeadFromGlobal = useCallback(
    (lead: any) => updateLeadMutation.mutate(lead),
    [updateLeadMutation],
  );

  // ── List columns ──
  const [listColumns, setListColumns] = useState<FieldConfig[]>(() =>
    loadFieldConfig("list-columns", DEFAULT_LIST_COLUMNS),
  );
  const handleListColumnsChange = useCallback((cols: FieldConfig[]) => {
    setListColumns(cols);
    saveFieldConfig("list-columns", cols);
  }, []);

  const handleProjectCreated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener("project-created", handleProjectCreated);
    return () => window.removeEventListener("project-created", handleProjectCreated);
  }, [handleProjectCreated]);

  // ── isUserOwner ──
  const isUserOwner = useCallback(
    (p: Record<string, unknown>, uid: string) => {
      const phaseAssigned = assignedProjectIds || [];
      return (
        p.closer_user_id === uid ||
        p.created_by_user_id === uid ||
        p.ux_po_user_id === uid ||
        p.dev_user_id === uid ||
        p.treinamento_user_id === uid ||
        p.head_user_id === uid ||
        p.sdr_user_id === uid ||
        (phaseAssigned as string[]).includes(p.id as string)
      );
    },
    [assignedProjectIds],
  );

  const isTrash = statusFilter === "lixeira";

  // ── Filtered list for overview ──
  const filtered = useMemo(() => {
    if (!projects || isTrash) return [];
    const uid = currentUser?.id;
    const normalizeText = (text: string) =>
      text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.\-\/]/g, "");

    return projects.filter((p: Record<string, unknown>) => {
      if (statusFilter === "arquivado") {
        if (!p.archived) return false;
      } else {
        if (p.archived) return false;
        if (statusFilter !== "all" && p.overall_status !== statusFilter) return false;
      }
      if (typeFilter !== "all" && p.project_type !== typeFilter) return false;
      if (priorityFilter !== "all" && p.priority !== priorityFilter) return false;
      if (phaseFilter !== "all" && p.current_phase !== phaseFilter) return false;
      if (ownerFilter === "mine" && uid) {
        if (!isUserOwner(p, uid)) return false;
      }

      // Apply global search OR local search
      const q = debouncedSearch.trim() || search.trim();
      if (q) {
        const nq = normalizeText(q);
        const matchName = p.company_name ? normalizeText(p.company_name as string).includes(nq) : false;
        const matchCnpj = p.cnpj ? (p.cnpj as string).replace(/[.\-\/]/g, "").includes(nq) : false;
        const matchContact = p.contact_name ? normalizeText(p.contact_name as string).includes(nq) : false;
        const matchNumber = (p.project_number as number)?.toString().includes(nq);
        if (!matchName && !matchCnpj && !matchContact && !matchNumber) return false;
      }

      return true;
    });
  }, [projects, search, debouncedSearch, typeFilter, phaseFilter, statusFilter, priorityFilter, ownerFilter, currentUser, isUserOwner, isTrash]);

  const handleSelectProject = (project: { id: string }) => openProject(project.id);

  // ── Dashboard hooks (conditional) ──
  const isDashboardTab = activeTab === "dashboard";
  const isOperacionalTab = activeTab === "operacional";
  const isApiTab = activeTab === "api";
  const isCargaTab = activeTab === "carga";

  const { data: posVendaData, isLoading: posVendaLoading } = usePosVendaDashboard(hookPeriod);
  const { data: blockedData, isLoading: blockedLoading } = useBlockedProjects(hookPeriod, isOperacionalTab);
  const { data: teamsData, isLoading: teamsLoading } = useTeamCapacity(hookPeriod, isOperacionalTab);
  const { data: apiData, isLoading: apiLoading } = useApiActivations(hookPeriod, isApiTab);
  const { data: workloadData, isLoading: workloadLoading } = useWorkload(hookPeriod, isCargaTab);

  // ── Operacional sub-tab ──
  const [opSubTab, setOpSubTab] = useState<OperacionalSubTab>("fila");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="bg-background min-h-screen">
        <main className="space-y-0 p-3 sm:p-4 md:p-6 pb-20">
          <PageHeader
            icon={<FolderKanban className="h-5 w-5" strokeWidth={1.5} />}
            title="Projetos"
            count={projects?.length || 0}
            sticky
            actions={
              <>
                {isAdmin && (
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1 px-2.5 rounded-md" onClick={() => setImportOpen(true)}>
                    <Upload className="h-3.5 w-3.5" strokeWidth={2} />
                    <span className="hidden sm:inline">Importar</span>
                  </Button>
                )}
                {isAdmin && (
                  <Button size="sm" className="h-8 text-xs gap-1 px-2.5 rounded-md" onClick={() => setNewProjectOpen(true)}>
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    <span className="hidden sm:inline">Novo</span>
                  </Button>
                )}
              </>
            }
            toolbar={
              <div className="space-y-2">
                {/* Search + period */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar empresa, nº, tipo, fase…"
                      value={globalSearch}
                      onChange={(e) => setGlobalSearch(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  {showPeriod && (
                    <Select value={period} onValueChange={(v) => setPeriod(v as UnifiedPeriod)}>
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERIOD_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-border/40 overflow-x-auto -mb-[1px]">
                  {visibleTabs.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setActiveTab(t.value)}
                      className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                        activeTab === t.value
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            }
          />

          {/* ── Tab content ── */}
          <div className="mt-2">
            {/* Minha Fila */}
            {activeTab === "queue" && (
              <MyQueueTab onSelectProject={handleSelectProject} globalSearch={debouncedSearch} />
            )}

            {/* Visão Geral */}
            {activeTab === "overview" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <ProjectFilters
                      search={search}
                      onSearchChange={setSearch}
                      typeFilter={typeFilter}
                      onTypeFilterChange={setTypeFilter}
                      phaseFilter={phaseFilter}
                      onPhaseFilterChange={setPhaseFilter}
                      statusFilter={statusFilter}
                      onStatusFilterChange={setStatusFilter}
                      priorityFilter={priorityFilter}
                      onPriorityFilterChange={setPriorityFilter}
                      ownerFilter={ownerFilter}
                      onOwnerFilterChange={setOwnerFilter}
                      totalCount={projects?.length || 0}
                      filteredCount={filtered.length}
                    />
                  </div>
                  <div className="shrink-0 self-end">
                    <ProjectViewConfig
                      title="Configurar Colunas"
                      fields={listColumns}
                      onFieldsChange={handleListColumnsChange}
                      defaultFields={DEFAULT_LIST_COLUMNS}
                    />
                  </div>
                </div>
                {isTrash ? (
                  <ProjectTrashView />
                ) : (
                  <ProjectListView projects={filtered as never[]} onSelect={handleSelectProject} columns={listColumns} />
                )}
              </div>
            )}

            {/* Dashboard */}
            {activeTab === "dashboard" && (
              <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
                <ProjectsDashboard projects={projects || []} onSelectProject={handleSelectProject} />
                {posVendaLoading ? (
                  <div className="space-y-4 mt-6">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 rounded-lg" />
                      ))}
                    </div>
                    <Skeleton className="h-64 rounded-xl" />
                  </div>
                ) : posVendaData ? (
                  <div className="mt-6">
                    <div className="border-b border-border pb-2 mb-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Pós-venda
                      </span>
                    </div>
                    <PosVendaResumoTab
                      kpis={posVendaData.kpis}
                      teamDeliveryBars={posVendaData.teamDeliveryBars}
                      typeTimeBars={posVendaData.typeTimeBars}
                      typeDonut={posVendaData.typeDonut}
                      riskProjects={posVendaData.riskProjects}
                      deliveryHistory={posVendaData.deliveryHistory}
                    />
                  </div>
                ) : null}
              </Suspense>
            )}

            {/* Operacional */}
            {activeTab === "operacional" && (
              <div className="space-y-4">
                {/* Sub-tabs */}
                <div className="flex gap-1 bg-card border border-border rounded-lg p-0.5 w-fit">
                  {(
                    [
                      { value: "fila" as OperacionalSubTab, label: "Fila de projetos" },
                      { value: "travados" as OperacionalSubTab, label: "Travados" },
                      { value: "equipes" as OperacionalSubTab, label: "Equipes" },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.value}
                      onClick={() => setOpSubTab(st.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                        opSubTab === st.value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                      )}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
                  {opSubTab === "fila" && (
                    posVendaLoading ? (
                      <Skeleton className="h-64 rounded-xl" />
                    ) : posVendaData ? (
                      <PosVendaFilaTab rows={posVendaData.projectRows} queueKpis={posVendaData.queueKpis} />
                    ) : null
                  )}
                  {opSubTab === "travados" && (
                    blockedLoading ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-20 rounded-lg" />
                          ))}
                        </div>
                        <Skeleton className="h-64 rounded-xl" />
                      </div>
                    ) : blockedData ? (
                      <PosVendaTravadosTab data={blockedData} />
                    ) : null
                  )}
                  {opSubTab === "equipes" && (
                    teamsLoading ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-20 rounded-lg" />
                          ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-64 rounded-xl" />
                          ))}
                        </div>
                      </div>
                    ) : teamsData ? (
                      <PosVendaEquipesTab data={teamsData} />
                    ) : null
                  )}
                </Suspense>
              </div>
            )}

            {/* Ativação API */}
            {activeTab === "api" && (
              <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
                {apiLoading ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 rounded-lg" />
                      ))}
                    </div>
                    <Skeleton className="h-64 rounded-xl" />
                  </div>
                ) : apiData ? (
                  <PosVendaApiActivationTab data={apiData} />
                ) : null}
              </Suspense>
            )}

            {/* Carga */}
            {activeTab === "carga" && (
              <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
                {workloadLoading ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 rounded-lg" />
                      ))}
                    </div>
                    <Skeleton className="h-64 rounded-xl" />
                  </div>
                ) : workloadData ? (
                  <PosVendaWorkloadTab data={workloadData} />
                ) : null}
              </Suspense>
            )}
          </div>
        </main>

        <ProjectDetailModal open={detailOpen} onOpenChange={(open) => { if (!open) closeProject(); }} project={modalProject} />
        <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
        <ProjectImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImportComplete={() => queryClient.invalidateQueries({ queryKey: ["projects"] })}
        />
        <LeadModal
          lead={globalLead}
          open={globalLeadOpen}
          onClose={() => closeGlobalLead()}
          onUpdateLead={handleUpdateLeadFromGlobal}
          mode={globalOpp ? "closer" : "sdr"}
          opportunity={globalOpp as never}
          readOnly
        />
      </div>
    </AppLayout>
  );
};

export default ProjectsPage;
