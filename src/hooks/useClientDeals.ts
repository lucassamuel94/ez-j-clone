import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClientDeal {
  id: string;
  stage: string;
  opportunity_type: string;
  deal_value: number | null;
  lead_id: string;
  lead_company: string;
  assigned_to_name: string | null;
}

export interface ClientApiOficialDeal {
  id: string;
  stage: string;
  lead_cnpj: string | null;
  lead_company: string | null;
  lead_name: string | null;
  lead_id: string;
  created_at: string;
  assigned_to_name: string | null;
}

interface ClientDealsResult {
  dealsMap: Map<string, ClientDeal[]>;
  apiOficialMap: Map<string, ClientApiOficialDeal[]>;
}

export const useClientDeals = (cnpjs: string[]) => {
  return useQuery({
    queryKey: ['client_deals', cnpjs.sort().join(',')],
    queryFn: async (): Promise<ClientDealsResult> => {
      const emptyResult: ClientDealsResult = { dealsMap: new Map(), apiOficialMap: new Map() };
      if (cnpjs.length === 0) return emptyResult;

      const cleanCnpjs = cnpjs.map(c => c.replace(/\D/g, '')).filter(Boolean);
      if (cleanCnpjs.length === 0) return emptyResult;

      // ── Opportunities via leads ──
      const { data: leads } = await supabase
        .from('leads')
        .select('id, cnpj')
        .in('cnpj', cleanCnpjs);

      const dealsMap = new Map<string, ClientDeal[]>();

      if (leads && leads.length > 0) {
        const leadIds = leads.map(l => l.id);
        const leadCnpjMap = new Map<string, string>();
        leads.forEach(l => {
          if (l.cnpj) leadCnpjMap.set(l.id, l.cnpj.replace(/\D/g, ''));
        });

        const { data: opps } = await supabase
          .from('opportunities')
          .select('id, stage, opportunity_type, deal_value, lead_id, assigned_to:profiles!opportunities_assigned_to_user_id_fkey(name), lead:leads!opportunities_lead_id_fkey(company)')
          .in('lead_id', leadIds)
          .limit(5000);

        if (opps) {
          for (const opp of opps as unknown[]) {
            const o = opp as Record<string, unknown>;
            const cnpj = leadCnpjMap.get(o.lead_id as string);
            if (!cnpj) continue;

            const deal: ClientDeal = {
              id: o.id as string,
              stage: o.stage as string,
              opportunity_type: o.opportunity_type as string,
              deal_value: o.deal_value as number | null,
              lead_id: o.lead_id as string,
              lead_company: (o.lead as Record<string, string> | null)?.company || '',
              assigned_to_name: (o.assigned_to as Record<string, string> | null)?.name || null,
            };

            if (!dealsMap.has(cnpj)) dealsMap.set(cnpj, []);
            dealsMap.get(cnpj)!.push(deal);
          }
        }
      }

      // ── API Oficial deals by CNPJ ──
      const apiOficialMap = new Map<string, ClientApiOficialDeal[]>();

      const { data: apiDeals } = await supabase
        .from('api_oficial_deals')
        .select('id, stage, lead_cnpj, lead_company, lead_name, lead_id, created_at, assigned_to_user_id')
        .in('lead_cnpj', cleanCnpjs);

      if (apiDeals && apiDeals.length > 0) {
        // Fetch closer names
        const userIds = new Set<string>();
        (apiDeals as unknown[]).forEach((d: unknown) => {
          const row = d as Record<string, unknown>;
          if (row.assigned_to_user_id) userIds.add(row.assigned_to_user_id as string);
        });

        let profileMap: Record<string, string> = {};
        if (userIds.size > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', Array.from(userIds));
          (profiles || []).forEach((p: { id: string; name: string }) => {
            profileMap[p.id] = p.name;
          });
        }

        for (const row of apiDeals as unknown[]) {
          const d = row as Record<string, unknown>;
          const cnpj = ((d.lead_cnpj as string) || '').replace(/\D/g, '');
          if (!cnpj) continue;

          const deal: ClientApiOficialDeal = {
            id: d.id as string,
            stage: d.stage as string,
            lead_cnpj: d.lead_cnpj as string | null,
            lead_company: d.lead_company as string | null,
            lead_name: d.lead_name as string | null,
            lead_id: d.lead_id as string,
            created_at: d.created_at as string,
            assigned_to_name: profileMap[(d.assigned_to_user_id as string) || ''] || null,
          };

          if (!apiOficialMap.has(cnpj)) apiOficialMap.set(cnpj, []);
          apiOficialMap.get(cnpj)!.push(deal);
        }
      }

      return { dealsMap, apiOficialMap };
    },
    enabled: cnpjs.length > 0,
    staleTime: 2 * 60 * 1000,
  });
};
