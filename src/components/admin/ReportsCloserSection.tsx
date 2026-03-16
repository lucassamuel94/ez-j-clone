import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useCloserReportMetrics,
  useCloserPerformanceBreakdown,
  useCloserStageDistribution,
  useCloserLostReasons,
  useCloserActivityMetrics,
  useCloserActivityBreakdown,
} from '@/hooks/useCloserReports';
import { CloserBreakdownDetailModal, type CloserMetricType } from './CloserBreakdownDetailModal';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import {
  Handshake,
  Users,
  CalendarDays,
  RefreshCw,
  BarChart3,
  Trophy,
  DollarSign,
  XCircle,
  Percent,
  Receipt,
  Timer,
  TrendingUp,
  Loader2,
  Info,
  AlertCircle,
  Eye,
  Activity,
  Video,
  FileText,
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExecDatePeriod, getExecDateRange } from '@/pages/SDRIndicadoresPage';

const fmt = (v: number) => v.toLocaleString('pt-BR');
const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--muted))',
];

export const ReportsCloserSection = () => {
  const [selectedCloserId, setSelectedCloserId] = useState<string>('all');
  const [datePeriod, setDatePeriod] = useState<ExecDatePeriod | 'custom'>('today');
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [detailModal, setDetailModal] = useState<{ closerId: string; closerName: string; metric: CloserMetricType } | null>(null);

  const dateRange = useMemo(() => {
    if (datePeriod === 'custom' && customDate) {
      return {
        start: startOfDay(customDate).toISOString(),
        end: endOfDay(customDate).toISOString(),
        label: format(customDate, 'dd/MM/yyyy'),
      };
    }
    return getExecDateRange(datePeriod === 'custom' ? 'today' : datePeriod);
  }, [datePeriod, customDate]);
  const closerFilter = selectedCloserId !== 'all' ? selectedCloserId : undefined;

  // Closer profiles
  const { data: closerProfiles = [], dataUpdatedAt } = useQuery({
    queryKey: ['closerProfilesReport'],
    staleTime: 300_000,
    queryFn: async () => {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['closer', 'admin', 'manager']);
      const userIds = (roleData || []).map(r => r.user_id);
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('active', true)
        .in('id', userIds)
        .order('name');
      return data || [];
    },
  });

  useEffect(() => {
    if (dataUpdatedAt) setLastUpdated(new Date());
  }, [dataUpdatedAt]);

  // Data hooks
  const { data: metrics, isLoading: isLoadingMetrics, error: metricsError } = useCloserReportMetrics({ closerId: closerFilter, dateRange });
  
  const { data: breakdown = [] } = useCloserPerformanceBreakdown(dateRange);
  const { data: stageData = [], isLoading: isLoadingStage } = useCloserStageDistribution(closerFilter, dateRange);
  const { data: lostReasons = [], isLoading: isLoadingLost } = useCloserLostReasons(closerFilter, dateRange);

  const { data: activityMetrics, isLoading: isLoadingActivity } = useCloserActivityMetrics({ closerId: closerFilter, dateRange });
  const { data: activityBreakdown = [] } = useCloserActivityBreakdown(dateRange);

  const stageTotal = stageData.reduce((s, i) => s + i.count, 0);
  const lostTotal = lostReasons.reduce((s, i) => s + i.count, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<BarChart3 className="h-5 w-5" />}
        title="Relatórios Closer"
        subtitle="Métricas e performance da equipe de vendas"
      />

      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground mr-1" />
            {(['today', 'yesterday', '7d', '30d', 'month'] as ExecDatePeriod[]).map((p) => {
              const { label } = getExecDateRange(p);
              return (
                <Button
                  key={p}
                  size="sm"
                  variant={datePeriod === p ? 'default' : 'outline'}
                  className="h-7 text-xs px-3"
                  onClick={() => { setDatePeriod(p); setCustomDate(undefined); }}
                >
                  {label}
                </Button>
              );
            })}

            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant={datePeriod === 'custom' ? 'default' : 'outline'}
                  className="h-7 text-xs px-3 gap-1.5"
                >
                  <CalendarDays className="h-3 w-3" />
                  {datePeriod === 'custom' && customDate
                    ? format(customDate, 'dd/MM/yyyy')
                    : 'Data específica'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customDate}
                  onSelect={(date) => {
                    setCustomDate(date);
                    if (date) {
                      setDatePeriod('custom');
                      setCalendarOpen(false);
                    }
                  }}
                  locale={ptBR}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
              <SelectTrigger className="w-[180px] h-8 text-xs font-medium">
                <SelectValue placeholder="Filtrar por Closer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Closers</SelectItem>
                {closerProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          <span>Atualizado: {format(lastUpdated, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoadingMetrics ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : metricsError ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-8 w-8 text-destructive mb-2" />
          <p className="text-sm text-destructive font-medium">Erro ao carregar métricas</p>
          <p className="text-xs text-muted-foreground mt-1">{String(metricsError)}</p>
        </div>
      ) : (
        <TooltipProvider delayDuration={300}>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 mb-1 cursor-help">
                      <Handshake className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Oportunidades</span>
                      <Info className="h-3 w-3 text-muted-foreground/50" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">Total de oportunidades criadas no período</p>
                  </TooltipContent>
                </Tooltip>
                <p className="text-2xl font-bold text-foreground font-display">{fmt(metrics?.totalOpportunities || 0)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 mb-1 cursor-help">
                      <Trophy className="h-4 w-4 text-[hsl(var(--chart-3))]" />
                      <span className="text-xs text-muted-foreground">Ganhas</span>
                      <Info className="h-3 w-3 text-muted-foreground/50" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">Deals fechados com sucesso no período</p>
                  </TooltipContent>
                </Tooltip>
                <p className="text-2xl font-bold text-foreground font-display">{fmt(metrics?.won || 0)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 mb-1 cursor-help">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <span className="text-xs text-muted-foreground">Receita Fechada</span>
                      <Info className="h-3 w-3 text-muted-foreground/50" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">Soma do valor dos deals ganhos no período</p>
                  </TooltipContent>
                </Tooltip>
                <p className="text-2xl font-bold text-foreground font-display">{fmtCurrency(metrics?.revenue || 0)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 mb-1 cursor-help">
                      <XCircle className="h-4 w-4 text-destructive" />
                      <span className="text-xs text-muted-foreground">Perdidas</span>
                      <Info className="h-3 w-3 text-muted-foreground/50" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">Oportunidades marcadas como perdidas no período</p>
                  </TooltipContent>
                </Tooltip>
                <p className={cn('text-2xl font-bold font-display', (metrics?.lost || 0) > 0 ? 'text-destructive' : 'text-foreground')}>
                  {fmt(metrics?.lost || 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Operational Metrics */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mt-3">
            <Card>
              <CardContent className="p-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 mb-1 cursor-help">
                      <Percent className="h-4 w-4 text-primary" />
                      <span className="text-xs text-muted-foreground">Taxa de Conversão</span>
                      <Info className="h-3 w-3 text-muted-foreground/50" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">Ganhas ÷ Total de oportunidades no período × 100</p>
                  </TooltipContent>
                </Tooltip>
                <p className="text-2xl font-bold text-foreground font-display">{metrics?.conversionRate || 0}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 mb-1 cursor-help">
                      <Receipt className="h-4 w-4 text-[hsl(var(--chart-2))]" />
                      <span className="text-xs text-muted-foreground">Ticket Médio</span>
                      <Info className="h-3 w-3 text-muted-foreground/50" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">Receita total ÷ Quantidade de deals ganhos</p>
                  </TooltipContent>
                </Tooltip>
                <p className="text-2xl font-bold text-foreground font-display">{fmtCurrency(metrics?.avgTicket || 0)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 mb-1 cursor-help">
                      <Timer className="h-4 w-4 text-[hsl(var(--chart-4))]" />
                      <span className="text-xs text-muted-foreground">Ciclo Médio</span>
                      <Info className="h-3 w-3 text-muted-foreground/50" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">Média de dias entre criação e fechamento dos deals ganhos</p>
                  </TooltipContent>
                </Tooltip>
                 <p className="text-2xl font-bold text-foreground font-display">
                  {metrics?.avgCycleDays || 0} <span className="text-sm font-normal text-muted-foreground">dias</span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 mb-1 cursor-help">
                      <TrendingUp className="h-4 w-4 text-[hsl(var(--chart-3))]" />
                      <span className="text-xs text-muted-foreground">Pipeline Ativo</span>
                      <Info className="h-3 w-3 text-muted-foreground/50" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">Valor total de oportunidades em estágios ativos (não Ganho/Perdido)</p>
                  </TooltipContent>
                </Tooltip>
                <p className="text-2xl font-bold text-foreground font-display">{fmtCurrency(metrics?.activePipelineValue || 0)}</p>
              </CardContent>
            </Card>
          </div>
        </TooltipProvider>
      )}

      {/* Activity Metrics Section */}
      {isLoadingActivity ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Atividade Operacional</span>
          </div>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="h-4 w-4 text-primary" />
                   <span className="text-xs text-muted-foreground">Oportunidades Trabalhadas</span>
                 </div>
                 <p className="text-2xl font-bold text-foreground font-display">{fmt(activityMetrics.opportunitiesWorked)}</p>
                 <p className="text-[10px] text-muted-foreground mt-0.5">oportunidades com atividade no período</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="h-4 w-4 text-[hsl(var(--chart-2))]" />
                  <span className="text-xs text-muted-foreground">Atividades Registradas</span>
                </div>
                <p className="text-2xl font-bold text-foreground font-display">{fmt(activityMetrics.totalActivities)}</p>
                {Object.keys(activityMetrics.activitiesByType).length > 0 && (
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                    {Object.entries(activityMetrics.activitiesByType)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 4)
                      .map(([type, count]) => (
                        <span key={type} className="text-[10px] text-muted-foreground">
                          {type}: <span className="font-semibold text-foreground">{count}</span>
                        </span>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Video className="h-4 w-4 text-[hsl(var(--chart-3))]" />
                  <span className="text-xs text-muted-foreground">Reuniões Realizadas</span>
                </div>
                <p className="text-2xl font-bold text-foreground font-display">{fmt(activityMetrics.meetingsHeld)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">no período selecionado</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-[hsl(var(--chart-4))]" />
                  <span className="text-xs text-muted-foreground">Propostas Enviadas</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{fmt(activityMetrics.proposalsSent)}</p>
                {activityMetrics.proposalsSent > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    <span className="font-semibold text-foreground">{activityMetrics.proposalsNew}</span> novas · <span className="font-semibold text-foreground">{activityMetrics.proposalsEvolution}</span> evoluções
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Activity Breakdown by Closer */}
      {selectedCloserId === 'all' && activityBreakdown.length > 0 && (
        <TooltipProvider delayDuration={300}>
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Atividade por Closer</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">Closer</th>
                    <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <span className="inline-flex items-center gap-1 cursor-help">Oport. Trabalhadas <Info className="h-3 w-3 text-muted-foreground/50" /></span>
                         </TooltipTrigger>
                         <TooltipContent side="bottom">
                           <p className="text-xs">Oportunidades cujo lead recebeu alguma nota ou registro no período</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-help">Atividades <Info className="h-3 w-3 text-muted-foreground/50" /></span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">Total de registros: ligações, e-mails, WhatsApp, tarefas e observações</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-help">Reuniões <Info className="h-3 w-3 text-muted-foreground/50" /></span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">Oportunidades com data de reunião dentro do período selecionado</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-help">Propostas <Info className="h-3 w-3 text-muted-foreground/50" /></span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">Propostas comerciais criadas no período (novas + evoluções)</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activityBreakdown.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-foreground">{row.name}</td>
                      <td className="text-center px-3 py-2.5 tabular-nums">
                        <button onClick={() => setDetailModal({ closerId: row.id, closerName: row.name, metric: 'opportunities_worked' })} className="hover:text-primary hover:underline cursor-pointer transition-colors">{fmt(row.opportunitiesWorked)}</button>
                      </td>
                      <td className="text-center px-3 py-2.5 tabular-nums font-semibold">
                        <button onClick={() => setDetailModal({ closerId: row.id, closerName: row.name, metric: 'activities' })} className="hover:text-primary hover:underline cursor-pointer transition-colors">{fmt(row.activities)}</button>
                      </td>
                      <td className="text-center px-3 py-2.5 tabular-nums text-[hsl(var(--chart-3))]">
                        <button onClick={() => setDetailModal({ closerId: row.id, closerName: row.name, metric: 'meetings' })} className="hover:text-primary hover:underline cursor-pointer transition-colors">{fmt(row.meetings)}</button>
                      </td>
                      <td className="text-center px-3 py-2.5 tabular-nums text-[hsl(var(--chart-4))]">
                        <button onClick={() => setDetailModal({ closerId: row.id, closerName: row.name, metric: 'proposals' })} className="hover:text-primary hover:underline cursor-pointer transition-colors">{fmt(row.proposals)}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        </TooltipProvider>
      )}

      {selectedCloserId === 'all' && breakdown.length > 1 && (
        <TooltipProvider delayDuration={300}>
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Performance por Closer</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">Closer</th>
                    <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-help">Oportunidades <Info className="h-3 w-3 text-muted-foreground/50" /></span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">Total de oportunidades ativas (excluindo Ganhas e Perdidas), sem filtro de período</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-help">Ganhas <Info className="h-3 w-3 text-muted-foreground/50" /></span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">Oportunidades com stage &apos;Ganho&apos; no período selecionado, filtradas por data de fechamento (won_at)</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-help">Perdidas <Info className="h-3 w-3 text-muted-foreground/50" /></span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">Oportunidades com stage &apos;Perdido&apos; no período selecionado, filtradas por data de atualização</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-help">Contratos Pendentes <Info className="h-3 w-3 text-muted-foreground/50" /></span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">Valor total de oportunidades em &apos;Contrato enviado&apos; e &apos;Aguardando pagamento&apos; no período</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-help">Setup Vendido <Info className="h-3 w-3 text-muted-foreground/50" /></span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">Soma do setup_total das propostas vinculadas às oportunidades ganhas no período. Usa deal_value como fallback quando não há proposta.</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-help">Taxa (%) <Info className="h-3 w-3 text-muted-foreground/50" /></span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">Vendas realizadas ÷ Total de reuniões realizadas no período × 100</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...breakdown].sort((a, b) => b.revenue - a.revenue).map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-foreground">{row.name}</td>
                      <td className="text-center px-3 py-2.5 tabular-nums">{fmt(row.opportunities)}</td>
                      <td className="text-center px-3 py-2.5 tabular-nums text-[hsl(var(--chart-3))] font-semibold">
                        <button onClick={() => setDetailModal({ closerId: row.id, closerName: row.name, metric: 'won' })} className="hover:text-primary hover:underline cursor-pointer transition-colors">{fmt(row.won)}</button>
                      </td>
                      <td className="text-center px-3 py-2.5 tabular-nums">
                        <button onClick={() => setDetailModal({ closerId: row.id, closerName: row.name, metric: 'lost' })} className={cn('hover:text-primary hover:underline cursor-pointer transition-colors', row.lost > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground')}>{fmt(row.lost)}</button>
                      </td>
                      <td className="text-center px-3 py-2.5 tabular-nums font-semibold text-[hsl(var(--chart-2))]">{fmtCurrency(row.pendingContractsValue)}</td>
                      <td className="text-center px-3 py-2.5 tabular-nums font-semibold">{fmtCurrency(row.revenue)}</td>
                      <td className="text-center px-3 py-2.5 tabular-nums">{row.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        </TooltipProvider>
      )}

      {/* Distribution Charts */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* By Stage */}
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Estágio da Negociação</span>
            </div>
            <div className="p-4">
              {isLoadingStage ? (
                <div className="flex items-center justify-center h-[200px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : stageData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-center">
                  <Handshake className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhuma oportunidade encontrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stageData.map((entry, index) => {
                    const pct = stageTotal > 0 ? Math.round((entry.count / stageTotal) * 100) : 0;
                    const color = COLORS[index % COLORS.length];
                    return (
                      <div key={entry.stage} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-xs font-medium text-foreground truncate">{entry.stage}</span>
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {fmt(entry.count)} <span className="text-muted-foreground/60">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lost Reasons */}
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Motivos de Perda</span>
            </div>
            <div className="p-4">
              {isLoadingLost ? (
                <div className="flex items-center justify-center h-[200px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : lostReasons.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-center">
                  <XCircle className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhuma perda registrada no período</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lostReasons.map((entry, index) => {
                    const pct = lostTotal > 0 ? Math.round((entry.count / lostTotal) * 100) : 0;
                    const color = COLORS[index % COLORS.length];
                    return (
                      <div key={entry.reason} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-xs font-medium text-foreground truncate">{entry.reason}</span>
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {fmt(entry.count)} <span className="text-muted-foreground/60">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {detailModal && (
        <CloserBreakdownDetailModal
          open={!!detailModal}
          onOpenChange={(open) => { if (!open) setDetailModal(null); }}
          closerId={detailModal.closerId}
          closerName={detailModal.closerName}
          metricType={detailModal.metric}
          dateStart={dateRange.start}
          dateEnd={dateRange.end}
        />
      )}
    </div>
  );
};
