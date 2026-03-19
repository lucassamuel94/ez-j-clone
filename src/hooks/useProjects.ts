import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProjects,
  fetchDeletedProjects,
  fetchProjectPhases,
  fetchProjectTransitions,
  createProjectFromChecklist,
  updatePhaseStatus,
  forceMovePhaseTo,
  fetchUserAssignedProjectIds,
  fetchUserPhaseAssignments,
  softDeleteProject,
  restoreProject,
  permanentDeleteProject,
  finalizeEvolutionProject,
  advanceEvolutionToAICuration,
  CreateProjectInput,
  AdvanceToAICurationResult,
} from '@/services/projectService';
import { toast } from 'sonner';

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    staleTime: 2 * 60_000, // 2 min — avoid refetch on every mount
  });
};

export const useUserAssignedProjectIds = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['user-assigned-project-ids', userId],
    queryFn: () => fetchUserAssignedProjectIds(userId!),
    enabled: !!userId,
  });
};

export const useUserPhaseAssignments = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['user-phase-assignments', userId],
    queryFn: () => fetchUserPhaseAssignments(userId!),
    enabled: !!userId,
  });
};

export const useProjectPhases = (projectId: string | null) => {
  return useQuery({
    queryKey: ['project-phases', projectId],
    queryFn: () => fetchProjectPhases(projectId!),
    enabled: !!projectId,
  });
};

export const useProjectTransitions = (projectId: string | null) => {
  return useQuery({
    queryKey: ['project-transitions', projectId],
    queryFn: () => fetchProjectTransitions(projectId!),
    enabled: !!projectId,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProjectFromChecklist(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projeto criado com sucesso!');
    },
    onError: () => toast.error('Erro ao criar projeto'),
  });
};

export const useUpdatePhaseStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      phaseId,
      projectId,
      phaseName,
      newStatus,
      oldStatus,
      reason,
    }: {
      phaseId: string;
      projectId: string;
      phaseName: string;
      newStatus: string;
      oldStatus: string;
      reason?: string;
    }) => updatePhaseStatus(phaseId, projectId, phaseName, newStatus, oldStatus, reason),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project-phases', vars.projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-transitions', vars.projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-by-id', vars.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['phase-detail'] });
      queryClient.invalidateQueries({ queryKey: ['phase-project-counts'] });

      // Contextual toast for evolution curadoria_ia completion
      if (vars.phaseName === 'curadoria_ia' && vars.newStatus === 'CONCLUÍDO') {
        toast.success('Projeto concluído com sucesso 🎉');
      } else {
        toast.success('Status atualizado');
      }
    },
    onError: (err: Error) => {
      // Don't show toast for complexity error — handled by dialog
      if (err?.message?.includes('complexidade')) return;
      toast.error(err?.message || 'Erro ao atualizar status');
    },
  });
};

export const useForcePhaseMove = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, targetPhaseName }: { projectId: string; targetPhaseName: string }) =>
      forceMovePhaseTo(projectId, targetPhaseName),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project-phases', vars.projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-transitions', vars.projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-by-id', vars.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['phase-detail'] });
      queryClient.invalidateQueries({ queryKey: ['phase-project-counts'] });
      toast.success('Projeto movido para nova etapa');
    },
    onError: () => toast.error('Erro ao mover projeto'),
  });
};

export const useDeletedProjects = () => {
  return useQuery({
    queryKey: ['deleted-projects'],
    queryFn: fetchDeletedProjects,
  });
};

export const useSoftDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, currentStatus }: { projectId: string; currentStatus: string }) =>
      softDeleteProject(projectId, currentStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-projects'] });
      queryClient.invalidateQueries({ queryKey: ['phase-detail'] });
      queryClient.invalidateQueries({ queryKey: ['phase-project-counts'] });
      toast.success('Projeto movido para a lixeira');
    },
    onError: () => toast.error('Erro ao excluir projeto'),
  });
};

export const useRestoreProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => restoreProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-projects'] });
      queryClient.invalidateQueries({ queryKey: ['phase-detail'] });
      queryClient.invalidateQueries({ queryKey: ['phase-project-counts'] });
      toast.success('Projeto restaurado com sucesso');
    },
    onError: () => toast.error('Erro ao restaurar projeto'),
  });
};

export const usePermanentDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => permanentDeleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted-projects'] });
      toast.success('Projeto excluído permanentemente');
    },
    onError: () => toast.error('Erro ao excluir projeto'),
  });
};

export const useFinalizeEvolution = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => finalizeEvolutionProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['phase-detail'] });
      queryClient.invalidateQueries({ queryKey: ['phase-project-counts'] });
      toast.success('Projeto de Evolução concluído com sucesso');
    },
    onError: () => toast.error('Erro ao finalizar projeto'),
  });
};

export const useAdvanceToAICuration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, currentSortOrder }: { projectId: string; currentSortOrder: number }) =>
      advanceEvolutionToAICuration(projectId, currentSortOrder),
    onSuccess: (result: AdvanceToAICurationResult) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['phase-detail'] });
      queryClient.invalidateQueries({ queryKey: ['phase-project-counts'] });
      toast.success('Projeto avançou para Curadoria de IA');
      if (result.usedFallback) {
        toast.warning('Prazo padrão de 25 dias aplicado', {
          description: 'O nível de dificuldade do projeto não está definido. Considere ajustá-lo.',
          duration: 8000,
        });
      }
    },
    onError: () => toast.error('Erro ao avançar projeto'),
  });
};
