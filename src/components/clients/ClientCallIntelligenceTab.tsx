import { useState } from 'react';
import { useClientCallAnalyses } from '@/hooks/useClientCallAnalyses';
import type { CallAnalysis } from '@/hooks/useCallAnalyses';
import { CallAnalysisDetailModal } from '@/components/admin/CallAnalysisDetailModal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Headphones, Phone, Video, Calendar, User, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Props {
  accountId: string;
}

function scoreColor(score: number) {
  if (score >= 80) return 'bg-success/10 text-success border-success/20';
  if (score >= 60) return 'bg-warning/10 text-warning border-warning/20';
  return 'bg-destructive/10 text-destructive border-destructive/20';
}

function AnalysisCard({ analysis, onClick }: { analysis: CallAnalysis; onClick: () => void }) {
  const isDemo = analysis.analysis_context === 'demo_closer';

  return (
    <Card
      className="cursor-pointer border-border/40 hover:border-border/80 hover:bg-muted/30 transition-all"
      onClick={onClick}
    >
      <CardContent className="p-3.5 flex items-center gap-3">
        <div className={cn(
          'shrink-0 h-9 w-9 rounded-lg flex items-center justify-center',
          isDemo ? 'bg-purple-500/10 text-purple-500' : 'bg-info/10 text-info'
        )}>
          {isDemo ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
        </div>

        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground truncate">
              {isDemo ? 'Demonstração' : 'Ligação SDR'}
            </span>
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-[18px] font-medium', scoreColor(analysis.call_score))}>
              {analysis.call_score}pts
            </Badge>
          </div>
          {analysis.executive_summary && (
            <p className="text-[11px] text-muted-foreground line-clamp-1">{analysis.executive_summary}</p>
          )}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/80">
            {analysis.sdr_profile?.name && (
              <span className="flex items-center gap-1">
                <User className="h-2.5 w-2.5" />
                {analysis.sdr_profile.name}
              </span>
            )}
            {analysis.lead_data?.name && (
              <span className="truncate">{analysis.lead_data.name}</span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" />
              {format(new Date(analysis.created_at), 'dd/MM/yy', { locale: ptBR })}
            </span>
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
      </CardContent>
    </Card>
  );
}

export function ClientCallIntelligenceTab({ accountId }: Props) {
  const { data: analyses, isLoading } = useClientCallAnalyses(accountId);
  const [selectedAnalysis, setSelectedAnalysis] = useState<CallAnalysis | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!analyses || analyses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Headphones className="h-10 w-10 mb-3 opacity-40" strokeWidth={1.5} />
        <p className="text-sm font-medium">Nenhuma análise encontrada</p>
        <p className="text-xs mt-1">Análises de ligações e demonstrações aparecerão aqui.</p>
      </div>
    );
  }

  const sdrCalls = analyses.filter(a => a.analysis_context === 'sdr_call');
  const demos = analyses.filter(a => a.analysis_context === 'demo_closer');

  return (
    <>
      <ScrollArea className="h-[calc(90vh-200px)]">
        <div className="p-4 space-y-4">
          {demos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Video className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Demonstrações ({demos.length})
                </span>
              </div>
              {demos.map(a => (
                <AnalysisCard key={a.id} analysis={a} onClick={() => setSelectedAnalysis(a)} />
              ))}
            </div>
          )}

          {sdrCalls.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Phone className="h-3.5 w-3.5 text-info" />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Ligações SDR ({sdrCalls.length})
                </span>
              </div>
              {sdrCalls.map(a => (
                <AnalysisCard key={a.id} analysis={a} onClick={() => setSelectedAnalysis(a)} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <CallAnalysisDetailModal
        analysis={selectedAnalysis}
        open={!!selectedAnalysis}
        onOpenChange={(open) => !open && setSelectedAnalysis(null)}
      />
    </>
  );
}
