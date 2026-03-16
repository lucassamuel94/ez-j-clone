import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface FunnelStep {
  key: string;
  label: string;
}

// Hardcoded fallbacks — kept for backward compatibility & non-hook contexts
const FUNNEL_STEPS: FunnelStep[] = [
  { key: 'novo', label: 'Novo' },
  { key: 'em_contato', label: 'Em contato' },
  { key: 'lead_quente', label: 'Lead quente' },
  { key: 'reuniao', label: 'Reunião agendada' },
  { key: 'sqo', label: 'Reunião Confirmada' },
  { key: 'oportunidade_futura', label: 'Oportunidade futura' },
  { key: 'reciclagem', label: 'Reciclagem' },
  { key: 'perdido', label: 'Perdido' },
];

const STATUS_TO_STEP: Record<string, string> = {
  'Novo': 'novo',
  'Devolvido pelo Closer': 'novo',
  'Em contato': 'em_contato',
  'Ocupado': 'em_contato',
  'Agendar retorno': 'em_contato',
  'Agendar Retorno': 'em_contato',
  'Sem retorno': 'em_contato',
  'Interesse': 'lead_quente',
  'Lead Quente': 'lead_quente',
  'Reagendar Reunião': 'em_contato',
  'Reunião agendada': 'reuniao',
  'Reunião Agendada': 'reuniao',
  'Reunião Confirmada': 'reuniao',
  'Interesse/Agendar Retorno': 'oportunidade_futura',
  'Oportunidade Futura': 'oportunidade_futura',
  'Oportunidade criada': 'sqo',
  'Descartado': 'perdido',
  'Reciclagem': 'reciclagem',
};

interface FunnelStepperProps {
  currentStatus: string;
  onStepClick: (stepKey: string) => void;
  /** Dynamic steps from useSDRStages (optional, falls back to hardcoded) */
  steps?: FunnelStep[];
  /** Dynamic status-to-step mapping (optional) */
  statusToStepMap?: Record<string, string>;
}

export const FunnelStepper = ({
  currentStatus,
  onStepClick,
  steps,
  statusToStepMap,
}: FunnelStepperProps) => {
  const effectiveSteps = steps || FUNNEL_STEPS;
  const effectiveMap = statusToStepMap || STATUS_TO_STEP;

  const activeStep = effectiveMap[currentStatus] || 'novo';
  const activeIndex = effectiveSteps.findIndex(s => s.key === activeStep);

  const NON_LINEAR_STEPS = ['oportunidade_futura', 'reciclagem', 'perdido'];
  const isNonLinear = NON_LINEAR_STEPS.includes(activeStep);

  return (
    <div className="grid grid-cols-2 gap-1.5 w-full">
      {effectiveSteps.map((step) => {
        const isActive = step.key === activeStep;
        const isPast = !isNonLinear && effectiveSteps.indexOf(step) < activeIndex;
        const isLost = step.key === 'perdido';

        return (
          <button
            key={step.key}
            onClick={() => onStepClick(step.key)}
            className={cn(
              "flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-all border",
              isActive && !isLost && 'bg-primary text-primary-foreground border-primary shadow-sm',
              isActive && isLost && 'bg-destructive text-destructive-foreground border-destructive shadow-sm',
              isPast && 'bg-primary/10 text-primary border-primary/30',
              !isActive && !isPast && !isLost && 'bg-muted/40 text-foreground/70 border-border hover:border-primary/40 hover:bg-muted/70',
              !isActive && isLost && 'bg-muted/40 text-foreground/70 border-border hover:border-destructive/40 hover:bg-destructive/10',
            )}
          >
            {isPast && <Check className="h-3 w-3 shrink-0" />}
            <span className="truncate">{step.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export { STATUS_TO_STEP, FUNNEL_STEPS };
