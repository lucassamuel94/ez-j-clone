import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WinLossInsight {
  summary: string;
  win_patterns: Array<{ pattern: string; confidence: string; detail: string }>;
  loss_patterns: Array<{ pattern: string; confidence: string; detail: string }>;
  segment_insights: Array<{ segment: string; win_rate: number; avg_deal_value: number; recommendation: string }>;
  recommendations: string[];
  risk_factors: string[];
}

export function useWinLossData(dateRange?: { from: string; to: string }) {
  return useQuery({
    queryKey: ['win-loss-data', dateRange],
    queryFn: async () => {
      let wonQuery = supabase
        .from('opportunities')
        .select('id, deal_value, created_at, won_at, updated_at, opportunity_type, leads!inner(company_segment, porte, cnae_fiscal_descricao)')
        .eq('stage', 'Ganho');

      let lostQuery = supabase
        .from('opportunities')
        .select('id, deal_value, created_at, updated_at, lost_reason, opportunity_type, leads!inner(company_segment, porte, cnae_fiscal_descricao)')
        .eq('stage', 'Perdido');

      if (dateRange?.from) { wonQuery = wonQuery.gte('updated_at', dateRange.from); lostQuery = lostQuery.gte('updated_at', dateRange.from); }
      if (dateRange?.to) { wonQuery = wonQuery.lte('updated_at', dateRange.to); lostQuery = lostQuery.lte('updated_at', dateRange.to); }

      const [wonResult, lostResult] = await Promise.all([wonQuery, lostQuery]);
      if (wonResult.error) throw wonResult.error;
      if (lostResult.error) throw lostResult.error;

      const wonDeals = (wonResult.data || []).map((d: any) => ({
        deal_value: Number(d.deal_value) || 0,
        days_to_close: Math.floor((new Date(d.won_at || d.updated_at).getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24)),
        company_segment: d.leads?.company_segment || d.leads?.cnae_fiscal_descricao || 'N/A',
        porte: d.leads?.porte || 'N/A',
        opportunity_type: d.opportunity_type || 'new_business',
      }));

      const lostDeals = (lostResult.data || []).map((d: any) => ({
        deal_value: Number(d.deal_value) || 0,
        days_to_close: Math.floor((new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24)),
        lost_reason: d.lost_reason || 'Não informado',
        company_segment: d.leads?.company_segment || d.leads?.cnae_fiscal_descricao || 'N/A',
        porte: d.leads?.porte || 'N/A',
      }));

      const total = wonDeals.length + lostDeals.length;
      return {
        wonDeals, lostDeals,
        winRate: total > 0 ? Math.round((wonDeals.length / total) * 100) : 0,
        totalWon: wonDeals.length, totalLost: lostDeals.length,
        avgWonValue: wonDeals.length > 0 ? wonDeals.reduce((s: number, d: any) => s + d.deal_value, 0) / wonDeals.length : 0,
        avgDaysToClose: wonDeals.length > 0 ? Math.round(wonDeals.reduce((s: number, d: any) => s + d.days_to_close, 0) / wonDeals.length) : 0,
      };
    },
    staleTime: 60000,
  });
}

export function useWinLossAIAnalysis() {
  return useMutation({
    mutationFn: async ({ wonDeals, lostDeals }: { wonDeals: any[]; lostDeals: any[] }) => {
      const { data, error } = await supabase.functions.invoke('analyze-win-loss', {
        body: { wonDeals: wonDeals.slice(0, 50), lostDeals: lostDeals.slice(0, 50) },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data.analysis as WinLossInsight;
    },
    onError: (err: Error) => {
      toast.error('Erro na análise: ' + err.message);
    },
  });
}
