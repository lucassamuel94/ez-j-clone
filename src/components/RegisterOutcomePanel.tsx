import { useState, useCallback } from 'react';
import { Lead, LeadStatus } from '@/types/lead';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Phone, MessageSquare, Video, MoreHorizontal, Check, X, ThumbsUp, ThumbsDown, Calendar, Loader2, Mic, MicOff } from 'lucide-react';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface RegisterOutcomePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onSubmit: (data: OutcomeData) => Promise<void>;
}

export interface OutcomeData {
  contactType: 'call' | 'whatsapp' | 'meeting' | 'other';
  result: 'conectou' | 'nao_atendeu' | 'interesse' | 'sem_interesse' | 'reagendado';
  nextActionDate: string;
  nextActionTime: string;
  observation: string;
}

const CONTACT_TYPES = [
  { key: 'call', label: 'Ligação', icon: <Phone className="h-4 w-4" /> },
  { key: 'whatsapp', label: 'WhatsApp', icon: <WhatsAppIcon size={16} /> },
  { key: 'meeting', label: 'Reunião', icon: <Video className="h-4 w-4" /> },
  { key: 'other', label: 'Outro', icon: <MoreHorizontal className="h-4 w-4" /> },
] as const;

const RESULTS = [
  { key: 'conectou', label: 'Conectou', icon: <Check className="h-4 w-4" /> },
  { key: 'nao_atendeu', label: 'Não atendeu', icon: <X className="h-4 w-4" /> },
  { key: 'interesse', label: 'Interesse', icon: <ThumbsUp className="h-4 w-4" /> },
  { key: 'sem_interesse', label: 'Sem interesse', icon: <ThumbsDown className="h-4 w-4" /> },
  { key: 'reagendado', label: 'Reagendado', icon: <Calendar className="h-4 w-4" /> },
] as const;

// Statuses where next action is NOT required
const SKIP_NEXT_ACTION_STATUSES: LeadStatus[] = ['Descartado', 'Oportunidade criada'];

export const RegisterOutcomePanel = ({ open, onOpenChange, lead, onSubmit }: RegisterOutcomePanelProps) => {
  const [contactType, setContactType] = useState<OutcomeData['contactType'] | null>(null);
  const [result, setResult] = useState<OutcomeData['result'] | null>(null);
  const [nextActionDate, setNextActionDate] = useState('');
  const [nextActionTime, setNextActionTime] = useState('09:00');
  const [observation, setObservation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSpeechResult = useCallback((text: string) => {
    setObservation(prev => prev ? `${prev} ${text}` : text);
  }, []);

  const { isRecording, isSupported, toggle: toggleRecording } = useSpeechRecognition({
    onResult: handleSpeechResult,
  });

  const skipNextAction = SKIP_NEXT_ACTION_STATUSES.includes(lead.status);
  const nextActionOptional = result === 'interesse';
  const isValid = contactType && result && (skipNextAction || nextActionOptional || nextActionDate);

  const handleSubmit = async () => {
    if (!isValid || !contactType || !result) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        contactType,
        result,
        nextActionDate,
        nextActionTime,
        observation,
      });
      // Reset
      setContactType(null);
      setResult(null);
      setNextActionDate('');
      setNextActionTime('09:00');
      setObservation('');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setContactType(null);
    setResult(null);
    setNextActionDate('');
    setNextActionTime('09:00');
    setObservation('');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Registrar Resultado</SheetTitle>
          <SheetDescription>Registre o resultado do contato com {lead.company}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-auto space-y-5 mt-4">
          {/* Contact Type */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tipo de contato</Label>
            <div className="grid grid-cols-2 gap-2">
              {CONTACT_TYPES.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setContactType(key)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-md border text-sm font-medium transition-all",
                    contactType === key
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Result */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resultado</Label>
            <div className="grid grid-cols-2 gap-2">
              {RESULTS.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setResult(key)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-md border text-sm font-medium transition-all",
                    result === key
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Next Action */}
          {!skipNextAction && (
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Próxima ação {!nextActionOptional && <span className="text-destructive">*</span>}
              </Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={nextActionDate}
                  onChange={(e) => setNextActionDate(e.target.value)}
                  className="flex-1 text-sm"
                  min={new Date().toISOString().split('T')[0]}
                />
                <Input
                  type="time"
                  value={nextActionTime}
                  onChange={(e) => setNextActionTime(e.target.value)}
                  className="w-28 text-sm"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {nextActionOptional ? 'Opcional para resultado "Interesse"' : 'Obrigatório exceto para leads Perdidos ou SQO'}
              </p>
            </div>
          )}

          {/* Observation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Observação</Label>
              {isSupported && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleRecording}
                      className={`inline-flex items-center justify-center rounded-md p-1 transition-colors ${
                        isRecording
                          ? 'bg-destructive text-destructive-foreground animate-pulse'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{isRecording ? 'Parar gravação' : 'Ditar observação'}</TooltipContent>
                </Tooltip>
              )}
            </div>
            <Textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Detalhes do contato..."
              className="min-h-[80px] text-sm resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            Limpar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Registrar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
