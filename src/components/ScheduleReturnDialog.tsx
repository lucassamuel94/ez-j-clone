import { useState, useEffect, useCallback } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarIcon, Clock, Send, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export interface ScheduleReturnData {
  date: Date;
  time: string;
  observation: string;
}

interface ConflictInfo {
  hasConflict: boolean;
  conflictCompany: string;
  conflictName: string;
  suggestedTime: string;
}

interface ScheduleReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: ScheduleReturnData) => void;
}

export const ScheduleReturnDialog = ({
  open,
  onOpenChange,
  onConfirm,
}: ScheduleReturnDialogProps) => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [time, setTime] = useState('09:00');
  const [observation, setObservation] = useState('');
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);

  const checkConflict = useCallback(async (selectedDate: Date | undefined, selectedTime: string) => {
    if (!selectedDate || !selectedTime) {
      setConflict(null);
      return;
    }

    setCheckingConflict(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [hours, minutes] = selectedTime.split(':').map(Number);
      const targetDatetime = new Date(selectedDate);
      targetDatetime.setHours(hours, minutes, 0, 0);

      // Check ±9 minutes window
      const startWindow = new Date(targetDatetime.getTime() - 9 * 60 * 1000);
      const endWindow = new Date(targetDatetime.getTime() + 9 * 60 * 1000);

      const { data: existingLeads } = await supabase
        .from('leads')
        .select('id, company, name, next_action_at')
        .eq('owner_user_id', user.id)
        .gte('next_action_at', startWindow.toISOString())
        .lte('next_action_at', endWindow.toISOString())
        .in('status', ['Agendar retorno', 'Interesse/Agendar Retorno', 'Reagendar Reunião'])
        .limit(1);

      if (existingLeads && existingLeads.length > 0) {
        const existing = existingLeads[0];
        const existingDt = new Date(existing.next_action_at);
        const suggestedDt = new Date(existingDt.getTime() + 10 * 60 * 1000);
        const suggestedTimeStr = `${String(suggestedDt.getHours()).padStart(2, '0')}:${String(suggestedDt.getMinutes()).padStart(2, '0')}`;

        setConflict({
          hasConflict: true,
          conflictCompany: existing.company,
          conflictName: existing.name,
          suggestedTime: suggestedTimeStr,
        });
      } else {
        setConflict(null);
      }
    } catch (err) {
      console.error('Error checking return conflict:', err);
      setConflict(null);
    } finally {
      setCheckingConflict(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      checkConflict(date, time);
    }
  }, [date, time, open, checkConflict]);

  const handleAcceptSuggestion = () => {
    if (conflict?.suggestedTime) {
      setTime(conflict.suggestedTime);
    }
  };

  const handleConfirm = () => {
    if (!date) return;
    
    onConfirm({
      date,
      time,
      observation: observation.trim(),
    });
    
    // Reset form
    setDate(undefined);
    setCalendarOpen(false);
    setTime('09:00');
    setObservation('');
    setConflict(null);
    onOpenChange(false);
  };

  const handleClose = () => {
    setDate(undefined);
    setCalendarOpen(false);
    setTime('09:00');
    setObservation('');
    setConflict(null);
    onOpenChange(false);
  };

  const isValid = date !== undefined;

  useCtrlEnter(() => handleConfirm(), open && isValid);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Agendar Retorno
          </DialogTitle>
          <DialogDescription>
            Defina a data e hora para retornar contato com este lead
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Data do Retorno *</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal bg-background',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(selectedDate) => {
                    setDate(selectedDate);
                    setCalendarOpen(false);
                  }}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Picker */}
          <div className="space-y-2">
            <Label htmlFor="time">Horário *</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="bg-background"
            />
          </div>

          {/* Conflict Warning */}
          {checkingConflict && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Verificando disponibilidade...
            </div>
          )}
          {conflict?.hasConflict && (
            <Alert variant="destructive" className="border-warning/30 bg-warning/5">
              <AlertTriangle className="h-4 w-4 !text-warning" />
              <AlertDescription className="text-sm text-foreground">
                <p className="font-medium mb-1">Conflito de horário!</p>
                <p className="text-xs mb-2">
                  Você já possui um retorno agendado com <strong>{conflict.conflictCompany}</strong> ({conflict.conflictName}) neste horário.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAcceptSuggestion}
                  className="h-7 text-xs border-warning/30 text-warning hover:bg-warning/10"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  Agendar para {conflict.suggestedTime}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Observation */}
          <div className="space-y-2">
            <Label htmlFor="observation">Observação (opcional)</Label>
            <Textarea
              id="observation"
              placeholder="Ex: Ligar após reunião de diretoria, perguntar sobre orçamento..."
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              className="min-h-[100px] bg-background"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid}>
            <Send className="h-4 w-4 mr-2" />
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
