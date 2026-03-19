import { supabase } from '@/integrations/supabase/client';
import { Lead, LeadStatus, LeadType, Channel, Interaction, LeadNote, LeadNoteAttachment, CadenceStep, InteractionOutcome, LeadTemperature } from '@/types/lead';


export interface CnpjDuplicateResult {
  isDuplicate: boolean;
  reason?: 'lead' | 'account' | 'opportunity';
  existingLeadId?: string;
  existingLeadName?: string;
  existingLeadCompany?: string;
  existingAccountId?: string;
  existingAccountName?: string;
  existingOppStage?: string;
}

// Comprehensive CNPJ duplicate check: checks accounts (source of truth), then orphan leads
export const checkCnpjDuplicate = async (cnpj: string, excludeLeadId?: string): Promise<CnpjDuplicateResult> => {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  if (!cleanCnpj || cleanCnpj.length < 14) return { isDuplicate: false };

  // Use v2 RPC that checks accounts first (source of truth)
  const { data } = await supabase.rpc('check_cnpj_duplicate_v2' as any, {
    p_cnpj: cleanCnpj,
    p_exclude_lead_id: excludeLeadId || null,
  });

  const result = data as any;
  if (!result?.is_duplicate) return { isDuplicate: false };

  // If it's an account match, check if there's an active lead for the same product
  if (result.existing_account_id) {
    // Build opportunity query — exclude opportunities belonging to the lead being updated
    let oppQuery = supabase
      .from('opportunities')
      .select('id, stage')
      .eq('account_id', result.existing_account_id)
      .not('stage', 'eq', 'Perdido');
    if (excludeLeadId) {
      oppQuery = oppQuery.not('lead_id', 'eq', excludeLeadId);
    }
    const { data: activeOpps } = await oppQuery.limit(1);

    if (activeOpps && activeOpps.length > 0) {
      // Fetch the lead_id from the opportunity so the Closer can create a new one
      const { data: oppWithLead } = await supabase
        .from('opportunities')
        .select('lead_id, leads!inner(id, name, company)')
        .eq('id', activeOpps[0].id)
        .single();

      return {
        isDuplicate: true,
        reason: 'opportunity',
        existingAccountId: result.existing_account_id,
        existingAccountName: result.existing_account_name,
        existingOppStage: activeOpps[0].stage,
        existingLeadId: (oppWithLead as any)?.lead_id || undefined,
        existingLeadName: (oppWithLead as any)?.leads?.name || undefined,
        existingLeadCompany: (oppWithLead as any)?.leads?.company || undefined,
      };
    }

    // Check for active leads (not Descartado) on this account, excluding self
    let leadQuery = supabase
      .from('leads')
      .select('id, name, company, status')
      .eq('account_id', result.existing_account_id)
      .not('status', 'in', '("Descartado")');
    if (excludeLeadId) {
      leadQuery = leadQuery.not('id', 'eq', excludeLeadId);
    }
    const { data: activeLeads } = await leadQuery.limit(1);

    if (activeLeads && activeLeads.length > 0) {
      return {
        isDuplicate: true,
        reason: 'lead',
        existingLeadId: activeLeads[0].id,
        existingLeadName: activeLeads[0].name,
        existingLeadCompany: activeLeads[0].company,
        existingAccountId: result.existing_account_id,
        existingAccountName: result.existing_account_name,
      };
    }

    // Account exists but no active processes — allow
    return { isDuplicate: false };
  }

  // Orphan lead match (legacy, shouldn't happen after migration)
  if (result.existing_lead_id) {
    return {
      isDuplicate: true,
      reason: 'lead',
      existingLeadId: result.existing_lead_id,
      existingLeadName: result.existing_lead_name,
      existingLeadCompany: result.existing_lead_company,
    };
  }

  return { isDuplicate: false };
};

