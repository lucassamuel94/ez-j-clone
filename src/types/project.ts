// Project types and constants

export type ProjectType = 'venda' | 'evolucao' | 'api_oficial' | 'migracao';

export type ProjectPriority = 'baixa' | 'media' | 'alta' | 'urgente';

export type ProjectOverallStatus = 'ativo' | 'em_pausa' | 'concluido' | 'cancelado';

export type ApiType = 'oficial' | 'extra' | 'oficial_e_extra';

export type BrokerType = 'gupshup' | 'hyperflow' | 'ez';

// Phase names per project type
export const PHASES_BY_TYPE: Record<ProjectType, string[]> = {
  venda: ['validacao', 'ux_po', 'dev_chatbot', 'treinamento', 'ativacao', 'automacao', 'curadoria_ia', 'go_live_assistido'],
  evolucao: ['validacao', 'ux_po', 'dev_chatbot', 'curadoria_ia'],
  api_oficial: ['validacao', 'verificacao_bm', 'ativacao'],
  migracao: ['validacao', 'ux_po', 'dev_chatbot', 'treinamento', 'ativacao', 'automacao', 'curadoria_ia'],
};

// Status options per phase
export const PHASE_STATUSES: Record<string, string[]> = {
  validacao: ['BACKLOG', 'EM ANÁLISE', 'DADOS INCOMPLETOS', 'VALIDADO', 'PAUSADO', 'CONCLUÍDO'],
  ux_po: ['BACKLOG', 'MAPEAMENTO DE PROCESSOS', 'MONTAGEM DE FLUXO', 'REVISÃO INTERNA', 'APROVAÇÃO DO CLIENTE', 'AJUSTES', 'PAUSADO', 'CONCLUÍDO'],
  dev_chatbot: ['BACKLOG', 'DESENVOLVIMENTO', 'QA', 'REVISÃO', 'PAUSADO', 'CONCLUÍDO'],
  treinamento: ['BACKLOG', 'AGENDAMENTO', 'MATERIAL PREPARADO', 'TREINAMENTO REALIZADO', 'PAUSADO', 'CONCLUÍDO'],
  ativacao: ['BACKLOG', 'EM ANDAMENTO', 'COM PENDÊNCIA', 'PAUSADO', 'CONCLUÍDO'],
  verificacao_bm: ['BACKLOG', 'EM CONTATO', 'REUNIÃO AGENDADA', 'AGUARDANDO CLIENTE', 'AGUARDANDO META', 'PAUSADO', 'CANCELADO', 'CONCLUÍDO'],
  automacao: ['BACKLOG', 'EM DESENVOLVIMENTO', 'EM TESTE', 'PAUSADO', 'CONCLUÍDO'],
  curadoria_ia: ['BACKLOG', 'EM PROCESSO DE CURADORIA', 'EM PAUSA', 'GESTÃO DE PENDÊNCIAS', 'CONCLUÍDO'],
  go_live_assistido: ['BACKLOG', 'EM ACOMPANHAMENTO', 'PAUSADO', 'CONCLUÍDO'],
};

// Business days distribution per phase by complexity level
export const PHASE_DEADLINES_BY_COMPLEXITY: Record<string, Record<string, number>> = {
  baixa:  { validacao: 1, ux_po: 3, dev_chatbot: 7,  treinamento: 2, ativacao: 2, automacao: 5, go_live_assistido: 5, verificacao_bm: 5 },
  media:  { validacao: 1, ux_po: 4, dev_chatbot: 10, treinamento: 3, ativacao: 2, automacao: 5, go_live_assistido: 5, verificacao_bm: 5 },
  alta:   { validacao: 2, ux_po: 6, dev_chatbot: 14, treinamento: 4, ativacao: 4, automacao: 5, go_live_assistido: 5, verificacao_bm: 5 },
};

// Labels for display
export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  venda: 'Venda',
  evolucao: 'Evolução',
  api_oficial: 'API Oficial',
  migracao: 'Migração',
};

export const PHASE_LABELS: Record<string, string> = {
  validacao: 'Validação',
  ux_po: 'UX/PO',
  dev_chatbot: 'Dev Chatbot',
  treinamento: 'Treinamento',
  ativacao: 'Ativação',
  verificacao_bm: 'Verificação BM',
  automacao: 'Automação',
  curadoria_ia: 'Curadoria de IA',
  go_live_assistido: 'Go-Live Assistido',
};

// All unique phases for sidebar display
export const ALL_PHASES = [
  'validacao', 'ux_po', 'dev_chatbot', 'treinamento', 'ativacao',
  'automacao', 'curadoria_ia', 'go_live_assistido', 'verificacao_bm',
] as const;

