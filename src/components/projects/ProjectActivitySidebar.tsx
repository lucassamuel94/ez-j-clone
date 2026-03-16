import { useState, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useProjectActivities, useCreateProjectActivity,
  useUpdateProjectActivity, useDeleteProjectActivity,
  useReplyProjectActivity,
} from '@/hooks/useProjectActivities';
import { useProjectTasks, useUpdateProjectTask } from '@/hooks/useProjectTasks';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UnifiedActivityFeed } from '@/components/shared/UnifiedActivityFeed';
import { ProjectTaskDialog } from './ProjectTaskDialog';
import { EmailComposeDialog } from '@/components/EmailComposeDialog';
import { ProjectCalendarEventDialog } from './ProjectCalendarEventDialog';
import type { ActivityFeedConfig, ActivityFeedAdapter, ActivityItem } from '@/types/activityFeed';
import {
  ListChecks, MessageSquare, Mail, Clock, ArrowRightLeft, RefreshCw,
  FileUp, CalendarPlus, History,
} from 'lucide-react';

// ---------- Project-specific config ----------

const PROJECT_ACTION_ICONS: Record<string, React.ReactNode> = {
  status_changed: <RefreshCw className="h-3 w-3" strokeWidth={1.5} />,
  observation: <MessageSquare className="h-3 w-3" strokeWidth={1.5} />,
  email_sent: <Mail className="h-3 w-3" strokeWidth={1.5} />,
  task_created: <ListChecks className="h-3 w-3" strokeWidth={1.5} />,
  task_completed: <ListChecks className="h-3 w-3" strokeWidth={1.5} />,
  phase_status_changed: <ArrowRightLeft className="h-3 w-3" strokeWidth={1.5} />,
  phase_advanced: <ArrowRightLeft className="h-3 w-3" strokeWidth={1.5} />,
  force_phase_move: <ArrowRightLeft className="h-3 w-3" strokeWidth={1.5} />,
  delivery_submitted: <FileUp className="h-3 w-3" strokeWidth={1.5} />,
  calendar_event: <CalendarPlus className="h-3 w-3" strokeWidth={1.5} />,
  project_created: <Clock className="h-3 w-3" strokeWidth={1.5} />,
};

const PROJECT_ACTION_COLORS: Record<string, string> = {
  status_changed: 'bg-primary/10 text-primary',
  observation: 'bg-chart-5/10 text-chart-5',
  email_sent: 'bg-chart-4/10 text-chart-4',
  task_created: 'bg-chart-3/10 text-chart-3',
  task_completed: 'bg-chart-3/10 text-chart-3',
  phase_status_changed: 'bg-primary/10 text-primary',
  phase_advanced: 'bg-primary/10 text-primary',
  force_phase_move: 'bg-chart-5/10 text-chart-5',
  delivery_submitted: 'bg-chart-3/10 text-chart-3',
  calendar_event: 'bg-chart-2/10 text-chart-2',
  project_created: 'bg-muted/50 text-muted-foreground',
};

const PROJECT_ACTION_LABELS: Record<string, string> = {
  status_changed: 'alterou status',
  observation: 'comentou',
  email_sent: 'enviou e-mail',
  task_created: 'criou tarefa',
  task_completed: 'concluiu tarefa',
  phase_status_changed: 'alterou etapa',
  phase_advanced: 'phase_advanced',
  force_phase_move: 'force_phase_move',
  delivery_submitted: 'delivery_submitted',
  calendar_event: 'agendou reunião',
  project_created: 'criou o projeto',
};

const PROJECT_SYSTEM_TYPES = new Set([
  'status_changed', 'phase_status_changed', 'project_created',
  'phase_advanced', 'force_phase_move', 'delivery_submitted',
]);

const PROJECT_FILTER_OPTIONS = [
  { value: 'all', label: 'Tudo', icon: <Clock className="h-2.5 w-2.5" strokeWidth={1.5} /> },
  {
    value: 'comments', label: 'Comentários', icon: <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} />,
    activeClass: 'bg-primary/10 text-primary border-primary/25',
  },
  {
    value: 'emails', label: 'E-mails', icon: <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />,
    activeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/25',
  },
  {
    value: 'tasks', label: 'Tarefas', icon: <ListChecks className="h-3.5 w-3.5" strokeWidth={1.5} />,
    activeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/25',
  },
  {
    value: 'system', label: 'Atualizações', icon: <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />,
    activeClass: 'bg-muted text-muted-foreground border-border',
  },
];

