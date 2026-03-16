import { supabase } from '@/integrations/supabase/client';

export interface AutoAssignResult {
  head_user_id: string | null;
  ux_po_user_id: string | null;
  dev_user_id: string | null;
  treinamento_user_id: string | null;
}

/**
 * Resolves all project role assignments in a single RPC call.
 * Head: from system_config; UX/PO, Dev, Treinamento: least-loaded active user.
 */
export async function resolveAutoAssignments(): Promise<AutoAssignResult> {
  const { data, error } = await (supabase as unknown as { rpc: (fn: string) => Promise<{ data: unknown; error: unknown }> }).rpc('get_least_loaded_users');

  if (error) {
    console.error('get_least_loaded_users failed:', error);
    throw new Error('Falha na atribuição automática de equipe.');
  }

  const result = data as Record<string, string | null>;

  return {
    head_user_id: result.head_user_id ?? null,
    ux_po_user_id: result.ux_po_user_id ?? null,
    dev_user_id: result.dev_user_id ?? null,
    treinamento_user_id: result.treinamento_user_id ?? null,
  };
}