// Convert database row to Lead type
const mapDbLeadToLead = (row: any): Lead => ({
  id: row.id,
  lead_type: row.lead_type as LeadType,
  name: row.name,
  company: row.company,
  whatsapp: row.whatsapp || '',
  phone: row.phone || '',
  phone_2: row.phone_2 || '',
  email: row.email || '',
  phone_3: row.phone_3 || '',
  phone_4: row.phone_4 || '',
  contact_name_2: row.contact_name_2 || '',
  email_2: row.email_2 || '',
  source: row.source || '',
  status: row.status as LeadStatus,
  temperature: row.temperature as LeadTemperature | undefined,
  owner_user_id: row.owner_user_id || '',
  owner_name: row.owner_name || row.profiles?.name || (row.owner_user_id ? 'Usuário indisponível' : 'Não atribuído'),
  priority_score: row.priority_score,
  last_contact_at: row.last_contact_at || null,
  next_action_at: row.next_action_at,
  attempts_count: row.attempts_count,
  created_at: row.created_at,
  updated_at: row.updated_at,
  initial_message: row.initial_message,
  entry_channel: row.entry_channel as Channel | undefined,
  icp_fit: row.icp_fit,
  list_reason: row.list_reason,
  cadence_id: row.cadence_id,
  current_cadence_step: row.current_cadence_step,
  // Company data fields
  cnpj: row.cnpj || '',
  razao_social: row.razao_social || '',
  nome_fantasia: row.nome_fantasia || '',
  company_segment: row.company_segment || '',
  employee_count: row.employee_count || '',
  revenue_range: row.revenue_range || '',
  website: row.website || '',
  porte: row.porte || '',
  capital_social: row.capital_social ?? undefined,
  cnae_fiscal: row.cnae_fiscal ?? undefined,
  cnae_fiscal_descricao: row.cnae_fiscal_descricao || '',
  cnaes_secundarios: row.cnaes_secundarios || '',
  situacao_cadastral: row.situacao_cadastral || '',
  data_inicio_atividade: (row as any).data_inicio_atividade || '',
  qsa: (row as any).qsa || '',
  cep: row.cep || '',
  logradouro: row.logradouro || '',
  numero: row.numero || '',
  complemento: row.complemento || '',
  bairro: row.bairro || '',
  city: row.city || '',
  state: row.state || '',
  country: row.country || 'Brasil',
  // Qualification data fields
  product_interest: row.product_interest || '',
  uses_platform: row.uses_platform,
  daily_service_volume: row.daily_service_volume || '',
  main_pain_point: row.main_pain_point || '',
  solution_urgency: row.solution_urgency || '',
  has_budget: row.has_budget || '',
  qualification_notes: row.qualification_notes || '',
  // SQO Validation fields
  sqo_pain_category: row.sqo_pain_category || '',
  sqo_pain_other: row.sqo_pain_other || '',
  sqo_pain_clear: row.sqo_pain_clear === true,
  sqo_pain_financial_impact: row.sqo_pain_financial_impact === true,
  sqo_urgency: row.sqo_urgency || '',
  sqo_budget: row.sqo_budget || '',
  sqo_decision_maker: row.sqo_decision_maker || '',
  sqo_icp_fit: row.sqo_icp_fit || '',
  sqo_next_step: row.sqo_next_step || '',
  // AI data
  ai_enrichment_data: row.ai_enrichment_data || null,
  ai_insights_data: row.ai_insights_data || null,
  ai_insights_generated_at: row.ai_insights_generated_at || null,
  ai_validation_alerts: row.ai_validation_alerts || null,
  // External integrations
  clickup_id: row.clickup_id || '',
  // Behavioral Score (Magnet Engine)
  behavioral_score: (row as any).behavioral_score ?? null,
  score_variation_48h: (row as any).score_variation_48h ?? 0,
  score_variation_reason: (row as any).score_variation_reason || '',
  ai_next_action_suggestion: (row as any).ai_next_action_suggestion || '',
  closing_probability: (row as any).closing_probability ?? undefined,
  closing_probability_reason: (row as any).closing_probability_reason || '',
  is_hot_lead: (row as any).is_hot_lead ?? false,
  last_score_calculated_at: (row as any).last_score_calculated_at || null,
});

