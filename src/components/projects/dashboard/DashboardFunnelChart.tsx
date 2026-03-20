import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';
import { useIsMobile } from '@/hooks/use-mobile';
import { DashboardChartWrapper } from './DashboardChartWrapper';
import { CHART_PALETTE } from './constants';

const funnelChartConfig = {
  count: { label: 'Projetos' },
} satisfies ChartConfig;

interface FunnelEntry {
  phase: string;
  count: number;
}

interface DashboardFunnelChartProps {
  data: FunnelEntry[];
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
        <ChartContainer config={funnelChartConfig} className="h-[280px] [&_.recharts-wrapper]:!aspect-auto">
            <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="phase" fontSize={11} stroke="hsl(var(--muted-foreground))" width={85} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
        </ChartContainer>
      )}
    </DashboardChartWrapper>
  );
}
