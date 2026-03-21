import { useDuplicateDetection } from '@/hooks/useDuplicateDetection';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Copy, Search, Loader2, AlertTriangle, Users } from 'lucide-react';

export function DuplicateDetectionPanel() {
  const { detect, result, isDetecting } = useDuplicateDetection();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Copy className="h-5 w-5 text-primary" />
          Detecção de Duplicatas
          {result && <Badge variant="secondary" className="text-xs">{result.totalDuplicateGroups} grupos</Badge>}
        </h2>
        <Button
          variant="outline" size="sm" className="gap-1.5"
          onClick={() => detect.mutate()}
          disabled={isDetecting}
        >
          {isDetecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          {isDetecting ? 'Escaneando...' : 'Escanear Leads'}
        </Button>
      </div>

      {result && (
        <>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{result.totalLeadsScanned} leads escaneados</span>
            <span>{result.totalDuplicateGroups} grupo(s) encontrado(s)</span>
          </div>

          <ScrollArea className="max-h-[500px]">
            <div className="space-y-3">
              {result.duplicates.map((group, gi) => {
                const confLabel = group.confidence >= 0.9 ? 'Alta' : group.confidence >= 0.75 ? 'Média' : 'Baixa';
                const confStyle = group.confidence >= 0.9 ? 'bg-success/10 text-success border-success/20' :
                  group.confidence >= 0.75 ? 'bg-warning/10 text-warning border-warning/20' :
                  'bg-muted text-muted-foreground border-border';

                return (
                  <Card key={gi} className="border-warning/20">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-warning" />
                        <Badge variant="outline" className="text-[10px]">{group.matchType}</Badge>
                        <Badge variant="outline" className={cn('text-[10px]', confStyle)}>
                          {confLabel} ({Math.round(group.confidence * 100)}%)
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {group.leads.map((lead, li) => (
                          <div key={li} className={cn('p-2 rounded border text-xs space-y-1', li === 0 ? 'border-primary/20 bg-primary/5' : 'border-border')}>
                            <p className="font-medium text-foreground truncate">{lead.name || 'Sem nome'}</p>
                            <p className="text-muted-foreground truncate">{lead.razao_social || lead.company || '—'}</p>
                            {lead.email && <p className="text-muted-foreground truncate">{lead.email}</p>}
                            {lead.cnpj && <p className="text-muted-foreground font-mono text-[10px]">{lead.cnpj}</p>}
                            <Badge variant="outline" className="text-[9px] h-4">{lead.status || 'N/A'}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {result.duplicates.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhum lead duplicado encontrado
                </div>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
