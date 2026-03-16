import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SystemUser {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  whatsapp: string | null;
}

export const useSystemUsers = () => {
  return useQuery({
    queryKey: ['system-users'],
    queryFn: async (): Promise<SystemUser[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url, whatsapp')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
};