// Fetch all leads (legacy - kept for backward compatibility)
export const fetchLeads = async (): Promise<Lead[]> => {
  const allLeads: any[] = [];
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('leads')
      .select('*, profiles:owner_user_id(name)')
      .order('next_action_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Error fetching leads:', error);
      throw error;
    }

    if (data) {
      allLeads.push(...data);
    }

    hasMore = (data?.length || 0) === pageSize;
    from += pageSize;
  }

  return allLeads.map(mapDbLeadToLead);
};

// ═══ Server-side paginated leads ═══

export interface LeadSearchParams {
  tab: string;
  sdrId: string;
  search: string;
  statuses: string[] | null;
  page: number;
  pageSize: number;
}

export interface PaginatedLeadsResult {
  leads: Lead[];
  total: number;
}

export const fetchLeadsPaginated = async (params: LeadSearchParams): Promise<PaginatedLeadsResult> => {
  const sdrIdParam = params.sdrId === 'all' ? null
    : params.sdrId === 'unassigned' ? '00000000-0000-0000-0000-000000000000'
    : params.sdrId;

  const { data, error } = await supabase.rpc('search_leads_paginated', {
    p_tab: params.tab,
    p_sdr_id: sdrIdParam,
    p_search: params.search.trim(),
    p_statuses: params.statuses,
    p_page: params.page,
    p_page_size: params.pageSize,
  });

  if (error) {
    console.error('Error fetching paginated leads:', error);
    throw error;
  }

  const result = data as any;
  return {
    leads: (result.data || []).map(mapDbLeadToLead),
    total: result.total || 0,
  };
};

// ═══ Server-side paginated leads by status (for Kanban) ═══

export interface LeadsByStatusParams {
  status: string;
  sdrId: string | null;
  search: string;
  sort: string;
  page: number;
  pageSize: number;
}

export const fetchLeadsByStatus = async (params: LeadsByStatusParams): Promise<PaginatedLeadsResult> => {
  const { data, error } = await supabase.rpc('search_leads_by_status' as any, {
    p_status: params.status,
    p_sdr_id: params.sdrId,
    p_search: params.search.trim(),
    p_sort: params.sort,
    p_page: params.page,
    p_page_size: params.pageSize,
  });

  if (error) {
    console.error('Error fetching leads by status:', error);
    throw error;
  }

  const result = data as any;
  return {
    leads: (result.data || []).map(mapDbLeadToLead),
    total: result.total || 0,
  };
};

export interface LeadTabCounts {
  total: number;
  overdue: number;
  today: number;
  new: number;
  in_contact_return: number;
  devolvido_closer: number;
  ocupado: number;
  nao_atendeu: number;
  sem_retorno: number;
  agendar_retorno: number;
  scheduled: number;
  confirmed: number;
  future_opportunity: number;
  discarded: number;
}

export const fetchLeadTabCounts = async (sdrId: string): Promise<LeadTabCounts> => {
  const sdrIdParam = sdrId === 'all' ? null
    : sdrId === 'unassigned' ? '00000000-0000-0000-0000-000000000000'
    : sdrId;

  const { data, error } = await supabase.rpc('get_lead_tab_counts', {
    p_sdr_id: sdrIdParam,
  });

  if (error) {
    console.error('Error fetching tab counts:', error);
    throw error;
  }

  return data as unknown as LeadTabCounts;
};

// Fetch a single lead by ID
export const fetchLeadById = async (leadId: string): Promise<Lead> => {
  const { data, error } = await supabase.rpc('get_lead_by_id', { p_lead_id: leadId });

  if (error) {
    console.error('Error fetching lead by id:', error);
    throw error;
  }
  if (!data) throw new Error('Lead not found');

  return mapDbLeadToLead(data);
};

