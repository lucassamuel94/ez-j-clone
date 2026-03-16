import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SDRCallQualityRow {
  id: string;
  name: string;
  totalAnalyses: number;
  avgScore: number;
  connectionRate: number;
  topObjection: string | null;
  earlyPitchRate: number;
}

interface UseSDRCallQualityParams {
  dateRange: { start: string; end: string };
}

export const useSDRCallQuality = ({ dateRange }: UseSDRCallQualityParams) => {
  return useQuery({
    queryKey: ['sdr-call-quality', dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('call_analyses')
        .select('sdr_user_id, call_score, connection_effective, objections, early_pitch')
        .eq('status', 'completed')
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end) as any);

      if (error) throw error;
      const rows = (data || []) as Array<{
        sdr_user_id: string;
        call_score: number | null;
        connection_effective: boolean | null;
        objections: string[] | null;
        early_pitch: boolean | null;
      }>;

      if (rows.length === 0) return [] as SDRCallQualityRow[];

      // Group by sdr_user_id
      const grouped = new Map<string, typeof rows>();
      for (const r of rows) {
        const list = grouped.get(r.sdr_user_id) || [];
        list.push(r);
        grouped.set(r.sdr_user_id, list);
      }

      // Fetch profile names
      const sdrIds = [...grouped.keys()];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', sdrIds);

      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));

      const result: SDRCallQualityRow[] = [];
      for (const [sdrId, items] of grouped) {
        const total = items.length;
        const scoreSum = items.reduce((s, i) => s + (i.call_score ?? 0), 0);
        const connections = items.filter(i => i.connection_effective === true).length;
        const earlyPitches = items.filter(i => i.early_pitch === true).length;

        // Find top objection (mode)
        const objCount = new Map<string, number>();
        for (const i of items) {
          const objs = Array.isArray(i.objections) ? i.objections : [];
          for (const o of objs) {
            if (typeof o === 'string' && o.trim()) {
              objCount.set(o, (objCount.get(o) || 0) + 1);
            }
          }
        }
        let topObjection: string | null = null;
        let topCount = 0;
        for (const [obj, count] of objCount) {
          if (count > topCount) { topCount = count; topObjection = obj; }
        }

        result.push({
          id: sdrId,
          name: profileMap[sdrId] || 'Desconhecido',
          totalAnalyses: total,
          avgScore: Math.round((scoreSum / total) * 10) / 10,
          connectionRate: Math.round((connections / total) * 100),
          topObjection,
          earlyPitchRate: Math.round((earlyPitches / total) * 100),
        });
      }

      return result.sort((a, b) => b.totalAnalyses - a.totalAnalyses);
    },
  });
};
