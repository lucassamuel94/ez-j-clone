import { Lead } from '@/types/lead';
import { CloserOpportunity } from '@/services/closerService';

/**
 * Creates a minimal Lead object from a CloserOpportunity for use in EmailComposeDialog.
 * Prevents duplicating this mapping logic across components.
 */
export function buildLeadFromOpportunity(opp: CloserOpportunity): Lead {
  return {
    id: opp.lead_id,
    name: opp.lead_name || '',
    company: opp.lead_company || '',
    razao_social: opp.lead_razao_social || null,
    nome_fantasia: opp.lead_nome_fantasia || null,
    email: opp.lead_email || null,
    phone: opp.lead_phone || null,
    phone_2: opp.lead_phone_2 || null,
    phone_3: opp.lead_phone_3 || null,
    phone_4: opp.lead_phone_4 || null,
    status: (opp.lead_status as any) || 'Novo',
    temperature: (opp.lead_temperature as any) || null,
    lead_type: 'INBOUND' as const,
    priority_score: 0,
    attempts_count: 0,
    source: null,
    owner_user_id: null,
    last_contact_at: opp.lead_last_contact_at || null,
    next_action_at: opp.lead_next_action_at || new Date().toISOString(),
    created_at: opp.created_at,
    updated_at: opp.updated_at,
  } as Lead;
}
