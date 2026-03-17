import { useState, useEffect, useMemo, useCallback } from "react";
import { sanitizeHtml } from '@/utils/sanitize';
import { ProjectTagsEditor } from "./ProjectTagsEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListGroup } from "@/components/kibo-ui/list";
import { ProjectDeliveryDialog } from "./ProjectDeliveryDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ProjectPhaseTimeline } from "./ProjectPhaseTimeline";
import { ProjectActivitySidebar } from "./ProjectActivitySidebar";
import { ProjectAttachments } from "./ProjectAttachments";
import { ProjectPhaseOwners } from "./ProjectPhaseOwners";
import { useProjectPhases, useProjectTransitions, useUpdatePhaseStatus, useForcePhaseMove, useSoftDeleteProject } from "@/hooks/useProjects";
import { PauseReasonDialog, type TransitionType } from "./PauseReasonDialog";
import {
  PROJECT_TYPE_LABELS,
  PHASE_LABELS,
  PRIORITY_LABELS,
  PHASE_STATUSES,
  PHASES_BY_TYPE,
  ALL_PHASES,
  ProjectType,
} from "@/types/project";
import { usePhaseStatuses } from "@/hooks/usePhaseStatuses";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDateBR } from "@/utils/dateFormat";
import { updateProjectFields } from "@/services/projectTaskService";
import { useQueryClient } from "@tanstack/react-query";
import { useSystemUsers } from "@/hooks/useSystemUsers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import {
  User,
  Phone,
  Mail,
  FileText,
  Calendar as CalendarIcon,
  Hash,
  Loader2,
  Pencil,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  Check,
  FileUp,
  Flag,
  Building2,
  Code,
  CreditCard,
  Radio,
  Plug,
  Layers,
  Globe,
  Copy,
  Link2,
  Eye,
  EyeOff,
  Trash2,
  ArrowRightLeft,
  Figma,
} from "lucide-react";

interface ProjectDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Record<string, any> | null;
  topSlot?: React.ReactNode;
}

const statusLabels: Record<string, string> = {
  ativo: "Ativo",
  em_pausa: "Pausado",
  concluido: "Concluído",
  cancelado: "Cancelado",
  entregue: "Entregue",
};

const statusColors: Record<string, string> = {
  ativo: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  em_pausa: "bg-chart-5/10 text-chart-5 border-chart-5/20",
  concluido: "bg-primary/10 text-primary border-primary/20",
  cancelado: "bg-destructive/10 text-destructive border-destructive/20",
  entregue: "bg-chart-1/10 text-chart-1 border-chart-1/20",
};

const priorityColors: Record<string, string> = {
  baixa: "bg-muted/30 text-muted-foreground border-border/20",
  media: "bg-primary/10 text-primary border-primary/20",
  alta: "bg-chart-5/10 text-chart-5 border-chart-5/20",
  urgente: "bg-destructive/10 text-destructive border-destructive/20",
};

const priorityFlagColors: Record<string, string> = {
  baixa: "text-muted-foreground/50",
  media: "text-primary",
  alta: "text-chart-5",
  urgente: "text-destructive",
};

function calculateDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const days = differenceInDays(endDate, startDate);
  return `${days}d`;
}

// Fields that only admin/head can edit
const ADMIN_EDITABLE_FIELDS = [
  "version",
  "api_type",
  "plan_name",
  "broker",
  "storage_time",
  "cnpj",
  "has_integration",
  "has_coexistence",
  "website",
];
// Fields all users can edit
const ALL_USER_EDITABLE_FIELDS = ["contact_name", "contact_phone"];

// Dropdown options
const FIELD_OPTIONS: Record<string, { label: string; value: string }[]> = {
  api_type: [
    { label: "Oficial", value: "Oficial" },
    { label: "Extra", value: "Extra" },
    { label: "Oficial e Extra", value: "Oficial e Extra" },
  ],

  version: [
    { label: "VP", value: "VP" },
    { label: "V2", value: "V2" },
  ],

  broker: [
    { label: "EZ", value: "EZ" },
    { label: "Gupshup", value: "Gupshup" },
    { label: "Hyper", value: "Hyper" },
  ],

  storage_time: [
    { label: "1 ano", value: "1 ano" },
    { label: "2 anos", value: "2 anos" },
    { label: "3 anos", value: "3 anos" },
    { label: "4 anos", value: "4 anos" },
    { label: "5 anos", value: "5 anos" },
    // Legacy underscore format from DB
    { label: "1 ano", value: "1_ano" },
    { label: "2 anos", value: "2_anos" },
    { label: "3 anos", value: "3_anos" },
    { label: "4 anos", value: "4_anos" },
    { label: "5 anos", value: "5_anos" },
  ],

  has_integration: [
    { label: "Sim", value: "true" },
    { label: "Não", value: "false" },
  ],

  has_coexistence: [
    { label: "Sim", value: "true" },
    { label: "Não", value: "false" },
  ],
};

