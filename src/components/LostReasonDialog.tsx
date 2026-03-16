import { useState } from 'react';
import { useCtrlEnter } from '@/hooks/useCtrlEnter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { XCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DiscardReason {
  id: string;
  status: string;
  description: string;
}

export const DISCARD_REASONS: DiscardReason[] = [
  {
    id: 'fora_icp',
    status: 'Fora do ICP',
    description: 'Empresa/segmento/tamanho não compatível.',
  },
  {
    id: 'sem_dor',
    status: 'Sem dor aderente',
    description: 'Não tem o problema que resolvemos.',
  },
  {
    id: 'sem_orcamento',
    status: 'Sem orçamento',
    description: 'Não tem verba ou não pretende investir.',
  },
  {
    id: 'nao_prioridade',
    status: 'Não é prioridade agora',
    description: 'Reconhece a dor, mas não vai agir.',
  },
  {
    id: 'nao_decisor',
    status: 'Não é decisor',
    description: 'Não participa da decisão e não conecta com quem decide.',
  },
  {
    id: 'momento_inadequado',
    status: 'Momento inadequado',
    description: 'Mudança interna, contrato vigente, projeto pausado.',
  },
  {
    id: 'usa_concorrente',
    status: 'Já usa concorrente',
    description: 'Satisfeito com solução atual.',
  },
  {
    id: 'solucao_interna',
    status: 'Solução interna',
    description: 'Resolve hoje com time/processo próprio.',
  },
  {
    id: 'sem_resposta',
    status: 'Não respondeu após tentativas',
    description: 'Seguiu a cadência completa sem retorno.',
  },
  {
    id: 'contato_invalido',
    status: 'Contato inválido',
    description: 'Telefone/email inexistente ou errado.',
  },
  {
    id: 'recusou_contato',
    status: 'Recusou contato',
    description: 'Pediu para não ser contatado.',
  },
  {
    id: 'lead_duplicado',
    status: 'Lead duplicado',
    description: 'Já existe no sistema.',
  },
];

interface LostReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: DiscardReason) => void;
  selectedCount?: number;
}

export const LostReasonDialog = ({
  open,
  onOpenChange,
  onConfirm,
  selectedCount,
}: LostReasonDialogProps) => {
  const [selectedReason, setSelectedReason] = useState<DiscardReason | null>(null);

  useCtrlEnter(() => handleConfirm(), open && !!selectedReason);

  const handleConfirm = () => {
    if (selectedReason) {
      onConfirm(selectedReason);
      setSelectedReason(null);
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Motivo da Perda
            {selectedCount && selectedCount > 1 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({selectedCount} leads)
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Selecione o motivo pelo qual {selectedCount && selectedCount > 1 ? 'estes leads estão sendo marcados' : 'este lead está sendo marcado'} como perdido
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-2">
            {DISCARD_REASONS.map((reason) => (
              <button
                key={reason.id}
                onClick={() => setSelectedReason(reason)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-all',
                  'hover:border-primary/50 hover:bg-accent/50',
                  selectedReason?.id === reason.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background'
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors',
                      selectedReason?.id === reason.id
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground'
                    )}
                  >
                    {selectedReason?.id === reason.id && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{reason.status}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {reason.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!selectedReason}
            className="flex-1"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Confirmar Descarte
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
