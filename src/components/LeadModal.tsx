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
import { LostReasonDialog, DiscardReason } from "./LostReasonDialog";
import { CloserLostReasonDialog, CloserLostReason } from "./CloserLostReasonDialog";
import { MeetingConfirmationDialog, MeetingData } from "./MeetingConfirmationDialog";
import { MeetingConfirmedDialog } from "./MeetingConfirmedDialog";
import { ObservationDialog } from "./ObservationDialog";
import { ScheduleReturnDialog, ScheduleReturnData } from "./ScheduleReturnDialog";
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
  useDeleteLead,
} from "@/hooks/useLeads";
import { usePermissions } from "@/hooks/usePermissions";
import { useLogLeadActivity } from "@/hooks/useActivityLogs";
import { SaveIndicator } from "./SaveIndicator";
import { isLeadOverdue, getInboundSLA, formatTimeAgo } from "@/utils/priorityCalculator";
import { useCadenceStep } from "@/hooks/useLeads";
import { toast } from "sonner";
import {
  createOpportunityFromMeeting,
  CLOSER_STAGES,
  CloserStage,
  CloserOpportunity,
  updateOpportunityStage,
  returnLeadToSdr,
  markOpportunityLost,
  markOpportunityWon,
  removeOpportunityByLeadId,
} from "@/services/closerService";
import { createInteraction } from "@/services/leadService";
import { getStatusLabel, getTemperatureLabel, getFieldChangeDescription } from "@/services/activityLogService";
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
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useEnrichIndividualLead } from "@/hooks/useEnrichIndividualLead";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { EmailComposeDialog } from "./EmailComposeDialog";
import { SendToCloserDialog } from "./SendToCloserDialog";
import { EnrollLeadDialog } from "./sequences/EnrollLeadDialog";


// Module-level constants
const TRACKED_FIELDS = [
  "name", "company", "phone", "whatsapp", "phone_2", "email", "source", "cnpj",
  "razao_social", "nome_fantasia", "company_segment", "employee_count", "revenue_range",
  "website", "city", "state", "cep", "product_interest", "daily_service_volume",
  "main_pain_point", "solution_urgency", "has_budget", "qualification_notes",
] as const;

