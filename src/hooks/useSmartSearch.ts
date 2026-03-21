import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SmartSearchResult {
  results: {
    leads: any[];
    opportunities: any[];
    projects: any[];
    answer: string | null;
  };
  interpretation: { intent: string; search_terms: string[]; is_analytics: boolean };
  totalResults: number;
}

export function useSmartSearch() {
  const [lastQuery, setLastQuery] = useState('');

  const search = useMutation({
    mutationFn: async (query: string) => {
      const { data, error } = await supabase.functions.invoke('smart-search', { body: { query } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as SmartSearchResult;
    },
    onError: (err: Error) => toast.error('Erro na busca: ' + err.message),
  });

  const performSearch = useCallback((query: string) => {
    setLastQuery(query);
    search.mutate(query);
  }, [search]);

  return {
    search: performSearch,
    result: search.data,
    isSearching: search.isPending,
    lastQuery,
    clear: () => { search.reset(); setLastQuery(''); },
  };
}
