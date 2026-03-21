import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FollowUpLog {
  id: string;
  opportunity_id: string;
  lead_id: string;
  closer_user_id: string | null;
  step_number: number;
  channel: string;
  message_content: string;
  subject: string | null;
  status: string;
  responded_at: string | null;
  response_type: string | null;
  led_to_meeting: boolean;
  led_to_won: boolean;
  created_at: string;
  ai_context: Record<string, unknown> | null;
}

export interface FollowUpRule {
  id: string;
  stage: string;
  step_number: number;
  delay_days: number;
  channel: string;
  tone: string;
  strategy: string | null;
  max_attempts: number;
  active: boolean;
}

export interface CloserProfile {
  user_id: string;
  writing_style: string | null;
  common_phrases: string[] | null;
  preferred_tone: string | null;
  objection_handling_style: string | null;
  win_rate: number;
  avg_deal_value: number;
  avg_days_to_close: number;
  total_deals_won: number;
  total_deals_lost: number;
  is_top_performer: boolean;
  last_analyzed_at: string | null;
}

export interface GhostCloserStats {
  totalSent: number;
  totalResponded: number;
  totalMeetings: number;
  totalWon: number;
  responseRate: number;
  revenueInfluenced: number;
}

export function useGhostCloserLogs(filters?: { days?: number; closerId?: string }) {
  return useQuery({
    queryKey: ['ghost-closer-logs', filters],
    queryFn: async () => {
      const daysAgo = new Date(Date.now() - (filters?.days || 30) * 24 * 60 * 60 * 1000).toISOString();
      let query = (supabase
        .from('follow_up_logs' as any) as any)
        .select('*')
        .gte('created_at', daysAgo)
        .order('created_at', { ascending: false });

      if (filters?.closerId) {
        query = query.eq('closer_user_id', filters.closerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FollowUpLog[];
    },
    staleTime: 30000,
  });
}

export function useGhostCloserStats(days = 30) {
  return useQuery({
    queryKey: ['ghost-closer-stats', days],
    queryFn: async () => {
      const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data: logs, error } = await (supabase
        .from('follow_up_logs' as any) as any)
        .select('status, led_to_meeting, led_to_won, opportunity_id')
        .gte('created_at', daysAgo);

      if (error) throw error;

      const logsList = (logs || []) as any[];
      const totalSent = logsList.length;
      const totalResponded = logsList.filter(l => l.status === 'responded').length;
      const totalMeetings = logsList.filter(l => l.led_to_meeting).length;
      const wonOppIds: string[] = [...new Set(logsList.filter(l => l.led_to_won).map(l => String(l.opportunity_id)))].filter(id => id && id !== 'undefined');

      // Get revenue from won deals influenced by ghost closer
      let revenueInfluenced = 0;
      if (wonOppIds.length > 0) {
        const { data: opps } = await supabase
          .from('opportunities')
          .select('deal_value')
          .in('id', wonOppIds);
        revenueInfluenced = (opps || []).reduce((s, o) => s + (Number(o.deal_value) || 0), 0);
      }

      return {
        totalSent,
        totalResponded,
        totalMeetings,
        totalWon: wonOppIds.length,
        responseRate: totalSent > 0 ? Math.round((totalResponded / totalSent) * 100) : 0,
        revenueInfluenced,
      } as GhostCloserStats;
    },
    staleTime: 60000,
  });
}

export function useFollowUpRules() {
  const queryClient = useQueryClient();

  const rulesQuery = useQuery({
    queryKey: ['follow-up-rules'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('follow_up_rules' as any) as any)
        .select('*')
        .order('stage')
        .order('step_number');
      if (error) throw error;
      return (data || []) as FollowUpRule[];
    },
  });

  const updateRule = useMutation({
    mutationFn: async (rule: Partial<FollowUpRule> & { id: string }) => {
      const { id, ...updates } = rule;
      const { error } = await (supabase
        .from('follow_up_rules' as any) as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-rules'] });
      toast.success('Regra atualizada');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { rules: rulesQuery.data || [], isLoading: rulesQuery.isLoading, updateRule };
}

export function useCloserProfiles() {
  return useQuery({
    queryKey: ['closer-profiles'],
    queryFn: async () => {
      const { data: profiles, error } = await (supabase
        .from('closer_profiles' as any) as any)
        .select('*')
        .order('win_rate', { ascending: false });
      if (error) throw error;

      // Enrich with names
      const userIds = (profiles || []).map(p => p.user_id);
      if (userIds.length === 0) return [];

      const { data: users } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      const nameMap = new Map((users || []).map((u: any) => [u.id, u.name]));
      return (profiles || []).map(p => ({
        ...p,
        name: nameMap.get(p.user_id) || 'Closer',
      })) as (CloserProfile & { name: string })[];
    },
    staleTime: 60000,
  });
}

export function useRunGhostCloser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ghost-closer', { body: {} });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ghost-closer-logs'] });
      queryClient.invalidateQueries({ queryKey: ['ghost-closer-stats'] });
      toast.success(`Ghost Closer: ${data.sent} follow-ups enviados`);
    },
    onError: (err: Error) => toast.error('Erro: ' + err.message),
  });
}

export function useRunGhostCloserLearn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ghost-closer-learn', { body: {} });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['closer-profiles'] });
      toast.success(`Aprendizado: ${data.closers_analyzed} closers analisados`);
    },
    onError: (err: Error) => toast.error('Erro: ' + err.message),
  });
}

export function useMarkFollowUpResponded() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ logId, responseType, ledToMeeting }: { logId: string; responseType: string; ledToMeeting?: boolean }) => {
      const { error } = await (supabase
        .from('follow_up_logs' as any) as any)
        .update({
          status: 'responded',
          responded_at: new Date().toISOString(),
          response_type: responseType,
          led_to_meeting: ledToMeeting || false,
        })
        .eq('id', logId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ghost-closer-logs'] });
      queryClient.invalidateQueries({ queryKey: ['ghost-closer-stats'] });
    },
  });
}
