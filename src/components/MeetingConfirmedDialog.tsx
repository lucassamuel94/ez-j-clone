import { useCtrlEnter } from '@/hooks/useCtrlEnter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, PartyPopper } from 'lucide-react';

interface MeetingConfirmedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  companyName: string;
}

export const MeetingConfirmedDialog = ({
  open,
  onOpenChange,
  onConfirm,
  companyName,
}: MeetingConfirmedDialogProps) => {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  useCtrlEnter(() => handleConfirm(), open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-[hsl(160,84%,39%)]" />
            Reunião Realizada
          </DialogTitle>
          <DialogDescription>
            Confirme que a reunião foi realizada com o cliente
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="bg-[hsl(160,84%,39%)]/10 border border-[hsl(160,84%,39%)]/30 rounded-lg p-4 text-center">
            <CheckCircle className="h-12 w-12 text-[hsl(160,84%,39%)] mx-auto mb-3" />
            <p className="text-lg font-medium mb-2">
              {companyName}
            </p>
            <p className="text-sm text-muted-foreground">
              A reunião foi realizada com sucesso. 
              A oportunidade seguirá o fluxo no pipeline de vendas.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            style={{ backgroundColor: 'hsl(160, 84%, 39%)', color: 'white' }}
            className="hover:opacity-90"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Confirmar e Enviar para Closer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
