import { usePredictiveScore } from '@/hooks/usePredictiveScore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Target, Sparkles, Loader2, TrendingUp, ArrowRight } from 'lucide-react';

interface LeadScoreBreakdownProps {
  lead: Record<string, unknown>;
}

const gradeStyles: Record<string, { bg: string; text: string; ring: string }> = {
  A: { bg: 'bg-success/10', text: 'text-success', ring: 'stroke-success' },
  B: { bg: 'bg-primary/10', text: 'text-primary', ring: 'stroke-primary' },
  C: { bg: 'bg-warning/10', text: 'text-warning', ring: 'stroke-warning' },
  D: { bg: 'bg-destructive/10', text: 'text-destructive', ring: 'stroke-destructive' },
};

export function LeadScoreBreakdown({ lead }: LeadScoreBreakdownProps) {
  const { score, generate, isLoading } = usePredictiveScore();

  if (!score) {
    return (
      <Button
        variant="outline" size="sm"
        className="w-full gap-2 border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5"
        onClick={() => generate.mutate(lead)}
        disabled={isLoading}
      >
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5 text-primary" />}
        {isLoading ? 'Calculando score...' : 'Calcular Score Preditivo'}
      </Button>
    );
  }

  const style = gradeStyles[score.grade] || gradeStyles.D;
  const circumference = 2 * Math.PI * 28;
  const strokeDashoffset = circumference - (score.total_score / 100) * circumference;

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardContent className="p-3 space-y-3">
        {/* Score Gauge */}
        <div className="flex items-center gap-3">
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" className="stroke-muted" strokeWidth="4" />
              <circle cx="32" cy="32" r="28" fill="none" className={style.ring} strokeWidth="4"
                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-lg font-bold', style.text)}>{score.grade}</span>
              <span className="text-[9px] text-muted-foreground">{score.total_score}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Score Preditivo</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-primary" />
              <span className="text-xs text-muted-foreground">
                Conversão: <span className="font-semibold text-foreground">{score.conversion_probability}%</span>
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Factors */}
        <div className="space-y-2">
          {score.factors.map((factor, i) => {
            const pct = factor.max > 0 ? (factor.score / factor.max) * 100 : 0;
            return (
              <div key={i} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-foreground">{factor.name}</span>
                  <span className="text-[10px] text-muted-foreground">{factor.score}/{factor.max}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all',
                      pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-warning' : 'bg-destructive')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">{factor.detail}</p>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Recommendation */}
        <p className="text-xs text-muted-foreground">{score.recommendation}</p>

        {/* Next Action */}
        <div className="flex items-start gap-1.5 p-2 rounded-md bg-primary/5 border border-primary/10">
          <ArrowRight className="h-3 w-3 text-primary shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-foreground">{score.ideal_next_action}</p>
        </div>
      </CardContent>
    </Card>
  );
}
