import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ICPAnalysis {
  id: string;
  created_by: string | null;
  filters: unknown;
  statistics: unknown;
  ai_analysis: string | null;
  clients_analyzed: number;
  created_at: string;
}

export const useICPAnalysis = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['icp_analyses'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('icp_analyses')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ICPAnalysis[];
    },
    staleTime: 5 * 60_000,
  });

  const generateAnalysis = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('analyze-client-profile');
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao gerar análise');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icp_analyses'] });
      toast.success('Análise de perfil gerada com sucesso');
    },
    onError: (err: Error) => {
      toast.error('Erro ao gerar análise: ' + (err.message || 'Erro desconhecido'));
    },
  });

  return { ...query, generateAnalysis };
};
