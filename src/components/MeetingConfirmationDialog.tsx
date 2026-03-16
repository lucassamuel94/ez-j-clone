import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCtrlEnter } from '@/hooks/useCtrlEnter';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarIcon, CheckCircle, Clock, User, Bell, Loader2, Mail, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';

export interface MeetingData {
  executiveName: string;
  executiveUserId: string;
  meetingDate: Date;
  meetingTime: string;
  meetingTitle: string;
  reminderMinutesBefore: number;
  inviteEmails: string[];
}

interface CloserUser {
  id: string;
  name: string;
  email: string | null;
}

const TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const MEETING_DURATION_MS = 60 * 60 * 1000; // 1 hour

const useCloserUsers = () => {
  return useQuery({
    queryKey: ['closer-users'],
    queryFn: async (): Promise<CloserUser[]> => {
      const { data: closerRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'closer');

      if (rolesError) throw rolesError;
      if (!closerRoles?.length) return [];

      const closerUserIds = closerRoles.map(r => r.user_id);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', closerUserIds)
        .eq('active', true);

      if (profilesError) throw profilesError;
      return profiles || [];
    },
  });
};

interface MeetingOnDate {
  user_id: string;
  meeting_datetime: string;
}

const useMeetingsOnDate = (date: Date | undefined) => {
  const dateStr = date ? format(date, 'yyyy-MM-dd') : null;
  return useQuery({
    queryKey: ['meetings-on-date', dateStr],
    enabled: !!dateStr,
    queryFn: async (): Promise<MeetingOnDate[]> => {
      if (!dateStr) return [];
      const startOfDay = `${dateStr}T00:00:00`;
      const endOfDay = `${dateStr}T23:59:59`;

      const { data, error } = await supabase
        .from('meetings')
        .select('user_id, meeting_datetime')
        .gte('meeting_datetime', startOfDay)
        .lte('meeting_datetime', endOfDay);

      if (error) throw error;
      return (data || []).filter(m => m.user_id !== null) as MeetingOnDate[];
    },
  });
};

interface MeetingConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: MeetingData) => void;
  companyName: string;
  contactEmail?: string;
}

