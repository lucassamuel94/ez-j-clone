import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EZCallRecord {
  linkedid: string;
  calldate: string;
  dst: string;
  extension: string;
  disposition: string;
  duration: number;
  billsec: number;
}

export interface EZCallSDRReport {
  userId: string;
  name: string;
  extension: string;
  totalCalls: number;
  answeredCalls: number;
  answerRate: number;
  avgTalkTime: number;
  calls: EZCallRecord[];
}

interface UseEZCallReportsParams {
  dateRange: { start: string; end: string };
  selectedSdrId?: string;
  enabled?: boolean;
}

export function useEZCallReports({ dateRange, selectedSdrId, enabled = true }: UseEZCallReportsParams) {
  return useQuery({
    queryKey: ['ezcall-reports', dateRange.start, dateRange.end, selectedSdrId],
    enabled,
    queryFn: async (): Promise<EZCallSDRReport[]> => {
      // 1. Get SDR users with ramal
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'sdr');

      const sdrIds = (roleData || []).map(r => r.user_id);
      if (sdrIds.length === 0) return [];

      let query = supabase
        .from('profiles')
        .select('id, name, ramal')
        .eq('active', true)
        .in('id', sdrIds)
        .not('ramal', 'is', null);

      if (selectedSdrId && selectedSdrId !== 'all') {
        query = query.eq('id', selectedSdrId);
      }

      const { data: profiles } = await query;
      const typedProfiles = (profiles || []) as unknown as Array<{ id: string; name: string; ramal: string | null }>;
      if (!typedProfiles.length) return [];

      const extensions = typedProfiles
        .filter(p => p.ramal?.trim())
        .map(p => ({
          userId: p.id,
          name: p.name || 'SDR',
          extension: p.ramal!.trim(),
        }));

      if (extensions.length === 0) return [];

      // 2. Call edge function
      const startDate = dateRange.start.split('T')[0];
      const endDate = dateRange.end.split('T')[0];

      const { data, error } = await supabase.functions.invoke('ezcall-reports', {
        body: { startDate, endDate, extensions },
      });

      if (error) throw error;
      return data?.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useEZCallRecordingUrl() {
  const playRecording = async (linkedid: string): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/ezcall-reports`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action: 'stream', linkedid }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Recording failed: ${errText}`);
    }

    const blob = await res.blob();
    return URL.createObjectURL(blob);
  };

  return { playRecording };
}
