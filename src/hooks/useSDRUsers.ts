import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useSDRUsers = () => {
  return useQuery({
    queryKey: ['sdr-users'],
    queryFn: async () => {
      const { data: roles, error: rolesErr } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'sdr');
      if (rolesErr) throw rolesErr;

      const ids = (roles ?? []).map(r => r.user_id);
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', ids)
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
    staleTime: 5 * 60_000,
  });
};
