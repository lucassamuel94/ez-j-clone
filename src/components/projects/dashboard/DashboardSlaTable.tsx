import { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useIsMobile } from '@/hooks/use-mobile';
import { PHASE_LABELS } from '@/types/project';
import type { SlaEntry } from '@/hooks/useProjectDashboard';
import {
  TableProvider,
  TableHeader,
  TableHeaderGroup,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableColumnHeader,
  type ColumnDef,
} from '@/components/kibo-ui/table';

interface DashboardSlaTableProps {
  data: SlaEntry[];
}

function getComplianceClasses(pct: number) {
  if (pct >= 80) return 'bg-chart-3/15 text-[hsl(var(--chart-3))]';
  if (pct >= 50) return 'bg-chart-2/15 text-[hsl(var(--chart-2))]';
  return 'bg-destructive/15 text-destructive';
}

export function DashboardSlaTable({ data }: DashboardSlaTableProps) {
  const isMobile = useIsMobile();

  const columns = useMemo<ColumnDef<SlaEntry>[]>(() => [
    {
      accessorKey: 'phase',
      header: ({ column }) => <TableColumnHeader column={column} title="Fase" />,
      cell: ({ row }) => <span className="font-medium">{PHASE_LABELS[row.original.phase] || row.original.phase}</span>,
    },
    {
      accessorKey: 'benchmarkDays',
      header: ({ column }) => <TableColumnHeader column={column} title="SLA (dias)" />,
      cell: ({ row }) => <span className="text-center tabular-nums block">{row.original.benchmarkDays}d</span>,
    },
    {
      accessorKey: 'avgDays',
      header: ({ column }) => <TableColumnHeader column={column} title="Média Real" />,
      cell: ({ row }) => (
        <span className={`text-center tabular-nums block ${row.original.avgDays > row.original.benchmarkDays ? 'text-destructive font-semibold' : 'text-foreground'}`}>
          {row.original.avgDays}d
        </span>
      ),
    },
    {
      id: 'withinSla',
      header: () => <span className="text-xs">Dentro do SLA</span>,
      enableSorting: false,
      cell: ({ row }) => <span className="text-center tabular-nums block">{row.original.withinSla}/{row.original.totalCompleted}</span>,
    },
    {
      accessorKey: 'compliancePercent',
      header: ({ column }) => <TableColumnHeader column={column} title="% Compliance" />,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <Badge variant="secondary" className={`text-xs tabular-nums ${getComplianceClasses(row.original.compliancePercent)}`}>
            {row.original.compliancePercent}%
          </Badge>
        </div>
      ),
    },
  ], []);

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
            SLA Compliance
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className={isMobile ? 'px-4 pb-4' : 'p-0'}>
        {isMobile ? (
          <div className="space-y-3">
            {data.map((row) => (
              <div key={row.phase} className="space-y-1.5 pb-3 border-b border-border/30 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{PHASE_LABELS[row.phase] || row.phase}</span>
                  <Badge variant="secondary" className={`text-xs tabular-nums ${getComplianceClasses(row.compliancePercent)}`}>
                    {row.compliancePercent}%
                  </Badge>
                </div>
                <Progress value={row.compliancePercent} className="h-1.5" />
                <div className="flex gap-3 text-[10px] text-muted-foreground">
                  <span>SLA: {row.benchmarkDays}d</span>
                  <span>Média: {row.avgDays}d</span>
                  <span>{row.withinSla}/{row.totalCompleted} dentro</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <TableProvider columns={columns} data={data}>
            <TableHeader>
              {({ headerGroup }) => (
                <TableHeaderGroup headerGroup={headerGroup}>
                  {({ header }) => <TableHead header={header} />}
                </TableHeaderGroup>
              )}
            </TableHeader>
            <TableBody>
              {({ row }) => (
                <TableRow key={row.id} row={row} className="even:bg-muted/5">
                  {({ cell }) => <TableCell cell={cell} />}
                </TableRow>
              )}
            </TableBody>
          </TableProvider>
        )}
      </CardContent>
    </Card>
  );
}
