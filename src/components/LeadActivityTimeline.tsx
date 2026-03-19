import { useState, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLeadTimeline } from '@/hooks/useLeadTimeline';
import { useLeadTasks, useUpdateProjectTask } from '@/hooks/useProjectTasks';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UnifiedActivityFeed } from '@/components/shared/UnifiedActivityFeed';
import { ProjectTaskDialog } from '@/components/projects/ProjectTaskDialog';
import { EmailComposeDialog } from '@/components/EmailComposeDialog';
import { ProjectCalendarEventDialog } from '@/components/projects/ProjectCalendarEventDialog';
import type { ActivityFeedConfig, ActivityFeedAdapter, ActivityItem } from '@/types/activityFeed';
import {
  ListChecks, MessageSquare, Mail, Clock, ArrowRightLeft, RefreshCw,
  Zap, UserPlus, UserMinus, Calendar, History, Star, CalendarPlus,
} from 'lucide-react';

// ---------- Lead-specific config ----------

const LEAD_ACTION_ICONS: Record<string, React.ReactNode> = {
  observation: <MessageSquare className="h-3 w-3" strokeWidth={1.5} />,
  task: <ListChecks className="h-3 w-3" strokeWidth={1.5} />,
  email: <Mail className="h-3 w-3" strokeWidth={1.5} />,
  calendar_event: <CalendarPlus className="h-3 w-3" strokeWidth={1.5} />,
  status_changed: <RefreshCw className="h-3 w-3" strokeWidth={1.5} />,
  temperature_changed: <Zap className="h-3 w-3" strokeWidth={1.5} />,
  created: <Star className="h-3 w-3" strokeWidth={1.5} />,
  field_updated: <RefreshCw className="h-3 w-3" strokeWidth={1.5} />,
  owner_assigned: <UserPlus className="h-3 w-3" strokeWidth={1.5} />,
  owner_removed: <UserMinus className="h-3 w-3" strokeWidth={1.5} />,
  interaction_added: <ArrowRightLeft className="h-3 w-3" strokeWidth={1.5} />,
  interaction_registered: <ArrowRightLeft className="h-3 w-3" strokeWidth={1.5} />,
  cadence_started: <Zap className="h-3 w-3" strokeWidth={1.5} />,
  cadence_step_changed: <ArrowRightLeft className="h-3 w-3" strokeWidth={1.5} />,
  meeting_scheduled: <Calendar className="h-3 w-3" strokeWidth={1.5} />,
  meeting: <Calendar className="h-3 w-3" strokeWidth={1.5} />,
  opportunity_created: <Star className="h-3 w-3" strokeWidth={1.5} />,
  system: <Clock className="h-3 w-3" strokeWidth={1.5} />,
};

const LEAD_ACTION_COLORS: Record<string, string> = {
  observation: 'bg-chart-5/10 text-chart-5',
  task: 'bg-chart-3/10 text-chart-3',
  email: 'bg-chart-4/10 text-chart-4',
  calendar_event: 'bg-chart-2/10 text-chart-2',
  status_changed: 'bg-primary/10 text-primary',
  temperature_changed: 'bg-chart-5/10 text-chart-5',
  created: 'bg-chart-3/10 text-chart-3',
  field_updated: 'bg-muted/50 text-muted-foreground',
  owner_assigned: 'bg-chart-4/10 text-chart-4',
  owner_removed: 'bg-chart-4/10 text-chart-4',
  interaction_added: 'bg-primary/10 text-primary',
  interaction_registered: 'bg-primary/10 text-primary',
  cadence_started: 'bg-chart-2/10 text-chart-2',
  cadence_step_changed: 'bg-chart-2/10 text-chart-2',
  meeting_scheduled: 'bg-chart-3/10 text-chart-3',
  meeting: 'bg-chart-3/10 text-chart-3',
  opportunity_created: 'bg-chart-3/10 text-chart-3',
  system: 'bg-muted/50 text-muted-foreground',
};

