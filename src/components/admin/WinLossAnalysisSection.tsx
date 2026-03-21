import { useWinLossData, useWinLossAIAnalysis, WinLossInsight } from '@/hooks/useWinLossAnalysis';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Sparkles, Loader2, Trophy, XCircle, Calendar, DollarSign, AlertTriangle, CheckCircle, Target } from 'lucide-react';

const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const confidenceStyles: Record<string, string> = {
  alta: 'bg-success/10 text-success border-success/20',
  média: 'bg-warning/10 text-warning border-warning/20',
  baixa: 'bg-muted text-muted-foreground border-border',
};

export function WinLossAnalysisSection() {
  const { data, isLoading } = useWinLossData();
  const aiAnalysis = useWinLossAIAnalysis();

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const insight = aiAnalysis.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Análise Win/Loss
        </h2>
        <Button
          variant="outline" size="sm" className="gap-1.5"
          onClick={() => aiAnalysis.mutate({ wonDeals: data.wonDeals, lostDeals: data.lostDeals })}
          disabled={aiAnalysis.isPending}
        >
          {aiAnalysis.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Analisar com IA
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-primary">{data.winRate}%</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Win Rate</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-success">{data.totalWon}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ganhos</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-destructive">{data.totalLost}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Perdidos</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{formatCurrency(data.avgWonValue)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ticket Médio</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{data.avgDaysToClose}d</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ciclo Médio</p>
        </CardContent></Card>
      </div>

      {/* AI Analysis */}
      {insight && (
        <div className="space-y-4">
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <p className="text-sm text-foreground leading-relaxed">{insight.summary}</p>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Win Patterns */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-success" /> Padrões de Vitória
              </h3>
              {insight.win_patterns.map((p, i) => (
                <Card key={i} className="border-success/20">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-medium text-foreground flex-1">{p.pattern}</p>
                      <Badge variant="outline" className={cn('text-[10px] h-5', confidenceStyles[p.confidence])}>{p.confidence}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{p.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Loss Patterns */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" /> Padrões de Perda
              </h3>
              {insight.loss_patterns.map((p, i) => (
                <Card key={i} className="border-destructive/20">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-medium text-foreground flex-1">{p.pattern}</p>
                      <Badge variant="outline" className={cn('text-[10px] h-5', confidenceStyles[p.confidence])}>{p.confidence}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{p.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-primary" /> Recomendações
              </h3>
              <ol className="space-y-2">
                {insight.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                    <span className="text-foreground">{rec}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Risk Factors */}
          <div className="flex flex-wrap gap-2">
            {insight.risk_factors.map((factor, i) => (
              <Badge key={i} variant="outline" className="text-xs bg-destructive/5 text-destructive border-destructive/20">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {factor}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
