import { CheckCircle2 } from 'lucide-react';
import CheckoutStepper from './CheckoutStepper';

interface CheckoutSuccessProps {
  companyName: string;
}

const CheckoutSuccess = ({ companyName }: CheckoutSuccessProps) => {
  return (
    <div>
      <CheckoutStepper currentStep={2} />

      <div className="bg-card rounded-xl p-8 border border-border text-center">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-[hsl(var(--success)/0.1)] flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))]" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2 font-display">Cadastro concluído!</h2>
        <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
          Obrigado, <strong>{companyName}</strong>! Seus dados foram enviados com sucesso. 
          Nossa equipe entrará em contato em breve para formalização do contrato.
        </p>
        <div className="bg-accent rounded-lg p-4 inline-block">
          <p className="text-primary text-sm font-medium">
            Próximo passo: Contrato de Prestação de Serviços
          </p>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSuccess;
