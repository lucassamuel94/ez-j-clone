import { supabase } from '@/integrations/supabase/client';

export interface ProposalLeadResult {
  id: string;
  company: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface ProposalData {
  id: string;
  company_name: string;
  cnpj: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  sdr_name: string | null;
  closer_name: string | null;
  plan_name: string;
  plan_price: number;
  estimated_contacts: number;
  estimated_messages: number;
  meta_cost: number;
  total_monthly: number;
  setup_total: number;
  setup_payment_method: string;
  setup_installments: number;
  integrations: { name: string; price: number; phase: number; details?: string; originalPrice?: number; discountLabel?: string }[];
  contract_months: number;
  cancellation_fee_percent: number;
  validity_days: number;
  status: string;
  notes: string | null;
  project_objective: string | null;
  created_at: string;
}

export interface ProposalSavePayload {
  plan_name: string;
  plan_price: number;
  estimated_contacts: number;
  estimated_messages: number;
  meta_cost: number;
  total_monthly: number;
  setup_total: number;
  setup_payment_method: string;
  setup_installments: number;
  contract_months: number;
  cancellation_fee_percent: number;
  validity_days: number;
  notes: string;
  project_objective: string;
  show_meta_costs: boolean;
  integrations: { name: string; price: number; phase: number; details?: string; originalPrice?: number; discountLabel?: string }[];
}

/** Search leads by text or CNPJ for linking to a proposal */
export async function searchLeadsForProposal(query: string): Promise<ProposalLeadResult[]> {
  if (query.length < 2) return [];

  const cleanQuery = query.replace(/[.\-\/]/g, '');
  const { data } = await supabase
    .from('leads')
    .select('id, company, razao_social, nome_fantasia, cnpj, name, email, phone')
    .or(`razao_social.ilike.%${query}%,nome_fantasia.ilike.%${query}%,cnpj.ilike.%${cleanQuery}%,company.ilike.%${query}%`)
    .limit(8);

  return (data || []) as ProposalLeadResult[];
}

/** Link a lead's data to a proposal */
export async function linkClientToProposal(
  proposalId: string,
  lead: ProposalLeadResult,
): Promise<{ company_name: string; cnpj: string | null; contact_name: string | null; contact_email: string | null; contact_phone: string | null }> {
  const displayName = lead.razao_social || lead.nome_fantasia || lead.company;
  const updateData = {
    company_name: displayName,
    cnpj: lead.cnpj || null,
    contact_name: lead.name || null,
    contact_email: lead.email || null,
    contact_phone: lead.phone || null,
  };

  const { error } = await supabase.from('proposals').update(updateData).eq('id', proposalId);
  if (error) throw new Error(`Erro ao vincular cliente: ${error.message}`);

  return updateData;
}

/** Fetch a proposal by its ID */
export async function fetchProposalById(id: string): Promise<ProposalData> {
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(`Erro ao carregar proposta: ${error.message}`);
  return data as unknown as ProposalData;
}

/** Save proposal updates and set status to 'sent' */
export async function saveProposal(
  id: string,
  payload: ProposalSavePayload,
  computedSetupTotal: number,
): Promise<void> {
  const { integrations, ...rest } = payload;
  const saveData: Record<string, unknown> = {
    ...rest,
    setup_total: computedSetupTotal,
    integrations: integrations,
    status: 'sent',
  };

  const { error } = await supabase
    .from('proposals')
    .update(saveData as any)
    .eq('id', id);

  if (error) throw new Error(`Erro ao salvar proposta: ${error.message}`);
}
