import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DealRisk {
  opportunity_id: string;
  company_name: string;
  stage: string;
  deal_value: number;
  days_in_stage: number;
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  risk_reason: string;
  suggested_actions: string[];
  probability_estimate: number;
  recommended_next_step: string;
}

const STAGE_THRESHOLDS: Record<string, number> = {
  'Demonstração': 7, 'Apresentar proposta': 5, 'Proposta enviada': 10,
  'Negociação': 14, 'Opp Quente': 21, 'Opp Futura': 30, 'Opp Fria': 45,
  'Contrato': 7, 'Pagamento': 10,
};

export function useDealsAtRisk() {
  const stuckDeals = useQuery({
    queryKey: ['deals-at-risk'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select('id, lead_id, stage, deal_value, created_at, updated_at, active_objection, expected_close_date, closer_notes, assigned_to_user_id')
        .not('stage', 'in', '(Ganho,Perdido)');

      if (error) throw error;

      // Fetch lead names separately
      const leadIds = [...new Set((data || []).map((o: any) => o.lead_id).filter(Boolean))];
      const { data: leads } = leadIds.length > 0
        ? await supabase.from('leads').select('id, name, company, razao_social, nome_fantasia').in('id', leadIds)
        : { data: [] };
      const leadMap = new Map((leads || []).map((l: any) => [l.id, l]));

      const now = new Date();
      return (data || [])
        .map((opp: any) => {
          const lastUpdate = new Date(opp.updated_at);
          const daysInStage = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
          const threshold = STAGE_THRESHOLDS[opp.stage] || 14;
          const lead = leadMap.get(opp.lead_id);
          return {
            opportunity_id: opp.id,
            company_name: lead?.razao_social || lead?.nome_fantasia || lead?.company || lead?.name || '',
            stage: opp.stage,
            deal_value: Number(opp.deal_value) || 0,
            days_in_stage: daysInStage,
            threshold,
            active_objection: opp.active_objection,
            closer_notes: opp.closer_notes,
            expected_close_date: opp.expected_close_date,
            is_stuck: daysInStage >= threshold,
          };
        })
        .filter((d: any) => d.is_stuck)
        .sort((a: any, b: any) => b.days_in_stage - a.days_in_stage);
    },
    staleTime: 30000,
  });

  const analyzeRisks = useMutation({
    mutationFn: async (deals: any[]) => {
      const { data, error } = await supabase.functions.invoke('analyze-deal-risk', {
        body: { deals: deals.slice(0, 10) },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data.analysis as DealRisk[];
    },
    onError: (err: Error) => {
      toast.error('Erro ao analisar riscos: ' + err.message);
    },
  });

  return {
    stuckDeals: stuckDeals.data || [],
    isLoading: stuckDeals.isLoading,
    analyzeRisks,
    aiAnalysis: analyzeRisks.data || [],
    isAnalyzing: analyzeRisks.isPending,
  };
}
