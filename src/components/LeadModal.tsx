import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Lead } from "@/types/lead";
import { canAdvanceToMeeting } from "@/utils/qualificationScore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LeadTypeBadge } from "./LeadBadge";
import { LostReasonDialog } from "./LostReasonDialog";
import { CloserLostReasonDialog, CloserLostReason } from "./CloserLostReasonDialog";
import { MeetingConfirmationDialog } from "./MeetingConfirmationDialog";
import { MeetingConfirmedDialog } from "./MeetingConfirmedDialog";
import { ObservationDialog } from "./ObservationDialog";
import { ScheduleReturnDialog } from "./ScheduleReturnDialog";
import { CompanyInfoSection, isCompanyInfoComplete, getMissingQualificationFields } from "./CompanyInfoSection";
import { CompanyDataSection, isCompanyDataComplete, getMissingCompanyDataFields } from "./CompanyDataSection";
import { SQOValidationSection } from "./SQOValidationSection";
import { InsightsSection } from "./InsightsSection";

import { DeleteLeadDialog } from "./DeleteLeadDialog";
import { ActivityLogSection } from "./ActivityLogSection";

import { ContactCompanySection } from "./ContactCompanySection";
import { LeadActivityTimeline } from "./LeadActivityTimeline";
import { LeadModalPreview } from "./LeadModalPreview";
import { LeadModalActions } from "./LeadModalActions";
import { LeadModalHeader } from "./LeadModalHeader";
import { LeadModalOperationColumn } from "./LeadModalOperationColumn";
import { SDRStrategicPanel } from "./SDRStrategicPanel";
import { LeadModalContextColumn } from "./LeadModalContextColumn";
import { CloserModalHeader } from "./CloserModalHeader";
import { CloserStrategicPanel } from "./CloserStrategicPanel";
import { OpportunityProposalsSection } from "./closer/OpportunityProposalsSection";
import { RegisterOutcomePanel, OutcomeData } from "./RegisterOutcomePanel";
import {
  useLeadInteractions,
  useLeadNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
} from "@/hooks/useLeads";
import { SaveIndicator } from "./SaveIndicator";
import { isLeadOverdue, getInboundSLA, formatTimeAgo } from "@/utils/priorityCalculator";
import { useCadenceStep } from "@/hooks/useLeads";
import { toast } from "sonner";
import {
  CLOSER_STAGES,
  CloserStage,
  CloserOpportunity,
} from "@/services/closerService";
import { createInteraction } from "@/services/leadService";
import {
  Building2,
  Mail,
  Phone,
  AlertCircle,
  RotateCcw,
  Target,
  Calendar,
  Trash2,
  User,
  ClipboardList,
  History,
  ShieldCheck,
  Lightbulb,
  Sparkles,
  Loader2,
  Plus,
  ListChecks,
  Send,
  Link as LinkIcon,
  MailCheck,
} from "lucide-react";
import { ProjectTaskDialog } from "./projects/ProjectTaskDialog";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateProjectActivity } from "@/hooks/useProjectActivities";
import { cn } from "@/lib/utils";
import { LeadStatus } from "@/types/lead";
import { WhatsAppIcon } from "./icons/WhatsAppIcon";
import { supabase } from "@/integrations/supabase/client";
import { EmailComposeDialog } from "./EmailComposeDialog";
import { SendToCloserDialog } from "./SendToCloserDialog";
import { EnrollLeadDialog } from "./sequences/EnrollLeadDialog";
import { useLeadActions } from "@/hooks/useLeadActions";


// API Oficial funnel steps
const API_OFICIAL_FUNNEL_STEPS = [
  { key: 'acionar', label: 'Acionar' },
  { key: 'em_contato', label: 'Em Contato' },
  { key: 'reuniao_agendada', label: 'Reunião Agendada' },
  { key: 'aguardando_retorno', label: 'Aguardando Retorno' },
  { key: 'nao_quer_agora', label: 'Não Quer Agora' },
  { key: 'enviar_pos_venda', label: 'Enviar Pós-Venda' },
];

const API_OFICIAL_STATUS_TO_STEP: Record<string, string> = {
  'Acionar': 'acionar',
  'Em contato': 'em_contato',
  'Reunião agendada': 'reuniao_agendada',
  'Aguardando retorno': 'aguardando_retorno',
  'Não quer agora': 'nao_quer_agora',
  'Enviar Pós Venda': 'enviar_pos_venda',
  'Enviar Pós-Venda': 'enviar_pos_venda',
};

const API_OFICIAL_LINEAR_STEPS = [
  'acionar', 'em_contato', 'reuniao_agendada', 'aguardando_retorno', 'nao_quer_agora', 'enviar_pos_venda',
];

const API_OFICIAL_STEP_TO_STAGE: Record<string, string> = {
  'acionar': 'Acionar',
  'em_contato': 'Em contato',
  'reuniao_agendada': 'Reunião agendada',
  'aguardando_retorno': 'Aguardando retorno',
  'nao_quer_agora': 'Não quer agora',
  'enviar_pos_venda': 'Enviar Pós Venda',
};

