import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CnpjaResult {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  porte: string;
  capital_social: number | null;
  situacao_cadastral: string;
  cnae_fiscal: number | null;
  cnae_fiscal_descricao: string;
  cnaes_secundarios?: string;
  data_inicio_atividade: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  city: string;
  state: string;
  cep: string;
  phone: string;
  phone_2: string;
  email: string;
  website: string;
}

export const useCnpjaSearch = () => {
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<CnpjaResult[]>([]);
  const cacheRef = useRef<Map<string, CnpjaResult[]>>(new Map());
  const pendingRef = useRef(false);

  const searchByName = useCallback(async (name: string, limit = 10): Promise<CnpjaResult[]> => {
    if (!name || name.trim().length < 3) {
      toast.error('Digite pelo menos 3 caracteres para buscar');
      return [];
    }

    const cacheKey = `name:${name.trim().toLowerCase()}:${limit}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setResults(cached);
      if (cached.length === 0) toast.info('Nenhuma empresa encontrada com esse nome');
      return cached;
    }

    if (pendingRef.current) return [];
    pendingRef.current = true;
    setIsSearching(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('cnpja-search', {
        body: { name: name.trim(), limit },
      });

      if (error) throw error;

      if (!data?.success) {
        toast.error(data?.error || 'Erro na busca CNPJá');
        return [];
      }

      const items: CnpjaResult[] = data.results || [];
      cacheRef.current.set(cacheKey, items);
      setResults(items);

      if (items.length === 0) {
        toast.info('Nenhuma empresa encontrada com esse nome');
      }

      return items;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao buscar empresa por nome';
      console.error('CNPJá search error:', error);
      toast.error(msg);
      return [];
    } finally {
      setIsSearching(false);
      pendingRef.current = false;
    }
  }, []);

  const searchByCnpj = useCallback(async (cnpj: string): Promise<CnpjaResult[]> => {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) {
      toast.error('CNPJ deve ter 14 dígitos');
      return [];
    }

    const cacheKey = `cnpj:${clean}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setResults(cached);
      if (cached.length === 0) toast.info('Nenhuma empresa encontrada com esse CNPJ');
      return cached;
    }

    if (pendingRef.current) return [];
    pendingRef.current = true;
    setIsSearching(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('cnpja-search', {
        body: { cnpj: clean },
      });

      if (error) throw error;

      if (!data?.success) {
        toast.error(data?.error || 'Erro na busca CNPJá');
        return [];
      }

      const items: CnpjaResult[] = data.results || [];
      cacheRef.current.set(cacheKey, items);
      setResults(items);

      if (items.length === 0) {
        toast.info('Nenhuma empresa encontrada com esse CNPJ');
      }

      return items;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao buscar empresa por CNPJ';
      console.error('CNPJá CNPJ search error:', error);
      toast.error(msg);
      return [];
    } finally {
      setIsSearching(false);
      pendingRef.current = false;
    }
  }, []);

  const clearResults = useCallback(() => setResults([]), []);
  const clearCache = useCallback(() => cacheRef.current.clear(), []);

  return { searchByName, searchByCnpj, isSearching, results, clearResults, clearCache };
};
