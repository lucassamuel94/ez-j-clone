import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSystemUsers } from './useSystemUsers';

const STALE_TIME = 5 * 60_000; // 5 minutes — dashboard data is analytical

// ── Shared base: active phases (used by PhaseDistribution, Workload, Aging) ──
const useActivePhaseData = () => {
  return useQuery({
    queryKey: ['dashboard-active-phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_phases')
        .select('id, project_id, phase_name, status, assigned_user_id, updated_at, projects!inner(company_name, archived, deleted_at)')
        .eq('is_active', true)
        .eq('projects.archived', false)
        .is('projects.deleted_at', null);
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
  });
};

// ── Shared base: completed phases (used by SLA, LeadTime) ──
const useCompletedPhaseData = () => {
  return useQuery({
    queryKey: ['dashboard-completed-phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_phases')
        .select('phase_name, assigned_user_id, started_at, completed_at')
        .eq('status', 'CONCLUÍDO')
        .not('started_at', 'is', null)
        .not('completed_at', 'is', null);
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
  });
};

// ── Team membership data (used by Workload) ──
const useTeamMemberships = () => {
  return useQuery({
    queryKey: ['dashboard-team-memberships'],
    queryFn: async () => {
      const [membersRes, teamsRes] = await Promise.all([
        supabase.from('team_members').select('user_id, team_id'),
        supabase.from('teams').select('id, name'),
      ]);
      return {
        members: membersRes.data || [],
        teams: teamsRes.data || [],
      };
    },
    staleTime: STALE_TIME,
  });
};

// ══════════════════════════════════════════════════════════════
// Derived hooks — same external API as before
// ══════════════════════════════════════════════════════════════

// ── Phase Distribution (derived from active phases) ──
export const usePhaseDistribution = () => {
  const { data: raw, isLoading, error } = useActivePhaseData();

  const data = useMemo(() => {
    if (!raw) return undefined;
    const counts: Record<string, number> = {};
    raw.forEach((row: Record<string, unknown>) => {
      counts[row.phase_name as string] = (counts[row.phase_name as string] || 0) + 1;
    });
    return counts;
  }, [raw]);

  return { data, isLoading, error };
};

// ── Avg Time per Phase (standalone — uses different table) ──
export const useAvgTimePerPhase = () => {
  return useQuery({
    queryKey: ['dashboard-avg-time-per-phase'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_status_transitions')
        .select('phase_name, duration_minutes')
        .not('duration_minutes', 'is', null);
      if (error) throw error;
      const sums: Record<string, { total: number; count: number }> = {};
      (data || []).forEach((row: Record<string, unknown>) => {
        const phaseName = row.phase_name as string;
        const durationMinutes = row.duration_minutes as number;
        if (!sums[phaseName]) sums[phaseName] = { total: 0, count: 0 };
        sums[phaseName].total += durationMinutes;
        sums[phaseName].count += 1;
      });
      const result: Record<string, number> = {};
      Object.entries(sums).forEach(([phase, { total, count }]) => {
        result[phase] = Math.round(total / count / 1440);
      });
      return result;
    },
    staleTime: STALE_TIME,
  });
};

// ── Recent Activities (standalone — different table) ──
export const useRecentActivities = () => {
  return useQuery({
    queryKey: ['dashboard-recent-activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_activity_logs')
        .select('*, profile:profiles!project_activity_logs_user_id_fkey(name), project:projects!project_activity_logs_project_id_fkey(company_name)')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
  });
};

// ── Workload Heatmap (derived from active phases + systemUsers + teams) ──
export interface WorkloadCell {
  userId: string;
  userName: string;
  phases: Record<string, number>;
  total: number;
  teamId: string | null;
  teamName: string | null;
}

