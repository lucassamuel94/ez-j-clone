import { useState, useRef, useCallback, useEffect } from 'react';
import { format, addDays, addWeeks } from 'date-fns';
import { MentionPopover } from '@/components/MentionPopover';
import type { SystemUser } from '@/hooks/useSystemUsers';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useSystemUsers } from '@/hooks/useSystemUsers';
import { useCreateProjectTask, useUpdateProjectTask } from '@/hooks/useProjectTasks';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';
import {
  CalendarIcon, Loader2, Flag, Phone, Mail, Users, MoreHorizontal,
  Bell, User, Plus, ListChecks,
} from 'lucide-react';

interface ProjectTaskDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: (data: { title: string; assignedUserName?: string; dueDate?: string; taskId?: string }) => void;
  opportunityId?: string | null;
  leadId?: string | null;
  editTask?: {
    id: string;
    title: string;
    description?: string;
    due_date?: string;
    notify_before?: string;
    priority?: string;
    assigned_user_id?: string;
    status?: string;
  } | null;
}

const PRIORITIES = [
  { value: 'nenhuma', label: 'Nenhuma', color: 'text-muted-foreground' },
  { value: 'baixa', label: 'Baixa', color: 'text-info' },
  { value: 'normal', label: 'Normal', color: 'text-warning' },
  { value: 'alta', label: 'Alta', color: 'text-warning' },
  { value: 'urgente', label: 'Urgente', color: 'text-destructive' },
];

const REMINDERS = [
  { value: 'none', label: 'Sem lembrete' },
  { value: '5min', label: '5 minutos antes' },
  { value: '15min', label: '15 minutos antes' },
  { value: '30min', label: '30 minutos antes' },
  { value: '1h', label: '1 hora antes' },
  { value: '1d', label: '1 dia antes' },
  { value: '2d', label: '2 dias antes' },
];

const QUICK_DATES = [
  { label: 'Hoje', fn: () => new Date() },
  { label: 'Amanhã', fn: () => addDays(new Date(), 1) },
  { label: 'Em 1 semana', fn: () => addWeeks(new Date(), 1) },
];

