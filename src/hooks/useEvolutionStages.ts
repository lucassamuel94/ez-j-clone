import { useMemo } from 'react';
import { usePipelineStatuses } from '@/hooks/usePipelineStatuses';
import { EVOLUTION_STAGES } from '@/services/closerService';

/**
 * Centralized hook that provides dynamic Evolution pipeline stages
 * from `pipeline_statuses` table, with fallback to hardcoded defaults.
 */
export function useEvolutionStages() {
  const { allStatuses, isLoading, getStatusesForPipeline, getColorMap } = usePipelineStatuses();

  const stages = useMemo(() => {
    const fromDb = getStatusesForPipeline('evolution' as 'sdr');
    return fromDb.length > 0 ? fromDb : [...EVOLUTION_STAGES];
  }, [allStatuses]); // eslint-disable-line react-hooks/exhaustive-deps

  const colorMap = useMemo(() => getColorMap('evolution' as 'sdr'), [allStatuses]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Stages with "Devolver ao SDR" inserted after "Demonstração" (only if not already in DB) */
  const stagesDisplay = useMemo(() => {
    const fromDb = getStatusesForPipeline('evolution' as 'sdr');
    const base = fromDb.length > 0 ? fromDb : [...EVOLUTION_STAGES];

    const hasDevolver = base.some(s => s.toLowerCase() === 'devolver ao sdr');
    if (hasDevolver) return base;

    const result: string[] = [];
    for (const s of base) {
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

  /** Active stages (excluding Ganho/Perdido) */
  const activeStages = useMemo(
    () => stages.filter(s => s !== 'Ganho' && s !== 'Perdido'),
    [stages],
  );

  /** All stages as a Set for Kanban visibility */
  const allStagesSet = useMemo(() => new Set(stages), [stages]);

  /** Default filter for oportunidades tab (exclude terminal stages) */
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
    allStagesSet,
    defaultOppFilter,
    linearStages,
    isLoading,
  };
}
