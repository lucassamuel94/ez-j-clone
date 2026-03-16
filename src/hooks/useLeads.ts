import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  fetchLeads, 
  fetchLeadsPaginated,
  fetchLeadTabCounts,
  createLead, 
  updateLead, 
  deleteLead,
  fetchLeadInteractions,
  createInteraction,
  fetchLeadNotes,
  createLeadNote,
  updateLeadNote,
  deleteLeadNote,
  getCadenceStep,
  LeadSearchParams,
} from '@/services/leadService';
import { Lead, Interaction, LeadNote, CadenceStep } from '@/types/lead';

// Hook to fetch all leads (legacy - used by components that need full dataset)
export const useLeads = () => {
  return useQuery({
    queryKey: ['leads'],
    queryFn: fetchLeads,
    staleTime: 30_000,
  });
};

// Hook for server-side paginated leads
export const useLeadsPaginated = (params: LeadSearchParams) => {
  return useQuery({
    queryKey: ['leads-paginated', params],
    queryFn: () => fetchLeadsPaginated(params),
    enabled: params.sdrId !== 'pending',
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
};

// Hook for tab counts (lightweight)
export const useLeadTabCounts = (sdrId: string) => {
  return useQuery({
    queryKey: ['lead-tab-counts', sdrId],
    queryFn: () => fetchLeadTabCounts(sdrId),
    enabled: sdrId !== 'pending',
    staleTime: 30_000,
  });
};

// Hook to create a lead
export const useCreateLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
    },
  });
};

// Hook to update a lead
export const useUpdateLead = () => {
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Lead> }) => 
      updateLead(id, updates),
    // NOTE: Do NOT invalidate queries on success here.
    // Both LeadInbox and CloserPipelinePage apply optimistic cache updates
    // before calling mutate(). Invalidating would trigger a refetch that
    // overwrites the user's in-progress typing (e.g. qualification_notes textarea).
  });
};

// Hook to delete a lead
export const useDeleteLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
    },
  });
};

// Hook to bulk delete leads
export const useBulkDeleteLeads = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadIds: string[]) => {
      // Delete leads one by one (the RLS policy will verify admin status)
      const results = await Promise.all(
        leadIds.map(id => deleteLead(id))
      );
      return results.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['lead-tab-counts'] });
    },
  });
};

// Hook to fetch lead interactions
export const useLeadInteractions = (leadId: string | null) => {
  return useQuery({
    queryKey: ['interactions', leadId],
    queryFn: () => fetchLeadInteractions(leadId!),
    enabled: !!leadId,
  });
};

// Hook to create an interaction
export const useCreateInteraction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createInteraction,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['interactions', data.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-paginated'] });
    },
  });
};

// Hook to fetch lead notes
export const useLeadNotes = (leadId: string | null) => {
  return useQuery({
    queryKey: ['notes', leadId],
    queryFn: () => fetchLeadNotes(leadId!),
    enabled: !!leadId,
  });
};

// Hook to create a note
export const useCreateNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createLeadNote,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notes', data.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['lead-last-notes', data.lead_id] });
    },
  });
};

// Hook to update a note
export const useUpdateNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ noteId, noteText }: { noteId: string; noteText: string }) =>
      updateLeadNote(noteId, noteText),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notes', data.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['lead-last-notes', data.lead_id] });
    },
  });
};

// Hook to delete a note (optimistic)
export const useDeleteNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ noteId, leadId }: { noteId: string; leadId: string }) =>
      deleteLeadNote(noteId),
    onMutate: async ({ noteId, leadId }) => {
      await queryClient.cancelQueries({ queryKey: ['notes', leadId] });
      await queryClient.cancelQueries({ queryKey: ['lead-last-notes', leadId] });

      const prevNotes = queryClient.getQueryData(['notes', leadId]);
      const prevLastNotes = queryClient.getQueryData(['lead-last-notes', leadId]);

      queryClient.setQueryData(['notes', leadId], (old: any[] | undefined) =>
        old ? old.filter((n: any) => n.id !== noteId) : []
      );
      queryClient.setQueryData(['lead-last-notes', leadId], (old: any[] | undefined) =>
        old ? old.filter((n: any) => n.id !== noteId) : []
      );

      return { prevNotes, prevLastNotes, leadId };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevNotes) queryClient.setQueryData(['notes', context.leadId], context.prevNotes);
      if (context?.prevLastNotes) queryClient.setQueryData(['lead-last-notes', context.leadId], context.prevLastNotes);
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notes', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-last-notes', variables.leadId] });
    },
  });
};

// Hook to fetch a cadence step
export const useCadenceStep = (cadenceId: string | null, stepNumber: number | null) => {
  return useQuery({
    queryKey: ['cadenceStep', cadenceId, stepNumber],
    queryFn: () => getCadenceStep(cadenceId!, stepNumber!),
    enabled: !!cadenceId && !!stepNumber,
  });
};