// Create a new lead
export const createLead = async (lead: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'priority_score'>): Promise<Lead> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('leads')
    .insert({
      lead_type: lead.lead_type,
      name: lead.name,
      company: lead.company,
      whatsapp: lead.whatsapp || null,
      phone: lead.phone || null,
      phone_2: lead.phone_2 || null,
      email: lead.email || null,
      source: lead.source || null,
      status: lead.status,
      owner_user_id: user?.id || null,
      last_contact_at: lead.last_contact_at || null,
      next_action_at: lead.next_action_at,
      attempts_count: lead.attempts_count,
      initial_message: lead.initial_message || null,
      entry_channel: lead.entry_channel || null,
      icp_fit: lead.icp_fit || null,
      list_reason: lead.list_reason || null,
      cadence_id: lead.cadence_id || null,
      current_cadence_step: lead.current_cadence_step || null,
      cnpj: lead.cnpj || null,
      razao_social: lead.razao_social || null,
      nome_fantasia: lead.nome_fantasia || null,
      porte: lead.porte || null,
      capital_social: lead.capital_social || null,
      situacao_cadastral: lead.situacao_cadastral || null,
      cnae_fiscal: lead.cnae_fiscal || null,
      cnae_fiscal_descricao: lead.cnae_fiscal_descricao || null,
      company_segment: lead.company_segment || null,
      cnaes_secundarios: lead.cnaes_secundarios || null,
      data_inicio_atividade: lead.data_inicio_atividade || null,
      logradouro: lead.logradouro || null,
      numero: lead.numero || null,
      complemento: lead.complemento || null,
      bairro: lead.bairro || null,
      city: lead.city || null,
      state: lead.state || null,
      cep: lead.cep || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating lead:', error);
    throw error;
  }

  // Trigger automatic messages for new lead
  supabase.functions.invoke('trigger-automatic-message', {
    body: { trigger_key: 'lead_created', lead_id: data.id },
  }).catch(console.error);

  return mapDbLeadToLead(data);
};

