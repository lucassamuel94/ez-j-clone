/**
 * Cycle-time calculation utilities (pure functions — no DB calls).
 *
 * Terminology
 * -----------
 * lead_time_days  – calendar days from project creation to delivery
 * cycle_time_days – lead_time minus time spent in paused/cancelled states
 * paused_days     – total calendar days the project was paused or cancelled
 */

export interface StatusChange {
  status: string;
  changed_at: string; // ISO timestamp
}

export interface CycleTimeResult {
  lead_time_days: number;
  cycle_time_days: number;
  paused_days: number;
}

export interface CycleTimeGroupEntry {
  label: string;
  lead_time_avg: number;
  cycle_time_avg: number;
  paused_avg: number;
  count: number;
}

export interface CycleTimeOverall {
  lead_time_avg: number;
  cycle_time_avg: number;
  paused_avg: number;
  reopen_rate: number;
}

const INACTIVE_STATUSES = new Set(['em_pausa', 'cancelado']);
const DONE_STATUSES = new Set(['concluido']);

const daysBetween = (a: Date, b: Date): number =>
  Math.max(0, (b.getTime() - a.getTime()) / 86_400_000);

/**
 * Calculate cycle-time metrics for a single project.
 *
 * @param history – status changes sorted by `changed_at` ASC
 */
export function calculateCycleTime(history: StatusChange[]): CycleTimeResult | null {
  if (history.length === 0) return null;

  const sorted = [...history].sort(
    (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
  );

  const start = new Date(sorted[0].changed_at);

  // Find the last "done" status entry
  let endDate: Date | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (DONE_STATUSES.has(sorted[i].status)) {
      endDate = new Date(sorted[i].changed_at);
      break;
    }
  }

  if (!endDate) return null; // project not yet delivered

  const lead_time_days = daysBetween(start, endDate);

  // Sum paused periods
  let paused_days = 0;
  let pauseStart: Date | null = null;

  for (const entry of sorted) {
    const ts = new Date(entry.changed_at);
    if (INACTIVE_STATUSES.has(entry.status)) {
      if (!pauseStart) pauseStart = ts;
    } else if (pauseStart) {
      paused_days += daysBetween(pauseStart, ts);
      pauseStart = null;
    }
  }
  // If still paused at delivery, close the pause at endDate
  if (pauseStart) {
    paused_days += daysBetween(pauseStart, endDate);
  }

  const cycle_time_days = Math.max(0, lead_time_days - paused_days);

  return {
    lead_time_days: Math.round(lead_time_days * 10) / 10,
    cycle_time_days: Math.round(cycle_time_days * 10) / 10,
    paused_days: Math.round(paused_days * 10) / 10,
  };
}

// ── Aggregation helpers ──

interface ProjectMeta {
  id: string;
  project_type: string;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    (map[key] ??= []).push(item);
  }
  return map;
}

export function calculateCycleTimeByType(
  projects: ProjectMeta[],
  historiesByProject: Map<string, StatusChange[]>,
): CycleTimeGroupEntry[] {
  const TYPE_LABELS: Record<string, string> = {
    venda: 'Implantação',
    evolucao: 'Evolução',
    api_oficial: 'API Oficial',
    migracao: 'Migração',
  };

  const grouped = groupBy(projects, (p) => TYPE_LABELS[p.project_type] || p.project_type);

  return Object.entries(grouped).map(([label, group]) => {
    const results = group
      .map((p) => calculateCycleTime(historiesByProject.get(p.id) || []))
      .filter(Boolean) as CycleTimeResult[];

    return {
      label,
      lead_time_avg: average(results.map((r) => r.lead_time_days)),
      cycle_time_avg: average(results.map((r) => r.cycle_time_days)),
      paused_avg: average(results.map((r) => r.paused_days)),
      count: results.length,
    };
  });
}

export function calculateCycleTimeByTeam(
  projects: (ProjectMeta & { teamLabel: string })[],
  historiesByProject: Map<string, StatusChange[]>,
): CycleTimeGroupEntry[] {
  const grouped = groupBy(projects, (p) => p.teamLabel);

  return Object.entries(grouped).map(([label, group]) => {
    const results = group
      .map((p) => calculateCycleTime(historiesByProject.get(p.id) || []))
      .filter(Boolean) as CycleTimeResult[];

    return {
      label,
      lead_time_avg: average(results.map((r) => r.lead_time_days)),
      cycle_time_avg: average(results.map((r) => r.cycle_time_days)),
      paused_avg: average(results.map((r) => r.paused_days)),
      count: results.length,
    };
  });
}

export function calculateOverall(
  historiesByProject: Map<string, StatusChange[]>,
): CycleTimeOverall {
  const results: CycleTimeResult[] = [];
  let reopenCount = 0;

  for (const [, history] of historiesByProject) {
    const r = calculateCycleTime(history);
    if (r) results.push(r);

    // Reopen = project went from a done status back to ativo
    let wasDone = false;
    for (const h of history) {
      if (DONE_STATUSES.has(h.status)) wasDone = true;
      else if (wasDone && h.status === 'ativo') {
        reopenCount++;
        break;
      }
    }
  }

  const total = historiesByProject.size || 1;

  return {
    lead_time_avg: average(results.map((r) => r.lead_time_days)),
    cycle_time_avg: average(results.map((r) => r.cycle_time_days)),
    paused_avg: average(results.map((r) => r.paused_days)),
    reopen_rate: Math.round((reopenCount / total) * 100),
  };
}
