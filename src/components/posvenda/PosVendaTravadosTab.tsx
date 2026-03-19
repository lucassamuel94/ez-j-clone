import { memo, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import PosVendaKpiCard from './PosVendaKpiCard';
import PosVendaChartCard from './PosVendaChartCard';
import PosVendaHorizontalBars from './PosVendaHorizontalBars';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import type {
  BlockedData,
  PausedProject,
} from '@/hooks/useBlockedProjects';

const ACTION_STYLES: Record<string, { label: string; cls: string }> = {
  escalar: { label: 'Escalar', cls: 'text-destructive font-semibold' },
  follow_up: { label: 'Follow-up', cls: 'text-warning font-semibold' },
  monitorar: { label: 'Monitorar', cls: 'text-muted-foreground' },
};

interface Props {
  data: BlockedData;
}

const PosVendaTravadosTab = memo(function PosVendaTravadosTab({ data }: Props) {
  const { paused, cancelled, paused_reasons_summary, cancelled_reasons_summary, history_6m } = data;

  const avgAging = useMemo(() => {
    if (!paused.length) return 0;
    return Math.round(paused.reduce((s, p) => s + p.aging_days, 0) / paused.length);
  }, [paused]);

  const escalarPct = useMemo(() => {
    if (!paused.length) return 0;
    return Math.round((paused.filter((p) => p.action === 'escalar').length / paused.length) * 100);
  }, [paused]);

  const pausedBars = useMemo(
    () => paused_reasons_summary.map((r) => ({ label: r.reason, value: r.count })),
    [paused_reasons_summary],
  );

  const cancelledBars = useMemo(
    () => cancelled_reasons_summary.map((r) => ({ label: r.reason, value: r.count })),
    [cancelled_reasons_summary],
  );

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <PosVendaKpiCard title="Pausados" value={paused.length} color="warning" />
        <PosVendaKpiCard title="Cancelados" value={cancelled.length} color="danger" />
        <PosVendaKpiCard title="Aging médio" value={avgAging} suffix="d" color="neutral" />
        <PosVendaKpiCard title="% Escalar" value={escalarPct} suffix="%" color={escalarPct > 30 ? 'danger' : 'warning'} />
      </div>

      {/* Reason bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PosVendaChartCard title="Motivos de pausa">
          <PosVendaHorizontalBars data={pausedBars} colorFn={() => 'hsl(var(--warning))'} />
        </PosVendaChartCard>
        <PosVendaChartCard title="Motivos de cancelamento">
          <PosVendaHorizontalBars data={cancelledBars} colorFn={() => 'hsl(var(--destructive))'} />
        </PosVendaChartCard>
      </div>

      {/* Paused table */}
      <PosVendaChartCard title="Projetos pausados">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 px-2 text-xs font-medium text-muted-foreground">#</th>
                <th className="py-2 px-2 text-xs font-medium text-muted-foreground">Projeto</th>
                <th className="py-2 px-2 text-xs font-medium text-muted-foreground">Motivo</th>
                <th className="py-2 px-2 text-xs font-medium text-muted-foreground">Responsável</th>
                <th className="py-2 px-2 text-xs font-medium text-muted-foreground text-right">Parado há</th>
                <th className="py-2 px-2 text-xs font-medium text-muted-foreground text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {paused.map((p: PausedProject, i: number) => {
                const actionStyle = ACTION_STYLES[p.action] || ACTION_STYLES.monitorar;
                return (
                  <tr key={p.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-2 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="py-2 px-2 text-xs font-medium truncate max-w-[200px]">{p.name}</td>
                    <td className="py-2 px-2 text-xs text-muted-foreground truncate max-w-[180px]">{p.reason || '—'}</td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">{p.responsible}</td>
                    <td className="py-2 px-2 text-xs font-mono tabular-nums text-right">{p.aging_days}d</td>
                    <td className="py-2 px-2 text-xs text-right">
                      <button className={cn('cursor-pointer hover:underline', actionStyle.cls)}>
                        {actionStyle.label}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {paused.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                    Nenhum projeto pausado 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PosVendaChartCard>

      {/* 6m history chart */}
      <PosVendaChartCard title="Pausas e cancelamentos — últimos 6 meses">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={history_6m} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="paused_count" name="Pausados" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cancelled_count" name="Cancelados" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PosVendaChartCard>
    </div>
  );
});

export default PosVendaTravadosTab;