export const PRIORITY_LABELS: Record<ProjectPriority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const API_TYPE_LABELS: Record<ApiType, string> = {
  oficial: 'Oficial',
  extra: 'Extra',
  oficial_e_extra: 'Oficial e Extra',
};

export const BROKER_LABELS: Record<BrokerType, string> = {
  gupshup: 'Gupshup',
  hyperflow: 'HyperFlow',
  ez: 'EZ',
};

// Database row types
export interface Project {
  id: string;
  project_number: number;
  opportunity_id: string | null;
  lead_id: string | null;
  project_type: ProjectType;
  current_phase: string | null;
  overall_status: string;
  company_name: string;
  cnpj: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  version: string | null;
  api_type: string | null;
  plan_name: string | null;
  has_integration: boolean | null;
  integrations_description: string | null;
  extra_storage: string | null;
  project_description: string | null;
  website: string | null;
  storage_time: string | null;
  closer_name: string | null;
  sdr_name: string | null;
  broker: string | null;
  has_coexistence: boolean | null;
  activation_phone: string | null;
  has_ai: boolean | null;
  complexity_level: string | null;
  priority: string;
  tags: string[] | null;
  start_date: string | null;
  due_date: string | null;
  estimated_hours: number | null;
  created_by_user_id: string | null;
  closer_user_id: string | null;
  sdr_user_id: string | null;
  head_user_id: string | null;
  ux_po_user_id: string | null;
  dev_user_id: string | null;
  treinamento_user_id: string | null;
  ativacao_user_id: string | null;
  checklist_data: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived: boolean;
}

export interface ProjectPhase {
  id: string;
  project_id: string;
  phase_name: string;
  status: string;
  assigned_user_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  is_active: boolean | null;
  sort_order: number;
  notes: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectStatusTransition {
  id: string;
  project_id: string;
  phase_name: string;
  status: string;
  entered_at: string;
  exited_at: string | null;
  duration_minutes: number | null;
  changed_by_user_id: string | null;
}

export interface ProjectActivityLog {
  id: string;
  project_id: string;
  user_id: string | null;
  action_type: string;
  phase_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string;
  created_at: string;
}

// Checklist data types
export interface VendaChecklistData {
  type: 'venda';
  razao_social: string;
  nome_fantasia?: string;
  cnpj: string;
  versao: 'V2' | 'VP';
  responsavel_nome: string;
  responsavel_telefone: string;
  responsavel_email: string;
  closer_responsavel_user_id?: string;
  api_type: ApiType;
  plano: string;
  possui_integracao: boolean;
  quais_integracoes: string;
  armazenamento_extra?: string;
  tempo_armazenamento?: string;
  descricao_projeto: string;
  website?: string;
  usa_ia?: boolean;
}

export interface EvolucaoChecklistData {
  type: 'evolucao';
  razao_social: string;
  nome_fantasia?: string;
  cnpj: string;
  versao_atual: 'V2' | 'VP';
  responsavel_nome: string;
  responsavel_telefone: string;
  responsavel_email: string;
  closer_responsavel_user_id?: string;
  api_type: ApiType;
  possui_integracao: boolean;
  quais_integracoes: string;
  descricao_projeto: string;
  website?: string;
  usa_ia?: boolean;
}

export interface ApiOficialChecklistData {
  type: 'api_oficial';
  razao_social: string;
  nome_fantasia?: string;
  cnpj: string;
  versao: string;
  responsavel_nome: string;
  responsavel_telefone: string;
  responsavel_email: string;
  broker: BrokerType;
  tera_coexistencia: boolean;
  numero_api_oficial: string;
  forma_pagamento: 'boleto' | 'cartao';
  observacao?: string;
  website?: string;
}

export interface MigracaoChecklistData {
  type: 'migracao';
  razao_social: string;
  nome_fantasia?: string;
  cnpj: string;
  versao: 'V2' | 'VP';
  responsavel_nome: string;
  responsavel_telefone: string;
  responsavel_email: string;
  closer_responsavel_user_id?: string;
  api_type: ApiType;
  plano: string;
  possui_integracao: boolean;
  quais_integracoes: string;
  armazenamento_extra?: string;
  tempo_armazenamento?: string;
  descricao_projeto: string;
  website?: string;
  usa_ia?: boolean;
}

export type ChecklistData = VendaChecklistData | EvolucaoChecklistData | ApiOficialChecklistData | MigracaoChecklistData;
