import { memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend } from
'recharts';
import PosVendaKpiCard from './PosVendaKpiCard';
import PosVendaChartCard from './PosVendaChartCard';
import PosVendaHorizontalBars from './PosVendaHorizontalBars';
import { AlertTriangle, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { PosVendaKpi, BarEntry, DeliveryVsDelay, RiskProject } from '@/hooks/usePosVendaDashboard';

const DONUT_COLORS = ['hsl(var(--success))', 'hsl(var(--info))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];

interface Props {
  kpis: PosVendaKpi;
  teamDeliveryBars: BarEntry[];
  typeTimeBars: BarEntry[];
  typeDonut: {name: string;value: number;}[];
  riskProjects: RiskProject[];
  deliveryHistory: DeliveryVsDelay[];
}

const PosVendaResumoTab = memo(function PosVendaResumoTab(props: Props) {
  const { kpis, teamDeliveryBars, typeTimeBars, typeDonut, riskProjects, deliveryHistory } = props;

  const deadlineRisks = riskProjects.filter((r) => r.riskType === 'deadline');
  const stagnantRisks = riskProjects.filter((r) => r.riskType === 'stagnant');

  return (
    <div className="space-y-6 pt-[12px] py-[8px]">
      {/* Quanto temos em andamento */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Quanto temos em andamento</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <PosVendaKpiCard title="Projetos ativos" value={kpis.active} color="neutral" />
          <PosVendaKpiCard title="Entregues" value={kpis.delivered} color="success" variation={kpis.delivered - kpis.deliveredPrev} />
          <PosVendaKpiCard title="Atrasados" value={kpis.overdue} color="danger" variation={kpis.overdue - kpis.overduePrev} />
          <PosVendaKpiCard title="Pausados" value={kpis.paused} color="warning" subtitle="Aguardando cliente" />
          <PosVendaKpiCard title="Cancelados" value={kpis.cancelled} color="neutral" />
        </div>
      </div>

      {/* Como estamos entregando */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Como estamos entregando</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <PosVendaKpiCard title="SLA cumprido" value={kpis.slaPercent} suffix="%" color={kpis.slaPercent >= 80 ? 'success' : 'warning'} />
          <PosVendaKpiCard title="Tempo médio" value={kpis.avgDays} suffix="d" color="neutral" />
          <PosVendaKpiCard title="Lead time efetivo" value={kpis.effectiveLeadTime} suffix="d" color="neutral" />
          <PosVendaKpiCard title="Retrabalho" value={kpis.reworkPercent} suffix="%" color={kpis.reworkPercent > 10 ? 'danger' : 'success'} />
          <PosVendaKpiCard title="Aprovado 1ª vez" value={kpis.approvedFirstPercent} suffix="%" color={kpis.approvedFirstPercent < 80 ? 'warning' : 'success'} />
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left block */}
        <div className="space-y-4">
          <PosVendaChartCard title="Quem entregou mais este mês">
            <PosVendaHorizontalBars data={teamDeliveryBars} />
          </PosVendaChartCard>
          <PosVendaChartCard title="Quanto tempo leva cada tipo">
            <PosVendaHorizontalBars
              data={typeTimeBars}
              colorFn={(v) => v > 20 ? 'hsl(var(--destructive))' : v > 12 ? 'hsl(var(--warning))' : 'hsl(var(--success))'} />
            
          </PosVendaChartCard>
        </div>

        {/* Right block */}
        <div className="space-y-4">
          <PosVendaChartCard title="Tipos de projeto em andamento">
            {typeDonut.length > 0 ?
            <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={typeDonut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {typeDonut.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div> :

            <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
            }
          </PosVendaChartCard>

          <PosVendaChartCard title="Projetos que podem atrasar">
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {deadlineRisks.length > 0 &&
              <div className="space-y-2">
                  {deadlineRisks.slice(0, 5).map((r) =>
                <div key={`dl-${r.id}`} className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                      <span className="text-xs truncate flex-1">{r.company}</span>
                      <div className="w-20">
                        <Progress value={Math.min(r.deadlinePercent, 100)} className="h-1.5" />
                      </div>
                      <span className="text-[10px] font-mono tabular-nums text-muted-foreground w-10 text-right">{r.deadlinePercent}%</span>
                    </div>
                )}
                </div>
              }
              {stagnantRisks.length > 0 &&
              <div className="space-y-2 pt-1">
                  {stagnantRisks.slice(0, 5).map((r) =>
                <div key={`st-${r.id}`} className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-info flex-shrink-0" />
                      <span className="text-xs truncate flex-1">{r.company}</span>
                      <span className="text-[10px] font-mono tabular-nums text-muted-foreground">{r.daysStagnant}d parado</span>
                    </div>
                )}
                </div>
              }
              {deadlineRisks.length === 0 && stagnantRisks.length === 0 &&
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum projeto em risco 🎉</p>
              }
            </div>
          </PosVendaChartCard>
        </div>
      </div>

      {/* Entregas vs atrasos */}
      <PosVendaChartCard title="Entregas vs. atrasos — últimos 6 meses">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deliveryHistory} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
              <Bar dataKey="delivered" name="Entregues" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="overdue" name="Atrasados" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PosVendaChartCard>

      {/* Footer cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <PosVendaKpiCard title="NPS pós-entrega" value="—" color="neutral" subtitle="Em breve" />
        <PosVendaKpiCard title="Tempo médio parado" value="—" color="neutral" subtitle="Em breve" />
        <PosVendaKpiCard title="APIs ativadas com sucesso" value="—" color="neutral" subtitle="Em breve" />
      </div>
    </div>);

});

export default PosVendaResumoTab;