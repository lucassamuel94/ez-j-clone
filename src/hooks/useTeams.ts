import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Team {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  created_at: string;
  profile?: { id: string; name: string; avatar_url: string | null };
}

export const useTeams = () => {
  const queryClient = useQueryClient();

  const { data: teams = [], isLoading: isLoadingTeams } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Team[];
    },
  });

  const { data: teamMembers = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*');
      if (error) throw error;

      // Fetch profiles for member names
      const userIds = [...new Set(data.map((m: any) => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      return data.map((m: any) => ({
        ...m,
        profile: profileMap.get(m.user_id) || undefined,
      })) as TeamMember[];
    },
  });

  const getTeamMembers = (teamId: string) =>
    teamMembers.filter((m) => m.team_id === teamId);

  const createTeam = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const { data, error } = await supabase
        .from('teams')
        .insert({ name, description })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Equipe criada');
    },
    onError: () => {
      toast.error('Erro ao criar equipe.');
    },
  });

  const deleteTeam = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      toast.success('Equipe removida');
    },
    onError: () => {
      toast.error('Erro ao remover equipe.');
    },
  });

  const addMember = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      const { error } = await supabase
        .from('team_members')
        .insert({ team_id: teamId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      toast.success('Membro adicionado');
    },
    onError: (error: any) => {
      const msg = error.code === '23505' ? 'Membro já pertence a esta equipe.' : 'Erro ao adicionar membro.';
      toast.error(msg);
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      toast.success('Membro removido');
    },
    onError: () => {
      toast.error('Erro ao remover membro.');
    },
  });

  return {
    teams,
    teamMembers,
    isLoading: isLoadingTeams || isLoadingMembers,
    getTeamMembers,
    createTeam,
    deleteTeam,
    addMember,
    removeMember,
  };
};
