import { memo } from 'react';
import PosVendaKpiCard from './PosVendaKpiCard';
import PosVendaChartCard from './PosVendaChartCard';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TeamsData, TeamMetrics } from '@/hooks/useTeamCapacity';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ok: { label: 'OK', className: 'bg-success/10 text-success border-success/30' },
  warning: { label: 'Atenção', className: 'bg-warning/10 text-warning border-warning/30' },
  critical: { label: 'Crítico', className: 'bg-destructive/10 text-destructive border-destructive/30' },
};

const BORDER_BY_STATUS: Record<string, string> = {
  ok: 'border-border/50',
  warning: 'border-warning/50',
  critical: 'border-destructive/60',
};

interface Props {
  data: TeamsData;
}

function TeamCard({ team }: { team: TeamMetrics }) {
  const badge = STATUS_BADGE[team.status] || STATUS_BADGE.ok;
  const border = BORDER_BY_STATUS[team.status] || BORDER_BY_STATUS.ok;

  return (
    <PosVendaChartCard title="" className={cn('border', border)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 -mt-1">
        <h4 className="text-sm font-semibold text-foreground">{team.name}</h4>
        <Badge className={cn('text-[10px]', badge.className)}>{badge.label}</Badge>
      </div>

      {/* 2×2 metrics grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">WIP / Pessoa</span>
          <p className="text-lg font-bold tabular-nums text-foreground">{team.wip_per_person}</p>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Horas alocadas</span>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {team.allocated_hours}<span className="text-xs font-medium text-muted-foreground">/{team.capacity_hours}h</span>
          </p>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">SLA cumprido</span>
          <p className="text-lg font-bold tabular-nums text-foreground">{team.sla_rate}%</p>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Retrabalho</span>
          <p className="text-lg font-bold tabular-nums text-foreground">{team.rework_rate}%</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Utilização</span>
          <span className="font-medium tabular-nums">{team.utilization_pct}%</span>
        </div>
        <Progress
          value={Math.min(team.utilization_pct, 100)}
          className={cn(
            'h-2',
            team.status === 'critical' && '[&>div]:bg-destructive',
            team.status === 'warning' && '[&>div]:bg-warning',
          )}
        />
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{team.headcount} {team.headcount === 1 ? 'pessoa' : 'pessoas'} · {team.active_projects} projetos</span>
        <span className="truncate ml-2">Gargalo: <strong className="text-foreground">{team.main_bottleneck}</strong></span>
      </div>
    </PosVendaChartCard>
  );
}

const PosVendaEquipesTab = memo(function PosVendaEquipesTab({ data }: Props) {
  const { summary, teams } = data;

  const criticalCount = teams.filter(t => t.status === 'critical').length;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Capacidade geral</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <PosVendaKpiCard title="WIP total" value={summary.total_wip} color="neutral" />
          <PosVendaKpiCard
            title="Utilização média"
            value={summary.avg_utilization}
            suffix="%"
            color={summary.avg_utilization >= 90 ? 'danger' : summary.avg_utilization >= 80 ? 'warning' : 'success'}
          />
          <PosVendaKpiCard title="SLA médio" value={summary.avg_sla} suffix="%" color={summary.avg_sla >= 80 ? 'success' : 'warning'} />
          <PosVendaKpiCard
            title="Horas livres"
            value={summary.free_hours_total}
            suffix="h"
            color="info"
            subtitle={criticalCount > 0 ? `${criticalCount} equipe(s) em alerta` : undefined}
          />
        </div>
      </div>

      {/* Team cards */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Equipes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {teams.map(team => (
            <TeamCard key={team.id} team={team} />
          ))}
          {teams.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-12">Nenhuma equipe cadastrada.</p>
          )}
        </div>
      </div>
    </div>
  );
});

export default PosVendaEquipesTab;
