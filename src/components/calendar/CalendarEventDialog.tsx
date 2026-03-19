import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Trash2,
  ExternalLink,
  Video,
  Pencil,
  Clock,
  AlignLeft,
  Users,
  Copy,
  Repeat,
  Check,
  X as XIcon,
  HelpCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CalendarEventItem, CalendarAttendee } from './types';
import { CalendarDeleteDialog } from './CalendarDeleteDialog';

// ── Helpers ──

function getInitials(email: string) {
  const name = email.split('@')[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-info/15 text-info dark:bg-info/20 dark:text-info',
  'bg-success/15 text-success dark:bg-success/20 dark:text-success',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  'bg-warning/15 text-warning dark:bg-warning/20 dark:text-warning',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
];

function avatarColor(email: string) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = ((hash << 5) - hash + email.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const RSVP_CONFIG: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  accepted: { icon: <Check className="h-3 w-3" />, label: 'Confirmado', className: 'text-success' },
  declined: { icon: <XIcon className="h-3 w-3" />, label: 'Recusado', className: 'text-destructive' },
  tentative: { icon: <HelpCircle className="h-3 w-3" />, label: 'Talvez', className: 'text-warning' },
  needsAction: { icon: <HelpCircle className="h-3 w-3" />, label: 'Pendente', className: 'text-muted-foreground' },
};

function parseRecurrence(rule?: string): string | null {
  if (!rule) return null;
  const freq = rule.match(/FREQ=(\w+)/)?.[1];
  const map: Record<string, string> = {
    DAILY: 'Diariamente',
    WEEKLY: 'Semanalmente',
    MONTHLY: 'Mensalmente',
    YEARLY: 'Anualmente',
  };
  return map[freq || ''] || null;
}

// ── Attendee Row ──

function AttendeeRow({ attendee }: { attendee: CalendarAttendee }) {
  const rsvp = RSVP_CONFIG[attendee.responseStatus || 'needsAction'] || RSVP_CONFIG.needsAction;

  return (
    <div className="flex items-center gap-3 py-1.5">
      {/* Avatar */}
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarColor(attendee.email)}`}
        aria-hidden="true"
      >
        {getInitials(attendee.email)}
      </div>
      {/* Email */}
      <span className="text-sm text-foreground truncate flex-1 min-w-0">
        {attendee.email}
      </span>
      {/* RSVP status */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`shrink-0 ${rsvp.className}`} aria-label={rsvp.label}>
            {rsvp.icon}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">{rsvp.label}</TooltipContent>
      </Tooltip>
    </div>
  );
}

// ── Props ──

interface CalendarEventDialogProps {
  open: boolean;
  event: CalendarEventItem | null;
  mode: 'create' | 'view';
  onClose: () => void;
  onCreate: (data: { title: string; description: string; startDate: string; startTime: string; endTime: string; attendees: string }) => Promise<void>;
  onUpdate?: (eventId: string, data: { title: string; description: string; startDate: string; startTime: string; endTime: string; attendees: string }) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
  isSubmitting: boolean;
  isMobile?: boolean;
}

// ── Main Component ──

export function CalendarEventDialog({
  open,
  event,
  mode,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  isSubmitting,
  isMobile = false,
}: CalendarEventDialogProps) {
  const now = new Date();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(format(now, 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(format(now, 'HH:00'));
  const [endTime, setEndTime] = useState(format(new Date(now.getTime() + 3600000), 'HH:00'));
  const [attendees, setAttendees] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [timeError, setTimeError] = useState('');

  useEffect(() => {
    if (open && mode === 'create') {
      const n = new Date();
      setStartDate(format(n, 'yyyy-MM-dd'));
      setStartTime(format(n, 'HH:00'));
      setEndTime(format(new Date(n.getTime() + 3600000), 'HH:00'));
      setTitle('');
      setDescription('');
      setAttendees('');
      setIsEditing(false);
      setTimeError('');
    }
    if (open && mode === 'view') {
      setIsEditing(false);
      setTimeError('');
    }
  }, [open, mode]);

  useEffect(() => {
    if (isEditing && event) {
      const start = new Date(event.start);
      const end = new Date(event.end);
      setTitle(event.title || '');
      setDescription(event.description || '');
      setStartDate(format(start, 'yyyy-MM-dd'));
      setStartTime(format(start, 'HH:mm'));
      setEndTime(format(end, 'HH:mm'));
      setAttendees(event.attendees?.map(a => a.email).join(', ') || '');
    }
  }, [isEditing, event]);

  useEffect(() => {
    if (startTime && endTime && endTime <= startTime) {
      setTimeError('Horário de fim deve ser após o início');
    } else {
      setTimeError('');
    }
  }, [startTime, endTime]);

  const handleCreate = async () => {
    if (!title.trim() || timeError) return;
    await onCreate({ title, description, startDate, startTime, endTime, attendees });
    setTitle('');
    setDescription('');
    setAttendees('');
  };

  const handleUpdate = async () => {
    if (!title.trim() || !event || !onUpdate || timeError) return;
    await onUpdate(event.id, { title, description, startDate, startTime, endTime, attendees });
    setIsEditing(false);
  };

  const handleDeleteConfirm = async () => {
    if (!event) return;
    await onDelete(event.id);
    setDeleteDialogOpen(false);
  };

  const handleCopyMeetLink = () => {
    if (event?.meetLink) {
      navigator.clipboard.writeText(event.meetLink);
      toast.success('Link copiado!');
    }
  };

  const formatReadableDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return format(d, "EEEE, d 'de' MMMM", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  // ── VIEW MODE CONTENT ──
  const viewContent = (event && mode === 'view' && !isEditing) ? (() => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const recurrenceLabel = parseRecurrence(event.recurrence);

    return (
      <div className="space-y-1">
        {/* Action icons row */}
        <div className="flex items-center justify-end gap-1 px-2 pt-1 pr-10 -mb-2">
          {onUpdate && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setIsEditing(true)}
              disabled={isSubmitting}
              aria-label="Editar evento"
            >
              <Pencil className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={isSubmitting}
            aria-label="Excluir evento"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>

        {/* Title */}
        <div className="flex items-start gap-3 px-5 pb-3">
          <div className="mt-1 h-4 w-4 rounded bg-primary shrink-0" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground leading-snug">{event.title}</h2>
        </div>

        <Separator />

        <div className="px-5 py-4 space-y-4">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <Clock className="h-[18px] w-[18px] text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-sm text-foreground font-medium capitalize">
                {format(start, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
              </p>
            </div>
          </div>

          {/* Recurrence */}
          {recurrenceLabel && (
            <div className="flex items-center gap-3">
              <Repeat className="h-[18px] w-[18px] text-muted-foreground shrink-0" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">{recurrenceLabel}</p>
            </div>
          )}

          {/* Google Meet */}
          {event.meetLink && (
            <>
              <Separator />
              <div className="flex items-center gap-3">
                <Video className="h-[18px] w-[18px] text-muted-foreground shrink-0" strokeWidth={1.5} />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <a
                    href={event.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium truncate"
                  >
                    Participar pelo Google Meet
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                        onClick={handleCopyMeetLink}
                        aria-label="Copiar link do Meet"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Copiar link</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </>
          )}

          {/* Description */}
          {event.description && (
            <>
              <Separator />
              <div className="flex items-start gap-3">
                <AlignLeft className="h-[18px] w-[18px] text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {event.description}
                </p>
              </div>
            </>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <>
              <Separator />
              <div className="flex items-start gap-3">
                <Users className="h-[18px] w-[18px] text-muted-foreground mt-1 shrink-0" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {event.attendees.length} participante{event.attendees.length > 1 ? 's' : ''}
                  </p>
                  <div className="space-y-0.5">
                    {event.attendees.map((a, i) => (
                      <AttendeeRow key={i} attendee={a} />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  })() : null;

  // ── VIEW MODE RENDER ──
  if (mode === 'view' && event && !isEditing) {
    // Mobile: use Drawer (bottom sheet)
    if (isMobile) {
      return (
        <>
          <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
            <DrawerContent className="max-h-[85dvh]">
              <DrawerTitle className="sr-only">{event.title}</DrawerTitle>
              <DrawerDescription className="sr-only">Detalhes do evento</DrawerDescription>
              <div className="overflow-y-auto pb-4">
                {viewContent}
              </div>
            </DrawerContent>
          </Drawer>

          <CalendarDeleteDialog
            open={deleteDialogOpen}
            eventTitle={event.title}
            isDeleting={isSubmitting}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteDialogOpen(false)}
          />
        </>
      );
    }

    // Desktop: use Dialog
    return (
      <>
        <Dialog open={open} onOpenChange={() => onClose()}>
          <DialogContent className="sm:max-w-[460px] p-0 gap-0 overflow-hidden" aria-describedby="event-view-desc">
            <DialogTitle className="sr-only">{event.title}</DialogTitle>
            <DialogDescription id="event-view-desc" className="sr-only">
              Detalhes do evento {event.title}
            </DialogDescription>
            <div className="overflow-y-auto max-h-[75vh]">
              {viewContent}
            </div>
          </DialogContent>
        </Dialog>

        <CalendarDeleteDialog
          open={deleteDialogOpen}
          eventTitle={event.title}
          isDeleting={isSubmitting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteDialogOpen(false)}
        />
      </>
    );
  }

  // ── CREATE / EDIT MODE ──
  const isEditMode = isEditing && event;

  const formContent = (
    <div className="space-y-4 overflow-y-auto flex-1 px-6 py-4">
      {/* Title */}
      <div className="space-y-1.5">
        <label htmlFor="event-title" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Título
        </label>
        <div className="flex items-center gap-2.5">
          <div className="h-3.5 w-3.5 rounded bg-primary shrink-0" aria-hidden="true" />
          <Input
            id="event-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nome do evento"
            className="text-sm h-9"
            autoFocus
          />
        </div>
      </div>

      {/* Date & Time */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Data e horário
        </label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-9 text-sm"
          aria-label="Data do evento"
        />
        <p className="text-[11px] text-muted-foreground capitalize -mt-0.5">
          {formatReadableDate(startDate)}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label htmlFor="event-start" className="sr-only">Início</label>
            <Input
              id="event-start"
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                const [h, m] = e.target.value.split(':').map(Number);
                setEndTime(`${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
              }}
              className="h-9 text-sm"
            />
          </div>
          <span className="text-muted-foreground text-xs font-medium select-none">até</span>
          <div className="flex-1">
            <label htmlFor="event-end" className="sr-only">Fim</label>
            <Input
              id="event-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={`h-9 text-sm ${timeError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
          </div>
        </div>
        {timeError && (
          <p className="text-xs text-destructive" role="alert">{timeError}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="event-desc" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Descrição
        </label>
        <Textarea
          id="event-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detalhes do evento (opcional)"
          className="min-h-[60px] text-sm resize-none"
          rows={2}
        />
      </div>

      {/* Attendees */}
      <div className="space-y-1.5">
        <label htmlFor="event-attendees" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Convidados
        </label>
        <Textarea
          id="event-attendees"
          ref={(el) => {
            if (el) {
              el.style.height = 'auto';
              el.style.height = el.scrollHeight + 'px';
            }
          }}
          value={attendees}
          onChange={(e) => {
            setAttendees(e.target.value);
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = target.scrollHeight + 'px';
          }}
          placeholder="E-mails separados por vírgula"
          className="text-sm min-h-[36px] resize-none overflow-hidden"
          rows={1}
        />
      </div>
    </div>
  );

  const formFooter = (
    <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border">
      <Button
        variant="ghost"
        size="sm"
        className="h-9 px-4"
        onClick={() => { setIsEditing(false); onClose(); }}
      >
        Cancelar
      </Button>
      <Button
        size="sm"
        className="h-9 px-5"
        onClick={isEditMode ? handleUpdate : handleCreate}
        disabled={isSubmitting || !title.trim() || !!timeError}
      >
        {isSubmitting ? 'Salvando...' : 'Salvar'}
      </Button>
    </div>
  );

  // Mobile: Drawer for create/edit
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => { if (!o) { setIsEditing(false); onClose(); } }}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerTitle className="sr-only">
            {isEditMode ? 'Editar Evento' : 'Novo Evento'}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            {isEditMode ? 'Altere os dados do evento' : 'Crie um novo evento'}
          </DrawerDescription>
          {formContent}
          {formFooter}
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Dialog — use default padding (no p-0)
  return (
    <Dialog open={open} onOpenChange={() => { setIsEditing(false); onClose(); }}>
      <DialogContent className="sm:max-w-[460px] gap-0 p-0 overflow-hidden" aria-describedby="event-form-desc">
        <DialogTitle className="sr-only">
          {isEditMode ? 'Editar Evento' : 'Novo Evento'}
        </DialogTitle>
        <DialogDescription id="event-form-desc" className="sr-only">
          {isEditMode ? 'Altere os dados do evento' : 'Crie um novo evento no calendário'}
        </DialogDescription>
        <div className="overflow-y-auto max-h-[70vh]">
          {formContent}
        </div>
        {formFooter}
      </DialogContent>
    </Dialog>
  );
}
