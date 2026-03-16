import { useState, useMemo } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { PROJECT_TYPE_LABELS, PHASE_LABELS, ProjectType } from '@/types/project';

const PAGE_SIZE = 8;

interface RiskProject {
  id: string;
  company_name: string;
  project_type: string;
  current_phase: string;
  priority: string;
  daysOverdue: number;
}

interface DashboardRiskListProps {
  projects: RiskProject[];
  onSelectProject?: (project: any) => void;
}

export function DashboardRiskList({ projects, onSelectProject }: DashboardRiskListProps) {
  const isMobile = useIsMobile();
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
  const paged = useMemo(() => projects.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [projects, page]);

  if (projects.length === 0) return null;

  const pagination = totalPages > 1 && (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/30">
      <span className="text-xs text-muted-foreground tabular-nums">
        {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, projects.length)} de {projects.length}
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
            <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--chart-2))]" strokeWidth={1.5} />
            Projetos em Risco ({projects.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isMobile ? (
          <div className="divide-y divide-border/30">
            {paged.map((p) => (
              <div
                key={p.id}
                className="px-4 py-3 flex items-center justify-between gap-3 active:bg-muted/20 cursor-pointer min-h-[48px]"
                onClick={() => onSelectProject?.(p)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') onSelectProject?.(p); }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.company_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {PHASE_LABELS[p.current_phase] || p.current_phase || '—'}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={`text-xs tabular-nums shrink-0 ${
                    p.daysOverdue > 0 ? 'bg-destructive/15 text-destructive' : 'bg-chart-2/15 text-[hsl(var(--chart-2))]'
                  }`}
                >
                  {p.daysOverdue > 0 ? `${p.daysOverdue}d` : 'Breve'}
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
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Fase Atual</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Atraso</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Prioridade</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/30 hover:bg-accent/50 cursor-pointer transition-colors duration-150 even:bg-muted/30"
                    onClick={() => onSelectProject?.(p)}
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">{p.company_name}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="secondary" className="text-xs">
                        {PROJECT_TYPE_LABELS[p.project_type as ProjectType] || p.project_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {PHASE_LABELS[p.current_phase] || p.current_phase || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-semibold ${p.daysOverdue > 0 ? 'text-destructive' : 'text-[hsl(var(--chart-2))]'}`}>
                        {p.daysOverdue > 0 ? `${p.daysOverdue}d atrasado` : 'Vence em breve'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          p.priority === 'urgente' ? 'border-destructive/50 text-destructive' :
                          p.priority === 'alta' ? 'border-[hsl(var(--chart-2))]/50 text-[hsl(var(--chart-2))]' :
                          'border-border text-muted-foreground'
                        }`}
                      >
                        {p.priority === 'urgente' ? 'Urgente' : p.priority === 'alta' ? 'Alta' : p.priority === 'media' ? 'Média' : 'Baixa'}
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