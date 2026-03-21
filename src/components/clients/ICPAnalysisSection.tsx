import { useState, useMemo, memo } from 'react';
import { sanitizeHtml } from '@/utils/sanitize';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Sparkles, Loader2, Clock, Users, Building2, ChevronDown, Target, BarChart3, Lightbulb, MessageSquareText } from 'lucide-react';
import { useICPAnalysis } from '@/hooks/useICPAnalysis';
import { ICPChatSection } from './ICPChatSection';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ICPProfile {
  porte_tipico: string;
  cnae_principal: string;
  regiao_principal: string;
  faturamento_tipico: string;
  funcionarios_tipico: string;
  resumo_narrativo: string;
}

interface Estrategia {
  titulo: string;
  descricao: string;
  impacto: 'alto' | 'medio';
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary) / 0.6)', 'hsl(var(--chart-3) / 0.7)', 'hsl(var(--chart-4) / 0.7)', 'hsl(var(--chart-5) / 0.7)', 'hsl(var(--chart-2) / 0.7)',
];

const truncateLabel = (label: string, maxLen = 35) =>
  label.length > maxLen ? label.slice(0, maxLen) + '…' : label;

// Memoized chart components to prevent re-renders
interface ChartData { name: string; value: number }

const icpBarChartConfig = {
  value: { label: 'Empresas', color: 'hsl(var(--primary))' },
} satisfies ChartConfig;

const ICPBarChart = memo(function ICPBarChart({ title, data }: { title: string; data: ChartData[] }) {
  if (!data || data.length === 0) return null;
  const rowHeight = 40;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={icpBarChartConfig} className="[&_.recharts-wrapper]:!aspect-auto" style={{ height: Math.max(220, data.length * rowHeight) }}>
          <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              dataKey="name"
              type="category"
              width={220}
              tick={{ fontSize: 11 }}
              tickFormatter={(v: string) => truncateLabel(v)}
              interval={0}
            />
            <ChartTooltip content={<ChartTooltipContent formatter={(value) => [value, 'Empresas']} />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
});

const icpPieChartConfig = {
  value: { label: 'Quantidade' },
} satisfies ChartConfig;

const ICPPieChart = memo(function ICPPieChart({ title, data }: { title: string; data: ChartData[] }) {
  if (!data || data.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={icpPieChartConfig} className="h-[280px] [&_.recharts-wrapper]:!aspect-auto">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={100}
              dataKey="value"
              label={({ name, percent }) => `${truncateLabel(name, 20)} (${(percent * 100).toFixed(0)}%)`}
              labelLine
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
});

function formatAIMarkdown(text: string): string {
  let processed = text
    .replace(/\*\*(.*?)\*\*/g, '⟦B⟧$1⟦/B⟧')
    .replace(/__(.*?)__/g, '⟦B⟧$1⟦/B⟧');

  const lines = processed.split('\n');
  let html = '';
  let listType: 'ul' | 'ol' | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const bulletMatch = trimmed.match(/^[\-•\*]\s+(.+)$/);
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);

    if (bulletMatch) {
      if (listType !== 'ul') {
        if (listType) html += `</${listType}>`;
        html += '<ul>';
        listType = 'ul';
      }
      html += `<li>${bulletMatch[1]}</li>`;
    } else if (orderedMatch) {
      if (listType !== 'ol') {
        if (listType) html += `</${listType}>`;
        html += '<ol>';
        listType = 'ol';
      }
      html += `<li>${orderedMatch[1]}</li>`;
    } else {
      if (listType) { html += `</${listType}>`; listType = null; }
      if (trimmed === '') {
        html += '<div class="h-2"></div>';
      } else {
        html += `<p>${trimmed}</p>`;
      }
    }
  }
  if (listType) html += `</${listType}>`;

  html = html
    .replace(/⟦B⟧/g, '<strong>')
    .replace(/⟦\/B⟧/g, '</strong>');

  html = html.replace(/(?<!\*)(\*)(?!\*)(.*?)(?<!\*)\1(?!\*)/g, '<em>$2</em>');

  return html;
}

