import { useState, useRef, useEffect } from 'react';
import { Lead } from '@/types/lead';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription 
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeadTypeBadge, LeadStatusBadge } from './LeadBadge';
import { NoteDisplay } from './NoteDisplay';
import { LostReasonDialog, DiscardReason } from './LostReasonDialog';
import { MeetingConfirmationDialog, MeetingData } from './MeetingConfirmationDialog';
import { MeetingConfirmedDialog } from './MeetingConfirmedDialog';
import { ObservationDialog } from './ObservationDialog';
import { ScheduleReturnDialog, ScheduleReturnData } from './ScheduleReturnDialog';
import { CompanyInfoSection, isCompanyInfoComplete, getMissingQualificationFields } from './CompanyInfoSection';
import { SQOValidationSection } from './SQOValidationSection';
import { CompanyDataSection, getMissingCompanyDataFields } from './CompanyDataSection';

import { DeleteLeadDialog } from './DeleteLeadDialog';
import { ActivityLogSection } from './ActivityLogSection';
import { ContactCompanySection } from './ContactCompanySection';
import { LeadActivityTimeline } from './LeadActivityTimeline';
import { useLeadInteractions, useCreateNote, useDeleteLead } from '@/hooks/useLeads';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useLogLeadActivity } from '@/hooks/useActivityLogs';
import { ScrollIndicator } from './ScrollIndicator';
import { SaveIndicator } from './SaveIndicator';
import { 
  isLeadOverdue, 
  getInboundSLA, 
  formatTimeAgo 
} from '@/utils/priorityCalculator';
import { useCadenceStep } from '@/hooks/useLeads';
import { toast } from 'sonner';
import { 
  getStatusLabel,
  getTemperatureLabel,
  getFieldChangeDescription 
} from '@/services/activityLogService';
import { 
  User, 
  Building2, 
  Mail, 
  Phone, 
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  RotateCcw,
  FileText,
  Target,
  Calendar,
  Send,
  MessageSquare,
  CalendarClock,
  Trash2,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeadStatus, InteractionOutcome } from '@/types/lead';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { supabase } from '@/integrations/supabase/client';
import { removeOpportunityByLeadId } from '@/services/closerService';
import { SendToCloserDialog } from './SendToCloserDialog';
import { useUserRole } from '@/hooks/useUserRole';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';

interface LeadDrawerProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onUpdateLead: (lead: Lead) => void;
}

