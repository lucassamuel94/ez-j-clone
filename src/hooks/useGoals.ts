import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type GoalType = 'sdr' | 'closer' | 'ux_po' | 'dev_chatbot' | 'treinamento';

export interface Goal {
  id: string;
  created_by: string;
  target_user_id: string | null;
  period_month: number;
  period_year: number;
  goal_type: GoalType;
  meetings_scheduled_goal: number;
  meetings_held_percentage: number;
  sqo_percentage: number;
  setup_revenue_goal: number;
  conversion_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface GoalFormData {
  target_user_id: string | null;
  period_month: number;
  period_year: number;
  goal_type: GoalType;
  meetings_scheduled_goal: number;
  meetings_held_percentage: number;
  sqo_percentage: number;
  setup_revenue_goal: number;
  conversion_percentage: number;
}

export const useGoals = (periodMonth?: number, periodYear?: number) => {
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals', periodMonth, periodYear],
    queryFn: async () => {
      let query = supabase.from('goals').select('*');
      if (periodMonth) query = query.eq('period_month', periodMonth);
      if (periodYear) query = query.eq('period_year', periodYear);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data as Goal[];
    },
  });

  const upsertGoal = useMutation({
    mutationFn: async (goal: GoalFormData) => {
      // Check if goal exists for this user/period
      let query = supabase
        .from('goals')
        .select('id')
        .eq('period_month', goal.period_month)
        .eq('period_year', goal.period_year)
        .eq('goal_type', goal.goal_type);

      if (goal.target_user_id) {
        query = query.eq('target_user_id', goal.target_user_id);
      } else {
        query = query.is('target_user_id', null);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        const updateData = goal.goal_type === 'closer'
          ? { setup_revenue_goal: goal.setup_revenue_goal, conversion_percentage: goal.conversion_percentage }
          : { meetings_scheduled_goal: goal.meetings_scheduled_goal, meetings_held_percentage: goal.meetings_held_percentage, sqo_percentage: goal.sqo_percentage };
        const { error } = await supabase
          .from('goals')
          .update(updateData)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Não autenticado');
        const { error } = await supabase.from('goals').insert({
          ...goal,
          created_by: user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      toast.success('Meta salva com sucesso!');
    },
    onError: (error) => {
      console.error('Error saving goal:', error);
      toast.error('Erro ao salvar meta');
    },
  });

  const deleteGoal = useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase.from('goals').delete().eq('id', goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      toast.success('Meta removida');
    },
    onError: () => {
      toast.error('Erro ao remover meta');
    },
  });

  const copyToNextMonth = useMutation({
    mutationFn: async ({ goals, nextMonth, nextYear }: { goals: Goal[]; nextMonth: number; nextYear: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      for (const goal of goals) {
        // Check if already exists
        let query = supabase
          .from('goals')
          .select('id')
          .eq('period_month', nextMonth)
          .eq('period_year', nextYear)
          .eq('goal_type', goal.goal_type);

        if (goal.target_user_id) {
          query = query.eq('target_user_id', goal.target_user_id);
        } else {
          query = query.is('target_user_id', null);
        }

        const { data: existing } = await query.maybeSingle();
        if (existing) continue; // skip duplicates

        const { error } = await supabase.from('goals').insert({
          target_user_id: goal.target_user_id,
          period_month: nextMonth,
          period_year: nextYear,
          goal_type: goal.goal_type,
          meetings_scheduled_goal: goal.meetings_scheduled_goal,
          meetings_held_percentage: goal.meetings_held_percentage,
          sqo_percentage: goal.sqo_percentage,
          setup_revenue_goal: goal.setup_revenue_goal,
          conversion_percentage: goal.conversion_percentage,
          created_by: user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      toast.success('Metas copiadas para o próximo mês!');
    },
    onError: () => {
      toast.error('Erro ao copiar metas');
    },
  });

  return { goals, isLoading, upsertGoal, deleteGoal, copyToNextMonth };
};
