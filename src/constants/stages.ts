import type { LeadStatus } from '@/types/lead';

// ── SDR Pipeline ─────────────────────────────────────────

export const SDR_KANBAN_STATUSES: LeadStatus[] = [
  'Novo', 'Em contato', 'Lead Quente', 'Reunião agendada',
  'Reunião Confirmada', 'Oportunidade Futura', 'Reciclagem',
  'Ocupado', 'Agendar retorno', 'Sem retorno',
  'Oportunidade criada', 'Descartado',
];

export interface FunnelStep {
  key: string;
  label: string;
}

export const SDR_FUNNEL_STEPS: FunnelStep[] = [
  { key: 'novo', label: 'Novo' },
  { key: 'em_contato', label: 'Em contato' },
  { key: 'lead_quente', label: 'Lead quente' },
  { key: 'reuniao', label: 'Reunião agendada' },
  { key: 'sqo', label: 'Reunião Confirmada' },
  { key: 'oportunidade_futura', label: 'Oportunidade futura' },
  { key: 'reciclagem', label: 'Reciclagem' },
  { key: 'perdido', label: 'Perdido' },
];

export const SDR_STATUS_TO_STEP: Record<string, string> = {
  'Novo': 'novo',
  'Devolvido pelo Closer': 'novo',
  'Em contato': 'em_contato',
  'Ocupado': 'em_contato',
  'Agendar retorno': 'em_contato',
  'Sem retorno': 'em_contato',
  'Interesse': 'lead_quente',
  'Reagendar Reunião': 'em_contato',
  'Reunião agendada': 'reuniao',
  'Interesse/Agendar Retorno': 'oportunidade_futura',
  'Oportunidade criada': 'sqo',
  'Descartado': 'perdido',
  'Reciclagem': 'reciclagem',
};

export const SDR_LINEAR_STEPS = ['novo', 'em_contato', 'lead_quente', 'reuniao', 'sqo'];

export const SDR_STEP_SHORT_LABELS: Record<string, string> = {
  novo: 'Novo',
  em_contato: 'Em contato',
  lead_quente: 'Lead quente',
  reuniao: 'Reunião',
  sqo: 'Confirmada',
  oportunidade_futura: 'Op. Futura',
  reciclagem: 'Reciclagem',
  perdido: 'Perdido',
};

// ── Closer Pipeline ──────────────────────────────────────

export const CLOSER_STAGES = [
  'Demonstração',
  'Apresentar proposta',
  'Proposta enviada',
  'Negociação',
  'Oportunidade Quente',
  'Oportunidade Futura',
  'Oportunidade Fria',
  'Contrato enviado',
  'Aguardando pagamento',
  'Ganho',
  'Perdido',
] as const;

export const CLOSER_STAGES_DISPLAY = [
  'Demonstração',
  'Devolver ao SDR',
  'Apresentar proposta',
  'Proposta enviada',
  'Negociação',
  'Oportunidade Quente',
  'Oportunidade Futura',
  'Oportunidade Fria',
  'Contrato enviado',
  'Aguardando pagamento',
  'Ganho',
  'Perdido',
] as const;

// ── Evolution Pipeline ───────────────────────────────────

export const EVOLUTION_STAGES = [
  'Proposta enviada',
  'Negociação',
  'Oportunidade Quente',
  'Oportunidade Futura',
  'Oportunidade Fria',
  'Contrato enviado',
  'Aguardando pagamento',
  'Ganho',
  'Perdido',
] as const;

export const EVOLUTION_STAGES_DISPLAY = [
  'Proposta enviada',
  'Negociação',
  'Oportunidade Quente',
  'Oportunidade Futura',
  'Oportunidade Fria',
  'Contrato enviado',
  'Aguardando pagamento',
  'Ganho',
  'Perdido',
] as const;

export type CloserStage = typeof CLOSER_STAGES[number] | 'Negociação';
