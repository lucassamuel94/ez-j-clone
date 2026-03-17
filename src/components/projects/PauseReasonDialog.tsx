import { memo, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

type TransitionType = 'pause' | 'cancel';

const PAUSE_REASONS = [
  'Cliente não retornou',
  'Pendência técnica interna',
  'Decisão comercial',
  'Outro',
] as const;

const CANCEL_REASONS = [
  'Cliente desistiu',
  'Restrição de orçamento',
  'Fora do escopo',
  'Outro',
] as const;

interface PauseReasonDialogProps {
  open: boolean;
  type: TransitionType;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const PauseReasonDialog = memo(function PauseReasonDialog({
  open,
  type,
  onConfirm,
  onCancel,
}: PauseReasonDialogProps) {
  const [selected, setSelected] = useState('');
  const [customReason, setCustomReason] = useState('');

  const reasons = type === 'pause' ? PAUSE_REASONS : CANCEL_REASONS;
  const title = type === 'pause' ? 'Motivo da pausa' : 'Motivo do cancelamento';
  const description =
    type === 'pause'
      ? 'Informe o motivo para pausar este projeto.'
      : 'Informe o motivo para cancelar este projeto.';

  const isOther = selected === 'Outro';
  const finalReason = isOther ? customReason.trim() : selected;
  const canConfirm = finalReason.length > 0;

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;
    onConfirm(finalReason);
    setSelected('');
    setCustomReason('');
  }, [canConfirm, finalReason, onConfirm]);

  const handleCancel = useCallback(() => {
    setSelected('');
    setCustomReason('');
    onCancel();
  }, [onCancel]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um motivo" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isOther && (
            <div className="space-y-2">
              <Label>Descreva o motivo</Label>
              <Textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Descreva o motivo..."
                className="min-h-[80px]"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export { PauseReasonDialog };
export type { TransitionType };
