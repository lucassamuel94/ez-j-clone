import { supabase } from '@/integrations/supabase/client';
import { ActiveClient } from '@/hooks/useActiveClients';

/** Update an active client record */
export async function updateActiveClient(
  clientId: string,
  updates: Partial<ActiveClient>,
): Promise<void> {
  const { error } = await supabase
    .from('active_clients' as any)
    .update(updates as any)
    .eq('id', clientId);

  if (error) throw new Error(`Erro ao atualizar cliente: ${error.message}`);
}
