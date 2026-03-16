import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PipelineStatus {
  id: string;
  pipeline: 'sdr' | 'closer' | 'api_oficial' | 'evolution';
  status_name: string;
  sort_order: number;
  is_system: boolean;
  color: string | null;
  created_at: string;
}

const QUERY_KEY = ['pipeline-statuses'];

const SDR_FALLBACK = [
  'Novo', 'Em contato', 'Não atendeu', 'Ocupado', 'Agendar retorno',
  'Sem retorno', 'Reagendar Reunião', 'Interesse', 'Interesse/Agendar Retorno',
  'Reunião agendada', 'Reciclagem', 'Devolvido pelo Closer',
  'Oportunidade criada', 'Descartado',
];

const CLOSER_FALLBACK = [
  'Demonstração', 'Proposta enviada', 'Oportunidade quente',
  'Oportunidade Futura', 'Oportunidade fria', 'Contrato enviado',
  'Aguardando pagamento', 'Ganho', 'Perdido',
];

const API_OFICIAL_FALLBACK = [
  'Acionar', 'Em contato', 'Reunião agendada',
  'Aguardando retorno', 'Não quer agora', 'Enviar Pós Venda',
];

const EVOLUTION_FALLBACK = [
  'Proposta enviada', 'Negociação', 'Oportunidade Quente',
  'Oportunidade Futura', 'Oportunidade Fria', 'Contrato enviado',
  'Aguardando pagamento', 'Ganho', 'Perdido',
];

export function usePipelineStatuses() {
  const queryClient = useQueryClient();

  const { data: allStatuses = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_statuses' as any)
        .select('*')
        .order('pipeline')
        .order('sort_order');
      if (error) throw error;
      return (data || []) as unknown as PipelineStatus[];
    },
    staleTime: 5 * 60 * 1000,
  });

  function getStatusesForPipeline(pipeline: 'sdr' | 'closer' | 'api_oficial' | 'evolution'): string[] {
    const fromDb = allStatuses
      .filter((s) => s.pipeline === pipeline)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => s.status_name);
    if (fromDb.length > 0) return fromDb;
    if (pipeline === 'sdr') return SDR_FALLBACK;
    if (pipeline === 'api_oficial') return API_OFICIAL_FALLBACK;
    if (pipeline === 'evolution') return EVOLUTION_FALLBACK;
    return CLOSER_FALLBACK;
  }

  /** Returns a map of status_name -> color hex for a pipeline */
  function getColorMap(pipeline: 'sdr' | 'closer' | 'api_oficial' | 'evolution'): Record<string, string> {
    const map: Record<string, string> = {};
    allStatuses
      .filter((s) => s.pipeline === pipeline && s.color)
      .forEach((s) => { map[s.status_name] = s.color!; });
    return map;
  }

  function getStatusObjectsForPipeline(pipeline: 'sdr' | 'closer' | 'api_oficial' | 'evolution'): PipelineStatus[] {
    return allStatuses
      .filter((s) => s.pipeline === pipeline)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  const addStatus = useMutation({
    mutationFn: async (params: { pipeline: string; status_name: string; sort_order: number; color?: string }) => {
      const { error } = await supabase
        .from('pipeline_statuses' as any)
        .insert(params as any);
      if (error) throw error;
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<PipelineStatus[]>(QUERY_KEY);
      const optimistic: PipelineStatus = {
        id: `temp-${Date.now()}`,
        pipeline: params.pipeline as PipelineStatus['pipeline'],
        status_name: params.status_name,
        sort_order: params.sort_order,
        is_system: false,
        color: params.color || null,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<PipelineStatus[]>(QUERY_KEY, (old = []) => [...old, optimistic]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const updateStatus = useMutation({
    mutationFn: async (params: { id: string; status_name?: string; sort_order?: number; color?: string }) => {
      const { id, ...updates } = params;
      const { error } = await supabase
        .from('pipeline_statuses' as any)
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<PipelineStatus[]>(QUERY_KEY);
      queryClient.setQueryData<PipelineStatus[]>(QUERY_KEY, (old = []) =>
        old.map(s => s.id === params.id ? { ...s, ...params } : s)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const deleteStatus = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pipeline_statuses' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<PipelineStatus[]>(QUERY_KEY);
      queryClient.setQueryData<PipelineStatus[]>(QUERY_KEY, (old = []) =>
        old.filter(s => s.id !== id)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    allStatuses,
    isLoading,
    getStatusesForPipeline,
    getStatusObjectsForPipeline,
    getColorMap,
    addStatus,
    updateStatus,
    deleteStatus,
  };
}
