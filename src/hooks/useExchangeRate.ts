import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ExchangeRate {
  rate: number;
  high: number;
  low: number;
  timestamp: string;
  source: string;
}

export const useExchangeRate = () => {
  return useQuery<ExchangeRate>({
    queryKey: ['exchange-rate-usd-brl'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-exchange-rate');
      if (error) throw error;
      if (data?.error) {
        // fallback
        return { rate: data.fallbackRate ?? 5.70, high: 0, low: 0, timestamp: '', source: 'fallback' };
      }
      return data as ExchangeRate;
    },
    staleTime: 1000 * 60 * 60, // 1 hour cache
    gcTime: 1000 * 60 * 60 * 4,
    retry: 2,
  });
};
