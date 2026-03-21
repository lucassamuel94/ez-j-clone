import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ClientHealth {
  client_id: string;
  client_name: string;
  health_score: number;
  status: 'healthy' | 'attention' | 'at_risk' | 'critical';
  churn_risk: 'low' | 'medium' | 'high';
  upsell_readiness: 'ready' | 'not_ready' | 'nurturing';
  key_signals: string[];
  recommended_action: string;
  days_as_client: number;
}

export function useCustomerHealth() {
  const clientsData = useQuery({
    queryKey: ['customer-health-data'],
    queryFn: async () => {
      const { data: clients, error } = await supabase
        .from('active_clients')
        .select('id, cnpj, razao_social, nome_fantasia, created_at, opportunity_id') as any;

      if (error) throw error;
      if (!clients || clients.length === 0) return [];

      const oppIds = clients.map(c => c.opportunity_id).filter(Boolean);
      const [{ data: projects }, { data: opps }] = await Promise.all([
        oppIds.length > 0
          ? supabase.from('projects').select('id, opportunity_id, status, current_phase').in('opportunity_id', oppIds)
          : Promise.resolve({ data: [] }),
        oppIds.length > 0
          ? supabase.from('opportunities').select('id, deal_value').in('id', oppIds)
          : Promise.resolve({ data: [] }),
      ]);

      const projectMap = new Map((projects || []).map((p: any) => [p.opportunity_id, p]));
      const oppMap = new Map((opps || []).map((o: any) => [o.id, o]));
      const now = new Date();

      return clients.map(c => {
        const project = projectMap.get(c.opportunity_id);
        const opp = oppMap.get(c.opportunity_id);
        return {
          id: c.id,
          client_name: c.razao_social || c.nome_fantasia || c.cnpj || 'Cliente',
          cnpj: c.cnpj,
          days_as_client: Math.floor((now.getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)),
          project_status: project?.status || 'unknown',
          current_phase: project?.current_phase || null,
          has_blocked_project: project?.status === 'blocked',
          opportunity_value: Number(opp?.deal_value) || 0,
        };
      });
    },
    staleTime: 60000,
  });

  const analyzeHealth = useMutation({
    mutationFn: async (clients: any[]) => {
      const { data, error } = await supabase.functions.invoke('calculate-health-score', {
        body: { clients: clients.slice(0, 20) },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data.healthScores as ClientHealth[];
    },
    onError: (err: Error) => {
      toast.error('Erro ao analisar saúde: ' + err.message);
    },
  });

  return {
    clients: clientsData.data || [],
    isLoading: clientsData.isLoading,
    analyzeHealth,
    healthScores: analyzeHealth.data || [],
    isAnalyzing: analyzeHealth.isPending,
  };
}
