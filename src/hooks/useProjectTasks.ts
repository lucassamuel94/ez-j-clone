import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProjectTasks,
  createProjectTask,
  updateProjectTask,
  deleteProjectTask,
} from '@/services/projectTaskService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ProjectTask } from '@/services/projectTaskService';

export const useProjectTasks = (projectId: string | null) => {
  return useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: () => fetchProjectTasks(projectId!),
    enabled: !!projectId,
  });
};

/** Fetch tasks linked to a specific lead and/or opportunity */
export const useLeadTasks = (leadId: string | null, opportunityId?: string | null) => {
  return useQuery<ProjectTask[]>({
    queryKey: ['lead-tasks', leadId, opportunityId],
    queryFn: async () => {
      let query = supabase
        .from('project_tasks')
        .select('*, profiles!project_tasks_assigned_user_id_fkey(name)')
        .order('due_date', { ascending: true, nullsFirst: false });

      if (leadId && opportunityId) {
        query = query.or(`lead_id.eq.${leadId},opportunity_id.eq.${opportunityId}`);
      } else if (leadId) {
        query = query.eq('lead_id', leadId);
      } else if (opportunityId) {
        query = query.eq('opportunity_id', opportunityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        assigned_user_name: t.profiles?.name || null,
      }));
    },
    enabled: !!(leadId || opportunityId),
  });
};

export const useCreateProjectTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProjectTask,
    onSuccess: (_, vars) => {
      if (vars.project_id) {
        queryClient.invalidateQueries({ queryKey: ['project-tasks', vars.project_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      if (vars.lead_id) {
        queryClient.invalidateQueries({ queryKey: ['lead-tasks', vars.lead_id] });
      }
      toast.success('Tarefa criada');
    },
    onError: () => toast.error('Erro ao criar tarefa'),
  });
};

export const useUpdateProjectTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, updates, projectId }: { taskId: string; updates: Record<string, unknown>; projectId: string }) =>
      updateProjectTask(taskId, updates),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', vars.projectId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['activityLogs'] });
      toast.success('Tarefa atualizada');
    },
    onError: () => toast.error('Erro ao atualizar tarefa'),
  });
};

export const useDeleteProjectTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; projectId: string }) => deleteProjectTask(taskId),
    onSuccess: (_, vars) => {
      if (vars.projectId) {
        queryClient.invalidateQueries({ queryKey: ['project-tasks', vars.projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      toast.success('Tarefa removida');
    },
    onError: () => toast.error('Erro ao remover tarefa'),
  });
};
