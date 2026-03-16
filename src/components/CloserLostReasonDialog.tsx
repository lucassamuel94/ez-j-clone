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
import { Badge } from '@/components/ui/badge';
import { XCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CloserLostResponsibility = 'SDR' | 'Closer' | 'Ambos' | 'Contexto' | 'Qualificação fraca';
export type CloserLostSqoImpact = 'sqo_invalido' | 'sqo_valido' | 'sqo_parcial';

export interface CloserLostReason {
  id: string;
  label: string;
  tooltip: string;
  responsibility: CloserLostResponsibility;
  sqoImpact: CloserLostSqoImpact;
}

export const CLOSER_LOST_REASONS: CloserLostReason[] = [
  {
    id: 'sem_orcamento',
    label: 'Sem orçamento',
    tooltip: 'Cliente não possui verba disponível ou achou o valor incompatível com sua realidade atual.',
    responsibility: 'SDR',
    sqoImpact: 'sqo_invalido',
  },
  {
    id: 'nao_decisor',
    label: 'Não é decisor',
    tooltip: 'A pessoa da call não decide e o decisor não participou nem foi engajado depois.',
    responsibility: 'SDR',
    sqoImpact: 'sqo_invalido',
  },
  {
    id: 'timing_errado',
    label: 'Timing errado',
    tooltip: 'Existe dor, mas o cliente não pretende resolver agora (90+ dias).',
    responsibility: 'SDR',
    sqoImpact: 'sqo_invalido',
  },
  {
    id: 'lead_curioso',
    label: 'Lead curioso / benchmark',
    tooltip: 'Cliente queria apenas conhecer preço, comparar soluções ou entender o mercado.',
    responsibility: 'Qualificação fraca',
    sqoImpact: 'sqo_invalido',
  },
  {
    id: 'nao_enxergou_valor',
    label: 'Não enxergou valor',
    tooltip: 'Cliente entendeu o produto, mas não conectou com ganho financeiro ou operacional.',
    responsibility: 'Closer',
    sqoImpact: 'sqo_valido',
  },
  {
    id: 'expectativa_errada',
    label: 'Expectativa errada sobre o produto',
    tooltip: 'Cliente esperava algo fora do escopo (milagre, IA sem processo, zero esforço).',
    responsibility: 'Ambos',
    sqoImpact: 'sqo_parcial',
  },
  {
    id: 'concorrente_ativo',
    label: 'Concorrente ativo / contrato vigente',
    tooltip: 'Cliente já usa outra solução e não quer trocar agora.',
    responsibility: 'Contexto',
    sqoImpact: 'sqo_valido',
  },
  {
    id: 'falta_maturidade',
    label: 'Falta maturidade operacional',
    tooltip: 'Cliente não tem processo, time ou estrutura mínima para implantar agora.',
    responsibility: 'Contexto',
    sqoImpact: 'sqo_valido',
  },
  {
    id: 'perdeu_prioridade',
    label: 'Perdeu prioridade',
    tooltip: 'Outro projeto ou urgência interna passou à frente e travou a decisão.',
    responsibility: 'Contexto',
    sqoImpact: 'sqo_valido',
  },
  {
    id: 'sumiu',
    label: 'Sumiu / não respondeu',
    tooltip: 'Cliente parou de responder mesmo após follow-ups estruturados.',
    responsibility: 'Qualificação fraca',
    sqoImpact: 'sqo_invalido',
  },
];


interface CloserLostReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: CloserLostReason) => void;
}

export const CloserLostReasonDialog = ({
  open,
  onOpenChange,
  onConfirm,
}: CloserLostReasonDialogProps) => {
  const [selectedReason, setSelectedReason] = useState<CloserLostReason | null>(null);

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
            Motivo da Perda (Closer)
          </DialogTitle>
          <DialogDescription>
            Selecione o motivo da perda após a demonstração
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-2">
            {CLOSER_LOST_REASONS.map((reason) => {
              const isSelected = selectedReason?.id === reason.id;
              return (
                <button
                  key={reason.id}
                  onClick={() => setSelectedReason(reason)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-all',
                    'hover:border-primary/50 hover:bg-accent/50',
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors',
                        isSelected
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      )}
                    >
                      {isSelected && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{reason.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {reason.tooltip}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
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
            Confirmar Perda
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
