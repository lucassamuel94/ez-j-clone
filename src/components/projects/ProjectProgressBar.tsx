import { Progress } from '@/components/ui/progress';
import { PHASES_BY_TYPE, ProjectType } from '@/types/project';

interface ProjectProgressBarProps {
  phases: Array<{ status: string }>;
  projectType?: string;
}

export function ProjectProgressBar({ phases, projectType }: ProjectProgressBarProps) {
  if (!phases.length) return null;

  // Use actual project phases count as denominator (accounts for conditional phases like curadoria_ia)
  // Fallback to PHASES_BY_TYPE template only when no real phases data
  const totalPhases = phases.length > 0
    ? phases.length
    : (projectType && PHASES_BY_TYPE[projectType as ProjectType]
        ? PHASES_BY_TYPE[projectType as ProjectType].length
        : 1);
  const completedCount = phases.filter((p) => p.status === 'CONCLUÍDO').length;
  const percent = Math.round((completedCount / totalPhases) * 100);
  return (
    <div className="px-5 sm:px-7 py-2.5">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Progress value={percent} className="h-[6px] rounded-full" />
        </div>
        <span className="text-[11px] font-bold text-primary tabular-nums">{percent}%</span>
      </div>
    </div>
  );
}
