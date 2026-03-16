import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CallHistoryEntry {
  id: string;
  lead_id: string | null;
  user_id: string | null;
  phone_number: string;
  direction: 'outbound' | 'inbound';
  duration_seconds: number;
  status: 'initiated' | 'ringing' | 'answered' | 'completed' | 'missed' | 'busy' | 'no_answer' | 'failed';
  lead_name: string | null;
  lead_company: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

interface StartCallParams {
  phone_number: string;
  lead_id?: string;
  lead_name?: string;
  lead_company?: string;
  direction?: 'outbound' | 'inbound';
}

interface EndCallParams {
  call_id: string;
  status: 'completed' | 'missed' | 'busy' | 'no_answer' | 'failed';
  duration_seconds: number;
}

export const useCallHistory = () => {
  return useQuery({
    queryKey: ['call-history'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('call_history')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as CallHistoryEntry[];
    },
  });
};

export const useStartCall = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: StartCallParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('call_history')
        .insert({
          user_id: user.id,
          phone_number: params.phone_number,
          lead_id: params.lead_id || null,
          lead_name: params.lead_name || null,
          lead_company: params.lead_company || null,
          direction: params.direction || 'outbound',
          status: 'initiated',
        })
        .select()
        .single();

      if (error) throw error;
      return data as CallHistoryEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-history'] });
    },
  });
};

export const useEndCall = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: EndCallParams) => {
      const { data, error } = await supabase
        .from('call_history')
        .update({
          status: params.status,
          duration_seconds: params.duration_seconds,
          ended_at: new Date().toISOString(),
        })
        .eq('id', params.call_id)
        .select()
        .single();

      if (error) throw error;
      return data as CallHistoryEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-history'] });
    },
  });
};

export const useUpdateCallStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ call_id, status }: { call_id: string; status: CallHistoryEntry['status'] }) => {
      const { data, error } = await supabase
        .from('call_history')
        .update({ status })
        .eq('id', call_id)
        .select()
        .single();

      if (error) throw error;
      return data as CallHistoryEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-history'] });
    },
  });
};
