import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SdrFollowUpLog {
  id: string;
  lead_id: string;
  sdr_user_id: string | null;
  step_number: number;
  lead_status: string | null;
  channel: string;
  message_content: string;
  subject: string | null;
  status: string;
  responded_at: string | null;
  response_type: string | null;
  led_to_meeting: boolean;
  led_to_meeting_confirmed: boolean;
  led_to_sqo: boolean;
  led_to_sale: boolean;
  created_at: string;
  ai_context: Record<string, unknown> | null;
}

export interface SdrProfile {
  user_id: string;
  writing_style: string | null;
  common_phrases: string[] | null;
  preferred_tone: string | null;
  opening_style: string | null;
  qualification_style: string | null;
  sqo_rate: number;
  sqo_to_sale_rate: number;
  avg_call_score: number;
  total_sqos: number;
  total_sales_from_sqo: number;
  total_meetings_confirmed: number;
  total_calls: number;
  is_top_performer: boolean;
  name?: string;
}

export interface GhostSdrStats {
  totalSent: number;
  totalResponded: number;
  totalMeetings: number;
  totalMeetingsConfirmed: number;
  totalSqos: number;
  totalSales: number;
  responseRate: number;
}

export function useGhostSdrStats(days = 30) {
  return useQuery({
    queryKey: ['ghost-sdr-stats', days],
    queryFn: async () => {
      const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data: logs, error } = await (supabase
        .from('sdr_follow_up_logs' as any) as any)
        .select('status, led_to_meeting, led_to_meeting_confirmed, led_to_sqo, led_to_sale')
        .gte('created_at', daysAgo);
      if (error) throw error;

      const logsList = (logs || []) as any[];
      const totalSent = logsList.length;
      const totalResponded = logsList.filter(l => l.status === 'responded').length;
      return {
        totalSent,
        totalResponded,
        totalMeetings: logsList.filter(l => l.led_to_meeting).length,
        totalMeetingsConfirmed: logsList.filter(l => l.led_to_meeting_confirmed).length,
        totalSqos: logsList.filter(l => l.led_to_sqo).length,
        totalSales: logsList.filter(l => l.led_to_sale).length,
        responseRate: totalSent > 0 ? Math.round((totalResponded / totalSent) * 100) : 0,
      } as GhostSdrStats;
    },
    staleTime: 60000,
  });
}

export function useGhostSdrLogs(filters?: { days?: number; sdrId?: string }) {
  return useQuery({
    queryKey: ['ghost-sdr-logs', filters],
    queryFn: async () => {
      const daysAgo = new Date(Date.now() - (filters?.days || 30) * 24 * 60 * 60 * 1000).toISOString();
      let query = (supabase.from('sdr_follow_up_logs' as any) as any).select('*').gte('created_at', daysAgo).order('created_at', { ascending: false });
      if (filters?.sdrId) query = query.eq('sdr_user_id', filters.sdrId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as SdrFollowUpLog[];
    },
    staleTime: 30000,
  });
}

export function useSdrProfiles() {
  return useQuery({
    queryKey: ['sdr-profiles'],
    queryFn: async () => {
      const { data: profiles, error } = await (supabase
        .from('sdr_profiles' as any) as any).select('*').order('sqo_to_sale_rate', { ascending: false });
      if (error) throw error;
      const userIds = (profiles || []).map((p: any) => p.user_id);
      if (userIds.length === 0) return [];
      const { data: users } = await supabase.from('profiles').select('id, name').in('id', userIds);
      const nameMap = new Map((users || []).map((u: any) => [u.id, u.name]));
      return (profiles || []).map((p: any) => ({ ...p, name: nameMap.get(p.user_id) || 'SDR' })) as SdrProfile[];
    },
    staleTime: 60000,
  });
}

export function useRunGhostSdr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ghost-sdr', { body: {} });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['ghost-sdr-logs'] });
      qc.invalidateQueries({ queryKey: ['ghost-sdr-stats'] });
      toast.success(`Ghost SDR: ${data.sent} outreach(es) enviados`);
    },
    onError: (err: Error) => toast.error('Erro: ' + err.message),
  });
}

export function useRunGhostSdrLearn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ghost-sdr-learn', { body: {} });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['sdr-profiles'] });
      toast.success(`Aprendizado: ${data.sdrs_analyzed} SDRs analisados`);
    },
    onError: (err: Error) => toast.error('Erro: ' + err.message),
  });
}
