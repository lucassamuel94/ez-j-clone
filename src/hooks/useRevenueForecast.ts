import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const STAGE_PROBABILITIES: Record<string, number> = {
  'Demonstração': 0.10, 'Apresentar proposta': 0.20, 'Proposta enviada': 0.35,
  'Negociação': 0.50, 'Opp Quente': 0.65, 'Opp Futura': 0.30, 'Opp Fria': 0.10,
  'Contrato': 0.80, 'Pagamento': 0.90,
};

export interface StageForecast {
  stage: string;
  count: number;
  totalValue: number;
  weightedValue: number;
  probability: number;
}

export interface ForecastData {
  stages: StageForecast[];
  scenarios: { label: string; value: number; multiplier: number }[];
  totalPipeline: number;
  weightedTotal: number;
  monthlyProjection: { month: string; conservative: number; realistic: number; optimistic: number }[];
  historicalMonthlyAvg: number;
  activeDeals: number;
}

export function useRevenueForecast() {
  return useQuery({
    queryKey: ['revenue-forecast'],
    queryFn: async () => {
      const { data: opps, error } = await supabase
        .from('opportunities')
        .select('id, stage, deal_value, created_at, updated_at, expected_close_date, opportunity_type')
        .not('stage', 'in', '(Ganho,Perdido)');

      if (error) throw error;

      const stageMap = new Map<string, { count: number; totalValue: number }>();
      for (const opp of (opps || [])) {
        const val = Number(opp.deal_value) || 0;
        const existing = stageMap.get(opp.stage) || { count: 0, totalValue: 0 };
        stageMap.set(opp.stage, { count: existing.count + 1, totalValue: existing.totalValue + val });
      }

      const stages: StageForecast[] = Array.from(stageMap.entries()).map(([stage, data]) => {
        const probability = STAGE_PROBABILITIES[stage] || 0.15;
        return { stage, count: data.count, totalValue: data.totalValue, weightedValue: data.totalValue * probability, probability };
      }).sort((a, b) => b.weightedValue - a.weightedValue);

      const totalPipeline = stages.reduce((s, st) => s + st.totalValue, 0);
      const weightedTotal = stages.reduce((s, st) => s + st.weightedValue, 0);

      const scenarios = [
        { label: 'Conservador', value: weightedTotal * 0.7, multiplier: 0.7 },
        { label: 'Realista', value: weightedTotal, multiplier: 1.0 },
        { label: 'Otimista', value: weightedTotal * 1.3, multiplier: 1.3 },
      ];

      const now = new Date();
      const monthlyProjection = Array.from({ length: 3 }, (_, i) => {
        const month = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const decay = 1 - (i * 0.15);
        return {
          month: month.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          conservative: Math.round(weightedTotal * 0.7 * decay / 3),
          realistic: Math.round(weightedTotal * decay / 3),
          optimistic: Math.round(weightedTotal * 1.3 * decay / 3),
        };
      });

      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
      const { data: wonDeals } = await supabase
        .from('opportunities').select('deal_value, won_at').eq('stage', 'Ganho').gte('won_at', threeMonthsAgo);

      const historicalMonthlyAvg = (wonDeals || []).reduce((acc: number, d: any) => acc + (Number(d.deal_value) || 0), 0) / 3;

      return { stages, scenarios, totalPipeline, weightedTotal, monthlyProjection, historicalMonthlyAvg, activeDeals: (opps || []).length } as ForecastData;
    },
    staleTime: 60000,
  });
}
