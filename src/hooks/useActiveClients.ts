import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ActiveClient {
  id: string;
  company: string;
  cnpj: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  segment: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnae_fiscal: number | null;
  cnae_fiscal_descricao: string | null;
  cnaes_secundarios: string | null;
  porte: string | null;
  employee_count: string | null;
  revenue_range: string | null;
  capital_social: number | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  website: string | null;
  situacao_cadastral: string | null;
  data_inicio_atividade: string | null;
  ai_enrichment_data: any;
  enriched_at: string | null;
  imported_by: string | null;
  notes: string | null;
  created_at: string;
  account_owner_id: string | null;
  account_owner_name: string | null;
  status: string;
}

export const useActiveClients = (search?: string) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['active_clients', search],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let q = supabase
          .from('active_clients' as any)
          .select('*, account_owner:profiles!active_clients_account_owner_id_fkey(name)')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (search && search.trim()) {
          q = q.or(`company.ilike.%${search}%,cnpj.ilike.%${search}%,contact_name.ilike.%${search}%,city.ilike.%${search}%`);
        }

        const { data, error } = await q;
        if (error) throw error;

        const rows = data || [];
        allData = [...allData, ...rows];
        hasMore = rows.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      return allData.map((row: any) => ({
        ...row,
        account_owner_name: row.account_owner?.name || null,
        account_owner: undefined,
      })) as unknown as ActiveClient[];
    },
  });

  const importClients = useMutation({
    mutationFn: async (clients: Partial<ActiveClient>[]) => {
      const seen = new Set<string>();
      const unique: Partial<ActiveClient>[] = [];
      for (const c of clients) {
        const key = c.cnpj?.replace(/\D/g, '') || '';
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        unique.push(c);
      }

      const cnpjs = unique.map(c => c.cnpj?.replace(/\D/g, '') || '').filter(Boolean);
      let existingCnpjs = new Set<string>();
      if (cnpjs.length > 0) {
        const { data: existing } = await supabase
          .from('active_clients' as any)
          .select('cnpj')
          .in('cnpj', cnpjs);
        existingCnpjs = new Set((existing || []).map((e: any) => e.cnpj?.replace(/\D/g, '') || ''));
      }

      const toInsert = unique.filter(c => {
        const clean = c.cnpj?.replace(/\D/g, '') || '';
        return !clean || !existingCnpjs.has(clean);
      });

      const duplicates = unique.length - toInsert.length;

      let dbDuplicates = 0;
      if (toInsert.length > 0) {
        for (let i = 0; i < toInsert.length; i += 100) {
          const chunk = toInsert.slice(i, i + 100);
          const { error } = await supabase.from('active_clients' as any).insert(chunk as any);
          if (error) {
            if (error.code === '23505') {
              // Unique violation — insert one-by-one to skip duplicates
              for (const item of chunk) {
                const { error: singleErr } = await supabase.from('active_clients' as any).insert(item as any);
                if (singleErr && singleErr.code === '23505') {
                  dbDuplicates++;
                } else if (singleErr) {
                  throw singleErr;
                }
              }
            } else {
              throw error;
            }
          }
        }
      }

      return { imported: toInsert.length - dbDuplicates, duplicates: duplicates + dbDuplicates };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['active_clients'] });
      toast.success(`${result.imported} clientes importados${result.duplicates > 0 ? ` (${result.duplicates} duplicados ignorados)` : ''}`);
    },
    onError: (err: any) => {
      toast.error('Erro ao importar: ' + (err.message || 'Erro desconhecido'));
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('active_clients' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active_clients'] });
      toast.success('Cliente removido');
    },
  });

  const updateOwner = useMutation({
    mutationFn: async ({ clientIds, ownerId }: { clientIds: string[]; ownerId: string | null }) => {
      for (const id of clientIds) {
        const { error } = await supabase
          .from('active_clients' as any)
          .update({ account_owner_id: ownerId } as any)
          .eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['active_clients'] });
      toast.success(`${variables.clientIds.length} cliente(s) atualizado(s)`);
    },
    onError: (err: any) => {
      toast.error('Erro ao atribuir closer: ' + (err.message || 'Erro desconhecido'));
    },
  });

  return { ...query, importClients, deleteClient, updateOwner, refetch: query.refetch };
};
