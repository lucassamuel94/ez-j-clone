import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, TrendingUp, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useMyResults } from '@/hooks/useMyResults';
import { SLA_BENCHMARKS } from '@/hooks/useProjectDashboard';
import { DashboardKpiCard } from '@/components/projects/dashboard/DashboardKpiCard';

interface MyResultsTabProps {
  userId: string;
  userRole: string;
  userName: string;
}

const ROLE_LABELS: Record<string, string> = {
  ux_po: 'UX/PO',
  dev_chatbot: 'Dev Chatbot',
  treinamento: 'Treinamento',
  ativacao: 'Ativação',
};

const COMPLEXITY_COLORS: Record<string, string> = {
  simples: 'bg-chart-3/15 text-[hsl(var(--chart-3))]',
  media: 'bg-chart-2/15 text-[hsl(var(--chart-2))]',
  complexa: 'bg-destructive/15 text-destructive',
};

const TYPE_COLORS: Record<string, string> = {
  implantacao: 'bg-primary/10 text-primary',
  evolucao: 'bg-chart-4/15 text-[hsl(var(--chart-4))]',
};

function diffDays(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function MyResultsTab({ userId, userRole, userName }: MyResultsTabProps) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showAllHistory, setShowAllHistory] = useState(false);

  const isCurrentMonth = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();

  const { goal, completedPhases, activePhases, isLoading } = useMyResults(userId, userRole, selectedMonth, selectedYear);

  const benchmark = SLA_BENCHMARKS[userRole] ?? 10;

  // KPI calculations
  const kpis = useMemo(() => {
    if (!completedPhases || !activePhases) return null;

    const concluidos = completedPhases.length;
    const withinSla = completedPhases.filter(p => {
      if (!p.started_at || !p.completed_at) return false;
      return diffDays(p.completed_at, p.started_at) <= benchmark;
    }).length;
    const slaPercent = concluidos > 0 ? Math.round((withinSla / concluidos) * 100) : 0;
    const avgDays = concluidos > 0
      ? Math.round(completedPhases.reduce((sum, p) => sum + (p.started_at && p.completed_at ? diffDays(p.completed_at, p.started_at) : 0), 0) / concluidos)
      : 0;
    const naEsteira = activePhases.length;

    return { concluidos, slaPercent, avgDays, naEsteira };
  }, [completedPhases, activePhases, benchmark]);

  const metaGoal = goal?.meetings_scheduled_goal ?? 0;
  const metaPercent = metaGoal > 0 && kpis ? Math.round((kpis.concluidos / metaGoal) * 100) : 0;

  // Month navigation
  const goToPrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
    setShowAllHistory(false);
  };

  const goToNextMonth = () => {
    if (isCurrentMonth) return;
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
    setShowAllHistory(false);
  };

  const monthLabel = new Date(selectedYear, selectedMonth - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-lg" />)}
        </div>
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const visibleHistory = showAllHistory ? completedPhases : completedPhases?.slice(0, 3);
  const hiddenCount = (completedPhases?.length ?? 0) - 3;

  return (
    <div className="space-y-5">
      {/* Header: Month nav */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground font-display">
            Meus Resultados
          </h2>
          <p className="text-xs text-muted-foreground">
            {userName} · {ROLE_LABELS[userRole] || userRole}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPrevMonth}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-medium capitalize min-w-[120px] text-center">{monthLabel}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNextMonth} disabled={isCurrentMonth}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DashboardKpiCard label="Concluídos" value={kpis.concluidos} icon={CheckCircle2} variant="success" />
          <DashboardKpiCard label="SLA %" value={kpis.slaPercent} icon={TrendingUp} variant="primary" />
          <DashboardKpiCard label="Tempo médio (dias)" value={kpis.avgDays} icon={Clock} variant="warning" />
          <DashboardKpiCard label="Na esteira" value={kpis.naEsteira} icon={Layers} variant="info" />
        </div>
      )}

      {/* Goal bar */}
      {metaGoal > 0 && kpis && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Meta do mês</span>
              <span className="text-xs font-bold tabular-nums">
                {kpis.concluidos}/{metaGoal} ({metaPercent}%)
              </span>
            </div>
            <Progress
              value={Math.min(metaPercent, 100)}
              className={cn(
                'h-2.5',
                metaPercent >= 100 ? '[&>div]:bg-[hsl(var(--chart-3))]' :
                  metaPercent >= 70 ? '[&>div]:bg-[hsl(var(--chart-2))]' :
                    '[&>div]:bg-destructive'
              )}
            />
          </CardContent>
        </Card>
      )}

      {/* Active pipeline */}
      {activePhases && activePhases.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Esteira atual</h3>
          <div className="space-y-1.5">
            {activePhases.map(phase => {
              const project = phase.projects as Record<string, unknown>;
              const dueDate = project?.due_date as string | null;
              const today = new Date().toISOString().slice(0, 10);
              const isLate = dueDate ? dueDate < today : false;
              const daysInPhase = phase.started_at ? Math.max(0, diffDays(new Date().toISOString(), phase.started_at)) : 0;
              const daysRemaining = dueDate ? diffDays(dueDate, new Date().toISOString()) : null;

              return (
                <Card key={phase.id} className="border-border/50 hover:border-primary/20 transition-colors">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                            {project?.company_name as string || '—'}
                          </span>
                          {project?.project_type && (
                            <Badge className={cn('text-[10px] h-4 px-1.5 border-0', TYPE_COLORS[(project.project_type as string)] || 'bg-muted text-muted-foreground')}>
                              {(project.project_type as string) === 'implantacao' ? 'Impl.' : 'Evol.'}
                            </Badge>
                          )}
                          {project?.complexity_level && (
                            <Badge className={cn('text-[10px] h-4 px-1.5 border-0', COMPLEXITY_COLORS[(project.complexity_level as string)] || 'bg-muted text-muted-foreground')}>
                              {project.complexity_level as string}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                          <span className="font-mono text-[10px]">PROJ-{(project?.project_number as number)?.toString().padStart(4, '0')}</span>
                          <span>·</span>
                          <span>{phase.status}</span>
                          <span>·</span>
                          <span>{daysInPhase}d na fase</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {isLate ? (
                          <span className="text-[11px] font-medium text-destructive">
                            Atrasado · {Math.abs(daysRemaining ?? 0)}d
                          </span>
                        ) : daysRemaining !== null ? (
                          <span className="text-[11px] font-medium text-[hsl(var(--chart-3))]">
                            {daysRemaining}d restantes
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Sem prazo</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly history */}
      {completedPhases && completedPhases.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Histórico do mês</h3>
          <div className="space-y-1">
            {visibleHistory?.map(phase => {
              const project = phase.projects as Record<string, unknown>;
              const days = phase.started_at && phase.completed_at ? diffDays(phase.completed_at, phase.started_at) : 0;
              const withinSla = days <= benchmark;

              return (
                <div key={phase.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-accent/30 transition-colors">
                  <div className={cn('h-2 w-2 rounded-full shrink-0', withinSla ? 'bg-[hsl(var(--chart-3))]' : 'bg-destructive')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground truncate">{project?.company_name as string || '—'}</span>
                      {project?.project_type && (
                        <Badge className={cn('text-[10px] h-4 px-1.5 border-0', TYPE_COLORS[(project.project_type as string)] || 'bg-muted text-muted-foreground')}>
                          {(project.project_type as string) === 'implantacao' ? 'Impl.' : 'Evol.'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground shrink-0">{days}d</span>
                  <span className="text-xs tabular-nums text-muted-foreground shrink-0">{phase.completed_at ? formatDate(phase.completed_at) : '—'}</span>
                </div>
              );
            })}
          </div>
          {!showAllHistory && hiddenCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 w-full text-muted-foreground" onClick={() => setShowAllHistory(true)}>
              + Ver {hiddenCount} restantes
            </Button>
          )}
        </div>
      )}

      {/* Empty state */}
      {kpis && kpis.concluidos === 0 && kpis.naEsteira === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma atividade neste período</p>
        </div>
      )}
    </div>
  );
}
