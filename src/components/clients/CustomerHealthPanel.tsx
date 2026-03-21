import { useState } from 'react';
import { useCustomerHealth, ClientHealth } from '@/hooks/useCustomerHealth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { HeartPulse, Sparkles, Loader2, ChevronDown, TrendingUp, AlertTriangle, CheckCircle, ShieldAlert, ArrowUpRight } from 'lucide-react';

const statusConfig: Record<string, { label: string; className: string }> = {
  healthy: { label: 'Saudável', className: 'bg-success/10 text-success border-success/20' },
  attention: { label: 'Atenção', className: 'bg-warning/10 text-warning border-warning/20' },
  at_risk: { label: 'Em risco', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  critical: { label: 'Crítico', className: 'bg-destructive/15 text-destructive border-destructive/30' },
};

const churnConfig: Record<string, { label: string; className: string }> = {
  low: { label: 'Baixo', className: 'bg-success/10 text-success' },
  medium: { label: 'Médio', className: 'bg-warning/10 text-warning' },
  high: { label: 'Alto', className: 'bg-destructive/10 text-destructive' },
};

const upsellConfig: Record<string, { label: string; className: string }> = {
  ready: { label: 'Pronto', className: 'bg-primary/10 text-primary' },
  nurturing: { label: 'Nurturing', className: 'bg-warning/10 text-warning' },
  not_ready: { label: 'Não pronto', className: 'bg-muted text-muted-foreground' },
};

export function CustomerHealthPanel() {
  const { clients, isLoading, analyzeHealth, healthScores, isAnalyzing } = useCustomerHealth();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleExpand = (i: number) => {
    setExpanded(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const statusCounts = healthScores.reduce((acc, h) => {
    acc[h.status] = (acc[h.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary" />
          Saúde dos Clientes
          <Badge variant="secondary" className="text-xs">{clients.length}</Badge>
        </h2>
        <Button
          variant="outline" size="sm" className="gap-1.5"
          onClick={() => analyzeHealth.mutate(clients)}
          disabled={isAnalyzing || clients.length === 0}
        >
          {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Analisar com IA
        </Button>
      </div>

      {/* Summary Cards */}
      {healthScores.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <Card><CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-foreground">{clients.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Total</p>
          </CardContent></Card>
          <Card className="border-success/20"><CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-success">{statusCounts.healthy || 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Saudáveis</p>
          </CardContent></Card>
          <Card className="border-warning/20"><CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-warning">{statusCounts.attention || 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Atenção</p>
          </CardContent></Card>
          <Card className="border-destructive/20"><CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-destructive">{(statusCounts.at_risk || 0) + (statusCounts.critical || 0)}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Em Risco</p>
          </CardContent></Card>
        </div>
      )}

      {/* Client List */}
      <ScrollArea className="max-h-[500px]">
        <div className="space-y-2">
          {(healthScores.length > 0 ? healthScores : clients).map((item: any, i: number) => {
            const isHealthData = 'health_score' in item;
            const status = isHealthData ? statusConfig[item.status] : null;

            return (
              <Collapsible key={i} open={expanded.has(i)} onOpenChange={() => toggleExpand(i)}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center gap-2 p-2 rounded-md border border-border/40 hover:bg-muted/30 transition-colors text-left">
                    {isHealthData && (
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                        item.health_score >= 70 ? 'bg-success/10 text-success' :
                        item.health_score >= 40 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
                      )}>
                        {item.health_score}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.client_name}</p>
                      <p className="text-[10px] text-muted-foreground">{item.days_as_client}d como cliente</p>
                    </div>
                    {isHealthData && status && (
                      <Badge variant="outline" className={cn('text-[10px] h-5', status.className)}>{status.label}</Badge>
                    )}
                    {isHealthData && (
                      <Badge variant="outline" className={cn('text-[10px] h-5', churnConfig[item.churn_risk]?.className)}>
                        Churn: {churnConfig[item.churn_risk]?.label}
                      </Badge>
                    )}
                    <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform', expanded.has(i) && 'rotate-180')} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {isHealthData && (
                    <div className="pl-12 pr-2 pb-2 space-y-2 mt-1">
                      {item.upsell_readiness && (
                        <Badge variant="outline" className={cn('text-[10px]', upsellConfig[item.upsell_readiness]?.className)}>
                          <ArrowUpRight className="h-3 w-3 mr-0.5" />
                          Upsell: {upsellConfig[item.upsell_readiness]?.label}
                        </Badge>
                      )}
                      <div className="space-y-1">
                        {item.key_signals?.map((signal: string, j: number) => (
                          <p key={j} className="text-xs text-muted-foreground pl-3 relative before:content-['•'] before:absolute before:left-0">
                            {signal}
                          </p>
                        ))}
                      </div>
                      <div className="flex items-start gap-1.5 p-1.5 rounded bg-primary/5 border border-primary/10">
                        <CheckCircle className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                        <p className="text-xs font-medium">{item.recommended_action}</p>
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
