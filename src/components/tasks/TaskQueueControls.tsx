import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle2, SkipForward, SkipBack, X } from 'lucide-react';
import type { MyTask } from '@/hooks/useMyTasks';

interface TaskQueueControlsProps {
  queue: MyTask[];
  currentIndex: number;
  onComplete: () => void;
  onSkip: () => void;
  onBack: () => void;
  onClose: () => void;
}

export function TaskQueueControls({ queue, currentIndex, onComplete, onSkip, onBack, onClose }: TaskQueueControlsProps) {
  if (queue.length === 0) return null;
  const current = queue[currentIndex];
  if (!current) return null;

  const progress = (currentIndex / queue.length) * 100;
  const isLast = currentIndex + 1 >= queue.length;

  return (
    <div className="flex-shrink-0 bg-primary/5 dark:bg-primary/10 border-b border-primary/20">
      {/* Progress bar */}
      <div className="h-1">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls */}
      <div className="px-5 sm:px-6 py-2.5 flex items-center gap-4">
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold text-xs shrink-0">
          {currentIndex + 1} de {queue.length}
        </Badge>

        <span className="text-sm font-semibold text-foreground uppercase truncate flex-1">
          {current.title}
        </span>

        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={onBack} disabled={currentIndex === 0} className="gap-1.5 text-xs">
            <SkipBack className="h-3.5 w-3.5" />
            Anterior
          </Button>
          {!isLast && (
            <Button size="sm" variant="outline" onClick={onSkip} className="gap-1.5 text-xs">
              <SkipForward className="h-3.5 w-3.5" />
              Próximo
            </Button>
          )}
          <Button
            size="sm"
            onClick={onComplete}
            className={cn("gap-1.5 text-xs", isLast && "bg-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.9)] text-[hsl(var(--success-foreground))]")}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isLast ? 'Concluir' : 'Concluir e Próximo'}
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose} className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
