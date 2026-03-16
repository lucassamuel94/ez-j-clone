import { useState, useCallback } from 'react';
import { useProjectTasks, useUpdateProjectTask, useDeleteProjectTask } from '@/hooks/useProjectTasks';
import { ProjectTaskDialog } from '@/components/projects/ProjectTaskDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, CalendarIcon, Clock, Trash2, CheckCircle2, Circle, AlertTriangle, Loader2, Pencil } from 'lucide-react';
import { createActivityLog } from '@/services/activityLogService';
import { toast } from 'sonner';

interface ProjectTasksSectionProps {
  projectId: string;
  canEdit: boolean;
  leadId?: string | null;
  opportunityId?: string | null;
}

const NOTIFY_OPTIONS = [
  { value: 'none', label: 'Sem notificação' },
  { value: '30min', label: '30 minutos antes' },
  { value: '1h', label: '1 hora antes' },
  { value: '1d', label: '1 dia antes' },
  { value: '2d', label: '2 dias antes' },
];

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

export function ProjectTasksSection({ projectId, canEdit, leadId, opportunityId }: ProjectTasksSectionProps) {
  const { data: tasks, isLoading } = useProjectTasks(projectId);
  const updateTask = useUpdateProjectTask();
  const deleteTask = useDeleteProjectTask();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);

  const handleOpenCreate = () => {
    setEditingTask(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (task: any) => {
    setEditingTask({
      id: task.id,
      title: task.title,
      description: task.description,
      due_date: task.due_date,
      notify_before: task.notify_before,
      priority: task.priority,
      assigned_user_id: task.assigned_user_id,
      status: task.status,
    });
    setDialogOpen(true);
  };

  const toggleStatus = (task: any) => {
    const newStatus = task.status === 'concluida' ? 'pendente' : 'concluida';
    updateTask.mutate({
      taskId: task.id,
      projectId,
      updates: {
        status: newStatus,
        completed_at: newStatus === 'concluida' ? new Date().toISOString() : null,
      },
    });
  };

  const handleComplete = useCallback((task: any) => {
    updateTask.mutate({
      taskId: task.id,
      projectId,
      updates: {
        status: 'concluida',
        completed_at: new Date().toISOString(),
      },
    });
    const resolvedLeadId = task.lead_id || leadId;
    if (resolvedLeadId) {
      createActivityLog({
        lead_id: resolvedLeadId,
        action_type: 'interaction_registered',
        field_name: 'task_completed',
        old_value: task.status,
        new_value: 'concluida',
        description: `Concluiu a tarefa "${task.title}"`,
      }).catch((err) => console.error('Failed to log task completion:', err));
    }
    toast.success('Tarefa concluída');
  }, [updateTask, projectId, leadId]);

  const isOverdue = (task: any) => {
    if (task.status === 'concluida' || !task.due_date) return false;
    return new Date(task.due_date) < new Date();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Atividades / Tarefas</h3>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={handleOpenCreate}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Nova Tarefa
          </Button>
        )}
      </div>

      {(!tasks || tasks.length === 0) ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma tarefa cadastrada.</p>
      ) : (
        <div className="space-y-1.5">
          {tasks.map((task) => {
            const overdue = isOverdue(task);
            const done = task.status === 'concluida';

            return (
              <div
                key={task.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                  overdue && 'border-destructive/30 bg-destructive/5',
                  done && 'bg-muted/20 border-border/50',
                  !overdue && !done && 'bg-card border-border/50',
                )}
              >
                {canEdit ? (
                  <Checkbox
                    checked={done}
                    onCheckedChange={() => toggleStatus(task)}
                    className="mt-0.5"
                  />
                ) : (
                  done ? <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium uppercase">
                      {task.title}
                    </span>
                    {overdue && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-destructive/10 text-destructive border-destructive/20">
                        <AlertTriangle className="h-3 w-3 mr-0.5" />
                        Atrasada
                      </Badge>
                    )}
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5', STATUS_COLORS[task.status] || '')}>
                      {STATUS_LABELS[task.status] || task.status}
                    </Badge>
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                  )}
                  <div className={cn("flex items-center gap-3 mt-1 text-[10px] text-muted-foreground", done && "text-success")}>
                    {task.due_date && (
                      <span className="flex items-center gap-0.5">
                        <CalendarIcon className="h-3 w-3" />
                        {format(new Date(task.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    )}
                    {task.notify_before && task.notify_before !== 'none' && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {NOTIFY_OPTIONS.find((o) => o.value === task.notify_before)?.label}
                      </span>
                    )}
                    {task.assigned_user_name && (
                      <span>→ {task.assigned_user_name}</span>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {!done && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-success"
                        onClick={() => handleComplete(task)}
                        title="Concluir tarefa"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => handleOpenEdit(task)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteTask.mutate({ taskId: task.id, projectId })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ProjectTaskDialog
        projectId={projectId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editTask={editingTask}
      />
    </div>
  );
}
