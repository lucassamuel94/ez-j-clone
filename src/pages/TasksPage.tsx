import { useState, useMemo, useCallback, useReducer, useEffect, useRef, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { Checkbox } from '@/components/ui/checkbox';
import { TaskQueueControls } from '@/components/tasks/TaskQueueControls';
import { TaskListItem } from '@/components/tasks/TaskListItem';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { useMyTasks, type MyTask } from '@/hooks/useMyTasks';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProjectModal } from '@/hooks/useProjectModal';
import { useLeadModal } from '@/hooks/useLeadModal';
import { useUpdateProjectTask, useDeleteProjectTask } from '@/hooks/useProjectTasks';
import { createActivityLog } from '@/services/activityLogService';
import { ListTodo, PlayCircle, CheckCircle2 } from 'lucide-react';

const ProjectTaskDialog = lazy(() => import('@/components/projects/ProjectTaskDialog').then(m => ({ default: m.ProjectTaskDialog })));
const ProjectDetailModal = lazy(() => import('@/components/projects/ProjectDetailModal').then(m => ({ default: m.ProjectDetailModal })));
const LeadModal = lazy(() => import('@/components/LeadModal').then(m => ({ default: m.LeadModal })));
import { isToday, isBefore, isAfter, startOfDay } from 'date-fns';
import { toast } from 'sonner';

// ── Types & helpers ──────────────────────────────────────────────────

type TabFilter = 'all' | 'today' | 'overdue' | 'future' | 'done';

function filterTasks(tasks: MyTask[], filter: TabFilter): MyTask[] {
  const now = new Date();
  switch (filter) {
    case 'today':
      return tasks.filter((t) => t.due_date && isToday(new Date(t.due_date)) && t.status !== 'concluida');
    case 'overdue':
      return tasks.filter((t) => t.due_date && isBefore(new Date(t.due_date), now) && t.status !== 'concluida');
    case 'future':
      return tasks.filter((t) => t.due_date && isAfter(startOfDay(new Date(t.due_date)), now) && !isToday(new Date(t.due_date)) && t.status !== 'concluida');
    case 'done':
      return tasks.filter((t) => t.status === 'concluida');
    default:
      return tasks.filter((t) => t.status !== 'concluida');
  }
}

// ── Queue reducer (atomic state updates) ─────────────────────────────

interface QueueState {
  items: MyTask[];
  index: number;
  modalOpen: boolean;
}

type QueueAction =
  | { type: 'START'; items: MyTask[] }
  | { type: 'COMPLETE' }
  | { type: 'SKIP' }
  | { type: 'BACK' }
  | { type: 'CLOSE' };

const initialQueueState: QueueState = { items: [], index: 0, modalOpen: false };

function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'START':
      return { items: action.items, index: 0, modalOpen: true };
    case 'COMPLETE':
    case 'SKIP': {
      const nextIndex = state.index + 1;
      if (nextIndex < state.items.length) {
        return { ...state, index: nextIndex };
      }
      return initialQueueState;
    }
    case 'BACK':
      return state.index > 0 ? { ...state, index: state.index - 1 } : state;
    case 'CLOSE':
      return initialQueueState;
    default:
      return state;
  }
}

// ── Page Component ───────────────────────────────────────────────────

