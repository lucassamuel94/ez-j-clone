import { useState, useEffect, useRef, useCallback } from 'react';
import { Lead } from '@/types/lead';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Building2, Package, Monitor, Clock, AlertTriangle, DollarSign, Users, Check, Lock, Info, Sparkles, Loader2, Lightbulb, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isCompanyDataSufficientForQualification, getQualificationAlerts, calculateQualificationScore, scoreToTemperature } from '@/utils/qualificationScore';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQualificationValidation } from '@/hooks/useQualificationValidation';
import { toast } from 'sonner';

// Product options
const PRODUCTS = ['EZ Chat', 'EZ Call'];

// Platform usage options
const PLATFORM_USAGE = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
];

// Daily volume options
const DAILY_VOLUMES = [
  '10 a 50',
  '51 a 100',
  '100 a 200',
  'Acima de 200',
];

// Pain points options
const PAIN_POINTS = [
  'Tempo de resposta lento',
  'Falta de automação',
  'Dificuldade em escalar atendimento',
  'Perda de histórico de conversas',
  'Falta de integração com sistemas',
  'Atendimento fora do horário comercial',
  'Dificuldade em medir qualidade',
  'Custo alto com equipe de atendimento',
  'Falta de relatórios e métricas',
  'Múltiplos canais sem unificação',
  'Usa outra plataforma e quer trocar',
  'Outro',
];

// Urgency options
const URGENCIES = [
  'Até 3 meses',
  '3 a 6 meses',
  'Acima de 6 meses',
];

// Budget options
const BUDGETS = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
  { value: 'viabilizar', label: 'Pode viabilizar' },
];

interface ToggleButtonGroupProps {
  options: { value: string; label: string }[] | string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const ToggleButtonGroup = ({ options, value, onChange, disabled }: ToggleButtonGroupProps) => {
  const normalizedOptions = options.map(opt => 
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const handleClick = (optionValue: string) => {
    if (disabled) return;
    if (value === optionValue) {
      onChange('');
    } else {
      onChange(optionValue);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {normalizedOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => handleClick(option.value)}
          disabled={disabled}
          className={cn(
            'relative rounded-md border transition-all font-medium px-3 py-1.5 text-xs',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            disabled && 'opacity-50 cursor-not-allowed',
            value === option.value
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-card text-foreground border-border hover:border-primary/40 hover:bg-accent/50'
          )}
        >
          <span className="flex items-center gap-1">
            {value === option.value && (
              <Check className="h-3 w-3" />
            )}
            {option.label}
          </span>
        </button>
      ))}
    </div>
  );
};

interface FieldCardProps {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  children: React.ReactNode;
  filled?: boolean;
  alert?: string;
}

const FieldCard = ({ icon, label, required, children, filled, alert }: FieldCardProps) => (
  <div className={cn(
    "rounded-lg border p-3 transition-all",
    alert ? "border-destructive/30 bg-destructive/5" :
    filled 
      ? "border-primary/20 bg-primary/5" 
      : "border-transparent bg-card"
  )}>
    <Label className="flex items-center gap-1.5 text-xs font-medium mb-2.5">
      <span className={cn(
        "flex items-center justify-center h-5 w-5 rounded",
        filled ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"
      )}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {required && <span className="text-xs text-muted-foreground">(obrigatório)</span>}
      {filled && <Check className="h-3 w-3 text-primary" />}
    </Label>
    {children}
    {alert && (
      <p className="text-xs text-destructive mt-2 flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        {alert}
      </p>
    )}
  </div>
);

interface CompanyInfoSectionProps {
  lead: Lead;
  onUpdateLead: (lead: Lead) => void;
  readOnly?: boolean;
}