const PROJECT_FILTER_MAP: Record<string, string[]> = {
  all: [],
  comments: ['observation'],
  emails: ['email_sent'],
  tasks: ['task_created', 'task_completed'],
  system: ['status_changed', 'phase_status_changed', 'project_created', 'phase_advanced', 'force_phase_move', 'delivery_submitted'],
};

const PROJECT_CONFIG: ActivityFeedConfig = {
  actionIcons: PROJECT_ACTION_ICONS,
  actionColors: PROJECT_ACTION_COLORS,
  actionLabels: PROJECT_ACTION_LABELS,
  filterOptions: PROJECT_FILTER_OPTIONS,
  filterActionMap: PROJECT_FILTER_MAP,
  systemActionTypes: PROJECT_SYSTEM_TYPES,
  storageBucket: 'project-attachments',
  supportsReplies: true,
  sendOnEnter: true,
  buildStoragePath: (entityId, fileName) => `${entityId}/${fileName}`,
};

// ---------- Component ----------

interface ProjectActivitySidebarProps {
  projectId: string;
  canEdit: boolean;
  projectData?: {
    contact_email?: string | null;
    contact_name?: string | null;
    company_name?: string;
    contact_phone?: string | null;
  };
}

export function ProjectActivitySidebar({ projectId, canEdit, projectData }: ProjectActivitySidebarProps) {
  const { data: activities, isLoading } = useProjectActivities(projectId);
  const { data: tasks } = useProjectTasks(projectId);
  const updateTask = useUpdateProjectTask();
  const createActivity = useCreateProjectActivity();
  const updateActivity = useUpdateProjectActivity();
  const deleteActivity = useDeleteProjectActivity();
  const replyActivity = useReplyProjectActivity();
  const { user: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [openDialog, setOpenDialog] = useState<'task' | 'email' | 'calendar' | null>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  const taskMap = useMemo(() => {
    const map = new Map<string, any>();
    if (!tasks) return map;
    for (const t of tasks) map.set(t.id, t);
    return map;
  }, [tasks]);

  const handleToggleTask = useCallback((task: any) => {
    const newStatus = task.status === 'concluida' ? 'pendente' : 'concluida';
    updateTask.mutate({
      taskId: task.id, projectId,
      updates: { status: newStatus, completed_at: newStatus === 'concluida' ? new Date().toISOString() : null },
    });
  }, [updateTask, projectId]);

  const handleEditTask = useCallback((task: any) => {
    setEditingTask({
      id: task.id, title: task.title, description: task.description,
      due_date: task.due_date, notify_before: task.notify_before,
      priority: task.priority, assigned_user_id: task.assigned_user_id, status: task.status,
    });
    setTaskDialogOpen(true);
  }, []);

  // Build adapter
  const adapter: ActivityFeedAdapter = useMemo(() => ({
    items: (activities || []) as ActivityItem[],
    isLoading,
    createComment: (text) => {
      createActivity.mutate({ project_id: projectId, action_type: 'observation', description: text });
    },
    isCreating: createActivity.isPending,
    updateComment: (id, text) => {
      updateActivity.mutate({ activityId: id, description: text, projectId });
    },
    isUpdating: updateActivity.isPending,
    deleteComment: (id) => {
      deleteActivity.mutate({ activityId: id, projectId });
    },
    isDeleting: deleteActivity.isPending,
    replyToComment: (parentId, text) => {
      replyActivity.mutate({ project_id: projectId, action_type: 'observation', description: text, parent_id: parentId });
    },
    isReplying: replyActivity.isPending,
    handleFileUpload: async (files) => {
      setUploading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Não autenticado');
        for (const file of Array.from(files)) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `${projectId}/${Date.now()}-${safeName}`;
          const { error: uploadError } = await supabase.storage.from('project-attachments').upload(path, file);
          if (uploadError) throw uploadError;
          await supabase.from('project_attachments').insert({
            project_id: projectId, file_name: file.name, file_path: path,
            file_size: file.size, content_type: file.type, uploaded_by: user.id,
          } as any);
        }
        queryClient.invalidateQueries({ queryKey: ['project-attachments', projectId] });
        createActivity.mutate({ project_id: projectId, action_type: 'observation', description: `Anexou ${files.length} arquivo(s)` });
        toast.success('Arquivo(s) anexado(s)');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        toast.error(`Erro ao enviar arquivo: ${msg}`);
      } finally {
        setUploading(false);
      }
    },
    taskMap,
    onToggleTask: canEdit ? handleToggleTask : undefined,
    onEditTask: canEdit ? handleEditTask : undefined,
  }), [activities, isLoading, createActivity, updateActivity, deleteActivity, replyActivity, taskMap, projectId, canEdit, handleToggleTask, handleEditTask, queryClient]);

  const handleSendComment = useCallback(async (text: string, pendingImages?: string[], mentionedUsers?: Array<{id: string; name: string}>) => {
    const imageTags = pendingImages?.map(url => `[img:${url}]`).join('\n') || '';
    const description = [text, imageTags].filter(Boolean).join('\n');
    createActivity.mutate({ project_id: projectId, action_type: 'observation', description }, {
      onSuccess: async () => {
        if (mentionedUsers?.length && currentUser?.id) {
          const mentions = mentionedUsers.filter(m => m.id !== currentUser.id);
          if (mentions.length > 0) {
            const notifs = mentions.map(m => ({
              user_id: m.id,
              title: 'Você foi mencionado',
              message: `${currentUser.name || 'Alguém'} mencionou você em um projeto.`,
              type: 'comment_mention',
              link: `/projects?project=${projectId}`,
            }));
            await supabase.from('notifications').insert(notifs);
          }
        }
      },
    });
  }, [createActivity, projectId, currentUser]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    await adapter.handleFileUpload(files, projectId);
    e.target.value = '';
  };

  return (
    <>
      <UnifiedActivityFeed
        entityId={projectId}
        config={PROJECT_CONFIG}
        adapter={adapter}
        canEdit={canEdit}
        currentUserId={currentUser?.id}
        onOpenDialog={(type) => setOpenDialog(type)}
        onSendComment={handleSendComment}
        onFileUpload={handleFileUpload}
        uploading={uploading}
      />

      <ProjectTaskDialog
        projectId={projectId}
        open={openDialog === 'task' || taskDialogOpen}
        onOpenChange={(open) => {
          if (!open) { setOpenDialog(null); setTaskDialogOpen(false); setEditingTask(null); }
        }}
        editTask={editingTask}
        onTaskCreated={(data) => {
          const parts = [`📋 ${data.title}`];
          if (data.assignedUserName) parts.push(`Responsável: ${data.assignedUserName}`);
          if (data.dueDate) parts.push(`Data: ${new Date(data.dueDate).toLocaleDateString('pt-BR')} ${new Date(data.dueDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
          createActivity.mutate({ project_id: projectId, action_type: 'task_created', description: parts.join('\n'), new_value: data.taskId });
        }}
      />
      <EmailComposeDialog
        open={openDialog === 'email'}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        userName={currentUser?.name || ''}
        lead={{
          id: projectId, email: projectData?.contact_email || '',
          name: projectData?.contact_name || '', company: projectData?.company_name || '',
          razao_social: projectData?.company_name || '', nome_fantasia: projectData?.company_name || '',
          phone: projectData?.contact_phone || '',
        } as any}
        onSent={(details) => {
          const desc = details
            ? `📧 E-mail enviado via Gmail\nPara: ${details.to}\nAssunto: ${details.subject}${details.body ? `\nCorpo:\n${details.body}` : ''}`
            : 'E-mail enviado via Gmail';
          createActivity.mutate({ project_id: projectId, action_type: 'email_sent', description: desc });
        }}
      />
      <ProjectCalendarEventDialog
        open={openDialog === 'calendar'}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        projectData={projectData}
        onCreated={(details) => {
          const desc = details
            ? `📅 Evento criado no Google Calendar\nTítulo: ${details.title}\nData: ${details.date}\nHorário: ${details.startTime} - ${details.endTime}${details.attendee ? `\nConvidado: ${details.attendee}` : ''}${details.meetLink ? `\nMeet: ${details.meetLink}` : ''}`
            : 'Evento criado no Google Calendar';
          createActivity.mutate({ project_id: projectId, action_type: 'calendar_event', description: desc });
        }}
      />
    </>
  );
}
