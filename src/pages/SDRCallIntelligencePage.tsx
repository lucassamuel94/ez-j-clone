import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCallAnalyses, CallAnalysis } from '@/hooks/useCallAnalyses';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BarChart3, Phone, TrendingUp, Target, CheckCircle2,
  AlertTriangle, Clock, Mic, Calendar as CalendarIcon
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ExecDatePeriod, getExecDateRange } from '@/pages/SDRIndicadoresPage';
import { formatDateBR, formatTimeBR } from '@/utils/dateFormat';
import { cn } from '@/lib/utils';

const CallAnalysisDetailModal = lazy(() =>
  import('@/components/admin/CallAnalysisDetailModal').then(m => ({ default: m.CallAnalysisDetailModal }))
);

const interestColors: Record<string, string> = {
  alto: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  medio: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  baixo: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const SDRCallIntelligencePage = () => {
  const { user } = useCurrentUser();
  const [datePeriod, setDatePeriod] = useState<ExecDatePeriod>('30d');
  const [selectedAnalysis, setSelectedAnalysis] = useState<CallAnalysis | null>(null);

  const dateRange = useMemo(() => getExecDateRange(datePeriod), [datePeriod]);

  const { data: analyses, isLoading } = useCallAnalyses(
    user ? { sdr_user_id: user.id, dateFrom: dateRange.start, dateTo: dateRange.end } : undefined
  );

  const completedAnalyses = useMemo(
    () => (analyses || []).filter(a => a.status === 'completed'),
    [analyses]
  );

  // KPIs
  const kpis = useMemo(() => {
    const completed = completedAnalyses;
    if (completed.length === 0) return { total: 0, avgScore: 0, connectionRate: 0, avgConversion: 0, nextStepRate: 0 };
    const avgScore = Math.round(completed.reduce((s, a) => s + (a.call_score || 0), 0) / completed.length);
    const connectionRate = Math.round((completed.filter(a => a.connection_effective).length / completed.length) * 100);
    const avgConversion = Math.round(completed.reduce((s, a) => s + (a.conversion_potential || 0), 0) / completed.length);
    const nextStepRate = Math.round((completed.filter(a => a.next_step_defined).length / completed.length) * 100);
    return { total: completed.length, avgScore, connectionRate, avgConversion, nextStepRate };
  }, [completedAnalyses]);

  // Evolution chart data — group by week
  const chartData = useMemo(() => {
    if (completedAnalyses.length === 0) return [];
    const weekMap = new Map<string, { scores: number[]; count: number }>();
    completedAnalyses.forEach(a => {
      const d = new Date(a.created_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      const entry = weekMap.get(key) || { scores: [], count: 0 };
      entry.scores.push(a.call_score || 0);
      entry.count++;
      weekMap.set(key, entry);
    });
    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, { scores, count }]) => ({
        week: formatDateBR(week, { day: '2-digit', month: '2-digit' }),
        score: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
        calls: count,
      }));
  }, [completedAnalyses]);

  // Macro feedback
  const macroFeedback = useMemo(() => {
    const completed = completedAnalyses;
    if (completed.length === 0) return null;
    const earlyPitchRate = Math.round((completed.filter(a => a.early_pitch).length / completed.length) * 100);
    const avgSdrTalk = Math.round(completed.reduce((s, a) => s + (a.sdr_talk_percentage || 0), 0) / completed.length);
    const avgLeadTalk = Math.round(completed.reduce((s, a) => s + (a.lead_talk_percentage || 0), 0) / completed.length);

    // Top objections
    const objMap = new Map<string, number>();
    completed.forEach(a => {
      (a.objections || []).forEach((obj: string) => {
        objMap.set(obj, (objMap.get(obj) || 0) + 1);
      });
    });
    const topObjections = Array.from(objMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));

    return { earlyPitchRate, avgSdrTalk, avgLeadTalk, topObjections };
  }, [completedAnalyses]);

  const formatDuration = useCallback((seconds: number | null) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, []);

  const allAnalyses = analyses || [];

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            title="Call Intelligence"
            subtitle="Acompanhe suas análises de chamadas com IA"
            icon={<Phone className="h-5 w-5" />}
          />
          <Select value={datePeriod} onValueChange={(v) => setDatePeriod(v as ExecDatePeriod)}>
            <SelectTrigger className="w-[160px]">
              <CalendarIcon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="month">Mês atual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard icon={<BarChart3 className="h-4 w-4" />} label="Análises" value={String(kpis.total)} />
            <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Score Médio" value={`${kpis.avgScore}`} subtitle="/100" color={kpis.avgScore >= 70 ? 'text-emerald-500' : kpis.avgScore >= 50 ? 'text-amber-500' : 'text-red-500'} />
            <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label="Conexão Efetiva" value={`${kpis.connectionRate}%`} subtitle="Efetivas / Total" />
            <KpiCard icon={<Target className="h-4 w-4" />} label="Potencial Conversão" value={`${kpis.avgConversion}%`} subtitle="Média geral" />
            <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label="Próximo Passo" value={`${kpis.nextStepRate}%`} subtitle="Definido / Total" />
          </div>
        )}

        {/* Chart + Macro Feedback */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Evolution Chart */}
          <Card className="lg:col-span-2 border border-border rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Evolução de Score</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }}
                      formatter={(v: number, name: string) => [v, name === 'score' ? 'Score' : 'Ligações']}
                    />
                    <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados no período
                </div>
              )}
            </CardContent>
          </Card>

          {/* Macro Feedback */}
          <Card className="border border-border rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Feedback Macro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {macroFeedback ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1"><Mic className="h-3 w-3" /> Fala SDR</span>
                      <span className="font-semibold">{macroFeedback.avgSdrTalk}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${macroFeedback.avgSdrTalk}%` }} />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1"><Mic className="h-3 w-3" /> Fala Lead</span>
                      <span className="font-semibold">{macroFeedback.avgLeadTalk}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${macroFeedback.avgLeadTalk}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Pitch precoce
                    </span>
                    <Badge variant="outline" className={cn(
                      'text-[10px]',
                      macroFeedback.earlyPitchRate > 30 ? 'border-red-500/20 text-red-500 bg-red-500/10' : 'border-emerald-500/20 text-emerald-500 bg-emerald-500/10'
                    )}>
                      {macroFeedback.earlyPitchRate}%
                    </Badge>
                  </div>
                  {macroFeedback.topObjections.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Top Objeções</p>
                      <div className="space-y-1">
                        {macroFeedback.topObjections.map(o => (
                          <div key={o.label} className="flex items-center justify-between text-xs">
                            <span className="truncate text-foreground">{o.label}</span>
                            <Badge variant="secondary" className="text-[10px] ml-2 shrink-0">{o.count}x</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados no período</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Analyses Table */}
        <Card className="border border-border rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Análises de Ligações</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Arquivo</TableHead>
                    <TableHead className="text-xs">Lead</TableHead>
                    <TableHead className="text-xs text-center">Duração</TableHead>
                    <TableHead className="text-xs text-center">Score</TableHead>
                    <TableHead className="text-xs text-center">Interesse</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : allAnalyses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                        Nenhuma análise encontrada no período
                      </TableCell>
                    </TableRow>
                  ) : (
                    allAnalyses.map(a => (
                      <TableRow
                        key={a.id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => a.status === 'completed' && setSelectedAnalysis(a)}
                      >
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatDateBR(a.created_at, { day: '2-digit', month: '2-digit' })}{' '}
                          <span className="text-muted-foreground">{formatTimeBR(a.created_at)}</span>
                        </TableCell>
                        <TableCell className="text-xs truncate max-w-[200px]">
                          {a.original_filename || '—'}
                        </TableCell>
                        <TableCell className="text-xs truncate max-w-[180px]">
                          {a.lead_data ? `${a.lead_data.name} — ${a.lead_data.company}` : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-center">{formatDuration(a.duration_seconds)}</TableCell>
                        <TableCell className="text-center">
                          {a.status === 'completed' ? (
                            <Badge variant="outline" className={cn(
                              'text-[10px]',
                              (a.call_score || 0) >= 70 ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/10' :
                              (a.call_score || 0) >= 50 ? 'border-amber-500/20 text-amber-500 bg-amber-500/10' :
                              'border-red-500/20 text-red-500 bg-red-500/10'
                            )}>
                              {a.call_score}
                            </Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          {a.interest_level ? (
                            <Badge variant="outline" className={cn('text-[10px] capitalize', interestColors[a.interest_level] || '')}>
                              {a.interest_level}
                            </Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn(
                            'text-[10px]',
                            a.status === 'completed' ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/10' :
                            a.status === 'processing' ? 'border-amber-500/20 text-amber-500 bg-amber-500/10' :
                            'border-muted-foreground/20'
                          )}>
                            {a.status === 'completed' ? 'Concluído' :
                             a.status === 'processing' ? 'Processando' :
                             a.status === 'uploaded' ? 'Aguardando' :
                             a.status === 'error' ? 'Erro' : a.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Suspense fallback={null}>
        {selectedAnalysis && (
          <CallAnalysisDetailModal
            analysis={selectedAnalysis}
            open={!!selectedAnalysis}
            onOpenChange={(open) => !open && setSelectedAnalysis(null)}
          />
        )}
      </Suspense>
    </AppLayout>
  );
};

const KpiCard = ({ icon, label, value, subtitle, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  color?: string;
}) => (
  <Card className="border border-border rounded-2xl shadow-sm hover:shadow-md transition-all duration-200">
    <CardContent className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
      <p className={cn("text-2xl font-bold tracking-tight", color || 'text-foreground')}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </CardContent>
  </Card>
);

export default SDRCallIntelligencePage;
