import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSystemUsers } from './useSystemUsers';

const STALE = 5 * 60_000;

type Period = 'week' | 'month' | 'quarter';

function periodRange(period: Period): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  const end = new Date(now);
  let start: Date;
  let prevStart: Date;
  let prevEnd: Date;

  if (period === 'week') {
    start = new Date(now);
    start.setDate(now.getDate() - 7);
    prevEnd = new Date(start);
    prevStart = new Date(prevEnd);
    prevStart.setDate(prevEnd.getDate() - 7);
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);
  } else {
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    start = new Date(now.getFullYear(), qMonth, 1);
    prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const pqMonth = Math.floor(prevEnd.getMonth() / 3) * 3;
    prevStart = new Date(prevEnd.getFullYear(), pqMonth, 1);
  }
  return { start, end, prevStart, prevEnd };
}

// ── Raw project data ──
const useProjectsRaw = () =>
  useQuery({
    queryKey: ['posvenda-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_number, company_name, project_type, overall_status, start_date, due_date, created_at, updated_at, priority, head_user_id, dev_user_id, ux_po_user_id, treinamento_user_id, ativacao_user_id, tags')
        .eq('archived', false)
        .is('deleted_at', null)
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE,
  });

// ── Status transitions for rework/approval detection ──
const useTransitionsRaw = () =>
  useQuery({
    queryKey: ['posvenda-transitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_status_transitions')
        .select('project_id, phase_name, status, entered_at, duration_minutes')
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE,
  });

// ── Team memberships ──
const useTeams = () =>
  useQuery({
    queryKey: ['posvenda-teams'],
    queryFn: async () => {
      const [membersRes, teamsRes] = await Promise.all([
        supabase.from('team_members').select('user_id, team_id'),
        supabase.from('teams').select('id, name'),
      ]);
      return { members: membersRes.data || [], teams: teamsRes.data || [] };
    },
    staleTime: STALE,
  });

// ── Phases for SLA calc ──
const useCompletedPhases = () =>
  useQuery({
    queryKey: ['posvenda-completed-phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_phases')
        .select('project_id, phase_name, started_at, completed_at, assigned_user_id, status')
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE,
  });

export interface PosVendaKpi {
  active: number;
  delivered: number;
  deliveredPrev: number;
  overdue: number;
  overduePrev: number;
  paused: number;
  cancelled: number;
  slaPercent: number;
  avgDays: number;
  effectiveLeadTime: number;
  reworkPercent: number;
  approvedFirstPercent: number;
}

export interface ProjectRow {
  id: string;
  number: number;
  company: string;
  type: string;
  team: string;
  status: string;
  situationPill: 'on_time' | 'at_risk' | 'overdue' | 'paused' | 'cancelled' | 'waiting';
  dueDate: string | null;
  deadlinePercent: number;
  overdueDays: number;
  responsible: string;
}

export interface DeliveryVsDelay {
  month: string;
  delivered: number;
  overdue: number;
}

export interface BarEntry {
  label: string;
  value: number;
  color?: string;
}

export interface RiskProject {
  id: string;
  company: string;
  deadlinePercent: number;
  daysStagnant: number;
  riskType: 'deadline' | 'stagnant';
}

