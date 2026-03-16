import { Badge } from '@/components/ui/badge';
import { PHASE_LABELS } from '@/types/project';
import { formatDateTimeBR } from '@/utils/dateFormat';
import { ArrowRightLeft, Eye, Clock, PlayCircle, CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Transition {
  id: string;
  phase_name: string;
  status: string;
  entered_at: string;
  exited_at: string | null;
  duration_minutes: number | null;
}

interface ProjectStatusHistoryProps {
  transitions: Transition[];
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `${d}d${rh > 0 ? ` ${rh}h` : ''}`;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  'BACKLOG': <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />,
  'CONCLUÍDO': <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  'EM ANÁLISE': <Eye className="h-3.5 w-3.5 text-warning" />,
  'DESENVOLVIMENTO': <PlayCircle className="h-3.5 w-3.5 text-info" />,
  'QA': <AlertCircle className="h-3.5 w-3.5 text-warning" />,
  'REVISÃO': <Eye className="h-3.5 w-3.5 text-primary" />,
  'REVISÃO INTERNA': <Eye className="h-3.5 w-3.5 text-primary" />,
  'GO-LIVE': <PlayCircle className="h-3.5 w-3.5 text-success" />,
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  'BACKLOG': 'bg-muted/40 text-muted-foreground',
  'EM ANÁLISE': 'bg-chart-5/10 text-chart-5',
  'DESENVOLVIMENTO': 'bg-chart-4/10 text-chart-4',
  'QA': 'bg-chart-5/10 text-chart-5',
  'REVISÃO': 'bg-chart-2/10 text-chart-2',
  'REVISÃO INTERNA': 'bg-chart-2/10 text-chart-2',
  'GO-LIVE': 'bg-chart-3/10 text-chart-3',
  'CONCLUÍDO': 'bg-chart-3/10 text-chart-3',
};

function getStatusIcon(status: string): React.ReactNode {
  return STATUS_ICONS[status] || <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />;
}

export function ProjectStatusHistory({ transitions }: ProjectStatusHistoryProps) {
  if (!transitions.length) {
    return (
      <div className="flex flex-col items-center py-8">
        <Clock className="h-6 w-6 text-muted-foreground/20 mb-2" />
        <p className="text-xs text-muted-foreground/50">Nenhuma transição registrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {transitions.map((t, idx) => {
        const durationStr = formatDuration(t.duration_minutes);
        const badgeColor = STATUS_BADGE_COLORS[t.status] || 'bg-muted/40 text-muted-foreground';

        return (
          <div key={t.id} className="relative pl-7 py-2">
            {/* Vertical line */}
            {idx < transitions.length - 1 && (
              <div className="absolute left-[9px] top-[22px] bottom-0 w-px border-l border-dashed border-border/40" />
            )}

            {/* Icon dot */}
            <div className="absolute left-0 top-[10px] flex items-center justify-center w-5 h-5">
              {getStatusIcon(t.status)}
            </div>

            {/* Content row */}
            <div className="flex items-center gap-2 min-h-[28px]">
              <span className="text-xs font-medium text-foreground">
                {PHASE_LABELS[t.phase_name] || t.phase_name}
              </span>

              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-medium px-2 py-0 h-[18px] rounded-md border-none',
                  badgeColor,
                )}
              >
                {t.status}
              </Badge>

              <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                <span className="text-[11px] text-muted-foreground/70">
                  {formatDateTimeBR(t.entered_at)}
                </span>
                {durationStr && (
                  <span className="text-[10px] text-muted-foreground/50 font-mono bg-muted/30 px-1.5 py-0.5 rounded-md">
                    {durationStr}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
