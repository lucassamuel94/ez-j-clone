import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadContact {
  id: string;
  lead_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phone_2: string | null;
  role: string | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type LeadContactInput = Omit<LeadContact, 'id' | 'created_at' | 'updated_at'>;

export function useLeadContacts(leadId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['lead-contacts', leadId];

  const { data: contacts = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('lead_contacts')
        .select('*')
        .eq('lead_id', leadId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as LeadContact[];
    },
    enabled: !!leadId,
  });

  const createContact = useMutation({
    mutationFn: async (input: Partial<LeadContactInput> & { lead_id: string; name: string }) => {
      const { data, error } = await supabase
        .from('lead_contacts')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LeadContact> & { id: string }) => {
      const { data, error } = await supabase
        .from('lead_contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lead_contacts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { contacts, isLoading, createContact, updateContact, deleteContact };
}
