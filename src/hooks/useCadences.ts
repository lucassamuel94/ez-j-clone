import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCadences,
  createCadence,
  updateCadence,
  deleteCadence,
  createCadenceStep,
  updateCadenceStep,
  deleteCadenceStep,
} from '@/services/cadenceService';
import { CadenceStep } from '@/types/lead';

export const useCadences = () => {
  return useQuery({
    queryKey: ['cadences'],
    queryFn: fetchCadences,
  });
};

export const useCreateCadence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCadence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadences'] });
    },
  });
};

export const useUpdateCadence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { name?: string; description?: string; active?: boolean } }) =>
      updateCadence(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadences'] });
    },
  });
};

export const useDeleteCadence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCadence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadences'] });
    },
  });
};

export const useCreateCadenceStep = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCadenceStep,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadences'] });
    },
  });
};

export const useUpdateCadenceStep = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CadenceStep> }) =>
      updateCadenceStep(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadences'] });
    },
  });
};

export const useDeleteCadenceStep = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCadenceStep,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadences'] });
    },
  });
};
