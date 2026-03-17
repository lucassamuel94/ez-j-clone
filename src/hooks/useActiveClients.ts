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

/** Map accounts row → ActiveClient shape (preserves interface for downstream consumers) */
function mapAccountToActiveClient(row: any): ActiveClient {
  return {
    id: row.id,
    company: row.company_name,
    cnpj: row.cnpj,
    contact_name: row.contact_name,
    email: row.email,
    phone: row.phone,
    segment: row.company_segment,
    razao_social: row.razao_social,
    nome_fantasia: row.nome_fantasia,
    cnae_fiscal: row.cnae_fiscal,
    cnae_fiscal_descricao: row.cnae_fiscal_descricao,
    cnaes_secundarios: row.cnaes_secundarios,
    porte: row.porte,
    employee_count: row.employee_count,
    revenue_range: row.revenue_range,
    capital_social: row.capital_social,
    city: row.city,
    state: row.state,
    cep: row.cep,
    website: row.website,
    situacao_cadastral: row.situacao_cadastral,
    data_inicio_atividade: row.data_inicio_atividade,
    ai_enrichment_data: row.ai_enrichment_data,
    enriched_at: row.enriched_at,
    imported_by: row.imported_by,
    notes: row.notes,
    created_at: row.created_at,
    account_owner_id: row.account_owner_id,
    account_owner_name: row.account_owner?.name || null,
    status: row.status || row.lifecycle_stage || 'active',
  };
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
          .from('accounts')
          .select('*, account_owner:profiles!accounts_account_owner_id_profiles_fkey(name)')
          .eq('lifecycle_stage', 'client')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (search && search.trim()) {
          q = q.or(`company_name.ilike.%${search}%,cnpj.ilike.%${search}%,contact_name.ilike.%${search}%,city.ilike.%${search}%`);
        }

        const { data, error } = await q;
        if (error) throw error;

        const rows = data || [];
        allData = [...allData, ...rows];
        hasMore = rows.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      return allData.map(mapAccountToActiveClient);
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
          .from('accounts')
          .select('cnpj')
          .eq('lifecycle_stage', 'client')
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
          // Map ActiveClient fields → accounts columns
          const rows = chunk.map(c => ({
            company_name: c.company || 'Sem nome',
            cnpj: c.cnpj,
            razao_social: c.razao_social,
            nome_fantasia: c.nome_fantasia,
            company_segment: c.segment,
            cnae_fiscal: c.cnae_fiscal,
            cnae_fiscal_descricao: c.cnae_fiscal_descricao,
            cnaes_secundarios: c.cnaes_secundarios,
            porte: c.porte,
            employee_count: c.employee_count,
            revenue_range: c.revenue_range,
            capital_social: c.capital_social,
            city: c.city,
            state: c.state,
            cep: c.cep,
            website: c.website,
            situacao_cadastral: c.situacao_cadastral,
            data_inicio_atividade: c.data_inicio_atividade,
            contact_name: c.contact_name,
            email: c.email,
            phone: c.phone,
            notes: c.notes,
            lifecycle_stage: 'client',
            status: 'active',
          }));

          const { error } = await supabase.from('accounts').insert(rows);
          if (error) {
            if (error.code === '23505') {
              // Unique violation — insert one-by-one to skip duplicates
              for (const item of rows) {
                const { error: singleErr } = await supabase.from('accounts').insert(item);
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
      const { error } = await supabase.from('accounts').delete().eq('id', id);
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
          .from('accounts')
          .update({ account_owner_id: ownerId })
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
