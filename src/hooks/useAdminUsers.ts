import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AppRole = 'admin' | 'manager' | 'sdr' | 'closer' | 'head_pos_venda' | 'ux_po' | 'dev_chatbot' | 'treinamento';

export interface RoleOption {
  id: string;
  name: string;
  is_system: boolean;
  is_default: boolean;
}

export interface UserWithRole {
  id: string;
  name: string;
  email: string;
  active: boolean;
  role: AppRole | null;
  role_id: string | null;
  role_name: string | null;
  created_at: string;
  last_seen_at: string | null;
}

export interface UserInvitation {
  id: string;
  email: string;
  role: AppRole;
  invited_by: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

const isLovablePreview = typeof window !== 'undefined' &&
  (window.location.hostname.includes('id-preview--') || window.location.hostname.endsWith('.lovableproject.com'));

export const useAdminUsers = () => {
  const queryClient = useQueryClient();

  // Combined admin + manager check in a single query to reduce network calls
  const { data: roleFlags, isLoading: isCheckingRole } = useQuery({
    queryKey: ['adminManagerCheck'],
    queryFn: async () => {
      if (isLovablePreview) return { isAdmin: true, isManager: false };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { isAdmin: false, isManager: false };
      
      const [adminRes, managerRes] = await Promise.all([
        supabase.rpc('is_admin', { _user_id: user.id }),
        supabase.rpc('is_manager', { _user_id: user.id }),
      ]);
      
      return {
        isAdmin: adminRes.error ? false : !!adminRes.data,
        isManager: managerRes.error ? false : !!managerRes.data,
      };
    },
    staleTime: 5 * 60_000,
  });

  const isAdmin = roleFlags?.isAdmin ?? false;
  const isManager = roleFlags?.isManager ?? false;
  const isCheckingAdmin = isCheckingRole;
  const isCheckingManager = isCheckingRole;

  // Fetch available roles from roles table
  const { data: availableRoles = [] } = useQuery({
    queryKey: ['availableRoles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, is_system, is_default')
        .order('name');
      if (error) throw error;
      return data as RoleOption[];
    },
    enabled: isAdmin === true,
  });

  // Fetch all users with their roles
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, created_at, active, last_seen_at');
      
      if (profilesError) throw profilesError;

      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, role_id');
      
      if (rolesError) throw rolesError;

      // Fetch role names for mapping
      const { data: allRoles } = await supabase
        .from('roles')
        .select('id, name');

      const roleNameMap = new Map((allRoles || []).map(r => [r.id, r.name]));

      const usersWithRoles: UserWithRole[] = profiles.map(profile => {
        const userRole = userRoles?.find(r => r.user_id === profile.id);
        const roleId = userRole?.role_id ?? null;
        return {
          id: profile.id,
          name: profile.name,
          email: profile.name,
          active: profile.active ?? true,
          role: userRole?.role as AppRole | null,
          role_id: roleId,
          role_name: roleId ? (roleNameMap.get(roleId) ?? null) : null,
          created_at: profile.created_at,
          last_seen_at: (profile as any).last_seen_at ?? null,
        };
      });

      return usersWithRoles;
    },
    enabled: isAdmin === true,
  });

  // Fetch pending invitations
  const { data: invitations = [], isLoading: isLoadingInvitations } = useQuery({
    queryKey: ['userInvitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .is('accepted_at', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as UserInvitation[];
    },
    enabled: isAdmin === true,
  });

  // Update user active status
  const toggleUserActive = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ active })
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success(`Usuário ${active ? 'ativado' : 'desativado'} com sucesso.`);
    },
    onError: (error) => {
      toast.error('Não foi possível atualizar o status do usuário.');
      console.error('Error toggling user active:', error);
    },
  });

  // Update user role via role_id (trigger syncs enum automatically)
  const updateUserRole = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      // Delete existing role entry
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      // Insert new role with role_id — trigger sync_role_enum_from_role_id will set the enum
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'sdr' as any, role_id: roleId });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success('O perfil do usuário foi atualizado com sucesso.');
    },
    onError: (error) => {
      toast.error('Não foi possível atualizar o perfil do usuário.');
      console.error('Error updating user role:', error);
    },
  });

  // Update user name
  const updateUserName = useMutation({
    mutationFn: async ({ userId, name }: { userId: string; name: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ name })
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success('O nome do usuário foi atualizado com sucesso.');
    },
    onError: (error) => {
      toast.error('Não foi possível atualizar o nome do usuário.');
      console.error('Error updating user name:', error);
    },
  });

  // Create invitation
  const createInvitation = useMutation({
    mutationFn: async ({ email, role, roleId, teamId }: { email: string; role: AppRole; roleId?: string; teamId?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      let inviterName = 'Administrador';
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();
        if (profile?.name) {
          inviterName = profile.name;
        }
      }
      
      const insertData: any = { 
        email, 
        role,
        invited_by: user?.id,
      };
      if (roleId) insertData.role_id = roleId;
      if (teamId) insertData.team_id = teamId;

      const { data: invitation, error } = await supabase
        .from('user_invitations')
        .insert(insertData)
        .select()
        .single();
      
      if (error) throw error;

      // Send invite email with unique invitation link
      const signupUrl = `${window.location.origin}/login?invite=${invitation.id}`;
      
      const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
        body: {
          email,
          role,
          invitedByName: inviterName,
          signupUrl,
        },
      });

      if (emailError) {
        console.error('Error sending invite email:', emailError);
        // Don't throw - invitation was created, just log the email error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userInvitations'] });
      toast.success('O convite foi criado e o email foi enviado.');
    },
    onError: (error: any) => {
      const message = error.code === '23505' 
        ? 'Já existe um convite para este e-mail.'
        : 'Não foi possível criar o convite.';
      toast.error(message);
      console.error('Error creating invitation:', error);
    },
  });

  // Delete invitation
  const deleteInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('user_invitations')
        .delete()
        .eq('id', invitationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userInvitations'] });
      toast.success('O convite foi removido com sucesso.');
    },
    onError: (error) => {
      toast.error('Não foi possível remover o convite.');
      console.error('Error deleting invitation:', error);
    },
  });

  return {
    isAdmin,
    isCheckingAdmin,
    isManager,
    isCheckingManager,
    users,
    isLoadingUsers,
    availableRoles,
    invitations,
    isLoadingInvitations,
    toggleUserActive,
    updateUserRole,
    updateUserName,
    createInvitation,
    deleteInvitation,
  };
};
