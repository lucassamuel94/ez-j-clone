import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSystemUsers } from './useSystemUsers';

const STALE_TIME = 5 * 60_000;

export type TeamType = 'ux_po' | 'dev_chatbot' | 'treinamento';

export interface UserProductivity {
  userId: string;
  userName: string;
  delivered: number;
  goal: number;
  percentage: number;
  remaining: number;
}

export interface ProductivitySummary {
  totalDelivered: number;
  teamGoal: number;
  avgPercentage: number;
  remaining: number;
  ranking: UserProductivity[];
}

// ── Single-team hook (used by ProductivityPage) ──
export const useProductivityMetrics = (teamType: TeamType, month: number, year: number) => {
  return useQuery({
    queryKey: ['productivity-metrics', teamType, month, year],
    queryFn: async (): Promise<ProductivitySummary> => {
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

      const { data: phases, error: phasesError } = await supabase
        .from('project_phases')
        .select('assigned_user_id, completed_at')
        .eq('phase_name', teamType)
        .eq('status', 'CONCLUIDO')
        .gte('completed_at', startDate)
        .lte('completed_at', endDate);

      if (phasesError) throw phasesError;

      const { data: goals, error: goalsError } = await supabase
        .from('goals')
        .select('target_user_id, meetings_scheduled_goal')
        .eq('goal_type', teamType)
        .eq('period_month', month)
        .eq('period_year', year);

      if (goalsError) throw goalsError;

      const userIds = new Set<string>();
      (phases || []).forEach(p => { if (p.assigned_user_id) userIds.add(p.assigned_user_id); });
      (goals || []).forEach(g => { if (g.target_user_id) userIds.add(g.target_user_id); });

      let profiles: { id: string; name: string }[] = [];
      if (userIds.size > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', Array.from(userIds));
        profiles = data || [];
      }

      return buildSummary(phases || [], goals || [], profiles);
    },
    staleTime: STALE_TIME,
  });
};

// ── All-teams hook (used by ProjectsDashboard — 1 call instead of 3) ──
export interface AllTeamProductivity {
  ux_po: ProductivitySummary;
  dev_chatbot: ProductivitySummary;
  treinamento: ProductivitySummary;
}

export const useAllTeamProductivity = (month: number, year: number) => {
  const { data: systemUsers } = useSystemUsers();

  const baseQuery = useQuery({
    queryKey: ['productivity-all-teams', month, year],
    queryFn: async () => {
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

      const [phasesRes, goalsRes] = await Promise.all([
        supabase
          .from('project_phases')
          .select('assigned_user_id, completed_at, phase_name')
          .in('phase_name', ['ux_po', 'dev_chatbot', 'treinamento'])
          .eq('status', 'CONCLUIDO')
          .gte('completed_at', startDate)
          .lte('completed_at', endDate),
        supabase
          .from('goals')
          .select('target_user_id, meetings_scheduled_goal, goal_type')
          .in('goal_type', ['ux_po', 'dev_chatbot', 'treinamento'])
          .eq('period_month', month)
          .eq('period_year', year),
      ]);

      if (phasesRes.error) throw phasesRes.error;
      if (goalsRes.error) throw goalsRes.error;

      return {
        phases: phasesRes.data || [],
        goals: goalsRes.data || [],
      };
    },
    staleTime: STALE_TIME,
  });

  const data = useMemo((): AllTeamProductivity | undefined => {
    if (!baseQuery.data || !systemUsers) return undefined;

    const { phases, goals } = baseQuery.data;
    const profileMap = systemUsers.map(u => ({ id: u.id, name: u.name }));

    const teams: TeamType[] = ['ux_po', 'dev_chatbot', 'treinamento'];
    const result = {} as AllTeamProductivity;

    for (const team of teams) {
      const teamPhases = phases.filter((p: Record<string, unknown>) => p.phase_name === team);
      const teamGoals = goals.filter((g: Record<string, unknown>) => g.goal_type === team);
      result[team] = buildSummary(teamPhases, teamGoals, profileMap);
    }

    return result;
  }, [baseQuery.data, systemUsers]);

  return { data, isLoading: baseQuery.isLoading };
};

// ── Shared builder ──
function buildSummary(
  phases: Record<string, unknown>[],
  goals: Record<string, unknown>[],
  profiles: { id: string; name: string }[],
): ProductivitySummary {
  const profileMap = new Map(profiles.map(p => [p.id, p.name]));

  const deliveryCounts: Record<string, number> = {};
  phases.forEach(p => {
    const uid = p.assigned_user_id as string | null;
    if (uid) deliveryCounts[uid] = (deliveryCounts[uid] || 0) + 1;
  });

  const goalMap: Record<string, number> = {};
  let teamGoal = 0;
  goals.forEach(g => {
    const uid = g.target_user_id as string | null;
    const goalVal = g.meetings_scheduled_goal as number;
    if (uid) {
      goalMap[uid] = goalVal;
    } else {
      teamGoal = goalVal;
    }
  });

  const allUsers = new Set([...Object.keys(deliveryCounts), ...Object.keys(goalMap)]);
  const ranking: UserProductivity[] = Array.from(allUsers).map(userId => {
    const delivered = deliveryCounts[userId] || 0;
    const goal = goalMap[userId] || teamGoal;
    const percentage = goal > 0 ? Math.round((delivered / goal) * 100) : 0;
    return {
      userId,
      userName: profileMap.get(userId) || 'Desconhecido',
      delivered,
      goal,
      percentage,
      remaining: Math.max(0, goal - delivered),
    };
  }).sort((a, b) => b.delivered - a.delivered);

  const totalDelivered = ranking.reduce((s, r) => s + r.delivered, 0);
  const totalGoal = ranking.reduce((s, r) => s + r.goal, 0) || teamGoal;
  const avgPct = ranking.length > 0
    ? Math.round(ranking.reduce((s, r) => s + r.percentage, 0) / ranking.length)
    : 0;

  return {
    totalDelivered,
    teamGoal: totalGoal,
    avgPercentage: avgPct,
    remaining: Math.max(0, totalGoal - totalDelivered),
    ranking,
  };
}
