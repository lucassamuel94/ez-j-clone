import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRoleSimulation } from '@/stores/useRoleSimulation';
import { useAuthSession } from '@/contexts/AuthSessionContext';

export type UserRole = 'admin' | 'manager' | 'sdr' | 'closer' | 'moderator' | 'head_pos_venda' | 'ux_po' | 'dev_chatbot' | 'treinamento' | 'suporte' | 'verificacao_bm' | 'viewer';

const isLovablePreview = typeof window !== 'undefined' &&
  (window.location.hostname.includes('id-preview--') || window.location.hostname.endsWith('.lovableproject.com'));

export const useUserRole = (enabled: boolean = true) => {
  const { session } = useAuthSession();
  const userId = session?.user?.id;
  const { isSimulating, simulatedRole } = useRoleSimulation();

  // In preview, always return admin
  if (isLovablePreview) {
    return {
      role: 'admin' as UserRole,
      isLoading: false,
      isCloser: false,
      isSdr: false,
      isAdmin: true,
      isManager: false,
      isProjectRole: false,
      canAccessBoth: true,
      isRealAdmin: true,
      isSimulating: false,
    };
  }

  const { data: realRole, isLoading } = useQuery({
    queryKey: ['userRole', userId],
    enabled: enabled && !!userId,
    retry: false,
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }
      return data.role as UserRole;
    },
    staleTime: 5 * 60 * 1000,
  });

  const role = isSimulating && simulatedRole ? simulatedRole : realRole;

  const isRealAdmin = realRole === 'admin' || realRole === 'head_pos_venda';

  const isCloser = role === 'closer';
  const isSdr = role === 'sdr';
  const isAdmin = role === 'admin' || role === 'head_pos_venda';
  const isManager = role === 'manager';
  const isProjectRole = role === 'head_pos_venda' || role === 'ux_po' || role === 'dev_chatbot' || role === 'treinamento' || role === 'suporte' || role === 'verificacao_bm';
  const canAccessBoth = isAdmin || isManager;

  return { role, isLoading: enabled ? isLoading : false, isCloser, isSdr, isAdmin, isManager, isProjectRole, canAccessBoth, isRealAdmin, isSimulating };
};
