import { supabase } from '@/integrations/supabase/client';
import { createActivityLog } from '@/services/activityLogService';
import {
  CLOSER_STAGES,
  CLOSER_STAGES_DISPLAY,
  EVOLUTION_STAGES,
  EVOLUTION_STAGES_DISPLAY,
  CloserStage,
} from '@/constants/stages';

// Re-export stage constants for backward compatibility
export { CLOSER_STAGES, CLOSER_STAGES_DISPLAY, EVOLUTION_STAGES, EVOLUTION_STAGES_DISPLAY };
export type { CloserStage };
export type OpportunityType = 'new_business' | 'evolution';

// Build a case-insensitive lookup to normalize DB stage values to canonical constants
const _ALL_CANONICAL_STAGES: string[] = [...CLOSER_STAGES, ...EVOLUTION_STAGES];
const _STAGE_NORMALIZE_MAP = new Map<string, string>();
_ALL_CANONICAL_STAGES.forEach(s => _STAGE_NORMALIZE_MAP.set(s.toLowerCase(), s));

export function normalizeStage(dbStage: string): string {
  return _STAGE_NORMALIZE_MAP.get(dbStage.toLowerCase()) || dbStage;
}

export interface CloserOpportunity {
  id: string;
  lead_id: string;
  stage: CloserStage;
  created_by_user_id: string;
  assigned_to_user_id: string | null;
  sdr_user_id: string | null;
  closer_notes: string | null;
  returned_to_sdr: boolean;
  return_reason: string | null;
  lost_reason: string | null;
  meeting_datetime: string | null;
  deal_value: number;
  created_at: string;
  updated_at: string;
  active_objection: string | null;
  expected_close_date: string | null;
  decision_maker_identified: boolean;
  won_at?: string | null;
  opportunity_type?: OpportunityType;
  // Joined data
  lead_name?: string;
  lead_company?: string;
  lead_razao_social?: string;
  lead_nome_fantasia?: string;
  lead_cnpj?: string;
  lead_whatsapp?: string;
  lead_phone?: string;
  lead_phone_2?: string | null;
  lead_phone_3?: string | null;
  lead_phone_4?: string | null;
  lead_email?: string;
  lead_temperature?: string | null;
  lead_last_contact_at?: string | null;
  lead_next_action_at?: string | null;
  lead_status?: string | null;
  lead_website?: string | null;
  sdr_name?: string;
  closer_name?: string;
}

/** Maps a raw RPC row to a typed CloserOpportunity. Shared by kanban and table hooks. */
export function mapRpcRowToOpportunity(row: any): CloserOpportunity {
  return {
    id: row.id,
    lead_id: row.lead_id,
    stage: normalizeStage(row.stage) as CloserStage,
    created_by_user_id: row.created_by_user_id,
    assigned_to_user_id: row.assigned_to_user_id,
    sdr_user_id: row.sdr_user_id,
    closer_notes: row.closer_notes,
    returned_to_sdr: row.returned_to_sdr || false,
    return_reason: row.return_reason,
    lost_reason: row.lost_reason,
    meeting_datetime: row.meeting_datetime,
    deal_value: Number(row.deal_value) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    active_objection: row.active_objection || null,
    expected_close_date: row.expected_close_date || null,
    decision_maker_identified: row.decision_maker_identified || false,
    won_at: row.won_at || null,
    opportunity_type: row.opportunity_type || 'new_business',
    lead_name: row.lead_name,
    lead_company: row.lead_company,
    lead_razao_social: row.lead_razao_social,
    lead_nome_fantasia: row.lead_nome_fantasia,
    lead_cnpj: row.lead_cnpj,
    lead_whatsapp: row.lead_whatsapp,
    lead_phone: row.lead_phone,
    lead_phone_2: row.lead_phone_2,
    lead_phone_3: row.lead_phone_3,
    lead_phone_4: row.lead_phone_4,
    lead_email: row.lead_email,
    lead_temperature: row.lead_temperature,
    lead_last_contact_at: row.lead_last_contact_at,
    lead_next_action_at: row.lead_next_action_at,
    lead_status: row.lead_status,
    lead_website: row.lead_website,
    sdr_name: row.sdr_name,
    closer_name: row.closer_name,
  };
}

