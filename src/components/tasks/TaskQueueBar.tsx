import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { X, CheckCircle2, SkipForward, CalendarIcon, FolderKanban, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { MyTask } from '@/hooks/useMyTasks';

interface TaskQueueBarProps {
  queue: MyTask[];
  currentIndex: number;
  onComplete: () => void;
  onSkip: () => void;
  onClose: () => void;
  onOpenProject?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  pendente: 'bg-chart-5/10 text-chart-5 border-chart-5/20',
  em_andamento: 'bg-primary/10 text-primary border-primary/20',
  concluida: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
};

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgente: 'bg-destructive/10 text-destructive border-destructive/20',
  alta: 'bg-destructive/10 text-destructive border-destructive/20',
  normal: 'bg-muted text-muted-foreground border-border',
  baixa: 'bg-muted text-muted-foreground border-border',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgente: 'Urgente',
  alta: 'Alta',
  normal: 'Normal',
  baixa: 'Baixa',
};

const NOTIFY_OPTIONS: Record<string, string> = {
  '5min': '5 min antes',
  '15min': '15 min antes',
  '30min': '30 min antes',
  '1h': '1h antes',
  '1d': '1 dia antes',
  '2d': '2 dias antes',
};

export function TaskQueueBar({ queue, currentIndex, onComplete, onSkip, onClose, onOpenProject }: TaskQueueBarProps) {
  if (queue.length === 0) return null;

  const current = queue[currentIndex];
  if (!current) return null;

  const progress = ((currentIndex) / queue.length) * 100;
  const overdue = current.due_date && new Date(current.due_date) < new Date() && current.status !== 'concluida';

  return (
    <div className="sticky top-0 z-20 bg-primary/5 dark:bg-primary/10 border-b border-primary/20 backdrop-blur-sm">
      {/* Progress bar */}
      <div className="h-1">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Control bar */}
      <div className="px-6 py-2.5 flex items-center gap-4">
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold text-xs shrink-0">
          {currentIndex + 1} de {queue.length}
        </Badge>

        <span className="text-sm font-semibold text-foreground uppercase truncate flex-1">
          {current.title}
        </span>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenProject && (
            <Button size="sm" variant="outline" onClick={onOpenProject} className="gap-1.5 text-xs">
              <FolderKanban className="h-3.5 w-3.5" />
              Ver Projeto
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onSkip} className="gap-1.5 text-xs">
            <SkipForward className="h-3.5 w-3.5" />
            Pular
          </Button>
          <Button size="sm" onClick={onComplete} className="gap-1.5 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Concluir e Próximo
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose} className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded task card */}
      <div className="px-6 pb-4">
        <Card className={cn(
          'p-4 space-y-3 shadow-sm',
          overdue && 'border-destructive/40 bg-destructive/5',
        )}>
          {/* Title + badges */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold uppercase tracking-tight text-foreground">
                  {current.title}
                </h3>
                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5 font-medium', STATUS_COLORS[current.status] || '')}>
                  {STATUS_LABELS[current.status] || current.status}
                </Badge>
                {overdue && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-destructive/10 text-destructive border-destructive/30 font-medium">
                    <AlertTriangle className="h-3 w-3 mr-0.5" />
                    Atrasada
                  </Badge>
                )}
                {current.priority && current.priority !== 'nenhuma' && current.priority !== 'normal' && (
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5 font-medium', PRIORITY_COLORS[current.priority] || '')}>
                    {PRIORITY_LABELS[current.priority] || current.priority}
                  </Badge>
                )}
              </div>

              {current.description && (
                <p className="text-sm text-muted-foreground">{current.description}</p>
              )}
            </div>
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border/40 pt-3">
            <span className="flex items-center gap-1.5">
              <FolderKanban className="h-3.5 w-3.5" />
              {current.project_company_name}
            </span>
            {current.due_date && (
              <span className={cn('flex items-center gap-1.5', overdue && 'text-destructive font-medium')}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {format(new Date(current.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
            {current.notify_before && current.notify_before !== 'none' && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {NOTIFY_OPTIONS[current.notify_before] || current.notify_before}
              </span>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
