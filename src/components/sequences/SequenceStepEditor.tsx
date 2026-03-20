import { useState, useRef, useCallback, Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, Clock, Mail, Loader2, GripVertical, Sparkles, Info, Timer } from 'lucide-react';
import { EmailSequenceStep, useSequenceSteps } from '@/hooks/useEmailSequences';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SequenceStepEditorProps {
  sequenceId: string;
}

const VARIABLES = [
  { var: '{{nome_contato}}', desc: 'Nome do contato' },
  { var: '{{empresa}}', desc: 'Empresa' },
];

type DelayUnit = 'minutes' | 'hours' | 'days';

function hoursToUnit(totalHours: number): { value: number; unit: DelayUnit } {
  if (totalHours === 0) return { value: 0, unit: 'hours' };
  if (totalHours >= 24 && totalHours % 24 === 0) return { value: totalHours / 24, unit: 'days' };
  if (totalHours < 1) return { value: Math.round(totalHours * 60), unit: 'minutes' };
  return { value: totalHours, unit: 'hours' };
}

function unitToHours(value: number, unit: DelayUnit): number {
  if (unit === 'minutes') return value / 60;
  if (unit === 'days') return value * 24;
  return value;
}

export function SequenceStepEditor({ sequenceId }: SequenceStepEditorProps) {
  const { steps, isLoading, upsertStep, deleteStep } = useSequenceSteps(sequenceId);
  const [editingStep, setEditingStep] = useState<Partial<EmailSequenceStep> | null>(null);
  const [delayValue, setDelayValue] = useState(0);
  const [delayUnit, setDelayUnit] = useState<DelayUnit>('hours');
  const [inlineDelay, setInlineDelay] = useState<{ stepId: string; value: number; unit: DelayUnit } | null>(null);
  const editorRef = useRef<any>(null);

  const handleInlineDelayUpdate = useCallback(async (stepId: string, value: number, unit: DelayUnit) => {
    const hours = unitToHours(value, unit);
    const step = steps.find(s => s.id === stepId);
    if (!step) return;
    try {
      await upsertStep.mutateAsync({
        id: stepId,
        sequence_id: step.sequence_id,
        step_number: step.step_number,
        delay_hours: hours,
        subject: step.subject,
        body: step.body,
        ai_personalize: step.ai_personalize,
      });
      toast.success('Delay atualizado');
      setInlineDelay(null);
    } catch {
      toast.error('Erro ao atualizar delay');
    }
  }, [steps, upsertStep]);

  const handleAddStep = useCallback(() => {
    const nextNumber = steps.length > 0 ? Math.max(...steps.map(s => s.step_number)) + 1 : 1;
    const defaultHours = nextNumber === 1 ? 0 : 24;
    const { value, unit } = hoursToUnit(defaultHours);
    setDelayValue(value);
    setDelayUnit(unit);
    setEditingStep({
      sequence_id: sequenceId,
      step_number: nextNumber,
      delay_hours: defaultHours,
      subject: '',
      body: '',
      ai_personalize: false,
    });
  }, [steps, sequenceId]);

  const handleSaveStep = useCallback(async () => {
    if (!editingStep?.subject || !editingStep?.body) {
      toast.error('Preencha assunto e corpo do e-mail');
      return;
    }
    try {
      const delayInHours = unitToHours(delayValue, delayUnit);
      await upsertStep.mutateAsync({
        id: (editingStep as any).id,
        sequence_id: editingStep.sequence_id!,
        step_number: editingStep.step_number!,
        delay_hours: delayInHours,
        subject: editingStep.subject!,
        body: editingStep.body!,
        ai_personalize: editingStep.ai_personalize ?? false,
      });
      toast.success('Step salvo');
      setEditingStep(null);
    } catch {
      toast.error('Erro ao salvar step');
    }
  }, [editingStep, upsertStep]);

  const handleDeleteStep = useCallback(async (stepId: string) => {
    try {
      await deleteStep.mutateAsync(stepId);
      toast.success('Step removido');
    } catch {
      toast.error('Erro ao remover step');
    }
  }, [deleteStep]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timeline view */}
      <div className="relative">
        {steps.map((step, idx) => (
          <Fragment key={step.id}>
          {/* Delay button between steps */}
          {idx > 0 && (
            <div className="relative flex items-center gap-4 py-1">
              <div className="relative z-10 flex-shrink-0">
                <div className="w-[34px] flex items-center justify-center">
                  <div className="w-px h-4 bg-border" />
                </div>
              </div>
              <div className="flex-1 flex items-center">
                <div className="flex-1 h-px bg-border/50" />
                <Popover
                  open={inlineDelay?.stepId === step.id}
                  onOpenChange={(open) => {
                    if (open) {
                      const { value, unit } = hoursToUnit(step.delay_hours);
                      setInlineDelay({ stepId: step.id, value, unit });
                    } else {
                      setInlineDelay(null);
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-dashed border-primary/30 bg-background hover:bg-primary/5 hover:border-primary/50 transition-all text-[11px] text-muted-foreground hover:text-primary mx-2 shrink-0">
                      <Timer className="h-3 w-3" />
                      {step.delay_hours > 0
                        ? step.delay_hours >= 24
                          ? `${Math.floor(step.delay_hours / 24)}d${step.delay_hours % 24 > 0 ? ` ${step.delay_hours % 24}h` : ''}`
                          : step.delay_hours < 1
                            ? `${Math.round(step.delay_hours * 60)}min`
                            : `${step.delay_hours}h`
                        : 'Sem delay'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[260px] p-3" align="center">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Delay antes do Step {step.step_number}</p>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          value={inlineDelay?.value ?? 0}
                          onChange={e => setInlineDelay(prev => prev ? { ...prev, value: parseInt(e.target.value) || 0 } : null)}
                          className="h-8 w-20 text-sm"
                        />
                        <Select
                          value={inlineDelay?.unit ?? 'hours'}
                          onValueChange={val => setInlineDelay(prev => prev ? { ...prev, unit: val as DelayUnit } : null)}
                        >
                          <SelectTrigger className="h-8 flex-1 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minutes">Minutos</SelectItem>
                            <SelectItem value="hours">Horas</SelectItem>
                            <SelectItem value="days">Dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        size="sm"
                        className="w-full h-7 text-xs"
                        disabled={upsertStep.isPending}
                        onClick={() => {
                          if (inlineDelay) handleInlineDelayUpdate(inlineDelay.stepId, inlineDelay.value, inlineDelay.unit);
                        }}
                      >
                        {upsertStep.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Salvar
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="flex-1 h-px bg-border/50" />
              </div>
            </div>
          )}
          <div className="relative flex gap-4 pb-2">
            {/* Timeline line */}
            {idx < steps.length - 1 && (
              <div className="absolute left-[17px] top-10 bottom-0 w-px bg-border" />
            )}
            {/* Timeline dot */}
            <div className="relative z-10 flex-shrink-0 mt-1">
              <div className={cn(
                "w-[34px] h-[34px] rounded-full flex items-center justify-center border-2",
                "bg-primary/10 border-primary text-primary"
              )}>
                <Mail className="h-4 w-4" />
              </div>
            </div>
            {/* Step card */}
            <Card className="flex-1 border border-border shadow-xs hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
                        Step {step.step_number}
                      </Badge>
                      {step.delay_hours > 0 && (
                        <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                          <Clock className="h-3 w-3 mr-0.5" />
                          {step.delay_hours >= 24
                            ? `${Math.floor(step.delay_hours / 24)}d${step.delay_hours % 24 > 0 ? ` ${step.delay_hours % 24}h` : ''}`
                            : step.delay_hours < 1
                              ? `${Math.round(step.delay_hours * 60)}min`
                              : `${step.delay_hours}h`}
                        </Badge>
                      )}
                      {step.step_number === 1 && step.delay_hours === 0 && (
                        <Badge variant="outline" className="text-[10px] h-5 shrink-0 border-success/20 text-success bg-success/10">
                          Imediato
                        </Badge>
                      )}
                      {step.ai_personalize && (
                        <Badge variant="outline" className="text-[10px] h-5 shrink-0 border-primary/30 text-primary bg-primary/10">
                          <Sparkles className="h-3 w-3 mr-0.5" />
                          IA
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium text-sm">{step.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {step.body.replace(/<[^>]*>/g, '')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        const { value, unit } = hoursToUnit(step.delay_hours);
                        setDelayValue(value);
                        setDelayUnit(unit);
                        setEditingStep(step);
                      }}
                    >
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteStep(step.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          </Fragment>
        ))}
      </div>

      {/* Editing form */}
      {editingStep && (
        <Card className="border-primary/30 shadow-md">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="default" className="text-xs">
                Step {editingStep.step_number}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {editingStep.step_number === 1 ? 'Primeiro e-mail da sequência' : 'Próximo e-mail'}
              </span>
            </div>

            <div className="grid grid-cols-[1fr_120px_1fr] gap-3">
              <div>
                <Label>Delay</Label>
                <Input
                  type="number"
                  min={0}
                  value={delayValue}
                  onChange={e => setDelayValue(parseInt(e.target.value) || 0)}
                  placeholder="Ex: 24"
                />
              </div>
              <div>
                <Label>Unidade</Label>
                <Select value={delayUnit} onValueChange={val => setDelayUnit(val as DelayUnit)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutos</SelectItem>
                    <SelectItem value="hours">Horas</SelectItem>
                    <SelectItem value="days">Dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assunto</Label>
                <Input
                  value={editingStep.subject}
                  onChange={e => setEditingStep(prev => prev ? { ...prev, subject: e.target.value } : null)}
                  placeholder="Ex: {{empresa}} - Follow-up"
                />
              </div>
            </div>

            {/* Variables */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium">Variáveis:</span>
              {VARIABLES.map(v => (
                <button
                  key={v.var}
                  type="button"
                  className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 text-primary px-1.5 py-0.5 font-mono text-[11px] hover:bg-primary/20 transition-colors cursor-pointer"
                  title={v.desc}
                  onClick={() => {
                    if (editorRef.current) {
                      editorRef.current.chain().focus().insertContent(v.var).run();
                    }
                  }}
                >
                  {v.var}
                </button>
              ))}
            </div>

            {/* AI Personalization Toggle */}
            <TooltipProvider>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Sparkles className={cn("h-4 w-4", editingStep.ai_personalize ? "text-primary" : "text-muted-foreground")} />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">Personalizar com IA</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">A IA gera o conteúdo personalizado com base no segmento CNAE do cliente. O texto abaixo serve como diretriz.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {editingStep.ai_personalize
                        ? 'O corpo abaixo será usado como diretriz — a IA gera o e-mail final'
                        : 'E-mail será enviado exatamente como escrito'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={editingStep.ai_personalize || false}
                  onCheckedChange={val => setEditingStep(prev => prev ? { ...prev, ai_personalize: val } : null)}
                />
              </div>
            </TooltipProvider>

            <div>
              <Label>{editingStep.ai_personalize ? 'Diretriz para a IA' : 'Corpo do e-mail'}</Label>
              <RichTextEditor
                content={editingStep.body || ''}
                onChange={val => setEditingStep(prev => prev ? { ...prev, body: val } : null)}
                placeholder="Olá {{nome_contato}}, ..."
                editorRef={editorRef}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditingStep(null)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSaveStep} disabled={upsertStep.isPending}>
                {upsertStep.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar Step
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add step button */}
      {!editingStep && (
        <Button variant="outline" className="w-full gap-2 border-dashed" onClick={handleAddStep}>
          <Plus className="h-4 w-4" />
          Adicionar Step
        </Button>
      )}
    </div>
  );
}