export function ProjectDetailModal({ open, onOpenChange, project, topSlot }: ProjectDetailModalProps) {
  const { data: phases, isLoading: loadingPhases } = useProjectPhases(project?.id || null);
  const { getStatusesForPhase, allStatuses: _allDbStatuses } = usePhaseStatuses();
  const { data: transitions, isLoading: loadingTransitions } = useProjectTransitions(project?.id || null);
  const updatePhaseStatus = useUpdatePhaseStatus();
  const forcePhaseMove = useForcePhaseMove();
  const { hasPermission } = usePermissions();
  const canEditAdmin = hasPermission('access_admin');
  const canEditProject = canEditAdmin || hasPermission('view_projects');
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const currentPhase = project?.current_phase || "";
  const activePhase = useMemo(
    () => (phases || []).find((p: any) => p.phase_name === currentPhase),
    [phases, currentPhase],
  );
  const phaseOwnerId = activePhase?.assigned_user_id || null;

  // Use shared system users query (same cache as ProjectPhaseOwners)
  const { data: systemUsers = [] } = useSystemUsers();

  const phaseOwnerProfile = useMemo(() => {
    if (!phaseOwnerId) return null;
    return systemUsers.find((u) => u.id === phaseOwnerId) || null;
  }, [phaseOwnerId, systemUsers]);

  const phaseUsers = useMemo(() => {
    if (!phases || phases.length === 0) return {};
    const map: Record<string, { name: string; avatar_url: string | null }> = {};
    for (const phase of phases) {
      const user = systemUsers.find((u) => u.id === phase.assigned_user_id);
      if (user) map[phase.phase_name] = { name: user.name, avatar_url: user.avatar_url };
    }
    return map;
  }, [phases, systemUsers]);

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  
  const [mobileTab, setMobileTab] = useState<string>("details");
  const [showEmptyFields, setShowEmptyFields] = useState(false);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(true);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [descExpanded, setDescExpanded] = useState(false);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [pendingDeliveryPhase, setPendingDeliveryPhase] = useState<{
    phaseId: string;
    phaseName: string;
    oldStatus: string;
  } | null>(null);


  // Reset editData when project changes or editing mode is entered
  const projectId = project?.id;
  useEffect(() => {
    if (project && editing) {
      setEditData({
        company_name: project.company_name || "",
        contact_name: project.contact_name || "",
        contact_phone: project.contact_phone || "",
        contact_email: project.contact_email || "",
        project_description: project.project_description || "",
        overall_status: project.overall_status || "ativo",
        priority: project.priority || "media",
        start_date: project.start_date || null,
        due_date: project.due_date || null,
        notes: project.notes || "",
        version: project.version || "",
        api_type: project.api_type || "",
        plan_name: project.plan_name || "",
        broker: project.broker || "",
        extra_storage: project.extra_storage || "",
      });
    }
  }, [projectId, editing]);

  const updateProjectCache = useCallback(
    (updatedProject: any) => {
      queryClient.setQueryData(["projects"], (old: any[] | undefined) => {
        if (!old) return old;
        return old.map((p: any) => (p.id === updatedProject.id ? updatedProject : p));
      });
      queryClient.setQueryData(["project-by-id", updatedProject.id], updatedProject);
      queryClient.invalidateQueries({ queryKey: ["phase-detail"] });
    },
    [queryClient],
  );

  const handleSave = useCallback(async () => {
    if (!project) return;
    setSaving(true);
    try {
      const updated = await updateProjectFields(project.id, editData);
      updateProjectCache(updated);
      toast.success("Projeto atualizado");
      setEditing(false);
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }, [project, editData, updateProjectCache]);

  const softDelete = useSoftDeleteProject();

  const handleDelete = async () => {
    if (!project) return;
    softDelete.mutate(
      { projectId: project.id, currentStatus: project.overall_status },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  };

  const handleInlineStatusChange = useCallback(
    async (field: string, value: string) => {
      if (!project) return;
      try {
        const updated = await updateProjectFields(project.id, { [field]: value });
        updateProjectCache(updated);
        toast.success("Atualizado");
      } catch {
        toast.error("Erro ao atualizar");
      }
    },
    [project, updateProjectCache],
  );

  const handleInlineFieldSave = useCallback(
    async (field: string, value: string) => {
      if (!project) return;
      try {
        let saveValue: any = value || null;
        if (field === "has_integration" || field === "has_coexistence") {
          saveValue = value === "true" ? true : value === "false" ? false : null;
        }
        if (field === "coexistence_quantity") {
          saveValue = value ? parseInt(value, 10) : null;
          if (saveValue !== null && isNaN(saveValue)) saveValue = null;
        }
        const updated = await updateProjectFields(project.id, { [field]: saveValue });
        updateProjectCache(updated);
        toast.success("Campo atualizado");
      } catch {
        toast.error("Erro ao atualizar");
      }
    },
    [project, updateProjectCache],
  );

  const [pauseReasonOpen, setPauseReasonOpen] = useState(false);
  const [pauseReasonType, setPauseReasonType] = useState<TransitionType>("pause");
  const [pendingPauseParams, setPendingPauseParams] = useState<{
    phaseId: string; phaseName: string; newStatus: string; oldStatus: string;
  } | null>(null);

  const handleStatusChange = useCallback(
    (phaseId: string, phaseName: string, newStatus: string, oldStatus: string) => {
      if (!project) return;

      // Intercept pause/cancel to require reason
      const upper = newStatus.toUpperCase();
      if (["PAUSADO", "EM PAUSA"].includes(upper)) {
        setPendingPauseParams({ phaseId, phaseName, newStatus, oldStatus });
        setPauseReasonType("pause");
        setPauseReasonOpen(true);
        return;
      }
      if (upper === "CANCELADO") {
        setPendingPauseParams({ phaseId, phaseName, newStatus, oldStatus });
        setPauseReasonType("cancel");
        setPauseReasonOpen(true);
        return;
      }

      if (newStatus === "CONCLUÍDO") {
        const projectType = project.project_type as ProjectType;
        const allPhases = PHASES_BY_TYPE[projectType];
        if (allPhases) {
          const isLastPhase = allPhases[allPhases.length - 1] === phaseName;
          const requiresDeliveryForm = (isLastPhase || phaseName === "dev_chatbot") && phaseName !== "go_live_assistido";
          if (requiresDeliveryForm) {
            setPendingDeliveryPhase({ phaseId, phaseName, oldStatus });
            setDeliveryDialogOpen(true);
            return;
          }
        }
      }
      updatePhaseStatus.mutate({ phaseId, projectId: project.id, phaseName, newStatus, oldStatus });
    },
    [project, updatePhaseStatus],
  );

  const handlePauseReasonConfirm = useCallback(
    (reason: string) => {
      if (!project || !pendingPauseParams) return;
      setPauseReasonOpen(false);
      updatePhaseStatus.mutate({
        phaseId: pendingPauseParams.phaseId,
        projectId: project.id,
        phaseName: pendingPauseParams.phaseName,
        newStatus: pendingPauseParams.newStatus,
        oldStatus: pendingPauseParams.oldStatus,
        reason,
      });
      setPendingPauseParams(null);
    },
    [project, pendingPauseParams, updatePhaseStatus],
  );

  const handlePauseReasonCancel = useCallback(() => {
    setPauseReasonOpen(false);
    setPendingPauseParams(null);
  }, []);

  const handleDeliveryCompleted = useCallback(() => {
    if (!project || !pendingDeliveryPhase) return;

    updatePhaseStatus.mutate({
      phaseId: pendingDeliveryPhase.phaseId,
      projectId: project.id,
      phaseName: pendingDeliveryPhase.phaseName,
      newStatus: "CONCLUÍDO",
      oldStatus: pendingDeliveryPhase.oldStatus,
    });
    setPendingDeliveryPhase(null);
  }, [pendingDeliveryPhase, project, updatePhaseStatus]);

  const duration = useMemo(
    () => calculateDuration(project?.start_date, project?.due_date),
    [project?.start_date, project?.due_date],
  );

  // Progress: use PHASES_BY_TYPE total as denominator
  const progressPercent = useMemo(() => {
    const totalPhasesForType =
      project?.project_type && PHASES_BY_TYPE[project.project_type as ProjectType]
        ? PHASES_BY_TYPE[project.project_type as ProjectType].length
        : phases?.length || 1;
    return phases?.length
      ? Math.round((phases.filter((p: any) => p.status === "CONCLUÍDO").length / totalPhasesForType) * 100)
      : 0;
  }, [phases, project?.project_type]);

  const canEditField = useCallback(
    (fieldKey: string): boolean => {
      if (ADMIN_EDITABLE_FIELDS.includes(fieldKey)) return canEditProject;
      if (ALL_USER_EDITABLE_FIELDS.includes(fieldKey)) return true;
      return canEditProject;
    },
    [canEditProject],
  );

  const allCustomFields = useMemo(() => {
    if (!project) return [];
    const fields: {
      key: string;
      label: string;
      value: string | null | undefined;
      icon: React.ReactNode;
      editable?: boolean;
      field?: string;
      copyable?: boolean;
      selectOptions?: { label: string; value: string }[];
      isBooleanField?: boolean;
      linkable?: "url" | "email";
    }[] = [
      {
        key: "cnpj",
        label: "CNPJ",
        value: project.cnpj,
        icon: <Building2 className="h-3.5 w-3.5" strokeWidth={1.5} />,
        editable: true,
        field: "cnpj",
        copyable: true,
      },
      {
        key: "contact_name",
        label: "Responsável",
        value: project.contact_name,
        icon: <User className="h-3.5 w-3.5" strokeWidth={1.5} />,
        editable: true,
        field: "contact_name",
      },
      {
        key: "contact_phone",
        label: "Telefone",
        value: project.contact_phone,
        icon: <Phone className="h-3.5 w-3.5" strokeWidth={1.5} />,
        editable: true,
        field: "contact_phone",
      },
      {
        key: "contact_email",
        label: "E-mail",
        value: project.contact_email,
        icon: <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />,
        editable: true,
        field: "contact_email",
        linkable: "email",
      },
      {
        key: "website",
        label: "Site",
        value: project.website,
        icon: <Globe className="h-3.5 w-3.5" strokeWidth={1.5} />,
        editable: true,
        field: "website",
        copyable: true,
        linkable: "url",
      },
      {
        key: "figma_url",
        label: "Figma",
        value: project.figma_url,
        icon: <Figma className="h-3.5 w-3.5" strokeWidth={1.5} />,
        editable: true,
        field: "figma_url",
        copyable: true,
        linkable: "url",
      },
      {
        key: "version",
        label: "Versão",
        value: project.version,
        icon: <Code className="h-3.5 w-3.5" strokeWidth={1.5} />,
        editable: true,
        field: "version",
        selectOptions: FIELD_OPTIONS.version,
      },
      {
        key: "api_type",
        label: "Tipo de API",
        value: project.api_type,
        icon: <Code className="h-3.5 w-3.5" strokeWidth={1.5} />,
        editable: true,
        field: "api_type",
        selectOptions: FIELD_OPTIONS.api_type,
      },
      {
        key: "plan_name",
        label: "Plano",
        value: project.plan_name,
        icon: <CreditCard className="h-3.5 w-3.5" strokeWidth={1.5} />,
        editable: true,
        field: "plan_name",
      },
      {
        key: "broker",
        label: "Broker",
        value: project.broker,
        icon: <Radio className="h-3.5 w-3.5" strokeWidth={1.5} />,
        editable: true,
        field: "broker",
        selectOptions: FIELD_OPTIONS.broker,
      },
      {
        key: "storage_time",
        label: "Armazenamento",
        value: project.storage_time || project.extra_storage,
        icon: <Layers className="h-3.5 w-3.5" strokeWidth={1.5} />,
        editable: true,
        field: "storage_time",
        selectOptions: FIELD_OPTIONS.storage_time,
      },
      {
        key: "has_integration",
        label: "Integração",
        value: project.has_integration != null ? (project.has_integration ? "Sim" : "Não") : null,
        icon: <Plug className="h-3.5 w-3.5" strokeWidth={1.5} />,
        editable: true,
        field: "has_integration",
        selectOptions: FIELD_OPTIONS.has_integration,
        isBooleanField: true,
      },
      {
        key: "has_coexistence",
        label: "Coexistência",
        value: project.has_coexistence != null ? (project.has_coexistence ? "Sim" : "Não") : null,
        icon: <Layers className="h-3.5 w-3.5" strokeWidth={1.5} />,
        editable: true,
        field: "has_coexistence",
        selectOptions: FIELD_OPTIONS.has_coexistence,
        isBooleanField: true,
      },
      ...(project.has_coexistence
        ? [
            {
              key: "coexistence_quantity",
              label: "Qtd. Coexistência",
              value: project.coexistence_quantity != null ? String(project.coexistence_quantity) : null,
              icon: <Hash className="h-3.5 w-3.5" strokeWidth={1.5} />,
              editable: true,
              field: "coexistence_quantity",
            },
          ]
        : []),
      {
        key: "activation_phone",
        label: "Nº API Oficial",
        value: project.activation_phone,
        icon: <Phone className="h-3.5 w-3.5" strokeWidth={1.5} />,
        editable: true,
        field: "activation_phone",
      },
    ];

    return fields;
  }, [project]);

  const emptyFieldsCount = useMemo(() => allCustomFields.filter((f) => !f.value).length, [allCustomFields]);
  const visibleFields = useMemo(
    () => (showEmptyFields ? allCustomFields : allCustomFields.filter((f) => !!f.value)),
    [allCustomFields, showEmptyFields],
  );

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  }, []);

  if (!project) return null;

  const renderMainContent = () => (
    <div className="px-4 sm:px-6 py-3 sm:py-5 space-y-3 sm:space-y-4 break-words">
      {/* Project Phases — kibo-ui ListGroup */}
      <ListGroup
        label="Fases do Projeto"
        defaultOpen
        actions={
          canEditAdmin && project?.project_type ? (
            <ForcePhaseMovePicker
              projectId={project.id}
              projectType={project.project_type as ProjectType}
              currentPhase={project.current_phase || ""}
              onMove={(targetPhase) => forcePhaseMove.mutate({ projectId: project.id, targetPhaseName: targetPhase })}
              isLoading={forcePhaseMove.isPending}
            />
          ) : undefined
        }
      >
        <div className="px-2 pb-2">
          {loadingPhases ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <ProjectPhaseTimeline
              phases={(phases || []) as any}
              onStatusChange={handleStatusChange}
              availableStatuses={Object.fromEntries(
                Object.keys(PHASE_STATUSES).map((p) => [p, getStatusesForPhase(p)]),
              )}
              canEdit={canEditProject}
              transitions={(transitions || []) as any}
              assignedUsers={phaseUsers || {}}
            />
          )}
          {/* Phase Owners */}
          <div className="mt-3">
            <ProjectPhaseOwners project={project} phases={(phases || []) as any} canEdit={canEditProject} />
          </div>
        </div>
      </ListGroup>

      {/* Description — independently editable */}
      {editing || editingDescription ? (
        <div className="rounded-xl border border-border/30 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
                onClick={() => {
                  if (editingDescription) {
                    setEditingDescription(false);
                    setDescriptionDraft("");
                  } else {
                    setEditing(false);
                  }
                }}
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </Button>
              {editingDescription && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-primary hover:text-primary/80"
                  onClick={async () => {
                    try {
                      const updated = await updateProjectFields(project.id, { project_description: descriptionDraft });
                      updateProjectCache(updated);
                      toast.success("Descrição atualizada");
                      setEditingDescription(false);
                      setDescriptionDraft("");
                    } catch {
                      toast.error("Erro ao salvar");
                    }
                  }}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={2} />
                </Button>
              )}
            </div>
          </div>
          <RichTextEditor
            content={editingDescription ? descriptionDraft : editData.project_description || ""}
            onChange={(html) => {
              if (editingDescription) {
                setDescriptionDraft(html);
              } else {
                setEditData({ ...editData, project_description: html });
              }
            }}
            placeholder="Descreva o projeto..."
            className="text-xs"
          />
        </div>
      ) : project.project_description ? (
        <div className="rounded-xl bg-muted/20 p-4 group/desc relative">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold">
              Descrição
            </span>
            {canEditProject && (
              <button
                className="sm:opacity-0 sm:group-hover/desc:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1"
                onClick={() => {
                  setDescriptionDraft(project.project_description || "");
                  setEditingDescription(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            )}
          </div>
          <div
            className={cn(
              "text-sm text-foreground/80 leading-relaxed mt-2 prose prose-sm max-w-none break-words [overflow-wrap:anywhere] max-h-[240px] overflow-y-auto scroll-smooth",
              isMobile && !descExpanded && "max-h-[100px] overflow-hidden relative",
            )}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(project.project_description) }}
          />
          {isMobile && !descExpanded && project.project_description && project.project_description.length > 200 && (
            <button
              onClick={() => setDescExpanded(true)}
              className="text-[10px] text-primary font-medium mt-1 hover:underline"
            >
              Ver mais...
            </button>
          )}
          {isMobile && descExpanded && (
            <button
              onClick={() => setDescExpanded(false)}
              className="text-[10px] text-primary font-medium mt-1 hover:underline"
            >
              Ver menos
            </button>
          )}
        </div>
      ) : (
        <div
          className="rounded-xl border border-dashed border-border/30 bg-card/50 p-4 cursor-text"
          onClick={() => {
            if (canEditProject) {
              setDescriptionDraft("");
              setEditingDescription(true);
            }
          }}
        >
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</span>
          <p className="text-xs text-muted-foreground/40 italic mt-1.5">Adicione uma descrição...</p>
        </div>
      )}

      {/* Notes */}
      {editing ? (
        <div className="rounded-xl border border-border/30 bg-card p-4 shadow-sm">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observações</span>
          <Textarea
            value={editData.notes}
            onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
            rows={2}
            className="mt-2 text-xs rounded-xl border-border/30"
          />
        </div>
      ) : project.notes ? (
        <div className="rounded-xl border border-border/30 bg-card p-4 shadow-sm">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observações</span>
          <p className="text-sm text-foreground leading-relaxed mt-2">{project.notes}</p>
        </div>
      ) : null}

      {editing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DatePickerField
            label="Data Início"
            value={editData.start_date}
            onChange={(v) => setEditData({ ...editData, start_date: v })}
          />
          <DatePickerField
            label="Data Fim"
            value={editData.due_date}
            onChange={(v) => setEditData({ ...editData, due_date: v })}
          />
        </div>
      )}

      {/* Custom Fields — Atlassian-style with kibo-ui ListGroup */}
      <ListGroup label="Detalhes" count={visibleFields.length} defaultOpen={customFieldsOpen}>
        <div className="divide-y divide-border/10">
          {visibleFields.map((f) => (
            <div key={f.key} className="flex items-center gap-3 px-3 py-2 group hover:bg-muted/30 transition-colors">
              <span className="text-primary/40 flex-shrink-0">{f.icon}</span>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground uppercase tracking-widest min-w-[80px] sm:min-w-[100px] flex-shrink-0 font-semibold">
                {f.label}
              </span>
              <div className="flex-1 min-w-0">
                {f.editable && f.field && f.selectOptions ? (
                  <InlineSelectField
                    label={f.label}
                    field={f.field}
                    value={
                      f.isBooleanField ? (project[f.field] != null ? String(project[f.field]) : "") : f.value || ""
                    }
                    options={f.selectOptions}
                    canEdit={canEditField(f.key)}
                    onSave={handleInlineFieldSave}
                  />
                ) : f.editable && f.field ? (
                  <InlineEditField
                    label={f.label}
                    field={f.field}
                    value={f.value}
                    canEdit={canEditField(f.key)}
                    onSave={handleInlineFieldSave}
                    linkable={f.linkable as "url" | "email" | undefined}
                  />
                ) : (
                  <span className="text-xs text-foreground font-medium truncate block" title={f.value || undefined}>
                    {f.value || <span className="text-muted-foreground/25 italic font-normal">—</span>}
                  </span>
                )}
              </div>
              {f.copyable && f.value && (
                <button
                  onClick={() => handleCopy(f.value!)}
                  className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1"
                >
                  <Copy
                    className="h-3 w-3 text-muted-foreground/30 hover:text-primary transition-colors"
                    strokeWidth={1.5}
                  />
                </button>
              )}
            </div>
          ))}
        </div>
        {emptyFieldsCount > 0 && (
          <button
            onClick={() => setShowEmptyFields(!showEmptyFields)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors px-3 py-2"
          >
            {showEmptyFields ? (
              <EyeOff className="h-3 w-3" strokeWidth={1.5} />
            ) : (
              <Eye className="h-3 w-3" strokeWidth={1.5} />
            )}
            {showEmptyFields ? "Ocultar" : "Mostrar"} {emptyFieldsCount} campos vazios
          </button>
        )}
      </ListGroup>

      {/* Attachments */}
      <ProjectAttachments projectId={project.id} canEdit={canEditProject} />
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "p-0 gap-0 flex flex-col overflow-hidden border-0 shadow-lg [&>button.absolute]:hidden bg-card",
            isMobile
              ? "w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:rounded-2xl"
              : "w-[95vw] max-w-[1366px] h-[90dvh] rounded-2xl",
          )}
        >
          {/* Optional top slot (e.g. queue controls) */}
          {topSlot}

          {/* Header */}
          <DialogHeader className="px-3 sm:px-6 pt-2.5 sm:pt-5 pb-0 flex-shrink-0 space-y-0 border-b-0">
            {/* Top row: breadcrumb + actions */}
            <div className="flex items-center justify-between mb-1 gap-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0 overflow-hidden">
                <span className="font-medium hover:text-foreground transition-colors cursor-default hidden sm:inline">
                  Projetos
                </span>
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 hidden sm:block" strokeWidth={1.5} />
                <span className="font-mono text-[10px] sm:text-xs text-muted-foreground/60 shrink-0">
                  PROJ-{String(project.project_number).padStart(4, "0")}
                </span>
                <div className="w-px h-3.5 bg-border/30 mx-0.5 hidden sm:block" />
                {canEditProject ? (
                  <Select
                    value={project.project_type}
                    onValueChange={(v) => handleInlineStatusChange("project_type", v)}
                  >
                    <SelectTrigger className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0 h-[18px] sm:h-5 rounded-md border-foreground/20 bg-foreground/5 font-semibold text-foreground shrink-0 w-auto min-w-0 gap-1 shadow-none focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="venda" className="text-xs">
                        Venda
                      </SelectItem>
                      <SelectItem value="evolucao" className="text-xs">
                        Evolução
                      </SelectItem>
                      <SelectItem value="migracao" className="text-xs">
                        Migração
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0 h-[18px] sm:h-5 rounded-md border-foreground/20 bg-foreground/5 font-semibold text-foreground shrink-0"
                  >
                    {PROJECT_TYPE_LABELS[project.project_type as ProjectType] || project.project_type}
                  </Badge>
                )}
              </div>
              <div className="flex items-center flex-shrink-0 gap-[8px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-xl text-muted-foreground/80 hover:text-foreground"
                      onClick={() => {
                        const url = `${window.location.origin}/projects?project=${project.id}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Link copiado!");
                      }}
                    >
                      <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Copiar link do projeto</TooltipContent>
                </Tooltip>
                {canEditProject && !editing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-xl text-muted-foreground/80 hover:text-foreground"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </Button>
                )}
                {canEditProject && !editing && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-xl text-muted-foreground/80 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                      <AlertDialogTitle>Mover para lixeira?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O projeto <strong>{project.company_name}</strong> será movido para a lixeira e poderá ser restaurado em até 30 dias.
                      </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          disabled={softDelete.isPending}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {softDelete.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                          Mover para lixeira
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-xl text-muted-foreground/80 hover:text-foreground"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              </div>
            </div>

            {/* Title + progress inline */}
            {editing ? (
              <Input
                value={editData.company_name}
                onChange={(e) => setEditData({ ...editData, company_name: e.target.value })}
                className="text-base font-semibold h-9 rounded-xl border-border/30 mb-1"
              />
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <DialogTitle className="text-[14px] sm:text-lg font-semibold text-foreground tracking-tight leading-tight truncate">
                  {project.company_name}
                </DialogTitle>
                <span className="text-[10px] font-bold text-primary tabular-nums shrink-0">{progressPercent}%</span>
              </div>
            )}

            {/* Tags */}
            <div className="mt-1.5">
              <ProjectTagsEditor
                projectId={project.id}
                tags={Array.isArray(project.tags) ? project.tags : []}
                canEdit={canEditProject}
                onUpdate={(newTags) => {
                  updateProjectCache({ ...project, tags: newTags });
                }}
              />
            </div>

            {/* Grouped status bar */}
            <div className="flex flex-wrap items-center gap-2 px-3 sm:px-6 py-2 mt-2.5 sm:mt-3 border-b border-border/40">
              {/* Group 1: Status + Priority */}
              <div className="flex items-center gap-1.5">
                {canEditProject ? (
                  <Select
                    value={project.overall_status}
                    onValueChange={(v) => handleInlineStatusChange("overall_status", v)}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-7 text-xs w-auto min-w-[60px] px-2 py-1 rounded-md font-medium border-0 shadow-none bg-transparent hover:bg-muted/50 transition-colors gap-1",
                        statusColors[project.overall_status] || "",
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-xs">
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs px-2 py-0.5 h-7 rounded-md font-medium border-0",
                      statusColors[project.overall_status] || "",
                    )}
                  >
                    {statusLabels[project.overall_status] || project.overall_status}
                  </Badge>
                )}
                {canEditProject ? (
                  <Select value={project.priority} onValueChange={(v) => handleInlineStatusChange("priority", v)}>
                    <SelectTrigger
                      className={cn(
                        "h-7 text-xs w-auto min-w-[60px] px-2 py-1 rounded-md font-medium border-0 shadow-none bg-transparent hover:bg-muted/50 transition-colors gap-1",
                        priorityColors[project.priority] || "",
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-xs">
                          <span className="flex items-center gap-1.5">
                            <Flag className={cn("h-3 w-3", priorityFlagColors[k] || "")} strokeWidth={1.5} />
                            {v}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs px-2 py-0.5 h-7 rounded-md font-medium border-0",
                      priorityColors[project.priority] || "",
                    )}
                  >
                    {PRIORITY_LABELS[project.priority as keyof typeof PRIORITY_LABELS] || project.priority}
                  </Badge>
                )}
              </div>

              <span className="text-border hidden sm:inline">·</span>

              {/* Group 2: Phase owner */}
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5 text-[8px]">
                  {phaseOwnerProfile?.avatar_url && (
                    <AvatarImage src={phaseOwnerProfile.avatar_url} alt={phaseOwnerProfile.name} />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {phaseOwnerProfile
                      ? phaseOwnerProfile.name
                          .split(" ")
                          .map((w: string) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()
                      : "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground font-medium truncate max-w-[100px]">
                  {phaseOwnerProfile?.name || <span className="text-muted-foreground/30 italic">Sem dono</span>}
                </span>
              </div>

              <span className="text-border hidden sm:inline">·</span>

              {/* Group 3: Dates */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarIcon className="h-3 w-3 text-muted-foreground/40 shrink-0" strokeWidth={1.5} />
                <span className="font-medium">
                  {project.start_date ? formatDateBR(project.start_date) : "—"}
                </span>
                {project.due_date ? (
                  <>
                    <span className="text-border">·</span>
                    <span className="font-medium">{formatDateBR(project.due_date)}</span>
                    {duration !== "—" && (
                      <>
                        <span className="text-border">·</span>
                        <span className="font-mono text-[10px]">{duration}</span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-border">·</span>
                    <span className="italic text-muted-foreground/50 text-[11px]">em andamento</span>
                  </>
                )}
              </div>
            </div>

            {/* Ultra-thin progress bar */}
            <Progress
              value={progressPercent}
              className="h-[2px] rounded-none [&>div]:bg-primary/60"
            />
          </DialogHeader>

          {/* Body */}
          {isMobile ? (
            <Tabs value={mobileTab} onValueChange={setMobileTab} className="flex flex-col flex-1 overflow-hidden">
              <TabsList className="mx-4 mt-2 h-9 flex-shrink-0 rounded-xl bg-muted/20 p-1">
                <TabsTrigger value="details" className="flex-1 text-xs gap-1 rounded-lg">
                  <FileText className="h-3.5 w-3.5" strokeWidth={1.5} /> Detalhes
                </TabsTrigger>
                <TabsTrigger value="activity" className="flex-1 text-xs gap-1 rounded-lg">
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.5} /> Atividades
                </TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full">{renderMainContent()}</ScrollArea>
              </TabsContent>
              <TabsContent value="activity" className="flex-1 overflow-hidden mt-0">
                <ProjectActivitySidebar
                  projectId={project.id}
                  canEdit={canEditProject}
                  projectData={{
                    contact_email: project.contact_email,
                    contact_name: project.contact_name,
                    company_name: project.company_name,
                    contact_phone: project.contact_phone,
                  }}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="grid grid-cols-[2fr_3fr] flex-1 min-h-0 overflow-hidden">
              {/* Left column — 40% */}
              <div className="overflow-y-auto border-r border-border/40 min-w-0">
                {renderMainContent()}
              </div>
              {/* Right column — 60% */}
              <div className="overflow-y-auto min-w-0">
                <ProjectActivitySidebar
                  projectId={project.id}
                  canEdit={canEditProject}
                  projectData={{
                    contact_email: project.contact_email,
                    contact_name: project.contact_name,
                    company_name: project.company_name,
                    contact_phone: project.contact_phone,
                  }}
                />
              </div>
            </div>
          )}

          {/* Floating save/cancel bar */}
          {editing && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-card border border-border/30 shadow-lg rounded-2xl px-4 py-2.5 animate-in slide-in-from-bottom-4 fade-in duration-200">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs rounded-lg gap-1.5 px-3"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                Cancelar
              </Button>
              <Button size="sm" className="h-8 text-xs rounded-lg gap-1.5 px-4" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" strokeWidth={1.5} />
                )}
                Salvar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {project && (
        <ProjectDeliveryDialog
          open={deliveryDialogOpen}
          onOpenChange={(open) => {
            setDeliveryDialogOpen(open);
            if (!open) setPendingDeliveryPhase(null);
          }}
          project={project}
          onDelivered={handleDeliveryCompleted}
        />
      )}

      <PauseReasonDialog
        open={pauseReasonOpen}
        type={pauseReasonType}
        onConfirm={handlePauseReasonConfirm}
        onCancel={handlePauseReasonCancel}
      />

    </>
  );
}

/* Inline Edit Field — pencil to edit, check to save */
function InlineEditField({
  label,
  field,
  value,
  canEdit,
  onSave,
  linkable,
}: {
  label: string;
  field: string;
  value: string | null | undefined;
  canEdit: boolean;
  onSave: (field: string, value: string) => Promise<void>;
  linkable?: "url" | "email";
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditValue(value || "");
  }, [value]);

  const handleSave = async () => {
    if (editValue !== (value || "")) {
      setSaving(true);
      await onSave(field, editValue);
      setSaving(false);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setEditValue(value || "");
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder={label}
          className="h-8 text-sm flex-1 rounded-md border-primary/50"
          disabled={saving}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0 rounded-md"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3 text-primary" strokeWidth={1.5} />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 h-8 group/field px-2 rounded-md transition-colors",
        canEdit && "cursor-pointer hover:bg-muted/20",
      )}
      onClick={() => {
        if (canEdit) {
          setEditValue(value || "");
          setIsEditing(true);
        }
      }}
    >
      <div className="flex-1 min-w-0 truncate">
        {value ? (
          linkable && !canEdit ? (
            <a
              href={linkable === "email" ? `mailto:${value}` : (value.startsWith("http") ? value : `https://${value}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary font-medium hover:underline truncate block"
              onClick={(e) => e.stopPropagation()}
              title={value}
            >
              {value}
            </a>
          ) : linkable ? (
            <a
              href={linkable === "email" ? `mailto:${value}` : (value.startsWith("http") ? value : `https://${value}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary font-medium hover:underline truncate block"
              onClick={(e) => e.stopPropagation()}
              title={value}
            >
              {value}
            </a>
          ) : (
            <span className="text-sm text-foreground font-medium truncate block" title={value}>{value}</span>
          )
        ) : (
          <span className="text-sm text-muted-foreground/25 italic">Vazio</span>
        )}
      </div>
      {canEdit && (
        <Pencil
          className="h-3 w-3 flex-shrink-0 text-muted-foreground/20 sm:opacity-0 sm:group-hover/field:opacity-100 transition-opacity"
          strokeWidth={1.5}
        />
      )}
    </div>
  );
}

/* Inline Select Field — pencil to edit, dropdown to pick */
function InlineSelectField({
  label,
  field,
  value,
  options,
  canEdit,
  onSave,
}: {
  label: string;
  field: string;
  value: string;
  options: { label: string; value: string }[];
  canEdit: boolean;
  onSave: (field: string, value: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const displayLabel = options.find((o) => o.value === value)?.label || value || null;

  const handleSelect = async (newValue: string) => {
    if (newValue !== value) {
      setSaving(true);
      await onSave(field, newValue);
      setSaving(false);
    }
    setIsEditing(false);
  };

  if (isEditing && canEdit) {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <Select
          value={value}
          onValueChange={handleSelect}
          open
          defaultOpen
          onOpenChange={(open) => {
            if (!open) setIsEditing(false);
          }}
        >
          <SelectTrigger className="h-8 text-xs flex-1 rounded-md border-border/30 min-w-0">
            <SelectValue placeholder={label} />
          </SelectTrigger>
          <SelectContent>
            {options
              .filter((opt, idx, arr) => arr.findIndex((o) => o.label === opt.label) === idx)
              .map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground flex-shrink-0" />}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs group/field px-2 py-1.5 rounded-md transition-colors",
        canEdit && "cursor-pointer hover:bg-muted/20",
      )}
      onClick={() => {
        if (canEdit) setIsEditing(true);
      }}
    >
      <div className="flex-1 min-w-0 truncate">
        {displayLabel ? (
          <span className="text-foreground font-medium truncate block" title={displayLabel}>{displayLabel}</span>
        ) : (
          <span className="text-muted-foreground/25 italic">Vazio</span>
        )}
      </div>
      {canEdit && (
        <Pencil
          className="h-3 w-3 flex-shrink-0 text-muted-foreground/20 sm:opacity-0 sm:group-hover/field:opacity-100 transition-opacity"
          strokeWidth={1.5}
        />
      )}
    </div>
  );
}

function DatePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  // Parse date string as local date (not UTC) to avoid timezone shift
  const date = value ? new Date(value + "T12:00:00") : undefined;
  return (
    <div>
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left text-xs mt-1 h-8 rounded-lg border-border/30",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
            {date ? format(date, "dd/MM/yyyy") : "Selecionar"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              if (!d) return onChange(null);
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, "0");
              const dd = String(d.getDate()).padStart(2, "0");
              onChange(`${yyyy}-${mm}-${dd}`);
            }}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* Force Phase Move Picker — admin only */
function ForcePhaseMovePicker({
  projectId,
  projectType,
  currentPhase,
  onMove,
  isLoading,
}: {
  projectId: string;
  projectType: ProjectType;
  currentPhase: string;
  onMove: (targetPhase: string) => void;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmPhase, setConfirmPhase] = useState<string | null>(null);
  const typePhases = PHASES_BY_TYPE[projectType] || [];
  const extraPhases = (ALL_PHASES as readonly string[]).filter((p) => !typePhases.includes(p));
  const allPhases = [...typePhases, ...extraPhases];

  if (allPhases.length <= 1) return null;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/50 hover:text-muted-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/40"
            title="Mover projeto para outra etapa (correção)"
          >
            <ArrowRightLeft className="h-3 w-3" strokeWidth={1.5} />
            <span className="hidden sm:inline">Mover etapa</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[220px] p-0">
          <div className="px-3 py-2 border-b border-border/40">
            <span className="text-xs font-medium text-foreground">Mover para etapa</span>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">Ação administrativa para corrigir erros</p>
          </div>
          <div className="py-1">
            {allPhases.map((phase) => {
              const isCurrent = phase === currentPhase;
              return (
                <button
                  key={phase}
                  disabled={isCurrent || isLoading}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left",
                    isCurrent
                      ? "bg-primary/5 text-primary font-medium cursor-default"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                  onClick={() => {
                    setOpen(false);
                    setConfirmPhase(phase);
                  }}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full flex-shrink-0",
                      isCurrent ? "bg-primary" : "bg-muted-foreground/30",
                    )}
                  />
                  <span className="flex-1">{PHASE_LABELS[phase] || phase}</span>
                  {isCurrent && <span className="text-[10px] text-primary/60">atual</span>}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmPhase} onOpenChange={(o) => !o && setConfirmPhase(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Confirmar movimentação de etapa</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Mover o projeto de <strong>{PHASE_LABELS[currentPhase] || currentPhase}</strong> para{" "}
              <strong>{PHASE_LABELS[confirmPhase || ""] || confirmPhase}</strong>?
              <br />
              <br />
              Esta ação é irreversível e será registrada no histórico do projeto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="text-xs h-8 bg-destructive hover:bg-destructive/90"
              disabled={isLoading}
              onClick={() => {
                if (confirmPhase) {
                  onMove(confirmPhase);
                  setConfirmPhase(null);
                }
              }}
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmar movimentação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
