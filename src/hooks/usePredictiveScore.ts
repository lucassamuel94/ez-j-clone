import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ScoreFactor {
  name: string;
  score: number;
  max: number;
  detail: string;
}

export interface PredictiveScore {
  total_score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  factors: ScoreFactor[];
  recommendation: string;
  conversion_probability: number;
  ideal_next_action: string;
}

export function usePredictiveScore() {
  const [score, setScore] = useState<PredictiveScore | null>(null);

  const generate = useMutation({
    mutationFn: async (lead: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('predict-lead-score', {
        body: { lead },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data.score as PredictiveScore;
    },
    onSuccess: (data) => setScore(data),
    onError: (err: Error) => toast.error('Erro ao calcular score: ' + err.message),
  });

  return { score, generate, isLoading: generate.isPending, clear: () => setScore(null) };
}
