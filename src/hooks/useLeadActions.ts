import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Lead, LeadStatus } from '@/types/lead';
import { MeetingData } from '@/components/MeetingConfirmationDialog';
import { DiscardReason } from '@/components/LostReasonDialog';
import { ScheduleReturnData } from '@/components/ScheduleReturnDialog';
import { OutcomeData } from '@/components/RegisterOutcomePanel';
import { supabase } from '@/integrations/supabase/client';
import { useCreateNote, useDeleteLead } from '@/hooks/useLeads';
import { useLogLeadActivity } from '@/hooks/useActivityLogs';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useEnrichIndividualLead } from '@/hooks/useEnrichIndividualLead';
import { useUserRole } from '@/hooks/useUserRole';
import { usePermissions } from '@/hooks/usePermissions';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createOpportunityFromMeeting,
  removeOpportunityByLeadId,
  updateOpportunityStage,
  returnLeadToSdr,
  markOpportunityLost,
  markOpportunityWon,
  CloserStage,
  CloserOpportunity,
} from '@/services/closerService';
import { createInteraction } from '@/services/leadService';
import {
  findExistingActiveMeeting,
  updateExistingMeeting,
  updateExistingOpportunity,
} from '@/services/meetingService';
import {
  getStatusLabel,
  getFieldChangeDescription,
} from '@/services/activityLogService';
import { canAdvanceToMeeting } from '@/utils/qualificationScore';
import { getMissingQualificationFields } from '@/components/CompanyInfoSection';
import { getMissingCompanyDataFields } from '@/components/CompanyDataSection';

// Module-level constants
const TRACKED_FIELDS = [
  'name', 'company', 'phone', 'whatsapp', 'phone_2', 'email', 'source', 'cnpj',
  'razao_social', 'nome_fantasia', 'company_segment', 'employee_count', 'revenue_range',
  'website', 'city', 'state', 'cep', 'product_interest', 'daily_service_volume',
  'main_pain_point', 'solution_urgency', 'has_budget', 'qualification_notes',
] as const;

const FUNNEL_ORDER = [
  'Novo', 'Devolvido pelo Closer', 'Em contato', 'Ocupado', 'Agendar retorno',
  'Sem retorno', 'Interesse', 'Reagendar Reunião', 'Interesse/Agendar Retorno', 'Oportunidade criada',
] as const;

interface UseLeadActionsParams {
  lead: Lead | null;
  onUpdateLead: (lead: Lead) => void;
  onClose: () => void;
  mode?: 'sdr' | 'closer' | 'api_oficial';
  opportunity?: CloserOpportunity | null;
  onOpportunityStageChange?: () => void;
}

