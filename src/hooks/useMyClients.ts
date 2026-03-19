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
        .select(`
          id, company_name, cnpj, city, state, lifecycle_stage, situacao_cadastral,
          account_owner:profiles!accounts_account_owner_id_profiles_fkey(name)
        `)
        .eq('lifecycle_stage', 'client')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!accounts || accounts.length === 0) return [];

      const accountIds = accounts.map((a: any) => a.id);

      // 2. Fetch ALL opportunities for these accounts (won + active)
      const { data: allOpps } = await supabase
        .from('opportunities')
        .select(`
          id, account_id, stage, opportunity_type, deal_value, won_at, updated_at,
          assigned_to_user_id,
          closer:profiles!opportunities_assigned_to_user_id_fkey(name),
          sdr:profiles!opportunities_sdr_user_id_fkey(name),
          sdr_user_id
        `)
        .in('account_id', accountIds);

      // 3. Fetch projects count per account
      const { data: projectCounts } = await supabase
        .from('projects')
        .select('account_id')
        .in('account_id', accountIds)
        .not('overall_status', 'in', '("cancelado")');

      // 4. Fetch last activity per account
      const { data: lastActivities } = await supabase
        .from('account_activity_logs')
        .select('account_id, created_at')
        .in('account_id', accountIds)
        .order('created_at', { ascending: false });

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

        // Role filter
        if (viewMode === 'closer' && opp?.closerUserId !== userId) continue;
        if (viewMode === 'sdr' && opp?.sdrUserId !== userId) continue;

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
          account_owner_name: (a.account_owner as any)?.name || null,
          closer_name: opp?.closerName || null,
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
    staleTime: 30_000,
  });
}