const LEAD_ACTION_LABELS: Record<string, string> = {
  observation: 'comentou',
  task: 'criou tarefa',
  email: 'enviou e-mail',
  calendar_event: 'agendou reunião',
  status_changed: 'alterou status',
  temperature_changed: 'alterou qualificação',
  created: 'criou o lead',
  field_updated: 'atualizou campo',
  owner_assigned: 'atribuiu responsável',
  owner_removed: 'removeu responsável',
  interaction_added: 'registrou interação',
  interaction_registered: 'registrou interação',
  cadence_started: 'iniciou cadência',
  cadence_step_changed: 'avançou cadência',
  meeting_scheduled: 'agendou reunião',
  meeting: 'agendou reunião',
  opportunity_created: 'criou oportunidade',
  system: 'ação do sistema',
};

const LEAD_SYSTEM_TYPES = new Set([
  'status_changed', 'temperature_changed', 'created', 'field_updated',
  'owner_assigned', 'owner_removed', 'interaction_added', 'interaction_registered',
  'cadence_started', 'cadence_step_changed', 'opportunity_created', 'system',
]);

const LEAD_FILTER_OPTIONS = [
  { value: 'all', label: 'Tudo', icon: <Clock className="h-2.5 w-2.5" strokeWidth={1.5} /> },
  {
    value: 'comments', label: 'Comentários', icon: <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} />,
    activeClass: 'bg-primary/10 text-primary border-primary/25',
  },
  {
    value: 'tasks', label: 'Tarefas', icon: <ListChecks className="h-3.5 w-3.5" strokeWidth={1.5} />,
    activeClass: 'bg-warning/10 text-warning border-amber-500/25',
  },
  {
    value: 'emails', label: 'E-mails', icon: <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />,
    activeClass: 'bg-info/10 text-info border-info/25',
  },
  {
    value: 'meetings', label: 'Reuniões', icon: <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} />,
    activeClass: 'bg-green-500/10 text-green-600 border-green-500/25',
  },
  {
    value: 'logs', label: 'Atualizações', icon: <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />,
    activeClass: 'bg-muted text-muted-foreground border-border',
  },
];

const LEAD_FILTER_MAP: Record<string, string[]> = {
  all: [],
  comments: ['observation'],
  tasks: ['task'],
  emails: ['email'],
  meetings: ['calendar_event', 'meeting_scheduled', 'meeting'],
  logs: ['status_changed', 'temperature_changed', 'created', 'field_updated', 'owner_assigned', 'owner_removed', 'interaction_added', 'interaction_registered', 'cadence_started', 'cadence_step_changed', 'opportunity_created', 'system'],
};

const LEAD_CONFIG: ActivityFeedConfig = {
  actionIcons: LEAD_ACTION_ICONS,
  actionColors: LEAD_ACTION_COLORS,
  actionLabels: LEAD_ACTION_LABELS,
  filterOptions: LEAD_FILTER_OPTIONS,
  filterActionMap: LEAD_FILTER_MAP,
  systemActionTypes: LEAD_SYSTEM_TYPES,
  storageBucket: 'lead-attachments',
  supportsReplies: false,
  sendOnEnter: false,
  buildStoragePath: (entityId, fileName, userId) => `${userId}/${entityId}/${fileName}`,
};

// ---------- Component ----------

interface LeadActivityTimelineProps {
  leadId: string;
  canEdit?: boolean;
  leadData?: {
    email?: string | null;
    name?: string;
    company?: string;
    phone?: string | null;
    razao_social?: string | null;
    nome_fantasia?: string | null;
  };
  opportunityId?: string | null;
  /** Only show timeline items created on or after this date */
  sinceDate?: string | null;
}