export const fetchCloserOpportunities = async (): Promise<CloserOpportunity[]> => {
  const allData: any[] = [];
  const batchSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('opportunities')
      .select(`
        *,
        leads:lead_id(name, company, razao_social, nome_fantasia, cnpj, whatsapp, phone, phone_2, phone_3, phone_4, email, temperature, last_contact_at, next_action_at, status, website),
        sdr:sdr_user_id(name),
        closer:assigned_to_user_id(name)
      `)
      .eq('returned_to_sdr', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('Error fetching closer opportunities:', error);
      throw error;
    }

    if (data && data.length > 0) {
      allData.push(...data);
      offset += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  return allData.map((row: any) => ({
    id: row.id,
    lead_id: row.lead_id,
    stage: normalizeStage(row.stage) as CloserStage,
    created_by_user_id: row.created_by_user_id,
    assigned_to_user_id: row.assigned_to_user_id,
    sdr_user_id: row.sdr_user_id,
    closer_notes: row.closer_notes,
    returned_to_sdr: row.returned_to_sdr || false,
    return_reason: row.return_reason,
    lost_reason: row.lost_reason,
    meeting_datetime: row.meeting_datetime,
    deal_value: Number(row.deal_value) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    active_objection: row.active_objection || null,
    expected_close_date: row.expected_close_date || null,
    decision_maker_identified: row.decision_maker_identified || false,
    won_at: row.won_at || null,
    opportunity_type: row.opportunity_type || 'new_business',
    lead_name: row.leads?.name,
    lead_company: row.leads?.razao_social || row.leads?.nome_fantasia || row.leads?.company,
    lead_razao_social: row.leads?.razao_social,
    lead_nome_fantasia: row.leads?.nome_fantasia,
    lead_cnpj: row.leads?.cnpj,
    lead_whatsapp: row.leads?.whatsapp,
    lead_phone: row.leads?.phone,
    lead_phone_2: row.leads?.phone_2,
    lead_phone_3: row.leads?.phone_3,
    lead_phone_4: row.leads?.phone_4,
    lead_email: row.leads?.email,
    lead_temperature: row.leads?.temperature,
    lead_last_contact_at: row.leads?.last_contact_at,
    lead_next_action_at: row.leads?.next_action_at,
    lead_status: row.leads?.status,
    lead_website: row.leads?.website,
    sdr_name: row.sdr?.name,
    closer_name: row.closer?.name,
  }));
};

export const updateOpportunityStage = async (id: string, stage: CloserStage): Promise<void> => {
  // Get current stage before update
  const { data: current } = await supabase
    .from('opportunities')
    .select('stage, lead_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('opportunities')
    .update({ stage })
    .eq('id', id);

  if (error) throw error;

  if (current?.lead_id) {
    await createActivityLog({
      lead_id: current.lead_id,
      action_type: 'field_updated',
      field_name: 'closer_stage',
      old_value: current.stage,
      new_value: stage,
      description: `alterou estágio do Closer de ${current.stage} para ${stage}`,
    }).catch(console.error);

    // Trigger automatic messages for stage change
    supabase.functions.invoke('trigger-automatic-message', {
      body: { trigger_key: `opp_stage_changed:${stage}`, opportunity_id: id },
    }).catch(console.error);
  }

};

export const updateOpportunityNotes = async (id: string, notes: string): Promise<void> => {
  const { data: current } = await supabase
    .from('opportunities')
    .select('lead_id, closer_notes')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('opportunities')
    .update({ closer_notes: notes })
    .eq('id', id);

  if (error) throw error;

  if (current?.lead_id) {
    await createActivityLog({
      lead_id: current.lead_id,
      action_type: 'note_added',
      field_name: 'closer_notes',
      old_value: current.closer_notes || null,
      new_value: notes,
      description: `atualizou notas do Closer`,
    }).catch(console.error);
  }
};

export const returnLeadToSdr = async (id: string, reason: string): Promise<void> => {
  // Get the opportunity to find the lead and SDR
  const { data: opp, error: fetchError } = await supabase
    .from('opportunities')
    .select('lead_id, sdr_user_id')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  // Mark opportunity as returned (without marking as Perdido)
  const { error, count } = await supabase
    .from('opportunities')
    .update({
      returned_to_sdr: true,
      return_reason: reason,
    }, { count: 'exact' })
    .eq('id', id);

  if (error) throw error;
  if (count === 0) throw new Error('Nenhuma oportunidade foi atualizada. Verifique suas permissões.');

  // Log activity
  if (opp?.lead_id) {
    await createActivityLog({
      lead_id: opp.lead_id,
      action_type: 'field_updated',
      field_name: 'closer_stage',
      old_value: null,
      new_value: 'Devolvido ao SDR',
      description: `devolveu lead ao SDR para reagendamento. Motivo: ${reason}`,
    }).catch(console.error);

    // Trigger automatic messages
    supabase.functions.invoke('trigger-automatic-message', {
      body: { trigger_key: 'opp_returned_sdr', lead_id: opp.lead_id },
    }).catch(console.error);
  }

  // Update lead status to 'Devolvido pelo Closer'
  if (opp?.lead_id) {
    const { error: leadUpdateError } = await supabase
      .from('leads')
      .update({
        status: 'Devolvido pelo Closer' as any,
        next_action_at: new Date().toISOString(),
      })
      .eq('id', opp.lead_id);
    if (leadUpdateError) {
      console.error('Failed to update lead status on return to SDR:', leadUpdateError);
    }
  }

  // Create notification for SDR
  if (opp?.sdr_user_id) {
    await supabase.from('notifications').insert({
      user_id: opp.sdr_user_id,
      title: 'Lead devolvido pelo Closer',
      message: `Um lead foi devolvido para reagendamento. Motivo: ${reason}`,
      type: 'warning',
    });
  }
};

export const markOpportunityLost = async (id: string, reason: string, responsibility?: string, sqoImpact?: string): Promise<void> => {
  const { data: current } = await supabase
    .from('opportunities')
    .select('lead_id, stage')
    .eq('id', id)
    .single();

  const updateData: any = { stage: 'Perdido', lost_reason: reason };
  if (responsibility) updateData.lost_responsibility = responsibility;
  if (sqoImpact) updateData.lost_sqo_impact = sqoImpact;

  const { error } = await supabase
    .from('opportunities')
    .update(updateData)
    .eq('id', id);

  if (error) throw error;

  if (current?.lead_id) {
    await createActivityLog({
      lead_id: current.lead_id,
      action_type: 'field_updated',
      field_name: 'closer_stage',
      old_value: current.stage,
      new_value: 'Perdido',
      description: `marcou oportunidade como Perdida. Motivo: ${reason}`,
    }).catch(console.error);

    // Trigger automatic messages
    supabase.functions.invoke('trigger-automatic-message', {
      body: { trigger_key: 'opp_lost', opportunity_id: id },
    }).catch(console.error);
  }
};

export const markOpportunityWon = async (id: string): Promise<void> => {
  const { data: current } = await supabase
    .from('opportunities')
    .select('lead_id, stage')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('opportunities')
    .update({ stage: 'Ganho' })
    .eq('id', id);

  if (error) throw error;

  if (current?.lead_id) {
    // Auto-mark all call analyses for this lead as converted to sale
    await supabase
      .from('call_analyses')
      .update({ converted_to_sale: true } as Record<string, unknown>)
      .eq('lead_id', current.lead_id);

    await createActivityLog({
      lead_id: current.lead_id,
      action_type: 'opportunity_created',
      field_name: 'closer_stage',
      old_value: current.stage,
      new_value: 'Ganho',
      description: `marcou oportunidade como Ganha!`,
    }).catch(console.error);

    // Trigger automatic messages
    supabase.functions.invoke('trigger-automatic-message', {
      body: { trigger_key: 'opp_won', opportunity_id: id },
    }).catch(console.error);
  }
};

export const createOpportunityFromMeeting = async (
  leadId: string, 
  sdrUserId: string | null, 
  closerUserId: string | null,
  meetingDatetime: string,
  stage: CloserStage = 'Demonstração',
  skipSqoValidation = false,
): Promise<void> => {
  // Validate SQO criteria before creating opportunity
  if (!skipSqoValidation) {
    const { data: lead } = await supabase
      .from('leads')
      .select('cnpj, sqo_pain_category, sqo_pain_clear, sqo_pain_financial_impact, sqo_urgency, sqo_budget, sqo_decision_maker, sqo_icp_fit')
      .eq('id', leadId)
      .single();

    const { validateSQOCriteria } = await import('@/utils/sqoValidation');
    const sqoResult = validateSQOCriteria(lead || {});
    if (!sqoResult.approved) {
      throw new Error(`SQO não aprovado. Critérios faltantes: ${sqoResult.missingLabels.join(', ')}`);
    }

    const cleanCnpj = (lead?.cnpj || '').replace(/\D/g, '');
    if (cleanCnpj.length === 14) {
      // Check if another lead/account already has an active opportunity with this CNPJ
      const { data: dupeLeads } = await supabase
        .from('leads')
        .select('id')
        .eq('cnpj', cleanCnpj)
        .neq('id', leadId);

      if (dupeLeads && dupeLeads.length > 0) {
        const dupeIds = dupeLeads.map(l => l.id);
        const { data: activeOpps } = await supabase
          .from('opportunities')
          .select('id, stage')
          .in('lead_id', dupeIds)
          .not('stage', 'eq', 'Perdido')
          .eq('returned_to_sdr', false)
          .neq('opportunity_type', 'evolution')
          .limit(1);

        if (activeOpps && activeOpps.length > 0) {
          throw new Error('Já existe uma oportunidade ativa para este CNPJ. Não é possível criar duplicata.');
        }
      }
    }
  }

  // For admin transfers, created_by is the current session user (resolved below)
  let createdBy = sdrUserId;
  if (!createdBy) {
    const { data: { session } } = await supabase.auth.getSession();
    createdBy = session?.user?.id ?? null;
  }

  // Check if an active new_business opportunity already exists for this lead.
  // opportunity_type NULL means new_business (the default), so we check for both.
  const { data: existingOpp } = await supabase
    .from('opportunities')
    .select('id')
    .eq('lead_id', leadId)
    .eq('returned_to_sdr', false)
    .not('stage', 'eq', 'Perdido')
    .or('opportunity_type.is.null,opportunity_type.neq.evolution')
    .limit(1)
    .maybeSingle();

  if (existingOpp) {
    // Rescheduling or closer change: update the existing opportunity instead of
    // creating a duplicate. This prevents double-counting in productivity reports.
    const updatePayload: Record<string, unknown> = {
      assigned_to_user_id: closerUserId,
      meeting_datetime: meetingDatetime,
      stage,
    };
    if (sdrUserId) updatePayload.sdr_user_id = sdrUserId;

    const { error } = await supabase
      .from('opportunities')
      .update(updatePayload)
      .eq('id', existingOpp.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('opportunities')
      .insert({
        lead_id: leadId,
        created_by_user_id: createdBy!,
        assigned_to_user_id: closerUserId,
        sdr_user_id: sdrUserId,
        stage,
        meeting_datetime: meetingDatetime,
      });

    if (error) throw error;
  }

  // Trigger automatic messages
  supabase.functions.invoke('trigger-automatic-message', {
    body: { trigger_key: 'opp_created', lead_id: leadId },
  }).catch(console.error);
};

export const removeOpportunityByLeadId = async (leadId: string): Promise<void> => {
  const { error } = await supabase
    .from('opportunities')
    .delete()
    .eq('lead_id', leadId);

  if (error) throw error;

  // Update lead status back to 'Em contato'
  await supabase
    .from('leads')
    .update({ status: 'Em contato' as any, next_action_at: new Date().toISOString() })
    .eq('id', leadId);

  await createActivityLog({
    lead_id: leadId,
    action_type: 'status_changed',
    field_name: 'status',
    old_value: 'Oportunidade criada',
    new_value: 'Em contato',
    description: 'desfez envio ao Closer e removeu a oportunidade',
  }).catch(console.error);
};

export const bulkDeleteOpportunities = async (ids: string[]): Promise<number> => {
  const { error } = await supabase
    .from('opportunities')
    .delete()
    .in('id', ids);

  if (error) throw error;
  return ids.length;
};

export const createDealFromActiveClient = async (
  activeClientId: string,
  closerUserId: string,
  opportunityType: OpportunityType = 'new_business'
): Promise<{ opportunityId: string; leadId: string }> => {
  // 1. Fetch account (unified client entity)
  const { data: client, error: clientError } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', activeClientId)
    .single();
  if (clientError || !client) throw new Error('Cliente não encontrado');

  const cnpj = (client as any).cnpj?.replace(/\D/g, '') || '';

  // 2. Check for CNPJ duplicate — block only for new_business (not evolutions)
  if (cnpj.length === 14 && opportunityType !== 'evolution') {
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('id')
      .eq('cnpj', cnpj);

    if (existingLeads && existingLeads.length > 0) {
      const leadIds = existingLeads.map(l => l.id);
      const { data: activeOpps } = await supabase
        .from('opportunities')
        .select('id')
        .in('lead_id', leadIds)
        .not('stage', 'eq', 'Perdido')
        .neq('opportunity_type', 'evolution')
        .limit(1);

      if (activeOpps && activeOpps.length > 0) {
        throw new Error('Já existe uma oportunidade ativa para este CNPJ. Não é possível criar negociação duplicada.');
      }
    }
  }

  // 3. Find or create lead by CNPJ
  let leadId: string;
  if (cnpj) {
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('cnpj', cnpj)
      .limit(1)
      .maybeSingle();

    if (existingLead) {
      leadId = existingLead.id;
    } else {
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          name: (client as any).contact_name || (client as any).company_name,
          company: (client as any).company_name,
          cnpj: (client as any).cnpj,
          razao_social: (client as any).razao_social,
          nome_fantasia: (client as any).nome_fantasia,
          email: (client as any).email,
          phone: (client as any).phone,
          city: (client as any).city,
          state: (client as any).state,
          website: (client as any).website,
          lead_type: 'OUTBOUND' as any,
          source: 'Base de Clientes',
          status: 'Oportunidade criada' as any,
        })
        .select('id')
        .single();
      if (leadError || !newLead) throw new Error('Erro ao criar lead');
      leadId = newLead.id;
    }
  } else {
    // No CNPJ — always create new lead
    const { data: newLead, error: leadError } = await supabase
      .from('leads')
      .insert({
        name: (client as any).contact_name || (client as any).company_name,
        company: (client as any).company_name,
        email: (client as any).email,
        phone: (client as any).phone,
        city: (client as any).city,
        state: (client as any).state,
        website: (client as any).website,
        lead_type: 'OUTBOUND' as any,
        source: 'Base de Clientes',
        status: 'Oportunidade criada' as any,
      })
      .select('id')
      .single();
    if (leadError || !newLead) throw new Error('Erro ao criar lead');
    leadId = newLead.id;
  }

  // 3. Create opportunity
  const initialStage = opportunityType === 'evolution' ? 'Proposta enviada' : 'Demonstração';
  const { data: opp, error: oppError } = await supabase
    .from('opportunities')
    .insert({
      lead_id: leadId,
      created_by_user_id: closerUserId,
      assigned_to_user_id: closerUserId,
      sdr_user_id: closerUserId,
      stage: initialStage,
      opportunity_type: opportunityType,
    } as any)
    .select('id')
    .single();
  if (oppError || !opp) throw new Error('Erro ao criar oportunidade');

  // 4. Activity log
  await createActivityLog({
    lead_id: leadId,
    action_type: 'opportunity_created',
    field_name: 'closer_stage',
    new_value: 'Demonstração',
    description: 'criou nova negociação a partir da base de clientes',
  }).catch(console.error);

  return { opportunityId: opp.id, leadId };
};

export const updateOpportunityDealValue = async (id: string, value: number): Promise<void> => {
  const { data: current } = await supabase
    .from('opportunities')
    .select('lead_id, deal_value')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('opportunities')
    .update({ deal_value: value })
    .eq('id', id);

  if (error) throw error;

  if (current?.lead_id) {
    await createActivityLog({
      lead_id: current.lead_id,
      action_type: 'field_updated',
      field_name: 'deal_value',
      old_value: String(current.deal_value ?? 0),
      new_value: String(value),
      description: `atualizou valor do deal de ${current.deal_value ?? 0} para ${value}`,
    }).catch(console.error);
  }
};

export const bulkReassignOpportunities = async (ids: string[], closerUserId: string): Promise<void> => {
  // Get lead_ids and closer name before update
  const { data: opps } = await supabase
    .from('opportunities')
    .select('id, lead_id, assigned_to_user_id')
    .in('id', ids);

  const { data: closerProfile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', closerUserId)
    .single();

  const { error } = await supabase
    .from('opportunities')
    .update({ assigned_to_user_id: closerUserId })
    .in('id', ids);

  if (error) throw error;

  // Log activity for each lead
  if (opps) {
    const closerName = closerProfile?.name || closerUserId;
    await Promise.allSettled(
      opps.map(opp =>
        createActivityLog({
          lead_id: opp.lead_id,
          action_type: 'owner_assigned',
          field_name: 'closer_assigned',
          old_value: null,
          new_value: closerName,
          description: `reatribuiu oportunidade ao Closer ${closerName}`,
        })
      )
    );
  }
};

// ── Functions extracted from CloserPipelinePage ──

export interface CloserFilterProfile {
  id: string;
  name: string;
}

/** Fetch all filtered opportunity IDs for bulk operations */
export async function fetchFilteredOpportunityIds(params: {
  tab: string;
  closerId: string | null;
  search: string;
  stages: string[] | undefined;
  meetingFrom: string | null;
  meetingTo: string | null;
  wonFrom: string | null;
  wonTo: string | null;
  limit?: number;
}): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_filtered_opportunity_ids', {
    p_tab: params.tab,
    p_closer_id: params.closerId,
    p_search: params.search.trim(),
    p_stages: params.stages || null,
    p_meeting_from: params.meetingFrom,
    p_meeting_to: params.meetingTo,
    p_won_from: params.wonFrom,
    p_won_to: params.wonTo,
    p_limit: params.limit || null,
  } as any);

  if (error) throw error;
  return (data as string[]) || [];
}

