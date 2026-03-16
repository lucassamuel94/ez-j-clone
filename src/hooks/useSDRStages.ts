import { useMemo } from 'react';
import { usePipelineStatuses } from '@/hooks/usePipelineStatuses';
import type { LeadStatus } from '@/types/lead';

// ── Hardcoded fallbacks (used when DB has no SDR statuses) ──

const SDR_KANBAN_FALLBACK: LeadStatus[] = [
  'Novo', 'Em contato', 'Lead Quente', 'Reunião Agendada',
  'Reunião Confirmada', 'Oportunidade Futura', 'Reciclagem',
  'Ocupado', 'Agendar Retorno', 'Sem retorno',
  'Oportunidade criada', 'Descartado',
];

interface FunnelStep {
  key: string;
  label: string;
}

const FUNNEL_FALLBACK: FunnelStep[] = [
  { key: 'novo', label: 'Novo' },
  { key: 'em_contato', label: 'Em contato' },
  { key: 'lead_quente', label: 'Lead quente' },
  { key: 'reuniao', label: 'Reunião agendada' },
  { key: 'sqo', label: 'Reunião Confirmada' },
  { key: 'oportunidade_futura', label: 'Oportunidade futura' },
  { key: 'reciclagem', label: 'Reciclagem' },
  { key: 'perdido', label: 'Perdido' },
];

const STATUS_TO_STEP_FALLBACK: Record<string, string> = {
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

const LINEAR_STEPS_FALLBACK = ['novo', 'em_contato', 'lead_quente', 'reuniao', 'sqo'];

const STEP_SHORT_FALLBACK: Record<string, string> = {
  novo: 'Novo',
  em_contato: 'Em contato',
  lead_quente: 'Lead quente',
  reuniao: 'Reunião',
  sqo: 'Confirmada',
  oportunidade_futura: 'Op. Futura',
  reciclagem: 'Reciclagem',
  perdido: 'Perdido',
};

// ── Slug helper ──

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// ── Grouping rules: status_name → funnel step key ──
// When DB has custom statuses, we try to match them to macro steps
// by checking known keywords. If no match, we create a new step from the status itself.

const KEYWORD_TO_STEP: [RegExp, string, string][] = [
  [/^novo$|devolvido/i, 'novo', 'Novo'],
  [/em contato|ocupado|agendar retorno|sem retorno|reagendar|não atendeu/i, 'em_contato', 'Em contato'],
  [/interesse(?!.*retorno)/i, 'lead_quente', 'Lead quente'],
  [/reuni[aã]o agendada/i, 'reuniao', 'Reunião agendada'],
  [/oportunidade criada|confirmad/i, 'sqo', 'Reunião Confirmada'],
  [/oportunidade futura|interesse.*retorno/i, 'oportunidade_futura', 'Oportunidade futura'],
  [/reciclagem/i, 'reciclagem', 'Reciclagem'],
  [/descartado|perdido/i, 'perdido', 'Perdido'],
];

function matchStep(statusName: string): { key: string; label: string } | null {
  for (const [re, key, label] of KEYWORD_TO_STEP) {
    if (re.test(statusName)) return { key, label };
  }
  return null;
}

// ── NON-LINEAR steps: these don't count as "past" in progression ──
const NON_LINEAR_KEYS = new Set(['oportunidade_futura', 'reciclagem', 'perdido']);

/**
 * Centralized hook that provides dynamic SDR pipeline stages
 * from `pipeline_statuses` table, with fallback to hardcoded defaults.
 */
export function useSDRStages() {
  const { allStatuses, isLoading, getStatusesForPipeline, getColorMap } = usePipelineStatuses();

  /** All kanban statuses (column names) in order */
  const kanbanStatuses = useMemo((): LeadStatus[] => {
    const fromDb = getStatusesForPipeline('sdr');
    return (fromDb.length > 0 ? fromDb : [...SDR_KANBAN_FALLBACK]) as LeadStatus[];
  }, [allStatuses]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Terminal statuses (should not show actions / "overdue") */
  const terminalStatuses = useMemo((): Set<string> => {
    const lc = new Set(['descartado', 'oportunidade criada', 'perdido', 'ganho']);
    return new Set(kanbanStatuses.filter(s => lc.has(s.toLowerCase())));
  }, [kanbanStatuses]);

  /** Color map from pipeline_statuses */
  const colorMap = useMemo(() => getColorMap('sdr'), [allStatuses]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Funnel steps derived from DB statuses (grouped into macro steps) */
  const funnelSteps = useMemo((): FunnelStep[] => {
    const fromDb = getStatusesForPipeline('sdr');
    if (fromDb.length === 0) return [...FUNNEL_FALLBACK];

    const seen = new Set<string>();
    const steps: FunnelStep[] = [];
    for (const statusName of fromDb) {
      const match = matchStep(statusName);
      const key = match ? match.key : slugify(statusName);
      const label = match ? match.label : statusName;
      if (!seen.has(key)) {
        seen.add(key);
        steps.push({ key, label });
      }
    }
    return steps;
  }, [allStatuses]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Map: lead status → funnel step key */
  const statusToStep = useMemo((): Record<string, string> => {
    const fromDb = getStatusesForPipeline('sdr');
    if (fromDb.length === 0) return { ...STATUS_TO_STEP_FALLBACK };

    const map: Record<string, string> = {};
    for (const statusName of fromDb) {
      const match = matchStep(statusName);
      map[statusName] = match ? match.key : slugify(statusName);
    }
    return map;
  }, [allStatuses]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Linear steps (for "past" progression logic) */
  const linearSteps = useMemo((): string[] => {
    const fromDb = getStatusesForPipeline('sdr');
    if (fromDb.length === 0) return [...LINEAR_STEPS_FALLBACK];

    const seen = new Set<string>();
    const result: string[] = [];
    for (const statusName of fromDb) {
      const match = matchStep(statusName);
      const key = match ? match.key : slugify(statusName);
      if (!NON_LINEAR_KEYS.has(key) && !seen.has(key)) {
        seen.add(key);
        result.push(key);
      }
    }
    return result;
  }, [allStatuses]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Short display labels for step keys */
  const stepShortLabels = useMemo((): Record<string, string> => {
    const fromDb = getStatusesForPipeline('sdr');
    if (fromDb.length === 0) return { ...STEP_SHORT_FALLBACK };

    const map: Record<string, string> = {};
    for (const step of funnelSteps) {
      // Use first 12 chars as short label
      map[step.key] = step.label.length > 14 ? step.label.slice(0, 12).trim() + '…' : step.label;
    }
    // Override known short labels
    for (const [k, v] of Object.entries(STEP_SHORT_FALLBACK)) {
      if (map[k] !== undefined) map[k] = v;
    }
    return map;
  }, [funnelSteps, allStatuses]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Default visible kanban statuses (exclude terminal) */
  const defaultVisibleStatuses = useMemo((): Set<string> => {
    return new Set(kanbanStatuses.filter(s => !terminalStatuses.has(s)));
  }, [kanbanStatuses, terminalStatuses]);

  return {
    kanbanStatuses,
    terminalStatuses,
    colorMap,
    funnelSteps,
    statusToStep,
    linearSteps,
    stepShortLabels,
    defaultVisibleStatuses,
    isLoading,
  };
}