// Update a lead
export const updateLead = async (id: string, updates: Partial<Lead>): Promise<Lead> => {
  // Capture old values before update for automation trigger and CNPJ comparison
  let oldStatus: string | undefined;
  let currentCnpj: string | undefined;
  if (updates.status !== undefined || updates.cnpj !== undefined) {
    const { data: currentLead } = await supabase.from('leads').select('status, cnpj').eq('id', id).single();
    oldStatus = currentLead?.status || undefined;
    currentCnpj = currentLead?.cnpj || undefined;
  }

  const updateData: any = {};

  // Basic lead fields
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.temperature !== undefined) updateData.temperature = updates.temperature;
  if (updates.last_contact_at !== undefined) updateData.last_contact_at = updates.last_contact_at || null;
  if (updates.next_action_at !== undefined) updateData.next_action_at = updates.next_action_at;
  if (updates.attempts_count !== undefined) updateData.attempts_count = updates.attempts_count;
  if (updates.priority_score !== undefined) updateData.priority_score = updates.priority_score;
  if (updates.current_cadence_step !== undefined) updateData.current_cadence_step = updates.current_cadence_step;
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.company !== undefined) updateData.company = updates.company;
  if (updates.whatsapp !== undefined) updateData.whatsapp = updates.whatsapp;
  if (updates.phone !== undefined) updateData.phone = updates.phone;
  if (updates.phone_2 !== undefined) updateData.phone_2 = updates.phone_2;
  if (updates.phone_3 !== undefined) updateData.phone_3 = updates.phone_3;
  if (updates.phone_4 !== undefined) updateData.phone_4 = updates.phone_4;
  if (updates.email !== undefined) updateData.email = updates.email;
  if (updates.email_2 !== undefined) updateData.email_2 = updates.email_2;
  if (updates.contact_name_2 !== undefined) updateData.contact_name_2 = updates.contact_name_2;
  if (updates.source !== undefined) updateData.source = updates.source;
  if (updates.initial_message !== undefined) updateData.initial_message = updates.initial_message;
  if (updates.entry_channel !== undefined) updateData.entry_channel = updates.entry_channel;
  if (updates.icp_fit !== undefined) updateData.icp_fit = updates.icp_fit;
  if (updates.list_reason !== undefined) updateData.list_reason = updates.list_reason;
  if (updates.cadence_id !== undefined) updateData.cadence_id = updates.cadence_id;
  
  // Company data fields - check CNPJ uniqueness only when the value actually changed
  if (updates.cnpj !== undefined) {
    const cleanCnpj = updates.cnpj?.replace(/\D/g, '') || '';
    const cleanCurrentCnpj = currentCnpj?.replace(/\D/g, '') || '';
    if (cleanCnpj.length === 14 && cleanCnpj !== cleanCurrentCnpj) {
      const duplicateCheck = await checkCnpjDuplicate(updates.cnpj, id);
      if (duplicateCheck.isDuplicate) {
        const label = duplicateCheck.reason === 'lead'
          ? `lead "${duplicateCheck.existingLeadName}" (${duplicateCheck.existingLeadCompany})`
          : `conta "${duplicateCheck.existingAccountName}"`;
        throw new Error(`Já possui um cadastro com esse CNPJ: ${label}`);
      }
    }
    updateData.cnpj = updates.cnpj;
  }
  if (updates.razao_social !== undefined) updateData.razao_social = updates.razao_social;
  if (updates.nome_fantasia !== undefined) updateData.nome_fantasia = updates.nome_fantasia;
  if (updates.company_segment !== undefined) updateData.company_segment = updates.company_segment;
  if (updates.employee_count !== undefined) updateData.employee_count = updates.employee_count;
  if (updates.revenue_range !== undefined) updateData.revenue_range = updates.revenue_range;
  if (updates.website !== undefined) updateData.website = updates.website;
  if (updates.porte !== undefined) updateData.porte = updates.porte;
  if (updates.capital_social !== undefined) updateData.capital_social = updates.capital_social;
  if (updates.cnae_fiscal !== undefined) updateData.cnae_fiscal = updates.cnae_fiscal;
  if (updates.cnae_fiscal_descricao !== undefined) updateData.cnae_fiscal_descricao = updates.cnae_fiscal_descricao;
  if (updates.cnaes_secundarios !== undefined) updateData.cnaes_secundarios = updates.cnaes_secundarios;
  if (updates.situacao_cadastral !== undefined) updateData.situacao_cadastral = updates.situacao_cadastral;
  if (updates.data_inicio_atividade !== undefined) (updateData as any).data_inicio_atividade = updates.data_inicio_atividade;
  if (updates.qsa !== undefined) (updateData as any).qsa = updates.qsa;
  if (updates.cep !== undefined) updateData.cep = updates.cep;
  if (updates.logradouro !== undefined) updateData.logradouro = updates.logradouro;
  if (updates.numero !== undefined) updateData.numero = updates.numero;
  if (updates.complemento !== undefined) updateData.complemento = updates.complemento;
  if (updates.bairro !== undefined) updateData.bairro = updates.bairro;
  if (updates.city !== undefined) updateData.city = updates.city;
  if (updates.state !== undefined) updateData.state = updates.state;
  if (updates.country !== undefined) updateData.country = updates.country;
  
  // Qualification data fields
  if (updates.product_interest !== undefined) updateData.product_interest = updates.product_interest;
  if (updates.uses_platform !== undefined) updateData.uses_platform = updates.uses_platform;
  if (updates.daily_service_volume !== undefined) updateData.daily_service_volume = updates.daily_service_volume;
  if (updates.main_pain_point !== undefined) updateData.main_pain_point = updates.main_pain_point;
  if (updates.solution_urgency !== undefined) updateData.solution_urgency = updates.solution_urgency;
  if (updates.has_budget !== undefined) updateData.has_budget = updates.has_budget;
  if (updates.qualification_notes !== undefined) updateData.qualification_notes = updates.qualification_notes;

  // SQO Validation fields
  if (updates.sqo_pain_category !== undefined) updateData.sqo_pain_category = updates.sqo_pain_category;
  if (updates.sqo_pain_other !== undefined) updateData.sqo_pain_other = updates.sqo_pain_other;
  if (updates.sqo_pain_clear !== undefined) updateData.sqo_pain_clear = updates.sqo_pain_clear;
  if (updates.sqo_pain_financial_impact !== undefined) updateData.sqo_pain_financial_impact = updates.sqo_pain_financial_impact;
  if (updates.sqo_urgency !== undefined) updateData.sqo_urgency = updates.sqo_urgency;
  if (updates.sqo_budget !== undefined) updateData.sqo_budget = updates.sqo_budget;
  if (updates.sqo_decision_maker !== undefined) updateData.sqo_decision_maker = updates.sqo_decision_maker;
  if (updates.sqo_icp_fit !== undefined) updateData.sqo_icp_fit = updates.sqo_icp_fit;
  if (updates.sqo_next_step !== undefined) updateData.sqo_next_step = updates.sqo_next_step;

  // AI data fields
  if (updates.ai_enrichment_data !== undefined) updateData.ai_enrichment_data = updates.ai_enrichment_data;
  if (updates.ai_insights_data !== undefined) updateData.ai_insights_data = updates.ai_insights_data;
  if (updates.ai_insights_generated_at !== undefined) updateData.ai_insights_generated_at = updates.ai_insights_generated_at;
  if (updates.ai_validation_alerts !== undefined) updateData.ai_validation_alerts = updates.ai_validation_alerts;

  const { data, error } = await supabase
    .from('leads')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating lead:', error);
    throw error;
  }


  return mapDbLeadToLead(data);
};

