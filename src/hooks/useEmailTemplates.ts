import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_by: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  attachments?: any[];
  team_ids?: string[];
}

export const useEmailTemplates = () => {
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates' as any)
        .select('*')
        .eq('active', true)
        .order('name');
      if (error) throw error;

      const templateIds = (data as any[]).map((t: any) => t.id);
      let teamMap: Record<string, string[]> = {};

      if (templateIds.length > 0) {
        const { data: teamLinks } = await supabase
          .from('email_template_teams' as any)
          .select('template_id, team_id')
          .in('template_id', templateIds);

        if (teamLinks) {
          (teamLinks as any[]).forEach((link: any) => {
            if (!teamMap[link.template_id]) teamMap[link.template_id] = [];
            teamMap[link.template_id].push(link.team_id);
          });
        }
      }

      return (data as any[]).map((t: any) => ({
        ...t,
        team_ids: teamMap[t.id] || [],
      })) as unknown as EmailTemplate[];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (template: { name: string; subject: string; body: string; attachments?: any[]; team_ids?: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { team_ids, ...rest } = template;
      const { data, error } = await supabase
        .from('email_templates' as any)
        .insert({ ...rest, created_by: user.id })
        .select()
        .single();
      if (error) throw error;

      // Save team associations
      if (team_ids && team_ids.length > 0) {
        const rows = team_ids.map(tid => ({ template_id: (data as any).id, team_id: tid }));
        await supabase.from('email_template_teams' as any).insert(rows);
      }

      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-templates'] }),
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, team_ids, ...updates }: { id: string; name?: string; subject?: string; body?: string; active?: boolean; attachments?: any[]; team_ids?: string[] }) => {
      const { error } = await supabase
        .from('email_templates' as any)
        .update(updates)
        .eq('id', id);
      if (error) throw error;

      // Sync team associations: delete all then re-insert
      if (team_ids !== undefined) {
        await supabase.from('email_template_teams' as any).delete().eq('template_id', id);
        if (team_ids.length > 0) {
          const rows = team_ids.map(tid => ({ template_id: id, team_id: tid }));
          await supabase.from('email_template_teams' as any).insert(rows);
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-templates'] }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_templates' as any)
        .update({ active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-templates'] }),
  });

  return { templates, isLoading, createTemplate, updateTemplate, deleteTemplate };
};
