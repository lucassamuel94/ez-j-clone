import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchApiOficialDeals,
  updateApiOficialStage,
  updateApiOficialNotes,
  markApiOficialLost,
  createApiOficialDeal,
  deleteApiOficialDeal,
  ApiOficialDeal,
} from '@/services/apiOficialService';
import { toast } from 'sonner';
import { useCallback } from 'react';

const QUERY_KEY = ['api-oficial-deals'];

export function useApiOficialDeals(closerId?: string | null, search?: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, closerId, search],
    queryFn: () => fetchApiOficialDeals(closerId, search),
    staleTime: 30_000,
  });
}

export function useApiOficialMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);

  const moveStage = useMutation({
    mutationFn: ({ dealId, stage }: { dealId: string; stage: string }) =>
      updateApiOficialStage(dealId, stage),
    onSuccess: () => {
      invalidateAll();
      toast.success('Estágio atualizado');
    },
    onError: () => toast.error('Erro ao atualizar estágio'),
  });

  const updateNotes = useMutation({
    mutationFn: ({ dealId, notes }: { dealId: string; notes: string }) =>
      updateApiOficialNotes(dealId, notes),
    onSuccess: () => {
      invalidateAll();
      toast.success('Notas atualizadas');
    },
    onError: () => toast.error('Erro ao atualizar notas'),
  });

  const lostMutation = useMutation({
    mutationFn: ({ dealId, reason }: { dealId: string; reason: string }) =>
      markApiOficialLost(dealId, reason),
    onSuccess: () => {
      invalidateAll();
      toast.success('Deal marcado como "Não quer agora"');
    },
    onError: () => toast.error('Erro ao marcar deal'),
  });

  const createDeal = useMutation({
    mutationFn: createApiOficialDeal,
    onSuccess: () => {
      invalidateAll();
      toast.success('Deal criado com sucesso');
    },
    onError: () => toast.error('Erro ao criar deal'),
  });

  const deleteDeal = useMutation({
    mutationFn: deleteApiOficialDeal,
    onSuccess: () => {
      invalidateAll();
      toast.success('Deal removido');
    },
    onError: () => toast.error('Erro ao remover deal'),
  });

  return {
    moveStage,
    updateNotes,
    lostMutation,
    createDeal,
    deleteDeal,
    invalidateAll,
  };
}
