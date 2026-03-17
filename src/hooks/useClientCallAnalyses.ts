import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CallAnalysis } from './useCallAnalyses';

export function useClientCallAnalyses(accountId: string | null | undefined) {
  return useQuery({
    queryKey: ['client-call-analyses', accountId],
    enabled: !!accountId,
    queryFn: async () => {
      // 1. Find leads linked to this account
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id')
        .eq('account_id', accountId!);

      if (leadsError) throw leadsError;
      if (!leads?.length) return [] as CallAnalysis[];

      const leadIds = leads.map(l => l.id);

      // 2. Fetch completed call_analyses for those leads
      const { data, error } = await (supabase
        .from('call_analyses' as any)
        .select('*') as any)
        .in('lead_id', leadIds)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data || []) as any[];
      if (rows.length === 0) return [] as CallAnalysis[];

      // 3. Enrich with profile and lead names
      const sdrIds = [...new Set(rows.map((r: any) => r.sdr_user_id))];
      const enrichLeadIds = [...new Set(rows.filter((r: any) => r.lead_id).map((r: any) => r.lead_id))];

      const [{ data: profiles }, { data: enrichLeads }] = await Promise.all([
        supabase.from('profiles').select('id, name').in('id', sdrIds),
        enrichLeadIds.length > 0
          ? supabase.from('leads').select('id, name, company').in('id', enrichLeadIds)
          : Promise.resolve({ data: [] }),
      ]);

      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
      const leadMap = Object.fromEntries((enrichLeads || []).map((l: any) => [l.id, l]));

      return rows.map((r: any) => ({
        ...r,
        sdr_profile: profileMap[r.sdr_user_id] ? { name: profileMap[r.sdr_user_id].name } : null,
        lead_data: r.lead_id && leadMap[r.lead_id] ? { name: leadMap[r.lead_id].name, company: leadMap[r.lead_id].company } : null,
      })) as CallAnalysis[];
    },
  });
}
