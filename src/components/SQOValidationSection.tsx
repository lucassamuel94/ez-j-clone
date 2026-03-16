import { Lead } from '@/types/lead';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Target,
  Clock,
  DollarSign,
  UserCheck,
  ShieldCheck,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Check,
  ClipboardList,
} from 'lucide-react';

// --- Option types ---
const PAIN_CATEGORIES = [
  'Geração de leads',
  'Atendimento / Suporte',
  'Vendas / Conversão',
  'Retenção / Pós-venda',
];

const URGENCY_OPTIONS = [
  { value: 'imediato', label: 'Imediato (0–30 dias)' },
  { value: 'curto_prazo', label: 'Curto prazo (31–90 dias)' },
  { value: 'longo_prazo', label: 'Longo prazo (90+ dias)' },
];

const BUDGET_OPTIONS = [
  { value: 'sim_ok', label: 'Sim, valor fez sentido' },
  { value: 'sim_ajuste', label: 'Sim, pediu ajuste' },
  { value: 'nao_caro', label: 'Não, achou caro' },
  { value: 'nao_falou', label: 'Não falou de preço' },
];

const DECISION_MAKER_OPTIONS = [
  { value: 'proprio', label: 'Próprio participante da call' },
  { value: 'socio_mapeado', label: 'Sócio / diretor (mapeado)' },
  { value: 'outro_nao_mapeado', label: 'Outra pessoa (não mapeada)' },
];

const ICP_FIT_OPTIONS = [
  { value: 'sim', label: 'Sim' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'nao', label: 'Não' },
];


// --- Reusable toggle button group ---
interface ToggleOption {
  value: string;
  label: string;
}

interface ToggleButtonGroupProps {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
  blockers?: string[]; // values that are "red flags"
  disabled?: boolean;
  multi?: boolean;
}

const ToggleButtonGroup = ({ options, value, onChange, blockers = [], disabled = false, multi = false }: ToggleButtonGroupProps) => {
  const selectedValues = multi ? (value ? value.split(',') : []) : [];

  const handleClick = (optionValue: string) => {
    if (disabled) return;
    if (multi) {
      const current = new Set(selectedValues);
      if (current.has(optionValue)) current.delete(optionValue);
      else current.add(optionValue);
      onChange([...current].join(','));
    } else {
      onChange(value === optionValue ? '' : optionValue);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = multi ? selectedValues.includes(option.value) : value === option.value;
        const isBlocker = blockers.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleClick(option.value)}
            disabled={disabled}
            className={cn(
              'relative rounded-md border transition-all font-medium px-3 py-1.5 text-xs',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              disabled && 'opacity-60 cursor-not-allowed',
              isSelected && isBlocker
                ? 'bg-destructive text-destructive-foreground border-destructive shadow-sm'
                : isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card text-foreground border-border hover:border-primary/40 hover:bg-accent/50'
            )}
          >
            <span className="flex items-center gap-1">
              {isSelected && <Check className="h-3 w-3" />}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

// --- Checkbox toggle ---
interface CheckToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  blocker?: boolean;
  disabled?: boolean;
}

const CheckToggle = ({ checked, onChange, label, blocker, disabled }: CheckToggleProps) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={cn(
      'flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-all w-full text-left',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      disabled && 'opacity-60 cursor-not-allowed',
      checked
        ? 'bg-primary/10 border-primary/30 text-foreground'
        : blocker
          ? 'bg-destructive/5 border-destructive/20 text-muted-foreground'
          : 'bg-card border-border text-muted-foreground hover:border-primary/40'
    )}
  >
    <div className={cn(
      'h-4 w-4 rounded-sm border flex items-center justify-center flex-shrink-0',
      checked ? 'bg-primary border-primary' : 'border-muted-foreground/40'
    )}>
      {checked && <Check className="h-3 w-3 text-primary-foreground" />}
    </div>
    {label}
  </button>
);

// --- Field card wrapper ---
interface FieldCardProps {
  icon: React.ReactNode;
  label: string;
  number: number;
  children: React.ReactNode;
  filled?: boolean;
  blocked?: boolean;
}