/** Detect project type from the latest proposal on an opportunity */
export async function detectProjectTypeFromProposal(oppId: string): Promise<string | null> {
  const { data } = await supabase
    .from('proposals')
    .select('product_type')
    .eq('opportunity_id', oppId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.product_type) {
    return data.product_type === 'evolucao_ez_chat' ? 'evolucao' : 'venda';
  }
  return null;
}

/** Create an opportunity directly from a new lead (Closer creates their own lead) */
export async function createOpportunityFromNewLead(
  leadId: string,
  userId: string,
): Promise<void> {
  const { error: oppError } = await supabase.from('opportunities').insert({
    lead_id: leadId,
    created_by_user_id: userId,
    assigned_to_user_id: userId,
    sdr_user_id: userId,
    stage: 'Demonstração',
  });
  if (oppError) throw oppError;

  const { error: leadError } = await supabase
    .from('leads')
    .update({ status: 'Oportunidade criada' as any })
    .eq('id', leadId);
  if (leadError) throw leadError;
}

/** Fetch profiles that have opportunities assigned (for closer filter dropdown) */
export async function fetchCloserProfiles(): Promise<CloserFilterProfile[]> {
  const { data: opps } = await supabase
    .from('opportunities')
    .select('assigned_to_user_id')
    .eq('returned_to_sdr', false)
    .not('assigned_to_user_id', 'is', null);

  if (!opps || opps.length === 0) return [];
  const userIds = [...new Set(opps.map(o => o.assigned_to_user_id).filter(Boolean))] as string[];
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', userIds)
    .eq('active', true)
    .order('name');

  return (profiles || []) as CloserFilterProfile[];
}

// ---------- Evolution count helpers ----------

export const MAX_EVOLUTIONS_BEFORE_WARNING = 2;

/**
 * Count active evolution opportunities for a given CNPJ.
 * "Active" = stage NOT 'Perdido' AND opportunity_type = 'evolution'.
 */
export async function countActiveEvolutionsByCnpj(cnpj: string): Promise<number> {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return 0;

  const { data: leads } = await supabase
    .from('leads')
    .select('id')
    .eq('cnpj', clean);

  if (!leads || leads.length === 0) return 0;

  const leadIds = leads.map(l => l.id);
  const { count, error } = await supabase
    .from('opportunities')
    .select('id', { count: 'exact', head: true })
    .in('lead_id', leadIds)
    .not('stage', 'eq', 'Perdido')
    .eq('opportunity_type', 'evolution');

  if (error) {
    console.error('Error counting active evolutions:', error);
    return 0;
  }

  return count ?? 0;
}
