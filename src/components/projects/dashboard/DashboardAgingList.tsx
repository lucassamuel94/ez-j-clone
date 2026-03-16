import { useState, useMemo } from 'react';
import { Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { PHASE_LABELS } from '@/types/project';
import type { AgingProject } from '@/hooks/useProjectDashboard';

const PAGE_SIZE = 8;

interface DashboardAgingListProps {
  data: AgingProject[];
  onSelectProject?: (projectId: string) => void;
}

function getSeverityClasses(days: number) {
  if (days > 10) return 'bg-destructive/15 text-destructive';
  if (days > 5) return 'bg-chart-2/15 text-[hsl(var(--chart-2))]';
  return 'bg-muted/50 text-muted-foreground';
}

export function DashboardAgingList({ data, onSelectProject }: DashboardAgingListProps) {
  const isMobile = useIsMobile();
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const paged = useMemo(() => data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [data, page]);

  if (data.length === 0) return null;

  const pagination = totalPages > 1 && (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/30">
      <span className="text-xs text-muted-foreground tabular-nums">
        {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.length)} de {data.length}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={page >= totalPages - 1}
          onClick={() => setPage((p) => p + 1)}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-[hsl(var(--chart-2))]" strokeWidth={1.5} />
            Projetos Estagnados ({data.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isMobile ? (
          <div className="divide-y divide-border/30">
            {paged.map((row) => (
              <div
                key={row.phaseId}
                className="px-4 py-3 flex items-center justify-between gap-3 active:bg-muted/20 cursor-pointer min-h-[48px]"
                onClick={() => onSelectProject?.(row.projectId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') onSelectProject?.(row.projectId); }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{row.companyName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {PHASE_LABELS[row.phaseName] || row.phaseName} · {row.assignedUserName}
                  </p>
                </div>
                <Badge variant="secondary" className={`text-xs tabular-nums shrink-0 ${getSeverityClasses(row.daysStagnant)}`}>
                  {row.daysStagnant}d
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Empresa</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Fase</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Responsável</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Dias Parado</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => (
                  <tr
                    key={row.phaseId}
                    className="border-b border-border/30 hover:bg-accent/50 cursor-pointer transition-colors duration-150 even:bg-muted/30"
                    onClick={() => onSelectProject?.(row.projectId)}
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">{row.companyName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{PHASE_LABELS[row.phaseName] || row.phaseName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.assignedUserName}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="secondary" className={`text-xs tabular-nums ${getSeverityClasses(row.daysStagnant)}`}>
                        {row.daysStagnant}d
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pagination}
      </CardContent>
    </Card>
  );
}