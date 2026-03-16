import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchLeadById } from '@/services/leadService';
import { supabase } from '@/integrations/supabase/client';

export function useLeadModal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const leadId = searchParams.get('lead') || null;
  const oppId = searchParams.get('opp') || null;

  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ['lead-by-id', leadId],
    queryFn: () => fetchLeadById(leadId!),
    enabled: !!leadId,
    staleTime: 30_000,
  });

  const { data: opportunity } = useQuery({
    queryKey: ['opportunity-by-id', oppId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select('*, closer:profiles!opportunities_assigned_to_user_id_fkey(name), sdr:profiles!opportunities_sdr_user_id_fkey(name)')
        .eq('id', oppId!)
        .single();
      if (error) throw error;
      return {
        ...data,
        closer_name: (data.closer as any)?.name || null,
        sdr_name: (data.sdr as any)?.name || null,
      };
    },
    enabled: !!oppId,
    staleTime: 30_000,
  });

  const isOpen = !!leadId;

  const openLead = useCallback(
    (id: string, opportunityId?: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('lead', id);
          if (opportunityId) {
            next.set('opp', opportunityId);
          } else {
            next.delete('opp');
          }
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const closeLead = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('lead');
        next.delete('opp');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  return useMemo(
    () => ({
      lead: lead ?? null,
      opportunity: opportunity ?? null,
      isOpen,
      isLoading: leadLoading,
      openLead,
      closeLead,
    }),
    [lead, opportunity, isOpen, leadLoading, openLead, closeLead],
  );
}
