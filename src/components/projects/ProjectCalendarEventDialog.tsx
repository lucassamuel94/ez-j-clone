import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CalendarPlus, Clock, Mail, FileText, Calendar as CalendarIcon } from 'lucide-react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ProjectCalendarEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectData?: {
    contact_email?: string | null;
    contact_name?: string | null;
    company_name?: string;
  };
  onCreated?: (details?: { title: string; date: string; startTime: string; endTime: string; attendee?: string; meetLink?: string }) => void;
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
});

export function ProjectCalendarEventDialog({ open, onOpenChange, projectData, onCreated }: ProjectCalendarEventDialogProps) {
  const { isConnected, createEvent, connect, isConnecting } = useGoogleCalendar();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(projectData?.company_name ? `Reunião - ${projectData.company_name}` : '');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [description, setDescription] = useState('');
  const [attendeeEmail, setAttendeeEmail] = useState(projectData?.contact_email || '');
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTitle(projectData?.company_name ? `Reunião - ${projectData.company_name}` : '');
      setSelectedDate(undefined);
      setStartTime('09:00');
      setEndTime('10:00');
      setDescription('');
      setAttendeeEmail(projectData?.contact_email || '');
    }
  }, [open, projectData]);

  // Auto-update endTime when startTime changes
  useEffect(() => {
    const [h, m] = startTime.split(':').map(Number);
    const endH = (h + 1) % 24;
    setEndTime(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }, [startTime]);

  const formattedDate = useMemo(() => {
    if (!selectedDate) return '';
    return format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR });
  }, [selectedDate]);

  const dateISO = useMemo(() => {
    if (!selectedDate) return '';
    return format(selectedDate, 'yyyy-MM-dd');
  }, [selectedDate]);

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleCreate = async () => {
    if (!title || !selectedDate || !startTime || !endTime) {
      toast.error(`Preencha: ${!title ? 'título' : ''} ${!selectedDate ? 'data' : ''} ${!startTime ? 'início' : ''} ${!endTime ? 'fim' : ''}`);
      return;
    }

    // Parse and validate multiple emails
    const parsedEmails = attendeeEmail
      .split(/[;,]/)
      .map((e) => e.trim())
      .filter(Boolean);

    const invalidEmails = parsedEmails.filter((e) => !EMAIL_REGEX.test(e));
    if (invalidEmails.length > 0) {
      toast.error(`E-mail inválido: ${invalidEmails[0]}`);
      return;
    }

    setLoading(true);
    try {
      const startDateTime = `${dateISO}T${startTime}:00`;
      const endDateTime = `${dateISO}T${endTime}:00`;
      const attendees = parsedEmails.map((email) => ({ email }));

      const result = await createEvent({
        summary: title,
        description,
        start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
        attendees,
      });

      const meetLink = result?.hangoutLink || result?.conferenceData?.entryPoints?.[0]?.uri || undefined;

      toast.success('Evento criado no Google Calendar!');
      onCreated?.({ title, date: formattedDate, startTime, endTime, attendee: parsedEmails.join(', ') || undefined, meetLink });
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar evento';
      toast.error(message.includes('Invalid') ? 'E-mail de convidado inválido' : `Erro: ${message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0">
        {/* Header — Linear style */}
        <DialogHeader className="px-5 pt-5 pb-0">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 shrink-0">
              <CalendarPlus className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold tracking-tight">
                Novo Evento
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                {projectData?.company_name
                  ? `Projeto: ${projectData.company_name}`
                  : 'Agende uma reunião ou evento'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator className="mt-4" />

        {!isConnected ? (
          <div className="py-12 px-5 text-center space-y-4">
            <div className="flex items-center justify-center h-11 w-11 rounded-full bg-muted/60 mx-auto">
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Google Calendar não conectado</p>
              <p className="text-xs text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
                Conecte seu Google Calendar para criar eventos diretamente pela plataforma.
              </p>
            </div>
            <Button onClick={connect} disabled={isConnecting} size="sm" className="mt-1">
              {isConnecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Conectar Google Calendar
            </Button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-5">
            {/* Título */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3 w-3" />
                Título
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Reunião - ${projectData?.company_name || 'Projeto'}`}
                className="h-9 text-sm placeholder:text-muted-foreground/40"
                autoFocus
              />
            </div>

            {/* Data — Calendar Popover */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <CalendarIcon className="h-3 w-3" />
                Data
              </Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full h-9 justify-start text-left font-normal text-sm',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    {selectedDate ? formattedDate : 'Selecione a data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date: Date | undefined) => {
                      if (date) {
                        setSelectedDate(date);
                        setCalendarOpen(false);
                      }
                    }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Horários — Select dropdowns */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Início
                </Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t} className="text-sm">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Fim
                </Label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t} className="text-sm">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* E-mail do convidado */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                Convidado
                <span className="normal-case tracking-normal font-normal text-muted-foreground/60">(opcional)</span>
              </Label>
              <Input
                value={attendeeEmail}
                onChange={(e) => setAttendeeEmail(e.target.value)}
                placeholder="email@exemplo.com (separe com ; ou ,)"
                className="h-9 text-sm placeholder:text-muted-foreground/40"
              />
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3 w-3" />
                Descrição
                <span className="normal-case tracking-normal font-normal text-muted-foreground/60">(opcional)</span>
              </Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes do evento..."
                className="text-sm min-h-[72px] resize-none placeholder:text-muted-foreground/40"
                rows={3}
              />
            </div>
          </div>
        )}

        {isConnected && (
          <>
            <Separator />
            <DialogFooter className="px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
                )}
                Criar Evento
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
