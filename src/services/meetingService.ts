import { supabase } from '@/integrations/supabase/client';

interface ExistingMeeting {
  id: string;
  google_calendar_event_id: string | null;
  opportunity_id: string | null;
}

/**
 * Checks if there's an existing active meeting + opportunity for a given lead.
 * Returns the existing meeting data if found, null otherwise.
 */
export async function findExistingActiveMeeting(leadId: string): Promise<ExistingMeeting | null> {
  // Find the most recent meeting for this lead
  const { data: meeting } = await supabase
    .from('meetings')
    .select('id, google_calendar_event_id')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!meeting) return null;

  // Find active opportunity for this lead (not lost/won)
  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('id, stage')
    .eq('lead_id', leadId)
    .not('stage', 'in', '(Perdido,Ganho)')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return {
    id: meeting.id,
    google_calendar_event_id: (meeting as Record<string, unknown>).google_calendar_event_id as string | null,
    opportunity_id: opportunity?.id ?? null,
  };
}

interface UpdateMeetingParams {
  meetingId: string;
  meetingDatetime: string;
  title: string;
  executiveName: string;
  meetLink?: string;
  googleCalendarEventId?: string;
}

/**
 * Updates an existing meeting record instead of creating a new one.
 */
export async function updateExistingMeeting(params: UpdateMeetingParams): Promise<void> {
  const updateData: Record<string, unknown> = {
    meeting_datetime: params.meetingDatetime,
    title: params.title,
    executive_name: params.executiveName,
  };
  if (params.meetLink !== undefined) {
    updateData.meet_link = params.meetLink;
  }
  if (params.googleCalendarEventId !== undefined) {
    updateData.google_calendar_event_id = params.googleCalendarEventId;
  }

  await supabase
    .from('meetings')
    .update(updateData as Record<string, unknown>)
    .eq('id', params.meetingId);
}

interface UpdateOpportunityParams {
  opportunityId: string;
  meetingDatetime: string;
  assignedToUserId?: string;
}

/**
 * Updates an existing opportunity's meeting datetime.
 */
export async function updateExistingOpportunity(params: UpdateOpportunityParams): Promise<void> {
  const updateData: Record<string, unknown> = {
    meeting_datetime: params.meetingDatetime,
    stage: 'Demonstração',
    returned_to_sdr: false,
  };
  if (params.assignedToUserId) {
    updateData.assigned_to_user_id = params.assignedToUserId;
  }

  await supabase
    .from('opportunities')
    .update(updateData)
    .eq('id', params.opportunityId);
}