const FUNNEL_ORDER = [
  "Novo",
  "Devolvido pelo Closer",
  "Em contato",
  "Ocupado",
  "Agendar retorno",
  "Sem retorno",
  "Interesse",
  "Reagendar Reunião",
  "Interesse/Agendar Retorno",
  "Oportunidade criada",
] as const;

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
  /** Current stage from api_oficial_deals (used when mode='api_oficial') */
  apiOficialStage?: string;
  /** Callback when stage changes in api_oficial mode */
  onApiOficialStageChange?: (stage: string) => void;
  /** Filter timeline to only show items since this date (used in api_oficial) */
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
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [confirmedDialogOpen, setConfirmedDialogOpen] = useState(false);
  const [observationDialogOpen, setObservationDialogOpen] = useState(false);
  const [scheduleReturnDialogOpen, setScheduleReturnDialogOpen] = useState(false);
  const [scheduleReturnTargetStatus, setScheduleReturnTargetStatus] = useState<string>("Em contato");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [closerLostDialogOpen, setCloserLostDialogOpen] = useState(false);
  const [closerReturnDialogOpen, setCloserReturnDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [registerOutcomePanelOpen, setRegisterOutcomePanelOpen] = useState(false);
  const [closerActiveTab, setCloserActiveTab] = useState(() => (window.innerWidth < 768 ? "negociacao" : "historico"));
  const [sdrActiveTab, setSdrActiveTab] = useState(() => (window.innerWidth < 768 ? "operacao" : "historico"));
  const [closerReturnReason, setCloserReturnReason] = useState("");
  const [closerReturnSelected, setCloserReturnSelected] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [enrichDialog, setEnrichDialog] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [sendToCloserOpen, setSendToCloserOpen] = useState(false);
  const [enrollSequenceOpen, setEnrollSequenceOpen] = useState(false);
  const [projectIdForTask, setProjectIdForTask] = useState<string | null>(null);
  const modalQueryClient = useQueryClient();
  const createProjectActivity = useCreateProjectActivity();
  const [enrichOptions, setEnrichOptions] = useState({
    brasilapi: true,
    perplexity: true,
  });
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const savingDelayRef = useRef<NodeJS.Timeout>();
  const outcomeSubmittingRef = useRef(false);

  const { data: interactions = [] } = useLeadInteractions(lead?.id ?? null);
  const { data: notes = [] } = useLeadNotes(lead?.id ?? null);

  // Closer name is already available on the opportunity object — no extra query needed
  const sdrModeCloserName = opportunity?.closer_name || null;
  const createNoteMutation = useCreateNote();
  const updateNoteMutation = useUpdateNote();
  const deleteNoteMutation = useDeleteNote();
  const deleteLeadMutation = useDeleteLead();
  const enrichLeadMutation = useEnrichIndividualLead();
  const { logActivity } = useLogLeadActivity();
  const { isSdr, isManager } = useUserRole();
  const { hasPermission } = usePermissions();
  const isAdmin = hasPermission('access_admin');
  const { isConnected: isCalendarConnected, createEvent: createCalendarEvent } = useGoogleCalendar();
  const { user: authUser } = useCurrentUser();
  const currentUserId = authUser?.id ?? null;
  const currentUserName = authUser?.name || authUser?.email || "";

  // Owner check: SDR owns lead, Closer owns opportunity
  const isOwner = useMemo(() => {
    if (!currentUserId) return false;
    if (mode === "sdr") return lead?.owner_user_id === currentUserId;
    return opportunity?.assigned_to_user_id === currentUserId || opportunity?.created_by_user_id === currentUserId;
  }, [mode, lead?.owner_user_id, opportunity?.assigned_to_user_id, opportunity?.created_by_user_id, currentUserId]);

  // If readOnly prop is set but user is admin/manager/owner, override to allow editing
  const readOnly = readOnlyProp && !isAdmin && !isManager && !isOwner;

  const canDelete = isAdmin || isOwner;

  const handleLeadUpdateWithLogging = useCallback(
    (updatedLead: Lead) => {
      if (!lead) return;

      // Preserve status-control fields to prevent race conditions
      // Field edits must NEVER overwrite status, last_contact_at, or attempts_count
      const safeUpdate = {
        ...updatedLead,
        status: lead.status,
        last_contact_at: lead.last_contact_at,
        attempts_count: lead.attempts_count,
        next_action_at: lead.next_action_at,
      };

      // Apply update immediately so controlled inputs remain responsive
      handleLeadUpdate(safeUpdate);

      // Log changes in the background (do not block typing)
      void (async () => {
        for (const field of TRACKED_FIELDS) {
          const oldValue = lead[field as keyof Lead];
          const newValue = updatedLead[field as keyof Lead];
          if (oldValue !== newValue && oldValue !== null && oldValue !== undefined && oldValue !== "") {
            const oldStr = String(oldValue);
            const newStr = String(newValue || "");
            if (oldStr !== newStr) {
              await logActivity({
                lead_id: lead.id,
                action_type: "field_updated",
                field_name: field,
                old_value: oldStr,
                new_value: newStr,
                description: getFieldChangeDescription(field, oldStr, newStr),
              });
            }
          }
        }
      })();
    },
    [lead, logActivity],
  );

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (savingDelayRef.current) {
        clearTimeout(savingDelayRef.current);
      }
    };
  }, []);

  const handleLeadUpdate = (updatedLead: Lead) => {
    // Apply update immediately so controlled inputs remain responsive
    onUpdateLead(updatedLead);

    setIsSaving(true);

    if (savingDelayRef.current) {
      clearTimeout(savingDelayRef.current);
    }
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    savingDelayRef.current = setTimeout(() => {
      setLastSavedAt(new Date());
      setIsSaving(false);

      saveTimeoutRef.current = setTimeout(() => {
        setLastSavedAt(null);
      }, 2000);
    }, 200);
  };

  const getUserInfo = useCallback(() => {
    return { id: currentUserId, name: currentUserName || "Usuário" };
  }, [currentUserId, currentUserName]);

  const isInbound = lead?.lead_type === "INBOUND";
  const isOverdue = lead ? isLeadOverdue(lead) : false;
  const { data: cadenceStep } = useCadenceStep(
    lead && !isInbound ? lead.cadence_id ?? null : null,
    lead && !isInbound ? lead.current_cadence_step ?? null : null
  );

  const handleStatusChange = useCallback(
    async (newStatus: LeadStatus) => {
      if (!lead) return;
      const now = new Date();
      const oldStatus = lead.status;
      const userInfo = getUserInfo();
      onUpdateLead({ ...lead, status: newStatus, last_contact_at: now });
      await logActivity({
        lead_id: lead.id,
        action_type: "status_changed",
        field_name: "status",
        old_value: oldStatus,
        new_value: newStatus,
        description: `alterou o status de ${getStatusLabel(oldStatus)} para ${getStatusLabel(newStatus)}`,
      });
      // Register note in contact history
      try {
        await createNoteMutation.mutateAsync({
          lead_id: lead.id,
          user_id: userInfo.id,
          note: `[${getStatusLabel(newStatus)}] (${userInfo.name}) Status alterado de ${getStatusLabel(oldStatus)} para ${getStatusLabel(newStatus)}`,
        });
      } catch (e) {
        console.error("Failed to create status change note:", e);
      }
      // Invalidate cross-view caches so Closer pipeline reflects SDR status changes
      modalQueryClient.invalidateQueries({ queryKey: ["closer-pipeline"] });
      modalQueryClient.invalidateQueries({ queryKey: ["closer-opportunities-paginated"] });
      toast.success(`Status atualizado para ${newStatus}`);
    },
    [lead, getUserInfo, onUpdateLead, logActivity, createNoteMutation, modalQueryClient],
  );

  const handleStatusChangeWithObservation = useCallback(
    async (observation: string, nextActionAt?: Date) => {
      if (!lead) return;
      const now = new Date();
      const userInfo = getUserInfo();
      const oldStatus = lead.status;
      onUpdateLead({
        ...lead,
        status: "Em contato",
        last_contact_at: now,
        attempts_count: lead.attempts_count + 1,
        next_action_at: nextActionAt || now,
      });
      await logActivity({
        lead_id: lead.id,
        action_type: "status_changed",
        field_name: "status",
        old_value: oldStatus,
        new_value: "Em contato",
        description: `alterou o status de ${getStatusLabel(oldStatus)} para ${getStatusLabel("Em contato")}`,
      });
      const noteText = observation
        ? `[Em contato] (${userInfo.name}) ${observation}`
        : `[Em contato] (${userInfo.name}) Status atualizado`;
      try {
        await createNoteMutation.mutateAsync({
          lead_id: lead.id,
          user_id: userInfo.id,
          note: noteText,
        });
        await logActivity({
          lead_id: lead.id,
          action_type: "note_added",
          description: `adicionou uma observação`,
        });
        toast.success(`Status atualizado para Em contato`);
      } catch (error) {
        console.error("Error saving note:", error);
        toast.success(`Status atualizado para Em contato`);
        toast.error("Erro ao salvar observação");
      }
      // Invalidate cross-view caches so Closer pipeline reflects SDR status changes
      modalQueryClient.invalidateQueries({ queryKey: ["closer-pipeline"] });
      modalQueryClient.invalidateQueries({ queryKey: ["closer-opportunities-paginated"] });
    },
    [lead, getUserInfo, onUpdateLead, logActivity, createNoteMutation, modalQueryClient],
  );

  const handleOpenMeetingDialog = useCallback(() => {
    if (!lead) return;
    // Check blocking rules first
    const advanceCheck = canAdvanceToMeeting(lead);
    if (!advanceCheck.allowed) {
      toast.error(advanceCheck.reason);
      return;
    }

    const missingQualification = getMissingQualificationFields(lead);
    const missingCompanyData = getMissingCompanyDataFields(lead);

    if (missingQualification.length > 0) {
      toast.error(`Qualificação incompleta. Campos faltantes: ${missingQualification.join(", ")}`);
      return;
    }
    if (missingCompanyData.length > 0) {
      toast.error(`Dados da Empresa incompletos. Campos faltantes: ${missingCompanyData.join(", ")}`);
      return;
    }
    setMeetingDialogOpen(true);
  }, [lead]);

  const handleConfirmMeeting = useCallback(
    async (meetingData: MeetingData) => {
      if (!lead) return;
      const now = new Date();
      const userInfo = getUserInfo();
      const oldStatus = lead.status;
      const [hours, minutes] = meetingData.meetingTime.split(":").map(Number);
      const meetingDatetime = new Date(meetingData.meetingDate);
      meetingDatetime.setHours(hours, minutes, 0, 0);
      // Set next_action_at to 1 hour before the meeting
      const nextActionAt = new Date(meetingDatetime.getTime() - 60 * 60 * 1000);

      // Create meeting record first (needed for calendar link)
      let meetingRecordId: string | undefined;
      try {
        const { data: meetingRow } = await supabase
          .from("meetings")
          .insert({
            lead_id: lead.id,
            user_id: userInfo.id,
            title: meetingData.meetingTitle,
            executive_name: meetingData.executiveName,
            meeting_datetime: meetingDatetime.toISOString(),
            reminder_minutes_before: meetingData.reminderMinutesBefore,
          })
          .select("id")
          .single();
        meetingRecordId = meetingRow?.id;
      } catch (error) {
        console.error("Error saving meeting:", error);
      }

      // Create opportunity in Closer pipeline BEFORE updating lead status
      // If this fails, we abort so the lead doesn't get stuck in "Reunião agendada" without an opportunity
      try {
        await createOpportunityFromMeeting(
          lead.id,
          userInfo.id,
          meetingData.executiveUserId || null,
          meetingDatetime.toISOString(),
        );
      } catch (error: any) {
        console.error("Error creating opportunity:", error);
        const errorMsg = error?.message || "Erro desconhecido";
        toast.error(`Não foi possível criar a oportunidade no pipeline do Closer: ${errorMsg}`);
        // Clean up the meeting record since we're aborting
        if (meetingRecordId) {
          try { await supabase.from("meetings").delete().eq("id", meetingRecordId); } catch { /* cleanup */ }
        }
        return;
      }

      // Only update lead status AFTER opportunity was successfully created
      onUpdateLead({
        ...lead,
        status: "Reunião agendada" as any,
        last_contact_at: now,
        next_action_at: nextActionAt,
        attempts_count: lead.attempts_count + 1,
      });

      const formattedDate = meetingDatetime.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const formattedTime = meetingDatetime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      try {
        await createNoteMutation.mutateAsync({
          lead_id: lead.id,
          user_id: userInfo.id,
          note: `[Reunião Agendada] (${userInfo.name}) ${meetingData.meetingTitle} - Executivo: ${meetingData.executiveName} - Data: ${formattedDate} às ${formattedTime}`,
        });
      } catch (error) {
        console.error("Error saving note:", error);
      }
      await logActivity({
        lead_id: lead.id,
        action_type: "meeting_scheduled",
        description: `agendou reunião "${meetingData.meetingTitle}" com ${meetingData.executiveName} para ${formattedDate} às ${formattedTime}`,
      });
      await logActivity({
        lead_id: lead.id,
        action_type: "status_changed",
        field_name: "status",
        old_value: oldStatus,
        new_value: "Reunião agendada",
        description: `alterou o status de ${getStatusLabel(oldStatus)} para ${getStatusLabel("Reunião agendada")}`,
      });
      toast.success(`Reunião agendada para ${formattedDate} às ${formattedTime}!`);

      // Google Calendar event + email (non-blocking)
      const meetingEndDatetime = new Date(meetingDatetime.getTime() + 60 * 60 * 1000);
      const attendees = (meetingData.inviteEmails || []).map((email) => ({ email }));

      let meetLink: string | undefined;
      if (isCalendarConnected) {
        try {
          const calResult = await createCalendarEvent({
            summary: meetingData.meetingTitle,
            start: { dateTime: meetingDatetime.toISOString() },
            end: { dateTime: meetingEndDatetime.toISOString() },
            attendees,
            description: `Empresa: ${lead.company}\nContato: ${lead.name}\nExecutivo: ${meetingData.executiveName}`,
          });
          meetLink =
            calResult?.hangoutLink ||
            calResult?.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri;
          // Persist meet_link to meetings table
          if (meetLink && meetingRecordId) {
            await supabase
              .from("meetings")
              .update({ meet_link: meetLink } as any)
              .eq("id", meetingRecordId);
          }
        } catch (err) {
          console.error("Google Calendar error:", err);
          toast.warning("Reunião salva, mas o evento do calendário não foi criado.");
        }
      } else if (attendees.length > 0) {
        toast.warning("Google Calendar não conectado. Convites .ics não foram enviados.");
      }

      if (attendees.length > 0) {
        try {
          await supabase.functions.invoke("send-meeting-invite", {
            body: {
              emails: meetingData.inviteEmails,
              meetingTitle: meetingData.meetingTitle,
              meetingDate: formattedDate,
              meetingTime: formattedTime,
              executiveName: meetingData.executiveName,
              companyName: lead.company,
              sdrName: userInfo.name,
              meetLink,
            },
          });
        } catch (err) {
          console.error("Email invite error:", err);
          toast.warning("Reunião salva, mas o e-mail de convite não foi enviado.");
        }
      }

      onClose();
    },
    [
      lead,
      getUserInfo,
      onUpdateLead,
      logActivity,
      createNoteMutation,
      isCalendarConnected,
      createCalendarEvent,
      onClose,
    ],
  );

  const handleOpenConfirmedDialog = useCallback(() => setConfirmedDialogOpen(true), []);

  const handleConfirmPresence = useCallback(async () => {
    if (!lead) return;
    const now = new Date();
    const userInfo = getUserInfo();
    const oldStatus = lead.status;
    onUpdateLead({
      ...lead,
      status: "Oportunidade criada",
      last_contact_at: now,
      attempts_count: lead.attempts_count + 1,
    });
    try {
      await createNoteMutation.mutateAsync({
        lead_id: lead.id,
        user_id: userInfo.id,
        note: `[Reunião Realizada] (${userInfo.name}) Reunião realizada. Oportunidade criada.`,
      });
    } catch (error) {
      console.error("Error saving note:", error);
    }
    // Create opportunity in Closer pipeline if not already existing
    try {
      await createOpportunityFromMeeting(lead.id, userInfo.id, null, new Date().toISOString());
    } catch (error) {
      console.error("Error creating opportunity:", error);
    }
    await logActivity({
      lead_id: lead.id,
      action_type: "opportunity_created",
      description: `confirmou presença na reunião e criou oportunidade`,
    });
    await logActivity({
      lead_id: lead.id,
      action_type: "status_changed",
      field_name: "status",
      old_value: oldStatus,
      new_value: "Oportunidade criada",
      description: `alterou o status de ${getStatusLabel(oldStatus)} para ${getStatusLabel("Oportunidade criada")}`,
    });
    toast.success("Reunião realizada! Oportunidade criada no pipeline.");
    onClose();
  }, [lead, getUserInfo, onUpdateLead, logActivity, createNoteMutation, onClose]);

  const handleOpenDiscardDialog = useCallback(() => setDiscardDialogOpen(true), []);

  const handleConfirmDiscard = useCallback(
    async (reason: DiscardReason) => {
      if (!lead) return;
      const now = new Date();
      const userInfo = getUserInfo();
      const oldStatus = lead.status;
      onUpdateLead({
        ...lead,
        status: "Descartado",
        last_contact_at: now,
        next_action_at: new Date("2099-12-31T23:59:59Z"),
        attempts_count: lead.attempts_count + 1,
      });
      try {
        await createNoteMutation.mutateAsync({
          lead_id: lead.id,
          user_id: userInfo.id,
          note: `[Perdido] (${userInfo.name}) Motivo: ${reason.status} - ${reason.description}`,
        });
      } catch (error) {
        console.error("Error saving note:", error);
      }
      await logActivity({
        lead_id: lead.id,
        action_type: "status_changed",
        field_name: "status",
        old_value: oldStatus,
        new_value: "Descartado",
        description: `marcou o lead como perdido. Motivo: ${reason.status} - ${reason.description}`,
      });
      toast.info(`Lead perdido: ${reason.status}`);
      onClose();
    },
    [lead, getUserInfo, onUpdateLead, logActivity, createNoteMutation, onClose],
  );

  const handleRestoreLead = useCallback(async () => {
    if (!lead) return;
    const now = new Date();
    const userInfo = getUserInfo();
    const oldStatus = lead.status;
    onUpdateLead({ ...lead, status: "Novo", last_contact_at: now, next_action_at: now });
    try {
      await createNoteMutation.mutateAsync({
        lead_id: lead.id,
        user_id: userInfo.id,
        note: `[Restaurado] (${userInfo.name}) Lead restaurado para status 'Novo'`,
      });
    } catch (error) {
      console.error("Error saving note:", error);
    }
    await logActivity({
      lead_id: lead.id,
      action_type: "status_changed",
      field_name: "status",
      old_value: oldStatus,
      new_value: "Novo",
      description: `restaurou o lead para status ${getStatusLabel("Novo")}`,
    });
    toast.success("Lead restaurado com sucesso!");
  }, [lead, getUserInfo, onUpdateLead, logActivity, createNoteMutation]);

  const handleScheduleReturn = useCallback(
    async (data: ScheduleReturnData) => {
      if (!lead) return;
      const [hours, minutes] = data.time.split(":").map(Number);
      const scheduledDate = new Date(data.date);
      scheduledDate.setHours(hours, minutes, 0, 0);
      const now = new Date();
      const userInfo = getUserInfo();
      const oldStatus = lead.status;
      const targetStatus = scheduleReturnTargetStatus;
      onUpdateLead({
        ...lead,
        status: targetStatus as any,
        next_action_at: scheduledDate,
        last_contact_at: now,
        attempts_count: lead.attempts_count + 1,
      });
      setScheduleReturnTargetStatus("Em contato"); // reset
      const formattedDate = scheduledDate.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      try {
        await createNoteMutation.mutateAsync({
          lead_id: lead.id,
          user_id: userInfo.id,
          note: `[Retorno agendado para ${formattedDate}] (${userInfo.name}) ${data.observation || "Sem observação"}`,
        });
      } catch (error) {
        console.error("Error saving note:", error);
      }
      await logActivity({
        lead_id: lead.id,
        action_type: "status_changed",
        field_name: "status",
        old_value: oldStatus,
        new_value: targetStatus,
        description: `agendou retorno para ${formattedDate}`,
      });
      toast.success(`Retorno agendado para ${formattedDate}`);
    },
    [lead, getUserInfo, onUpdateLead, logActivity, createNoteMutation, scheduleReturnTargetStatus],
  );

  const handleDeleteLead = useCallback(async () => {
    if (!lead) return;
    try {
      if (mode === "closer" && opportunity) {
        // Delete opportunity in closer mode
        const { bulkDeleteOpportunities } = await import("@/services/closerService");
        await bulkDeleteOpportunities([opportunity.id]);
        toast.success("Oportunidade excluída permanentemente");
        onOpportunityStageChange?.();
      } else {
        await deleteLeadMutation.mutateAsync(lead.id);
        toast.success("Lead excluído permanentemente");
      }
      setDeleteDialogOpen(false);
      onClose();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error(`Erro ao excluir ${mode === "closer" ? "oportunidade" : "lead"}. Verifique suas permissões.`);
    }
  }, [lead, mode, opportunity, deleteLeadMutation, onClose, onOpportunityStageChange]);

  const handleEnrichLead = useCallback(async () => {
    if (!lead) return;
    if (!lead.cnpj) {
      toast.error("Lead não possui CNPJ. Enriquecimento requer CNPJ válido.");
      return;
    }

    // Check 30-day cooldown for Perplexity (IA) enrichment
    if (enrichOptions.perplexity) {
      const aiData = lead.ai_enrichment_data as Record<string, any> | null;
      const lastEnrichedAt = aiData?.enriched_at;
      if (lastEnrichedAt) {
        const lastDate = new Date(lastEnrichedAt);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 30) {
          const remaining = 30 - diffDays;
          toast.error(
            `Enriquecimento com IA já foi realizado há ${diffDays} dia(s). Aguarde mais ${remaining} dia(s) para atualizar novamente.`,
          );
          return;
        }
      }
    }

    try {
      await enrichLeadMutation.mutateAsync({
        leadId: lead.id,
        enrich_brasilapi: enrichOptions.brasilapi,
        enrich_perplexity: enrichOptions.perplexity,
      });

      // Refresh lead data from database
      const { data: updatedLead } = await supabase.from("leads").select("*").eq("id", lead.id).single();

      if (updatedLead) {
        // Convert database row to Lead type
        const enrichedLead = {
          ...updatedLead,
          last_contact_at: updatedLead.last_contact_at ? new Date(updatedLead.last_contact_at) : null,
          next_action_at: new Date(updatedLead.next_action_at),
          created_at: new Date(updatedLead.created_at),
          updated_at: new Date(updatedLead.updated_at),
        } as unknown as Lead;
        onUpdateLead(enrichedLead);
      }
      setEnrichDialog(false);
    } catch (error) {
      console.error("Error enriching lead:", error);
    }
  }, [lead, enrichOptions, enrichLeadMutation, onUpdateLead]);

  // Handle outcome registration from the new panel
  const handleRegisterOutcome = useCallback(
    async (data: OutcomeData) => {
      if (!lead) return;
      const now = new Date();
      const userInfo = getUserInfo();
      const oldStatus = lead.status;

      // Map result to status updates
      const resultStatusMap: Record<string, LeadStatus> = {
        nao_atendeu: "Em contato",
        interesse: "Interesse",
        sem_interesse: "Descartado",
        reagendado: "Em contato",
        conectou: "Em contato",
      };
      const newStatus = resultStatusMap[data.result] || lead.status;

      // Build next_action_at
      let nextActionAt = lead.next_action_at;
      if (data.nextActionDate) {
        const [hours, minutes] = data.nextActionTime.split(":").map(Number);
        const scheduledDate = new Date(data.nextActionDate);
        scheduledDate.setHours(hours, minutes, 0, 0);
        nextActionAt = scheduledDate;
      }

      onUpdateLead({
        ...lead,
        status: newStatus,
        last_contact_at: now,
        next_action_at: nextActionAt,
        attempts_count: lead.attempts_count + 1,
      });

      // Create interaction
      const channelMap: Record<string, string> = {
        call: "call",
        whatsapp: "whatsapp",
        meeting: "other",
        other: "other",
      };
      const outcomeMap: Record<string, string> = {
        conectou: "respondeu",
        nao_atendeu: "sem_resposta",
        interesse: "qualificado",
        sem_interesse: "descartado",
        reagendado: "reagendado",
      };

      try {
        await createInteraction({
          lead_id: lead.id,
          user_id: userInfo.id,
          channel: channelMap[data.contactType] as any,
          direction: "outbound",
          outcome: outcomeMap[data.result] as any,
          message_summary: data.observation || null,
          occurred_at: now,
        });
      } catch (e) {
        console.error("Error creating interaction:", e);
      }

      // Create note
      const contactLabels: Record<string, string> = {
        call: "Ligação",
        whatsapp: "WhatsApp",
        meeting: "Reunião",
        other: "Outro",
      };
      const resultLabels: Record<string, string> = {
        conectou: "Conectou",
        nao_atendeu: "Não atendeu",
        interesse: "Interesse",
        sem_interesse: "Sem interesse",
        reagendado: "Reagendado",
      };
      const noteText = `[${contactLabels[data.contactType]}] (${userInfo.name}) Resultado: ${resultLabels[data.result]}${data.observation ? ` - ${data.observation}` : ""}`;

      try {
        await createNoteMutation.mutateAsync({ lead_id: lead.id, user_id: userInfo.id, note: noteText });
      } catch (e) {
        console.error("Error saving note:", e);
      }

      // Log activity
      await logActivity({
        lead_id: lead.id,
        action_type: "status_changed",
        field_name: "status",
        old_value: oldStatus,
        new_value: newStatus,
        description: `registrou resultado: ${resultLabels[data.result]} via ${contactLabels[data.contactType]}`,
      });

      toast.success("Resultado registrado!");
    },
    [lead, getUserInfo, onUpdateLead, logActivity, createNoteMutation],
  );

  // Handle funnel step click from the operation column
  const handleFunnelStepClick = useCallback(
    (stepKey: string) => {
      switch (stepKey) {
        case "novo":
          handleStatusChange("Novo" as LeadStatus);
          break;
        case "em_contato":
          setObservationDialogOpen(true);
          break;
        case "lead_quente":
          handleStatusChange("Interesse" as LeadStatus);
          break;
        case "reuniao":
          handleOpenMeetingDialog();
          break;
        case "sqo":
          handleOpenConfirmedDialog();
          break;
        case "oportunidade_futura":
          setScheduleReturnTargetStatus("Interesse/Agendar Retorno");
          setScheduleReturnDialogOpen(true);
          break;
        case "reciclagem":
          handleStatusChange("Reciclagem" as LeadStatus);
          break;
        case "perdido":
          handleOpenDiscardDialog();
          break;
      }
    },
    [handleStatusChange, handleOpenMeetingDialog, handleOpenConfirmedDialog, handleOpenDiscardDialog],
  );

  // Handle API Oficial step click
  const handleApiOficialStepClick = useCallback(
    (stepKey: string) => {
      const stage = API_OFICIAL_STEP_TO_STAGE[stepKey];
      if (stage && onApiOficialStageChange) {
        onApiOficialStageChange(stage);
      }
    },
    [onApiOficialStageChange],
  );

  // Check if SQO has any data filled (for SDR visibility)
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
    [
      lead?.sqo_pain_category,
      lead?.sqo_urgency,
      lead?.sqo_budget,
      lead?.sqo_decision_maker,
      lead?.sqo_icp_fit,
      lead?.sqo_next_step,
    ],
  );
  const showSqoTab = mode !== "sdr" || hasSqoData;

  const handleCloserStageChange = useCallback(
    async (stage: CloserStage) => {
      if (!opportunity) return;
      if (stage === "Perdido") {
        setCloserLostDialogOpen(true);
        return;
      } else if (stage === "Ganho") {
        await markOpportunityWon(opportunity.id);
        onOpportunityStageChange?.();
        toast.success("Oportunidade ganha!");
      } else {
        await updateOpportunityStage(opportunity.id, stage);
        onOpportunityStageChange?.();
        toast.success(`Status atualizado para ${stage}`);
      }
    },
    [opportunity, onOpportunityStageChange],
  );

  const handleCloserReturn = useCallback(() => {
    if (opportunity) {
      setCloserReturnReason("");
      setCloserReturnSelected("");
      setCloserReturnDialogOpen(true);
    }
  }, [opportunity]);

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
        await supabase.from("lead_notes").insert({
          lead_id: lead.id,
          user_id: currentUserId,
          note: `📋 Tarefa criada: ${data.title}${data.assignedUserName ? ` | Responsável: ${data.assignedUserName}` : ""}${data.dueDate ? ` | Vencimento: ${new Date(data.dueDate).toLocaleDateString("pt-BR")}` : ""}${taskIdTag}`,
        } as any);
        modalQueryClient.invalidateQueries({ queryKey: ["notes", lead.id] });
      }
      // Update next_action_at if the task has a due date
      if (data.dueDate) {
        const taskDate = new Date(data.dueDate);
        const currentNext = new Date(lead.next_action_at);
        const now = new Date();
        if (taskDate > now && (taskDate < currentNext || currentNext < now)) {
          onUpdateLead({ ...lead, next_action_at: taskDate });
        }
      }
      toast.success("Tarefa criada com sucesso");
    },
    [lead, projectIdForTask, currentUserId, modalQueryClient, createProjectActivity, onUpdateLead],
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
          if (!value && emailDialogOpen) return;
          onClose();
        }}
      >
        <DialogContent
          className="w-full max-w-[1366px] h-[100dvh] sm:h-[92dvh] flex flex-col p-0 gap-0 bg-card overflow-hidden rounded-none sm:rounded-lg"
          onPointerDownOutside={(e) => {
            if (emailDialogOpen) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (emailDialogOpen) e.preventDefault();
          }}
        >
          {/* Hidden title for accessibility */}
          <DialogHeader className="sr-only">
            <DialogTitle>{lead.name}</DialogTitle>
          </DialogHeader>

          {/* Queue controls slot */}
          {topSlot && <div className="flex-shrink-0">{topSlot}</div>}

          {/* Top-right action buttons */}
          {!readOnly && (
            <div className="absolute top-2 sm:top-4 right-10 sm:right-12 z-10 flex items-center gap-1.5 sm:gap-3">
              {/* Copy link */}
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
                <Button
                  onClick={handleRestoreLead}
                  variant="outline"
                  size="sm"
                  className="gap-1 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restaurar
                </Button>
              )}
              {mode === "sdr" && (isAdmin || isManager) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setSendToCloserOpen(true)}
                      className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Send className="h-4 w-4" />
                      <span className="sr-only">Enviar para Closer</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <span className="text-xs">Enviar para Closer</span>
                  </TooltipContent>
                </Tooltip>
              )}
              {mode === "sdr" && lead.email && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setEnrollSequenceOpen(true)}
                      className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <MailCheck className="h-4 w-4" />
                      <span className="sr-only">Sequência de E-mail</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <span className="text-xs">Inscrever em Sequência</span>
                  </TooltipContent>
                </Tooltip>
              )}
              {canDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setDeleteDialogOpen(true)}
                      className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Excluir</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <span className="text-xs">Excluir</span>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}

          {/* Read-only banner */}
          {readOnly && (
            <div className="absolute top-3 right-12 z-10">
              <Badge variant="secondary" className="text-xs">
                Somente leitura
              </Badge>
            </div>
          )}

          {/* SDR / API Oficial Mode: New operational layout */}
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
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {apiOficialStage}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <LeadModalHeader
                  lead={lead}
                  onRegisterOutcome={() => setRegisterOutcomePanelOpen(true)}
                  leadId={lead.id}
                  ownerUserId={lead.owner_user_id}
                  ownerName={lead.owner_name}
                  currentUserId={currentUserId}
                  canManage={isAdmin || isManager}
                  closerName={sdrModeCloserName || opportunity?.closer_name || null}
                />
              )}

              {/* Desktop: resizable split layout */}
              <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0 hidden md:flex">
                {/* Left Column - Strategic SDR Panel */}
                <ResizablePanel
                  defaultSize={20}
                  minSize={18}
                  maxSize={40}
                  className={cn(
                    "min-w-0 overflow-hidden flex flex-col",
                    readOnly && "pointer-events-none opacity-60",
                  )}
                >
                  <ScrollArea className="flex-1">
                    <SDRStrategicPanel
                      lead={lead}
                      interactions={interactions}
                      notes={notes}
                      onStepClick={mode === "api_oficial" ? handleApiOficialStepClick : handleFunnelStepClick}
                      onSubstatusChange={handleStatusChange}
                      onRegisterOutcome={() => setRegisterOutcomePanelOpen(true)}
                      onUpdateLead={handleLeadUpdateWithLogging}
                      onSendEmail={() => setEmailDialogOpen(true)}
                      onOpenScheduleReturn={() => {
                        setScheduleReturnTargetStatus("Em contato");
                        setScheduleReturnDialogOpen(true);
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

                {/* Right Column - Tabbed Content */}
                <ResizablePanel defaultSize={80} className="flex flex-col min-h-0">
                  <Tabs value={sdrActiveTab} onValueChange={setSdrActiveTab} className="flex flex-col h-full min-h-0">
                    <div className="flex-shrink-0 px-3 pt-2 border-b border-border">
                      <TabsList className="h-auto w-full bg-transparent gap-0 p-0 items-end">
                        <TabsTrigger
                          value="historico"
                          className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                        >
                          Histórico
                        </TabsTrigger>
                        <TabsTrigger
                          value="empresa"
                          className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                        >
                          Empresa
                        </TabsTrigger>
                        <TabsTrigger
                          value="qualificacao"
                          className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                        >
                          Qualificação
                        </TabsTrigger>
                        {showSqoTab && (
                          <TabsTrigger
                            value="sqo"
                            className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                          >
                            SQO
                          </TabsTrigger>
                        )}
                        <TabsTrigger
                          value="insights"
                          className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                        >
                          Insights
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <div className="flex-1 min-h-0 flex flex-col">
                      <TabsContent
                        value="historico"
                        className="m-0 flex-1 min-h-0 flex flex-col"
                        forceMount
                        style={{ display: sdrActiveTab === "historico" ? "flex" : "none" }}
                      >
                        <LeadActivityTimeline
                          leadId={lead.id}
                          canEdit={true}
                          leadData={{
                            email: lead.email,
                            name: lead.name,
                            company: lead.company,
                            phone: lead.phone,
                            razao_social: lead.razao_social,
                            nome_fantasia: lead.nome_fantasia,
                          }}
                          sinceDate={mode === "api_oficial" ? apiOficialCreatedAt : undefined}
                        />
                      </TabsContent>
                      {sdrActiveTab !== "historico" && (
                        <ScrollArea className="flex-1">
                          <TabsContent value="empresa" className="m-0 px-4 py-4">
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                              Dados da Empresa
                            </h3>
                            <CompanyDataSection lead={lead} onUpdateLead={handleLeadUpdateWithLogging} />
                          </TabsContent>
                          <TabsContent value="qualificacao" className="m-0 px-4 py-4">
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                              Qualificação
                            </h3>
                            <CompanyInfoSection
                              lead={lead}
                              onUpdateLead={handleLeadUpdateWithLogging}
                              readOnly={mode !== "sdr"}
                            />
                          </TabsContent>
                          {showSqoTab && (
                            <TabsContent value="sqo" className="m-0 px-4 py-4">
                              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                                Validação SQO
                              </h3>
                              <SQOValidationSection
                                lead={lead}
                                onUpdateLead={handleLeadUpdateWithLogging}
                                readOnly={isSdr}
                              />
                            </TabsContent>
                          )}
                          <TabsContent value="insights" className="m-0 px-4 py-4">
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                              Insights
                            </h3>
                            <InsightsSection lead={lead} onUpdateLead={handleLeadUpdateWithLogging} />
                          </TabsContent>
                        </ScrollArea>
                      )}
                    </div>
                  </Tabs>
                </ResizablePanel>
              </ResizablePanelGroup>

              {/* Mobile: unified tabs layout */}
              <div className="flex-1 min-h-0 flex flex-col md:hidden">
                <Tabs value={sdrActiveTab} onValueChange={setSdrActiveTab} className="flex flex-col flex-1 min-h-0">
                  <div className="flex-shrink-0 px-2 pt-1.5 border-b border-border">
                    <div className="overflow-x-auto">
                      <TabsList className="h-auto w-full bg-transparent gap-0 p-0 flex items-end">
                        <TabsTrigger
                          value="operacao"
                          className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                        >
                          Operação
                        </TabsTrigger>
                        <TabsTrigger
                          value="empresa"
                          className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                        >
                          Empresa
                        </TabsTrigger>
                        <TabsTrigger
                          value="historico"
                          className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                        >
                          Histórico
                        </TabsTrigger>
                        <TabsTrigger
                          value="qualificacao"
                          className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                        >
                          Qualif.
                        </TabsTrigger>
                        <TabsTrigger
                          value="insights"
                          className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                        >
                          Insights
                        </TabsTrigger>
                      </TabsList>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 flex flex-col">
                    <TabsContent
                      value="historico"
                      className="m-0 flex-1 min-h-0 flex flex-col"
                      forceMount
                      style={{ display: sdrActiveTab === "historico" ? "flex" : "none" }}
                    >
                      <LeadActivityTimeline
                        leadId={lead.id}
                        canEdit={true}
                        leadData={{
                          email: lead.email,
                          name: lead.name,
                          company: lead.company,
                          phone: lead.phone,
                          razao_social: lead.razao_social,
                          nome_fantasia: lead.nome_fantasia,
                        }}
                        sinceDate={mode === "api_oficial" ? apiOficialCreatedAt : undefined}
                      />
                    </TabsContent>
                    {sdrActiveTab !== "historico" && (
                      <ScrollArea className="flex-1">
                        <TabsContent
                          value="operacao"
                          className={cn("m-0", readOnly && "pointer-events-none opacity-60")}
                        >
                          <SDRStrategicPanel
                            lead={lead}
                            interactions={interactions}
                            notes={notes}
                            onStepClick={mode === "api_oficial" ? handleApiOficialStepClick : handleFunnelStepClick}
                            onSubstatusChange={handleStatusChange}
                            onRegisterOutcome={() => setRegisterOutcomePanelOpen(true)}
                            onUpdateLead={handleLeadUpdateWithLogging}
                            onSendEmail={() => setEmailDialogOpen(true)}
                            onOpenScheduleReturn={() => {
                              setScheduleReturnTargetStatus("Em contato");
                              setScheduleReturnDialogOpen(true);
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
                          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            Dados da Empresa
                          </h3>
                          <CompanyDataSection lead={lead} onUpdateLead={handleLeadUpdateWithLogging} />
                        </TabsContent>
                        <TabsContent value="qualificacao" className="m-0 px-4 py-4">
                          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            Qualificação
                          </h3>
                          <CompanyInfoSection
                            lead={lead}
                            onUpdateLead={handleLeadUpdateWithLogging}
                            readOnly={mode !== "sdr"}
                          />
                        </TabsContent>
                        {showSqoTab && (
                          <TabsContent value="sqo" className="m-0 px-4 py-4">
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                              Validação SQO
                            </h3>
                            <SQOValidationSection
                              lead={lead}
                              onUpdateLead={handleLeadUpdateWithLogging}
                              readOnly={isSdr}
                            />
                          </TabsContent>
                        )}
                        <TabsContent value="insights" className="m-0 px-4 py-4">
                          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            Insights
                          </h3>
                          <InsightsSection lead={lead} onUpdateLead={handleLeadUpdateWithLogging} />
                        </TabsContent>
                      </ScrollArea>
                    )}
                  </div>
                </Tabs>
              </div>
            </>
          ) : (
            /* Closer Mode: Strategic negotiation panel */
            <>
              {opportunity && (
                <CloserModalHeader
                  lead={lead}
                  opportunity={opportunity}
                  opportunityId={opportunity.id}
                  currentCloserId={opportunity.assigned_to_user_id}
                  closerName={opportunity.closer_name}
                  currentUserId={currentUserId}
                  canManage={isAdmin || isManager}
                />
              )}

              <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0 hidden md:flex">
                {/* Left Column - Strategic Operations */}
                <ResizablePanel
                  defaultSize={20}
                  minSize={18}
                  maxSize={40}
                  className={cn(
                    "min-w-0 overflow-hidden flex flex-col",
                    readOnly && "pointer-events-none opacity-60",
                  )}
                >
                  <ScrollArea className="flex-1">
                    <CloserStrategicPanel
                      lead={lead}
                      opportunity={opportunity!}
                      onCloserStageChange={handleCloserStageChange}
                      onReturnToSdr={handleCloserReturn}
                      onUpdateLead={handleLeadUpdateWithLogging}
                      onOpportunityFieldChange={() => onOpportunityStageChange?.()}
                      onSendEmail={() => setEmailDialogOpen(true)}
                      onNavigateToHistory={() => setCloserActiveTab("historico")}
                    />
                  </ScrollArea>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Right Column - Tabbed Content */}
                <ResizablePanel defaultSize={80} minSize={50} className="flex flex-col min-h-0">
                  <Tabs
                    value={closerActiveTab}
                    onValueChange={setCloserActiveTab}
                    className="flex flex-col flex-1 min-h-0"
                  >
                    <div className="flex-shrink-0 px-3 pt-2 border-b border-border">
                      <TabsList className="h-auto w-full bg-transparent gap-0 p-0 items-end">
                        <TabsTrigger
                          value="historico"
                          className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                        >
                          Histórico
                        </TabsTrigger>
                        <TabsTrigger
                          value="propostas"
                          className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                        >
                          Propostas
                        </TabsTrigger>
                        <TabsTrigger
                          value="empresa"
                          className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                        >
                          Empresa
                        </TabsTrigger>
                        <TabsTrigger
                          value="qualificacao"
                          className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                        >
                          Qualificação
                        </TabsTrigger>
                        {showSqoTab && (
                          <TabsTrigger
                            value="sqo"
                            className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                          >
                            SQO
                          </TabsTrigger>
                        )}
                        <TabsTrigger
                          value="insights"
                          className="flex-1 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                        >
                          Insights
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    {/* Historico tab — outside ScrollArea for fixed composer */}
                    <TabsContent
                      value="historico"
                      className="m-0 flex-1 min-h-0 flex flex-col overflow-hidden"
                      forceMount
                      style={{ display: closerActiveTab === "historico" ? "flex" : "none" }}
                    >
                      <LeadActivityTimeline
                        leadId={lead.id}
                        canEdit={true}
                        opportunityId={opportunity?.id}
                        leadData={{
                          email: lead.email,
                          name: lead.name,
                          company: lead.company,
                          phone: lead.phone,
                          razao_social: lead.razao_social,
                          nome_fantasia: lead.nome_fantasia,
                        }}
                      />
                    </TabsContent>

                    {/* Other tabs — inside ScrollArea */}
                    <ScrollArea
                      className="flex-1"
                      style={{ display: closerActiveTab === "historico" ? "none" : undefined }}
                    >
                      {opportunity && (
                        <TabsContent value="propostas" className="m-0 px-4 py-4">
                          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            Propostas Comerciais
                          </h3>
                          <OpportunityProposalsSection
                            opportunityId={opportunity.id}
                            lead={lead}
                            opportunity={opportunity}
                          />
                        </TabsContent>
                      )}
                      <TabsContent value="empresa" className="m-0 px-4 py-4">
                        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                          Dados da Empresa
                        </h3>
                        <CompanyDataSection lead={lead} onUpdateLead={handleLeadUpdateWithLogging} />
                      </TabsContent>
                      <TabsContent value="qualificacao" className="m-0 px-4 py-4">
                        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                          Qualificação
                        </h3>
                        <CompanyInfoSection
                          lead={lead}
                          onUpdateLead={handleLeadUpdateWithLogging}
                          readOnly={!(opportunity?.created_by_user_id === currentUserId)}
                        />
                      </TabsContent>
                      {showSqoTab && (
                        <TabsContent value="sqo" className="m-0 px-4 py-4">
                          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            Validação SQO
                          </h3>
                          <SQOValidationSection
                            lead={lead}
                            onUpdateLead={handleLeadUpdateWithLogging}
                            readOnly={isSdr}
                          />
                        </TabsContent>
                      )}
                      <TabsContent value="insights" className="m-0 px-4 py-4">
                        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                          Insights
                        </h3>
                        <InsightsSection lead={lead} onUpdateLead={handleLeadUpdateWithLogging} />
                      </TabsContent>
                    </ScrollArea>
                  </Tabs>
                </ResizablePanel>
              </ResizablePanelGroup>

              {/* Mobile: unified tabs layout */}
              <div className="flex-1 min-h-0 flex flex-col md:hidden">
                <Tabs value={closerActiveTab} onValueChange={setCloserActiveTab} className="flex flex-col flex-1 min-h-0">
                  <div className="flex-shrink-0 px-2 pt-1.5 border-b border-border">
                    <div className="overflow-x-auto">
                      <TabsList className="h-auto w-max min-w-full bg-transparent gap-0 p-0 flex items-end">
                        {([
                          ['negociacao', 'Negociação'],
                          ['historico', 'Histórico'],
                          ['propostas', 'Propostas'],
                          ['empresa', 'Empresa'],
                          ['qualificacao', 'Qualif.'],
                        ] as const).map(([val, label]) => (
                          <TabsTrigger
                            key={val}
                            value={val}
                            className="shrink-0 px-3 rounded-none border-b-2 border-transparent bg-transparent py-1.5 text-xs font-medium text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground/70"
                          >
                            {label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 flex flex-col">
                    <TabsContent
                      value="historico"
                      className="m-0 flex-1 min-h-0 flex flex-col"
                      forceMount
                      style={{ display: closerActiveTab === "historico" ? "flex" : "none" }}
                    >
                      <LeadActivityTimeline
                        leadId={lead.id}
                        canEdit={true}
                        opportunityId={opportunity?.id}
                        leadData={{
                          email: lead.email,
                          name: lead.name,
                          company: lead.company,
                          phone: lead.phone,
                          razao_social: lead.razao_social,
                          nome_fantasia: lead.nome_fantasia,
                        }}
                      />
                    </TabsContent>
                    {closerActiveTab !== "historico" && (
                      <ScrollArea className="flex-1">
                        <TabsContent
                          value="negociacao"
                          className={cn("m-0", readOnly && "pointer-events-none opacity-60")}
                        >
                          <CloserStrategicPanel
                            lead={lead}
                            opportunity={opportunity!}
                            onCloserStageChange={handleCloserStageChange}
                            onReturnToSdr={handleCloserReturn}
                            onUpdateLead={handleLeadUpdateWithLogging}
                            onOpportunityFieldChange={() => onOpportunityStageChange?.()}
                            onSendEmail={() => setEmailDialogOpen(true)}
                            onNavigateToHistory={() => setCloserActiveTab("historico")}
                          />
                        </TabsContent>
                        {opportunity && (
                          <TabsContent value="propostas" className="m-0 px-4 py-4">
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                              Propostas Comerciais
                            </h3>
                            <OpportunityProposalsSection
                              opportunityId={opportunity.id}
                              lead={lead}
                              opportunity={opportunity}
                            />
                          </TabsContent>
                        )}
                        <TabsContent value="empresa" className="m-0 px-4 py-4">
                          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            Dados da Empresa
                          </h3>
                          <CompanyDataSection lead={lead} onUpdateLead={handleLeadUpdateWithLogging} />
                        </TabsContent>
                        <TabsContent value="qualificacao" className="m-0 px-4 py-4">
                          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            Qualificação
                          </h3>
                          <CompanyInfoSection
                            lead={lead}
                            onUpdateLead={handleLeadUpdateWithLogging}
                            readOnly={!(opportunity?.created_by_user_id === currentUserId)}
                          />
                        </TabsContent>
                        {showSqoTab && (
                          <TabsContent value="sqo" className="m-0 px-4 py-4">
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                              Validação SQO
                            </h3>
                            <SQOValidationSection
                              lead={lead}
                              onUpdateLead={handleLeadUpdateWithLogging}
                              readOnly={isSdr}
                            />
                          </TabsContent>
                        )}
                        <TabsContent value="insights" className="m-0 px-4 py-4">
                          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            Insights
                          </h3>
                          <InsightsSection lead={lead} onUpdateLead={handleLeadUpdateWithLogging} />
                        </TabsContent>
                      </ScrollArea>
                    )}
                  </div>
                </Tabs>
              </div>
            </>
          )}

          {/* Footer with Save Indicator - only show when saving or recently saved */}
          {(isSaving || lastSavedAt) && (
            <div className="absolute bottom-3 left-3 z-10">
              <SaveIndicator isSaving={isSaving} lastSavedAt={lastSavedAt} />
            </div>
          )}

          {/* Register Outcome Panel (SDR) */}
          <RegisterOutcomePanel
            open={registerOutcomePanelOpen}
            onOpenChange={setRegisterOutcomePanelOpen}
            lead={lead}
            onSubmit={async (data) => {
              // Guard against double submission
              if (outcomeSubmittingRef.current) return;
              outcomeSubmittingRef.current = true;
              try {
                const userInfo = getUserInfo();
                const now = new Date();

                // Map result to interaction outcome
                const outcomeMap: Record<string, string> = {
                  conectou: "respondeu",
                  nao_atendeu: "sem_resposta",
                  interesse: "qualificado",
                  sem_interesse: "descartado",
                  reagendado: "reagendado",
                };

                // Create interaction record
                try {
                  await createInteraction({
                    lead_id: lead.id,
                    user_id: userInfo.id,
                    channel: (data.contactType === "meeting" ? "other" : data.contactType) as any,
                    direction: "outbound",
                    outcome: (outcomeMap[data.result] || "respondeu") as any,
                    message_summary: data.observation || null,
                    occurred_at: now,
                  });
                } catch (err) {
                  console.error("Error creating interaction:", err);
                }

                // Update next_action_at if provided
                const updates: Partial<Lead> = {
                  last_contact_at: now,
                  attempts_count: lead.attempts_count + 1,
                };
                if (data.nextActionDate) {
                  const [y, m, d] = data.nextActionDate.split("-").map(Number);
                  const [hh, mm] = data.nextActionTime.split(":").map(Number);
                  const nextAction = new Date(y, m - 1, d, hh, mm);
                  updates.next_action_at = nextAction;
                }

                // Auto status updates based on result
                const currentFunnelIndex = FUNNEL_ORDER.indexOf(lead.status as any);

                const setStatusIfNotRegression = (newStatus: LeadStatus) => {
                  const newIndex = FUNNEL_ORDER.indexOf(newStatus as any);
                  if (newIndex >= currentFunnelIndex || currentFunnelIndex === -1) {
                    updates.status = newStatus;
                  }
                };

                if (data.result === "nao_atendeu") updates.status = "Em contato" as LeadStatus;
                else if (data.result === "reagendado") updates.status = "Agendar retorno" as LeadStatus;
                else if (data.result === "interesse") updates.status = "Interesse" as LeadStatus;
                else if (data.result === "sem_interesse") updates.status = "Descartado" as LeadStatus;
                else if (data.result === "conectou") setStatusIfNotRegression("Em contato" as LeadStatus);

                // Auto-advance cadence step on progress results
                const advanceResults = ["conectou", "interesse", "reagendado"];
                if (lead.cadence_id && lead.current_cadence_step && advanceResults.includes(data.result)) {
                  const nextStep = (lead.current_cadence_step ?? 0) + 1;
                  updates.current_cadence_step = nextStep;
                  // Also update lead_cadences table
                  try {
                    await supabase
                      .from("lead_cadences")
                      .update({
                        current_step_number: nextStep,
                        next_step_at: data.nextActionDate
                          ? new Date(`${data.nextActionDate}T${data.nextActionTime}`).toISOString()
                          : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                      })
                      .eq("lead_id", lead.id);
                  } catch (err) {
                    console.error("Error advancing cadence step:", err);
                  }
                }

                onUpdateLead({ ...lead, ...updates } as Lead);

                // Add note if observation provided
                if (data.observation) {
                  try {
                    await createNoteMutation.mutateAsync({
                      lead_id: lead.id,
                      user_id: userInfo.id,
                      note: `[${data.contactType}] (${userInfo.name}) ${data.observation}`,
                    });
                  } catch (err) {
                    console.error("Error saving note:", err);
                  }
                }

                await logActivity({
                  lead_id: lead.id,
                  action_type: "interaction_registered",
                  description: `registrou resultado: ${data.result} via ${data.contactType}`,
                });

                toast.success("Resultado registrado com sucesso!");
              } finally {
                outcomeSubmittingRef.current = false;
              }
            }}
          />

          {/* Dialogs */}
          <LostReasonDialog
            open={discardDialogOpen}
            onOpenChange={setDiscardDialogOpen}
            onConfirm={handleConfirmDiscard}
          />
          <CloserLostReasonDialog
            open={closerLostDialogOpen}
            onOpenChange={setCloserLostDialogOpen}
            onConfirm={async (reason: CloserLostReason) => {
              if (!opportunity) return;
              await markOpportunityLost(opportunity.id, reason.label, reason.responsibility, reason.sqoImpact);
              onOpportunityStageChange?.();
              toast.info("Oportunidade marcada como perdida");
            }}
          />

          {/* Return to SDR Dialog */}
          <Dialog open={closerReturnDialogOpen} onOpenChange={setCloserReturnDialogOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Devolver Lead ao SDR</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Label>Motivo da devolução *</Label>
                <div className="space-y-2">
                  {["Cliente não entrou na reunião", "Cliente entrou mas decidiu remarcar", "Outro"].map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setCloserReturnReason(option === "Outro" ? "" : option);
                        setCloserReturnSelected(option);
                      }}
                      className={cn(
                        "w-full text-left text-sm py-2.5 px-3 rounded-md border transition-all",
                        closerReturnSelected === option
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card border-border hover:border-primary/50 hover:bg-muted/50",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {closerReturnSelected === "Outro" && (
                  <Textarea
                    value={closerReturnReason}
                    onChange={(e) => setCloserReturnReason(e.target.value)}
                    placeholder="Descreva o motivo..."
                    className="min-h-[80px]"
                    autoFocus
                  />
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCloserReturnDialogOpen(false);
                    setCloserReturnSelected("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  disabled={!closerReturnSelected || (closerReturnSelected === "Outro" && !closerReturnReason.trim())}
                  onClick={async () => {
                    if (!opportunity) return;
                    const reason = closerReturnSelected === "Outro" ? closerReturnReason : closerReturnSelected;
                    await returnLeadToSdr(opportunity.id, reason);
                    onOpportunityStageChange?.();
                    setCloserReturnDialogOpen(false);
                    setCloserReturnSelected("");
                    toast.info("Lead devolvido ao SDR");
                  }}
                >
                  Confirmar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <MeetingConfirmationDialog
            open={meetingDialogOpen}
            onOpenChange={setMeetingDialogOpen}
            onConfirm={handleConfirmMeeting}
            companyName={lead.razao_social || lead.nome_fantasia || lead.company}
            contactEmail={lead.email || undefined}
          />
          <MeetingConfirmedDialog
            open={confirmedDialogOpen}
            onOpenChange={setConfirmedDialogOpen}
            onConfirm={handleConfirmPresence}
            companyName={lead.razao_social || lead.nome_fantasia || lead.company}
          />
          <ObservationDialog
            open={observationDialogOpen}
            onOpenChange={setObservationDialogOpen}
            onConfirm={handleStatusChangeWithObservation}
            statusName="Em contato"
          />
          <ScheduleReturnDialog
            open={scheduleReturnDialogOpen}
            onOpenChange={setScheduleReturnDialogOpen}
            onConfirm={handleScheduleReturn}
          />
          {canDelete && (
            <DeleteLeadDialog
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              leadCount={1}
              leadName={mode === "closer" ? lead.razao_social || lead.company : lead.name}
              onConfirm={handleDeleteLead}
              isDeleting={deleteLeadMutation.isPending}
              entityLabel={mode === "closer" ? "Oportunidade" : "Lead"}
            />
          )}

          {/* Enrich Lead Dialog */}
          <Dialog open={enrichDialog} onOpenChange={setEnrichDialog}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Enriquecer dados do lead</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Selecione quais tipos de dados deseja buscar para enriquecer o cadastro do lead.
                </p>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-muted hover:bg-muted/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={enrichOptions.brasilapi}
                      onChange={(e) => setEnrichOptions({ ...enrichOptions, brasilapi: e.target.checked })}
                      className="rounded border-muted-foreground"
                    />

                    <div className="flex-1">
                      <p className="text-sm font-medium">BrasilAPI (Cadastral)</p>
                      <p className="text-xs text-muted-foreground">Razão Social, endereço, CNAE, porte da empresa</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg border border-muted hover:bg-muted/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={enrichOptions.perplexity}
                      onChange={(e) => setEnrichOptions({ ...enrichOptions, perplexity: e.target.checked })}
                      className="rounded border-muted-foreground"
                    />

                    <div className="flex-1">
                      <p className="text-sm font-medium">Perplexity (IA)</p>
                      <p className="text-xs text-muted-foreground">
                        Segmento, website, telefone, WhatsApp, e-mail, faturamento
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEnrichDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleEnrichLead}
                  disabled={enrichLeadMutation.isPending || (!enrichOptions.brasilapi && !enrichOptions.perplexity)}
                >
                  {enrichLeadMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Enriquecendo...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Enriquecer
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>

      {/* Email Compose Dialog - OUTSIDE parent Dialog to avoid nesting conflicts */}
      <EmailComposeDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        lead={lead}
        userName={currentUserName}
        sdrName={opportunity?.sdr_name || ""}
        closerName={opportunity?.closer_name || ""}
      />

      {/* Send to Closer Dialog */}
      <SendToCloserDialog
        open={sendToCloserOpen}
        onOpenChange={setSendToCloserOpen}
        leadId={lead.id}
        leadName={lead.name}
        onSuccess={() => {
          onUpdateLead({ ...lead, status: "Oportunidade criada" as any });
          modalQueryClient.invalidateQueries({ queryKey: ["leads"] });
          modalQueryClient.invalidateQueries({ queryKey: ["opportunities"] });
        }}
      />

      {/* Enroll in Email Sequence Dialog */}
      <EnrollLeadDialog
        open={enrollSequenceOpen}
        onOpenChange={setEnrollSequenceOpen}
        leadId={lead.id}
        leadName={lead.name}
      />
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