const FieldCard = ({ icon, label, number, children, filled, blocked }: FieldCardProps) => (
  <div className={cn(
    'rounded-lg border p-3 transition-all',
    blocked
      ? 'border-destructive/30 bg-destructive/5'
      : filled
        ? 'border-primary/20 bg-primary/5'
        : 'border-transparent bg-card'
  )}>
    <Label className="flex items-center gap-1.5 text-xs font-medium mb-2.5">
      <span className={cn(
        'flex items-center justify-center h-5 w-5 rounded text-xs font-bold',
        blocked
          ? 'bg-destructive/20 text-destructive'
          : filled
            ? 'bg-primary/20 text-primary'
            : 'bg-muted text-muted-foreground'
      )}>
        {number}
      </span>
      <span className="flex items-center gap-1 flex-1">
        {icon}
        {label}
      </span>
      {blocked && <XCircle className="h-3.5 w-3.5 text-destructive" />}
      {filled && !blocked && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
    </Label>
    {children}
    {blocked && (
      <p className="text-xs text-destructive mt-2 flex items-center gap-1">
        <XCircle className="h-3 w-3" /> NÃO É SQO
      </p>
    )}
  </div>
);

// --- SQO Calculation ---
export interface SQOFields {
  sqo_pain_category?: string;
  sqo_pain_other?: string;
  sqo_pain_clear?: boolean;
  sqo_pain_financial_impact?: boolean;
  sqo_urgency?: string;
  sqo_budget?: string;
  sqo_decision_maker?: string;
  sqo_icp_fit?: string;
}

export const calculateSQOVerdict = (fields: SQOFields): { approved: boolean; reasons: string[] } => {
  const reasons: string[] = [];

  // 1. Dor clara
  if (!fields.sqo_pain_category) reasons.push('Dor não informada');
  if (!fields.sqo_pain_clear) reasons.push('Dor não foi explicada de forma clara');
  if (fields.sqo_pain_financial_impact === false) reasons.push('Dor não impacta resultado financeiro');

  // 2. Urgência
  if (fields.sqo_urgency === 'longo_prazo') reasons.push('Urgência acima de 90 dias');
  if (!fields.sqo_urgency) reasons.push('Urgência não informada');

  // 3. Orçamento
  if (fields.sqo_budget === 'nao_caro' || fields.sqo_budget === 'nao_falou') reasons.push('Orçamento incompatível');
  if (!fields.sqo_budget) reasons.push('Orçamento não informado');

  // 4. Decisor
  if (fields.sqo_decision_maker === 'outro_nao_mapeado') reasons.push('Decisor não mapeado');
  if (!fields.sqo_decision_maker) reasons.push('Decisor não informado');

  // 5. ICP
  if (fields.sqo_icp_fit === 'nao') reasons.push('Fora do ICP');
  if (!fields.sqo_icp_fit) reasons.push('ICP não informado');


  return { approved: reasons.length === 0, reasons };
};

// --- Main Component ---
interface SQOValidationSectionProps {
  lead: Lead;
  onUpdateLead: (lead: Lead) => void;
  readOnly?: boolean;
}

export const SQOValidationSection = ({ lead, onUpdateLead, readOnly = false }: SQOValidationSectionProps) => {
  const fields: SQOFields = {
    sqo_pain_category: lead.sqo_pain_category || '',
    sqo_pain_other: lead.sqo_pain_other || '',
    sqo_pain_clear: lead.sqo_pain_clear === true,
    sqo_pain_financial_impact: lead.sqo_pain_financial_impact === true,
    sqo_urgency: lead.sqo_urgency || '',
    sqo_budget: lead.sqo_budget || '',
    sqo_decision_maker: lead.sqo_decision_maker || '',
    sqo_icp_fit: lead.sqo_icp_fit || '',
    
  };

  const handleChange = (field: string, value: any) => {
    onUpdateLead({ ...lead, [field]: value } as Lead);
  };

  const verdict = calculateSQOVerdict(fields);

  // Blocker checks per field
  const painBlocked = fields.sqo_pain_financial_impact === false && fields.sqo_pain_category !== '';
  const urgencyBlocked = fields.sqo_urgency === 'longo_prazo';
  const budgetBlocked = fields.sqo_budget === 'nao_caro' || fields.sqo_budget === 'nao_falou';
  const decisionBlocked = fields.sqo_decision_maker === 'outro_nao_mapeado';
  const icpBlocked = fields.sqo_icp_fit === 'nao';

  // Count filled
  const filledCount = [
    !!fields.sqo_pain_category,
    !!fields.sqo_urgency,
    !!fields.sqo_budget,
    !!fields.sqo_decision_maker,
    !!fields.sqo_icp_fit,
  ].filter(Boolean).length;

  const painOptions: ToggleOption[] = PAIN_CATEGORIES.map(p => ({ value: p, label: p }));

  return (
    <div className="mb-4">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-medium">Validação de SQO</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1 w-3 rounded-full transition-colors',
                    i < filledCount ? 'bg-primary' : 'bg-muted'
                  )}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{filledCount}/5</span>
          </div>
        </div>
        <div className="p-3 space-y-2">
        {/* Observações do SDR (destaque) */}
        {lead.qualification_notes && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex gap-2 items-start">
            <ClipboardList className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <Label className="text-xs font-semibold text-primary">Observações do SDR</Label>
              <p className="text-xs text-foreground whitespace-pre-wrap mt-1">{lead.qualification_notes}</p>
            </div>
          </div>
        )}
        {/* 1. Dor clara e específica */}
        <FieldCard
          icon={<Target className="h-3 w-3" />}
          label="Dor clara e específica"
          number={1}
          filled={!!fields.sqo_pain_category}
          blocked={painBlocked}
        >
          <p className="text-xs text-muted-foreground mb-2">Qual problema concreto o cliente quer resolver?</p>
          <ToggleButtonGroup
            options={[...painOptions, { value: 'outro', label: 'Outro' }]}
            value={fields.sqo_pain_category || ''}
            onChange={(v) => handleChange('sqo_pain_category', v)}
            disabled={readOnly}
            multi
          />
          {(fields.sqo_pain_category || '').split(',').includes('outro') && (
            <Input
              className="mt-2 h-8 text-xs"
              placeholder="Descreva a dor..."
              value={fields.sqo_pain_other || ''}
              onChange={(e) => handleChange('sqo_pain_other', e.target.value)}
              disabled={readOnly}
            />
          )}
          <div className="mt-3 space-y-1.5">
            <CheckToggle
              checked={fields.sqo_pain_clear || false}
              onChange={(v) => handleChange('sqo_pain_clear', v)}
              label="A dor foi explicada de forma clara"
              disabled={readOnly}
            />
            <CheckToggle
              checked={fields.sqo_pain_financial_impact || false}
              onChange={(v) => handleChange('sqo_pain_financial_impact', v)}
              label="A dor impacta resultado financeiro ou operação"
              blocker
              disabled={readOnly}
            />
          </div>
        </FieldCard>

        {/* 2. Urgência real */}
        <FieldCard
          icon={<Clock className="h-3 w-3" />}
          label="Urgência real"
          number={2}
          filled={!!fields.sqo_urgency}
          blocked={urgencyBlocked}
        >
          <p className="text-xs text-muted-foreground mb-2">Quando o cliente pretende resolver esse problema?</p>
          <ToggleButtonGroup
            options={URGENCY_OPTIONS}
            value={fields.sqo_urgency || ''}
            onChange={(v) => handleChange('sqo_urgency', v)}
            blockers={['longo_prazo']}
            disabled={readOnly}
          />
        </FieldCard>

        {/* 3. Orçamento compatível */}
        <FieldCard
          icon={<DollarSign className="h-3 w-3" />}
          label="Orçamento compatível"
          number={3}
          filled={!!fields.sqo_budget}
          blocked={budgetBlocked}
        >
          <p className="text-xs text-muted-foreground mb-2">O cliente demonstrou capacidade e disposição de pagar?</p>
          <ToggleButtonGroup
            options={BUDGET_OPTIONS}
            value={fields.sqo_budget || ''}
            onChange={(v) => handleChange('sqo_budget', v)}
            blockers={['nao_caro', 'nao_falou']}
            disabled={readOnly}
          />
        </FieldCard>

        {/* 4. Poder de decisão */}
        <FieldCard
          icon={<UserCheck className="h-3 w-3" />}
          label="Poder de decisão"
          number={4}
          filled={!!fields.sqo_decision_maker}
          blocked={decisionBlocked}
        >
          <p className="text-xs text-muted-foreground mb-2">Quem toma a decisão final?</p>
          <ToggleButtonGroup
            options={DECISION_MAKER_OPTIONS}
            value={fields.sqo_decision_maker || ''}
            onChange={(v) => handleChange('sqo_decision_maker', v)}
            blockers={['outro_nao_mapeado']}
            disabled={readOnly}
          />
        </FieldCard>

        {/* 5. Fit com ICP */}
        <FieldCard
          icon={<ShieldCheck className="h-3 w-3" />}
          label="Fit com ICP"
          number={5}
          filled={!!fields.sqo_icp_fit}
          blocked={icpBlocked}
        >
          <p className="text-xs text-muted-foreground mb-2">O lead está dentro do ICP definido?</p>
          <ToggleButtonGroup
            options={ICP_FIT_OPTIONS}
            value={fields.sqo_icp_fit || ''}
            onChange={(v) => handleChange('sqo_icp_fit', v)}
            blockers={['nao']}
            disabled={readOnly}
          />
          {fields.sqo_icp_fit === 'parcial' && (
            <p className="text-xs text-warning mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Parcial — depende dos demais critérios
            </p>
          )}
        </FieldCard>


        {/* 7. Veredito final (automático) */}
        <div className={cn(
          'rounded-lg border-2 p-4 transition-all',
          filledCount === 0
            ? 'border-muted bg-muted/30'
            : verdict.approved
              ? 'border-[hsl(160,84%,39%)]/50 bg-[hsl(160,84%,39%)]/10'
              : 'border-destructive/50 bg-destructive/10'
        )}>
          <div className="flex items-center gap-2 mb-1">
            {filledCount === 0 ? (
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            ) : verdict.approved ? (
              <CheckCircle2 className="h-5 w-5 text-[hsl(160,84%,39%)]" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            <span className={cn(
              'text-xs font-bold',
              filledCount === 0
                ? 'text-muted-foreground'
                : verdict.approved
                  ? 'text-[hsl(160,84%,39%)]'
                  : 'text-destructive'
            )}>
              {filledCount === 0
                ? 'Preencha os campos acima'
                : verdict.approved
                  ? '✅ SQO APROVADO'
                  : '❌ NÃO É SQO'}
            </span>
          </div>
          {!verdict.approved && filledCount > 0 && (
            <ul className="text-xs text-destructive/80 space-y-0.5 mt-2 ml-7">
              {verdict.reasons.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};
