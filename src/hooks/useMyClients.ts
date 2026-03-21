import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MyClient {
  id: string;
  company_name: string;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  lifecycle_stage: string;
  situacao_cadastral: string | null;
  account_owner_id: string | null;
  account_owner_name: string | null;
  closer_name: string | null;
  sdr_name: string | null;
  won_at: string | null;
  deal_value: number | null;
  total_revenue: number;
  active_projects_count: number;
  evolution_count: number;
  last_activity_date: string | null;
  days_since_last_activity: number | null;
  health_score: number;
  health_label: 'green' | 'yellow' | 'red';
  products: string[];
  status: string;
}

function computeHealth(daysSinceActivity: number | null, activeProjects: number): { score: number; label: 'green' | 'yellow' | 'red' } {
  let contactScore = 50;
  if (daysSinceActivity !== null) {
    if (daysSinceActivity <= 7) contactScore = 100;
    else if (daysSinceActivity <= 14) contactScore = 80;
    else if (daysSinceActivity <= 30) contactScore = 60;
    else if (daysSinceActivity <= 60) contactScore = 30;
    else contactScore = 0;
  }

  const projectScore = activeProjects > 0 ? 100 : 50;
  const score = Math.round(contactScore * 0.7 + projectScore * 0.3);
  const label = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';
  return { score, label };
}

// Helper: fetch with .in() in chunks to avoid PostgREST URL length limits
async function fetchInChunks<T>(
  table: string,
  select: string,
  filterCol: string,
  ids: string[],
  extra?: (q: any) => any,
): Promise<T[]> {
  const CHUNK = 200;
  const all: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    let q = (supabase.from as any)(table).select(select).in(filterCol, chunk);
    if (extra) q = extra(q);
    const { data } = await q;
    if (data) all.push(...(data as T[]));
  }
  return all;
}

