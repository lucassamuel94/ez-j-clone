import { Lead } from '@/types/lead';

/**
 * Auto-calculate qualification score based on 5 criteria (0-100)
 * +20 if daily volume >= 50
 * +20 if pain point defined
 * +20 if urgency <= 3 months
 * +20 if budget = Sim or Pode viabilizar
 * +20 if phone + email are valid
 */
export const calculateQualificationScore = (lead: Lead): number => {
  let score = 0;

  // +20 if daily volume >= 50
  const volume = lead.daily_service_volume || '';
  if (volume === '51 a 100' || volume === '100 a 200' || volume === 'Acima de 200') {
    score += 20;
  }

  // +20 if pain point defined (not empty)
  if (lead.main_pain_point) {
    score += 20;
  }

  // +20 if urgency <= 3 months
  if (lead.solution_urgency === 'Até 3 meses') {
    score += 20;
  }

  // +20 if budget = Sim or Pode viabilizar
  if (lead.has_budget === 'sim' || lead.has_budget === 'viabilizar') {
    score += 20;
  }

  // +20 if phone + email are valid (non-empty)
  if (lead.phone && lead.phone.trim().length > 0 && lead.email && lead.email.trim().length > 0) {
    score += 20;
  }

  return score;
};

/**
 * Map score to temperature label
 * 0-39 → frio (Baixo)
 * 40-69 → morno (Médio)
 * 70-100 → quente (Alto)
 */
export const scoreToTemperature = (score: number): 'frio' | 'morno' | 'quente' => {
  if (score >= 70) return 'quente';
  if (score >= 40) return 'morno';
  return 'frio';
};

export const getTemperatureFromLead = (lead: Lead): 'frio' | 'morno' | 'quente' => {
  return scoreToTemperature(calculateQualificationScore(lead));
};

/**
 * Check if CNPJ + contact data are sufficient to unlock qualification
 */
export const isCompanyDataSufficientForQualification = (lead: Lead): boolean => {
  return Boolean(
    lead.cnpj && lead.cnpj.replace(/\D/g, '').length === 14 &&
    lead.razao_social
  );
};

/**
 * Check if lead can advance to meeting (Reunião Agendada)
 * Blocks if: budget = Não OR urgency = Acima de 6 meses
 */
export const canAdvanceToMeeting = (lead: Lead): { allowed: boolean; reason?: string } => {
  // 1. Behavioral score not yet calculated — fallback to on-the-fly qualification
  if (lead.behavioral_score === null || lead.behavioral_score === undefined) {
    const fallbackScore = calculateQualificationScore(lead);
    if (fallbackScore === 0) {
      return { allowed: false, reason: 'Qualificação incompleta — preencha volume, dor, urgência, orçamento e contatos.' };
    }
    // Score > 0: permite avanço mesmo sem batch ter rodado
  } else if (lead.behavioral_score === 0) {
    // 2. Behavioral score calculated but zero
    return { allowed: false, reason: 'Score comportamental é 0 — lead não atende critérios mínimos para avançar.' };
  }
  // 3. Qualification score zero (no criteria filled)
  const qualScore = calculateQualificationScore(lead);
  if (qualScore === 0) {
    return { allowed: false, reason: 'Qualificação incompleta — preencha volume, dor, urgência, orçamento e contatos.' };
  }
  // 4. Existing business rules
  if (lead.has_budget === 'nao') {
    return { allowed: false, reason: 'Lead com orçamento "Não" não pode avançar para Reunião Agendada.' };
  }
  if (lead.solution_urgency === 'Acima de 6 meses') {
    return { allowed: false, reason: 'Lead com urgência "Acima de 6 meses" não pode avançar para Reunião Agendada.' };
  }
  return { allowed: true };
};

/**
 * Get qualification alerts based on current data
 */
export const getQualificationAlerts = (lead: Lead): string[] => {
  const alerts: string[] = [];
  
  if (lead.daily_service_volume === '10 a 50') {
    // Volume is low but in range - no alert needed for 10-50
  }
  
  if (lead.solution_urgency === 'Acima de 6 meses') {
    alerts.push('⚠️ Urgência acima de 6 meses — Lead com score baixo');
  }
  
  if (lead.has_budget === 'nao') {
    alerts.push('🚫 Sem orçamento — Não pode avançar para SQO');
  }

  return alerts;
};
