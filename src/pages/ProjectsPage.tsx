import { useState, useMemo, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ProjectFilters } from "@/components/projects/ProjectFilters";
import { ProjectListView } from "@/components/projects/ProjectListView";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useProjects, useUserAssignedProjectIds, useUserPhaseAssignments } from "@/hooks/useProjects";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useProjectModal } from "@/hooks/useProjectModal";
import { Loader2, FolderKanban, Plus, BarChart3, Eye, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

const FILTERS_STORAGE_KEY = "projects-filters";
const TAB_STORAGE_KEY = "projects-active-tab";

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

const ProjectsPage = () => {
  const { data: projects, isLoading } = useProjects();
  const { hasPermission } = usePermissions();
  const isAdmin = hasPermission('access_admin');
  const { user: currentUser } = useCurrentUser();
  const { data: assignedProjectIds } = useUserAssignedProjectIds(currentUser?.id);
  const { data: phaseAssignments } = useUserPhaseAssignments(currentUser?.id);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState(() => localStorage.getItem(TAB_STORAGE_KEY) || "overview");
  const [search, setSearch] = useState(() => {
    const saved = loadFilters();
    return saved.search || "";
  });
  const [typeFilter, setTypeFilter] = useState(() => {
    const saved = loadFilters();
    return saved.typeFilter || "all";
  });
  const [phaseFilter, setPhaseFilter] = useState(() => {
    const saved = loadFilters();
    return saved.phaseFilter || "all";
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    const saved = loadFilters();
    return saved.statusFilter || "all";
  });
  const [priorityFilter, setPriorityFilter] = useState(() => {
    const saved = loadFilters();
    return saved.priorityFilter || "all";
  });
  const [ownerFilter, setOwnerFilter] = useState(() => {
    const saved = loadFilters();
    return saved.ownerFilter || "all";
  });

  useEffect(() => {
    saveFilters({ search, typeFilter, phaseFilter, statusFilter, priorityFilter, ownerFilter });
  }, [search, typeFilter, phaseFilter, statusFilter, priorityFilter, ownerFilter]);

  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  const { project: modalProject, isOpen: detailOpen, openProject, closeProject } = useProjectModal();
  const { lead: globalLead, opportunity: globalOpp, isOpen: globalLeadOpen, openLead: openGlobalLead, closeLead: closeGlobalLead } = useLeadModal();
  const updateLeadMutation = useUpdateLead();
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const handleGlobalSearchSelect = useCallback((result: GlobalSearchResult) => {
    openGlobalLead(result.lead_id, result.opportunity_id || undefined);
  }, [openGlobalLead]);

  const handleUpdateLeadFromGlobal = useCallback((lead: any) => {
    updateLeadMutation.mutate(lead);
  }, [updateLeadMutation]);

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

  const isUserOwner = useCallback((p: any, uid: string) => {
    const phaseAssigned = assignedProjectIds || [];
    return (
      p.closer_user_id === uid ||
      p.created_by_user_id === uid ||
      p.ux_po_user_id === uid ||
      p.dev_user_id === uid ||
      p.treinamento_user_id === uid ||
      p.head_user_id === uid ||
      p.sdr_user_id === uid ||
      phaseAssigned.includes(p.id)
    );
  }, [assignedProjectIds]);

  const isTrash = statusFilter === "lixeira";

  const filtered = useMemo(() => {
    if (!projects || isTrash) return [];

    const uid = currentUser?.id;

    const normalizeText = (text: string) =>
      text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.\-\/]/g, "");

    return projects.filter((p: any) => {
      // 1. Archive handling
      if (statusFilter === "arquivado") {
        if (!p.archived) return false;
      } else {
        if (p.archived) return false;
        // 2. Status filter
        if (statusFilter !== "all" && p.overall_status !== statusFilter) return false;
      }

      // 3. Type
      if (typeFilter !== "all" && p.project_type !== typeFilter) return false;

      // 4. Priority
      if (priorityFilter !== "all" && p.priority !== priorityFilter) return false;

      // 5. Phase
      if (phaseFilter !== "all" && p.current_phase !== phaseFilter) return false;

      // 6. Owner — always apply, independent of phase
      if (ownerFilter === "mine" && uid) {
        if (!isUserOwner(p, uid)) return false;
      }

      // 7. Text search (accent-normalized)
      if (search.trim()) {
        const q = normalizeText(search);
        const matchName = p.company_name ? normalizeText(p.company_name).includes(q) : false;
        const matchCnpj = p.cnpj ? p.cnpj.replace(/[.\-\/]/g, "").includes(q) : false;
        const matchContact = p.contact_name ? normalizeText(p.contact_name).includes(q) : false;
        const matchNumber = p.project_number?.toString().includes(q);
        if (!matchName && !matchCnpj && !matchContact && !matchNumber) return false;
      }

      return true;
    });
  }, [projects, search, typeFilter, phaseFilter, statusFilter, priorityFilter, ownerFilter, currentUser, isUserOwner, isTrash]);

  const handleSelectProject = (project: any) => {
    openProject(project.id);
  };

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
            className=""
            actions={
              <>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1 px-2.5 rounded-md"
                    onClick={() => setImportOpen(true)}
                  >
                    <Upload className="h-3.5 w-3.5" strokeWidth={2} />
                    <span className="hidden sm:inline">Importar</span>
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1 px-2.5 rounded-md"
                    onClick={() => setNewProjectOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    <span className="hidden sm:inline">Novo</span>
                  </Button>
                )}
              </>
            }
          />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
            <TabsList className="h-9">
              <TabsTrigger value="dashboard" className="text-xs gap-1.5 px-3">
                <BarChart3 className="h-3.5 w-3.5" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="overview" className="text-xs gap-1.5 px-3">
                <Eye className="h-3.5 w-3.5" />
                Visão Geral
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-4">
              <ProjectsDashboard projects={projects || []} onSelectProject={handleSelectProject} />
            </TabsContent>

            <TabsContent value="overview" className="mt-3 space-y-3">
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
                <ProjectListView projects={filtered as any} onSelect={handleSelectProject} columns={listColumns} />
              )}
            </TabsContent>
          </Tabs>
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
          mode={globalOpp ? 'closer' : 'sdr'}
          opportunity={globalOpp as any}
          readOnly
        />
      </div>
    </AppLayout>
  );
};

export default ProjectsPage;