interface LeadModalProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onUpdateLead: (lead: Lead) => void;
  mode?: "sdr" | "closer" | "api_oficial";
  opportunity?: CloserOpportunity | null;
  onOpportunityStageChange?: () => void;
  readOnly?: boolean;
  topSlot?: React.ReactNode;
  apiOficialStage?: string;
  onApiOficialStageChange?: (stage: string) => void;
  apiOficialCreatedAt?: string | null;
}

export const LeadModal = ({
  lead,
  open,
  onClose,
  onUpdateLead,
  mode = "sdr",
  opportunity,
  onOpportunityStageChange,
  readOnly: readOnlyProp = false,
  topSlot,
  apiOficialStage,
  onApiOficialStageChange,
  apiOficialCreatedAt,
}: LeadModalProps) => {
  // Unified business logic hook
  const actions = useLeadActions({
    lead,
    onUpdateLead,
    onClose,
    mode,
    opportunity,
    onOpportunityStageChange,
  });

  // Local UI-only state
  const [closerActiveTab, setCloserActiveTab] = useState(() => (window.innerWidth < 768 ? "negociacao" : "historico"));
  const [sdrActiveTab, setSdrActiveTab] = useState(() => (window.innerWidth < 768 ? "operacao" : "historico"));
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [projectIdForTask, setProjectIdForTask] = useState<string | null>(null);
  const modalQueryClient = useQueryClient();
  const createProjectActivity = useCreateProjectActivity();

  const { data: interactions = [] } = useLeadInteractions(lead?.id ?? null);
  const { data: notes = [] } = useLeadNotes(lead?.id ?? null);
  const updateNoteMutation = useUpdateNote();
  const deleteNoteMutation = useDeleteNote();

  const sdrModeCloserName = opportunity?.closer_name || null;

  // Derived readonly
  const readOnly = readOnlyProp && !actions.isAdmin && !actions.isManager && !actions.isOwner;

  const isInbound = lead?.lead_type === "INBOUND";
  const isOverdue = lead ? isLeadOverdue(lead) : false;
  const { data: cadenceStep } = useCadenceStep(
    lead && !isInbound ? lead.cadence_id ?? null : null,
    lead && !isInbound ? lead.current_cadence_step ?? null : null
  );

  // Funnel step click
  const handleFunnelStepClick = useCallback(
    (stepKey: string) => {
      switch (stepKey) {
        case "novo":
          actions.handleStatusChange("Novo" as LeadStatus);
          break;
        case "em_contato":
          actions.setObservationDialogOpen(true);
          break;
        case "lead_quente":
          actions.handleStatusChange("Interesse" as LeadStatus);
          break;
        case "reuniao":
          actions.handleOpenMeetingDialog();
          break;
        case "sqo":
          actions.setConfirmedDialogOpen(true);
          break;
        case "oportunidade_futura":
          actions.setScheduleReturnTargetStatus("Interesse/Agendar Retorno");
          actions.setScheduleReturnDialogOpen(true);
          break;
        case "reciclagem":
          actions.handleStatusChange("Reciclagem" as LeadStatus);
          break;
        case "perdido":
          actions.setDiscardDialogOpen(true);
          break;
      }
    },
    [actions],
  );

  const handleApiOficialStepClick = useCallback(
    (stepKey: string) => {
      const stage = API_OFICIAL_STEP_TO_STAGE[stepKey];
      if (stage && onApiOficialStageChange) {
        onApiOficialStageChange(stage);
      }
    },
    [onApiOficialStageChange],
  );

  // SQO tab visibility
  const hasSqoData = useMemo(
    () =>
      !!(
        lead?.sqo_pain_category ||
        lead?.sqo_urgency ||
        lead?.sqo_budget ||
        lead?.sqo_decision_maker ||
        lead?.sqo_icp_fit ||
        lead?.sqo_next_step
      ),
    [lead?.sqo_pain_category, lead?.sqo_urgency, lead?.sqo_budget, lead?.sqo_decision_maker, lead?.sqo_icp_fit, lead?.sqo_next_step],
  );
  const showSqoTab = mode !== "sdr" || hasSqoData;

  // Task handling
  const handleNewTaskClick = useCallback(async () => {
    if (!lead) return;
    const { data } = await supabase.from("projects").select("id").eq("lead_id", lead.id).limit(1).maybeSingle();
    setProjectIdForTask(data?.id || null);
    setTaskDialogOpen(true);
  }, [lead]);

  const handleTaskCreated = useCallback(
    async (data: { title: string; assignedUserName?: string; dueDate?: string; taskId?: string }) => {
      if (!lead) return;
      modalQueryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      if (projectIdForTask) {
        const parts = [`📋 ${data.title}`];
        if (data.assignedUserName) parts.push(`Responsável: ${data.assignedUserName}`);
        if (data.dueDate)
          parts.push(
            `Data: ${new Date(data.dueDate).toLocaleDateString("pt-BR")} ${new Date(data.dueDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
          );
        createProjectActivity.mutate({
          project_id: projectIdForTask,
          action_type: "task_created",
          description: parts.join("\n"),
          new_value: data.taskId,
        });
      }
      if (lead.id) {
        const taskIdTag = data.taskId ? ` [task_id:${data.taskId}]` : "";
        await (supabase.from("lead_notes") as any).insert({
          lead_id: lead.id,
          user_id: actions.currentUserId,
          note: `📋 Tarefa criada: ${data.title}${data.assignedUserName ? ` | Responsável: ${data.assignedUserName}` : ""}${data.dueDate ? ` | Vencimento: ${new Date(data.dueDate).toLocaleDateString("pt-BR")}` : ""}${taskIdTag}`,
        });
        modalQueryClient.invalidateQueries({ queryKey: ["notes", lead.id] });
      }
      if (data.dueDate) {
        const taskDate = new Date(data.dueDate);
        const currentNext = new Date(lead.next_action_at);
        const nowDate = new Date();
        if (taskDate > nowDate && (taskDate < currentNext || currentNext < nowDate)) {
          onUpdateLead({ ...lead, next_action_at: taskDate.toISOString() });
        }
      }
      toast.success("Tarefa criada com sucesso");
    },
    [lead, projectIdForTask, actions.currentUserId, modalQueryClient, createProjectActivity, onUpdateLead],
  );

  if (!lead) {
    return (
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-lg">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value && actions.emailDialogOpen) return;
          onClose();
        }}
      >
        <DialogContent
          className="w-full max-w-[1366px] h-[100dvh] sm:h-[92dvh] flex flex-col p-0 gap-0 bg-card overflow-hidden rounded-none sm:rounded-lg"
          onPointerDownOutside={(e) => {
            if (actions.emailDialogOpen) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (actions.emailDialogOpen) e.preventDefault();
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{lead.name}</DialogTitle>
          </DialogHeader>

          {topSlot && <div className="flex-shrink-0">{topSlot}</div>}

          {/* Top-right action buttons */}
          {!readOnly && (
            <div className="absolute top-2 sm:top-4 right-10 sm:right-12 z-10 flex items-center gap-1.5 sm:gap-3">
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      const base = window.location.origin;
                      const path = mode === 'closer' ? '/closer' : '/leads';
                      const params = new URLSearchParams({ lead: lead.id });
                      if (opportunity?.id) params.set('opp', opportunity.id);
                      const url = `${base}${path}?${params.toString()}`;
                      navigator.clipboard.writeText(url);
                      toast.success('Link copiado!');
                    }}
                    className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <LinkIcon className="h-4 w-4" />
                    <span className="sr-only">Copiar link</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <span className="text-xs">Copiar link</span>
                </TooltipContent>
              </Tooltip>
              {lead.status === "Descartado" && (
                <Button onClick={actions.handleRestoreLead} variant="outline" size="sm" className="gap-1 border-primary/30 text-primary hover:bg-primary/10">
                  <RotateCcw className="h-4 w-4" />
                  Restaurar
                </Button>
              )}
              {mode === "sdr" && (actions.isAdmin || actions.isManager) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={() => actions.setSendToCloserOpen(true)} className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Send className="h-4 w-4" />
                      <span className="sr-only">Enviar para Closer</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><span className="text-xs">Enviar para Closer</span></TooltipContent>
                </Tooltip>
              )}
              {mode === "sdr" && lead.email && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={() => actions.setEnrollSequenceOpen(true)} className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <MailCheck className="h-4 w-4" />
                      <span className="sr-only">Sequência de E-mail</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><span className="text-xs">Inscrever em Sequência</span></TooltipContent>
                </Tooltip>
              )}
              {actions.canDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={() => actions.setDeleteDialogOpen(true)} className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Excluir</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><span className="text-xs">Excluir</span></TooltipContent>
                </Tooltip>
              )}
            </div>
          )}

          {readOnly && (
            <div className="absolute top-3 right-12 z-10">
              <Badge variant="secondary" className="text-xs">Somente leitura</Badge>
            </div>
          )}

          {/* SDR / API Oficial Mode */}
          {(mode === "sdr" || mode === "api_oficial") ? (
            <>
              {mode === "api_oficial" ? (
                <div className="border-b px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0 pr-16 sm:pr-24">
                    <span className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 shrink-0">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    </span>
                    <h2 className="text-xs sm:text-sm font-semibold text-foreground tracking-tight truncate">
                      {lead.razao_social || lead.nome_fantasia || lead.company}
                    </h2>
                    <Badge variant="outline" className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20 gap-0.5 shrink-0">
                      <ShieldCheck className="h-3 w-3" />
                      API Oficial
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {lead.cnpj && (
                      <span className="text-[10px] text-muted-foreground font-medium tracking-wide">
                        CNPJ {lead.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                      </span>
                    )}
                    {apiOficialStage && (
                      <>
                        {lead.cnpj && <span className="text-[10px] text-muted-foreground">·</span>}
                        <Badge variant="secondary" className="text-[10px] h-5">{apiOficialStage}</Badge>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <LeadModalHeader
                  lead={lead}
                  onRegisterOutcome={() => actions.setRegisterOutcomePanelOpen(true)}
                  leadId={lead.id}
                  ownerUserId={lead.owner_user_id}
                  ownerName={lead.owner_name}
                  currentUserId={actions.currentUserId}
                  canManage={actions.canReassign || actions.isManager}
                  closerName={sdrModeCloserName || opportunity?.closer_name || null}
                />
              )}

              {/* Desktop: resizable split layout */}
              <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0 hidden md:flex">
                <ResizablePanel
                  defaultSize={20} minSize={18} maxSize={40}
                  className={cn("min-w-0 overflow-hidden flex flex-col", readOnly && "pointer-events-none opacity-60")}
                >
                  <ScrollArea className="flex-1">
                    <SDRStrategicPanel
                      lead={lead}
                      interactions={interactions}
                      notes={notes}
                      onStepClick={mode === "api_oficial" ? handleApiOficialStepClick : handleFunnelStepClick}
                      onSubstatusChange={actions.handleStatusChange}
                      onRegisterOutcome={() => actions.setRegisterOutcomePanelOpen(true)}
                      onUpdateLead={actions.handleLeadUpdateWithLogging}
                      onSendEmail={() => actions.setEmailDialogOpen(true)}
                      onOpenScheduleReturn={() => {
                        actions.setScheduleReturnTargetStatus("Em contato");
                        actions.setScheduleReturnDialogOpen(true);
                      }}
                      {...(mode === "api_oficial" ? {
                        overrideFunnelSteps: API_OFICIAL_FUNNEL_STEPS,
                        overrideStatusToStep: API_OFICIAL_STATUS_TO_STEP,
                        overrideLinearSteps: API_OFICIAL_LINEAR_STEPS,
                        overrideCurrentStatus: apiOficialStage,
                        overrideQuickActions: [],
                      } : {})}
                    />
                  </ScrollArea>
                </ResizablePanel>

                <ResizableHandle withHandle className="bg-border/40" />

                <ResizablePanel defaultSize={80} className="flex flex-col min-h-0">
                  <Tabs value={sdrActiveTab} onValueChange={setSdrActiveTab} className="flex flex-col h-full min-h-0">
                    <div className="flex-shrink-0 px-3 pt-2 border-b border-border">
                      <TabsList className="h-auto w-full bg-transparent gap-0 p-0 items-end">
                        {(["historico", "empresa", "qualificacao"] as const).map((val) => (
                          <TabsTrigger
                            key={val}
                            value={val}
                            className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                          >
                            {val === "historico" ? "Histórico" : val === "empresa" ? "Empresa" : "Qualificação"}
                          </TabsTrigger>
                        ))}
                        {showSqoTab && (
                          <TabsTrigger value="sqo" className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70">
                            SQO
                          </TabsTrigger>
                        )}
                        <TabsTrigger value="insights" className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70">
                          Insights
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <div className="flex-1 min-h-0 flex flex-col">
                      <TabsContent value="historico" className="m-0 flex-1 min-h-0 flex flex-col" forceMount style={{ display: sdrActiveTab === "historico" ? "flex" : "none" }}>
                        <LeadActivityTimeline
                          leadId={lead.id} canEdit={true}
                          leadData={{ email: lead.email, name: lead.name, company: lead.company, phone: lead.phone, razao_social: lead.razao_social, nome_fantasia: lead.nome_fantasia }}
                          sinceDate={mode === "api_oficial" ? apiOficialCreatedAt : undefined}
                        />
                      </TabsContent>
                      {sdrActiveTab !== "historico" && (
                        <ScrollArea className="flex-1">
                          <TabsContent value="empresa" className="m-0 px-4 py-4">
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Dados da Empresa</h3>
                            <CompanyDataSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} />
                          </TabsContent>
                          <TabsContent value="qualificacao" className="m-0 px-4 py-4">
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Qualificação</h3>
                            <CompanyInfoSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} readOnly={mode !== "sdr"} />
                          </TabsContent>
                          {showSqoTab && (
                            <TabsContent value="sqo" className="m-0 px-4 py-4">
                              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Validação SQO</h3>
                              <SQOValidationSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} readOnly={actions.isSdr} />
                            </TabsContent>
                          )}
                          <TabsContent value="insights" className="m-0 px-4 py-4">
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Insights</h3>
                            <InsightsSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} />
                          </TabsContent>
                        </ScrollArea>
                      )}
                    </div>
                  </Tabs>
                </ResizablePanel>
              </ResizablePanelGroup>

              {/* Mobile: unified tabs */}
              <div className="flex-1 min-h-0 flex flex-col md:hidden">
                <Tabs value={sdrActiveTab} onValueChange={setSdrActiveTab} className="flex flex-col flex-1 min-h-0">
                  <div className="flex-shrink-0 px-2 pt-1.5 border-b border-border">
                    <div className="overflow-x-auto">
                      <TabsList className="h-auto w-max min-w-full bg-transparent gap-0 p-0 flex items-end">
                        {([
                          ['operacao', 'Operação'],
                          ['historico', 'Histórico'],
                          ['empresa', 'Empresa'],
                          ['qualificacao', 'Qualif.'],
                          ['insights', 'Insights'],
                        ] as const).map(([val, label]) => (
                          <TabsTrigger
                            key={val} value={val}
                            className="shrink-0 px-3 rounded-none border-b-2 border-transparent bg-transparent py-1.5 text-xs font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                          >
                            {label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 flex flex-col">
                    <TabsContent value="historico" className="m-0 flex-1 min-h-0 flex flex-col" forceMount style={{ display: sdrActiveTab === "historico" ? "flex" : "none" }}>
                      <LeadActivityTimeline
                        leadId={lead.id} canEdit={true}
                        leadData={{ email: lead.email, name: lead.name, company: lead.company, phone: lead.phone, razao_social: lead.razao_social, nome_fantasia: lead.nome_fantasia }}
                        sinceDate={mode === "api_oficial" ? apiOficialCreatedAt : undefined}
                      />
                    </TabsContent>
                    {sdrActiveTab !== "historico" && (
                      <ScrollArea className="flex-1">
                        <TabsContent value="operacao" className={cn("m-0", readOnly && "pointer-events-none opacity-60")}>
                          <SDRStrategicPanel
                            lead={lead} interactions={interactions} notes={notes}
                            onStepClick={mode === "api_oficial" ? handleApiOficialStepClick : handleFunnelStepClick}
                            onSubstatusChange={actions.handleStatusChange}
                            onRegisterOutcome={() => actions.setRegisterOutcomePanelOpen(true)}
                            onUpdateLead={actions.handleLeadUpdateWithLogging}
                            onSendEmail={() => actions.setEmailDialogOpen(true)}
                            onOpenScheduleReturn={() => {
                              actions.setScheduleReturnTargetStatus("Em contato");
                              actions.setScheduleReturnDialogOpen(true);
                            }}
                            {...(mode === "api_oficial" ? {
                              overrideFunnelSteps: API_OFICIAL_FUNNEL_STEPS,
                              overrideStatusToStep: API_OFICIAL_STATUS_TO_STEP,
                              overrideLinearSteps: API_OFICIAL_LINEAR_STEPS,
                              overrideCurrentStatus: apiOficialStage,
                              overrideQuickActions: [],
                            } : {})}
                          />
                        </TabsContent>
                        <TabsContent value="empresa" className="m-0 px-4 py-4">
                          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Dados da Empresa</h3>
                          <CompanyDataSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} />
                        </TabsContent>
                        <TabsContent value="qualificacao" className="m-0 px-4 py-4">
                          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Qualificação</h3>
                          <CompanyInfoSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} readOnly={mode !== "sdr"} />
                        </TabsContent>
                        {showSqoTab && (
                          <TabsContent value="sqo" className="m-0 px-4 py-4">
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Validação SQO</h3>
                            <SQOValidationSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} readOnly={actions.isSdr} />
                          </TabsContent>
                        )}
                        <TabsContent value="insights" className="m-0 px-4 py-4">
                          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Insights</h3>
                          <InsightsSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} />
                        </TabsContent>
                      </ScrollArea>
                    )}
                  </div>
                </Tabs>
              </div>
            </>
          ) : (
            /* Closer Mode */
            <>
              {opportunity && (
                <CloserModalHeader
                  lead={lead} opportunity={opportunity}
                  opportunityId={opportunity.id}
                  currentCloserId={opportunity.assigned_to_user_id}
                  closerName={opportunity.closer_name}
                  currentUserId={actions.currentUserId}
                  canManage={actions.canReassign || actions.isManager}
                />
              )}

              <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0 hidden md:flex">
                <ResizablePanel defaultSize={20} minSize={18} maxSize={40} className={cn("min-w-0 overflow-hidden flex flex-col", readOnly && "pointer-events-none opacity-60")}>
                  <ScrollArea className="flex-1">
                    <CloserStrategicPanel
                      lead={lead} opportunity={opportunity!}
                      onCloserStageChange={actions.handleCloserStageChange}
                      onReturnToSdr={actions.handleCloserReturn}
                      onUpdateLead={actions.handleLeadUpdateWithLogging}
                      onOpportunityFieldChange={() => onOpportunityStageChange?.()}
                      onSendEmail={() => actions.setEmailDialogOpen(true)}
                      onNavigateToHistory={() => setCloserActiveTab("historico")}
                    />
                  </ScrollArea>
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={80} minSize={50} className="flex flex-col min-h-0">
                  <Tabs value={closerActiveTab} onValueChange={setCloserActiveTab} className="flex flex-col flex-1 min-h-0">
                    <div className="flex-shrink-0 px-3 pt-2 border-b border-border">
                      <TabsList className="h-auto w-full bg-transparent gap-0 p-0 items-end">
                        {(["historico", "propostas", "empresa", "qualificacao"] as const).map((val) => (
                          <TabsTrigger key={val} value={val} className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70">
                            {val === "historico" ? "Histórico" : val === "propostas" ? "Propostas" : val === "empresa" ? "Empresa" : "Qualificação"}
                          </TabsTrigger>
                        ))}
                        {showSqoTab && (
                          <TabsTrigger value="sqo" className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70">SQO</TabsTrigger>
                        )}
                        <TabsTrigger value="insights" className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70">Insights</TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="historico" className="m-0 flex-1 min-h-0 flex flex-col overflow-hidden" forceMount style={{ display: closerActiveTab === "historico" ? "flex" : "none" }}>
                      <LeadActivityTimeline leadId={lead.id} canEdit={true} opportunityId={opportunity?.id}
                        leadData={{ email: lead.email, name: lead.name, company: lead.company, phone: lead.phone, razao_social: lead.razao_social, nome_fantasia: lead.nome_fantasia }} />
                    </TabsContent>

                    <ScrollArea className="flex-1" style={{ display: closerActiveTab === "historico" ? "none" : undefined }}>
                      {opportunity && (
                        <TabsContent value="propostas" className="m-0 px-4 py-4">
                          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Propostas Comerciais</h3>
                          <OpportunityProposalsSection opportunityId={opportunity.id} lead={lead} opportunity={opportunity} />
                        </TabsContent>
                      )}
                      <TabsContent value="empresa" className="m-0 px-4 py-4">
                        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Dados da Empresa</h3>
                        <CompanyDataSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} />
                      </TabsContent>
                      <TabsContent value="qualificacao" className="m-0 px-4 py-4">
                        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Qualificação</h3>
                        <CompanyInfoSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} readOnly={!(opportunity?.created_by_user_id === actions.currentUserId)} />
                      </TabsContent>
                      {showSqoTab && (
                        <TabsContent value="sqo" className="m-0 px-4 py-4">
                          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Validação SQO</h3>
                          <SQOValidationSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} readOnly={actions.isSdr} />
                        </TabsContent>
                      )}
                      <TabsContent value="insights" className="m-0 px-4 py-4">
                        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Insights</h3>
                        <InsightsSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} />
                      </TabsContent>
                    </ScrollArea>
                  </Tabs>
                </ResizablePanel>
              </ResizablePanelGroup>

              {/* Mobile: Closer tabs */}
              <div className="flex-1 min-h-0 flex flex-col md:hidden">
                <Tabs value={closerActiveTab} onValueChange={setCloserActiveTab} className="flex flex-col flex-1 min-h-0">
                  <div className="flex-shrink-0 px-2 pt-1.5 border-b border-border">
                    <div className="overflow-x-auto">
                      <TabsList className="h-auto w-max min-w-full bg-transparent gap-0 p-0 flex items-end">
                        {([['negociacao', 'Negociação'], ['historico', 'Histórico'], ['propostas', 'Propostas'], ['empresa', 'Empresa'], ['qualificacao', 'Qualif.']] as const).map(([val, label]) => (
                          <TabsTrigger key={val} value={val} className="shrink-0 px-3 rounded-none border-b-2 border-transparent bg-transparent py-1.5 text-xs font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70">
                            {label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 flex flex-col">
                    <TabsContent value="historico" className="m-0 flex-1 min-h-0 flex flex-col" forceMount style={{ display: closerActiveTab === "historico" ? "flex" : "none" }}>
                      <LeadActivityTimeline leadId={lead.id} canEdit={true} opportunityId={opportunity?.id}
                        leadData={{ email: lead.email, name: lead.name, company: lead.company, phone: lead.phone, razao_social: lead.razao_social, nome_fantasia: lead.nome_fantasia }} />
                    </TabsContent>
                    {closerActiveTab !== "historico" && (
                      <ScrollArea className="flex-1">
                        <TabsContent value="negociacao" className={cn("m-0", readOnly && "pointer-events-none opacity-60")}>
                          <CloserStrategicPanel
                            lead={lead} opportunity={opportunity!}
                            onCloserStageChange={actions.handleCloserStageChange}
                            onReturnToSdr={actions.handleCloserReturn}
                            onUpdateLead={actions.handleLeadUpdateWithLogging}
                            onOpportunityFieldChange={() => onOpportunityStageChange?.()}
                            onSendEmail={() => actions.setEmailDialogOpen(true)}
                            onNavigateToHistory={() => setCloserActiveTab("historico")}
                          />
                        </TabsContent>
                        {opportunity && (
                          <TabsContent value="propostas" className="m-0 px-4 py-4">
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Propostas Comerciais</h3>
                            <OpportunityProposalsSection opportunityId={opportunity.id} lead={lead} opportunity={opportunity} />
                          </TabsContent>
                        )}
                        <TabsContent value="empresa" className="m-0 px-4 py-4">
                          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Dados da Empresa</h3>
                          <CompanyDataSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} />
                        </TabsContent>
                        <TabsContent value="qualificacao" className="m-0 px-4 py-4">
                          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Qualificação</h3>
                          <CompanyInfoSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} readOnly={!(opportunity?.created_by_user_id === actions.currentUserId)} />
                        </TabsContent>
                        {showSqoTab && (
                          <TabsContent value="sqo" className="m-0 px-4 py-4">
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Validação SQO</h3>
                            <SQOValidationSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} readOnly={actions.isSdr} />
                          </TabsContent>
                        )}
                        <TabsContent value="insights" className="m-0 px-4 py-4">
                          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Insights</h3>
                          <InsightsSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} />
                        </TabsContent>
                      </ScrollArea>
                    )}
                  </div>
                </Tabs>
              </div>
            </>
          )}

          {/* Save indicator */}
          <div className="flex-shrink-0 border-t px-4 py-2 flex items-center justify-between">
            <SaveIndicator isSaving={actions.isSaving} lastSavedAt={actions.lastSavedAt} />
            <div className="flex items-center gap-2">
              {mode === "sdr" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={handleNewTaskClick} className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <Plus className="h-3 w-3" />
                      Tarefa
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><span className="text-xs">Criar tarefa vinculada</span></TooltipContent>
                </Tooltip>
              )}
              {mode === "sdr" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => actions.setEnrichDialog(true)} className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <Sparkles className="h-3 w-3" />
                      Enriquecer
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><span className="text-xs">Enriquecer dados do lead</span></TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Register Outcome Panel */}
          <RegisterOutcomePanel
            open={actions.registerOutcomePanelOpen}
            onOpenChange={actions.setRegisterOutcomePanelOpen}
            lead={lead}
            onSubmit={async (data) => {
              if (actions.outcomeSubmittingRef.current) return;
              actions.outcomeSubmittingRef.current = true;
              try {
                const userInfo = actions.getUserInfo();
                const now = new Date().toISOString();
                const outcomeMap: Record<string, string> = {
                  conectou: "respondeu", nao_atendeu: "sem_resposta", interesse: "qualificado", sem_interesse: "descartado", reagendado: "reagendado",
                };
                try {
                  await createInteraction({
                    lead_id: lead.id,
                    user_id: userInfo.id,
                    channel: (data.contactType === "meeting" ? "other" : data.contactType) as 'call' | 'whatsapp' | 'email' | 'other',
                    direction: "outbound",
                    outcome: (outcomeMap[data.result] || "respondeu") as 'sem_resposta' | 'respondeu' | 'qualificado' | 'reagendado' | 'descartado',
                    message_summary: data.observation || null,
                    occurred_at: now,
                  });
                } catch (err) {
                  console.error("Error creating interaction:", err);
                }
                const updates: Partial<Lead> = { last_contact_at: now, attempts_count: lead.attempts_count + 1 };
                if (data.nextActionDate) {
                  const [y, m, d] = data.nextActionDate.split("-").map(Number);
                  const [hh, mm] = data.nextActionTime.split(":").map(Number);
                  updates.next_action_at = new Date(y, m - 1, d, hh, mm).toISOString();
                }
                const currentFunnelIndex = actions.FUNNEL_ORDER.indexOf(lead.status as typeof actions.FUNNEL_ORDER[number]);
                const setStatusIfNotRegression = (newStatus: LeadStatus) => {
                  const newIndex = actions.FUNNEL_ORDER.indexOf(newStatus as typeof actions.FUNNEL_ORDER[number]);
                  if (newIndex >= currentFunnelIndex || currentFunnelIndex === -1) updates.status = newStatus;
                };
                if (data.result === "nao_atendeu") updates.status = "Em contato" as LeadStatus;
                else if (data.result === "reagendado") updates.status = "Agendar retorno" as LeadStatus;
                else if (data.result === "interesse") updates.status = "Interesse" as LeadStatus;
                else if (data.result === "sem_interesse") updates.status = "Descartado" as LeadStatus;
                else if (data.result === "conectou") setStatusIfNotRegression("Em contato" as LeadStatus);
                if (lead.cadence_id && lead.current_cadence_step && ["conectou", "interesse", "reagendado"].includes(data.result)) {
                  const nextStep = (lead.current_cadence_step ?? 0) + 1;
                  updates.current_cadence_step = nextStep;
                  try {
                    await supabase.from("lead_cadences").update({
                      current_step_number: nextStep,
                      next_step_at: data.nextActionDate ? new Date(`${data.nextActionDate}T${data.nextActionTime}`).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    }).eq("lead_id", lead.id);
                  } catch (err) { console.error("Error advancing cadence step:", err); }
                }
                onUpdateLead({ ...lead, ...updates } as Lead);
                if (data.observation) {
                  try {
                    await actions.createNoteMutation.mutateAsync({ lead_id: lead.id, user_id: userInfo.id, note: `[${data.contactType}] (${userInfo.name}) ${data.observation}` });
                  } catch (err) { console.error("Error saving note:", err); }
                }
                await actions.queryClient.invalidateQueries({ queryKey: ["activityLogs", lead.id] });
                toast.success("Resultado registrado com sucesso!");
              } finally {
                actions.outcomeSubmittingRef.current = false;
              }
            }}
          />

          {/* Dialogs */}
          <LostReasonDialog open={actions.discardDialogOpen} onOpenChange={actions.setDiscardDialogOpen} onConfirm={actions.handleConfirmDiscard} />
          <CloserLostReasonDialog
            open={actions.closerLostDialogOpen}
            onOpenChange={actions.setCloserLostDialogOpen}
            onConfirm={actions.handleConfirmCloserLost}
          />

          {/* Return to SDR Dialog */}
          <Dialog open={actions.closerReturnDialogOpen} onOpenChange={actions.setCloserReturnDialogOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader><DialogTitle>Devolver Lead ao SDR</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Label>Motivo da devolução *</Label>
                <div className="space-y-2">
                  {["Cliente não entrou na reunião", "Cliente entrou mas decidiu remarcar", "Outro"].map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        actions.setCloserReturnReason(option === "Outro" ? "" : option);
                        actions.setCloserReturnSelected(option);
                      }}
                      className={cn(
                        "w-full text-left text-sm py-2.5 px-3 rounded-md border transition-all",
                        actions.closerReturnSelected === option
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card border-border hover:border-primary/50 hover:bg-muted/50",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {actions.closerReturnSelected === "Outro" && (
                  <Textarea value={actions.closerReturnReason} onChange={(e) => actions.setCloserReturnReason(e.target.value)} placeholder="Descreva o motivo..." className="min-h-[80px]" autoFocus />
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { actions.setCloserReturnDialogOpen(false); actions.setCloserReturnSelected(""); }}>Cancelar</Button>
                <Button
                  disabled={!actions.closerReturnSelected || (actions.closerReturnSelected === "Outro" && !actions.closerReturnReason.trim())}
                  onClick={actions.handleConfirmCloserReturn}
                >
                  Confirmar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <MeetingConfirmationDialog open={actions.meetingDialogOpen} onOpenChange={actions.setMeetingDialogOpen} onConfirm={actions.handleConfirmMeeting} companyName={lead.razao_social || lead.nome_fantasia || lead.company} contactEmail={lead.email || undefined} />
          <MeetingConfirmedDialog open={actions.confirmedDialogOpen} onOpenChange={actions.setConfirmedDialogOpen} onConfirm={actions.handleConfirmPresence} companyName={lead.razao_social || lead.nome_fantasia || lead.company} />
          <ObservationDialog open={actions.observationDialogOpen} onOpenChange={actions.setObservationDialogOpen} onConfirm={actions.handleStatusChangeWithObservation} statusName="Em contato" />
          <ScheduleReturnDialog open={actions.scheduleReturnDialogOpen} onOpenChange={actions.setScheduleReturnDialogOpen} onConfirm={actions.handleScheduleReturn} />
          {actions.canDelete && (
            <DeleteLeadDialog
              open={actions.deleteDialogOpen} onOpenChange={actions.setDeleteDialogOpen}
              leadCount={1} leadName={mode === "closer" ? lead.razao_social || lead.company : lead.name}
              onConfirm={actions.handleDeleteLead} isDeleting={actions.deleteLeadMutation.isPending}
              entityLabel={mode === "closer" ? "Oportunidade" : "Lead"}
            />
          )}

          {/* Enrich Lead Dialog */}
          <Dialog open={actions.enrichDialog} onOpenChange={actions.setEnrichDialog}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader><DialogTitle>Enriquecer dados do lead</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">Selecione quais tipos de dados deseja buscar para enriquecer o cadastro do lead.</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-muted hover:bg-muted/50 cursor-pointer transition-colors">
                    <input type="checkbox" checked={actions.enrichOptions.brasilapi} onChange={(e) => actions.setEnrichOptions({ ...actions.enrichOptions, brasilapi: e.target.checked })} className="rounded border-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">BrasilAPI (Cadastral)</p>
                      <p className="text-xs text-muted-foreground">Razão Social, endereço, CNAE, porte da empresa</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-muted hover:bg-muted/50 cursor-pointer transition-colors">
                    <input type="checkbox" checked={actions.enrichOptions.perplexity} onChange={(e) => actions.setEnrichOptions({ ...actions.enrichOptions, perplexity: e.target.checked })} className="rounded border-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Perplexity (IA)</p>
                      <p className="text-xs text-muted-foreground">Segmento, website, telefone, WhatsApp, e-mail, faturamento</p>
                    </div>
                  </label>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => actions.setEnrichDialog(false)}>Cancelar</Button>
                <Button onClick={actions.handleEnrichLead} disabled={actions.enrichLeadMutation.isPending || (!actions.enrichOptions.brasilapi && !actions.enrichOptions.perplexity)}>
                  {actions.enrichLeadMutation.isPending ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />Enriquecendo...</>) : (<><Sparkles className="h-4 w-4 mr-2" />Enriquecer</>)}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>

      {/* Email Compose Dialog */}
      <EmailComposeDialog open={actions.emailDialogOpen} onOpenChange={actions.setEmailDialogOpen} lead={lead} userName={actions.currentUserName} sdrName={opportunity?.sdr_name || ""} closerName={opportunity?.closer_name || ""} />

      {/* Send to Closer Dialog */}
      <SendToCloserDialog
        open={actions.sendToCloserOpen} onOpenChange={actions.setSendToCloserOpen}
        leadId={lead.id} leadName={lead.name}
        onSuccess={() => {
          onUpdateLead({ ...lead, status: "Oportunidade criada" as LeadStatus });
          actions.queryClient.invalidateQueries({ queryKey: ["leads"] });
          actions.queryClient.invalidateQueries({ queryKey: ["opportunities"] });
        }}
      />

      {/* Enroll in Email Sequence Dialog */}
      <EnrollLeadDialog open={actions.enrollSequenceOpen} onOpenChange={actions.setEnrollSequenceOpen} leadId={lead.id} leadName={lead.name} />

      {/* Task Dialog */}
      <ProjectTaskDialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen} projectId={projectIdForTask} onTaskCreated={handleTaskCreated} />
    </>
  );
};

// Section Card Component
interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
}

const SectionCard = ({ icon, title, color, children }: SectionCardProps) => (
  <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", color)}>{icon}</div>
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
);
