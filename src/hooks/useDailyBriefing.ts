import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DailyBriefing {
  greeting: string;
  priorities: string[];
  alerts: string[];
  tip: string;
  score: number;
}

const CACHE_KEY = 'ez_daily_briefing';

function getCachedBriefing(): DailyBriefing | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const { date, briefing } = JSON.parse(cached);
    if (date === new Date().toISOString().split('T')[0]) return briefing;
    return null;
  } catch { return null; }
}

function setCachedBriefing(briefing: DailyBriefing) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      date: new Date().toISOString().split('T')[0],
      briefing,
    }));
  } catch { /* ignore */ }
}

export function useDailyBriefing() {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  useEffect(() => {
    const cached = getCachedBriefing();
    if (cached) {
      setBriefing(cached);
      setIsFromCache(true);
    }
  }, []);

  const generate = useMutation({
    mutationFn: async ({ role, stats }: { role: string; stats: Record<string, number> }) => {
      const { data, error } = await supabase.functions.invoke('generate-daily-briefing', {
        body: { role, stats },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data.briefing as DailyBriefing;
    },
    onSuccess: (data) => {
      setBriefing(data);
      setIsFromCache(false);
      setCachedBriefing(data);
    },
    onError: (err: Error) => {
      toast.error('Erro ao gerar briefing: ' + err.message);
    },
  });

  return { briefing, generate, isLoading: generate.isPending, isFromCache };
}
