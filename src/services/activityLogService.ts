import { supabase } from '@/integrations/supabase/client';

export interface ActivityLog {
  id: string;
  lead_id: string;
  user_id: string | null;
  user_name?: string;
  action_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string;
  created_at: Date;
}

export type ActionType = 
  | 'created'
  | 'status_changed'
  | 'temperature_changed'
  | 'field_updated'
  | 'owner_assigned'
  | 'owner_removed'
  | 'note_added'
  | 'note_updated'
  | 'note_deleted'
  | 'interaction_added'
  | 'cadence_started'
  | 'cadence_step_changed'
  | 'meeting_scheduled'
  | 'opportunity_created'
  | 'interaction_registered';

// Fetch activity logs for a lead
export const fetchActivityLogs = async (leadId: string): Promise<ActivityLog[]> => {
  const { data, error } = await supabase
    .from('lead_activity_logs')
    .select('*, profiles:user_id(name)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching activity logs:', error);
    throw error;
  }

  return (data || []).map(row => ({
    id: row.id,
    lead_id: row.lead_id,
    user_id: row.user_id,
    user_name: (row.profiles as any)?.name || 'Sistema',
    action_type: row.action_type,
    field_name: row.field_name,
    old_value: row.old_value,
    new_value: row.new_value,
    description: row.description,
    created_at: new Date(row.created_at),
  }));
};

// Create an activity log entry
export const createActivityLog = async (log: {
  lead_id: string;
  action_type: ActionType;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  description: string;
}): Promise<ActivityLog> => {
  const { data: userData } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('lead_activity_logs')
    .insert({
      lead_id: log.lead_id,
      user_id: userData.user?.id || null,
      action_type: log.action_type,
      field_name: log.field_name || null,
      old_value: log.old_value || null,
      new_value: log.new_value || null,
      description: log.description,
    })
    .select('id, lead_id, user_id, action_type, field_name, old_value, new_value, description, created_at')
    .maybeSingle();

  if (error) {
    console.error('Error creating activity log:', error);
    throw error;
  }

  return {
    id: data?.id || '',
    lead_id: data?.lead_id || log.lead_id,
    user_id: data?.user_id || userData.user?.id || null,
    user_name: 'Sistema',
    action_type: data?.action_type || log.action_type,
    field_name: data?.field_name || null,
    old_value: data?.old_value || null,
    new_value: data?.new_value || null,
    description: data?.description || log.description,
    created_at: data?.created_at ? new Date(data.created_at) : new Date(),
  };
};

// Helper to generate description for field changes
export const getFieldChangeDescription = (fieldName: string, oldValue: string | null, newValue: string | null): string => {
  const fieldLabels: Record<string, string> = {
    name: 'Nome',
    company: 'Empresa',
    whatsapp: 'WhatsApp (legado)',
    phone: 'Telefone',
    phone_2: 'Telefone 2',
    email: 'E-mail',
    status: 'Status',
    temperature: 'Score de Qualificação',
    source: 'Origem',
    cnpj: 'CNPJ',
    razao_social: 'Razão Social',
    nome_fantasia: 'Nome Fantasia',
    company_segment: 'Segmento',
    employee_count: 'Nº Funcionários',
    revenue_range: 'Faixa de Faturamento',
    website: 'Site',
    city: 'Cidade',
    state: 'Estado',
    cep: 'CEP',
    product_interest: 'Interesse no Produto',
    daily_service_volume: 'Volume Diário',
    main_pain_point: 'Principal Dor',
    solution_urgency: 'Urgência',
    has_budget: 'Possui Orçamento',
    owner_user_id: 'Responsável',
  };

  const label = fieldLabels[fieldName] || fieldName;

  if (!oldValue && newValue) {
    return `definiu ${label} como ${newValue}`;
  } else if (oldValue && !newValue) {
    return `removeu ${label}`;
  } else {
    return `alterou ${label} de ${oldValue} para ${newValue}`;
  }
};

// Temperature labels
export const getTemperatureLabel = (temp: string | null): string => {
  const labels: Record<string, string> = {
    frio: '▫ Baixo',
    morno: '▪ Médio',
    quente: '▮ Alto',
  };
  return temp ? labels[temp] || temp : '';
};

// Status labels
export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    'Novo': '🆕 Novo',
    'Em contato': '📞 Follow-up em andamento',
    'Ocupado': '⏳ Ocupado',
    'Agendar retorno': '🔄 Agendar retorno',
    'Agendar Retorno': '🔄 Agendar Retorno',
    'Sem retorno': '🚫 Sem retorno',
    'Reunião agendada': '📅 Reunião agendada',
    'Reunião Agendada': '📅 Reunião Agendada',
    'Reunião Confirmada': '📅 Reunião Confirmada',
    'Lead Quente': '🔥 Lead Quente',
    'Oportunidade Futura': '📋 Oportunidade Futura',
    'Interesse/Agendar Retorno': '📅 Interesse/Agendar Retorno',
    'Oportunidade criada': '✅ Oportunidade criada',
    'Descartado': '❌ Perdido',
    'Devolvido pelo Closer': '🔄 Devolvido pelo Closer',
  };
  return labels[status] || status;
};
