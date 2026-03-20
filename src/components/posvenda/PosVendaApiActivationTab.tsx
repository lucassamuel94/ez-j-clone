import { memo } from 'react';
import { cn } from '@/lib/utils';
import PosVendaKpiCard from './PosVendaKpiCard';
import PosVendaChartCard from './PosVendaChartCard';
import PosVendaHorizontalBars from './PosVendaHorizontalBars';
import { type ApiActivationsData } from '@/hooks/useApiActivations';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const historyChartConfig = {
  avg_days: { label: 'Média', color: 'hsl(var(--info))' },
} satisfies ChartConfig;

interface Props {
  data: ApiActivationsData;
}

const STATUS_COLORS = ['hsl(var(--info))', 'hsl(var(--brand-accent))', 'hsl(var(--warning))', 'hsl(var(--success))'];

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
            colorFn={(_v, i) => STATUS_COLORS[i] || 'hsl(var(--info))'}
          />
        </PosVendaChartCard>

        {/* Blocked reasons */}
        <PosVendaChartCard title="Motivos de bloqueio">
          {blockedBars.length > 0 ? (
            <PosVendaHorizontalBars data={blockedBars} colorFn={() => 'hsl(var(--destructive))'} />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum bloqueio registrado</p>
          )}
        </PosVendaChartCard>
      </div>

      {/* History chart */}
      {history_6m.length > 0 && (
        <PosVendaChartCard title="Tempo médio de ativação — últimos 6 meses">
          <ChartContainer config={historyChartConfig} className="h-[220px] [&_.recharts-wrapper]:!aspect-auto">
            <BarChart data={history_6m}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(value) => [`${value} dias`, 'Média']} />}
              />
              <Bar dataKey="avg_days" fill="var(--color-avg_days)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
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