export function useLeadActions({
  lead,
  onUpdateLead,
  onClose,
  mode = 'sdr',
  opportunity,
  onOpportunityStageChange,
}: UseLeadActionsParams) {
  // Dialog states
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [confirmedDialogOpen, setConfirmedDialogOpen] = useState(false);
  const [observationDialogOpen, setObservationDialogOpen] = useState(false);
  const [scheduleReturnDialogOpen, setScheduleReturnDialogOpen] = useState(false);
  const [scheduleReturnTargetStatus, setScheduleReturnTargetStatus] = useState<string>('Em contato');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [closerLostDialogOpen, setCloserLostDialogOpen] = useState(false);
  const [closerReturnDialogOpen, setCloserReturnDialogOpen] = useState(false);
  const [closerReturnReason, setCloserReturnReason] = useState('');
  const [closerReturnSelected, setCloserReturnSelected] = useState('');
  const [sendToCloserOpen, setSendToCloserOpen] = useState(false);
  const [enrollSequenceOpen, setEnrollSequenceOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [registerOutcomePanelOpen, setRegisterOutcomePanelOpen] = useState(false);
  const [enrichDialog, setEnrichDialog] = useState(false);
  const [enrichOptions, setEnrichOptions] = useState({ brasilapi: true, perplexity: true });

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const savingDelayRef = useRef<NodeJS.Timeout>();
  const outcomeSubmittingRef = useRef(false);

  // Hooks
  const createNoteMutation = useCreateNote();
  const deleteLeadMutation = useDeleteLead();
  const { logActivity } = useLogLeadActivity();
  const { user: authUser } = useCurrentUser();
  const { isConnected: isCalendarConnected, createEvent: createCalendarEvent, updateEvent: updateCalendarEvent } = useGoogleCalendar();
  const enrichLeadMutation = useEnrichIndividualLead();
  const { isSdr, isManager } = useUserRole();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const currentUserId = authUser?.id ?? null;
  const currentUserName = authUser?.name || authUser?.email || '';
  const isAdmin = hasPermission('access_admin');
  const canReassign = isAdmin || hasPermission('reassign_ownership');

  // Owner check
  const isOwner = useMemo(() => {
    if (!currentUserId) return false;
    if (mode === 'sdr') return lead?.owner_user_id === currentUserId;
    return opportunity?.assigned_to_user_id === currentUserId || opportunity?.created_by_user_id === currentUserId;
  }, [mode, lead?.owner_user_id, opportunity?.assigned_to_user_id, opportunity?.created_by_user_id, currentUserId]);

  const canDelete = isAdmin || isOwner;

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (savingDelayRef.current) clearTimeout(savingDelayRef.current);
    };
  }, []);

  // Saving indicator wrapper
  const handleLeadUpdate = useCallback((updatedLead: Lead) => {
    onUpdateLead(updatedLead);
    setIsSaving(true);
    if (savingDelayRef.current) clearTimeout(savingDelayRef.current);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    savingDelayRef.current = setTimeout(() => {
      setLastSavedAt(new Date());
      setIsSaving(false);
      saveTimeoutRef.current = setTimeout(() => setLastSavedAt(null), 2000);
    }, 200);
  }, [onUpdateLead]);

  const getUserInfo = useCallback(() => {
    return { id: currentUserId, name: currentUserName || 'Usuário' };
  }, [currentUserId, currentUserName]);

  // Field change logging wrapper
  const handleLeadUpdateWithLogging = useCallback((updatedLead: Lead) => {
    if (!lead) return;
    const safeUpdate = {
      ...updatedLead,
      status: lead.status,
      last_contact_at: lead.last_contact_at,
      attempts_count: lead.attempts_count,
      next_action_at: lead.next_action_at,
    };
    handleLeadUpdate(safeUpdate);
    void (async () => {
      for (const field of TRACKED_FIELDS) {
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
  }, [lead, logActivity, handleLeadUpdate]);

  // Status change
  const handleStatusChange = useCallback(async (newStatus: LeadStatus) => {
    if (!lead) return;
    const now = new Date().toISOString();
    const oldStatus = lead.status;
    const userInfo = getUserInfo();
    onUpdateLead({ ...lead, status: newStatus, last_contact_at: now });
    await logActivity({
      lead_id: lead.id,
      action_type: 'status_changed',
      field_name: 'status',
      old_value: oldStatus,
      new_value: newStatus,
      description: `alterou o status de ${getStatusLabel(oldStatus)} para ${getStatusLabel(newStatus)}`,
    });
    try {
      await createNoteMutation.mutateAsync({
        lead_id: lead.id,
        user_id: userInfo.id,
        note: `[${getStatusLabel(newStatus)}] (${userInfo.name}) Status alterado de ${getStatusLabel(oldStatus)} para ${getStatusLabel(newStatus)}`,
      });
    } catch (e) {
      console.error('Failed to create status change note:', e);
    }
    queryClient.invalidateQueries({ queryKey: ['closer-pipeline'] });
    queryClient.invalidateQueries({ queryKey: ['closer-opportunities-paginated'] });
    toast.success(`Status atualizado para ${newStatus}`);
  }, [lead, getUserInfo, onUpdateLead, logActivity, createNoteMutation, queryClient]);

  // Status change with observation
  const handleStatusChangeWithObservation = useCallback(async (observation: string, nextActionAt?: Date) => {
    if (!lead) return;
    const now = new Date().toISOString();
    const userInfo = getUserInfo();
    const oldStatus = lead.status;
    onUpdateLead({
      ...lead,
      status: 'Em contato',
      last_contact_at: now,
      attempts_count: lead.attempts_count + 1,
      next_action_at: nextActionAt?.toISOString() || now,
    });
    await logActivity({
      lead_id: lead.id,
      action_type: 'status_changed',
      field_name: 'status',
      old_value: oldStatus,
      new_value: 'Em contato',
      description: `alterou o status de ${getStatusLabel(oldStatus)} para ${getStatusLabel('Em contato')}`,
    });
    const noteText = observation
      ? `[Em contato] (${userInfo.name}) ${observation}`
      : `[Em contato] (${userInfo.name}) Status atualizado`;
    try {
      await createNoteMutation.mutateAsync({ lead_id: lead.id, user_id: userInfo.id, note: noteText });
      await logActivity({ lead_id: lead.id, action_type: 'note_added', description: 'adicionou uma observação' });
      toast.success('Status atualizado para Em contato');
    } catch (error) {
      console.error('Error saving note:', error);
      toast.success('Status atualizado para Em contato');
      toast.error('Erro ao salvar observação');
    }
    queryClient.invalidateQueries({ queryKey: ['closer-pipeline'] });
    queryClient.invalidateQueries({ queryKey: ['closer-opportunities-paginated'] });
  }, [lead, getUserInfo, onUpdateLead, logActivity, createNoteMutation, queryClient]);

  // Open meeting dialog with validation
  const handleOpenMeetingDialog = useCallback(() => {
    if (!lead) return;
    const advanceCheck = canAdvanceToMeeting(lead);
    if (!advanceCheck.allowed) {
      toast.error(advanceCheck.reason);
      return;
    }
    const missingQualification = getMissingQualificationFields(lead);
    const missingCompanyData = getMissingCompanyDataFields(lead);
    if (missingQualification.length > 0) {
      toast.error(`Qualificação incompleta. Campos faltantes: ${missingQualification.join(', ')}`);
      return;
    }
    if (missingCompanyData.length > 0) {
      toast.error(`Dados da Empresa incompletos. Campos faltantes: ${missingCompanyData.join(', ')}`);
      return;
    }
    setMeetingDialogOpen(true);
  }, [lead]);

  // Confirm meeting (unified)
  const handleConfirmMeeting = useCallback(async (meetingData: MeetingData) => {
    if (!lead) return;
    const now = new Date().toISOString();
    const userInfo = getUserInfo();
    const oldStatus = lead.status;
    const [hours, minutes] = meetingData.meetingTime.split(':').map(Number);
    const meetingDatetime = new Date(meetingData.meetingDate);
    meetingDatetime.setHours(hours, minutes, 0, 0);
    const nextActionAt = new Date(meetingDatetime.getTime() - 60 * 60 * 1000);

    const formattedDate = meetingDatetime.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo',
    });
    const formattedTime = meetingDatetime.toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
    });

    // Check for existing meeting + opportunity
    const existing = await findExistingActiveMeeting(lead.id);
    const isReschedule = !!existing;

    let meetingRecordId: string | undefined;

    if (isReschedule) {
      // UPDATE existing meeting
      meetingRecordId = existing.id;
      await updateExistingMeeting({
        meetingId: existing.id,
        meetingDatetime: meetingDatetime.toISOString(),
        title: meetingData.meetingTitle,
        executiveName: meetingData.executiveName,
      });
      // UPDATE existing opportunity
      if (existing.opportunity_id) {
        await updateExistingOpportunity({
          opportunityId: existing.opportunity_id,
          meetingDatetime: meetingDatetime.toISOString(),
          assignedToUserId: meetingData.executiveUserId || undefined,
        });
      }
    } else {
      // INSERT new meeting
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

      // CREATE opportunity
      try {
        await createOpportunityFromMeeting(
          lead.id,
          userInfo.id,
          meetingData.executiveUserId || null,
          meetingDatetime.toISOString(),
          'Demonstração',
          true,
        );
      } catch (error: unknown) {
        console.error('Error creating opportunity:', error);
        const errorMsg = (error as Error)?.message || 'Erro desconhecido';
        toast.error(`Não foi possível criar a oportunidade no pipeline do Closer: ${errorMsg}`);
        if (meetingRecordId) {
          try { await supabase.from('meetings').delete().eq('id', meetingRecordId); } catch { /* cleanup */ }
        }
        return;
      }
    }

    // Update lead status
    onUpdateLead({
      ...lead,
      status: 'Reunião agendada' as LeadStatus,
      last_contact_at: now,
      next_action_at: nextActionAt.toISOString(),
      attempts_count: lead.attempts_count + 1,
    });

    // Save note
    const notePrefix = isReschedule ? '[Reunião Reagendada]' : '[Reunião Agendada]';
    try {
      await createNoteMutation.mutateAsync({
        lead_id: lead.id,
        user_id: userInfo.id,
        note: `${notePrefix} (${userInfo.name}) ${meetingData.meetingTitle} - Executivo: ${meetingData.executiveName} - Data: ${formattedDate} às ${formattedTime}`,
      });
    } catch (error) {
      console.error('Error saving note:', error);
    }

    // Log activity
    await logActivity({
      lead_id: lead.id,
      action_type: isReschedule ? 'meeting_rescheduled' : 'meeting_scheduled',
      description: isReschedule
        ? `reagendou reunião "${meetingData.meetingTitle}" com ${meetingData.executiveName} para ${formattedDate} às ${formattedTime}`
        : `agendou reunião "${meetingData.meetingTitle}" com ${meetingData.executiveName} para ${formattedDate} às ${formattedTime}`,
    });
    if (!isReschedule) {
      await logActivity({
        lead_id: lead.id,
        action_type: 'status_changed',
        field_name: 'status',
        old_value: oldStatus,
        new_value: 'Reunião agendada',
        description: `alterou o status de ${getStatusLabel(oldStatus)} para ${getStatusLabel('Reunião agendada')}`,
      });
    }
    toast.success(isReschedule
      ? `Reunião reagendada para ${formattedDate} às ${formattedTime}!`
      : `Reunião agendada para ${formattedDate} às ${formattedTime}!`);

    // Google Calendar event + email (non-blocking)
    const meetingEndDatetime = new Date(meetingDatetime.getTime() + 60 * 60 * 1000);
    const attendees = (meetingData.inviteEmails || []).map((email) => ({ email }));

    let meetLink: string | undefined;
    let calEventId: string | undefined;
    if (isCalendarConnected) {
      try {
        const calendarPayload = {
          summary: meetingData.meetingTitle,
          start: { dateTime: meetingDatetime.toISOString() },
          end: { dateTime: meetingEndDatetime.toISOString() },
          attendees,
          description: `Empresa: ${lead.company}\nContato: ${lead.name}\nExecutivo: ${meetingData.executiveName}`,
        };

        let calResult: Record<string, unknown> | undefined;
        if (isReschedule && existing?.google_calendar_event_id) {
          calResult = await updateCalendarEvent(existing.google_calendar_event_id, calendarPayload) as Record<string, unknown>;
          calEventId = existing.google_calendar_event_id;
        } else {
          calResult = await createCalendarEvent(calendarPayload) as Record<string, unknown>;
          calEventId = calResult?.id as string | undefined;
        }

        const entryPoints = (calResult?.conferenceData as Record<string, Record<string, string>[]> | undefined)?.entryPoints;
        meetLink = (calResult?.hangoutLink as string) || entryPoints?.find((e) => e.entryPointType === 'video')?.uri;

        if (meetingRecordId) {
          const updatePayload: Record<string, unknown> = {};
          if (meetLink) updatePayload.meet_link = meetLink;
          if (calEventId) updatePayload.google_calendar_event_id = calEventId;
          if (Object.keys(updatePayload).length > 0) {
            await supabase.from('meetings').update(updatePayload).eq('id', meetingRecordId);
          }
        }
      } catch (err) {
        console.error('Google Calendar error:', err);
        toast.warning('Reunião salva, mas o evento do calendário não foi criado.');
      }
    } else if (attendees.length > 0) {
      toast.warning('Google Calendar não conectado. Convites .ics não foram enviados.');
    }

    // Send email invites
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

    onClose();
  }, [lead, getUserInfo, onUpdateLead, logActivity, createNoteMutation, isCalendarConnected, createCalendarEvent, updateCalendarEvent, onClose]);

  // Confirm presence (meeting happened → create opportunity)
  const handleConfirmPresence = useCallback(async (closerId: string) => {
    if (!lead) return;
    const now = new Date().toISOString();
    const userInfo = getUserInfo();
    const oldStatus = lead.status;

    try {
      await createOpportunityFromMeeting(
        lead.id,
        userInfo.id,
        closerId,
        new Date().toISOString(),
        'Demonstração',
        true,
      );
    } catch (error) {
      console.error('Error creating opportunity:', error);
      toast.error('Erro ao criar oportunidade no pipeline. Tente novamente.');
      return;
    }

    onUpdateLead({
      ...lead,
      status: 'Oportunidade criada',
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
      console.error('Error saving note:', error);
    }
    await logActivity({
      lead_id: lead.id,
      action_type: 'opportunity_created',
      description: 'confirmou presença na reunião e criou oportunidade',
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
    onClose();
  }, [lead, getUserInfo, onUpdateLead, logActivity, createNoteMutation, onClose]);

  // Confirm discard
  const handleConfirmDiscard = useCallback(async (reason: DiscardReason) => {
    if (!lead) return;
    const now = new Date().toISOString();
    const userInfo = getUserInfo();
    const oldStatus = lead.status;
    onUpdateLead({
      ...lead,
      status: 'Descartado',
      last_contact_at: now,
      next_action_at: '2099-12-31T23:59:59Z',
      attempts_count: lead.attempts_count + 1,
    });
    try {
      await createNoteMutation.mutateAsync({
        lead_id: lead.id,
        user_id: userInfo.id,
        note: `[Perdido] (${userInfo.name}) Motivo: ${reason.status} - ${reason.description}`,
      });
    } catch (error) {
      console.error('Error saving note:', error);
    }
    await logActivity({
      lead_id: lead.id,
      action_type: 'status_changed',
      field_name: 'status',
      old_value: oldStatus,
      new_value: 'Descartado',
      description: `marcou o lead como perdido. Motivo: ${reason.status} - ${reason.description}`,
    });
    toast.info(`Lead perdido: ${reason.status}`);
    onClose();
  }, [lead, getUserInfo, onUpdateLead, logActivity, createNoteMutation, onClose]);

  // Restore lead
  const handleRestoreLead = useCallback(async () => {
    if (!lead) return;
    const now = new Date().toISOString();
    const userInfo = getUserInfo();
    const oldStatus = lead.status;
    onUpdateLead({ ...lead, status: 'Novo', last_contact_at: now, next_action_at: now });
    try {
      await createNoteMutation.mutateAsync({
        lead_id: lead.id,
        user_id: userInfo.id,
        note: `[Restaurado] (${userInfo.name}) Lead restaurado para status 'Novo'`,
      });
    } catch (error) {
      console.error('Error saving note:', error);
    }
    await logActivity({
      lead_id: lead.id,
      action_type: 'status_changed',
      field_name: 'status',
      old_value: oldStatus,
      new_value: 'Novo',
      description: `restaurou o lead para status ${getStatusLabel('Novo')}`,
    });
    toast.success('Lead restaurado com sucesso!');
  }, [lead, getUserInfo, onUpdateLead, logActivity, createNoteMutation]);

  // Schedule return
  const handleScheduleReturn = useCallback(async (data: ScheduleReturnData) => {
    if (!lead) return;
    const [hours, minutes] = data.time.split(':').map(Number);
    const scheduledDate = new Date(data.date);
    scheduledDate.setHours(hours, minutes, 0, 0);
    const now = new Date().toISOString();
    const userInfo = getUserInfo();
    const oldStatus = lead.status;
    const targetStatus = scheduleReturnTargetStatus;
    onUpdateLead({
      ...lead,
      status: targetStatus as LeadStatus,
      next_action_at: scheduledDate.toISOString(),
      last_contact_at: now,
      attempts_count: lead.attempts_count + 1,
    });
    setScheduleReturnTargetStatus('Em contato'); // reset
    const formattedDate = scheduledDate.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
    });
    try {
      await createNoteMutation.mutateAsync({
        lead_id: lead.id,
        user_id: userInfo.id,
        note: `[Retorno agendado para ${formattedDate}] (${userInfo.name}) ${data.observation || 'Sem observação'}`,
      });
    } catch (error) {
      console.error('Error saving note:', error);
    }
    await logActivity({
      lead_id: lead.id,
      action_type: 'status_changed',
      field_name: 'status',
      old_value: oldStatus,
      new_value: targetStatus,
      description: `agendou retorno para ${formattedDate}`,
    });
    toast.success(`Retorno agendado para ${formattedDate}`);
  }, [lead, getUserInfo, onUpdateLead, logActivity, createNoteMutation, scheduleReturnTargetStatus]);

  // Delete lead (or opportunity in closer mode)
  const handleDeleteLead = useCallback(async () => {
    if (!lead) return;
    try {
      if (mode === 'closer' && opportunity) {
        const { bulkDeleteOpportunities } = await import('@/services/closerService');
        await bulkDeleteOpportunities([opportunity.id]);
        toast.success('Oportunidade excluída permanentemente');
        onOpportunityStageChange?.();
      } else {
        await deleteLeadMutation.mutateAsync(lead.id);
        toast.success('Lead excluído permanentemente');
      }
      setDeleteDialogOpen(false);
      onClose();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error(`Erro ao excluir ${mode === 'closer' ? 'oportunidade' : 'lead'}. Verifique suas permissões.`);
    }
  }, [lead, mode, opportunity, deleteLeadMutation, onClose, onOpportunityStageChange]);

  // Undo closer
  const handleUndoCloser = useCallback(async () => {
    if (!lead) return;
    try {
      await removeOpportunityByLeadId(lead.id);
      const userInfo = getUserInfo();
      onUpdateLead({ ...lead, status: 'Em contato' as LeadStatus });
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
  }, [lead, getUserInfo, onUpdateLead, createNoteMutation]);

  // Enrich lead
  const handleEnrichLead = useCallback(async () => {
    if (!lead) return;
    if (!lead.cnpj) {
      toast.error('Lead não possui CNPJ. Enriquecimento requer CNPJ válido.');
      return;
    }
    if (enrichOptions.perplexity) {
      const aiData = lead.ai_enrichment_data as Record<string, unknown> | null;
      const lastEnrichedAt = (aiData as Record<string, string> | null)?.enriched_at;
      if (lastEnrichedAt) {
        const lastDate = new Date(lastEnrichedAt);
        const nowMs = Date.now();
        const diffDays = Math.floor((nowMs - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 30) {
          const remaining = 30 - diffDays;
          toast.error(`Enriquecimento com IA já foi realizado há ${diffDays} dia(s). Aguarde mais ${remaining} dia(s) para atualizar novamente.`);
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
      const { data: updatedLead } = await supabase.from('leads').select('*').eq('id', lead.id).single();
      if (updatedLead) {
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
      console.error('Error enriching lead:', error);
    }
  }, [lead, enrichOptions, enrichLeadMutation, onUpdateLead]);

  // Register outcome (from RegisterOutcomePanel)
  const handleRegisterOutcome = useCallback(async (data: OutcomeData) => {
    if (!lead) return;
    const now = new Date().toISOString();
    const userInfo = getUserInfo();
    const oldStatus = lead.status;
    const resultStatusMap: Record<string, LeadStatus> = {
      nao_atendeu: 'Em contato',
      interesse: 'Interesse',
      sem_interesse: 'Descartado',
      reagendado: 'Em contato',
      conectou: 'Em contato',
    };
    const newStatus = resultStatusMap[data.result] || lead.status;
    let nextActionAt = lead.next_action_at;
    if (data.nextActionDate) {
      const [h, m] = data.nextActionTime.split(':').map(Number);
      const scheduledDate = new Date(data.nextActionDate);
      scheduledDate.setHours(h, m, 0, 0);
      nextActionAt = scheduledDate.toISOString();
    }
    onUpdateLead({
      ...lead,
      status: newStatus,
      last_contact_at: now,
      next_action_at: nextActionAt,
      attempts_count: lead.attempts_count + 1,
    });
    const channelMap: Record<string, string> = { call: 'call', whatsapp: 'whatsapp', meeting: 'other', other: 'other' };
    const outcomeMap: Record<string, string> = {
      conectou: 'respondeu', nao_atendeu: 'sem_resposta', interesse: 'qualificado', sem_interesse: 'descartado', reagendado: 'reagendado',
    };
    try {
      await createInteraction({
        lead_id: lead.id,
        user_id: userInfo.id,
        channel: channelMap[data.contactType] as 'call' | 'whatsapp' | 'email' | 'other',
        direction: 'outbound',
        outcome: outcomeMap[data.result] as 'sem_resposta' | 'respondeu' | 'qualificado' | 'reagendado' | 'descartado',
        message_summary: data.observation || null,
        occurred_at: now,
      });
    } catch (e) {
      console.error('Error creating interaction:', e);
    }
    const contactLabels: Record<string, string> = { call: 'Ligação', whatsapp: 'WhatsApp', meeting: 'Reunião', other: 'Outro' };
    const resultLabels: Record<string, string> = {
      conectou: 'Conectou', nao_atendeu: 'Não atendeu', interesse: 'Interesse', sem_interesse: 'Sem interesse', reagendado: 'Reagendado',
    };
    const noteText = `[${contactLabels[data.contactType]}] (${userInfo.name}) Resultado: ${resultLabels[data.result]}${data.observation ? ` - ${data.observation}` : ''}`;
    try {
      await createNoteMutation.mutateAsync({ lead_id: lead.id, user_id: userInfo.id, note: noteText });
    } catch (e) {
      console.error('Error saving note:', e);
    }
    await logActivity({
      lead_id: lead.id,
      action_type: 'status_changed',
      field_name: 'status',
      old_value: oldStatus,
      new_value: newStatus,
      description: `registrou resultado: ${resultLabels[data.result]} via ${contactLabels[data.contactType]}`,
    });
    toast.success('Resultado registrado!');
  }, [lead, getUserInfo, onUpdateLead, logActivity, createNoteMutation]);

  // Closer stage change
  const handleCloserStageChange = useCallback(async (stage: CloserStage) => {
    if (!opportunity) return;
    if (stage === 'Perdido') {
      setCloserLostDialogOpen(true);
      return;
    } else if (stage === 'Ganho') {
      await markOpportunityWon(opportunity.id);
      onOpportunityStageChange?.();
      toast.success('Oportunidade ganha!');
    } else {
      await updateOpportunityStage(opportunity.id, stage);
      onOpportunityStageChange?.();
      toast.success(`Status atualizado para ${stage}`);
    }
  }, [opportunity, onOpportunityStageChange]);

  // Closer return to SDR
  const handleCloserReturn = useCallback(() => {
    if (opportunity) {
      setCloserReturnReason('');
      setCloserReturnSelected('');
      setCloserReturnDialogOpen(true);
    }
  }, [opportunity]);

  // Confirm closer return
  const handleConfirmCloserReturn = useCallback(async () => {
    if (!opportunity) return;
    const reason = closerReturnSelected === 'Outro' ? closerReturnReason : closerReturnSelected;
    await returnLeadToSdr(opportunity.id, reason);
    onOpportunityStageChange?.();
    setCloserReturnDialogOpen(false);
    setCloserReturnSelected('');
    toast.info('Lead devolvido ao SDR');
  }, [opportunity, closerReturnSelected, closerReturnReason, onOpportunityStageChange]);

  // Closer lost
  const handleConfirmCloserLost = useCallback(async (reason: { label: string; responsibility: string; sqoImpact: string }) => {
    if (!opportunity) return;
    await markOpportunityLost(opportunity.id, reason.label, reason.responsibility, reason.sqoImpact);
    onOpportunityStageChange?.();
    toast.info('Oportunidade marcada como perdida');
  }, [opportunity, onOpportunityStageChange]);

  return {
    // Dialog states
    discardDialogOpen, setDiscardDialogOpen,
    meetingDialogOpen, setMeetingDialogOpen,
    confirmedDialogOpen, setConfirmedDialogOpen,
    observationDialogOpen, setObservationDialogOpen,
    scheduleReturnDialogOpen, setScheduleReturnDialogOpen,
    scheduleReturnTargetStatus, setScheduleReturnTargetStatus,
    deleteDialogOpen, setDeleteDialogOpen,
    closerLostDialogOpen, setCloserLostDialogOpen,
    closerReturnDialogOpen, setCloserReturnDialogOpen,
    closerReturnReason, setCloserReturnReason,
    closerReturnSelected, setCloserReturnSelected,
    sendToCloserOpen, setSendToCloserOpen,
    enrollSequenceOpen, setEnrollSequenceOpen,
    emailDialogOpen, setEmailDialogOpen,
    registerOutcomePanelOpen, setRegisterOutcomePanelOpen,
    enrichDialog, setEnrichDialog,
    enrichOptions, setEnrichOptions,

    // Handlers
    handleLeadUpdate,
    handleLeadUpdateWithLogging,
    handleStatusChange,
    handleStatusChangeWithObservation,
    handleOpenMeetingDialog,
    handleConfirmMeeting,
    handleConfirmPresence,
    handleConfirmDiscard,
    handleRestoreLead,
    handleScheduleReturn,
    handleDeleteLead,
    handleUndoCloser,
    handleEnrichLead,
    handleRegisterOutcome,
    handleCloserStageChange,
    handleCloserReturn,
    handleConfirmCloserReturn,
    handleConfirmCloserLost,

    // Saving state
    isSaving, lastSavedAt,

    // User info
    currentUserId, currentUserName,
    getUserInfo,

    // Permissions
    isAdmin, isManager: isManager, isSdr,
    isOwner, canDelete, canReassign,

    // Mutations (exposed for UI)
    deleteLeadMutation,
    enrichLeadMutation,
    createNoteMutation,
    outcomeSubmittingRef,

    // Query client
    queryClient,

    // Funnel constants
    FUNNEL_ORDER,
  };
}
