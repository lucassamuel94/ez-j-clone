import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CallBriefing {
  contexto_empresa: string;
  historico_resumo: string;
  pontos_fortes: string[];
  objecoes_previstas: string[];
  estrategia_abertura: string;
  perguntas_chave: string[];
  nivel_prioridade: string;
  tempo_estimado: string;
}

export function useCallBriefing() {
  const [briefing, setBriefing] = useState<CallBriefing | null>(null);

  const generate = useMutation({
    mutationFn: async ({ lead, interactions, callHistory }: { lead: Record<string, unknown>; interactions?: Record<string, unknown>[]; callHistory?: Record<string, unknown>[] }) => {
      const { data, error } = await supabase.functions.invoke('generate-call-briefing', {
        body: { lead, interactions: interactions || [], callHistory: callHistory || [] },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data.briefing as CallBriefing;
    },
    onSuccess: (data) => {
      setBriefing(data);
    },
    onError: (err: Error) => {
      toast.error('Erro ao gerar briefing: ' + err.message);
    },
  });

  return { briefing, generate, isLoading: generate.isPending, clear: () => setBriefing(null) };
}
