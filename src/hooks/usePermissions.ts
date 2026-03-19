import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRoleSimulation } from '@/stores/useRoleSimulation';
import { useAuthSession } from '@/contexts/AuthSessionContext';

export const usePermissions = (enabled: boolean = true) => {
  const { session } = useAuthSession();
  const userId = session?.user?.id;
  const { isSimulating, simulatedRole } = useRoleSimulation();

  const { data: realPermissions = new Set<string>(), isLoading } = useQuery({
    queryKey: ['userPermissions', userId],
    enabled: enabled && !!userId,
    retry: false,
    queryFn: async () => {
      if (!userId) return new Set<string>();

      const { data, error } = await supabase.rpc('get_user_permissions', {
        _user_id: userId,
      });

      if (error) {
        console.error('Error fetching permissions:', error);
        return new Set(['view_dashboard', 'view_notifications', 'view_tasks']);
      }

      return new Set<string>(data as string[]);
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: simulatedPermissions = new Set<string>() } = useQuery({
    queryKey: ['simulatedPermissions', simulatedRole],
    enabled: isSimulating && !!simulatedRole,
    queryFn: async () => {
      const { data: roleData } = await supabase
        .from('roles')
        .select('id')
        .eq('name', getRoleDisplayName(simulatedRole!))
        .single();

      if (!roleData) return new Set<string>();

      const { data: rpData } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', roleData.id);

      if (!rpData || rpData.length === 0) return new Set<string>();

      const permIds = rpData.map(rp => rp.permission_id);
      const { data: perms } = await supabase
        .from('permissions')
        .select('name')
        .in('id', permIds);

      return new Set<string>((perms || []).map(p => p.name));
    },
    staleTime: 5 * 60 * 1000,
  });

  const permissions = isSimulating ? simulatedPermissions : realPermissions;
  const hasPermission = (perm: string) => permissions.has(perm);

  return { permissions, hasPermission, isLoading: enabled ? isLoading : false };
};

function getRoleDisplayName(role: string): string {
  const map: Record<string, string> = {
    admin: 'Administrador',
    manager: 'Gerente',
    sdr: 'SDR',
    closer: 'Closer',
    head_pos_venda: 'Head Pós-Venda',
    ux_po: 'UX/PO',
    dev_chatbot: 'Dev Chatbot',
    treinamento: 'Treinamento',
  };
  return map[role] || role;
}