export default function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightTaskId = searchParams.get('task');
  const { data: allTasks, isPending } = useMyTasks();
  const { lead: leadModalLead, opportunity: leadModalOpp, isOpen: leadModalOpen, openLead, closeLead } = useLeadModal();
  const updateTask = useUpdateProjectTask();
  const deleteTask = useDeleteProjectTask();

  const [tab, setTab] = useState<TabFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [queueState, dispatch] = useReducer(queueReducer, initialQueueState);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MyTask | null>(null);
  const { project: singleModalProject, isOpen: singleModalOpen, openProject, closeProject } = useProjectModal();
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const tasks = useMemo(() => allTasks || [], [allTasks]);
  const filtered = useMemo(() => filterTasks(tasks, tab), [tasks, tab]);

  // Auto-switch tab and highlight when ?task= param is present
  useEffect(() => {
    if (!highlightTaskId || tasks.length === 0) return;
    const targetTask = tasks.find(t => t.id === highlightTaskId);
    if (!targetTask) return;

    // Determine which tab contains this task
    const now = new Date();
    let targetTab: TabFilter = 'all';
    if (targetTask.status === 'concluida') {
      targetTab = 'done';
    } else if (targetTask.due_date && isBefore(new Date(targetTask.due_date), now)) {
      targetTab = 'overdue';
    } else if (targetTask.due_date && isToday(new Date(targetTask.due_date))) {
      targetTab = 'today';
    }

    setTab(targetTab);
    setHighlightedId(highlightTaskId);

    // Clear param from URL without navigation
    searchParams.delete('task');
    setSearchParams(searchParams, { replace: true });

    // Clear highlight after 4 seconds
    const timer = setTimeout(() => setHighlightedId(null), 4000);
    return () => clearTimeout(timer);
  }, [highlightTaskId, tasks]);

  // Scroll to highlighted task once rendered
  useEffect(() => {
    if (highlightedId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedId, filtered]);

  const counts = useMemo(() => {
    const now = startOfDay(new Date());
    const pending = tasks.filter((t) => t.status !== 'concluida');
    return {
      all: pending.length,
      today: tasks.filter((t) => t.due_date && isToday(new Date(t.due_date)) && t.status !== 'concluida').length,
      overdue: tasks.filter((t) => t.due_date && isBefore(new Date(t.due_date), now) && t.status !== 'concluida').length,
      future: tasks.filter((t) => t.due_date && isAfter(startOfDay(new Date(t.due_date)), now) && !isToday(new Date(t.due_date)) && t.status !== 'concluida').length,
      done: tasks.filter((t) => t.status === 'concluida').length,
    };
  }, [tasks]);

  // ── Selection ──
  const toggleSelect = useCallback((taskId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(taskId); else next.delete(taskId);
      return next;
    });
  }, []);

  const selectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filtered.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [filtered]);

  // ── Queue handlers (single dispatch each) ──
  const startQueue = useCallback(() => {
    const queueTasks = filtered.filter((t) => selectedIds.has(t.id));
    if (queueTasks.length === 0) {
      toast.error('Selecione pelo menos uma tarefa');
      return;
    }
    dispatch({ type: 'START', items: queueTasks });
  }, [filtered, selectedIds]);

  const handleQueueComplete = useCallback(() => {
    const current = queueState.items[queueState.index];
    if (current) {
      updateTask.mutate({
        taskId: current.id,
        projectId: current.project_id,
        updates: { status: 'concluida', completed_at: new Date().toISOString() },
      });
    }
    const isLast = queueState.index + 1 >= queueState.items.length;
    dispatch({ type: 'COMPLETE' });
    if (isLast) {
      setSelectedIds(new Set());
      toast.success('Fila concluída! 🎉');
    }
  }, [queueState, updateTask]);

  const handleQueueSkip = useCallback(() => {
    const isLast = queueState.index + 1 >= queueState.items.length;
    dispatch({ type: 'SKIP' });
    if (isLast) toast.info('Fim da fila');
  }, [queueState]);

  const handleQueueClose = useCallback(() => dispatch({ type: 'CLOSE' }), []);
  const handleQueueBack = useCallback(() => dispatch({ type: 'BACK' }), []);

  // ── Task actions ──
  const toggleStatus = useCallback((task: MyTask) => {
    const newStatus = task.status === 'concluida' ? 'pendente' : 'concluida';
    updateTask.mutate({
      taskId: task.id,
      projectId: task.project_id ?? '',
      updates: {
        status: newStatus,
        completed_at: newStatus === 'concluida' ? new Date().toISOString() : null,
      },
    });
  }, [updateTask]);

  const handleComplete = useCallback((task: MyTask) => {
    updateTask.mutate({
      taskId: task.id,
      projectId: task.project_id ?? '',
      updates: { status: 'concluida', completed_at: new Date().toISOString() },
    });
    const resolvedLeadId = task.lead_id || task.context_lead_id;
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
  }, [updateTask]);

  const handleEdit = useCallback((task: MyTask) => {
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
  }, []);

  const handleDelete = useCallback((task: MyTask) => setDeleteTarget(task), []);

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteTask.mutate({ taskId: deleteTarget.id, projectId: deleteTarget.project_id ?? '' });
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteTask]);

  // ── Derived queue values ──
  const isQueueActive = queueState.items.length > 0;
  const currentQueueTask = isQueueActive ? queueState.items[queueState.index] : null;
  const currentQueueTaskId = currentQueueTask?.id ?? null;
  const currentQueueProjectId = currentQueueTask?.project_id ?? null;
  const currentQueueIsLead = isQueueActive && !currentQueueProjectId && !!(currentQueueTask?.opportunity_id || currentQueueTask?.lead_id);

  const { data: currentQueueProject } = useQuery({
    queryKey: ['project-by-id', currentQueueProjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', currentQueueProjectId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentQueueProjectId,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  // Fetch lead for queue when task is opportunity/lead-based
  const queueLeadId = currentQueueIsLead ? (currentQueueTask?.context_lead_id || currentQueueTask?.lead_id) : null;
  const queueOppId = currentQueueIsLead ? currentQueueTask?.opportunity_id : null;

  const { data: queueLead } = useQuery({
    queryKey: ['queue-lead', queueLeadId],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').eq('id', queueLeadId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!queueLeadId,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const { data: queueOpp } = useQuery({
    queryKey: ['queue-opp', queueOppId],
    queryFn: async () => {
      const { data, error } = await supabase.from('opportunities').select('*').eq('id', queueOppId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!queueOppId,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const allSelected = filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id));
  const someSelected = selectedIds.size > 0;

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 flex-1 overflow-auto">
          <PageHeader
            icon={<ListTodo className="h-5 w-5" strokeWidth={1.5} />}
            title="Minhas Tarefas"
            subtitle="Gerencie e execute suas tarefas de projetos"
            actions={
              someSelected && !isQueueActive ? (
                <Button onClick={startQueue} className="gap-2">
                  <PlayCircle className="h-4 w-4" />
                  Iniciar Fila ({selectedIds.size})
                </Button>
              ) : undefined
            }
          />

          {/* Tabs */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
            <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
              <TabsTrigger value="all" className="gap-1.5 text-xs">
                Todos
                {counts.all > 0 && <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[11px] font-semibold">{counts.all}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="today" className="gap-1.5 text-xs">
                Vence Hoje
                {counts.today > 0 && <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[11px] font-semibold">{counts.today}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="overdue" className="gap-1.5 text-xs">
                Vencido
                {counts.overdue > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[11px] font-semibold bg-destructive/10 text-destructive border-destructive/20">
                    {counts.overdue}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="future" className="gap-1.5 text-xs">
                Eventos Futuros
                {counts.future > 0 && <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[11px] font-semibold">{counts.future}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="done" className="gap-1.5 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Concluídas
                {counts.done > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[11px] font-semibold bg-chart-3/10 text-chart-3 border-chart-3/20">
                    {counts.done}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Content – single loading gate */}
          {isPending ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 px-1 py-1">
                <Skeleton className="h-4 w-4 rounded-sm" />
                <Skeleton className="h-4 w-28" />
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="flex items-center gap-3 px-4 py-3 shadow-sm">
                  <Skeleton className="h-4 w-4 rounded-sm shrink-0" />
                  <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Skeleton className="h-7 w-7 rounded-md" />
                    <Skeleton className="h-7 w-7 rounded-md" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ListTodo className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {tab === 'all' && 'Nenhuma tarefa pendente.'}
                {tab === 'today' && 'Nenhuma tarefa vence hoje.'}
                {tab === 'overdue' && 'Nenhuma tarefa vencida. 🎉'}
                {tab === 'future' && 'Nenhum evento futuro agendado.'}
                {tab === 'done' && 'Nenhuma tarefa concluída ainda.'}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                As tarefas atribuídas a você aparecerão aqui
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tab !== 'done' && (
                <div className="flex items-center gap-2.5 px-1 py-1">
                  <Checkbox checked={allSelected} onCheckedChange={(v) => selectAll(!!v)} />
                  <span className="text-xs text-muted-foreground font-medium">
                    {allSelected ? 'Desmarcar tudo' : 'Selecionar tudo'} ({filtered.length})
                  </span>
                </div>
              )}
              <div className="space-y-2">
                {filtered.map((task) => (
                  <div
                    key={task.id}
                    ref={task.id === highlightedId ? highlightRef : undefined}
                    className={highlightedId === task.id ? 'animate-pulse ring-2 ring-primary rounded-xl transition-all duration-500' : ''}
                  >
                    <TaskListItem
                      task={task}
                      selected={selectedIds.has(task.id)}
                      onSelect={(checked) => toggleSelect(task.id, checked)}
                      onToggleStatus={() => toggleStatus(task)}
                      onComplete={task.status !== 'concluida' ? () => handleComplete(task) : undefined}
                      onEdit={() => handleEdit(task)}
                      onDelete={() => handleDelete(task)}
                      onOpenProject={() => {
                        if (task.project_id) {
                          openProject(task.project_id);
                        } else if (task.opportunity_id && task.context_lead_id) {
                          openLead(task.context_lead_id, task.opportunity_id);
                        } else if (task.lead_id) {
                          openLead(task.lead_id);
                        } else {
                          toast.info('Tarefa sem vínculo');
                        }
                      }}
                      isActive={currentQueueTaskId === task.id}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      <Suspense fallback={null}>
        {editingTask && (
          <ProjectTaskDialog
            projectId={editingTask.id ? tasks.find(t => t.id === editingTask.id)?.project_id ?? '' : ''}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            editTask={editingTask}
          />
        )}
      </Suspense>

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Excluir tarefa"
        description={`Tem certeza que deseja excluir a tarefa "${deleteTarget?.title}"? Esta ação não pode ser desfeita.`}
        onConfirm={confirmDelete}
        isDeleting={deleteTask.isPending}
      />

      {/* Queue modal — Project-based tasks */}
      <Suspense fallback={null}>
        <ProjectDetailModal
          open={queueState.modalOpen && !currentQueueIsLead}
          onOpenChange={(open) => { if (!open) dispatch({ type: 'CLOSE' }); }}
          project={currentQueueProject ?? null}
          topSlot={isQueueActive && !currentQueueIsLead ? (
            <TaskQueueControls
              queue={queueState.items}
              currentIndex={queueState.index}
              onComplete={handleQueueComplete}
              onSkip={handleQueueSkip}
              onBack={handleQueueBack}
              onClose={handleQueueClose}
            />
          ) : undefined}
        />

        {/* Queue modal — Lead/Opportunity-based tasks (Closer) */}
        {queueState.modalOpen && currentQueueIsLead && queueLead && (
          <LeadModal
            lead={queueLead as any}
            opportunity={queueOpp as any}
            open={true}
            onClose={() => dispatch({ type: 'CLOSE' })}
            onUpdateLead={() => {}}
            mode={queueOpp ? 'closer' : 'sdr'}
            topSlot={isQueueActive ? (
              <TaskQueueControls
                queue={queueState.items}
                currentIndex={queueState.index}
                onComplete={handleQueueComplete}
                onSkip={handleQueueSkip}
                onBack={handleQueueBack}
                onClose={handleQueueClose}
              />
            ) : undefined}
          />
        )}

        {/* Single task → project modal */}
        <ProjectDetailModal
          open={singleModalOpen}
          onOpenChange={(open) => { if (!open) closeProject(); }}
          project={singleModalProject}
        />

        {/* Lead/Opportunity modal (single click) */}
        {leadModalOpen && leadModalLead && (
          <LeadModal
            lead={leadModalLead}
            opportunity={leadModalOpp as any}
            open={leadModalOpen}
            onClose={closeLead}
            onUpdateLead={() => {}}
            mode={leadModalOpp ? 'closer' : 'sdr'}
          />
        )}
      </Suspense>
    </AppLayout>
  );
}
