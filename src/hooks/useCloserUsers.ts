import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useCloserUsers = () => {
  return useQuery({
    queryKey: ['closer-users'],
    queryFn: async () => {
      const { data: roles, error: rolesErr } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'closer');
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
