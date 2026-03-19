import { GenericReasonDialog, ReasonItem } from './GenericReasonDialog';

export type CloserLostResponsibility = 'SDR' | 'Closer' | 'Ambos' | 'Contexto' | 'Qualificação fraca';
export type CloserLostSqoImpact = 'sqo_invalido' | 'sqo_valido' | 'sqo_parcial';

export interface CloserLostReason extends ReasonItem {
  responsibility: CloserLostResponsibility;
  sqoImpact: CloserLostSqoImpact;
}

export const CLOSER_LOST_REASONS: CloserLostReason[] = [
  { id: 'sem_orcamento', label: 'Sem orçamento', description: 'Cliente não possui verba disponível ou achou o valor incompatível com sua realidade atual.', responsibility: 'SDR', sqoImpact: 'sqo_invalido' },
  { id: 'nao_decisor', label: 'Não é decisor', description: 'A pessoa da call não decide e o decisor não participou nem foi engajado depois.', responsibility: 'SDR', sqoImpact: 'sqo_invalido' },
  { id: 'timing_errado', label: 'Timing errado', description: 'Existe dor, mas o cliente não pretende resolver agora (90+ dias).', responsibility: 'SDR', sqoImpact: 'sqo_invalido' },
  { id: 'lead_curioso', label: 'Lead curioso / benchmark', description: 'Cliente queria apenas conhecer preço, comparar soluções ou entender o mercado.', responsibility: 'Qualificação fraca', sqoImpact: 'sqo_invalido' },
  { id: 'nao_enxergou_valor', label: 'Não enxergou valor', description: 'Cliente entendeu o produto, mas não conectou com ganho financeiro ou operacional.', responsibility: 'Closer', sqoImpact: 'sqo_valido' },
  { id: 'expectativa_errada', label: 'Expectativa errada sobre o produto', description: 'Cliente esperava algo fora do escopo (milagre, IA sem processo, zero esforço).', responsibility: 'Ambos', sqoImpact: 'sqo_parcial' },
  { id: 'concorrente_ativo', label: 'Concorrente ativo / contrato vigente', description: 'Cliente já usa outra solução e não quer trocar agora.', responsibility: 'Contexto', sqoImpact: 'sqo_valido' },
  { id: 'falta_maturidade', label: 'Falta maturidade operacional', description: 'Cliente não tem processo, time ou estrutura mínima para implantar agora.', responsibility: 'Contexto', sqoImpact: 'sqo_valido' },
  { id: 'perdeu_prioridade', label: 'Perdeu prioridade', description: 'Outro projeto ou urgência interna passou à frente e travou a decisão.', responsibility: 'Contexto', sqoImpact: 'sqo_valido' },
  { id: 'sumiu', label: 'Sumiu / não respondeu', description: 'Cliente parou de responder mesmo após follow-ups estruturados.', responsibility: 'Qualificação fraca', sqoImpact: 'sqo_invalido' },
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
}: CloserLostReasonDialogProps) => (
  <GenericReasonDialog
    open={open}
    onOpenChange={onOpenChange}
    onConfirm={onConfirm}
    title="Motivo da Perda (Closer)"
    subtitle="Selecione o motivo da perda após a demonstração"
    confirmLabel="Confirmar Perda"
    reasons={CLOSER_LOST_REASONS}
  />
);
