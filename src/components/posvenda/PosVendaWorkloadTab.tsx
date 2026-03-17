import { memo, useMemo } from 'react';
import PosVendaKpiCard from './PosVendaKpiCard';
import PosVendaChartCard from './PosVendaChartCard';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import type { WorkloadData, TeamWeekEntry } from '@/hooks/useWorkload';

const TEAM_COLORS: Record<string, string> = {
  dev: 'hsl(var(--primary))',
  ux: 'hsl(var(--warning))',
  treinamento: 'hsl(var(--success))',
};

function getBarColor(pct: number): string {
  if (pct >= 90) return 'destructive';
  if (pct >= 80) return 'warning';
  return 'success';
}

interface Props {
  data: WorkloadData;
}

// --- Team hours section ---
function TeamHoursSection({ teamsWeekly }: { teamsWeekly: Record<string, TeamWeekEntry[]> }) {
  const teamTotals = useMemo(() => {
    return Object.entries(teamsWeekly).map(([name, weeks]) => {
      const allocated = weeks.reduce((s, w) => s + w.allocated_hours, 0);
      const capacity = weeks.reduce((s, w) => s + w.capacity_hours, 0);
      const pct = capacity > 0 ? Math.round((allocated / capacity) * 100) : 0;
      return { name, allocated, capacity, pct };
    });
  }, [teamsWeekly]);

  return (
    <PosVendaChartCard title="Horas comprometidas por equipe">
      <div className="space-y-4">
        {teamTotals.map((t) => {
          const color = getBarColor(t.pct);
          return (
            <div key={t.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground capitalize">{t.name}</span>
                <span className="text-muted-foreground tabular-nums">{t.allocated}h de {t.capacity}h</span>
              </div>
              <Progress
                value={Math.min(t.pct, 100)}
                className={cn(
                  'h-3',
                  color === 'destructive' && '[&>div]:bg-destructive',
                  color === 'warning' && '[&>div]:bg-warning',
                  color === 'success' && '[&>div]:bg-success',
                )}
              />
            </div>
          );
        })}
        {teamTotals.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma equipe cadastrada.</p>
        )}
      </div>
    </PosVendaChartCard>
  );
}

// --- Weekly chart section ---
function WeeklyChartSection({ teamsWeekly, weeklyFlow }: { teamsWeekly: Record<string, TeamWeekEntry[]>; weeklyFlow: { week: string; is_projection: boolean }[] }) {
  const teamNames = Object.keys(teamsWeekly);

  const chartData = useMemo(() => {
    if (teamNames.length === 0) return [];
    const firstTeam = teamsWeekly[teamNames[0]];
    if (!firstTeam) return [];

    return firstTeam.map((_, i) => {
      const flowEntry = weeklyFlow[i];
      const isProjection = flowEntry?.is_projection ?? false;
      const entry: Record<string, string | number | boolean> = {
        week: isProjection ? `${firstTeam[i].week} (prev.)` : firstTeam[i].week,
        is_projection: isProjection,
      };
      for (const name of teamNames) {
        entry[name] = teamsWeekly[name]?.[i]?.allocated_hours ?? 0;
      }
      return entry;
    });
  }, [teamsWeekly, teamNames, weeklyFlow]);

  return (
    <PosVendaChartCard title="Como a carga evoluiu nas semanas">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" unit="h" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {teamNames.map((name) => (
              <Bar key={name} dataKey={name} fill={TEAM_COLORS[name] || 'hsl(var(--muted-foreground))'} radius={[4, 4, 0, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fillOpacity={entry.is_projection ? 0.4 : 1} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </PosVendaChartCard>
  );
}

// --- Flow table section ---
function FlowTableSection({ weeklyFlow }: { weeklyFlow: WorkloadData['weekly_flow'] }) {
  return (
    <PosVendaChartCard title="Projetos que entraram vs. saíram">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-4">Semana</th>
              <th className="py-2 pr-4 text-right">Novos</th>
              <th className="py-2 pr-4 text-right">Entregas</th>
              <th className="py-2 pr-4 text-right">Saldo</th>
              <th className="py-2 text-right">Fila ao final</th>
            </tr>
          </thead>
          <tbody>
            {weeklyFlow.map((row) => (
              <tr
                key={row.week}
                className={cn(
                  'border-b border-border/40',
                  row.is_projection && 'bg-muted/30',
                )}
              >
                <td className={cn('py-2 pr-4 font-medium', row.is_projection && 'italic text-muted-foreground')}>
                  {row.week}{row.is_projection ? ' (prev.)' : ''}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">{row.new_projects}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{row.delivered}</td>
                <td className={cn(
                  'py-2 pr-4 text-right tabular-nums font-medium',
                  row.balance > 0 && 'text-destructive',
                  row.balance < 0 && 'text-success',
                )}>
                  {row.balance > 0 ? '+' : ''}{row.balance}
                </td>
                <td className="py-2 text-right tabular-nums">{row.wip_end}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PosVendaChartCard>
  );
}

const PosVendaWorkloadTab = memo(function PosVendaWorkloadTab({ data }: Props) {
  const { summary, teams_weekly, weekly_flow, alerts } = data;
  const teamCount = Object.keys(teams_weekly).length;
  const utilPct = summary.total_capacity_hours > 0
    ? Math.round((summary.total_allocated_hours / summary.total_capacity_hours) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Visão geral do mês</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PosVendaKpiCard
            title="Capacidade total"
            value={summary.total_capacity_hours}
            suffix="h"
            color="info"
            subtitle={`${teamCount} equipe${teamCount !== 1 ? 's' : ''}`}
          />
          <PosVendaKpiCard
            title="Já comprometido"
            value={summary.total_allocated_hours}
            suffix="h"
            color={utilPct >= 90 ? 'danger' : utilPct >= 80 ? 'warning' : 'neutral'}
            subtitle={`${utilPct}% da capacidade`}
          />
          <PosVendaKpiCard
            title="Ainda disponível"
            value={summary.total_free_hours}
            suffix="h"
            color="success"
            subtitle="para novos projetos"
          />
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <Alert key={i} variant="destructive" className="border-destructive/50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>{a.team}</strong> está com {a.utilization_pct}% da capacidade comprometida na {a.week}. Novos projetos podem atrasar.
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Team hours bars */}
      <TeamHoursSection teamsWeekly={teams_weekly} />

      {/* Weekly chart + flow table */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <WeeklyChartSection teamsWeekly={teams_weekly} weeklyFlow={weekly_flow} />
        <FlowTableSection weeklyFlow={weekly_flow} />
      </div>
    </div>
  );
});

export default PosVendaWorkloadTab;
