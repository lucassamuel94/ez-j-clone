import { useDailyBriefing } from '@/hooks/useDailyBriefing';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Sparkles, Loader2, Lightbulb, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

interface DailyBriefingCardProps {
  role: string;
  stats: Record<string, number>;
}

export function DailyBriefingCard({ role, stats }: DailyBriefingCardProps) {
  const { briefing, generate, isLoading, isFromCache } = useDailyBriefing();

  if (!briefing) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-4 flex flex-col items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary" />
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Briefing Diário com IA</p>
            <p className="text-xs text-muted-foreground mt-1">Receba prioridades e alertas personalizados</p>
          </div>
          <Button
            size="sm" className="gap-2"
            onClick={() => generate.mutate({ role, stats })}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {isLoading ? 'Gerando...' : 'Gerar Briefing'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const scoreColor = briefing.score >= 70 ? 'text-success' : briefing.score >= 40 ? 'text-warning' : 'text-destructive';

  return (
    <Card className="border-primary/20 overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{briefing.greeting}</p>
            {isFromCache && (
              <button
                className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                onClick={() => generate.mutate({ role, stats })}
              >
                <RefreshCw className="h-2.5 w-2.5" /> Atualizar
              </button>
            )}
          </div>
          <div className="flex flex-col items-center">
            <span className={cn('text-2xl font-bold tabular-nums', scoreColor)}>{briefing.score}</span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Saúde</span>
          </div>
        </div>

        {/* Priorities */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1.5">Prioridades</p>
          <ul className="space-y-1.5">
            {briefing.priorities.map((priority, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground">{priority}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Alerts */}
        {briefing.alerts.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1.5">Alertas</p>
              <ul className="space-y-1.5">
                {briefing.alerts.map((alert, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{alert}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Tip */}
        <div className="flex items-start gap-2 p-2 rounded-md bg-primary/5 border border-primary/10">
          <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-foreground">{briefing.tip}</p>
        </div>
      </CardContent>
    </Card>
  );
}