export function LeadActivityTimeline({ leadId, canEdit = true, leadData, opportunityId, sinceDate }: LeadActivityTimelineProps) {
  const { timeline: rawTimeline, isLoading, createNote, updateNote, deleteNote } = useLeadTimeline(leadId);
  const timeline = useMemo(() => {
    if (!sinceDate || !rawTimeline) return rawTimeline;
    const since = new Date(sinceDate).getTime();
    return rawTimeline.filter(item => new Date(item.created_at).getTime() >= since);
  }, [rawTimeline, sinceDate]);
  const { data: tasks } = useLeadTasks(leadId, opportunityId);
  const updateTask = useUpdateProjectTask();
  const { user: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [openDialog, setOpenDialog] = useState<'task' | 'email' | 'calendar' | null>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build task map from fetched tasks
  const taskMap = useMemo(() => {
    const map = new Map<string, any>();
    if (tasks) {
      for (const t of tasks) map.set(t.id, t);
    }
    return map;
  }, [tasks]);

  const handleToggleTask = useCallback((task: any) => {
    const newStatus = task.status === 'concluida' ? 'pendente' : 'concluida';
    updateTask.mutate(
      { taskId: task.id, updates: { status: newStatus, completed_at: newStatus === 'concluida' ? new Date().toISOString() : null }, projectId: task.project_id || '' },
      { onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['lead-tasks', leadId, opportunityId] });
        queryClient.invalidateQueries({ queryKey: ['lead-timeline-notes', leadId] });
        queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      }}
    );
  }, [updateTask, queryClient, leadId, opportunityId]);

  const handleEditTask = useCallback((task: any) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  }, []);

  // Build adapter
  const adapter: ActivityFeedAdapter = useMemo(() => ({
    items: timeline as ActivityItem[],
    isLoading,
    createComment: (text, attachments) => createNote.mutate({ note: text, attachments }),
    isCreating: createNote.isPending,
    updateComment: (id, text) => {
      const original = timeline.find(t => t.id === id);
      if (!original) return;
      const statusMatch = original.description.match(/^\[([^\]]+)\]/);
      const userMatch = original.description.match(/\]\s*\(([^)]+)\)\s*/);
      let prefix = '';
      if (statusMatch) {
        prefix = statusMatch[0];
        if (userMatch) prefix += ` (${userMatch[1]}) `;
        else prefix += ' ';
      }
      updateNote.mutate({ noteId: id, noteText: `${prefix}${text}` });
    },
    isUpdating: updateNote.isPending,
    deleteComment: (id) => deleteNote.mutate(id),
    isDeleting: deleteNote.isPending,
    handleFileUpload: async (files, entityId) => {
      setUploading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Não autenticado');
        const uploadedFiles: { name: string; path: string; size: number; type: string }[] = [];
        for (const file of Array.from(files)) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `${user.id}/${entityId}/${Date.now()}-${safeName}`;
          const { error: uploadError } = await supabase.storage.from('lead-attachments').upload(path, file);
          if (uploadError) throw uploadError;
          uploadedFiles.push({ name: file.name, path, size: file.size, type: file.type });
        }
        createNote.mutate({ note: `Anexou ${uploadedFiles.length} arquivo(s)`, attachments: uploadedFiles });
        toast.success('Arquivo(s) anexado(s)');
      } catch {
        toast.error('Erro ao enviar arquivo');
      } finally {
        setUploading(false);
      }
    },
    taskMap,
    onToggleTask: handleToggleTask,
    onEditTask: handleEditTask,
  }), [timeline, isLoading, createNote, updateNote, deleteNote, taskMap, handleToggleTask, handleEditTask]);

  const handleSendComment = useCallback(async (text: string, pendingImages?: string[], mentionedUsers?: Array<{id: string; name: string}>) => {
    const imageTags = pendingImages?.map(url => `[img:${url}]`).join('\n') || '';
    const description = [text, imageTags].filter(Boolean).join('\n');
    createNote.mutate({ note: description }, {
      onSuccess: async () => {
        // Create notifications for mentioned users
        if (mentionedUsers?.length && currentUser?.id) {
          const mentions = mentionedUsers.filter(m => m.id !== currentUser.id);
          if (mentions.length > 0) {
            const notifs = mentions.map(m => ({
              user_id: m.id,
              title: 'Você foi mencionado',
              message: `${currentUser.name || 'Alguém'} mencionou você em uma observação.`,
              type: 'comment_mention',
              link: `/leads?lead=${leadId}`,
            }));
            await supabase.from('notifications').insert(notifs);
          }
        }
      },
    });
  }, [createNote, currentUser, leadId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    await adapter.handleFileUpload(files, leadId);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <UnifiedActivityFeed
        entityId={leadId}
        config={LEAD_CONFIG}
        adapter={adapter}
        canEdit={canEdit}
        currentUserId={currentUser?.id}
        onOpenDialog={(type) => setOpenDialog(type)}
        onSendComment={handleSendComment}
        onFileUpload={handleFileUpload}
        uploading={uploading}
      />

      <ProjectTaskDialog
        projectId=""
        open={openDialog === 'task' || taskDialogOpen}
        onOpenChange={(open) => {
          if (!open) { setOpenDialog(null); setTaskDialogOpen(false); setEditingTask(null); }
        }}
        editTask={editingTask}
        leadId={leadId}
        opportunityId={opportunityId || undefined}
        onTaskCreated={(data) => {
          const parts = [`📋 Tarefa criada: ${data.title}`];
          if (data.assignedUserName) parts.push(`Responsável: ${data.assignedUserName}`);
          if (data.dueDate) parts.push(`Data: ${new Date(data.dueDate).toLocaleDateString('pt-BR')} ${new Date(data.dueDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
          (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase.from('lead_notes').insert({
              lead_id: leadId, user_id: user.id,
              note: `📋 Tarefa criada: ${data.title} | ${parts.slice(1).join(' | ')} [task_id:${data.taskId}]`,
            } as any);
            queryClient.invalidateQueries({ queryKey: ['lead-timeline-notes', leadId] });
            queryClient.invalidateQueries({ queryKey: ['notes', leadId] });
            queryClient.invalidateQueries({ queryKey: ['lead-tasks', leadId, opportunityId] });
          })();
        }}
      />
      <EmailComposeDialog
        open={openDialog === 'email'}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        userName={currentUser?.name || ''}
        lead={{
          id: leadId, email: leadData?.email || '', name: leadData?.name || '',
          company: leadData?.company || '', razao_social: leadData?.razao_social || '',
          nome_fantasia: leadData?.nome_fantasia || '', phone: leadData?.phone || '',
        } as any}
        onSent={(details) => {
          const desc = details
            ? `📧 E-mail enviado via Gmail\nPara: ${details.to}\nAssunto: ${details.subject}${details.body ? `\nCorpo:\n${details.body}` : ''}`
            : 'E-mail enviado via Gmail';
          (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const profileRes = await supabase.from('profiles').select('name').eq('id', user.id).single();
            const userName = profileRes.data?.name || 'Usuário';
            await supabase.from('lead_notes').insert({
              lead_id: leadId, user_id: user.id,
              note: `[E-mail] (${userName}) ${desc}`,
            } as any);
            queryClient.invalidateQueries({ queryKey: ['lead-timeline-notes', leadId] });
            queryClient.invalidateQueries({ queryKey: ['notes', leadId] });
          })();
        }}
      />
      <ProjectCalendarEventDialog
        open={openDialog === 'calendar'}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        projectData={leadData ? {
          contact_email: leadData.email,
          contact_name: leadData.name,
          company_name: leadData.company,
        } : undefined}
        onCreated={(details) => {
          const desc = details
            ? `📅 Evento criado no Google Calendar\nTítulo: ${details.title}\nData: ${details.date}\nHorário: ${details.startTime} - ${details.endTime}${details.attendee ? `\nConvidado: ${details.attendee}` : ''}${details.meetLink ? `\nMeet: ${details.meetLink}` : ''}`
            : 'Evento criado no Google Calendar';
          (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const profileRes = await supabase.from('profiles').select('name').eq('id', user.id).single();
            const userName = profileRes.data?.name || 'Usuário';
            await supabase.from('lead_notes').insert({
              lead_id: leadId, user_id: user.id,
              note: `[Agenda] (${userName}) ${desc}`,
            } as any);
            queryClient.invalidateQueries({ queryKey: ['lead-timeline-notes', leadId] });
            queryClient.invalidateQueries({ queryKey: ['notes', leadId] });
            await supabase.from('lead_activity_logs').insert({
              lead_id: leadId, user_id: user.id,
              action_type: 'meeting_scheduled',
              description: `agendou reunião: ${details?.title || ''}`,
            });
            queryClient.invalidateQueries({ queryKey: ['lead-timeline-logs', leadId] });
          })();
        }}
      />
    </div>
  );
}