// Delete a lead
export const deleteLead = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting lead:', error);
    throw error;
  }
};

// Fetch interactions for a lead
export const fetchLeadInteractions = async (leadId: string): Promise<Interaction[]> => {
  const { data, error } = await supabase
    .from('interactions')
    .select('*')
    .eq('lead_id', leadId)
    .order('occurred_at', { ascending: false });

  if (error) {
    console.error('Error fetching interactions:', error);
    throw error;
  }

  return (data || []).map(row => ({
    id: row.id,
    lead_id: row.lead_id,
    user_id: row.user_id,
    channel: row.channel as Channel,
    direction: row.direction as 'inbound' | 'outbound',
    outcome: row.outcome as InteractionOutcome,
    message_summary: row.message_summary || '',
    occurred_at: row.occurred_at,
    created_at: row.created_at,
  }));
};

// Create an interaction
export const createInteraction = async (interaction: Omit<Interaction, 'id' | 'created_at'>): Promise<Interaction> => {
  const { data, error } = await supabase
    .from('interactions')
    .insert({
      lead_id: interaction.lead_id,
      user_id: interaction.user_id,
      channel: interaction.channel,
      direction: interaction.direction,
      outcome: interaction.outcome,
      message_summary: interaction.message_summary,
      occurred_at: interaction.occurred_at,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating interaction:', error);
    throw error;
  }

  return {
    id: data.id,
    lead_id: data.lead_id,
    user_id: data.user_id,
    channel: data.channel as Channel,
    direction: data.direction as 'inbound' | 'outbound',
    outcome: data.outcome as InteractionOutcome,
    message_summary: data.message_summary || '',
    occurred_at: data.occurred_at,
    created_at: data.created_at,
  };
};

// Fetch notes for a lead
export const fetchLeadNotes = async (leadId: string): Promise<LeadNote[]> => {
  const { data, error } = await supabase
    .from('lead_notes')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notes:', error);
    throw error;
  }

  return (data || []).map(row => ({
    id: row.id,
    lead_id: row.lead_id,
    user_id: row.user_id,
    note: row.note,
    created_at: row.created_at,
    attachments: (row as any).attachments || [],
  }));
};

// Create a note
export const createLeadNote = async (note: { lead_id: string; note: string; user_id?: string | null; attachments?: any[] }): Promise<LeadNote> => {
  // Get the current user's ID from the auth session
  const { data: { user } } = await supabase.auth.getUser();
  
  const insertData: any = {
    lead_id: note.lead_id,
    user_id: user?.id || null, // Always use auth.uid() for RLS compliance
    note: note.note,
  };
  if (note.attachments && note.attachments.length > 0) {
    insertData.attachments = note.attachments;
  }

  const { data, error } = await supabase
    .from('lead_notes')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error creating note:', error);
    throw error;
  }

  return {
    id: data.id,
    lead_id: data.lead_id,
    user_id: data.user_id,
    note: data.note,
    created_at: data.created_at,
    attachments: (data as any).attachments || [],
  };
};

