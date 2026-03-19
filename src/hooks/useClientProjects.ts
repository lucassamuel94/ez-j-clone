import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClientProject {
  id: string;
  company_name: string;
  project_type: string | null;
  overall_status: string;
  current_phase: string | null;
  due_date: string | null;
  delivered_at: string | null;
  created_at: string;
}

export function useClientProjects(accountId: string | null) {
  return useQuery<ClientProject[]>({
    queryKey: ['client-projects', accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, company_name, project_type, overall_status, current_phase, due_date, delivered_at, created_at')
        .eq('account_id', accountId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ClientProject[];
    },
    enabled: !!accountId,
  });
}
