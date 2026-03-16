import { useState, useCallback } from 'react';
import { useCtrlEnter } from '@/hooks/useCtrlEnter';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
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
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { MessageSquare, Send, CalendarClock, Mic, MicOff } from 'lucide-react';

interface ObservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (observation: string, nextActionAt?: Date) => void;
  statusName: string;
}

export const ObservationDialog = ({
  open,
  onOpenChange,
  onConfirm,
  statusName,
}: ObservationDialogProps) => {
  const [observation, setObservation] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [nextTime, setNextTime] = useState('');

  const handleSpeechResult = useCallback((text: string) => {
    setObservation(prev => prev ? `${prev} ${text}` : text);
  }, []);

  const { isRecording, isSupported, toggle: toggleRecording } = useSpeechRecognition({
    onResult: handleSpeechResult,
  });

  useCtrlEnter(() => handleConfirm(), open);

  const buildNextActionAt = (): Date | undefined => {
    if (!nextDate) return undefined;
    const time = nextTime || '09:00';
    return new Date(`${nextDate}T${time}:00`);
  };

  const handleConfirm = () => {
    onConfirm(observation.trim(), buildNextActionAt());
    setObservation('');
    setNextDate('');
    setNextTime('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setObservation('');
    setNextDate('');
    setNextTime('');
    onOpenChange(false);
  };

  // Min date = today
  const today = new Date().toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Registrar Observação
          </DialogTitle>
          <DialogDescription>
            Adicione uma observação ao alterar o status para "{statusName}"
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Reschedule next action */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              Reagendar próxima ação (opcional)
            </Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                min={today}
                className="flex-1 h-9 bg-background"
                placeholder="Data"
              />
              <Input
                type="time"
                value={nextTime}
                onChange={(e) => setNextTime(e.target.value)}
                className="w-28 h-9 bg-background"
                placeholder="Hora"
              />
            </div>
          </div>

          {/* Observation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="observation">Observação (opcional)</Label>
              {isSupported && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleRecording}
                      className={`inline-flex items-center justify-center rounded-md p-1.5 transition-colors ${
                        isRecording
                          ? 'bg-destructive text-destructive-foreground animate-pulse'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{isRecording ? 'Parar gravação' : 'Ditar observação'}</TooltipContent>
                </Tooltip>
              )}
            </div>
            <Textarea
              id="observation"
              placeholder="Ex: Deixei recado com a secretária, ligar novamente às 15h..."
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              className="min-h-[120px] bg-background"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            <Send className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