// Update a note
export const updateLeadNote = async (noteId: string, noteText: string): Promise<LeadNote> => {
  const { data, error } = await supabase
    .from('lead_notes')
    .update({ note: noteText })
    .eq('id', noteId)
    .select()
    .single();

  if (error) {
    console.error('Error updating note:', error);
    throw error;
  }

  return {
    id: data.id,
    lead_id: data.lead_id,
    user_id: data.user_id,
    note: data.note,
    created_at: data.created_at,
  };
};

// Delete a note
export const deleteLeadNote = async (noteId: string): Promise<void> => {
  const { error } = await supabase
    .from('lead_notes')
    .delete()
    .eq('id', noteId);

  if (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
};

// Fetch cadence steps
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

// Get a specific cadence step
export const getCadenceStep = async (cadenceId: string, stepNumber: number): Promise<CadenceStep | null> => {
  const { data, error } = await supabase
    .from('cadence_steps')
    .select('*')
    .eq('cadence_id', cadenceId)
    .eq('step_number', stepNumber)
    .maybeSingle();

  if (error) {
    console.error('Error fetching cadence step:', error);
    throw error;
  }

  if (!data) return null;

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

// Bulk discard leads (mark as Descartado with a reason)
export const bulkDiscardLeads = async (leadIds: string[], reason: string): Promise<number> => {
  const { error } = await supabase
    .from('leads')
    .update({ 
      status: 'Descartado' as any,
      list_reason: reason,
      next_action_at: new Date('2099-12-31T23:59:59Z').toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', leadIds);

  if (error) {
    console.error('Error bulk discarding leads:', error);
    throw error;
  }

  return leadIds.length;
};

// ── Functions extracted from LeadModal ──

export interface MeetingRecord {
  id: string;
}

/** Create a meeting record for a lead */
export async function createMeeting(params: {
  leadId: string;
  userId: string | null;
  title: string;
  executiveName: string;
  meetingDatetime: string;
  reminderMinutesBefore: number;
}): Promise<string | undefined> {
  const { data, error } = await supabase
    .from('meetings')
    .insert({
      lead_id: params.leadId,
      user_id: params.userId,
      title: params.title,
      executive_name: params.executiveName,
      meeting_datetime: params.meetingDatetime,
      reminder_minutes_before: params.reminderMinutesBefore,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error saving meeting:', error);
    return undefined;
  }
  return data?.id;
}

/** Update meet_link on a meeting record */
export async function updateMeetingLink(meetingId: string, meetLink: string): Promise<void> {
  await supabase
    .from('meetings')
    .update({ meet_link: meetLink } as any)
    .eq('id', meetingId);
}

/** Send meeting invite emails via edge function */
export async function sendMeetingInvite(params: {
  emails: string[];
  meetingTitle: string;
  meetingDate: string;
  meetingTime: string;
  executiveName: string;
  companyName: string;
  sdrName: string;
  meetLink?: string;
}): Promise<void> {
  const { error } = await supabase.functions.invoke('send-meeting-invite', {
    body: params,
  });
  if (error) throw error;
}

/** Fetch the closer name for a lead (via opportunities + profiles) */
export async function fetchCloserNameForLead(leadId: string): Promise<string | null> {
  const { data: opp } = await supabase
    .from('opportunities')
    .select('assigned_to_user_id')
    .eq('lead_id', leadId)
    .eq('returned_to_sdr', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!opp?.assigned_to_user_id) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', opp.assigned_to_user_id)
    .single();

  return profile?.name || null;
}

/** Refresh lead data from database (e.g., after enrichment) */
export async function refreshLeadFromDb(leadId: string): Promise<Lead | null> {
  const { data } = await supabase.from('leads').select('*').eq('id', leadId).single();
  if (!data) return null;
  return mapDbLeadToLead(data);
}
