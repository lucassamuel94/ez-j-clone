import { supabase } from '@/integrations/supabase/client';
import { Cadence, CadenceStep, Channel } from '@/types/lead';

// Fetch all cadences
export const fetchCadences = async (): Promise<Cadence[]> => {
  const { data, error } = await supabase
    .from('cadences')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching cadences:', error);
    throw error;
  }

  // Fetch steps for each cadence
  const cadencesWithSteps = await Promise.all(
    (data || []).map(async (cadence) => {
      const steps = await fetchCadenceSteps(cadence.id);
      return {
        id: cadence.id,
        name: cadence.name,
        description: cadence.description || '',
        active: cadence.active,
        steps,
      };
    })
  );

  return cadencesWithSteps;
};

// Fetch steps for a cadence
export const fetchCadenceSteps = async (cadenceId: string): Promise<CadenceStep[]> => {
  const { data, error } = await supabase
    .from('cadence_steps')
    .select('*')
    .eq('cadence_id', cadenceId)
    .order('step_number', { ascending: true });

  if (error) {
    console.error('Error fetching cadence steps:', error);
    throw error;
  }

  return (data || []).map(row => ({
    id: row.id,
    cadence_id: row.cadence_id,
    step_number: row.step_number,
    wait_hours: row.wait_hours,
    channel: row.channel as Channel,
    script_template: row.script_template,
    objective: row.objective,
  }));
};

// Create a new cadence
export const createCadence = async (cadence: { name: string; description?: string }): Promise<Cadence> => {
  const { data, error } = await supabase
    .from('cadences')
    .insert({
      name: cadence.name,
      description: cadence.description || null,
      active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating cadence:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    description: data.description || '',
    active: data.active,
    steps: [],
  };
};

// Update a cadence
export const updateCadence = async (id: string, updates: { name?: string; description?: string; active?: boolean }): Promise<void> => {
  const { error } = await supabase
    .from('cadences')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating cadence:', error);
    throw error;
  }
};

// Delete a cadence
export const deleteCadence = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('cadences')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting cadence:', error);
    throw error;
  }
};

// Create a cadence step
export const createCadenceStep = async (step: Omit<CadenceStep, 'id'>): Promise<CadenceStep> => {
  const { data, error } = await supabase
    .from('cadence_steps')
    .insert({
      cadence_id: step.cadence_id,
      step_number: step.step_number,
      wait_hours: step.wait_hours,
      channel: step.channel,
      script_template: step.script_template,
      objective: step.objective,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating cadence step:', error);
    throw error;
  }

  return {
    id: data.id,
    cadence_id: data.cadence_id,
    step_number: data.step_number,
    wait_hours: data.wait_hours,
    channel: data.channel as Channel,
    script_template: data.script_template,
    objective: data.objective,
  };
};

// Update a cadence step
export const updateCadenceStep = async (id: string, updates: Partial<CadenceStep>): Promise<void> => {
  const updateData: Record<string, unknown> = {};
  if (updates.wait_hours !== undefined) updateData.wait_hours = updates.wait_hours;
  if (updates.channel !== undefined) updateData.channel = updates.channel;
  if (updates.script_template !== undefined) updateData.script_template = updates.script_template;
  if (updates.objective !== undefined) updateData.objective = updates.objective;

  const { error } = await supabase
    .from('cadence_steps')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Error updating cadence step:', error);
    throw error;
  }
};

// Delete a cadence step
export const deleteCadenceStep = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('cadence_steps')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting cadence step:', error);
    throw error;
  }
};
