import { useState, useMemo, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Sparkles, Loader2, Bot, Copy, Check } from 'lucide-react';

interface VariableDef {
  key: string;
  label?: string;
}

interface VariableCategory {
  label: string;
  vars: VariableDef[];
}

// ── Variables per module ──

const VARS_LEADS: VariableCategory[] = [
  { label: 'Lead', vars: [
    { key: 'lead_name', label: 'Nome do lead' }, { key: 'empresa', label: 'Empresa' },
    { key: 'cnpj', label: 'CNPJ' }, { key: 'sdr', label: 'SDR responsável' },
    { key: 'fonte', label: 'Fonte/origem' }, { key: 'telefone', label: 'Telefone' },
    { key: 'email', label: 'E-mail' }, { key: 'status', label: 'Status do lead' },
  ]},
  { label: 'Métricas SDR', vars: [
    { key: 'total_agendado', label: 'Agendamentos' }, { key: 'total_realizado', label: 'Realizados' },
    { key: 'total_sqo', label: 'SQOs' },
  ]},
  { label: 'Metas', vars: [
    { key: 'meta_agendado', label: 'Meta agendamento' }, { key: 'percentual_agendado', label: '% agendamento' },
  ]},
  { label: 'Tempo', vars: [{ key: 'dias_uteis_restantes' }, { key: 'dias_uteis_decorridos' }] },
];

const VARS_CLOSER: VariableCategory[] = [
  { label: 'Oportunidade', vars: [
    { key: 'lead_name', label: 'Nome do lead' }, { key: 'empresa', label: 'Empresa' },
    { key: 'cnpj', label: 'CNPJ' }, { key: 'closer', label: 'Closer' },
    { key: 'sdr', label: 'SDR de origem' }, { key: 'valor', label: 'Valor da oportunidade' },
    { key: 'estagio', label: 'Estágio atual' }, { key: 'motivo_perda', label: 'Motivo da perda' },
    { key: 'link_negociacao', label: 'Link da negociação' },
  ]},
  { label: 'Métricas Closer', vars: [
    { key: 'total_vendas', label: 'Total vendas' }, { key: 'valor_vendas', label: 'Valor vendas' },
    { key: 'total_propostas', label: 'Propostas enviadas' },
  ]},
  { label: 'Metas', vars: [
    { key: 'meta_vendas', label: 'Meta vendas' }, { key: 'percentual_vendas', label: '% vendas' },
  ]},
  { label: 'Tempo', vars: [{ key: 'dias_uteis_restantes' }, { key: 'dias_uteis_decorridos' }] },
];

const VARS_EVOLUTION: VariableCategory[] = [
  { label: 'Evolução', vars: [
    { key: 'lead_name', label: 'Nome do cliente' }, { key: 'empresa', label: 'Empresa' },
    { key: 'cnpj', label: 'CNPJ' }, { key: 'closer', label: 'Closer' },
    { key: 'valor', label: 'Valor' }, { key: 'estagio', label: 'Estágio atual' },
    { key: 'link_negociacao', label: 'Link da negociação' },
  ]},
  { label: 'Métricas', vars: [
    { key: 'total_vendas', label: 'Total vendas' }, { key: 'valor_vendas', label: 'Valor vendas' },
  ]},
  { label: 'Tempo', vars: [{ key: 'dias_uteis_restantes' }, { key: 'dias_uteis_decorridos' }] },
];

const VARS_PROJECTS: VariableCategory[] = [
  { label: 'Projeto', vars: [
    { key: 'projeto', label: 'Nome do projeto' }, { key: 'empresa', label: 'Empresa' },
    { key: 'cnpj', label: 'CNPJ' }, { key: 'fase', label: 'Fase atual' },
    { key: 'status_fase', label: 'Status da fase' }, { key: 'data_inicio', label: 'Data de início' },
    { key: 'prazo', label: 'Prazo' }, { key: 'dias_em_fase', label: 'Dias na fase' },
    { key: 'link_projeto', label: 'Link do projeto' },
  ]},
  { label: 'Equipe do Projeto', vars: [
    { key: 'head', label: 'Head Pós-Venda' }, { key: 'ux_po', label: 'UX/PO' },
    { key: 'dev', label: 'Dev Chatbot' }, { key: 'treinamento', label: 'Treinamento' },
    { key: 'closer', label: 'Closer da venda' }, { key: 'sdr', label: 'SDR de origem' },
  ]},
  { label: 'Cliente', vars: [
    { key: 'lead_name', label: 'Contato principal' }, { key: 'telefone', label: 'Telefone' },
    { key: 'email', label: 'E-mail' }, { key: 'website', label: 'Website' },
  ]},
];

const VARS_DEFAULT: VariableCategory[] = [
  { label: 'Contexto', vars: [
    { key: 'lead_name' }, { key: 'empresa' }, { key: 'sdr' }, { key: 'closer' }, { key: 'valor' },
  ]},
  { label: 'Tempo', vars: [{ key: 'dias_uteis_restantes' }, { key: 'dias_uteis_decorridos' }] },
];

