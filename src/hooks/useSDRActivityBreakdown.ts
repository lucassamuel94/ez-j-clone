import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SDRActivityBreakdownRow {
  id: string;
  name: string;
  leadsWorked: number;
  activities: number;
  meetings: number;
  proposals: number;
}

interface SDRActivityOptions {
  dateRange?: { start: string; end: string };
}

export const useSDRActivityBreakdown = (options?: SDRActivityOptions) => {
  const dateRange = options?.dateRange;

  return useQuery({
    queryKey: ['sdr-activity-breakdown', dateRange?.start, dateRange?.end],
    staleTime: 30_000,
    queryFn: async (): Promise<SDRActivityBreakdownRow[]> => {
      // 1) Get all SDR profiles
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'sdr');
      const userIds = (roleData || []).map(r => r.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('active', true)
        .in('id', userIds);
      const profileMap: Record<string, string> = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p.name; });

      // 2) Get leads owned by these SDRs
      const { data: leads } = await supabase
        .from('leads')
        .select('id, owner_user_id')
        .in('owner_user_id', userIds)
        .limit(5000);
      if (!leads || leads.length === 0) return [];

      // Build maps
      const sdrLeadIds: Record<string, Set<string>> = {};
      leads.forEach(l => {
        const sId = l.owner_user_id || '';
        if (!sdrLeadIds[sId]) sdrLeadIds[sId] = new Set();
        sdrLeadIds[sId].add(l.id);
      });

      const allLeadIds = leads.map(l => l.id).slice(0, 500);
      if (allLeadIds.length === 0) return [];

      // 3) Get activities (lead_notes) for all leads
      let notesQ = supabase.from('lead_notes').select('id, lead_id').in('lead_id', allLeadIds);
      if (dateRange) {
        notesQ = notesQ.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
      }
      const { data: notes } = await notesQ.limit(5000);

      // Map lead_id -> sdr_id
      const leadToSdr: Record<string, string> = {};
      Object.entries(sdrLeadIds).forEach(([sId, leadSet]) => {
        leadSet.forEach(lId => { if (!leadToSdr[lId]) leadToSdr[lId] = sId; });
      });

      const sdrActivities: Record<string, number> = {};
      const sdrLeadsWorked: Record<string, Set<string>> = {};
      (notes || []).forEach(n => {
        const sId = leadToSdr[n.lead_id];
        if (sId) {
          sdrActivities[sId] = (sdrActivities[sId] || 0) + 1;
          if (!sdrLeadsWorked[sId]) sdrLeadsWorked[sId] = new Set();
          sdrLeadsWorked[sId].add(n.lead_id);
        }
      });

      // 4) Get meetings: opportunities where sdr_user_id matches
      let meetQ = supabase.from('opportunities')
        .select('id, sdr_user_id, meeting_datetime')
        .in('sdr_user_id', userIds)
        .not('meeting_datetime', 'is', null);
      if (dateRange) {
        meetQ = meetQ.gte('meeting_datetime', dateRange.start).lte('meeting_datetime', dateRange.end);
      }
      const { data: meetings } = await meetQ.limit(5000);

      const sdrMeetings: Record<string, number> = {};
      (meetings || []).forEach(m => {
        const sId = m.sdr_user_id || '';
        sdrMeetings[sId] = (sdrMeetings[sId] || 0) + 1;
      });

      // 5) Get proposals: via opportunities linked to SDR
      const { data: sdrOpps } = await supabase
        .from('opportunities')
        .select('id, sdr_user_id')
        .in('sdr_user_id', userIds)
        .limit(5000);

      const oppToSdr: Record<string, string> = {};
      (sdrOpps || []).forEach(o => { oppToSdr[o.id] = o.sdr_user_id || ''; });

      const sdrProposals: Record<string, number> = {};
      const oppIds = (sdrOpps || []).map(o => o.id).slice(0, 500);
      if (oppIds.length > 0) {
        let propQ = supabase.from('proposals').select('id, opportunity_id').in('opportunity_id', oppIds);
        if (dateRange) {
          propQ = propQ.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
        }
        const { data: proposals } = await propQ.limit(5000);

        (proposals || []).forEach(p => {
          const sId = oppToSdr[p.opportunity_id || ''];
          if (sId) sdrProposals[sId] = (sdrProposals[sId] || 0) + 1;
        });
      }

      // Build rows
      return Object.keys(profileMap)
        .map(sId => ({
          id: sId,
          name: profileMap[sId],
          leadsWorked: sdrLeadsWorked[sId]?.size || 0,
          activities: sdrActivities[sId] || 0,
          meetings: sdrMeetings[sId] || 0,
          proposals: sdrProposals[sId] || 0,
        }))
        .filter(r => r.activities > 0 || r.meetings > 0 || r.proposals > 0)
        .sort((a, b) => b.activities - a.activities);
    },
  });
};