export const LeadDrawer = ({ lead, open, onClose, onUpdateLead }: LeadDrawerProps) => {
  const [note, setNote] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState<InteractionOutcome>('sem_resposta');
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [confirmedDialogOpen, setConfirmedDialogOpen] = useState(false);
  const [observationDialogOpen, setObservationDialogOpen] = useState(false);
  const [scheduleReturnDialogOpen, setScheduleReturnDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sendToCloserOpen, setSendToCloserOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const savingDelayRef = useRef<NodeJS.Timeout>();

  // Hooks must be called before any conditional returns
  const { data: interactions = [] } = useLeadInteractions(lead?.id ?? null);
  const createNoteMutation = useCreateNote();
  const deleteLeadMutation = useDeleteLead();
  const { isAdmin: isAdminLegacy } = useAdminUsers();
  const { logActivity } = useLogLeadActivity();
  const { isSdr, isAdmin, isManager } = useUserRole();
  const { isConnected: isCalendarConnected, createEvent: createCalendarEvent } = useGoogleCalendar();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  // Fields to track for logging
  const trackedFields = ['name', 'company', 'phone', 'whatsapp', 'phone_2', 'email', 'source', 'cnpj', 'razao_social', 'nome_fantasia', 'company_segment', 'employee_count', 'revenue_range', 'website', 'city', 'state', 'cep', 'product_interest', 'daily_service_volume', 'main_pain_point', 'solution_urgency', 'has_budget'] as const;

  // Enhanced update handler with automatic field change logging
  const handleLeadUpdateWithLogging = (updatedLead: Lead) => {
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
      for (const field of trackedFields) {
        const oldValue = lead[field as keyof Lead];
        const newValue = updatedLead[field as keyof Lead];

        if (oldValue !== newValue && oldValue !== null && oldValue !== undefined && oldValue !== '') {
          const oldStr = String(oldValue);
          const newStr = String(newValue || '');

          if (oldStr !== newStr) {
            await logActivity({
              lead_id: lead.id,
              action_type: 'field_updated',
              field_name: field,
              old_value: oldStr,
              new_value: newStr,
              description: getFieldChangeDescription(field, oldStr, newStr),
            });
          }
        }
      }
    })();
  };

  // Cleanup timeout on unmount
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

  // Wrapper for onUpdateLead that shows saving indicator
  const handleLeadUpdate = (updatedLead: Lead) => {
    // Apply update immediately so controlled inputs remain responsive
    onUpdateLead(updatedLead);

    setIsSaving(true);

    // Reset timers so "Salvando..." stays visible while typing
    if (savingDelayRef.current) {
      clearTimeout(savingDelayRef.current);
    }
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    savingDelayRef.current = setTimeout(() => {
      setLastSavedAt(new Date());
      setIsSaving(false);

      // Clear "Salvo" indicator after 2 seconds
      saveTimeoutRef.current = setTimeout(() => {
        setLastSavedAt(null);
      }, 2000);
    }, 200);
  };

  if (!lead) return null;

  const isInbound = lead.lead_type === 'INBOUND';
  const isOverdue = isLeadOverdue(lead);
  const sla = isInbound ? getInboundSLA(lead) : null;
  const { data: cadenceStep } = useCadenceStep(
    !isInbound ? lead.cadence_id ?? null : null,
    !isInbound ? lead.current_cadence_step ?? null : null
  );

  // Helper to get current user info
  const getUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { id: null, name: 'Anônimo' };
    
    // Try to get name from user metadata
    const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Usuário';
    return { id: user.id, name };
  };

  // Helper to increment attempts
  const incrementAttempts = () => {
    const now = new Date();
    onUpdateLead({
      ...lead,
      attempts_count: lead.attempts_count + 1,
      last_contact_at: now
    });
  };

  // Handler for quick action attempts (WhatsApp, Call, Email)
  const handleQuickActionAttempt = () => {
    incrementAttempts();
  };

  const handleStatusChange = async (newStatus: LeadStatus) => {
    const now = new Date();
    const oldStatus = lead.status;
    
    const updates: Partial<Lead> = { status: newStatus, last_contact_at: now };
    
    onUpdateLead({ ...lead, ...updates } as Lead);
    
    // Log activity
    await logActivity({
      lead_id: lead.id,
      action_type: 'status_changed',
      field_name: 'status',
      old_value: oldStatus,
      new_value: newStatus,
      description: `alterou o status de ${getStatusLabel(oldStatus)} para ${getStatusLabel(newStatus)}`,
    });
    
    toast.success(`Status atualizado para ${newStatus}`);
  };

  const handleStatusChangeWithObservation = async (observation: string, nextActionAt?: Date) => {
    const now = new Date();
    const userInfo = await getUserInfo();
    const oldStatus = lead.status;
    
    // Update lead with new status, last_contact_at, and increment attempts
    onUpdateLead({ 
      ...lead, 
      status: 'Em contato',
      last_contact_at: now,
      attempts_count: lead.attempts_count + 1,
      next_action_at: nextActionAt || now,
    });
    
    // Log activity
    await logActivity({
      lead_id: lead.id,
      action_type: 'status_changed',
      field_name: 'status',
      old_value: oldStatus,
      new_value: 'Em contato',
      description: `alterou o status de ${getStatusLabel(oldStatus)} para ${getStatusLabel('Em contato')}`,
    });
    
    // Always save a note when changing status
    const noteText = observation 
      ? `[Follow-up em andamento] (${userInfo.name}) ${observation}`
      : `[Follow-up em andamento] (${userInfo.name}) Status atualizado`;
    
    try {
      await createNoteMutation.mutateAsync({
        lead_id: lead.id,
        user_id: userInfo.id,
        note: noteText,
      });
      
      // Log note activity
      await logActivity({
        lead_id: lead.id,
        action_type: 'note_added',
        description: `adicionou uma observação`,
      });
      
      toast.success(`Status atualizado para Follow-up em andamento`);
    } catch (error) {
      console.error('Error saving note:', error);
      toast.success(`Status atualizado para Follow-up em andamento`);
      toast.error('Erro ao salvar observação');
    }
  };

  const handleRegisterInteraction = () => {
    // In a real app, this would save to the database
    toast.success('Interação registrada com sucesso');
    setNote('');
  };


  const handleOpenMeetingDialog = () => {
    setMeetingDialogOpen(true);
  };

  const handleConfirmMeeting = async (meetingData: MeetingData) => {
    const now = new Date();
    const userInfo = await getUserInfo();
    const oldStatus = lead.status;
    
    // Combine date and time
    const [hours, minutes] = meetingData.meetingTime.split(':').map(Number);
    const meetingDatetime = new Date(meetingData.meetingDate);
    meetingDatetime.setHours(hours, minutes, 0, 0);
    
    // Update lead with status and increment attempts
    // Set next_action_at to 1 hour before the meeting
    const nextActionAt = new Date(meetingDatetime.getTime() - 60 * 60 * 1000);
    onUpdateLead({ 
      ...lead, 
      status: 'Reunião Agendada' as LeadStatus,
      last_contact_at: now,
      next_action_at: nextActionAt,
      attempts_count: lead.attempts_count + 1
    });
    
    // Save meeting to database for reminder
    let meetingRecordId: string | undefined;
    try {
      const { data: meetingRow } = await supabase.from('meetings').insert({
        lead_id: lead.id,
        user_id: lead.owner_user_id || userInfo.id,
        title: meetingData.meetingTitle,
        executive_name: meetingData.executiveName,
        meeting_datetime: meetingDatetime.toISOString(),
        reminder_minutes_before: meetingData.reminderMinutesBefore,
      }).select('id').single();
      meetingRecordId = meetingRow?.id;
    } catch (error) {
      console.error('Error saving meeting:', error);
    }
    
    // Save note with meeting info
    const formattedDate = meetingDatetime.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    });
    const formattedTime = meetingDatetime.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
    
    try {
      await createNoteMutation.mutateAsync({
        lead_id: lead.id,
        user_id: userInfo.id,
        note: `[Reunião Agendada] (${userInfo.name}) ${meetingData.meetingTitle} - Executivo: ${meetingData.executiveName} - Data: ${formattedDate} às ${formattedTime}`,
      });
    } catch (error) {
      console.error('Error saving note:', error);
    }
    
    // Log activity
    await logActivity({
      lead_id: lead.id,
      action_type: 'meeting_scheduled',
      description: `agendou reunião "${meetingData.meetingTitle}" com ${meetingData.executiveName} para ${formattedDate} às ${formattedTime}`,
    });
    
    await logActivity({
      lead_id: lead.id,
      action_type: 'status_changed',
      field_name: 'status',
      old_value: oldStatus,
      new_value: 'Reunião agendada',
      description: `alterou o status de ${getStatusLabel(oldStatus)} para ${getStatusLabel('Reunião agendada')}`,
    });
    
    toast.success(`Reunião agendada para ${formattedDate} às ${formattedTime}!`);

    // Google Calendar event + email (non-blocking)
    const meetingEndDatetime = new Date(meetingDatetime.getTime() + 60 * 60 * 1000);
    const attendees = (meetingData.inviteEmails || []).map(email => ({ email }));

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
        meetLink = calResult?.hangoutLink || calResult?.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri;
        // Persist meet_link to meetings table
        if (meetLink && meetingRecordId) {
          await supabase.from('meetings').update({ meet_link: meetLink } as any).eq('id', meetingRecordId);
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
        console.error('Email invite error:', err);
        toast.warning('Reunião salva, mas o e-mail de convite não foi enviado.');
      }
    }
  };

  const handleOpenConfirmedDialog = () => {
    setConfirmedDialogOpen(true);
  };

  const handleConfirmPresence = async () => {
    const now = new Date();
    const userInfo = await getUserInfo();
    const oldStatus = lead.status;
    
    // Update lead with status and increment attempts
    onUpdateLead({ 
      ...lead, 
      status: 'Oportunidade criada',
      last_contact_at: now,
      attempts_count: lead.attempts_count + 1
    });
    
    // Save note
    try {
      await createNoteMutation.mutateAsync({
        lead_id: lead.id,
        user_id: userInfo.id,
        note: `[Reunião Realizada] (${userInfo.name}) Reunião realizada. Oportunidade criada.`,
      });
    } catch (error) {
      console.error('Error saving note:', error);
    }
    
    // Log activity
    await logActivity({
      lead_id: lead.id,
      action_type: 'opportunity_created',
      description: `confirmou presença na reunião e criou oportunidade`,
    });
    
    await logActivity({
      lead_id: lead.id,
      action_type: 'status_changed',
      field_name: 'status',
      old_value: oldStatus,
      new_value: 'Oportunidade criada',
      description: `alterou o status de ${getStatusLabel(oldStatus)} para ${getStatusLabel('Oportunidade criada')}`,
    });
    
    toast.success('Reunião realizada! Oportunidade criada no pipeline.');
  };

  const handleOpenDiscardDialog = () => {
    setDiscardDialogOpen(true);
  };

  const handleConfirmDiscard = async (reason: DiscardReason) => {
    const now = new Date();
    const userInfo = await getUserInfo();
    const oldStatus = lead.status;
    
    // Update lead with status and increment attempts
    onUpdateLead({ 
      ...lead, 
      status: 'Descartado',
      last_contact_at: now,
      next_action_at: new Date('2099-12-31T23:59:59Z'),
      attempts_count: lead.attempts_count + 1
    });
    
    // Save note with discard reason
    try {
      await createNoteMutation.mutateAsync({
        lead_id: lead.id,
        user_id: userInfo.id,
        note: `[Perdido] (${userInfo.name}) Motivo: ${reason.status} - ${reason.description}`,
      });
    } catch (error) {
      console.error('Error saving note:', error);
    }
    
    // Log activity
    await logActivity({
      lead_id: lead.id,
      action_type: 'status_changed',
      field_name: 'status',
      old_value: oldStatus,
      new_value: 'Descartado',
      description: `marcou o lead como perdido. Motivo: ${reason.status} - ${reason.description}`,
    });
    
    toast.info(`Lead perdido: ${reason.status}`);
    onClose(); // Close the drawer after discard
  };

  const handleRestoreLead = async () => {
    const now = new Date();
    const userInfo = await getUserInfo();
    const oldStatus = lead.status;
    
    // Update lead status back to 'Novo'
    onUpdateLead({ 
      ...lead, 
      status: 'Novo',
      last_contact_at: now,
      next_action_at: now
    });
    
    // Save note about restoration
    try {
      await createNoteMutation.mutateAsync({
        lead_id: lead.id,
        user_id: userInfo.id,
        note: `[Restaurado] (${userInfo.name}) Lead restaurado para status 'Novo'`,
      });
    } catch (error) {
      console.error('Error saving note:', error);
    }
    
    // Log activity
    await logActivity({
      lead_id: lead.id,
      action_type: 'status_changed',
      field_name: 'status',
      old_value: oldStatus,
      new_value: 'Novo',
      description: `restaurou o lead para status ${getStatusLabel('Novo')}`,
    });
    
    toast.success('Lead restaurado com sucesso!');
  };

  const handleScheduleReturn = async (data: ScheduleReturnData) => {
    // Combine date and time
    const [hours, minutes] = data.time.split(':').map(Number);
    const scheduledDate = new Date(data.date);
    scheduledDate.setHours(hours, minutes, 0, 0);
    
    const now = new Date();
    const userInfo = await getUserInfo();
    const oldStatus = lead.status;
    
    // Update lead with new status, next_action_at, last_contact_at, and increment attempts
    onUpdateLead({ 
      ...lead, 
      status: 'Agendar Retorno' as LeadStatus,
      next_action_at: scheduledDate,
      last_contact_at: now,
      attempts_count: lead.attempts_count + 1
    });
    
    const formattedDate = scheduledDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
    
    // Save observation
    try {
      await createNoteMutation.mutateAsync({
        lead_id: lead.id,
        user_id: userInfo.id,
        note: `[Retorno agendado para ${formattedDate}] (${userInfo.name}) ${data.observation || 'Sem observação'}`,
      });
    } catch (error) {
      console.error('Error saving note:', error);
    }
    
    // Log activity
    await logActivity({
      lead_id: lead.id,
      action_type: 'status_changed',
      field_name: 'status',
      old_value: oldStatus,
      new_value: 'Agendar Retorno',
      description: `agendou retorno para ${formattedDate}`,
    });
    
    toast.success(`Retorno agendado para ${formattedDate}`);
  };

  const handleDeleteLead = async () => {
    try {
      await deleteLeadMutation.mutateAsync(lead.id);
      toast.success('Lead excluído permanentemente');
      setDeleteDialogOpen(false);
      onClose();
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast.error('Erro ao excluir lead. Verifique suas permissões.');
    }
  };

  const handleUndoCloser = async () => {
    try {
      await removeOpportunityByLeadId(lead.id);
      const userInfo = await getUserInfo();
      onUpdateLead({ ...lead, status: 'Em contato' as any });
      await createNoteMutation.mutateAsync({
        lead_id: lead.id,
        user_id: userInfo.id,
        note: `[Desfeito] (${userInfo.name}) Envio ao Closer desfeito. Lead retornou para o SDR.`,
      });
      toast.success('Envio ao Closer desfeito. Lead retornou para o SDR.');
    } catch (error) {
      console.error('Error undoing closer:', error);
      toast.error('Erro ao desfazer envio ao Closer');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg md:max-w-xl flex flex-col overflow-hidden bg-card">
        <SheetHeader className="space-y-1 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 flex-1">
                <div>
                  <div className="flex items-center gap-2">
                    <LeadTypeBadge type={lead.lead_type} />
                    {isOverdue && (
                      <Badge className="gap-1 bg-destructive/15 text-destructive border-0 hover:bg-destructive/20">
                        <AlertCircle className="h-3 w-3" />
                        Atrasado
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lead.status === 'Descartado' && (
                <Button
                  onClick={handleRestoreLead}
                  variant="outline"
                  size="sm"
                  className="gap-1 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restaurar
                </Button>
              )}
              {isAdmin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => setDeleteDialogOpen(true)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Excluir lead permanentemente</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          <SheetTitle className="sr-only">Detalhes do Lead</SheetTitle>
        </SheetHeader>

        <div className="relative flex-1 min-h-0 mt-4">
          <ScrollArea ref={scrollAreaRef} className="h-full">
            <div className="pr-4">
              {/* OUTBOUND Specific Section */}
              {!isInbound && (
                <>
                  {/* Cadence Info */}
                  {cadenceStep && (
                    <div className="mb-6 bg-muted/30 rounded-lg p-4 border">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Cadência - Etapa {lead.current_cadence_step}
                        </h3>
                        <Badge variant="outline" className="gap-1">
                          {cadenceStep.channel === 'whatsapp' && <WhatsAppIcon className="h-3 w-3" size={12} />}
                          {cadenceStep.channel === 'call' && <Phone className="h-3 w-3" />}
                          {cadenceStep.channel === 'email' && <Mail className="h-3 w-3" />}
                          {cadenceStep.channel}
                        </Badge>
                      </div>
                      <div className="mb-3">
                        <p className="text-xs text-muted-foreground mb-1">Objetivo:</p>
                        <p className="text-sm font-medium">{cadenceStep.objective}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Script:</p>
                        <div className="bg-card rounded-md p-3 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto border">
                          {cadenceStep.script_template}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* History */}
              {interactions.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-3">Histórico de Interações</h3>
                  <div className="space-y-2">
                    {interactions.map((interaction) => (
                      <div
                        key={interaction.id}
                        className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg text-sm"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {interaction.channel === 'whatsapp' && (
                            <WhatsAppIcon className="h-4 w-4 text-chart-3" size={16} />
                          )}
                          {interaction.channel === 'call' && (
                            <Phone className="h-4 w-4 text-chart-1" />
                          )}
                          {interaction.channel === 'email' && (
                            <Mail className="h-4 w-4 text-chart-2" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground">{interaction.message_summary}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTimeAgo(new Date(interaction.occurred_at))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

               {/* Company Data Section */}
              <CompanyDataSection lead={lead} onUpdateLead={handleLeadUpdateWithLogging} />

              <Separator className="my-4" />

              {/* Status Change */}
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
                    <Target className="h-3.5 w-3.5 text-primary" />
                  </div>
                  Status Atual
                </h3>
                {/* Status Buttons - First Row: Novo, Interesse/Agendar Retorno */}
                <div className="flex flex-wrap gap-1.5">
                {(['Novo', 'Interesse/Agendar Retorno'] as const).map((status) => {
                    const isSelected = lead.status === status;
                    
                    const tooltips: Record<string, string> = {
                      'Novo': 'Sem tentativa de contato.',
                      'Interesse/Agendar Retorno': 'Conversando com o cliente ou definir data/hora para retornar contato.',
                    };

                    const handleClick = () => {
                      if (status === 'Interesse/Agendar Retorno') {
                        setScheduleReturnDialogOpen(true);
                      } else {
                        handleStatusChange(status as LeadStatus);
                      }
                    };

                    const button = (
                      <Button
                        key={status}
                        variant="outline"
                        size="sm"
                        onClick={handleClick}
                        className={cn(
                          'transition-all h-7 px-2 text-xs',
                          isSelected 
                            ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground' 
                            : 'bg-muted/50 text-foreground border-border hover:bg-muted hover:text-foreground'
                        )}
                      >
                        {status}
                      </Button>
                    );

                    return (
                      <Tooltip key={status}>
                        <TooltipTrigger asChild>
                          {button}
                        </TooltipTrigger>
                        <TooltipContent className="bg-popover text-popover-foreground border max-w-[250px]">
                          <p>{tooltips[status]}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>

                {/* Second Row: Follow-up em andamento, Reciclagem */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setObservationDialogOpen(true)}
                        className={cn(
                          'transition-all h-7 px-2 text-xs',
                          lead.status === 'Em contato'
                            ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground' 
                            : 'bg-muted/50 text-foreground border-border hover:bg-muted hover:text-foreground'
                        )}
                      >
                        Follow-up em andamento
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover text-popover-foreground border max-w-[250px]">
                      <p>Tentativas estruturadas de retomada após contato ou reunião</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange('Reciclagem' as LeadStatus)}
                        className={cn(
                          'transition-all h-7 px-2 text-xs',
                          lead.status === ('Reciclagem' as any)
                            ? 'bg-[hsl(35,90%,50%)] text-white border-[hsl(35,90%,50%)] hover:bg-[hsl(35,90%,40%)] hover:text-white' 
                            : 'bg-muted/50 text-foreground border-border hover:bg-[hsl(35,90%,50%)] hover:text-white hover:border-[hsl(35,90%,50%)]'
                        )}
                      >
                        Reciclagem
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover text-popover-foreground border max-w-[250px]">
                      <p>Lead marcado para recontato futuro. Pode ser reaproveitado em novas campanhas.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Fourth Row: Reunião Realizada + Perdido (same width) */}
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => {
                          const missingQ = getMissingQualificationFields(lead);
                          const missingC = getMissingCompanyDataFields(lead);
                          if (missingQ.length > 0) {
                            toast.error(`Qualificação incompleta. Campos faltantes: ${missingQ.join(', ')}`);
                            return;
                          }
                          if (missingC.length > 0) {
                            toast.error(`Dados da Empresa incompletos. Campos faltantes: ${missingC.join(', ')}`);
                            return;
                          }
                          handleOpenConfirmedDialog();
                        }}
                        variant="outline"
                        size="sm"
                        className={cn(
                          'transition-all h-7 px-2 text-xs w-full',
                          lead.status === 'Oportunidade criada'
                            ? 'bg-[hsl(160,84%,39%)] text-white border-[hsl(160,84%,39%)] hover:bg-[hsl(160,84%,32%)] hover:text-white'
                            : 'bg-muted/50 text-foreground border-border hover:bg-[hsl(160,84%,39%)] hover:text-white hover:border-[hsl(160,84%,39%)]'
                        )}
                        disabled={lead.status === 'Oportunidade criada'}
                      >
                        Reunião Realizada
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover text-popover-foreground border max-w-[250px]">
                      <p>{(!isCompanyInfoComplete(lead) || getMissingCompanyDataFields(lead).length > 0)
                        ? `Campos pendentes: ${[...getMissingQualificationFields(lead), ...getMissingCompanyDataFields(lead)].join(', ') || 'Nenhum'}` 
                        : 'Confirmar presença do cliente na reunião e enviar para executivo.'}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    onClick={handleOpenDiscardDialog}
                    variant="outline"
                    size="sm"
                    className={cn(
                      'transition-all h-7 px-2 text-xs w-full',
                      lead.status === 'Descartado'
                        ? 'bg-[hsl(0,84%,60%)] text-white border-[hsl(0,84%,60%)] hover:bg-[hsl(0,84%,50%)] hover:text-white'
                        : 'bg-muted/50 text-foreground border-border hover:bg-[hsl(0,84%,60%)] hover:text-white hover:border-[hsl(0,84%,60%)]'
                    )}
                    disabled={lead.status === 'Descartado'}
                  >
                    Perdido
                  </Button>
                </div>
                {lead.status === 'Oportunidade criada' && (
                  <div className="flex gap-1.5 mt-1.5">
                    <Button
                      onClick={handleUndoCloser}
                      variant="outline"
                      size="sm"
                      className="transition-all h-7 px-2 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Desfazer envio ao Closer
                    </Button>
                  </div>
                )}

                {/* Send directly to Closer (Admin/Manager only) */}
                {(isAdmin || isManager) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSendToCloserOpen(true)}
                    className="mt-1.5 h-7 px-2 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Send className="h-3 w-3" />
                    Enviar para Closer
                  </Button>
                )}

                <SendToCloserDialog
                  open={sendToCloserOpen}
                  onOpenChange={setSendToCloserOpen}
                  leadId={lead.id}
                  leadName={lead.name}
                  onSuccess={() => {
                    onUpdateLead({ ...lead, status: 'Oportunidade criada' as any });
                    toast.success('Lead enviado ao Closer!');
                  }}
                />
              </div>

               {/* Temperature Section - auto-calculated, read-only */}
               {(() => {
                 const { calculateQualificationScore, scoreToTemperature } = require('@/utils/qualificationScore');
                 const score = calculateQualificationScore(lead);
                 const calcTemp = scoreToTemperature(score);
                 const bars = calcTemp === 'quente' ? 3 : calcTemp === 'morno' ? 2 : 1;
                 const labels: Record<string, string> = { frio: 'Baixo', morno: 'Médio', quente: 'Alto' };
                 const barColors: Record<string, string> = {
                   frio: 'bg-muted-foreground/40',
                   morno: 'bg-chart-4',
                   quente: 'bg-destructive',
                 };
                 const textColors: Record<string, string> = {
                   frio: 'text-muted-foreground',
                   morno: 'text-chart-4',
                   quente: 'text-destructive',
                 };
                 return (
                   <div className="mb-4">
                     <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                       <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
                         <AlertCircle className="h-3.5 w-3.5 text-primary" />
                       </div>
                       Score de Qualificação
                     </h3>
                     <div className="rounded-lg border p-3 flex items-center justify-between bg-card">
                       <span className={cn("text-sm font-medium flex items-center gap-2", textColors[calcTemp])}>
                         <span className="flex gap-0.5">
                           {[0, 1, 2].map((i) => (
                             <div key={i} className={cn("h-4 w-2 rounded-sm", i < bars ? barColors[calcTemp] : "bg-muted")} />
                           ))}
                         </span>
                         {labels[calcTemp]}
                       </span>
                       <span className={cn("text-lg font-bold", textColors[calcTemp])}>{score}</span>
                     </div>
                     <p className="text-[10px] text-muted-foreground mt-1">Calculado automaticamente</p>
                   </div>
                 );
               })()}

               {/* Qualification Info Section */}
              <CompanyInfoSection lead={lead} onUpdateLead={handleLeadUpdateWithLogging} readOnly={!isSdr} />

              {/* SQO Validation Section (Closer) */}
              <SQOValidationSection lead={lead} onUpdateLead={handleLeadUpdateWithLogging} readOnly={isSdr} />

              {/* Activity Log Section */}
              <div className="mb-4">
                <div className="border rounded-lg overflow-hidden">
                  <ActivityLogSection leadId={lead.id} />
                </div>
              </div>

              {/* Company Contact Section */}
              <ContactCompanySection lead={lead} onUpdateLead={handleLeadUpdateWithLogging} />

              {/* Unified Activity Timeline */}
              <div className="mb-4" style={{ height: '400px' }}>
                <LeadActivityTimeline
                  leadId={lead.id}
                  canEdit={lead.owner_user_id === currentUserId || isAdmin || isManager}
                  leadData={{
                    email: lead.email,
                    name: lead.name,
                    company: lead.company,
                    phone: lead.phone,
                    razao_social: lead.razao_social,
                    nome_fantasia: lead.nome_fantasia,
                  }}
                />
              </div>
            </div>
          </ScrollArea>
          <ScrollIndicator scrollContainerRef={scrollAreaRef} />
        </div>

        {/* Footer with Save Indicator */}
        <div className="flex-shrink-0 border-t pt-3 mt-2">
          <div className="flex items-center justify-center min-h-[24px]">
            <SaveIndicator isSaving={isSaving} lastSavedAt={lastSavedAt} />
          </div>
        </div>

        {/* Dialogs */}
        <LostReasonDialog
          open={discardDialogOpen}
          onOpenChange={setDiscardDialogOpen}
          onConfirm={handleConfirmDiscard}
        />

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

        {isAdmin && (
          <DeleteLeadDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            leadCount={1}
            leadName={lead.name}
            onConfirm={handleDeleteLead}
            isDeleting={deleteLeadMutation.isPending}
          />
        )}
      </SheetContent>
    </Sheet>
  );
};
