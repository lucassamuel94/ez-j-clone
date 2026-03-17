import { Lead } from '@/types/lead';
import { calculateQualificationScore } from './qualificationScore';

/**
 * Behavioral Score Engine (0-100)
 * Weighted calculation:
 * - Score comportamental (qualificação): 40%
 * - Tempo parado (idle): 20%
 * - Prioridade IA (enrichment/insights): 20%
 * - Temperatura: 10%
 * - SLA estourado: 10%
 */

const hoursSince = (date: Date | string | null): number => {
  if (!date) return 999;
  const d = typeof date === 'string' ? new Date(date) : date;
  return Math.abs(new Date().getTime() - d.getTime()) / (1000 * 60 * 60);
};

// 1. Qualification score component (0-100, weight 40%)
const getQualificationComponent = (lead: Lead): number => {
  return calculateQualificationScore(lead); // Already 0-100
};

// 2. Idle time component (0-100, weight 20%) - higher = more urgent
const getIdleComponent = (lead: Lead): number => {
  const lastDate = lead.last_contact_at || lead.created_at;
  const idleHours = hoursSince(lastDate);
  
  if (idleHours > 120) return 100; // 5+ days
  if (idleHours > 72) return 80;   // 3+ days
  if (idleHours > 48) return 60;   // 2+ days
  if (idleHours > 24) return 40;   // 1+ day
  if (idleHours > 8) return 20;    // 8+ hours
  return 0;
};

// 3. AI Priority component (0-100, weight 20%)
const getAIPriorityComponent = (lead: Lead): number => {
  let score = 0;
  
  // Has AI enrichment data
  if (lead.ai_enrichment_data) score += 20;
  
  // Has AI insights
  if (lead.ai_insights_data) score += 20;
  
  // Has validation alerts (negative = needs attention)
  if (lead.ai_validation_alerts && Array.isArray(lead.ai_validation_alerts) && lead.ai_validation_alerts.length > 0) {
    score += 30;
  }
  
  // Company data completeness
  if (lead.cnpj) score += 10;
  if (lead.razao_social) score += 10;
  if (lead.employee_count) score += 10;
  
  return Math.min(100, score);
};

// 4. Temperature component (0-100, weight 10%)
const getTemperatureComponent = (lead: Lead): number => {
  switch (lead.temperature) {
    case 'quente': return 100;
    case 'morno': return 50;
    case 'frio': return 10;
    default: return 0;
  }
};

// 5. SLA component (0-100, weight 10%)
const getSLAComponent = (lead: Lead): number => {
  if (!lead.next_action_at) return 0;
  const nextAction = new Date(lead.next_action_at);
  const now = new Date();
  const diffHours = (now.getTime() - nextAction.getTime()) / (1000 * 60 * 60);

  if (diffHours > 48) return 100;  // 2+ days overdue
  if (diffHours > 24) return 80;   // 1+ day overdue
  if (diffHours > 4) return 60;    // 4+ hours overdue
  if (diffHours > 0) return 40;    // Just overdue
  if (diffHours > -4) return 20;   // Due within 4h
  return 0;
};

export interface ScoreBreakdown {
  total: number;
  qualification: number;
  idle: number;
  aiPriority: number;
  temperature: number;
  sla: number;
}

export const calculateBehavioralScore = (lead: Lead): ScoreBreakdown => {
  const qualification = getQualificationComponent(lead);
  const idle = getIdleComponent(lead);
  const aiPriority = getAIPriorityComponent(lead);
  const temperature = getTemperatureComponent(lead);
  const sla = getSLAComponent(lead);
  
  const total = Math.round(
    qualification * 0.4 +
    idle * 0.2 +
    aiPriority * 0.2 +
    temperature * 0.1 +
    sla * 0.1
  );
  
  return { total: Math.min(100, total), qualification, idle, aiPriority, temperature, sla };
};

/**
 * Check if lead qualifies as "Hot Lead"
 * Conditions: Score >= 75 AND status = Oportunidade criada
 * (hasInterest was redundant — meetingHeld is a strict subset of it)
 */
export const isHotLead = (lead: Lead): boolean => {
  const score = lead.behavioral_score ?? calculateBehavioralScore(lead).total;
  return score >= 75 && lead.status === 'Oportunidade criada';
};

/**
 * Rule-based next action suggestion engine
 */
