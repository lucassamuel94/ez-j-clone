export interface CoachingAnnotation {
  segment_index: number;
  quote: string;
  suggestion: string;
  rationale: string;
  category: string;
  impact: 'high' | 'medium' | 'low';
}

export interface KeyMoment {
  segment_index: number;
  type: 'positive' | 'negative' | 'turning_point';
  title: string;
  description: string;
  impact_on_outcome: string;
}

export interface MissedOpportunity {
  segment_index: number;
  opportunity: string;
  what_to_do: string;
  technique: string;
}

export interface TechniqueSuggestion {
  technique_name: string;
  description: string;
  application: string;
  relevant_segments: number[];
}

export interface RolePlayScenario {
  scenario_title: string;
  context: string;
  client_persona: string;
  objective: string;
  opening_line: string;
  success_criteria: string[];
}

export interface CoachingData {
  annotations: CoachingAnnotation[];
  keyMoments: KeyMoment[];
  missedOpportunities: MissedOpportunity[];
  coachMessage: string | null;
  techniques: TechniqueSuggestion[];
  rolePlay: RolePlayScenario | null;
}

export const CATEGORY_COLORS: Record<string, { border: string; bg: string; text: string; label: string }> = {
  rapport: { border: 'border-l-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', label: 'Rapport' },
  discovery: { border: 'border-l-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-400', label: 'Discovery' },
  objection_handling: { border: 'border-l-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', label: 'Objeções' },
  closing: { border: 'border-l-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', label: 'Fechamento' },
  value_proposition: { border: 'border-l-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-500/10', text: 'text-cyan-700 dark:text-cyan-400', label: 'Proposta de Valor' },
  urgency: { border: 'border-l-red-500', bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-700 dark:text-red-400', label: 'Urgência' },
  social_proof: { border: 'border-l-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-400', label: 'Prova Social' },
  follow_up: { border: 'border-l-teal-500', bg: 'bg-teal-50 dark:bg-teal-500/10', text: 'text-teal-700 dark:text-teal-400', label: 'Follow-up' },
  // SDR-specific categories
  qualification: { border: 'border-l-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-700 dark:text-violet-400', label: 'Qualificação' },
  opening: { border: 'border-l-sky-500', bg: 'bg-sky-50 dark:bg-sky-500/10', text: 'text-sky-700 dark:text-sky-400', label: 'Abertura' },
  pain_discovery: { border: 'border-l-fuchsia-500', bg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10', text: 'text-fuchsia-700 dark:text-fuchsia-400', label: 'Dor / Problema' },
  scheduling: { border: 'border-l-lime-500', bg: 'bg-lime-50 dark:bg-lime-500/10', text: 'text-lime-700 dark:text-lime-400', label: 'Agendamento' },
  gatekeeping: { border: 'border-l-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-700 dark:text-orange-400', label: 'Gatekeeper' },
};

export const IMPACT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-red-100 dark:bg-red-500/15', text: 'text-red-700 dark:text-red-400', label: 'Alto impacto' },
  medium: { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400', label: 'Médio impacto' },
  low: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Baixo impacto' },
};
