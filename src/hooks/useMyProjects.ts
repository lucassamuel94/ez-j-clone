import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';

export interface MyProject {
  id: string;
  company_name: string;
  project_type: string | null;
  current_phase: string | null;
  due_date: string | null;
  priority: string | null;
  overall_status: string | null;
  complexity_level: string | null;
}

export function useMyProjects() {
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['my-projects', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<MyProject[]> => {
      const uid = user!.id;

      // Check if user is admin/head — they see all active projects
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', uid)
        .single();

      const isHead = roleData?.role === 'admin' || roleData?.role === 'head_pos_venda' || roleData?.role === 'manager';

      let query = supabase
        .from('projects')
        .select('id, company_name, project_type, current_phase, due_date, priority, overall_status, complexity_level')
        .is('deleted_at', null)
        .not('overall_status', 'in', '("entregue","cancelado","concluido")');

      if (!isHead) {
        query = query.or(`ux_po_user_id.eq.${uid},dev_user_id.eq.${uid},treinamento_user_id.eq.${uid},ativacao_user_id.eq.${uid}`);
      }

      const { data, error } = await query.order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return (data ?? []) as MyProject[];
    },
  });
}
