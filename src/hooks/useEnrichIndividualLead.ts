import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EnrichLeadParams {
  leadId: string;
  enrich_brasilapi: boolean;
  enrich_perplexity: boolean;
}

export const useEnrichIndividualLead = () => {
  return useMutation({
    mutationFn: async (params: EnrichLeadParams) => {
      const { data, error } = await supabase.functions.invoke(
        'enrich-individual-lead',
        {
          body: params,
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Lead enriquecido com sucesso');
    },
    onError: (error: any) => {
      const message =
        error.message || 'Erro ao enriquecer lead';
      toast.error(message);
    },
  });
};