export const useWorkloadHeatmap = () => {
  const { data: activePhases, isLoading: l1 } = useActivePhaseData();
  const { data: systemUsers, isLoading: l2 } = useSystemUsers();
  const { data: teamData, isLoading: l3 } = useTeamMemberships();

  const data = useMemo((): WorkloadCell[] | undefined => {
    if (!activePhases || !systemUsers || !teamData) return undefined;

    // Group phases by user
    const userMap: Record<string, Record<string, number>> = {};
    activePhases.forEach((row: Record<string, unknown>) => {
      const uid = row.assigned_user_id as string | null;
      if (!uid) return;
      if (!userMap[uid]) userMap[uid] = {};
      const phaseName = row.phase_name as string;
      userMap[uid][phaseName] = (userMap[uid][phaseName] || 0) + 1;
    });

    const userIds = Object.keys(userMap);
    if (userIds.length === 0) return [];

    // Name map from cached systemUsers
    const nameMap = new Map(systemUsers.map(u => [u.id, u.name]));

    // Team mapping
    const teamNameMap = new Map(teamData.teams.map((t: Record<string, unknown>) => [t.id as string, t.name as string]));
    const userTeamMap = new Map<string, { teamId: string; teamName: string }>();
    teamData.members.forEach((m: Record<string, unknown>) => {
      const userId = m.user_id as string;
      if (!userTeamMap.has(userId)) {
        const teamId = m.team_id as string;
        userTeamMap.set(userId, {
          teamId,
          teamName: teamNameMap.get(teamId) || 'Sem equipe',
        });
      }
    });

    return userIds.map(uid => {
      const team = userTeamMap.get(uid);
      return {
        userId: uid,
        userName: nameMap.get(uid) || 'Desconhecido',
        phases: userMap[uid],
        total: Object.values(userMap[uid]).reduce((s, c) => s + c, 0),
        teamId: team?.teamId || null,
        teamName: team?.teamName || null,
      };
    }).sort((a, b) => b.total - a.total);
  }, [activePhases, systemUsers, teamData]);

  return { data, isLoading: l1 || l2 || l3 };
};

// ── Aging Board (derived from active phases + systemUsers) ──
export interface AgingProject {
  phaseId: string;
  projectId: string;
  companyName: string;
  phaseName: string;
  status: string;
  assignedUserName: string;
  daysStagnant: number;
}

export const useAgingBoard = () => {
  const { data: activePhases, isLoading: l1 } = useActivePhaseData();
  const { data: systemUsers, isLoading: l2 } = useSystemUsers();

  const data = useMemo((): AgingProject[] | undefined => {
    if (!activePhases || !systemUsers) return undefined;

    const now = Date.now();
    const nameMap = new Map(systemUsers.map(u => [u.id, u.name]));

    return activePhases
      .filter((r: Record<string, unknown>) => {
        const status = r.status as string;
        return status !== 'CONCLUIDO' && status !== 'CONCLUÍDO';
      })
      .map((r: Record<string, unknown>) => {
        const days = Math.floor((now - new Date(r.updated_at as string).getTime()) / 86400000);
        const assignedUserId = r.assigned_user_id as string | null;
        return {
          phaseId: r.id as string,
          projectId: r.project_id as string,
          companyName: (r as Record<string, Record<string, unknown>>).projects?.company_name as string || '—',
          phaseName: r.phase_name as string,
          status: r.status as string,
          assignedUserName: assignedUserId ? nameMap.get(assignedUserId) || '—' : '—',
          daysStagnant: days,
        };
      })
      .filter(r => r.daysStagnant >= 3)
      .sort((a, b) => b.daysStagnant - a.daysStagnant);
  }, [activePhases, systemUsers]);

  return { data, isLoading: l1 || l2 };
};

// ── Weekly Throughput (standalone — needs date filter) ──
export interface WeeklyThroughputEntry {
  week: string;
  [phaseName: string]: string | number;
}

export const useWeeklyThroughput = () => {
  return useQuery({
    queryKey: ['dashboard-weekly-throughput'],
    queryFn: async (): Promise<{ data: WeeklyThroughputEntry[]; phases: string[] }> => {
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

      const { data, error } = await supabase
        .from('project_phases')
        .select('phase_name, completed_at')
        .eq('status', 'CONCLUÍDO')
        .gte('completed_at', twelveWeeksAgo.toISOString())
        .not('completed_at', 'is', null);
      if (error) throw error;

      const weekMap: Record<string, Record<string, number>> = {};
      const phaseSet = new Set<string>();

      (data || []).forEach((r: Record<string, unknown>) => {
        const d = new Date(r.completed_at as string);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const weekKey = `${weekStart.getDate().toString().padStart(2, '0')}/${(weekStart.getMonth() + 1).toString().padStart(2, '0')}`;
        const phaseName = r.phase_name as string;

        if (!weekMap[weekKey]) weekMap[weekKey] = {};
        weekMap[weekKey][phaseName] = (weekMap[weekKey][phaseName] || 0) + 1;
        phaseSet.add(phaseName);
      });

      const phases = Array.from(phaseSet);
      const entries = Object.entries(weekMap)
        .map(([week, counts]) => ({ week, ...counts }))
        .sort((a, b) => {
          const [da, ma] = a.week.split('/').map(Number);
          const [db, mb] = b.week.split('/').map(Number);
          return ma !== mb ? ma - mb : da - db;
        });

      return { data: entries, phases };
    },
    staleTime: STALE_TIME,
  });
};

