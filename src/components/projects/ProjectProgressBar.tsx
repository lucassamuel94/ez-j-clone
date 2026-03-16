import { Progress } from '@/components/ui/progress';
import { PHASES_BY_TYPE, ProjectType } from '@/types/project';

interface ProjectProgressBarProps {
  phases: Array<{ status: string }>;
  projectType?: string;
}

export function ProjectProgressBar({ phases, projectType }: ProjectProgressBarProps) {
  if (!phases.length) return null;

  // Item 4: Use total phases from PHASES_BY_TYPE as denominator
  const totalPhases = projectType && PHASES_BY_TYPE[projectType as ProjectType]
    ? PHASES_BY_TYPE[projectType as ProjectType].length
    : phases.length;
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