export const suggestNextAction = (lead: Lead): string => {
  const score = lead.behavioral_score ?? calculateBehavioralScore(lead).total;
  const lastDate = lead.last_contact_at || lead.created_at;
  const idleHours = hoursSince(lastDate);
  const isOverdue = lead.next_action_at ? new Date(lead.next_action_at) < new Date() : false;
  
  // Critical: overdue + high score
  if (isOverdue && score >= 70) {
    return 'Ligar agora — Lead quente com tarefa atrasada';
  }
  
  // No response + multiple attempts
  if (lead.status === 'Em contato' && lead.attempts_count >= 3) {
    return 'Enviar WhatsApp com proposta de valor + agendar última tentativa';
  }
  
  // Idle too long
  if (idleHours > 72 && lead.status !== 'Descartado') {
    return 'Reengajar via WhatsApp — Lead parado há mais de 3 dias';
  }
  
  // Interest shown but no meeting
  if ((lead.status === 'Interesse' || lead.status === 'Interesse/Agendar Retorno') && idleHours > 24) {
    return 'Confirmar reunião e enviar lembrete com pauta';
  }
  
  // New lead with high score
  if (lead.status === 'Novo' && score >= 60) {
    return 'Priorizar contato imediato — Lead com alto potencial';
  }
  
  // New lead, low score
  if (lead.status === 'Novo') {
    return 'Fazer primeiro contato por WhatsApp para qualificação rápida';
  }
  
  // Follow-up in progress
  if (lead.status === 'Em contato') {
    if (idleHours > 48) return 'Reforçar follow-up — 2 dias sem interação';
    return 'Manter cadência de follow-up conforme planejado';
  }
  
  // Returned by closer
  if (lead.status === 'Devolvido pelo Closer') {
    return 'Contatar imediatamente — Lead devolvido precisa de ação urgente';
  }
  
  // Default
  return 'Seguir cadência padrão para este estágio';
};

/**
 * Objection types for structured tracking
 */
export const OBJECTION_TYPES = [
  { id: 'preco', label: 'Preço' },
  { id: 'concorrente', label: 'Concorrente' },
  { id: 'falta_urgencia', label: 'Falta de urgência' },
  { id: 'sem_decisor', label: 'Sem decisor' },
  { id: 'sem_orcamento', label: 'Sem orçamento' },
  { id: 'timing', label: 'Timing' },
] as const;

export type ObjectionType = typeof OBJECTION_TYPES[number]['id'];

/**
 * Calculate closing probability for Closer (enhanced model)
 * Weights:
 * - Reunião realizada (15%)
 * - Decisor confirmado (15%)
 * - Orçamento confirmado (15%)
 * - Score comportamental (20%)
 * - Tempo no estágio (10%)
 * - Histórico semelhante ganho (15%)
 * - Objeção ativa negativa (-10%)
 */
