import { memo } from 'react';
import { cn } from '@/lib/utils';
import PosVendaKpiCard from './PosVendaKpiCard';
import PosVendaChartCard from './PosVendaChartCard';
import PosVendaHorizontalBars from './PosVendaHorizontalBars';
import { type ApiActivationsData } from '@/hooks/useApiActivations';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: ApiActivationsData;
}

const STATUS_COLORS = ['hsl(220,79%,48%)', 'hsl(199,89%,48%)', 'hsl(45,93%,47%)', 'hsl(142,71%,45%)'];

const PosVendaApiActivationTab = memo(function PosVendaApiActivationTab({ data }: Props) {
  const { funnel, avg_days_to_activate, blocked_reasons, awaiting, history_6m } = data;

  const funnelBars = [
    { label: 'Solicitados', value: funnel.requested },
    { label: 'Verificados', value: funnel.verified },
    { label: 'Pendentes', value: funnel.pending },
    { label: 'Ativados', value: funnel.active },
  ];

  const blockedBars = blocked_reasons.map((r) => ({
    label: r.reason,
    value: r.count,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <PosVendaKpiCard title="Solicitados" value={funnel.requested} color="info" />
        <PosVendaKpiCard title="Ativados" value={funnel.active} color="success" />
        <PosVendaKpiCard title="Conversão" value={funnel.conversion_rate} suffix="%" color="neutral" />
        <PosVendaKpiCard
          title="Dias médios p/ ativar"
          value={avg_days_to_activate}
          suffix="d"
          color={avg_days_to_activate > 30 ? 'danger' : avg_days_to_activate > 15 ? 'warning' : 'success'}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funnel */}
        <PosVendaChartCard title="Funil de ativação">
          <PosVendaHorizontalBars
            data={funnelBars}
            colorFn={(_v, i) => STATUS_COLORS[i] || 'hsl(220,79%,48%)'}
          />
        </PosVendaChartCard>

        {/* Blocked reasons */}
        <PosVendaChartCard title="Motivos de bloqueio">
          {blockedBars.length > 0 ? (
            <PosVendaHorizontalBars data={blockedBars} colorFn={() => 'hsl(0,72%,51%)'} />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum bloqueio registrado</p>
          )}
        </PosVendaChartCard>
      </div>

      {/* History chart */}
      {history_6m.length > 0 && (
        <PosVendaChartCard title="Tempo médio de ativação — últimos 6 meses">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={history_6m}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v} dias`, 'Média']}
              />
              <Bar dataKey="avg_days" fill="hsl(220,79%,48%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </PosVendaChartCard>
      )}

      {/* Awaiting table */}
      <PosVendaChartCard title={`Aguardando ativação (${awaiting.length})`}>
        {awaiting.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium text-muted-foreground text-xs">Empresa</th>
                  <th className="pb-2 font-medium text-muted-foreground text-xs">Contato</th>
                  <th className="pb-2 font-medium text-muted-foreground text-xs text-right">Dias esperando</th>
                  <th className="pb-2 font-medium text-muted-foreground text-xs">Bloqueio</th>
                </tr>
              </thead>
              <tbody>
                {awaiting.map((item) => (
                  <tr key={item.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 font-medium">{item.project_name}</td>
                    <td className="py-2 text-muted-foreground">{item.client}</td>
                    <td className={cn(
                      'py-2 text-right tabular-nums font-semibold',
                      item.waiting_days > 30 ? 'text-destructive' : item.waiting_days > 15 ? 'text-warning' : 'text-foreground',
                    )}>
                      {item.waiting_days}d
                    </td>
                    <td className="py-2 text-muted-foreground text-xs">{item.blocked_reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhum deal aguardando ativação</p>
        )}
      </PosVendaChartCard>
    </div>
  );
});

export default PosVendaApiActivationTab;
