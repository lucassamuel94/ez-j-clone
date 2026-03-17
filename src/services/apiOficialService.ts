import { supabase } from '@/integrations/supabase/client';

export interface ApiOficialDeal {
  id: string;
  lead_id: string;
  stage: string;
  assigned_to_user_id: string | null;
  created_by_user_id: string;
  sdr_user_id: string | null;
  notes: string | null;
  lost_reason: string | null;
  lead_name: string | null;
  lead_company: string | null;
  lead_cnpj: string | null;
  lead_phone: string | null;
  lead_email: string | null;
  lead_website: string | null;
  created_at: string;
  updated_at: string;
  // joined
  closer_name?: string | null;
  sdr_name?: string | null;
}

export const API_OFICIAL_STAGES = [
  'Acionar',
  'Em contato',
  'Reunião agendada',
  'Aguardando retorno',
  'Não quer agora',
  'Enviar Pós Venda',
] as const;

export const API_OFICIAL_KANBAN_STAGES = [
  'Acionar',
  'Em contato',
  'Reunião agendada',
  'Aguardando retorno',
] as const;

export const API_OFICIAL_TERMINAL_STAGES = ['Não quer agora', 'Enviar Pós Venda'] as const;

export const fetchApiOficialDeals = async (
  closerId?: string | null,
  search?: string,
): Promise<ApiOficialDeal[]> => {
  let query = supabase
    .from('api_oficial_deals' as any)
    .select('*')
    .order('created_at', { ascending: false });

  if (closerId) {
    query = query.eq('assigned_to_user_id', closerId);
  }

  if (search) {
    query = query.or(`lead_name.ilike.%${search}%,lead_company.ilike.%${search}%,lead_cnpj.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Fetch closer/sdr names separately
  const rows = (data || []) as any[];
  const userIds = new Set<string>();
  rows.forEach(r => {
    if (r.assigned_to_user_id) userIds.add(r.assigned_to_user_id);
    if (r.sdr_user_id) userIds.add(r.sdr_user_id);
  });

  let profileMap: Record<string, string> = {};
  if (userIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', Array.from(userIds));
    (profiles || []).forEach((p: any) => { profileMap[p.id] = p.name; });
  }

  return rows.map((row: any) => ({
    ...row,
    closer_name: profileMap[row.assigned_to_user_id] || null,
    sdr_name: profileMap[row.sdr_user_id] || null,
  }));
};

export const createApiOficialDeal = async (params: {
  lead_id: string;
  assigned_to_user_id?: string;
  sdr_user_id?: string;
  lead_name?: string;
  lead_company?: string;
  lead_cnpj?: string;
  lead_phone?: string;
  lead_email?: string;
  lead_website?: string;
}): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data, error } = await supabase
    .from('api_oficial_deals' as any)
    .insert({
      ...params,
      created_by_user_id: user.id,
      assigned_to_user_id: params.assigned_to_user_id || user.id,
      stage: 'Acionar',
    } as any)
    .select('id')
    .single();

  if (error) throw error;
  return (data as any).id;
};

export const updateApiOficialStage = async (dealId: string, newStage: string): Promise<void> => {
  const { error } = await supabase
    .from('api_oficial_deals' as any)
    .update({ stage: newStage, updated_at: new Date().toISOString() } as any)
    .eq('id', dealId);

  if (error) throw error;
};

export const updateApiOficialNotes = async (dealId: string, notes: string): Promise<void> => {
  const { error } = await supabase
    .from('api_oficial_deals' as any)
    .update({ notes, updated_at: new Date().toISOString() } as any)
    .eq('id', dealId);

  if (error) throw error;
};

export const markApiOficialLost = async (dealId: string, reason: string): Promise<void> => {
  const { error } = await supabase
    .from('api_oficial_deals' as any)
    .update({
      stage: 'Não quer agora',
      lost_reason: reason,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', dealId);

  if (error) throw error;
};

export const deleteApiOficialDeal = async (dealId: string): Promise<void> => {
  const { error } = await supabase
    .from('api_oficial_deals' as any)
    .delete()
    .eq('id', dealId);

  if (error) throw error;
};

export const createApiOficialDealFromClient = async (
  activeClientId: string,
  userId: string,
): Promise<string> => {
  // 1. Fetch account (unified client entity)
  const { data: client, error: clientError } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', activeClientId)
    .single();
  if (clientError || !client) throw new Error('Cliente não encontrado');

  const c = client as any;
  const cnpj = (c.cnpj as string)?.replace(/\D/g, '') || '';

  // 2. Check for existing active api_oficial_deal with same CNPJ
  if (cnpj.length === 14) {
    const { data: existing } = await supabase
      .from('api_oficial_deals' as any)
      .select('id')
      .eq('lead_cnpj', cnpj)
      .not('stage', 'in', '("Não quer agora","Enviar Pós Venda")')
      .limit(1);
    if (existing && (existing as any[]).length > 0) {
      throw new Error('Já existe uma solicitação de API Oficial ativa para este CNPJ.');
    }
  }

  // 3. Find or create lead
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
          name: c.contact_name || c.company_name,
          company: c.company_name,
          cnpj: c.cnpj,
          razao_social: c.razao_social,
          nome_fantasia: c.nome_fantasia,
          email: c.email,
          phone: c.phone,
          city: c.city,
          state: c.state,
          website: c.website,
          lead_type: 'OUTBOUND' as any,
          source: 'Base de Clientes',
          status: 'Oportunidade criada' as any,
        } as any)
        .select('id')
        .single();
      if (leadError || !newLead) throw new Error('Erro ao criar lead');
      leadId = (newLead as any).id;
    }
  } else {
    const { data: newLead, error: leadError } = await supabase
      .from('leads')
      .insert({
        name: c.contact_name || c.company,
        company: c.company,
        email: c.email,
        phone: c.phone,
        city: c.city,
        state: c.state,
        website: c.website,
        lead_type: 'OUTBOUND' as any,
        source: 'Base de Clientes',
        status: 'Oportunidade criada' as any,
      } as any)
      .select('id')
      .single();
    if (leadError || !newLead) throw new Error('Erro ao criar lead');
    leadId = (newLead as any).id;
  }

  // 4. Create api_oficial_deal
  const { data, error } = await supabase
    .from('api_oficial_deals' as any)
    .insert({
      lead_id: leadId,
      created_by_user_id: userId,
      assigned_to_user_id: userId,
      stage: 'Acionar',
      lead_name: c.contact_name || '',
      lead_company: c.company || '',
      lead_cnpj: cnpj || null,
      lead_phone: c.phone || null,
      lead_email: c.email || null,
      lead_website: c.website || null,
    } as any)
    .select('id')
    .single();
  if (error) throw error;
  return (data as any).id as string;
};
