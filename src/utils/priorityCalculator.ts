import { Lead, LeadType, FilterType } from '@/types/lead';
import { calculateBehavioralScore } from './behavioralScore';

// Calculate hours between two dates
const hoursBetween = (date1: Date, date2: Date): number => {
  return Math.abs(date2.getTime() - date1.getTime()) / (1000 * 60 * 60);
};

// Check if a lead is overdue
export const isLeadOverdue = (lead: Lead): boolean => {
  if (!lead.next_action_at) return false;
  return new Date(lead.next_action_at) < new Date();
};

// Calculate hours overdue (negative if not overdue)
export const getHoursOverdue = (lead: Lead): number => {
  if (!lead.next_action_at) return 0;
  const now = new Date();
  const nextAction = new Date(lead.next_action_at);
  return hoursBetween(now, nextAction) * (nextAction < now ? 1 : -1);
};

// Check if action is due today
export const isDueToday = (lead: Lead): boolean => {
  if (!lead.next_action_at) return false;
  const now = new Date();
  const nextAction = new Date(lead.next_action_at);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  return nextAction >= now && nextAction <= endOfToday;
};

// Calculate SLA for INBOUND leads (time until first contact)
// Once first contact is made (last_contact_at set), SLA is met.
export const getInboundSLA = (lead: Lead): { hours: number; status: 'ok' | 'warning' | 'critical' } => {
  if (lead.lead_type !== 'INBOUND') {
    return { hours: 0, status: 'ok' };
  }

  // First contact already made — SLA met
  if (lead.last_contact_at) {
    return { hours: 0, status: 'ok' };
  }

  const hours = hoursBetween(new Date(lead.created_at), new Date());

  // SLA thresholds
  if (hours > 4) return { hours, status: 'critical' };
  if (hours > 2) return { hours, status: 'warning' };
  return { hours, status: 'ok' };
};

// Calculate priority score for sorting (uses behavioral score as primary driver)
export const calculatePriorityScore = (lead: Lead): number => {
  // Use persisted behavioral_score if available, otherwise calculate
  const behavioralScore = lead.behavioral_score ?? calculateBehavioralScore(lead).total;
  
  let score = behavioralScore * 10; // Scale 0-1000
  
  // Descartados always go to the bottom
  if (lead.status === 'Descartado') return -1000;
  if (lead.status === 'Oportunidade criada') return -500;
  
  // Hot lead boost
  if (lead.is_hot_lead) score += 500;
  
  // Overdue boost
  if (isLeadOverdue(lead)) {
    const hoursOverdue = getHoursOverdue(lead);
    score += 200 + (hoursOverdue * 5);
  }
  
  // INBOUND SLA
  if (lead.lead_type === 'INBOUND') {
    const sla = getInboundSLA(lead);
    if (sla.status === 'critical') score += 300;
    else if (sla.status === 'warning') score += 150;
  }
  
  // Due today
  if (isDueToday(lead)) score += 100;
  
  return score;
};

// Sort leads by priority
export const sortLeadsByPriority = (leads: Lead[]): Lead[] => {
  return [...leads].sort((a, b) => {
    const scoreA = calculatePriorityScore(a);
    const scoreB = calculatePriorityScore(b);
    return scoreB - scoreA; // Higher score first
  });
};

// Filter leads by type
export const filterLeads = (leads: Lead[], filter: FilterType): Lead[] => {
  switch (filter) {
    case 'today':
      return leads.filter(lead => 
        (isDueToday(lead) || isLeadOverdue(lead)) && lead.status !== 'Descartado'
      );
    case 'in_contact_return':
      return leads.filter(lead => lead.status === 'Em contato');
    case 'overdue':
      return leads.filter(lead => isLeadOverdue(lead) && lead.status !== 'Descartado');
    case 'new':
      return leads.filter(lead => lead.status === 'Novo');
    case 'devolvido_closer':
      return leads.filter(lead => lead.status === 'Devolvido pelo Closer');
    case 'ocupado':
      return leads.filter(lead => lead.status === 'Ocupado');
    case 'nao_atendeu':
      return leads.filter(lead => lead.status === 'Em contato');
    case 'sem_retorno':
      return leads.filter(lead => lead.status === 'Sem retorno');
    case 'agendar_retorno':
      return leads.filter(lead => lead.status === 'Agendar retorno');
    case 'scheduled':
      return leads.filter(lead => lead.status === 'Reunião agendada');
    case 'confirmed':
      return leads.filter(lead => lead.status === 'Oportunidade criada');
    case 'future_opportunity':
      return leads.filter(lead => lead.status === 'Reciclagem' || lead.status === 'Interesse/Agendar Retorno');
    case 'discarded':
      return leads.filter(lead => lead.status === 'Descartado');
    case 'all':
    default:
      return leads.filter(lead => lead.status !== 'Descartado');
  }
};

// Get queue statistics
export const getQueueStats = (leads: Lead[]) => {
  const activeLeads = leads.filter(l => l.status !== 'Descartado');
  const discardedLeads = leads.filter(l => l.status === 'Descartado');
  
  return {
    total: activeLeads.length,
    overdue: activeLeads.filter(isLeadOverdue).length,
    today: activeLeads.filter(lead => isDueToday(lead) && !isLeadOverdue(lead)).length,
    inContactReturn: leads.filter(l => l.status === 'Em contato').length,
    new: activeLeads.filter(l => l.status === 'Novo').length,
    devolvidoCloser: leads.filter(l => l.status === 'Devolvido pelo Closer').length,
    ocupado: leads.filter(l => l.status === 'Ocupado').length,
    naoAtendeu: 0,
    semRetorno: leads.filter(l => l.status === 'Sem retorno').length,
    agendarRetorno: leads.filter(l => l.status === 'Agendar retorno').length,
    scheduled: leads.filter(l => l.status === 'Reunião agendada').length,
    confirmed: leads.filter(l => l.status === 'Oportunidade criada').length,
    futureOpportunity: leads.filter(l => l.status === 'Reciclagem' || l.status === 'Interesse/Agendar Retorno').length,
    discarded: discardedLeads.length,
  };
};

// Format time ago string
export const formatTimeAgo = (date: Date): string => {
  const hours = hoursBetween(date, new Date());
  
  if (hours < 1) return 'Agora há pouco';
  if (hours < 24) return `${Math.round(hours)}h atrás`;
  if (hours < 48) return 'Ontem';
  return `${Math.round(hours / 24)}d atrás`;
};

// Format next action time
export const formatNextAction = (date: Date, status?: string): string => {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const hours = diff / (1000 * 60 * 60);
  
  // For scheduled returns, show specific date/time
  if (status === 'Interesse/Agendar Retorno' || status === 'Agendar retorno' || status === 'Ocupado') {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
  }
  
  if (hours < 0) {
    const overdue = Math.abs(hours);
    if (overdue < 1) return 'Atrasado (< 1h)';
    if (overdue < 24) return `Atrasado (${Math.round(overdue)}h)`;
    return `Atrasado (${Math.round(overdue / 24)}d)`;
  }
  
  if (hours < 1) return 'Em breve';
  if (hours < 24) return `Em ${Math.round(hours)}h`;
  return `Em ${Math.round(hours / 24)}d`;
};
