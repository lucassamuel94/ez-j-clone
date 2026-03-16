import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckoutStepperProps {
  currentStep: number;
}

const steps = [
  { label: 'Proposta' },
  { label: 'Cadastro' },
  { label: 'Concluído' },
];

const CheckoutStepper = ({ currentStep }: CheckoutStepperProps) => {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((step, i) => {
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;
        return (
          <div key={step.label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all',
                  isCompleted
                    ? 'bg-primary border-primary text-primary-foreground'
                    : isCurrent
                    ? 'border-primary text-primary bg-card'
                    : 'border-border text-muted-foreground bg-card'
                )}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : i + 1}
              </div>
              <span
                className={cn(
                  'text-xs mt-2 font-medium',
                  isCompleted || isCurrent ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'w-16 md:w-24 h-0.5 mx-2 mt-[-20px]',
                  isCompleted ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CheckoutStepper;
