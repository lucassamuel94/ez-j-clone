import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { useIsMobile } from '@/hooks/use-mobile';
import { DashboardChartWrapper } from './DashboardChartWrapper';
import { CHART_PALETTE } from './constants';

interface FunnelEntry {
  phase: string;
  count: number;
}

interface DashboardFunnelChartProps {
  data: FunnelEntry[];
}

function FunnelTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-lg" role="status" aria-live="polite">
      <p className="font-medium text-foreground">{label || payload[0]?.name}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-muted-foreground tabular-nums">{p.value} projetos</p>
      ))}
    </div>
  );
}

export function DashboardFunnelChart({ data }: DashboardFunnelChartProps) {
  const isMobile = useIsMobile();
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <DashboardChartWrapper title="Funil de Fases" ariaLabel={`Funil de fases com ${data.length} fases`} isEmpty={data.length === 0}>
      {isMobile ? (
        <div className="space-y-3 py-1">
          {data.map((entry, i) => (
            <div key={entry.phase} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground truncate mr-2">{entry.phase}</span>
                <span className="text-xs font-bold text-foreground tabular-nums shrink-0">{entry.count}</span>
              </div>
              <Progress value={(entry.count / maxCount) * 100} className="h-2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="phase" fontSize={11} stroke="hsl(var(--muted-foreground))" width={85} />
              <Tooltip content={<FunnelTooltip />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardChartWrapper>
  );
}
