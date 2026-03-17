import { supabase } from '@/integrations/supabase/client';

export interface ProjectTask {
  id: string;
  project_id: string;
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
  // joined
  assigned_user_name?: string;
}

export const fetchProjectTasks = async (projectId: string): Promise<ProjectTask[]> => {
  const { data, error } = await supabase
    .from('project_tasks')
    .select('*, profiles!project_tasks_assigned_user_id_fkey(name)')
    .eq('project_id', projectId)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data || []).map((t: any) => ({
    ...t,
    assigned_user_name: t.profiles?.name || null,
  }));
};

export const createProjectTask = async (task: {
  project_id?: string;
  title: string;
  description?: string;
  due_date?: string;
  assigned_user_id?: string;
  notify_before?: string;
  task_type?: string;
  priority?: string;
  opportunity_id?: string;
  lead_id?: string;
}) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data, error } = await supabase
    .from('project_tasks')
    .insert({
      ...task,
      created_by_user_id: user.id,
    } as any)
    .select()
    .single();

  if (error) throw error;

  // Sync lead next_action_at after creation
  if (task.due_date && (task.lead_id || task.opportunity_id)) {
    const leadId = await resolveLeadIdFromTask(task as any);
    if (leadId) await syncLeadNextAction(leadId, task.due_date);
  }

  return data;
};

// --- Lead next_action_at sync helpers ---

async function resolveLeadIdFromTask(task: { lead_id?: string | null; opportunity_id?: string | null }): Promise<string | null> {
  if (task.lead_id) return task.lead_id;
  if (task.opportunity_id) {
    const { data } = await supabase
      .from('opportunities')
      .select('lead_id')
      .eq('id', task.opportunity_id)
      .single();
    return data?.lead_id ?? null;
  }
  return null;
}

async function syncLeadNextAction(leadId: string, newDueDate: string) {
  const { data: lead } = await supabase
    .from('leads')
    .select('next_action_at')
    .eq('id', leadId)
    .single();

  if (!lead) return;

  const now = Date.now();
  const current = lead.next_action_at ? new Date(lead.next_action_at).getTime() : null;
  const incoming = new Date(newDueDate).getTime();

  // Update if: no current date, new date is earlier, OR current date is overdue and new date is in the future
  if (current === null || incoming < current || (current < now && incoming >= now)) {
    await supabase
      .from('leads')
      .update({ next_action_at: newDueDate } as any)
      .eq('id', leadId);
  }
}

// --- End sync helpers ---

export const updateProjectTask = async (taskId: string, updates: Record<string, unknown>) => {
  // Reset reminder if due_date or notify_before changed so a new reminder can be sent
  if ('due_date' in updates || 'notify_before' in updates) {
    updates = { ...updates, reminder_sent_at: null };
  }

  const { error } = await supabase
    .from('project_tasks')
    .update(updates as any)
    .eq('id', taskId);

  if (error) throw error;

  // Sync lead next_action_at if due_date changed
  if (updates.due_date) {
    const { data: task } = await supabase
      .from('project_tasks')
      .select('lead_id, opportunity_id')
      .eq('id', taskId)
      .single();

    if (task) {
      const leadId = await resolveLeadIdFromTask(task as any);
      if (leadId) await syncLeadNextAction(leadId, updates.due_date as string);
    }
  }
};

export const deleteProjectTask = async (taskId: string) => {
  const { error } = await supabase
    .from('project_tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw error;
};

export const updateProjectFields = async (projectId: string, fields: Record<string, unknown>) => {
  const { data, error } = await supabase
    .from('projects')
    .update(fields as any)
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export interface ProjectActivity {
  id: string;
  project_id: string;
  user_id: string | null;
  action_type: string;
  phase_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string;
  created_at: string;
  updated_at: string | null;
  parent_id: string | null;
  user_name?: string;
  user_avatar_url?: string | null;
}

export const fetchProjectActivities = async (projectId: string): Promise<ProjectActivity[]> => {
  const { data, error } = await supabase
    .from('project_activity_logs')
    .select('*, profiles!project_activity_logs_user_id_fkey(name, avatar_url)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) throw error;
  return (data || []).map((a: any) => ({
    ...a,
    user_name: a.profiles?.name || null,
    user_avatar_url: a.profiles?.avatar_url || null,
  }));
};

export const createProjectActivity = async (activity: {
  project_id: string;
  action_type: string;
  description: string;
  phase_name?: string;
  old_value?: string;
  new_value?: string;
}) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data, error } = await supabase
    .from('project_activity_logs')
    .insert({
      ...activity,
      user_id: user.id,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateProjectActivity = async (activityId: string, description: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data, error } = await supabase
    .from('project_activity_logs')
    .update({ description, updated_at: new Date().toISOString() } as any)
    .eq('id', activityId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteProjectActivity = async (activityId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { error } = await supabase
    .from('project_activity_logs')
    .delete()
    .eq('id', activityId)
    .eq('user_id', user.id);

  if (error) throw error;
};

export const createProjectActivityReply = async (activity: {
  project_id: string;
  action_type: string;
  description: string;
  parent_id: string;
}) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data, error } = await supabase
    .from('project_activity_logs')
    .insert({
      ...activity,
      user_id: user.id,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data;
};
