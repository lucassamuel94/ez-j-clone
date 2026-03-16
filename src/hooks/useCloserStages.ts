import { useMemo } from 'react';
import { usePipelineStatuses } from '@/hooks/usePipelineStatuses';
import { CLOSER_STAGES, CLOSER_STAGES_DISPLAY } from '@/services/closerService';

/**
 * Centralized hook that provides dynamic Closer pipeline stages
 * from `pipeline_statuses` table, with fallback to hardcoded defaults.
 */
export function useCloserStages() {
  const { allStatuses, isLoading, getStatusesForPipeline, getColorMap } = usePipelineStatuses();

  const stages = useMemo(() => {
    const fromDb = getStatusesForPipeline('closer');
    return fromDb.length > 0 ? fromDb : [...CLOSER_STAGES];
  }, [allStatuses]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Stages with "Devolver ao SDR" inserted after "Demonstração" (only if not already in DB) */
  const stagesDisplay = useMemo(() => {
    const fromDb = getStatusesForPipeline('closer');
    if (fromDb.length === 0) return [...CLOSER_STAGES_DISPLAY];

    // Check if "Devolver ao SDR" already exists (case-insensitive)
    const hasDevolver = fromDb.some(s => s.toLowerCase() === 'devolver ao sdr');
    if (hasDevolver) return fromDb;

    const result: string[] = [];
    for (const s of fromDb) {
      result.push(s);
      if (s.toLowerCase() === 'demonstração') {
        result.push('Devolver ao SDR');
      }
    }
    if (!result.some(s => s.toLowerCase() === 'devolver ao sdr') && result.length > 0) {
      result.splice(1, 0, 'Devolver ao SDR');
    }
    return result;
  }, [allStatuses]); // eslint-disable-line react-hooks/exhaustive-deps

  const colorMap = useMemo(() => getColorMap('closer'), [allStatuses]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Active stages (excluding Ganho/Perdido) */
  const activeStages = useMemo(
    () => stages.filter(s => s !== 'Ganho' && s !== 'Perdido'),
    [stages],
  );

  /** Default visible stages for oportunidades tab (exclude Ganho, Perdido — they have dedicated tabs) */
  const defaultOppFilter = useMemo(
    () => new Set(stages.filter(s => s !== 'Ganho' && s !== 'Perdido')),
    [stages],
  );

  /** Linear progression stages for past/check logic in steppers */
  const linearStages = useMemo(() => {
    const nonLinear = new Set(['oportunidade futura', 'oportunidade fria', 'perdido', 'devolver ao sdr']);
    return stages.filter(s => !nonLinear.has(s.toLowerCase()));
  }, [stages]);

  return {
    stages,
    stagesDisplay,
    colorMap,
    activeStages,
    defaultOppFilter,
    linearStages,
    isLoading,
  };
}
