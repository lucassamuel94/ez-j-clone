import { useState, useMemo, memo } from 'react';
import { sanitizeHtml } from '@/utils/sanitize';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Sparkles, Loader2, Clock, Users, Building2 } from 'lucide-react';
import { useICPAnalysis } from '@/hooks/useICPAnalysis';
import { ICPChatSection } from './ICPChatSection';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

const ICPBarChart = memo(function ICPBarChart({ title, data }: { title: string; data: ChartData[] }) {
  if (!data || data.length === 0) return null;
  const rowHeight = 40;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * rowHeight)}>
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
            <Tooltip formatter={(value: number) => [value, 'Empresas']} labelFormatter={(label: string) => label} />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});

const ICPPieChart = memo(function ICPPieChart({ title, data }: { title: string; data: ChartData[] }) {
  if (!data || data.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
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
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
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

export function ICPAnalysisSection() {
  const { data: analyses = [], isLoading, generateAnalysis } = useICPAnalysis();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isGenerating = generateAnalysis.isPending;

  const latest = selectedId
    ? analyses.find(a => a.id === selectedId)
    : analyses[0];

  const stats = (latest?.statistics || {}) as Record<string, ChartData[]>;

  const formattedAiAnalysis = useMemo(() => {
    if (!latest?.ai_analysis) return '';
    return sanitizeHtml(formatAIMarkdown(latest.ai_analysis));
  }, [latest?.ai_analysis]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Análise de Perfil ICP</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Perfil ideal de cliente baseado na sua base ativa
          </p>
        </div>
        <Button onClick={() => generateAnalysis.mutate()} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {isGenerating ? 'Analisando clientes…' : 'Gerar Análise de Perfil'}
        </Button>
      </div>

      {/* Progress feedback during generation */}
      {isGenerating && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Gerando análise de perfil…</p>
              <p className="text-xs text-muted-foreground">Enriquecendo dados e consultando IA. Isso pode levar até 1 minuto.</p>
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
      ) : (
        <>
          {/* History tabs */}
          {analyses.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {analyses.map(a => (
                <Badge
                  key={a.id}
                  variant={a.id === (latest?.id) ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setSelectedId(a.id)}
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {format(new Date(a.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  <span className="ml-1 opacity-70">({a.clients_analyzed} clientes)</span>
                </Badge>
              ))}
            </div>
          )}

          {latest && (
            <>
              {/* Summary */}
              <div className="flex gap-4">
                <Badge variant="secondary" className="gap-1.5">
                  <Users className="h-3 w-3" /> {latest.clients_analyzed} clientes analisados
                </Badge>
                <Badge variant="outline" className="gap-1.5">
                  <Clock className="h-3 w-3" /> {format(new Date(latest.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </Badge>
              </div>

              {/* ICP Chat */}
              <ICPChatSection analysisId={latest.id} />

              {/* Charts grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ICPBarChart title="Top CNAEs" data={stats.top_cnaes} />
                <ICPBarChart title="Top CNAEs Secundários" data={stats.top_sub_cnaes} />
                <ICPPieChart title="Distribuição por Porte" data={stats.porte_distribution} />
                <ICPBarChart title="Top Cidades/Estados" data={stats.top_locations} />
                <ICPBarChart title="Faixa de Faturamento" data={stats.revenue_distribution} />
                <ICPBarChart title="Faixa de Funcionários" data={stats.employee_distribution} />
              </div>

              {/* AI Analysis — now with markdown rendering */}
              {latest.ai_analysis && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Análise Descritiva (IA)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="prose prose-sm max-w-none text-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-1.5 [&_li]:py-0.5 [&_p]:my-1"
                      dangerouslySetInnerHTML={{ __html: formattedAiAnalysis }}
                    />
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