interface AccordionSectionProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionSection({ id, icon, title, summary, open, onToggle, children }: AccordionSectionProps) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-muted/50',
              open && 'border-b border-border'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                open ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                {icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                {!open && (
                  <p className="text-xs text-muted-foreground mt-0.5">{summary}</p>
                )}
              </div>
            </div>
            <ChevronDown className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180'
            )} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-6 py-5">
            {children}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function ICPAnalysisSection() {
  const { data: analyses = [], isLoading, generateAnalysis } = useICPAnalysis();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string>('perfil');
  const isGenerating = generateAnalysis.isPending;

  const toggle = (section: string) => setOpenSection(prev => prev === section ? '' : section);

  const latest = selectedId
    ? analyses.find(a => a.id === selectedId)
    : analyses[0];

  const stats = (latest?.statistics || {}) as Record<string, unknown>;
  const chartStats = stats as Record<string, ChartData[]>;
  const icpProfile = stats.icp_profile as ICPProfile | undefined;
  const estrategias = (stats.estrategias || []) as Estrategia[];

  const formattedAiAnalysis = useMemo(() => {
    if (!latest?.ai_analysis) return '';
    return sanitizeHtml(formatAIMarkdown(latest.ai_analysis));
  }, [latest?.ai_analysis]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Análise de Perfil ICP</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Entenda quem é seu cliente ideal e como direcionar sua estratégia.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={() => generateAnalysis.mutate()} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {isGenerating ? 'Analisando clientes…' : 'Gerar Nova Análise'}
          </Button>
          {latest && (
            <p className="text-xs text-muted-foreground">
              Última análise: {format(new Date(latest.created_at), "dd/MM/yyyy", { locale: ptBR })} · {latest.clients_analyzed} clientes
            </p>
          )}
        </div>
      </div>

      {/* Progress bar during generation */}
      {isGenerating && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">Gerando análise de perfil…</p>
                <p className="text-xs text-muted-foreground">Analisando clientes enriquecidos e gerando insights com IA...</p>
              </div>
            </div>
            <div className="h-1.5 bg-primary/10 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '65%' }} />
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : analyses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Building2 className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhuma análise gerada ainda</p>
            <p className="text-xs text-muted-foreground">Importe e enriqueça seus clientes primeiro, depois gere a análise.</p>
          </CardContent>
        </Card>
      ) : latest && (
        <>
          {/* Accordion sections */}
          <div className="space-y-3">
            {/* ① Perfil ICP */}
            <AccordionSection
              id="perfil"
              icon={<Target className="h-4 w-4" />}
              title="Perfil ICP"
              summary="Persona ideal, porte, CNAE, região e resumo narrativo"
              open={openSection === 'perfil'}
              onToggle={() => toggle('perfil')}
            >
              <div className="space-y-5">
                {/* Persona card */}
                <div className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-5">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Porte típico</p>
                      <Badge variant="secondary" className="text-xs">
                        {icpProfile?.porte_tipico || '—'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">CNAE Principal</p>
                      <Badge variant="secondary" className="text-xs">
                        {icpProfile?.cnae_principal || '—'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Região</p>
                      <Badge variant="secondary" className="text-xs">
                        {icpProfile?.regiao_principal || '—'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Faturamento</p>
                      <Badge variant="secondary" className="text-xs">
                        {icpProfile?.faturamento_tipico || '—'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Nº Funcionários</p>
                      <Badge variant="secondary" className="text-xs">
                        {icpProfile?.funcionarios_tipico || '—'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Base Analisada</p>
                      <Badge variant="secondary" className="text-xs">
                        {latest.clients_analyzed} clientes
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Narrative text */}
                {icpProfile?.resumo_narrativo ? (
                  <div className="border-l-4 border-primary pl-4">
                    <p className="text-sm text-foreground leading-relaxed">
                      {icpProfile.resumo_narrativo}
                    </p>
                  </div>
                ) : formattedAiAnalysis ? (
                  <div className="border-l-4 border-primary pl-4">
                    <div
                      className="prose prose-sm max-w-none text-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-1.5 [&_li]:py-0.5 [&_p]:my-1"
                      dangerouslySetInnerHTML={{ __html: formattedAiAnalysis }}
                    />
                  </div>
                ) : null}
              </div>
            </AccordionSection>

            {/* ② Dados da Base */}
            <AccordionSection
              id="dados"
              icon={<BarChart3 className="h-4 w-4" />}
              title="Dados da Base"
              summary="Gráficos detalhados de CNAE, porte, região, faturamento e funcionários"
              open={openSection === 'dados'}
              onToggle={() => toggle('dados')}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ICPBarChart title="Top CNAEs" data={chartStats.top_cnaes as ChartData[]} />
                <ICPBarChart title="Top CNAEs Secundários" data={chartStats.top_sub_cnaes as ChartData[]} />
                <ICPPieChart title="Distribuição por Porte" data={chartStats.porte_distribution as ChartData[]} />
                <ICPBarChart title="Top Cidades/Estados" data={chartStats.top_locations as ChartData[]} />
                <ICPBarChart title="Faixa de Faturamento" data={chartStats.revenue_distribution as ChartData[]} />
                <ICPBarChart title="Faixa de Funcionários" data={chartStats.employee_distribution as ChartData[]} />
              </div>
            </AccordionSection>

            {/* ③ Estratégias Recomendadas */}
            <AccordionSection
              id="estrategias"
              icon={<Lightbulb className="h-4 w-4" />}
              title="Estratégias Recomendadas"
              summary={`${estrategias.length} ações priorizadas por impacto`}
              open={openSection === 'estrategias'}
              onToggle={() => toggle('estrategias')}
            >
              {estrategias.length > 0 ? (
                <div className="space-y-3">
                  {estrategias.map((estrategia, index) => (
                    <div
                      key={index}
                      className={cn(
                        'flex items-start gap-4 rounded-lg border p-4 transition-colors',
                        index === 0 && 'bg-primary/5 border-primary/20'
                      )}
                    >
                      <div className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                        index === 0
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-foreground">{estrategia.titulo}</p>
                          <Badge
                            variant={estrategia.impacto === 'alto' ? 'default' : 'outline'}
                            className={cn(
                              'text-[10px] uppercase tracking-wider shrink-0',
                              estrategia.impacto === 'medio' && 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                            )}
                          >
                            {estrategia.impacto === 'alto' ? 'Alto Impacto' : 'Médio Impacto'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{estrategia.descricao}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma estratégia disponível nesta análise.</p>
              )}
            </AccordionSection>

            {/* ④ Chat IA */}
            <AccordionSection
              id="chat"
              icon={<MessageSquareText className="h-4 w-4" />}
              title="Chat IA"
              summary="Pergunte qualquer coisa sobre o perfil da sua base"
              open={openSection === 'chat'}
              onToggle={() => toggle('chat')}
            >
              <ICPChatSection analysisId={latest.id} />
            </AccordionSection>
          </div>

          {/* Histórico */}
          {analyses.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Histórico de Análises</p>
              <div className="flex gap-2 flex-wrap">
                {analyses.map(a => (
                  <Badge
                    key={a.id}
                    variant={a.id === latest.id ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => setSelectedId(a.id)}
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    {format(new Date(a.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    <span className="ml-1 opacity-70">({a.clients_analyzed} clientes)</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
