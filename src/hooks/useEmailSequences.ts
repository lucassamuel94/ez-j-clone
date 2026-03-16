import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmailSequence {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EmailSequenceStep {
  id: string;
  sequence_id: string;
  step_number: number;
  delay_hours: number;
  subject: string;
  body: string;
  created_at: string;
}

export interface EmailSequenceEnrollment {
  id: string;
  sequence_id: string;
  lead_id: string;
  current_step: number;
  status: 'active' | 'completed' | 'replied' | 'unsubscribed';
  next_send_at: string | null;
  enrolled_by: string;
  created_at: string;
  updated_at: string;
}

export function useEmailSequences() {
  const queryClient = useQueryClient();

  const sequencesQuery = useQuery({
    queryKey: ['email-sequences'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_sequences')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as EmailSequence[];
    },
  });

  const createSequence = useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('email_sequences')
        .insert({ ...payload, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-sequences'] }),
  });

  const updateSequence = useMutation({
    mutationFn: async (payload: { id: string; name?: string; description?: string; active?: boolean }) => {
      const { id, ...rest } = payload;
      const { error } = await supabase
        .from('email_sequences')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-sequences'] }),
  });

  const deleteSequence = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_sequences').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-sequences'] }),
  });

  return {
    sequences: sequencesQuery.data || [],
    isLoading: sequencesQuery.isLoading,
    createSequence,
    updateSequence,
    deleteSequence,
  };
}

export function useSequenceSteps(sequenceId: string | null) {
  const queryClient = useQueryClient();

  const stepsQuery = useQuery({
    queryKey: ['email-sequence-steps', sequenceId],
    queryFn: async () => {
      if (!sequenceId) return [];
      const { data, error } = await supabase
        .from('email_sequence_steps')
        .select('*')
        .eq('sequence_id', sequenceId)
        .order('step_number');
      if (error) throw error;
      return data as EmailSequenceStep[];
    },
    enabled: !!sequenceId,
  });

  const upsertStep = useMutation({
    mutationFn: async (payload: Omit<EmailSequenceStep, 'id' | 'created_at'> & { id?: string }) => {
      if (payload.id) {
        const { error } = await supabase
          .from('email_sequence_steps')
          .update({ subject: payload.subject, body: payload.body, delay_hours: payload.delay_hours })
          .eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_sequence_steps')
          .insert({
            sequence_id: payload.sequence_id,
            step_number: payload.step_number,
            delay_hours: payload.delay_hours,
            subject: payload.subject,
            body: payload.body,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-sequence-steps', sequenceId] }),
  });

  const deleteStep = useMutation({
    mutationFn: async (stepId: string) => {
      const { error } = await supabase.from('email_sequence_steps').delete().eq('id', stepId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-sequence-steps', sequenceId] }),
  });

  return {
    steps: stepsQuery.data || [],
    isLoading: stepsQuery.isLoading,
    upsertStep,
    deleteStep,
  };
}

export function useSequenceEnrollments(filters?: { sequenceId?: string; leadId?: string }) {
  const queryClient = useQueryClient();

  const enrollmentsQuery = useQuery({
    queryKey: ['email-sequence-enrollments', filters],
    queryFn: async () => {
      let query = supabase
        .from('email_sequence_enrollments')
        .select('*, email_sequences(name), leads(name, company, email)')
        .order('created_at', { ascending: false });
      if (filters?.sequenceId) query = query.eq('sequence_id', filters.sequenceId);
      if (filters?.leadId) query = query.eq('lead_id', filters.leadId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const enrollLead = useMutation({
    mutationFn: async (payload: { sequence_id: string; lead_id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check for existing active enrollment to prevent duplicates
      const { data: existing } = await supabase
        .from('email_sequence_enrollments')
        .select('id')
        .eq('sequence_id', payload.sequence_id)
        .eq('lead_id', payload.lead_id)
        .eq('status', 'active')
        .maybeSingle();

      if (existing) throw new Error('Lead já está inscrito nesta sequência');

      // Get first step to calculate next_send_at
      const { data: firstStep } = await supabase
        .from('email_sequence_steps')
        .select('delay_hours')
        .eq('sequence_id', payload.sequence_id)
        .eq('step_number', 1)
        .single();

      const delayMs = (firstStep?.delay_hours || 0) * 60 * 60 * 1000;
      const nextSendAt = new Date(Date.now() + delayMs).toISOString();

      const { data, error } = await supabase
        .from('email_sequence_enrollments')
        .insert({
          sequence_id: payload.sequence_id,
          lead_id: payload.lead_id,
          enrolled_by: user.id,
          next_send_at: nextSendAt,
          current_step: 1,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-sequence-enrollments'] }),
  });

  const unenrollLead = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase
        .from('email_sequence_enrollments')
        .update({ status: 'unsubscribed' as any, updated_at: new Date().toISOString() })
        .eq('id', enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-sequence-enrollments'] }),
  });

  return {
    enrollments: enrollmentsQuery.data || [],
    isLoading: enrollmentsQuery.isLoading,
    enrollLead,
    unenrollLead,
  };
}

export function useSequenceDashboard() {
  return useQuery({
    queryKey: ['email-sequence-dashboard'],
    queryFn: async () => {
      const { data: enrollments, error } = await supabase
        .from('email_sequence_enrollments')
        .select('status');
      if (error) throw error;

      const { data: logs } = await supabase
        .from('email_sequence_logs')
        .select('id, opened_at, replied_at');

      const totalEnrolled = enrollments?.length || 0;
      const active = enrollments?.filter(e => e.status === 'active').length || 0;
      const completed = enrollments?.filter(e => e.status === 'completed').length || 0;
      const replied = enrollments?.filter(e => e.status === 'replied').length || 0;
      const totalSent = logs?.length || 0;
      const totalOpened = logs?.filter(l => l.opened_at).length || 0;
      const totalReplied = logs?.filter(l => l.replied_at).length || 0;

      return {
        totalEnrolled,
        active,
        completed,
        replied,
        totalSent,
        openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
        replyRate: totalSent > 0 ? (totalReplied / totalSent) * 100 : 0,
      };
    },
  });
}