export function ProjectTaskDialog({ projectId, open, onOpenChange, onTaskCreated, editTask, opportunityId, leadId }: ProjectTaskDialogProps) {
  const { data: users } = useSystemUsers();
  const { hasPermission } = usePermissions();
  const isAdmin = hasPermission('access_admin');
  const { user: currentUser } = useCurrentUser();
  const createTask = useCreateProjectTask();
  const updateTask = useUpdateProjectTask();

  const isEditing = !!editTask;

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [dueTime, setDueTime] = useState('09:00');
  const [reminder, setReminder] = useState('none');
  const [priority, setPriority] = useState('nenhuma');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [description, setDescription] = useState('');
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Reset/populate when dialog opens
  useEffect(() => {
    if (open && !editTask) {
      resetForm();
      // Auto-assign current user for non-admins
      if (!isAdmin && currentUser?.id) {
        setAssignedUserId(currentUser.id);
      }
    }
    if (open && editTask) {
      setTitle(editTask.title || '');
      setDescription(editTask.description || '');
      setPriority(editTask.priority || 'nenhuma');
      setAssignedUserId(editTask.assigned_user_id || '');
      setReminder(editTask.notify_before || 'none');
      if (editTask.due_date) {
        const d = new Date(editTask.due_date);
        setDueDate(d);
        setDueTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      } else {
        setDueDate(undefined);
        setDueTime('09:00');
      }
    }
  }, [open, editTask, isAdmin, currentUser]);

  const handleMention = useCallback((user: SystemUser, startPos: number, endPos: number) => {
    const before = description.substring(0, startPos);
    const after = description.substring(endPos);
    const newValue = `${before}@${user.name} ${after}`;
    setDescription(newValue);
  }, [description]);

  const resetForm = () => {
    setTitle('');
    setDueDate(undefined);
    setDueTime('09:00');
    setReminder('none');
    setPriority('nenhuma');
    setAssignedUserId('');
    setDescription('');
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    // Resolve assigned user: for non-admins, always use currentUser
    const effectiveAssignedUserId = !isAdmin && currentUser?.id ? currentUser.id : assignedUserId;

    let dueDateStr: string | undefined;
    if (dueDate) {
      const [h, m] = dueTime.split(':').map(Number);
      const d = new Date(dueDate);
      d.setHours(h, m, 0, 0);
      dueDateStr = d.toISOString();
    }

    // Capture values before reset
    const submitTitle = title.trim();
    const assignedUser = users?.find(u => u.id === effectiveAssignedUserId);
    const submitDueDate = dueDateStr;

    if (isEditing && editTask) {
      updateTask.mutate({
        taskId: editTask.id,
        projectId,
        updates: {
          title: submitTitle,
          description: description || null,
          due_date: submitDueDate || null,
          assigned_user_id: effectiveAssignedUserId || null,
          notify_before: reminder !== 'none' ? reminder : null,
          priority,
        },
      }, {
        onSuccess: () => {
          resetForm();
          onOpenChange(false);
        },
      });
    } else {
      createTask.mutate({
        project_id: projectId || undefined,
        title: submitTitle,
        description: description || undefined,
        due_date: submitDueDate,
        assigned_user_id: effectiveAssignedUserId || undefined,
        notify_before: reminder !== 'none' ? reminder : undefined,
        priority,
        opportunity_id: opportunityId || undefined,
        lead_id: leadId || undefined,
      } as any, {
        onSuccess: (createdTask: any) => {
          onTaskCreated?.({
            title: submitTitle,
            assignedUserName: assignedUser?.name,
            dueDate: submitDueDate,
            taskId: createdTask?.id,
          });
          resetForm();
          onOpenChange(false);
        },
      });
    }
  };

  const selectedPriority = PRIORITIES.find(p => p.value === priority);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-primary" /> {isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Título da tarefa..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-10 text-sm font-medium rounded-xl border-border"
            autoFocus
          />

          {/* Date & Time group */}
          <div className="rounded-xl bg-muted/40 dark:bg-muted/20 p-3 space-y-3 border border-border/50">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground dark:text-muted-foreground/90 mb-1.5 block">Data da atividade</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn(
                      'w-full h-9 text-xs rounded-xl justify-start font-normal border-border',
                      !dueDate && 'text-muted-foreground'
                    )}>
                      <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                      {dueDate ? format(dueDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="flex gap-1 p-2 border-b border-border">
                      {QUICK_DATES.map(qd => (
                        <Button key={qd.label} variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg"
                          onClick={() => setDueDate(qd.fn())}>
                          {qd.label}
                        </Button>
                      ))}
                    </div>
                    <Calendar mode="single" selected={dueDate} onSelect={setDueDate}
                      className="p-3 pointer-events-auto" locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground dark:text-muted-foreground/90 mb-1.5 block">Hora</Label>
                <Select value={dueTime} onValueChange={setDueTime}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {Array.from({ length: 48 }, (_, i) => {
                      const h = String(Math.floor(i / 2)).padStart(2, '0');
                      const m = i % 2 === 0 ? '00' : '30';
                      return `${h}:${m}`;
                    }).map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground dark:text-muted-foreground/90 mb-1.5 flex items-center gap-1">
                <Bell className="h-3 w-3" /> Lembrete
              </Label>
              <Select value={reminder} onValueChange={setReminder}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDERS.map(r => (
                    <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Priority */}
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground/90 mb-1.5 flex items-center gap-1">
              <Flag className={cn('h-3 w-3', selectedPriority?.color)} /> Prioridade
            </Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-9 text-xs rounded-xl border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map(p => (
                  <SelectItem key={p.value} value={p.value} className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <Flag className={cn('h-3 w-3', p.color)} /> {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Responsible */}
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground/90 mb-1.5 flex items-center gap-1">
              <User className="h-3 w-3" /> Responsável
            </Label>
            {isAdmin ? (
              <Select value={assignedUserId} onValueChange={setAssignedUserId}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-border">
                  <SelectValue placeholder="Selecionar responsável" />
                </SelectTrigger>
                <SelectContent>
                  {(users || []).map(u => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 h-9 px-3 rounded-xl bg-muted/50 border border-border">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">{currentUser?.name || 'Você'}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground/90 mb-1.5 block">Descrição</Label>
            <div className="relative">
              <Textarea
                ref={descriptionRef}
                placeholder="Adicione uma descrição... Use @ para mencionar alguém"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="text-sm resize-none rounded-xl border-border"
              />
              <MentionPopover inputRef={descriptionRef} value={description} onMention={handleMention} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-9 text-xs rounded-xl" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="h-9 text-xs rounded-xl px-5" onClick={handleSubmit}
              disabled={!title.trim() || createTask.isPending || updateTask.isPending}>
              {(createTask.isPending || updateTask.isPending) ? <Loader2 className="h-3 w-3 animate-spin" /> :
                isEditing ? 'Salvar alterações' : <><Plus className="h-3 w-3 mr-1" /> Criar tarefa</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
