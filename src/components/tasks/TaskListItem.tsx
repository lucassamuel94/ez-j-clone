import { memo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock, Trash2, Pencil, AlertTriangle, Building2, FolderKanban, Briefcase, LinkIcon } from 'lucide-react';
import type { MyTask } from '@/hooks/useMyTasks';

const STATUS_COLORS: Record<string, string> = {
  pendente: 'bg-warning/10 text-warning border-warning/20',
  em_andamento: 'bg-primary/10 text-primary border-primary/20',
  concluida: 'bg-success/10 text-success border-success/20',
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
  '30min': '30 min antes',
  '1h': '1h antes',
  '1d': '1 dia antes',
  '2d': '2 dias antes',
};

const CONTEXT_BADGE_STYLES: Record<string, { className: string; icon: typeof FolderKanban }> = {
  project: { className: 'bg-primary/10 text-primary border-primary/20', icon: FolderKanban },
  opportunity: { className: 'bg-warning/10 text-warning border-warning/20', icon: Briefcase },
  lead: { className: 'bg-warning/10 text-warning border-warning/20', icon: Building2 },
  none: { className: 'bg-muted text-muted-foreground border-border', icon: LinkIcon },
};

interface TaskListItemProps {
  task: MyTask;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onToggleStatus: () => void;
  onComplete?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenProject?: () => void;
  isActive?: boolean;
}

export const TaskListItem = memo(function TaskListItem({ task, selected, onSelect, onComplete, onEdit, onDelete, onOpenProject, isActive }: TaskListItemProps) {
  const done = task.status === 'concluida';
  const overdue = !done && task.due_date && new Date(task.due_date) < new Date();

  const contextStyle = CONTEXT_BADGE_STYLES[task.context_type] || CONTEXT_BADGE_STYLES.none;
  const ContextIcon = contextStyle.icon;

  return (
    <Card
      className={cn(
        'group flex items-start gap-3 px-4 py-3 shadow-sm transition-all bg-card border-border min-h-[56px]',
        overdue && 'border-l-4 border-l-destructive',
        selected && 'ring-2 ring-primary border-primary/40',
        isActive && 'ring-2 ring-primary/30 border-primary/40',
        done && 'opacity-60',
      )}
    >
      {/* Selection checkbox */}
      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onCheckedChange={(v) => onSelect(!!v)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5 cursor-pointer" onClick={() => onOpenProject?.()}>
        {/* Context badge */}
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5 font-medium gap-1', contextStyle.className)}>
            <ContextIcon className="h-3 w-3" />
            {task.context_label}
          </Badge>
        </div>

        {/* Title row + status badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-sm font-semibold tracking-tight text-foreground', done && 'line-through')}>
            {task.title}
          </span>
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5 font-medium', STATUS_COLORS[task.status] || '')}>
            {STATUS_LABELS[task.status] || task.status}
          </Badge>
          {overdue && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-destructive/10 text-destructive border-destructive/30 font-medium">
              <AlertTriangle className="h-3 w-3 mr-0.5" />
              Atrasada
            </Badge>
          )}
          {task.priority && task.priority !== 'nenhuma' && task.priority !== 'normal' && (
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5 font-medium', PRIORITY_COLORS[task.priority] || '')}>
              {PRIORITY_LABELS[task.priority] || task.priority}
            </Badge>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-muted-foreground/80 line-clamp-1">{task.description}</p>
        )}

        {/* Footer meta row */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {task.due_date && (
            <span className={cn('flex items-center gap-1', overdue && 'text-destructive')}>
              <CalendarIcon className="h-3 w-3" />
              {format(new Date(task.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          )}
          {task.notify_before && task.notify_before !== 'none' && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {NOTIFY_OPTIONS[task.notify_before] || task.notify_before}
            </span>
          )}
        </div>
      </div>

      {/* Actions — always visible on mobile, hover on desktop */}
      <div className="flex items-center gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        {!done && onComplete && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-success" onClick={onComplete} title="Concluir tarefa">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
});
