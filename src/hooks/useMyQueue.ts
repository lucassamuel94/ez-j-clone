import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { countBusinessDays } from '@/utils/businessDays';
import { useMemo } from 'react';

export type QueueSituacao = 'atrasado' | 'pausado' | 'vencendo' | 'em_dia' | 'backlog';

export interface QueueItem {
  id: string;
  project_id: string;
  phase_name: string;
  status: string;
  due_date: string | null;
  paused_at: string | null;
  assigned_user_id: string | null;
  project: {
    company_name: string;
    project_type: string;
    complexity_level: string | null;
    overall_status: string;
    project_number: number;
  };
  dias_restantes: number | null;
  situacao: QueueSituacao;
}

const FULL_ACCESS_ROLES = ['admin', 'head_pos_venda', 'ux_po'];

const ROLE_PHASES: Record<string, string[]> = {
  dev_chatbot: ['dev_chatbot', 'automacao'],
  treinamento: ['treinamento', 'ativacao'],
};

function computeSituacao(status: string, dueDate: string | null, today: Date): { situacao: QueueSituacao; dias_restantes: number | null } {
  if (status === 'BACKLOG') return { situacao: 'backlog', dias_restantes: null };
  if (status === 'PAUSADO' || status === 'EM PAUSA') return { situacao: 'pausado', dias_restantes: null };
  if (status === 'CONCLUÍDO') return { situacao: 'em_dia', dias_restantes: null };

  if (!dueDate) return { situacao: 'em_dia', dias_restantes: null };

  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);

  if (due < today) {
    const overdue = countBusinessDays(due, today);
    return { situacao: 'atrasado', dias_restantes: -overdue };
  }

  const remaining = countBusinessDays(today, due);
  if (remaining <= 3) return { situacao: 'vencendo', dias_restantes: remaining };
  return { situacao: 'em_dia', dias_restantes: remaining };
}

export const useMyQueue = () => {
  const { user } = useCurrentUser();
  const userId = user?.id;

  // Fetch user role
  const { data: userRole } = useQuery({
    queryKey: ['my-queue-role', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId!)
        .limit(1)
        .single();
      return data?.role as string | null;
    },
    staleTime: 5 * 60_000,
  });

  // Fetch user team memberships
  const { data: userTeamIds } = useQuery({
    queryKey: ['my-queue-teams', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId!);
      return (data ?? []).map((r) => r.team_id);
    },
    staleTime: 5 * 60_000,
  });

  // Fetch team→phase mappings
  const { data: teamPhaseMappings } = useQuery({
    queryKey: ['team-phase-map'],
    queryFn: async () => {
      const { data } = await (supabase as unknown as Record<string, Function>)
        .from('team_phase_map')
        .select('team_id, phase_name') as { data: { team_id: string; phase_name: string }[] | null };
      return (data ?? []);
    },
    staleTime: 5 * 60_000,
  });

  const hasFullAccess = userRole ? FULL_ACCESS_ROLES.includes(userRole) : false;

  // Compute allowed phase names for the user
  const allowedPhaseNames = useMemo(() => {
    if (hasFullAccess) return null; // null = all phases
    const phases = new Set<string>();

    // a) Role-based
    if (userRole && ROLE_PHASES[userRole]) {
      ROLE_PHASES[userRole].forEach((p) => phases.add(p));
    }

    // b) Team-based
    if (userTeamIds && teamPhaseMappings) {
      const teamSet = new Set(userTeamIds);
      teamPhaseMappings.forEach((m) => {
        if (teamSet.has(m.team_id)) phases.add(m.phase_name);
      });
    }

    return phases;
  }, [hasFullAccess, userRole, userTeamIds, teamPhaseMappings]);

  // Fetch phases + projects
  const { data: rawPhases, isLoading } = useQuery({
    queryKey: ['my-queue-phases', userId, hasFullAccess, allowedPhaseNames ? Array.from(allowedPhaseNames).sort().join(',') : 'all'],
    enabled: !!userId && userRole !== undefined,
    queryFn: async () => {
      let query = supabase
        .from('project_phases')
        .select(`
          id, project_id, phase_name, status, due_date, paused_at, assigned_user_id,
          projects!inner(company_name, project_type, complexity_level, overall_status, project_number, archived)
        `)
        .eq('is_active', true)
        .neq('status', 'CONCLUÍDO');

      // Filter by project not archived and active
      query = query.eq('projects.archived', false);

      const { data, error } = await query;
      if (error) {
        console.error('useMyQueue fetch error:', error);
        return [];
      }
      return data ?? [];
    },
    staleTime: 60_000,
  });

  // Process into QueueItems
  const items: QueueItem[] = useMemo(() => {
    if (!rawPhases) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return rawPhases
      .filter((phase: Record<string, unknown>) => {
        const proj = phase.projects as Record<string, unknown> | null;
        if (!proj || proj.overall_status === 'cancelado' || proj.overall_status === 'concluido') return false;

        // Access filter
        if (hasFullAccess) return true;

        // Check direct assignment
        if (phase.assigned_user_id === userId) return true;

        // Check allowed phase names
        if (allowedPhaseNames && allowedPhaseNames.has(phase.phase_name as string)) return true;

        return false;
      })
      .map((phase: Record<string, unknown>) => {
        const proj = phase.projects as Record<string, unknown>;
        const { situacao, dias_restantes } = computeSituacao(
          phase.status as string,
          phase.due_date as string | null,
          today,
        );

        return {
          id: phase.id as string,
          project_id: phase.project_id as string,
          phase_name: phase.phase_name as string,
          status: phase.status as string,
          due_date: phase.due_date as string | null,
          paused_at: phase.paused_at as string | null,
          assigned_user_id: phase.assigned_user_id as string | null,
          project: {
            company_name: proj.company_name as string,
            project_type: proj.project_type as string,
            complexity_level: (proj.complexity_level as string) ?? null,
            overall_status: proj.overall_status as string,
            project_number: proj.project_number as number,
          },
          dias_restantes,
          situacao,
        };
      });
  }, [rawPhases, hasFullAccess, allowedPhaseNames, userId]);

  // Split into sections
  const alerts = useMemo(() => items.filter((i) => ['atrasado', 'vencendo', 'pausado'].includes(i.situacao)), [items]);
  const emAndamento = useMemo(() => {
    const order: Record<QueueSituacao, number> = { atrasado: 0, vencendo: 1, em_dia: 2, pausado: 3, backlog: 4 };
    return items
      .filter((i) => i.situacao !== 'backlog')
      .sort((a, b) => (order[a.situacao] ?? 9) - (order[b.situacao] ?? 9));
  }, [items]);

  const backlog = useMemo(
    () => items
      .filter((i) => i.situacao === 'backlog')
      .sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }),
    [items],
  );

  return { items, alerts, emAndamento, backlog, isLoading };
};