export const usePosVendaDashboard = (period: Period) => {
  const { data: projects, isLoading: l1 } = useProjectsRaw();
  const { data: transitions, isLoading: l2 } = useTransitionsRaw();
  const { data: teamData, isLoading: l3 } = useTeams();
  const { data: phases, isLoading: l4 } = useCompletedPhases();
  const { data: users, isLoading: l5 } = useSystemUsers();

  const isLoading = l1 || l2 || l3 || l4 || l5;

  const result = useMemo(() => {
    if (!projects || !transitions || !teamData || !phases || !users) return null;

    const { start, end, prevStart, prevEnd } = periodRange(period);
    const now = new Date();
    const nameMap = new Map(users.map(u => [u.id, u.name]));
    const teamNameMap = new Map(teamData.teams.map((t: Record<string, string>) => [t.id, t.name]));
    const userTeamMap = new Map<string, string>();
    teamData.members.forEach((m: Record<string, string>) => {
      if (!userTeamMap.has(m.user_id)) userTeamMap.set(m.user_id, teamNameMap.get(m.team_id) || 'Sem equipe');
    });

    // Helper: get team name for a project
    const getProjectTeam = (p: typeof projects[0]) => {
      const uid = p.head_user_id || p.dev_user_id || p.ux_po_user_id;
      return uid ? (userTeamMap.get(uid) || 'Sem equipe') : 'Sem equipe';
    };

    const getResponsible = (p: typeof projects[0]) => {
      const uid = p.head_user_id || p.dev_user_id;
      return uid ? (nameMap.get(uid) || '—') : '—';
    };

    // ── KPIs ──
    const active = projects.filter(p => p.overall_status === 'ativo').length;
    const paused = projects.filter(p => p.overall_status === 'em_pausa').length;
    const cancelled = projects.filter(p => p.overall_status === 'cancelado').length;

    const deliveredInPeriod = projects.filter(p =>
      p.overall_status === 'concluido' &&
      p.updated_at && new Date(p.updated_at) >= start && new Date(p.updated_at) <= end
    );
    const deliveredPrev = projects.filter(p =>
      p.overall_status === 'concluido' &&
      p.updated_at && new Date(p.updated_at) >= prevStart && new Date(p.updated_at) <= prevEnd
    );

    const overdueProjects = projects.filter(p =>
      p.overall_status === 'ativo' && p.due_date && new Date(p.due_date) < now
    );
    const overduePrev = projects.filter(p =>
      p.overall_status === 'ativo' && p.due_date &&
      new Date(p.due_date) < prevEnd && new Date(p.due_date) >= prevStart
    );

    // SLA
    const completedWithDates = phases.filter(p => p.started_at && p.completed_at && p.status === 'CONCLUÍDO');
    const SLA_BENCHMARKS: Record<string, number> = {
      validacao: 3, ux_po: 10, dev_chatbot: 15, treinamento: 5, ativacao: 3,
      verificacao_bm: 5, automacao: 7, curadoria_ia: 5, go_live_assistido: 3,
    };
    let withinSla = 0;
    let totalSla = 0;
    let totalDays = 0;
    let totalEffective = 0;
    completedWithDates.forEach(ph => {
      const days = (new Date(ph.completed_at!).getTime() - new Date(ph.started_at!).getTime()) / 86400000;
      const benchmark = SLA_BENCHMARKS[ph.phase_name] || 10;
      if (days <= benchmark) withinSla++;
      totalSla++;
      totalDays += days;
    });

    // Effective lead time: total duration from transitions
    const projectDurations = new Map<string, number>();
    transitions.forEach(t => {
      if (t.duration_minutes) {
        projectDurations.set(t.project_id, (projectDurations.get(t.project_id) || 0) + t.duration_minutes);
      }
    });
    const durationValues = Array.from(projectDurations.values());
    if (durationValues.length) totalEffective = durationValues.reduce((a, b) => a + b, 0) / durationValues.length / 1440;

    // Rework: projects with >1 transition to REVISÃO/AJUSTES
    const reworkMap = new Map<string, number>();
    transitions.forEach(t => {
      if (/revis|ajust/i.test(t.status)) {
        reworkMap.set(t.project_id, (reworkMap.get(t.project_id) || 0) + 1);
      }
    });
    const reworkCount = Array.from(reworkMap.values()).filter(c => c > 1).length;
    const totalCompleted = projects.filter(p => p.overall_status === 'concluido').length;

    // Approved first: no AJUSTES transitions
    const projectsWithAjustes = new Set<string>();
    transitions.forEach(t => {
      if (/ajust/i.test(t.status)) projectsWithAjustes.add(t.project_id);
    });
    const approvedFirst = totalCompleted > 0 ? ((totalCompleted - projectsWithAjustes.size) / totalCompleted) * 100 : 100;

    const kpis: PosVendaKpi = {
      active,
      delivered: deliveredInPeriod.length,
      deliveredPrev: deliveredPrev.length,
      overdue: overdueProjects.length,
      overduePrev: overduePrev.length,
      paused,
      cancelled,
      slaPercent: totalSla > 0 ? Math.round((withinSla / totalSla) * 100) : 0,
      avgDays: totalSla > 0 ? Math.round(totalDays / totalSla) : 0,
      effectiveLeadTime: Math.round(totalEffective),
      reworkPercent: totalCompleted > 0 ? Math.round((reworkCount / totalCompleted) * 100) : 0,
      approvedFirstPercent: Math.round(approvedFirst),
    };

    // ── Delivery by team ──
    const deliveredByTeam: Record<string, number> = {};
    deliveredInPeriod.forEach(p => {
      const team = getProjectTeam(p);
      deliveredByTeam[team] = (deliveredByTeam[team] || 0) + 1;
    });
    const teamDeliveryBars: BarEntry[] = Object.entries(deliveredByTeam)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    // ── Time by type ──
    const typeLabels: Record<string, string> = { venda: 'Implantação', evolucao: 'Evolução', api_oficial: 'API Oficial', migracao: 'Migração' };
    const typeTimes: Record<string, { total: number; count: number }> = {};
    projects.filter(p => p.overall_status === 'concluido').forEach(p => {
      if (p.start_date && p.updated_at) {
        const days = (new Date(p.updated_at).getTime() - new Date(p.start_date).getTime()) / 86400000;
        const key = typeLabels[p.project_type] || p.project_type;
        if (!typeTimes[key]) typeTimes[key] = { total: 0, count: 0 };
        typeTimes[key].total += days;
        typeTimes[key].count++;
      }
    });
    const typeTimeBars: BarEntry[] = Object.entries(typeTimes)
      .map(([label, { total, count }]) => ({ label, value: Math.round(total / count) }))
      .sort((a, b) => b.value - a.value);

    // ── Donut: types in progress ──
    const typeCounts: Record<string, number> = {};
    projects.filter(p => p.overall_status === 'ativo').forEach(p => {
      const label = typeLabels[p.project_type] || p.project_type;
      typeCounts[label] = (typeCounts[label] || 0) + 1;
    });
    const typeDonut = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));

    // ── Risk projects ──
    const riskProjects: RiskProject[] = [];
    projects.filter(p => p.overall_status === 'ativo').forEach(p => {
      if (p.start_date && p.due_date) {
        const totalSpan = new Date(p.due_date).getTime() - new Date(p.start_date).getTime();
        const elapsed = now.getTime() - new Date(p.start_date).getTime();
        const pct = totalSpan > 0 ? Math.round((elapsed / totalSpan) * 100) : 0;
        if (pct > 80) {
          riskProjects.push({ id: p.id, company: p.company_name, deadlinePercent: pct, daysStagnant: 0, riskType: 'deadline' });
        }
      }
      const daysSinceUpdate = Math.floor((now.getTime() - new Date(p.updated_at).getTime()) / 86400000);
      if (daysSinceUpdate > 15) {
        riskProjects.push({ id: p.id, company: p.company_name, deadlinePercent: 0, daysStagnant: daysSinceUpdate, riskType: 'stagnant' });
      }
    });

    // ── Deliveries vs delays last 6 months ──
    const deliveryHistory: DeliveryVsDelay[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const monthLabel = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const del = projects.filter(p =>
        p.overall_status === 'concluido' &&
        p.updated_at && new Date(p.updated_at) >= d && new Date(p.updated_at) <= monthEnd
      ).length;
      const ovr = projects.filter(p =>
        p.due_date && new Date(p.due_date) >= d && new Date(p.due_date) <= monthEnd &&
        p.overall_status === 'ativo' && new Date(p.due_date) < now
      ).length;
      deliveryHistory.push({ month: monthLabel, delivered: del, overdue: ovr });
    }

    // ── Project rows for queue ──
    const projectRows: ProjectRow[] = projects.map(p => {
      const hasDue = !!p.due_date;
      const isOverdue = hasDue && new Date(p.due_date!) < now && p.overall_status === 'ativo';
      const totalSpan = hasDue && p.start_date ? new Date(p.due_date!).getTime() - new Date(p.start_date).getTime() : 0;
      const elapsed = p.start_date ? now.getTime() - new Date(p.start_date).getTime() : 0;
      const pct = totalSpan > 0 ? Math.round((elapsed / totalSpan) * 100) : 0;
      const overdueDays = isOverdue ? Math.ceil((now.getTime() - new Date(p.due_date!).getTime()) / 86400000) : 0;

      let situationPill: ProjectRow['situationPill'] = 'on_time';
      if (p.overall_status === 'em_pausa') situationPill = 'paused';
      else if (p.overall_status === 'cancelado') situationPill = 'cancelled';
      else if (!p.start_date || p.overall_status === 'ativo' && !p.start_date) situationPill = 'waiting';
      else if (isOverdue) situationPill = 'overdue';
      else if (pct > 80) situationPill = 'at_risk';

      return {
        id: p.id,
        number: p.project_number,
        company: p.company_name,
        type: typeLabels[p.project_type] || p.project_type,
        team: getProjectTeam(p),
        status: p.overall_status,
        situationPill,
        dueDate: p.due_date,
        deadlinePercent: pct,
        overdueDays,
        responsible: getResponsible(p),
      };
    });

    // Queue KPIs
    const queueTotal = projects.filter(p => p.overall_status === 'ativo' || p.overall_status === 'em_pausa').length;
    const queueOverdue = overdueProjects.length;
    const queuePaused = paused;
    const queueNotStarted = projects.filter(p => p.overall_status === 'ativo' && !p.start_date).length;

    return {
      kpis,
      teamDeliveryBars,
      typeTimeBars,
      typeDonut,
      riskProjects,
      deliveryHistory,
      projectRows,
      queueKpis: { total: queueTotal, overdue: queueOverdue, paused: queuePaused, notStarted: queueNotStarted },
    };
  }, [projects, transitions, teamData, phases, users, period]);

  return { data: result, isLoading };
};