export const MeetingConfirmationDialog = ({
  open,
  onOpenChange,
  onConfirm,
  companyName,
  contactEmail,
}: MeetingConfirmationDialogProps) => {
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(undefined);
  const [meetingTime, setMeetingTime] = useState('');
  const [selectedCloserId, setSelectedCloserId] = useState('');
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number>(60);
  const [contactEmailEnabled, setContactEmailEnabled] = useState(true);
  const [closerEmailEnabled, setCloserEmailEnabled] = useState(true);
  const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
  const [additionalEmailInput, setAdditionalEmailInput] = useState('');
  const [closerEmail, setCloserEmail] = useState('');

  const { data: closerUsers = [], isLoading: isLoadingClosers } = useCloserUsers();
  const { data: meetingsOnDate = [], isLoading: isLoadingMeetings } = useMeetingsOnDate(meetingDate);

  useEffect(() => {
    if (open && companyName) {
      setMeetingTitle(`Apresentação EZ Chat >> ${companyName}`);
    }
  }, [open, companyName]);

  // Reset closer when date or time changes (availability may differ)
  useEffect(() => {
    setSelectedCloserId('');
  }, [meetingDate, meetingTime]);

  // Build a map: for each time slot, which closers are busy
  const busyClosersBySlot = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    TIME_SLOTS.forEach(slot => { map[slot] = new Set(); });

    for (const meeting of meetingsOnDate) {
      if (!meeting.user_id) continue;
      const meetingStart = new Date(meeting.meeting_datetime).getTime();
      const meetingEnd = meetingStart + MEETING_DURATION_MS;

      for (const slot of TIME_SLOTS) {
        const [h, m] = slot.split(':').map(Number);
        const slotDate = meetingDate ? new Date(meetingDate) : new Date();
        slotDate.setHours(h, m, 0, 0);
        const slotStart = slotDate.getTime();
        const slotEnd = slotStart + MEETING_DURATION_MS;

        // Overlap check: meetings overlap if one starts before the other ends
        if (slotStart < meetingEnd && slotEnd > meetingStart) {
          map[slot].add(meeting.user_id);
        }
      }
    }
    return map;
  }, [meetingsOnDate, meetingDate]);

  // Available closers for the selected time slot
  const availableClosers = useMemo(() => {
    if (!meetingTime) return [];
    const busySet = busyClosersBySlot[meetingTime] || new Set();
    return closerUsers.filter(c => !busySet.has(c.id));
  }, [meetingTime, busyClosersBySlot, closerUsers]);

  // Count available closers per slot for display
  const availableCountBySlot = useMemo(() => {
    const map: Record<string, number> = {};
    TIME_SLOTS.forEach(slot => {
      const busySet = busyClosersBySlot[slot] || new Set();
      map[slot] = closerUsers.filter(c => !busySet.has(c.id)).length;
    });
    return map;
  }, [busyClosersBySlot, closerUsers]);

  const selectedCloser = closerUsers.find(u => u.id === selectedCloserId);

  // Auto-fill closer email when closer is selected
  useEffect(() => {
    if (selectedCloser?.email) {
      setCloserEmail(selectedCloser.email);
    } else {
      setCloserEmail('');
    }
  }, [selectedCloser]);

  const handleAddEmail = (emailStr: string) => {
    const email = emailStr.trim();
    if (email && email.includes('@') && !additionalEmails.includes(email)) {
      setAdditionalEmails(prev => [...prev, email]);
    }
  };

  const handleRemoveEmail = (email: string) => {
    setAdditionalEmails(prev => prev.filter(e => e !== email));
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddEmail(additionalEmailInput);
      setAdditionalEmailInput('');
    }
  };

  const handleConfirm = () => {
    if (selectedCloser && meetingDate && meetingTime) {
      const emails: string[] = [];
      if (contactEmailEnabled && contactEmail) emails.push(contactEmail);
      if (closerEmailEnabled && closerEmail) emails.push(closerEmail);
      emails.push(...additionalEmails);

      onConfirm({
        executiveName: selectedCloser.name,
        executiveUserId: selectedCloser.id,
        meetingDate,
        meetingTime,
        meetingTitle,
        reminderMinutesBefore,
        inviteEmails: [...new Set(emails)],
      });
      resetForm();
      onOpenChange(false);
    }
  };

  const resetForm = () => {
    setSelectedCloserId('');
    setMeetingDate(undefined);
    setMeetingTime('');
    setMeetingTitle('');
    setReminderMinutesBefore(60);
    setContactEmailEnabled(true);
    setCloserEmailEnabled(true);
    setCloserEmail('');
    setAdditionalEmails([]);
    setAdditionalEmailInput('');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const isFormValid = selectedCloserId && meetingDate && meetingTime;

  useCtrlEnter(() => handleConfirm(), open && !!isFormValid);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-chart-3" />
            Realizar agendamento
          </DialogTitle>
          <DialogDescription>
            Preencha os dados da reunião agendada com o cliente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1">
          {/* 1. Meeting Title */}
          <div className="space-y-2">
            <Label htmlFor="meetingTitle">Título da Reunião</Label>
            <Input
              id="meetingTitle"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              className="bg-background focus-visible:ring-offset-0 focus-visible:ring-1 focus-visible:ring-inset"
              placeholder="Apresentação EZ Chat >> Empresa"
            />
          </div>

          {/* 2. Date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Data *
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal bg-background focus-visible:ring-offset-0 focus-visible:ring-1 focus-visible:ring-inset',
                    !meetingDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {meetingDate
                    ? format(meetingDate, 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={meetingDate}
                  onSelect={setMeetingDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* 3. Time Slot Selection (only after date is selected) */}
          {meetingDate && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horário *
              </Label>
              {isLoadingMeetings || isLoadingClosers ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando disponibilidade...
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {TIME_SLOTS.map(slot => {
                    const available = availableCountBySlot[slot] || 0;
                    const isSelected = meetingTime === slot;
                    const hasAvailable = available > 0;
                    return (
                      <Button
                        key={slot}
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        disabled={!hasAvailable}
                        onClick={() => setMeetingTime(slot)}
                        className={cn(
                          'flex flex-col h-auto py-2 gap-0.5',
                          !hasAvailable && 'opacity-50',
                        )}
                      >
                        <span className="text-sm font-medium">{slot}</span>
                        <span className={cn(
                          'text-[10px]',
                          isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        )}>
                          {available} {available === 1 ? 'disponível' : 'disponíveis'}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 4. Available Closers (only after time is selected) */}
          {meetingDate && meetingTime && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Executivo Disponível *
              </Label>
              {availableClosers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum executivo disponível neste horário.</p>
              ) : (
                <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
                  <SelectTrigger className="bg-background focus:ring-offset-0 focus:ring-1 focus:ring-inset">
                    <SelectValue placeholder="Selecione o executivo" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {availableClosers.map((closer) => (
                      <SelectItem key={closer.id} value={closer.id}>
                        {closer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Email Invites */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              E-mails de convite
            </Label>

            {contactEmail && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={contactEmailEnabled}
                  onChange={(e) => setContactEmailEnabled(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-sm text-muted-foreground truncate flex-1">
                  Contato: <strong>{contactEmail}</strong>
                </span>
              </div>
            )}

            {closerEmail && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={closerEmailEnabled}
                  onChange={(e) => setCloserEmailEnabled(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-sm text-muted-foreground truncate flex-1">
                  Executivo: <strong>{closerEmail}</strong>
                </span>
              </div>
            )}

            {/* Additional Emails - Tag Input */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
                {additionalEmails.map(email => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground rounded-md px-2 py-0.5 text-xs"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail(email)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <Input
                placeholder="Digite um e-mail e pressione Enter"
                value={additionalEmailInput}
                onChange={(e) => setAdditionalEmailInput(e.target.value)}
                onKeyDown={handleEmailKeyDown}
                onBlur={() => {
                  if (additionalEmailInput.trim()) {
                    handleAddEmail(additionalEmailInput);
                    setAdditionalEmailInput('');
                  }
                }}
                className="bg-background focus-visible:ring-offset-0 focus-visible:ring-1 focus-visible:ring-inset text-sm"
              />
            </div>
          </div>

          {/* Reminder Time */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Lembrete antes da reunião
            </Label>
            <Select
              value={reminderMinutesBefore.toString()}
              onValueChange={(value) => setReminderMinutesBefore(parseInt(value))}
            >
              <SelectTrigger className="bg-background focus:ring-offset-0 focus:ring-1 focus:ring-inset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="0">Não lembrar</SelectItem>
                <SelectItem value="30">30 minutos antes</SelectItem>
                <SelectItem value="60">1 hora antes</SelectItem>
                <SelectItem value="120">2 horas antes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {isFormValid && selectedCloser && (
            <div className="bg-chart-3/10 border border-chart-3/30 rounded-lg p-3 mt-4">
              <p className="text-sm font-medium text-chart-3 mb-1">Resumo da Reunião</p>
              <p className="text-sm">{meetingTitle}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {format(meetingDate!, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })} às {meetingTime}
              </p>
              <p className="text-xs text-muted-foreground">
                Executivo: {selectedCloser.name}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                🔔 Lembrete: {reminderMinutesBefore === 30 ? '30 minutos' : reminderMinutesBefore === 60 ? '1 hora' : '2 horas'} antes
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isFormValid}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Confirmar Reunião
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
