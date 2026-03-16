import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Role {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  is_system: boolean;
  created_at: string;
}

export interface Permission {
  id: string;
  name: string;
  category: string;
  description: string;
}

export const useRoles = () => {
  const queryClient = useQueryClient();

  const { data: roles = [], isLoading: isLoadingRoles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name');
      if (error) throw error;
      return data as Role[];
    },
  });

  const { data: permissions = [], isLoading: isLoadingPermissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('category')
        .order('name');
      if (error) throw error;
      return data as Permission[];
    },
  });

  const { data: rolePermissions = [], isLoading: isLoadingRolePermissions } = useQuery({
    queryKey: ['rolePermissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('role_id, permission_id');
      if (error) throw error;
      return data as { role_id: string; permission_id: string }[];
    },
  });

  const getRolePermissionIds = (roleId: string): string[] => {
    return rolePermissions
      .filter((rp) => rp.role_id === roleId)
      .map((rp) => rp.permission_id);
  };

  const createRole = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const { data, error } = await supabase
        .from('roles')
        .insert({ name, description })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Perfil criado com sucesso.');
    },
    onError: (error: any) => {
      const msg = error.code === '23505' ? 'Já existe um perfil com este nome.' : 'Erro ao criar perfil.';
      toast.error(msg);
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description: string }) => {
      const { error } = await supabase.from('roles').update({ name, description }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Perfil atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar perfil.');
    },
  });

  const deleteRole = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('roles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Perfil removido');
    },
    onError: () => {
      toast.error('Erro ao remover perfil.');
    },
  });

  const updateRolePermissions = useMutation({
    mutationFn: async ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) => {
      // Delete existing
      const { error: delError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId);
      if (delError) throw delError;

      // Insert new
      if (permissionIds.length > 0) {
        const rows = permissionIds.map((pid) => ({ role_id: roleId, permission_id: pid }));
        const { error: insError } = await supabase.from('role_permissions').insert(rows);
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPermissions'] });
      toast.success('Permissões atualizadas');
    },
    onError: () => {
      toast.error('Erro ao atualizar permissões.');
    },
  });

  return {
    roles,
    permissions,
    rolePermissions,
    isLoading: isLoadingRoles || isLoadingPermissions || isLoadingRolePermissions,
    getRolePermissionIds,
    createRole,
    updateRole,
    deleteRole,
    updateRolePermissions,
  };
};
