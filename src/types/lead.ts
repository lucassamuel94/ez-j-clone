// Lead Types and Interfaces for SDR CRM

export type LeadType = 'INBOUND' | 'OUTBOUND' | 'INDICACAO';

export type LeadStatus = 
  | 'Novo' 
  | 'Em contato' 
  | 'Ocupado'
  | 'Agendar retorno'
  | 'Sem retorno'
  | 'Interesse'
  | 'Lead Quente'
  | 'Interesse/Agendar Retorno'
  | 'Oportunidade Futura'
  | 'Reagendar Reunião'
  | 'Reunião agendada'
  | 'Reunião Confirmada'
  | 'Oportunidade criada' 
  | 'Descartado'
  | 'Reciclagem'
  | 'Devolvido pelo Closer';

export type Channel = 'whatsapp' | 'call' | 'email' | 'other';

export type InteractionOutcome = 
  | 'sem_resposta' 
  | 'respondeu' 
  | 'qualificado' 
  | 'reagendado' 
  | 'descartado';

export type LeadTemperature = 'frio' | 'morno' | 'quente';

export interface Lead {
  id: string;
  lead_type: LeadType;
  name: string;
  company: string;
  whatsapp?: string;
  phone: string;
  phone_2?: string;
  phone_3?: string;
  phone_4?: string;
  email: string;
  contact_name_2?: string;
  email_2?: string;
  source: string;
  status: LeadStatus;
  temperature?: LeadTemperature;
  owner_user_id: string;
  owner_name?: string;
  priority_score: number;
  last_contact_at: string | null;
  next_action_at: string;
  attempts_count: number;
  created_at: string;
  updated_at: string;
  // INBOUND specific
  initial_message?: string;
  entry_channel?: Channel;
  // OUTBOUND specific
  icp_fit?: string;
  list_reason?: string;
  cadence_id?: string;
  current_cadence_step?: number;
  // Company data (from Econodata/BrasilAPI)
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  company_segment?: string;
  employee_count?: string;
  revenue_range?: string;
  website?: string;
  porte?: string;
  capital_social?: number;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: string;
  situacao_cadastral?: string;
  data_inicio_atividade?: string;
  qsa?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  city?: string;
  state?: string;
  country?: string;
  // Qualification data
  product_interest?: string;
  uses_platform?: string | null;
  daily_service_volume?: string;
  main_pain_point?: string;
  solution_urgency?: string;
  has_budget?: string;
  qualification_notes?: string;
  // SQO Validation fields (Closer)
  sqo_pain_category?: string;
  sqo_pain_other?: string;
  sqo_pain_clear?: boolean;
  sqo_pain_financial_impact?: boolean;
  sqo_urgency?: string;
  sqo_budget?: string;
  sqo_decision_maker?: string;
  sqo_icp_fit?: string;
  sqo_next_step?: string;
  // AI-generated data (persisted)
  ai_enrichment_data?: Record<string, any> | null;
  ai_insights_data?: Record<string, any> | null;
  ai_insights_generated_at?: string | null;
  ai_validation_alerts?: Array<{ type: string; message: string }> | null;
  // External integrations
  clickup_id?: string;
  // Behavioral Score (Magnet Engine)
  behavioral_score?: number | null;
  score_variation_48h?: number;
  score_variation_reason?: string;
  ai_next_action_suggestion?: string;
  closing_probability?: number;
  closing_probability_reason?: string;
  is_hot_lead?: boolean;
  last_score_calculated_at?: string;
  // SQO approval (immutable once set)
  sqo_approved_at?: string | null;
  sqo_approved_by?: string | null;
  // UTM tracking
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  // Enrichment tracking
  enriched_at?: string | null;
}

export interface Interaction {
  id: string;
  lead_id: string;
  user_id: string | null;
  channel: Channel;
  direction: 'inbound' | 'outbound';
  outcome: InteractionOutcome;
  message_summary: string;
  occurred_at: string;
  created_at: string;
}

export interface CadenceStep {
  id: string;
  cadence_id: string;
  step_number: number;
  wait_hours: number;
  channel: Channel;
  script_template: string;
  objective: string;
}

export interface Cadence {
  id: string;
  name: string;
  description: string;
  active: boolean;
  steps: CadenceStep[];
}

export interface LeadNoteAttachment {
  name: string;
  path: string;
  size: number;
  type: string;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  user_id: string | null;
  note: string;
  created_at: string;
  attachments?: LeadNoteAttachment[];
}

// Filter types
export type FilterType = 'today' | 'in_contact_return' | 'overdue' | 'new' | 'scheduled' | 'confirmed' | 'discarded' | 'future_opportunity' | 'all' | 'devolvido_closer' | 'ocupado' | 'nao_atendeu' | 'sem_retorno' | 'agendar_retorno';

// Priority calculation helpers
export interface PriorityFactors {
  isOverdue: boolean;
  hoursOverdue: number;
  hoursSinceCreation: number;
  attemptsMade: number;
  leadType: LeadType;
}