const VARS_API_ANALYSIS: VariableCategory[] = [
  { label: 'Análise de API', vars: [
    { key: 'titulo_analise', label: 'Título da análise' },
    { key: 'descricao_analise', label: 'Descrição da solicitação' },
    { key: 'viabilidade', label: 'Viabilidade (resultado)' },
    { key: 'solicitante', label: 'Nome do solicitante' },
    { key: 'responsavel_analise', label: 'Responsável pela análise' },
    { key: 'prazo_analise', label: 'Prazo da análise' },
    { key: 'status_analise', label: 'Status da análise' },
    { key: 'link_analise', label: 'Link da análise' },
  ]},
  { label: 'Equipe', vars: [
    { key: 'closer', label: 'Closer' },
    { key: 'dev', label: 'Dev responsável' },
  ]},
];

const MODULE_VARIABLES: Record<string, VariableCategory[]> = {
  sdr: VARS_LEADS,
  closer: VARS_CLOSER,
  evolution: VARS_EVOLUTION,
  projects: VARS_PROJECTS,
  api_analysis: VARS_API_ANALYSIS,
};

interface MessageComposerProps {
  value: string;
  onChange: (val: string) => void;
  aiEnabled: boolean;
  onAiEnabledChange: (v: boolean) => void;
  aiPrompt: string;
  onAiPromptChange: (v: string) => void;
  triggerModule?: string;
}

export function MessageComposer({ value, onChange, aiEnabled, onAiEnabledChange, aiPrompt, onAiPromptChange, triggerModule }: MessageComposerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const variableCategories = useMemo(() => {
    if (!triggerModule) return VARS_DEFAULT;
    return MODULE_VARIABLES[triggerModule] || VARS_DEFAULT;
  }, [triggerModule]);

  const insertVariable = useCallback((key: string) => {
    const tag = `{{${key}}}`;
    if (aiEnabled) {
      onAiPromptChange(aiPrompt + tag);
    } else {
      onChange(value + tag);
    }
    setCopiedVar(key);
    setTimeout(() => setCopiedVar(null), 800);
  }, [aiEnabled, aiPrompt, onAiPromptChange, onChange, value]);

  const generatePreview = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Digite um contexto/prompt para a IA');
      return;
    }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-auto-message', {
        body: { action: 'generate', context: aiPrompt },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      if (data?.text) {
        onChange(data.text);
        toast.success('Preview gerado pela IA!');
      }
    } catch {
      toast.error('Erro ao gerar preview com IA');
    } finally {
      setIsGenerating(false);
    }
  };

  const charCount = aiEnabled ? aiPrompt.length : value.length;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-5">
        {/* AI toggle card */}
        <div className={cn(
          'flex items-center justify-between rounded-xl border px-4 py-3.5 transition-all duration-200',
          aiEnabled
            ? 'border-primary/30 bg-primary/8'
            : 'border-border bg-card'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'h-9 w-9 rounded-lg flex items-center justify-center transition-colors duration-200',
              aiEnabled ? 'bg-primary/15' : 'bg-muted'
            )}>
              <Sparkles className={cn(
                'h-4.5 w-4.5 transition-colors duration-200',
                aiEnabled ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Personalizar com IA</p>
              <p className="text-[11px] text-muted-foreground">A IA gera a mensagem final no momento do envio</p>
            </div>
          </div>
          <Switch
            checked={aiEnabled}
            onCheckedChange={onAiEnabledChange}
            aria-label="Ativar personalização com IA"
          />
        </div>

        {aiEnabled ? (
          <div className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
            {/* AI Prompt */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Prompt / Contexto para a IA
              </Label>
              <div className="relative">
                <Textarea
                  value={aiPrompt}
                  onChange={(e) => onAiPromptChange(e.target.value)}
                  placeholder="Ex: Parabenize o SDR {{sdr}} pelos agendamentos do dia. Mencione o total {{total_agendado}} e motive a continuar."
                  className="min-h-[120px] resize-y bg-card border-border text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 pr-14"
                />
                <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/60 pointer-events-none">
                  {charCount}
                </span>
              </div>
            </div>

          </div>
        ) : (
          /* Manual body */
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Corpo da Mensagem</Label>
            <div className="relative">
              <Textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Digite sua mensagem aqui. Use {{variavel}} para inserir dados dinâmicos..."
                className="min-h-[120px] resize-y bg-card border-border font-mono text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 pr-14"
              />
              <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/60 pointer-events-none">
                {charCount}
              </span>
            </div>
          </div>
        )}

        {/* Variables */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Variáveis Dinâmicas
            </Label>
            {!triggerModule && (
              <span className="text-[10px] font-normal text-muted-foreground/60 normal-case tracking-normal">
                (selecione um módulo para ver variáveis específicas)
              </span>
            )}
          </div>
          <div className="space-y-4">
            {variableCategories.map((cat) => (
              <div key={cat.label} className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 block">
                  {cat.label}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {cat.vars.map((v) => (
                    <Tooltip key={v.key}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => insertVariable(v.key)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border transition-all duration-150 cursor-pointer',
                            'bg-secondary border-transparent text-secondary-foreground',
                            'hover:bg-primary/10 hover:text-primary hover:border-primary/30',
                            copiedVar === v.key && 'border-primary/60 text-primary bg-primary/10'
                          )}
                        >
                          {copiedVar === v.key ? (
                            <Check className="h-2.5 w-2.5" />
                          ) : (
                            <Copy className="h-2.5 w-2.5 opacity-40" />
                          )}
                          {`{{${v.key}}}`}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {copiedVar === v.key ? 'Copiado!' : (v.label || v.key)}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
