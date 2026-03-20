import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClientProposal {
  id: string;
  company_name: string | null;
  status: string;
  total_monthly: number | null;
  setup_total: number | null;
  view_count: number;
  created_at: string;
  opportunity_id: string | null;
}

export function useClientProposals(accountId: string | null) {
  return useQuery<ClientProposal[]>({
    queryKey: ['client-proposals', accountId],
    queryFn: async () => {
      // Get opportunity IDs for this account
      const { data: opps } = await supabase
        .from('opportunities')
        .select('id')
        .eq('account_id', accountId!);

      if (!opps || opps.length === 0) return [];

      const oppIds = opps.map((o: any) => o.id);

      const { data, error } = await supabase
        .from('proposals')
        .select('id, company_name, status, total_monthly, setup_total, view_count, created_at, opportunity_id')
        .in('opportunity_id', oppIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ClientProposal[];
    },
    enabled: !!accountId,
  });
}
