import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Plus, Trash2, Clock, Mail, Loader2, GripVertical } from 'lucide-react';
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

export function SequenceStepEditor({ sequenceId }: SequenceStepEditorProps) {
  const { steps, isLoading, upsertStep, deleteStep } = useSequenceSteps(sequenceId);
  const [editingStep, setEditingStep] = useState<Partial<EmailSequenceStep> | null>(null);
  const editorRef = useRef<any>(null);

  const handleAddStep = useCallback(() => {
    const nextNumber = steps.length > 0 ? Math.max(...steps.map(s => s.step_number)) + 1 : 1;
    setEditingStep({
      sequence_id: sequenceId,
      step_number: nextNumber,
      delay_hours: nextNumber === 1 ? 0 : 24,
      subject: '',
      body: '',
    });
  }, [steps, sequenceId]);

  const handleSaveStep = useCallback(async () => {
    if (!editingStep?.subject || !editingStep?.body) {
      toast.error('Preencha assunto e corpo do e-mail');
      return;
    }
    try {
      await upsertStep.mutateAsync({
        id: (editingStep as any).id,
        sequence_id: editingStep.sequence_id!,
        step_number: editingStep.step_number!,
        delay_hours: editingStep.delay_hours!,
        subject: editingStep.subject!,
        body: editingStep.body!,
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
          <div key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
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
                            ? `${Math.floor(step.delay_hours / 24)}d ${step.delay_hours % 24 > 0 ? `${step.delay_hours % 24}h` : ''}`
                            : `${step.delay_hours}h`}
                        </Badge>
                      )}
                      {step.step_number === 1 && step.delay_hours === 0 && (
                        <Badge variant="outline" className="text-[10px] h-5 shrink-0 border-success/20 text-success bg-success/10">
                          Imediato
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
                      onClick={() => setEditingStep(step)}
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Delay (horas)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editingStep.delay_hours}
                  onChange={e => setEditingStep(prev => prev ? { ...prev, delay_hours: parseInt(e.target.value) || 0 } : null)}
                  placeholder="Ex: 24"
                />
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

            <div>
              <Label>Corpo do e-mail</Label>
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
