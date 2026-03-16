import { useState, useEffect } from 'react';
import { useCtrlEnter } from '@/hooks/useCtrlEnter';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DeleteLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadCount: number;
  leadName?: string; // For single lead deletion
  onConfirm: () => void;
  isDeleting?: boolean;
  entityLabel?: string; // 'Lead' or 'Oportunidade'
}

export const DeleteLeadDialog = ({
  open,
  onOpenChange,
  leadCount,
  leadName,
  onConfirm,
  isDeleting = false,
  entityLabel = 'Lead',
}: DeleteLeadDialogProps) => {
  const [confirmText, setConfirmText] = useState('');
  const CONFIRM_WORD = 'DELETAR';
  
  const isConfirmed = confirmText === CONFIRM_WORD;
  const isSingleLead = leadCount === 1;

  useCtrlEnter(() => handleConfirm(), open && isConfirmed && !isDeleting);

  // Reset when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setConfirmText('');
    }
  }, [open]);

  const handleConfirm = () => {
    if (isConfirmed) {
      onConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <DialogTitle className="text-xl text-destructive">
            {isSingleLead ? `Excluir ${entityLabel}` : `Excluir ${leadCount} ${entityLabel}s`}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isSingleLead ? (
              <>
                Você está prestes a excluir permanentemente o {entityLabel.toLowerCase()}{' '}
                <strong className="text-foreground">{leadName}</strong>.
              </>
            ) : (
              <>
                Você está prestes a excluir permanentemente{' '}
                <strong className="text-foreground">{leadCount} {entityLabel.toLowerCase()}s</strong>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-destructive font-medium mb-2">
              ⚠️ Esta ação é irreversível!
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Todos os dados do lead serão removidos</li>
              <li>• Histórico de interações será perdido</li>
              <li>• Notas e observações serão excluídas</li>
              <li>• Reuniões agendadas serão canceladas</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-delete" className="text-sm">
              Digite <strong className="text-destructive">{CONFIRM_WORD}</strong> para confirmar:
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="Digite aqui..."
              className={
                confirmText.length > 0
                  ? isConfirmed
                    ? 'border-success focus-visible:ring-success'
                    : 'border-destructive focus-visible:ring-destructive'
                  : ''
              }
              autoComplete="off"
              autoFocus
            />
            {confirmText.length > 0 && !isConfirmed && (
              <p className="text-xs text-destructive">
                Texto incorreto. Digite exatamente "{CONFIRM_WORD}".
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmed || isDeleting}
            className="w-full sm:w-auto"
          >
            {isDeleting ? (
              <>
                <Trash2 className="h-4 w-4 mr-2 animate-pulse" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                {isSingleLead ? `Excluir ${entityLabel}` : `Excluir ${leadCount} ${entityLabel}s`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
