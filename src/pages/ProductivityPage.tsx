import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TrendingUp, CheckCircle2, Target, BarChart3, ArrowDown, Loader2, Trophy } from 'lucide-react';
import { useProductivityMetrics, TeamType } from '@/hooks/useProductivityMetrics';

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

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const TEAM_LABELS: Record<TeamType, string> = {
  ux_po: 'UX/PO',
  dev_chatbot: 'Dev Chatbot',
  treinamento: 'Treinamento',
};

const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

interface RankingUser {
  userId: string;
  userName: string;
  goal: number;
  delivered: number;
  percentage: number;
  remaining: number;
}

const ProductivityPage = () => {
  const [teamType, setTeamType] = useState<TeamType>('ux_po');
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  

  const { data: metrics, isLoading } = useProductivityMetrics(teamType, month, year);

  const metricCards = [
    { label: 'Projetos Entregues', value: metrics?.totalDelivered ?? 0, icon: CheckCircle2, color: 'text-success' },
    { label: 'Meta do Time', value: metrics?.teamGoal ?? 0, icon: Target, color: 'text-primary' },
    { label: '% Meta Atingida', value: `${metrics?.avgPercentage ?? 0}%`, icon: BarChart3, color: 'text-info' },
    { label: 'Faltam para Meta', value: metrics?.remaining ?? 0, icon: ArrowDown, color: 'text-warning' },
  ];

  const columns = useMemo<ColumnDef<RankingUser>[]>(() => [
    {
      id: 'rank',
      header: () => <span className="text-xs">#</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const index = row.index;
        return (
          <span className="text-center font-bold text-muted-foreground block">
            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
          </span>
        );
      },
    },
    {
      accessorKey: 'userName',
      header: ({ column }) => <TableColumnHeader column={column} title="Colaborador" />,
      cell: ({ row }) => {
        const user = row.original;
        const initials = user.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-sm">{user.userName}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'goal',
      header: ({ column }) => <TableColumnHeader column={column} title="Meta" />,
      cell: ({ row }) => <span className="text-center tabular-nums block">{row.original.goal}</span>,
    },
    {
      accessorKey: 'delivered',
      header: ({ column }) => <TableColumnHeader column={column} title="Realizado" />,
      cell: ({ row }) => <span className="text-center font-semibold tabular-nums block">{row.original.delivered}</span>,
    },
    {
      accessorKey: 'percentage',
      header: ({ column }) => <TableColumnHeader column={column} title="% Meta" />,
      cell: ({ row }) => {
        const pct = row.original.percentage;
        return (
          <div className="flex justify-center">
            <Badge
              variant="secondary"
              className={`text-xs tabular-nums ${
                pct >= 100 ? 'bg-success/10 text-success' :
                pct >= 70 ? 'bg-info/10 text-info' :
                'bg-warning/10 text-warning'
              }`}
            >
              {pct}%
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: 'remaining',
      header: ({ column }) => <TableColumnHeader column={column} title="Faltam" />,
      cell: ({ row }) => <span className="text-center tabular-nums text-muted-foreground block">{row.original.remaining}</span>,
    },
  ], []);

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          <PageHeader
            icon={<TrendingUp className="h-5 w-5" />}
            title="Produtividade Pós-Vendas"
            toolbar={
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
                  <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                  <SelectTrigger className="w-[90px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            }
          />

          <Tabs value={teamType} onValueChange={v => setTeamType(v as TeamType)}>
            <TabsList>
              {Object.entries(TEAM_LABELS).map(([key, label]) => (
                <TabsTrigger key={key} value={key}>{label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Metric Strip */}
          <div className="flex gap-3 overflow-x-auto snap-x pb-1">
            {metricCards.map(card => (
              <Card key={card.label} className="min-w-[160px] flex-1 bg-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</p>
                      <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{card.value}</p>
                    </div>
                    <card.icon className={`h-7 w-7 ${card.color} opacity-70`} strokeWidth={1.5} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Progress Bar */}
          {metrics && metrics.teamGoal > 0 && (
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Progresso Geral</span>
                  <span className="text-sm font-bold text-foreground tabular-nums">{metrics.totalDelivered}/{metrics.teamGoal}</span>
                </div>
                <Progress value={Math.min(100, (metrics.totalDelivered / metrics.teamGoal) * 100)} className="h-2" />
              </CardContent>
            </Card>
          )}

          {/* Ranking Table */}
          <Card className="bg-card border-border/50">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !metrics || metrics.ranking.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <Trophy className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  Nenhum dado de produtividade para este período.
                </div>
              ) : (
                <TableProvider columns={columns} data={metrics.ranking as RankingUser[]}>
                  <TableHeader>
                    {({ headerGroup }) => (
                      <TableHeaderGroup headerGroup={headerGroup}>
                        {({ header }) => <TableHead header={header} />}
                      </TableHeaderGroup>
                    )}
                  </TableHeader>
                  <TableBody>
                    {({ row }) => (
                      <TableRow key={row.id} row={row}>
                        {({ cell }) => <TableCell cell={cell} />}
                      </TableRow>
                    )}
                  </TableBody>
                </TableProvider>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
    </AppLayout>
  );
};

export default ProductivityPage;
