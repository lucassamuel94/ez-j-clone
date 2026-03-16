import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface TeamMetrics {
  totalDelivered: number;
  teamGoal: number;
}

interface DashboardProductivityCardsProps {
  uxMetrics?: TeamMetrics | null;
  devMetrics?: TeamMetrics | null;
  treinamentoMetrics?: TeamMetrics | null;
}

function getProgressColor(pct: number) {
  if (pct >= 80) return 'text-[hsl(var(--chart-3))]';
  if (pct >= 50) return 'text-[hsl(var(--chart-2))]';
  return 'text-destructive';
}

export function DashboardProductivityCards({ uxMetrics, devMetrics, treinamentoMetrics }: DashboardProductivityCardsProps) {
  if (!uxMetrics && !devMetrics && !treinamentoMetrics) return null;

  const teams = [
    { label: 'UX/PO', metrics: uxMetrics },
    { label: 'Dev Chatbot', metrics: devMetrics },
    { label: 'Treinamento', metrics: treinamentoMetrics },
  ];

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.5} />
            Pipeline de Produtividade (mês atual)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {teams.map((team) => {
            const m = team.metrics;
            const hasGoal = m && m.teamGoal > 0;
            const pct = hasGoal ? Math.min(100, Math.round((m!.totalDelivered / m!.teamGoal) * 100)) : 0;
            return (
              <div key={team.label} className="p-4 rounded-lg border border-border/50">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">{team.label}</p>
                {hasGoal ? (
                  <>
                    <div className="flex items-end justify-between mb-1.5">
                      <span className="text-xl font-bold text-foreground tabular-nums">{m!.totalDelivered}</span>
                      <span className="text-xs text-muted-foreground">de {m!.teamGoal}</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <p className={`text-[10px] mt-1 tabular-nums font-medium ${getProgressColor(pct)}`}>{pct}% da meta</p>
                  </>
                ) : (
                  <div>
                    <span className="text-xl font-bold text-foreground tabular-nums">{m?.totalDelivered ?? 0}</span>
                    <p className="text-[10px] text-muted-foreground mt-1">Meta não definida</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