export const calculateClosingProbability = (lead: Lead, opportunity?: any): number => {
  let probability = 0;
  
  const score = lead.behavioral_score ?? calculateBehavioralScore(lead).total;
  
  // 1. Reunião (15%)
  if (opportunity?.meeting_datetime) {
    const meetingDate = new Date(opportunity.meeting_datetime);
    const now = new Date();
    if (meetingDate < now) {
      probability += 15; // Reunião realizada
    } else if (opportunity.scheduled_by === 'vendedor') {
      probability += 12; // Agendada pelo vendedor (futuro)
    } else if (opportunity.scheduled_by === 'sdr') {
      probability += 8;  // Agendada pelo SDR (futuro)
    }
    // Outros (sem scheduled_by) = +0
  }
  
  // 2. Decisor confirmado (15%) - matches SQO values: 'proprio', 'socio_mapeado'
  if (lead.sqo_decision_maker === 'proprio' || opportunity?.decision_maker_identified) probability += 15;
  else if (lead.sqo_decision_maker === 'socio_mapeado') probability += 10;
  
  // 3. Orçamento confirmado (15%) - matches SQO values: 'sim_ok', 'sim_ajuste'
  if (lead.sqo_budget === 'sim_ok' || lead.has_budget === 'sim') probability += 15;
  else if (lead.sqo_budget === 'sim_ajuste' || lead.has_budget === 'viabilizar') probability += 8;
  
  // 4. Score comportamental (20%)
  probability += Math.round(score * 0.2);
  
  // 5. Tempo no estágio (10%) - less time = higher prob
  if (opportunity?.updated_at) {
    const daysInStage = (new Date().getTime() - new Date(opportunity.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysInStage <= 3) probability += 10;
    else if (daysInStage <= 7) probability += 7;
    else if (daysInStage <= 14) probability += 3;
  }
  
  // 6. Stage advancement bonus (15%)
  if (opportunity) {
    const stageBonus: Record<string, number> = {
      'Demonstração': 2,
      'Apresentar proposta': 5,
      'Proposta enviada': 8,
      'Negociação': 10,
      'Contrato enviado': 13,
      'Aguardando pagamento': 15,
    };
    probability += stageBonus[opportunity.stage] || 0;
    
    // Adicional: +1 se reunião agendada em estágio inicial
    if (opportunity.meeting_datetime && opportunity.stage === 'Oportunidade Quente') {
      probability += 1;
    }
  }
  
  // 7. Active objection penalty (-10%)
  if (opportunity?.active_objection) probability -= 10;
  
  // Extra: SQO validation bonuses
  if (lead.sqo_pain_clear) probability += 5;
  if (lead.sqo_icp_fit === 'sim') probability += 3;
  
  return Math.max(0, Math.min(100, probability));
};

/**
 * Get probability color class
 */
export const getProbabilityColor = (probability: number): string => {
  if (probability >= 71) return 'text-green-600 dark:text-green-400';
  if (probability >= 41) return 'text-orange-500 dark:text-orange-400';
  return 'text-destructive';
};

export const getProbabilityBgColor = (probability: number): string => {
  if (probability >= 71) return 'bg-green-500/10 border-green-500/20';
  if (probability >= 41) return 'bg-orange-500/10 border-orange-500/20';
  return 'bg-destructive/10 border-destructive/20';
};

/**
 * Check if deal is stuck
 */
export const isDealStuck = (opportunity: any): { stuck: boolean; reason: string } => {
  if (!opportunity || opportunity.stage === 'Ganho' || opportunity.stage === 'Perdido') {
    return { stuck: false, reason: '' };
  }
  
  const daysSinceUpdate = (new Date().getTime() - new Date(opportunity.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  
  // Proposta enviada > 5 dias sem resposta
  if (opportunity.stage === 'Proposta enviada' && daysSinceUpdate > 5) {
    return { stuck: true, reason: 'Proposta enviada há mais de 5 dias sem resposta' };
  }
  
  // Negociação parada > 7 dias
  if (opportunity.stage === 'Negociação' && daysSinceUpdate > 7) {
    return { stuck: true, reason: 'Negociação parada há mais de 7 dias' };
  }
  
  // Sem próxima ação definida (no next_action_at on lead)
  if (!opportunity.lead_next_action_at) {
    return { stuck: true, reason: 'Sem próxima ação definida' };
  }
  
  // Any stage > 10 days
  if (daysSinceUpdate > 10) {
    return { stuck: true, reason: `Estágio "${opportunity.stage}" sem movimentação há ${Math.round(daysSinceUpdate)} dias` };
  }
  
  return { stuck: false, reason: '' };
};

/**
 * Calculate deal priority score for Closer
 * Weights: Value (40%), Probability (30%), Proximity (20%), Idle (10%)
 */
export const calculateDealPriority = (opportunity: any, lead: Lead): number => {
  const probability = calculateClosingProbability(lead, opportunity);
  const dealValue = Number(opportunity.deal_value) || 0;
  
  // Normalize value (0-100) - assume max deal is 50k
  const valueScore = Math.min(100, (dealValue / 50000) * 100);
  
  // Proximity to close - based on stage
  const stageProximity: Record<string, number> = {
    'Demonstração': 10,
    'Apresentar proposta': 30,
    'Proposta enviada': 50,
    'Negociação': 70,
    'Contrato enviado': 85,
    'Aguardando pagamento': 95,
  };
  const proximityScore = stageProximity[opportunity.stage] || 0;
  
  // Idle penalty
  const daysSinceUpdate = (new Date().getTime() - new Date(opportunity.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  const idleScore = Math.min(100, daysSinceUpdate * 10);
  
  return Math.round(
    valueScore * 0.4 +
    probability * 0.3 +
    proximityScore * 0.2 +
    idleScore * 0.1
  );
};

/**
 * Anti-abandon checks
 */
export const getAbandonmentAlerts = (lead: Lead): { type: 'warning' | 'error'; message: string }[] => {
  const alerts: { type: 'warning' | 'error'; message: string }[] = [];
  const lastDate = lead.last_contact_at || lead.created_at;
  const idleHours = hoursSince(lastDate);
  const nextAction = lead.next_action_at ? new Date(lead.next_action_at) : null;
  const overdueHours = nextAction ? (new Date().getTime() - nextAction.getTime()) / (1000 * 60 * 60) : 0;
  
  // No interaction > 5 days
  if (idleHours > 120 && lead.status !== 'Descartado' && lead.status !== 'Oportunidade criada') {
    alerts.push({ type: 'error', message: 'Lead sem interação há mais de 5 dias' });
  }
  
  // Task overdue > 24h
  if (overdueHours > 24 && lead.status !== 'Descartado' && lead.status !== 'Oportunidade criada') {
    alerts.push({ type: 'error', message: 'Tarefa vencida há mais de 24h — Resolva antes de prosseguir' });
  }
  
  // 3+ days idle warning
  if (idleHours > 72 && idleHours <= 120 && lead.status !== 'Descartado') {
    alerts.push({ type: 'warning', message: 'Lead parado há 3+ dias — Risco de perda' });
  }
  
  return alerts;
};
