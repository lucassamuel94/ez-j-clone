import { useState } from 'react';
import { useDealsAtRisk } from '@/hooks/useDealsAtRisk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { AlertTriangle, Sparkles, Loader2, ChevronDown, Clock, Target, DollarSign } from 'lucide-react';

const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const riskStyles: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-warning/10 text-warning border-warning/20',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  low: 'bg-success/10 text-success border-success/20',
};

export function DealsAtRiskPanel() {
  const { stuckDeals, isLoading, analyzeRisks, aiAnalysis, isAnalyzing } = useDealsAtRisk();
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(new Set());

  const toggleDeal = (id: string) => {
    setExpandedDeals(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (isLoading) return null;
  if (stuckDeals.length === 0) return null;

  return (
    <Card className="border-warning/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Deals em Risco
            <Badge variant="secondary" className="text-[10px] h-5">{stuckDeals.length}</Badge>
          </CardTitle>
          <Button
            variant="outline" size="sm" className="h-7 text-xs gap-1.5"
            onClick={() => analyzeRisks.mutate(stuckDeals)}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Analisar com IA
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2">
            {stuckDeals.slice(0, 10).map((deal: any, idx: number) => {
              const ai = aiAnalysis[idx];
              const riskLevel = ai?.risk_level || (deal.days_in_stage > deal.threshold * 2 ? 'critical' : deal.days_in_stage > deal.threshold * 1.5 ? 'high' : 'medium');

              return (
                <Collapsible key={deal.opportunity_id} open={expandedDeals.has(deal.opportunity_id)} onOpenChange={() => toggleDeal(deal.opportunity_id)}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center gap-2 p-2 rounded-md border border-border/40 hover:bg-muted/30 transition-colors text-left">
                      <div className={cn('w-2 h-2 rounded-full shrink-0', riskLevel === 'critical' ? 'bg-destructive' : riskLevel === 'high' ? 'bg-warning' : 'bg-amber-500')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{deal.company_name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{deal.stage}</span>
                          <span className="text-destructive font-medium">{deal.days_in_stage}d parado</span>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-foreground shrink-0">{formatCurrency(deal.deal_value)}</span>
                      <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform', expandedDeals.has(deal.opportunity_id) && 'rotate-180')} />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pl-4 pr-2 pb-2 space-y-2 mt-1">
                      {ai && (
                        <>
                          <Badge variant="outline" className={cn('text-[10px]', riskStyles[ai.risk_level])}>
                            Risco {ai.risk_level} — {ai.probability_estimate}% prob.
                          </Badge>
                          <p className="text-xs text-muted-foreground">{ai.risk_reason}</p>
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ações sugeridas:</p>
                            {ai.suggested_actions.map((action: string, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground pl-3 relative before:content-['→'] before:absolute before:left-0 before:text-primary">
                                {action}
                              </p>
                            ))}
                          </div>
                          <div className="flex items-start gap-1.5 p-1.5 rounded bg-primary/5 border border-primary/10">
                            <Target className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                            <p className="text-xs font-medium text-foreground">{ai.recommended_next_step}</p>
                          </div>
                        </>
                      )}
                      {!ai && (
                        <p className="text-xs text-muted-foreground italic">Clique em "Analisar com IA" para sugestões</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