export function useMyClients(
  userId: string | null,
  viewMode: 'closer' | 'sdr' | 'admin',
) {
  return useQuery<MyClient[]>({
    queryKey: ['my-clients', userId, viewMode],
    queryFn: async () => {
      // 1. Fetch all client accounts
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('id, company_name, cnpj, city, state, lifecycle_stage, situacao_cadastral, account_owner_id, status')
        .eq('lifecycle_stage', 'client')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) throw error;

      if (!accounts || accounts.length === 0) return [];

      // Fetch owner names separately (the profiles FK join doesn't work in this project)
      const ownerIds = [...new Set(accounts.map((a: any) => a.account_owner_id).filter(Boolean))];
      const ownerMap = new Map<string, string>();
      if (ownerIds.length > 0) {
        const ownerChunks = [];
        for (let i = 0; i < ownerIds.length; i += 200) {
          ownerChunks.push(ownerIds.slice(i, i + 200));
        }
        for (const chunk of ownerChunks) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', chunk);
          if (profiles) {
            for (const p of profiles) {
              ownerMap.set(p.id, p.name);
            }
          }
        }
      }

      const accountIds = accounts.map((a: any) => a.id);

      // 2-4. Fetch related data in chunks (parallel)
      const [allOpps, projectCounts, lastActivities] = await Promise.all([
        fetchInChunks<any>(
          'opportunities',
          `id, account_id, stage, opportunity_type, deal_value, won_at, updated_at,
           assigned_to_user_id,
           closer:profiles!opportunities_assigned_to_user_id_fkey(name),
           sdr:profiles!opportunities_sdr_user_id_fkey(name),
           sdr_user_id`,
          'account_id',
          accountIds,
          (q) => q.not('stage', 'eq', 'Perdido'),
        ),
        fetchInChunks<any>(
          'projects',
          'account_id',
          'account_id',
          accountIds,
          (q) => q.not('overall_status', 'in', '("cancelado")'),
        ),
        // Only fetch latest activity per account (limit per chunk)
        fetchInChunks<any>(
          'account_activity_logs',
          'account_id, created_at',
          'account_id',
          accountIds,
          (q) => q.order('created_at', { ascending: false }).limit(1000),
        ),
      ]);

      // Build maps
      const now = new Date();

      // Opp map: account_id → { wonOpp, evolutions, totalRevenue, closerName, sdrName, products }
      const oppMap = new Map<string, {
        wonOpp: any;
        evolutionCount: number;
        totalRevenue: number;
        closerName: string | null;
        sdrName: string | null;
        closerUserId: string | null;
        sdrUserId: string | null;
        products: Set<string>;
      }>();

      for (const opp of (allOpps || []) as any[]) {
        if (!oppMap.has(opp.account_id)) {
          oppMap.set(opp.account_id, {
            wonOpp: null, evolutionCount: 0, totalRevenue: 0,
            closerName: null, sdrName: null, closerUserId: null, sdrUserId: null,
            products: new Set(),
          });
        }
        const entry = oppMap.get(opp.account_id)!;

        if (opp.stage === 'Ganho') {
          entry.totalRevenue += opp.deal_value || 0;
          if (!entry.wonOpp || (opp.won_at && (!entry.wonOpp.won_at || opp.won_at > entry.wonOpp.won_at))) {
            entry.wonOpp = opp;
            entry.closerName = opp.closer?.name || null;
            entry.sdrName = opp.sdr?.name || null;
            entry.closerUserId = opp.assigned_to_user_id;
            entry.sdrUserId = opp.sdr_user_id;
          }
        }

        if (opp.opportunity_type === 'evolution' && opp.stage !== 'Perdido') {
          entry.evolutionCount++;
        }

        // Track products by opportunity type
        const type = opp.opportunity_type || 'new_business';
        if (opp.stage !== 'Perdido') {
          entry.products.add(type === 'evolution' ? 'Evolução' : type === 'api_oficial' ? 'API Oficial' : 'Chatbot');
        }
      }

      // Projects count map
      const projMap = new Map<string, number>();
      for (const p of (projectCounts || []) as any[]) {
        projMap.set(p.account_id, (projMap.get(p.account_id) || 0) + 1);
      }

      // Last activity map (first occurrence per account = latest due to order)
      const activityMap = new Map<string, string>();
      for (const a of (lastActivities || []) as any[]) {
        if (!activityMap.has(a.account_id)) {
          activityMap.set(a.account_id, a.created_at);
        }
      }

      // 5. Build result with role-based filtering
      const result: MyClient[] = [];

      for (const a of accounts as any[]) {
        const opp = oppMap.get(a.id);

        // Role filter: use opportunity closer/sdr, fallback to account_owner_id
        const closerMatch = opp?.closerUserId === userId || (a as any).account_owner_id === userId;
        const sdrMatch = opp?.sdrUserId === userId || (a as any).account_owner_id === userId;
        if (viewMode === 'closer' && !closerMatch) continue;
        if (viewMode === 'sdr' && !sdrMatch) continue;

        const lastActivity = activityMap.get(a.id) || opp?.wonOpp?.won_at || null;
        const daysSince = lastActivity
          ? Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        const activeProjects = projMap.get(a.id) || 0;
        const { score, label } = computeHealth(daysSince, activeProjects);

        result.push({
          id: a.id,
          company_name: a.company_name,
          cnpj: a.cnpj,
          city: a.city,
          state: a.state,
          lifecycle_stage: a.lifecycle_stage,
          situacao_cadastral: a.situacao_cadastral,
          account_owner_id: a.account_owner_id || null,
          account_owner_name: ownerMap.get(a.account_owner_id) || null,
          closer_name: opp?.closerName || ownerMap.get(a.account_owner_id) || null,
          status: a.status || 'active',
          sdr_name: opp?.sdrName || null,
          won_at: opp?.wonOpp?.won_at || null,
          deal_value: opp?.wonOpp?.deal_value || null,
          total_revenue: opp?.totalRevenue || 0,
          active_projects_count: activeProjects,
          evolution_count: opp?.evolutionCount || 0,
          last_activity_date: lastActivity,
          days_since_last_activity: daysSince,
          health_score: score,
          health_label: label,
          products: [...(opp?.products || [])],
        });
      }

      return result;
    },
    enabled: viewMode === 'admin' || !!userId,
    staleTime: 120_000,
    gcTime: 300_000,
  });
}
