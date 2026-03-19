import { useState } from 'react';
import { useCtrlEnter } from '@/hooks/useCtrlEnter';
import { useCloserUsers } from '@/hooks/useCloserUsers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CheckCircle, PartyPopper, Loader2 } from 'lucide-react';

interface MeetingConfirmedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (closerId: string) => void;
  companyName: string;
}

export const MeetingConfirmedDialog = ({
  open,
  onOpenChange,
  onConfirm,
  companyName,
}: MeetingConfirmedDialogProps) => {
  const [selectedCloserId, setSelectedCloserId] = useState('');
  const { data: closers = [], isLoading } = useCloserUsers();

  const handleConfirm = () => {
    if (!selectedCloserId) return;
    onConfirm(selectedCloserId);
    onOpenChange(false);
    setSelectedCloserId('');
  };

  useCtrlEnter(() => handleConfirm(), open && !!selectedCloserId);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSelectedCloserId(''); }}>
      <DialogContent className="bg-card max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-status-created-solid" />
            Reunião Realizada
          </DialogTitle>
          <DialogDescription>
            Confirme que a reunião foi realizada e selecione o Closer responsável
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="bg-status-created-solid/10 border border-status-created-solid/30 rounded-lg p-4 text-center">
            <CheckCircle className="h-12 w-12 text-status-created-solid mx-auto mb-3" />
            <p className="text-lg font-medium mb-2">
              {companyName}
            </p>
            <p className="text-sm text-muted-foreground">
              A reunião foi realizada com sucesso. 
              A oportunidade seguirá o fluxo no pipeline de vendas.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Closer responsável *</Label>
            <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? 'Carregando…' : 'Selecione o Closer'} />
              </SelectTrigger>
              <SelectContent>
                {closers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedCloserId}
            className="bg-status-created-solid text-white hover:opacity-90"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Confirmar e Enviar para Closer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