// ── Lead Time by User (derived from completed phases + systemUsers) ──
export interface LeadTimeEntry {
  userName: string;
  avgDays: number;
}

export const useLeadTimeByUser = (phaseFilter?: string) => {
  const { data: completedPhases, isLoading: l1 } = useCompletedPhaseData();
  const { data: systemUsers, isLoading: l2 } = useSystemUsers();

  const data = useMemo((): LeadTimeEntry[] | undefined => {
    if (!completedPhases || !systemUsers) return undefined;

    const nameMap = new Map(systemUsers.map(u => [u.id, u.name]));

    const filtered = phaseFilter && phaseFilter !== 'all'
      ? completedPhases.filter((r: Record<string, unknown>) => r.phase_name === phaseFilter)
      : completedPhases;

    const userTimes: Record<string, { total: number; count: number }> = {};
    filtered.forEach((r: Record<string, unknown>) => {
      const uid = r.assigned_user_id as string | null;
      if (!uid) return;
      const days = (new Date(r.completed_at as string).getTime() - new Date(r.started_at as string).getTime()) / 86400000;
      if (!userTimes[uid]) userTimes[uid] = { total: 0, count: 0 };
      userTimes[uid].total += days;
      userTimes[uid].count += 1;
    });

    const userIds = Object.keys(userTimes);
    if (userIds.length === 0) return [];

    return userIds
      .map(uid => ({
        userName: nameMap.get(uid) || 'Desconhecido',
        avgDays: Math.round(userTimes[uid].total / userTimes[uid].count),
      }))
      .sort((a, b) => b.avgDays - a.avgDays);
  }, [completedPhases, systemUsers, phaseFilter]);

  return { data, isLoading: l1 || l2 };
};

// ── SLA Compliance (derived from completed phases) ──
export interface SlaEntry {
  phase: string;
  benchmarkDays: number;
  avgDays: number;
  withinSla: number;
  totalCompleted: number;
  compliancePercent: number;
}

export const SLA_BENCHMARKS: Record<string, number> = {
  validacao: 3,
  ux_po: 10,
  dev_chatbot: 15,
  treinamento: 5,
  ativacao: 3,
  verificacao_bm: 5,
  automacao: 7,
  curadoria_ia: 5,
  go_live_assistido: 3,
};

export const useSlaCompliance = () => {
  const { data: completedPhases, isLoading, error } = useCompletedPhaseData();

  const data = useMemo((): SlaEntry[] | undefined => {
    if (!completedPhases) return undefined;

    const phaseStats: Record<string, { totalDays: number; count: number; withinSla: number }> = {};

    completedPhases.forEach((r: Record<string, unknown>) => {
      const phaseName = r.phase_name as string;
      const days = (new Date(r.completed_at as string).getTime() - new Date(r.started_at as string).getTime()) / 86400000;
      const benchmark = SLA_BENCHMARKS[phaseName] || 10;
      if (!phaseStats[phaseName]) phaseStats[phaseName] = { totalDays: 0, count: 0, withinSla: 0 };
      phaseStats[phaseName].totalDays += days;
      phaseStats[phaseName].count += 1;
      if (days <= benchmark) phaseStats[phaseName].withinSla += 1;
    });

    return Object.entries(phaseStats).map(([phase, stats]) => ({
      phase,
      benchmarkDays: SLA_BENCHMARKS[phase] || 10,
      avgDays: Math.round(stats.totalDays / stats.count),
      withinSla: stats.withinSla,
      totalCompleted: stats.count,
      compliancePercent: Math.round((stats.withinSla / stats.count) * 100),
    })).sort((a, b) => a.compliancePercent - b.compliancePercent);
  }, [completedPhases]);

  return { data, isLoading, error };
};
