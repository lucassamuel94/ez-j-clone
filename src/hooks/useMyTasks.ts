import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export interface MyTask {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  assigned_user_id: string | null;
  status: string;
  notify_before: string | null;
  created_by_user_id: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  task_type: string;
  priority: string;
  opportunity_id: string | null;
  lead_id: string | null;
  // computed context
  project_company_name?: string;
  context_label: string;
  context_type: 'project' | 'opportunity' | 'lead' | 'none';
  // for navigation
  context_lead_id?: string | null;
}

export const useMyTasks = () => {
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['my-tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('project_tasks')
        .select(`
          *,
          projects!project_tasks_project_id_fkey(company_name),
          opportunities!project_tasks_opportunity_id_fkey(id, lead_id, stage),
          leads!project_tasks_lead_id_fkey(id, company, name)
        `)
        .eq('assigned_user_id', user.id)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return (data || []).map((t: any) => {
        const projectName = t.projects?.company_name || null;
        const oppLeadId = t.opportunities?.lead_id || null;
        const directLeadCompany = t.leads?.company || null;

        let context_label = 'Sem vínculo';
        let context_type: 'project' | 'opportunity' | 'lead' | 'none' = 'none';
        let context_lead_id: string | null = null;

        if (t.project_id && projectName) {
          context_label = `Projeto: ${projectName}`;
          context_type = 'project';
        } else if (t.opportunity_id) {
          context_label = directLeadCompany
            ? `Empresa: ${directLeadCompany}`
            : t.leads?.company
              ? `Empresa: ${t.leads.company}`
              : 'Oportunidade';
          context_type = 'opportunity';
          context_lead_id = oppLeadId || t.lead_id;
        } else if (t.lead_id && directLeadCompany) {
          context_label = `Empresa: ${directLeadCompany}`;
          context_type = 'lead';
          context_lead_id = t.lead_id;
        }

        return {
          ...t,
          project_company_name: projectName || directLeadCompany || 'Sem vínculo',
          context_label,
          context_type,
          context_lead_id: context_lead_id || oppLeadId,
        } as MyTask;
      });
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
};
