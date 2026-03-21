import { useRevenueForecast } from '@/hooks/useRevenueForecast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Loader2, DollarSign, BarChart3, ArrowUp, ArrowDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const formatCompact = (v: number) => {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v}`;
};

const scenarioStyles = [
  { bg: 'bg-muted/50', text: 'text-muted-foreground', border: 'border-border' },
  { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30' },
  { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30' },
];

export function RevenueForecastPanel() {
  const { data, isLoading } = useRevenueForecast();

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const trend = data.weightedTotal > data.historicalMonthlyAvg ? 'up' : 'down';

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        Forecast de Receita
      </h2>

      {/* Scenario Cards */}
      <div className="grid grid-cols-3 gap-3">
        {data.scenarios.map((scenario, i) => (
          <Card key={scenario.label} className={cn('border', scenarioStyles[i].border)}>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{scenario.label}</p>
              <p className={cn('text-lg font-bold', scenarioStyles[i].text)}>{formatCompact(scenario.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Summary */}
      <div className="flex items-center gap-4 text-xs">
        <div>
          <span className="text-muted-foreground">Pipeline Total: </span>
          <span className="font-semibold">{formatCurrency(data.totalPipeline)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Ponderado: </span>
          <span className="font-semibold text-primary">{formatCurrency(data.weightedTotal)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Deals: </span>
          <span className="font-semibold">{data.activeDeals}</span>
        </div>
        <div className="flex items-center gap-1">
          {trend === 'up' ? <ArrowUp className="h-3 w-3 text-success" /> : <ArrowDown className="h-3 w-3 text-destructive" />}
          <span className={cn('text-xs font-medium', trend === 'up' ? 'text-success' : 'text-destructive')}>
            vs histórico
          </span>
        </div>
      </div>

      {/* Stage Funnel */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pipeline por Estágio</h3>
          {data.stages.map(stage => (
            <div key={stage.stage} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{stage.stage}</span>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>{stage.count} deals</span>
                  <span>{formatCompact(stage.totalValue)}</span>
                  <Badge variant="outline" className="text-[10px] h-4">{Math.round(stage.probability * 100)}%</Badge>
                  <span className="font-semibold text-primary">{formatCompact(stage.weightedValue)}</span>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${stage.probability * 100}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Monthly Projection Chart */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Projeção Mensal</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.monthlyProjection}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-[10px]" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={formatCompact} className="text-[10px]" tick={{ fontSize: 10 }} width={60} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Area type="monotone" dataKey="optimistic" name="Otimista" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.1} strokeWidth={1.5} />
              <Area type="monotone" dataKey="realistic" name="Realista" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
              <Area type="monotone" dataKey="conservative" name="Conservador" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
