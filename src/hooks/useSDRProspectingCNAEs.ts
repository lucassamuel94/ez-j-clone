import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const ACTIVE_STATUSES = [
  'Novo', 'Em contato', 'Ocupado', 'Sem retorno',
  'Agendar retorno', 'Interesse', 'Interesse/Agendar Retorno',
  'Reunião agendada', 'Oportunidade criada', 'Devolvido pelo Closer',
] as const;

interface CNAECount {
  name: string;
  count: number;
}

async function fetchAllLeadsCNAE(ownerUserId: string | null, dateFrom?: string, dateTo?: string) {
  const PAGE_SIZE = 1000;
  let allRows: { cnae_fiscal_descricao: string | null; cnaes_secundarios: string | null }[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    let q = supabase
      .from('leads')
      .select('cnae_fiscal_descricao, cnaes_secundarios')
      .in('status', ACTIVE_STATUSES)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (ownerUserId) {
      q = q.eq('owner_user_id', ownerUserId);
    }
    if (dateFrom) {
      q = q.gte('created_at', dateFrom);
    }
    if (dateTo) {
      q = q.lte('created_at', dateTo + 'T23:59:59');
    }

    const { data, error } = await q;
    if (error) throw error;
    allRows = allRows.concat(data || []);
    hasMore = (data?.length || 0) === PAGE_SIZE;
    page++;
  }

  return allRows;
}

function aggregateCNAEs(rows: { cnae_fiscal_descricao: string | null; cnaes_secundarios: string | null }[]) {
  const cnaeMap = new Map<string, number>();
  const subCnaeMap = new Map<string, number>();
  let withCnae = 0;
  let withoutCnae = 0;

  for (const row of rows) {
    if (row.cnae_fiscal_descricao) {
      withCnae++;
      const key = row.cnae_fiscal_descricao.trim();
      if (key) cnaeMap.set(key, (cnaeMap.get(key) || 0) + 1);
    } else {
      withoutCnae++;
    }

    if (row.cnaes_secundarios) {
      // Try JSON array first, then comma/semicolon split
      let items: string[] = [];
      try {
        const parsed = JSON.parse(row.cnaes_secundarios);
        if (Array.isArray(parsed)) {
          items = parsed.map((p: any) => typeof p === 'string' ? p : p.descricao || p.text || String(p));
        }
      } catch {
        items = row.cnaes_secundarios.split(/[;,\n]/).map(s => s.trim()).filter(Boolean);
      }
      for (const item of items) {
        const clean = item.replace(/^\d+\s*-\s*/, '').trim();
        if (clean) subCnaeMap.set(clean, (subCnaeMap.get(clean) || 0) + 1);
      }
    }
  }

  const toSorted = (map: Map<string, number>, limit: number): CNAECount[] =>
    Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit || 20);

  return {
    total: rows.length,
    withCnae,
    withoutCnae,
    topCNAEs: toSorted(cnaeMap, 20),
    topSubCNAEs: toSorted(subCnaeMap, 20),
  };
}

async function fetchAllActiveClientsCNAE() {
  const PAGE_SIZE = 1000;
  let allRows: { cnae_fiscal_descricao: string | null; cnaes_secundarios: string | null }[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('active_clients')
      .select('cnae_fiscal_descricao, cnaes_secundarios')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) throw error;
    allRows = allRows.concat(data || []);
    hasMore = (data?.length || 0) === PAGE_SIZE;
    page++;
  }

  return allRows;
}

export function useSDRProspectingCNAEs(ownerUserId: string | null, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['sdr-prospecting-cnaes', ownerUserId, dateFrom, dateTo],
    queryFn: async () => {
      const [leadRows, clientRows] = await Promise.all([
        fetchAllLeadsCNAE(ownerUserId, dateFrom, dateTo),
        fetchAllActiveClientsCNAE(),
      ]);
      return {
        prospecting: aggregateCNAEs(leadRows),
        clients: aggregateCNAEs(clientRows),
      };
    },
  });
}
