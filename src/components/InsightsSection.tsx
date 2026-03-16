import { useState, useCallback, useMemo } from 'react';
import { Lead } from '@/types/lead';
import { supabase } from '@/integrations/supabase/client';
import {
  Sparkles, Loader2, Zap, Link2, Target, HelpCircle, AlertTriangle,
  Lightbulb, RefreshCw, Clock, MessageSquare, Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, differenceInDays, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InsightCategory {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const CHATBOT_CATEGORIES: InsightCategory[] = [
  { key: 'automacoes', label: 'Automações Sugeridas', icon: <Zap className="h-3.5 w-3.5" />, color: 'text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/30' },
  { key: 'integracoes', label: 'Integrações', icon: <Link2 className="h-3.5 w-3.5" />, color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30' },
  { key: 'argumentos', label: 'Argumentos de Venda', icon: <Target className="h-3.5 w-3.5" />, color: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30' },
  { key: 'perguntas', label: 'Perguntas de Descoberta', icon: <HelpCircle className="h-3.5 w-3.5" />, color: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30' },
];

const PABX_CATEGORIES: InsightCategory[] = [
  { key: 'diferenciais', label: 'Diferenciais Competitivos', icon: <Sparkles className="h-3.5 w-3.5" />, color: 'text-primary bg-primary/10' },
  { key: 'argumentos', label: 'Argumentos de Venda', icon: <Target className="h-3.5 w-3.5" />, color: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30' },
  { key: 'perguntas', label: 'Perguntas de Descoberta', icon: <HelpCircle className="h-3.5 w-3.5" />, color: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30' },
  { key: 'riscos', label: 'Objeções e Riscos', icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-destructive bg-destructive/10' },
];

// Legacy categories (old format fallback)
const LEGACY_CATEGORIES: InsightCategory[] = [
  { key: 'diferenciais', label: 'Diferenciais Competitivos', icon: <Sparkles className="h-3.5 w-3.5" />, color: 'text-primary bg-primary/10' },
  { key: 'automacoes', label: 'Automações Sugeridas', icon: <Zap className="h-3.5 w-3.5" />, color: 'text-chart-4 bg-chart-4/10' },
  { key: 'integracoes', label: 'Integrações Recomendadas', icon: <Link2 className="h-3.5 w-3.5" />, color: 'text-chart-1 bg-chart-1/10' },
  { key: 'argumentos_venda', label: 'Argumentos de Venda', icon: <Target className="h-3.5 w-3.5" />, color: 'text-chart-2 bg-chart-2/10' },
  { key: 'perguntas_descoberta', label: 'Perguntas de Descoberta', icon: <HelpCircle className="h-3.5 w-3.5" />, color: 'text-chart-3 bg-chart-3/10' },
  { key: 'riscos', label: 'Objeções e Riscos', icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-destructive bg-destructive/10' },
];

interface InsightsSectionProps {
  lead: Lead;
  onUpdateLead?: (lead: Lead) => void;
}

function migrateOldInsights(raw: Record<string, unknown>): Record<string, unknown> {
  if ('chatbot' in raw || 'pabx' in raw) return raw;
  const get = (k: string): string[] => (Array.isArray(raw[k]) ? raw[k] as string[] : []);
  return {
    chatbot: {
      automacoes: get('automacoes'),
      integracoes: get('integracoes'),
      argumentos: get('argumentos_venda'),
      perguntas: get('perguntas_descoberta'),
    },
    pabx: {
      diferenciais: get('diferenciais'),
      argumentos: get('argumentos_venda'),
      perguntas: get('perguntas_descoberta'),
      riscos: get('riscos'),
    },
  };
}

function CategoryBlock({
  category,
  items,
}: {
  category: InsightCategory;
  items: string[];
}) {
  return (
    <div className="rounded-md border bg-accent/20 overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <span className={cn('h-4 w-4 flex items-center justify-center rounded shrink-0', category.color)}>
          {category.icon}
        </span>
        <span className="text-[11px] font-semibold">{category.label}</span>
      </div>
      <div className="px-2.5 pb-2 space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[11px] text-foreground">
            <span className="mt-1.5 h-1 w-1 rounded-full bg-primary/60 shrink-0" />
            <span className="leading-relaxed">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductCard({
  title,
  subtitle,
  icon,
  headerClass,
  categories,
  data,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  headerClass: string;
  categories: InsightCategory[];
  data: Record<string, string[]> | undefined;
}) {
  const visibleCategories = categories.filter(c => (data?.[c.key]?.length ?? 0) > 0);

  return (
    <div className="rounded-lg border bg-card overflow-hidden flex flex-col">
      <div className={cn('flex items-center gap-2 px-3 py-2 border-b', headerClass)}>
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0">
          <span className="text-xs font-bold">{title}</span>
          <span className="text-[10px] text-muted-foreground ml-1.5">{subtitle}</span>
        </div>
      </div>
      <div className="p-2 space-y-1.5 flex-1">
        {visibleCategories.length === 0 ? (
          <p className="text-[11px] text-muted-foreground py-4 text-center">Nenhum insight gerado.</p>
        ) : (
          visibleCategories.map((cat) => (
            <CategoryBlock key={cat.key} category={cat} items={data![cat.key]} />
          ))
        )}
      </div>
    </div>
  );
}

function InsightsSectionInner({ lead, onUpdateLead }: InsightsSectionProps) {
  const stored = lead.ai_insights_data as Record<string, unknown> | null | undefined;
  const migrated = stored ? migrateOldInsights(stored) : null;
  const [insights, setInsights] = useState<Record<string, unknown> | null>(migrated);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(!!migrated);

  const [activeProduct, setActiveProduct] = useState<'pabx' | 'chatbot'>('pabx');

  const cooldownMonths = 3;

  const { canRegenerate, nextAvailableDate } = useMemo(() => {
    if (!lead.ai_insights_generated_at) return { canRegenerate: true, nextAvailableDate: null };
    const generatedAt = new Date(lead.ai_insights_generated_at);
    const nextDate = addMonths(generatedAt, cooldownMonths);
    const now = new Date();
    return { canRegenerate: now >= nextDate, nextAvailableDate: nextDate };
  }, [lead.ai_insights_generated_at]);

  // Cooldown always applies (migration handles old format automatically)
  const effectiveCanRegenerate = canRegenerate;

  const handleRegenerate = useCallback(() => {
    if (!effectiveCanRegenerate && nextAvailableDate) {
      const generatedAt = lead.ai_insights_generated_at ? new Date(lead.ai_insights_generated_at) : null;
      const generatedDateStr = generatedAt ? format(generatedAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '';
      const availableDateStr = format(nextAvailableDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      const daysLeft = differenceInDays(nextAvailableDate, new Date());
      toast.info('Regeneração indisponível', {
        description: `Os insights foram gerados em ${generatedDateStr}. Próxima data disponível: ${availableDateStr} (${daysLeft} dia${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}).`,
        duration: 8000,
      });
      return;
    }
    generateInsights();
  }, [effectiveCanRegenerate, nextAvailableDate, lead.ai_insights_generated_at]);

  const generateInsights = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: { lead },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      setInsights(data.insights);
      setHasGenerated(true);

      if (onUpdateLead) {
        onUpdateLead({ ...lead, ai_insights_data: data.insights, ai_insights_generated_at: new Date().toISOString() } as Lead);
      }
      toast.success('Insights gerados com sucesso!');
    } catch (e) {
      console.error('Error generating insights:', e);
      toast.error('Erro ao gerar insights');
    } finally {
      setIsLoading(false);
    }
  }, [lead]);

  const hasData = lead.cnpj || lead.company || lead.razao_social;

  const SectionHeader = (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary">
          <Lightbulb className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-medium">Insights de TI</span>
        {lead.ai_insights_generated_at && (
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            · {format(new Date(lead.ai_insights_generated_at), "dd/MM/yyyy", { locale: ptBR })}
          </span>
        )}
      </div>
      {hasGenerated && (
        <button
          onClick={handleRegenerate}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-1 text-xs transition-colors disabled:opacity-50',
            effectiveCanRegenerate ? 'text-muted-foreground hover:text-primary' : 'text-muted-foreground/50 cursor-not-allowed',
          )}
        >
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : effectiveCanRegenerate ? <RefreshCw className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          {isLoading ? 'Gerando...' : effectiveCanRegenerate ? 'Regenerar' : 'Bloqueado'}
        </button>
      )}
    </div>
  );

  if (!hasData) {
    return (
      <div className="mb-4">
        {SectionHeader}
        <div className="rounded-lg border bg-card p-6 flex flex-col items-center justify-center text-center">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <Lightbulb className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            Preencha os dados da empresa (CNPJ ou nome) para gerar insights personalizados.
          </p>
        </div>
      </div>
    );
  }

  if (!hasGenerated) {
    return (
      <div className="mb-4">
        {SectionHeader}
        <div className="rounded-lg border bg-card p-6 flex flex-col items-center justify-center text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Lightbulb className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xs font-semibold mb-1">Insights de TI com IA</h3>
          <p className="text-xs text-muted-foreground mb-4 max-w-sm">
            Gere insights separados por produto — <strong>Chatbot</strong> e <strong>PABX</strong> — com automações, integrações, argumentos de venda e perguntas de descoberta para este lead.
          </p>
          <style>{`
            @keyframes liquid-shift-insight {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }
            @keyframes shine-sweep-insight {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
          <button
            className="relative flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-medium rounded-xl overflow-hidden transition-all duration-300 group disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={generateInsights}
            disabled={isLoading}
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.06))',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid hsl(var(--primary) / 0.25)',
              boxShadow: '0 0 20px hsl(var(--primary) / 0.08), inset 0 1px 0 hsl(var(--primary) / 0.15), inset 0 -1px 0 hsl(var(--primary) / 0.05)',
            }}
          >
            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.08), hsl(var(--primary) / 0.18))',
                backgroundSize: '200% 200%',
                animation: 'liquid-shift-insight 3s ease infinite',
              }} />
            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
              style={{
                background: 'linear-gradient(105deg, transparent 40%, hsl(var(--primary) / 0.15) 45%, hsl(var(--primary) / 0.25) 50%, hsl(var(--primary) / 0.15) 55%, transparent 60%)',
                backgroundSize: '200% 100%',
                animation: 'shine-sweep-insight 2s ease-in-out infinite',
              }} />
            <span className="relative z-10 flex items-center gap-2 text-primary">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 group-hover:animate-pulse" />}
              {isLoading ? 'Gerando insights...' : 'Gerar Insights com IA'}
            </span>
          </button>
        </div>
      </div>
    );
  }
  // Sub-tabs layout (migration ensures data is always in new format)
  const chatbotData = (insights as Record<string, Record<string, string[]>>).chatbot;
  const pabxData = (insights as Record<string, Record<string, string[]>>).pabx;

  return (
    <div className="mb-4">
      {SectionHeader}
      <div className="flex border-b mb-3">
        <button
          onClick={() => setActiveProduct('pabx')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
            activeProduct === 'pabx'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Phone className="h-3.5 w-3.5" />
          EZCall — PABX
        </button>
        <button
          onClick={() => setActiveProduct('chatbot')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
            activeProduct === 'chatbot'
              ? 'border-violet-500 text-violet-600 dark:text-violet-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          EZChat — Chatbot
        </button>
      </div>
      {activeProduct === 'pabx' ? (
        <ProductCard
          title="EZCall"
          subtitle="PABX em Nuvem"
          icon={<Phone className="h-3.5 w-3.5 text-primary" />}
          headerClass="bg-primary/5 border-primary/10"
          categories={PABX_CATEGORIES}
          data={pabxData}
        />
      ) : (
        <ProductCard
          title="EZChat"
          subtitle="Chatbot de Atendimento"
          icon={<MessageSquare className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />}
          headerClass="bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800/40"
          categories={CHATBOT_CATEGORIES}
          data={chatbotData}
        />
      )}
    </div>
  );
}

// Force HMR cache bust v4
export const InsightsSection = (props: InsightsSectionProps) => {
  return <InsightsSectionInner {...props} />;
};
