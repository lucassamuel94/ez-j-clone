import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClientTimelineEntry {
  id: string;
  action_type: string;
  description: string;
  user_name: string | null;
  created_at: string;
}

export function useClientTimeline(accountId: string | null) {
  return useQuery<ClientTimelineEntry[]>({
    queryKey: ['client-timeline', accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_activity_logs')
        .select('id, action_type, description, created_at, user:profiles!account_activity_logs_user_id_fkey(name)')
        .eq('account_id', accountId!)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        action_type: row.action_type,
        description: row.description,
        user_name: row.user?.name || null,
        created_at: row.created_at,
      }));
    },
    enabled: !!accountId,
  });
}
