import { GenericReasonDialog, ReasonItem } from './GenericReasonDialog';

export interface DiscardReason extends ReasonItem {
  status: string;
}

export const DISCARD_REASONS: DiscardReason[] = [
  { id: 'fora_icp', status: 'Fora do ICP', label: 'Fora do ICP', description: 'Empresa/segmento/tamanho não compatível.' },
  { id: 'sem_dor', status: 'Sem dor aderente', label: 'Sem dor aderente', description: 'Não tem o problema que resolvemos.' },
  { id: 'sem_orcamento', status: 'Sem orçamento', label: 'Sem orçamento', description: 'Não tem verba ou não pretende investir.' },
  { id: 'nao_prioridade', status: 'Não é prioridade agora', label: 'Não é prioridade agora', description: 'Reconhece a dor, mas não vai agir.' },
  { id: 'nao_decisor', status: 'Não é decisor', label: 'Não é decisor', description: 'Não participa da decisão e não conecta com quem decide.' },
  { id: 'momento_inadequado', status: 'Momento inadequado', label: 'Momento inadequado', description: 'Mudança interna, contrato vigente, projeto pausado.' },
  { id: 'usa_concorrente', status: 'Já usa concorrente', label: 'Já usa concorrente', description: 'Satisfeito com solução atual.' },
  { id: 'solucao_interna', status: 'Solução interna', label: 'Solução interna', description: 'Resolve hoje com time/processo próprio.' },
  { id: 'sem_resposta', status: 'Não respondeu após tentativas', label: 'Não respondeu após tentativas', description: 'Seguiu a cadência completa sem retorno.' },
  { id: 'contato_invalido', status: 'Contato inválido', label: 'Contato inválido', description: 'Telefone/email inexistente ou errado.' },
  { id: 'recusou_contato', status: 'Recusou contato', label: 'Recusou contato', description: 'Pediu para não ser contatado.' },
  { id: 'lead_duplicado', status: 'Lead duplicado', label: 'Lead duplicado', description: 'Já existe no sistema.' },
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
}: LostReasonDialogProps) => (
  <GenericReasonDialog
    open={open}
    onOpenChange={onOpenChange}
    onConfirm={onConfirm}
    title="Motivo da Perda"
    subtitle={
      selectedCount && selectedCount > 1
        ? `Selecione o motivo pelo qual estes ${selectedCount} leads estão sendo marcados como perdido`
        : 'Selecione o motivo pelo qual este lead está sendo marcado como perdido'
    }
    confirmLabel="Confirmar Descarte"
    reasons={DISCARD_REASONS}
    selectedCount={selectedCount}
  />
);
