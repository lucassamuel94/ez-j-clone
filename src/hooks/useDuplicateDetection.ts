import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DuplicateGroup {
  leads: Array<{
    id: string; name: string; company: string; email: string;
    phone: string; cnpj: string; razao_social: string; nome_fantasia: string;
    status: string; created_at: string; matchType?: string; confidence?: number;
  }>;
  matchType: string;
  confidence: number;
}

export interface DuplicateResult {
  duplicates: DuplicateGroup[];
  totalLeadsScanned: number;
  totalDuplicateGroups: number;
}

export function useDuplicateDetection() {
  const detect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('detect-duplicates', { body: {} });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as DuplicateResult;
    },
    onSuccess: (data) => {
      if (data.totalDuplicateGroups === 0) toast.success('Nenhum lead duplicado encontrado!');
      else toast.info(`${data.totalDuplicateGroups} grupo(s) de possíveis duplicatas`);
    },
    onError: (err: Error) => toast.error('Erro na detecção: ' + err.message),
  });

  return { detect, result: detect.data, isDetecting: detect.isPending };
}
