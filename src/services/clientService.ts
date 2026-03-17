import { supabase } from '@/integrations/supabase/client';
import { ActiveClient } from '@/hooks/useActiveClients';

/** Update an active client record */
export async function updateActiveClient(
  clientId: string,
  updates: Partial<ActiveClient>,
): Promise<void> {
  // Map ActiveClient field names to accounts column names
  const mapped: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (k === 'company') { mapped['company_name'] = v; }
    else if (k === 'segment') { mapped['company_segment'] = v; }
    else if (k === 'account_owner_name') { /* computed, skip */ }
    else { mapped[k] = v; }
  }

  const { error } = await supabase
    .from('accounts')
    .update(mapped)
    .eq('id', clientId);

  if (error) throw new Error(`Erro ao atualizar cliente: ${error.message}`);
}