export const CompanyInfoSection = ({ lead, onUpdateLead, readOnly = false }: CompanyInfoSectionProps) => {
  const isUnlocked = isCompanyDataSufficientForQualification(lead);
  const { alerts: aiAlerts, isValidating, validate, clearAlerts, initAlerts } = useQualificationValidation();

  // Load persisted alerts on mount
  useEffect(() => {
    initAlerts(lead);
  }, [lead.id]);
  
  // Get lead qualification properties
  const productInterest = lead.product_interest || '';
  const usesPlatform = (lead.uses_platform as unknown) as string | null;
  const dailyServiceVolume = lead.daily_service_volume || '';
  const mainPainPoint = lead.main_pain_point || '';
  const solutionUrgency = lead.solution_urgency || '';
  const hasBudget = lead.has_budget || '';

  // Check if pain is "Outro" and needs description
  const isOtherPain = mainPainPoint === 'Outro' || (mainPainPoint && !PAIN_POINTS.slice(0, -1).includes(mainPainPoint) && mainPainPoint !== 'Outro');
  // Store custom pain description in main_pain_point prefixed with "Outro: "
  const [customPainDescription, setCustomPainDescription] = useState(() => {
    if (mainPainPoint && mainPainPoint.startsWith('Outro: ')) {
      return mainPainPoint.replace('Outro: ', '');
    }
    return '';
  });

  // Local state for qualification_notes to avoid cursor jump on each keystroke
  const [localQualNotes, setLocalQualNotes] = useState(lead.qualification_notes || '');
  const qualNotesTimeoutRef = useRef<NodeJS.Timeout>();
  const customPainTimeoutRef = useRef<NodeJS.Timeout>();

  // Sync from parent when a different lead is opened
  useEffect(() => {
    setLocalQualNotes(lead.qualification_notes || '');
  }, [lead.id]);

  const handleQualNotesChange = useCallback((value: string) => {
    setLocalQualNotes(value);
    if (qualNotesTimeoutRef.current) clearTimeout(qualNotesTimeoutRef.current);
    qualNotesTimeoutRef.current = setTimeout(() => {
      handleFieldChange('qualification_notes', value);
    }, 500);
  }, [lead]);

  useEffect(() => {
    return () => {
      if (qualNotesTimeoutRef.current) clearTimeout(qualNotesTimeoutRef.current);
      if (customPainTimeoutRef.current) clearTimeout(customPainTimeoutRef.current);
    };
  }, []);

  const handleFieldChange = (field: keyof Lead, value: string | boolean | null) => {
    const updatedLead = {
      ...lead,
      [field]: value,
    };
    
    // Auto-calculate temperature
    const score = calculateQualificationScore(updatedLead);
    const newTemp = scoreToTemperature(score);
    updatedLead.temperature = newTemp;
    
    onUpdateLead(updatedLead);
  };

  const handlePainPointChange = (value: string) => {
    if (value === 'Outro') {
      // Set as "Outro" - user needs to fill description
      if (customPainDescription) {
        handleFieldChange('main_pain_point', `Outro: ${customPainDescription}`);
      } else {
        handleFieldChange('main_pain_point', 'Outro');
      }
    } else {
      setCustomPainDescription('');
      handleFieldChange('main_pain_point', value);
    }
  };

  const handleCustomPainChange = (description: string) => {
    setCustomPainDescription(description);
  };

  const saveCustomPain = useCallback(() => {
    if (customPainDescription.trim()) {
      handleFieldChange('main_pain_point', `Outro: ${customPainDescription}`);
    } else {
      handleFieldChange('main_pain_point', 'Outro');
    }
  }, [customPainDescription, lead]);

  // Count filled fields (5 required)
  const filledCount = [
    productInterest,
    dailyServiceVolume,
    mainPainPoint && mainPainPoint !== 'Outro', // "Outro" without description doesn't count
    solutionUrgency,
    hasBudget,
  ].filter(Boolean).length;

  const totalRequired = 5;

  // Alerts
  const alerts = getQualificationAlerts(lead);

  // Score
  const score = calculateQualificationScore(lead);
  const tempLabel = score >= 70 ? 'Alto' : score >= 40 ? 'Médio' : 'Baixo';
  const tempColor = score >= 70 ? 'text-success' : score >= 40 ? 'text-chart-4' : 'text-destructive';

  // Volume alert
  const volumeAlert = dailyServiceVolume === '10 a 50' ? undefined : undefined;

  // Urgency alert
  const urgencyAlert = solutionUrgency === 'Acima de 6 meses' ? 'Lead com score baixo — não pode avançar para Reunião' : 
                        solutionUrgency === '3 a 6 meses' ? 'Urgência média' : undefined;

  // Budget alert
  const budgetAlert = hasBudget === 'nao' ? 'Sem orçamento — não pode avançar para SQO' : undefined;

  // Pain point: check if "Outro" needs description
  const selectedPainValue = mainPainPoint.startsWith('Outro: ') ? 'Outro' : mainPainPoint;

  return (
    <div className="mb-4">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary">
              <Building2 className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-medium">Qualificação (SDR)</span>
          </div>
          <div className="flex items-center gap-2">
            {isUnlocked && filledCount > 0 && (
              <span className={cn("text-xs font-medium", tempColor)}>
                Score: {score} ({tempLabel})
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {[...Array(totalRequired)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1 w-3 rounded-full transition-colors",
                      i < filledCount ? "bg-primary" : "bg-muted"
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{filledCount}/{totalRequired}</span>
            </div>
          </div>
        </div>
        <div className="p-3 space-y-3">

      {/* Lock message */}
      {!isUnlocked && (
        <Alert className="mb-3">
          <Lock className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Preencha o <strong>CNPJ</strong> e a <strong>Razão Social</strong> na aba "Dados da Empresa" para desbloquear a qualificação.
          </AlertDescription>
        </Alert>
      )}

      {/* Alerts */}
      {isUnlocked && alerts.length > 0 && (
        <div className="space-y-1 mb-3">
          {alerts.map((alert, i) => (
            <div key={i} className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-1.5 border border-destructive/20">
              {alert}
            </div>
          ))}
        </div>
      )}

      <div className={cn("space-y-2", (!isUnlocked || readOnly) && "opacity-70 pointer-events-none")}>
        {/* AI Validation Button */}
        {isUnlocked && filledCount >= 3 && (
          <div className="space-y-2">
            <style>{`
              @keyframes liquid-shift-qual {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
              }
              @keyframes shine-sweep-qual {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
              }
            `}</style>
            <button
              className="relative w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium rounded-xl overflow-hidden transition-all duration-300 group disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => validate(lead, onUpdateLead)}
              disabled={isValidating}
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.06))',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid hsl(var(--primary) / 0.25)',
                boxShadow: '0 0 20px hsl(var(--primary) / 0.08), inset 0 1px 0 hsl(var(--primary) / 0.15), inset 0 -1px 0 hsl(var(--primary) / 0.05)',
              }}
            >
              <span
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.08), hsl(var(--primary) / 0.18))',
                  backgroundSize: '200% 200%',
                  animation: 'liquid-shift-qual 3s ease infinite',
                }}
              />
              <span
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{
                  background: 'linear-gradient(105deg, transparent 40%, hsl(var(--primary) / 0.15) 45%, hsl(var(--primary) / 0.25) 50%, hsl(var(--primary) / 0.15) 55%, transparent 60%)',
                  backgroundSize: '200% 100%',
                  animation: 'shine-sweep-qual 2s ease-in-out infinite',
                }}
              />
              <span
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  boxShadow: '0 0 24px hsl(var(--primary) / 0.2), 0 0 48px hsl(var(--primary) / 0.1)',
                }}
              />
              <span className="relative z-10 flex items-center gap-2 text-primary">
                {isValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 group-hover:animate-pulse" />
                )}
                {isValidating ? 'Analisando coerência...' : 'Validar coerência com IA'}
              </span>
            </button>

            {aiAlerts.length > 0 && (
              <div className="space-y-1.5">
                {aiAlerts.map((alert, i) => (
                  <div
                    key={i}
                    className={cn(
                      "text-xs rounded-md px-3 py-2 border flex items-start gap-2",
                      alert.type === 'warning'
                        ? "text-destructive bg-destructive/10 border-destructive/20"
                        : "text-primary bg-primary/10 border-primary/20"
                    )}
                  >
                    {alert.type === 'warning' ? (
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    ) : (
                      <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    )}
                    <span>{alert.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Produto */}
        <FieldCard
          icon={<Package className="h-3 w-3" />}
          label="Produto"
          required
          filled={!!productInterest}
        >
          <ToggleButtonGroup
            options={PRODUCTS}
            value={productInterest}
            onChange={(value) => handleFieldChange('product_interest', value)}
            disabled={!isUnlocked}
          />
        </FieldCard>

        {/* Já usa plataforma */}
        <FieldCard
          icon={<Monitor className="h-3 w-3" />}
          label="Já usa plataforma?"
          filled={usesPlatform !== null && usesPlatform !== undefined && usesPlatform !== ''}
        >
          <ToggleButtonGroup
            options={PLATFORM_USAGE}
            value={usesPlatform || ''}
            onChange={(value) => handleFieldChange('uses_platform', value || null)}
            disabled={!isUnlocked}
          />
        </FieldCard>

        {/* Média de atendimentos por dia */}
        <FieldCard
          icon={<Users className="h-3 w-3" />}
          label="Média de atendimentos por dia"
          required
          filled={!!dailyServiceVolume}
        >
          <ToggleButtonGroup
            options={DAILY_VOLUMES}
            value={dailyServiceVolume}
            onChange={(value) => handleFieldChange('daily_service_volume', value)}
            disabled={!isUnlocked}
          />
        </FieldCard>

        {/* Principal dor mapeada */}
        <FieldCard
          icon={<AlertTriangle className="h-3 w-3" />}
          label="Principal dor mapeada"
          required
          filled={!!mainPainPoint && mainPainPoint !== 'Outro'}
        >
          <Select
            value={selectedPainValue}
            onValueChange={handlePainPointChange}
            disabled={!isUnlocked}
          >
            <SelectTrigger className={cn(
              "bg-card border h-9 text-xs",
              mainPainPoint ? "border-primary/20" : "border-input"
            )}>
              <SelectValue placeholder="Selecione a dor principal" />
            </SelectTrigger>
            <SelectContent className="bg-popover max-h-60">
              {PAIN_POINTS.map((pain) => (
                <SelectItem key={pain} value={pain} className="text-xs">
                  {pain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(selectedPainValue === 'Outro' || mainPainPoint.startsWith('Outro: ')) && (
            <div className="relative mt-2">
              <Input
                value={customPainDescription}
                onChange={(e) => handleCustomPainChange(e.target.value)}
                onBlur={saveCustomPain}
                placeholder="Descreva a dor do cliente..."
                className="h-8 text-xs pr-9"
                disabled={!isUnlocked}
              />
              {isUnlocked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-0.5 right-1 h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={saveCustomPain}
                  aria-label="Salvar dor personalizada"
                >
                  <Save className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </FieldCard>

        {/* Urgência para solução */}
        <FieldCard
          icon={<Clock className="h-3 w-3" />}
          label="Urgência para solução"
          required
          filled={!!solutionUrgency}
          alert={urgencyAlert}
        >
          <ToggleButtonGroup
            options={URGENCIES}
            value={solutionUrgency}
            onChange={(value) => handleFieldChange('solution_urgency', value)}
            disabled={!isUnlocked}
          />
        </FieldCard>

        {/* Possui orçamento para investir */}
        <FieldCard
          icon={<DollarSign className="h-3 w-3" />}
          label="Possui orçamento para investir?"
          required
          filled={!!hasBudget}
          alert={budgetAlert}
        >
          <ToggleButtonGroup
            options={BUDGETS}
            value={hasBudget}
            onChange={(value) => handleFieldChange('has_budget', value)}
            disabled={!isUnlocked}
          />
        </FieldCard>

        {/* Observações da qualificação */}
        <FieldCard
          icon={<Lightbulb className="h-3 w-3" />}
          label="Observações da qualificação"
          filled={!!lead.qualification_notes}
        >
          <div className="relative">
            <Textarea
              placeholder="Informações que podem ajudar o Closer na apresentação (ex: concorrente atual, expectativas, contexto da dor...)"
              value={localQualNotes}
              onChange={(e) => handleQualNotesChange(e.target.value)}
              disabled={!isUnlocked}
              className="min-h-[80px] text-xs resize-none pr-9"
            />
            {isUnlocked && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1.5 right-1.5 h-6 w-6 text-muted-foreground hover:text-primary"
                onClick={() => {
                  if (qualNotesTimeoutRef.current) clearTimeout(qualNotesTimeoutRef.current);
                  handleFieldChange('qualification_notes', localQualNotes);
                  toast.success('Observações salvas');
                }}
                aria-label="Salvar observações"
              >
                <Save className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </FieldCard>
        </div>
        </div>
      </div>
    </div>
  );
};

// Helper to check if all company info fields are filled (5 required, uses_platform is optional)
export const isCompanyInfoComplete = (lead: Lead): boolean => {
  const mainPain = lead.main_pain_point || '';
  return Boolean(
    lead.product_interest &&
    lead.daily_service_volume &&
    mainPain && mainPain !== 'Outro' && // "Outro" without description doesn't count
    lead.solution_urgency &&
    lead.has_budget
  );
};

// Helper to get missing qualification field names
export const getMissingQualificationFields = (lead: Lead): string[] => {
  const missing: string[] = [];
  if (!lead.product_interest) missing.push('Produto de interesse');
  if (!lead.daily_service_volume) missing.push('Volume diário de atendimentos');
  const mainPain = lead.main_pain_point || '';
  if (!mainPain || mainPain === 'Outro') missing.push('Principal dor');
  if (!lead.solution_urgency) missing.push('Urgência da solução');
  if (!lead.has_budget) missing.push('Tem orçamento?');
  return missing;
};
