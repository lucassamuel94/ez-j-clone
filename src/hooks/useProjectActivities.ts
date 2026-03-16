import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchProjectActivities, createProjectActivity, updateProjectActivity, deleteProjectActivity, createProjectActivityReply } from '@/services/projectTaskService';
import { toast } from 'sonner';

export const useProjectActivities = (projectId: string | null) => {
  return useQuery({
    queryKey: ['project-activities', projectId],
    queryFn: () => fetchProjectActivities(projectId!),
    enabled: !!projectId,
  });
};

export const useCreateProjectActivity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProjectActivity,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project-activities', vars.project_id] });
      toast.success('Atividade registrada');
    },
    onError: () => toast.error('Erro ao registrar atividade'),
  });
};

export const useUpdateProjectActivity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, description }: { activityId: string; description: string; projectId: string }) =>
      updateProjectActivity(activityId, description),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project-activities', vars.projectId] });
      toast.success('Comentário atualizado');
    },
    onError: () => toast.error('Erro ao atualizar comentário'),
  });
};

export const useDeleteProjectActivity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId }: { activityId: string; projectId: string }) =>
      deleteProjectActivity(activityId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project-activities', vars.projectId] });
      toast.success('Comentário excluído');
    },
    onError: () => toast.error('Erro ao excluir comentário'),
  });
};

export const useReplyProjectActivity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProjectActivityReply,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project-activities', vars.project_id] });
      toast.success('Resposta adicionada');
    },
    onError: () => toast.error('Erro ao responder'),
  });
};
