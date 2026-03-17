import { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCallAnalyses, useCallAnalysisStats, useUploadCallAnalysis, useStartAnalysis, CallAnalysis } from '@/hooks/useCallAnalyses';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  BarChart3, Phone, TrendingUp, Target, CheckCircle2,
  AlertTriangle, Clock, Mic, Calendar as CalendarIcon,
  Users, ArrowUp, ArrowDown, Minus, Presentation,
  ChevronLeft, ChevronRight, Trophy, Upload, Search, Loader2
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

// ─── Shared view component ────────────────────────────────────────────────────

interface CallIntelligenceViewProps {
  context: 'sdr_call' | 'demo_closer';
}

// ─── SDR Upload Section ──────────────────────────────────────────────────────

const DAILY_LIMIT = 5;
const ACCEPTED_AUDIO = '.mp3,.wav,.ogg,.m4a,.webm,.aac,.flac';

interface LeadOption {
  id: string;
  name: string;
  company: string;
}

const SDRUploadSection = ({ userId }: { userId: string }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadResults, setLeadResults] = useState<LeadOption[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);
  const [searching, setSearching] = useState(false);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const uploadMutation = useUploadCallAnalysis();
  const startMutation = useStartAnalysis();

  // Count today's uploads
  useEffect(() => {
    const fetchCount = async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { count: c } = await (supabase
        .from('call_analyses' as any)
        .select('*', { count: 'exact', head: true }) as any)
        .eq('uploaded_by', userId)
        .gte('created_at', startOfDay.toISOString());
      setTodayCount(c ?? 0);
    };
    fetchCount();
  }, [userId, uploadMutation.isSuccess]);

  // Lead search
  useEffect(() => {
    if (leadSearch.length < 2) { setLeadResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const term = `%${leadSearch}%`;
      const { data } = await supabase
        .from('leads')
        .select('id, name, company')
        .or(`name.ilike.${term},company.ilike.${term}`)
        .limit(5);
      setLeadResults((data || []) as LeadOption[]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [leadSearch]);

  const canUpload = todayCount !== null && todayCount < DAILY_LIMIT;
  const isSubmitting = uploadMutation.isPending || startMutation.isPending;

  const handleSubmit = async () => {
    if (!file || !canUpload) return;
    try {
      const result = await uploadMutation.mutateAsync({
        file,
        sdr_user_id: userId,
        lead_id: selectedLead?.id,
        media_type: 'audio',
        analysis_context: 'sdr_call',
      });
      if (result?.id) {
        await startMutation.mutateAsync([result.id]);
      }
      setFile(null);
      setSelectedLead(null);
      setLeadSearch('');
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      // errors handled by hooks
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  return (
    <Card className="border border-border rounded-2xl shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          {/* Drop zone / file picker */}
          <div
            className={cn(
              "flex-1 min-w-0 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors",
              file ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/30"
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_AUDIO}
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Arraste um áudio ou clique para selecionar</p>
              </div>
            )}
          </div>

          {/* Lead search */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar lead (opcional)"
              className="pl-8 h-9 text-xs"
              value={selectedLead ? `${selectedLead.name} — ${selectedLead.company}` : leadSearch}
              onChange={(e) => {
                setLeadSearch(e.target.value);
                if (selectedLead) setSelectedLead(null);
              }}
            />
            {leadResults.length > 0 && !selectedLead && (
              <div className="absolute z-20 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-auto">
                {leadResults.map(l => (
                  <button
                    key={l.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors"
                    onClick={() => {
                      setSelectedLead(l);
                      setLeadResults([]);
                    }}
                  >
                    {l.name} — <span className="text-muted-foreground">{l.company}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Submit + counter */}
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-[10px] whitespace-nowrap shrink-0">
              {todayCount ?? '…'}/{DAILY_LIMIT} hoje
            </Badge>
            <Button
              size="sm"
              disabled={!file || !canUpload || isSubmitting}
              onClick={handleSubmit}
              className="shrink-0"
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Enviar para Análise
            </Button>
          </div>
        </div>
        {todayCount !== null && !canUpload && (
          <p className="text-xs text-destructive mt-2">Limite diário atingido ({DAILY_LIMIT}/{DAILY_LIMIT}). Tente novamente amanhã.</p>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Shared view component ────────────────────────────────────────────────────

const CallIntelligenceView = ({ context }: CallIntelligenceViewProps) => {
  const { user } = useCurrentUser();
  const [datePeriod, setDatePeriod] = useState<ExecDatePeriod>('30d');
  const [selectedAnalysis, setSelectedAnalysis] = useState<CallAnalysis | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const isDemo = context === 'demo_closer';
  const dateRange = useMemo(() => getExecDateRange(datePeriod), [datePeriod]);

  // User's own analyses
  const { data: analyses, isLoading } = useCallAnalyses(
    user
      ? { sdr_user_id: user.id, analysis_context: context, dateFrom: dateRange.start, dateTo: dateRange.end }
      : undefined
  );

  // Team-wide stats for reference (same period, same context, all users)
  const { data: teamStatsRaw = [] } = useCallAnalysisStats(undefined, context);

  const completedAnalyses = useMemo(
    () => (analyses || []).filter(a => a.status === 'completed'),
    [analyses]
  );

  const teamCompletedStats = useMemo(
    () => teamStatsRaw.filter((a: any) => a.status === 'completed' || !a.status), // stats hook returns completed only
    [teamStatsRaw]
  );

  // User KPIs
  const kpis = useMemo(() => {
    const completed = completedAnalyses;
    if (completed.length === 0) return { total: 0, avgScore: 0, connectionRate: 0, avgConversion: 0, nextStepRate: 0 };
    const avgScore = Math.round(completed.reduce((s, a) => s + (a.call_score || 0), 0) / completed.length);
    const connectionRate = Math.round((completed.filter(a => a.connection_effective).length / completed.length) * 100);
    const avgConversion = Math.round(completed.reduce((s, a) => s + (a.conversion_potential || 0), 0) / completed.length);
    const nextStepRate = Math.round((completed.filter(a => a.next_step_defined).length / completed.length) * 100);
    return { total: completed.length, avgScore, connectionRate, avgConversion, nextStepRate };
  }, [completedAnalyses]);

  // Team avg score
  const teamAvgScore = useMemo(() => {
    if (teamStatsRaw.length === 0) return null;
    return Math.round(teamStatsRaw.reduce((s: number, a: any) => s + (a.call_score || 0), 0) / teamStatsRaw.length);
  }, [teamStatsRaw]);

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
    const avgSelfTalk = Math.round(completed.reduce((s, a) => s + (a.sdr_talk_percentage || 0), 0) / completed.length);
    const avgLeadTalk = Math.round(completed.reduce((s, a) => s + (a.lead_talk_percentage || 0), 0) / completed.length);
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
    return { earlyPitchRate, avgSelfTalk, avgLeadTalk, topObjections };
  }, [completedAnalyses]);

  

  const formatDuration = useCallback((seconds: number | null) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, []);

  const allAnalyses = analyses || [];

  // Reset page when filters or data change
  useEffect(() => { setPage(1); }, [pageSize, datePeriod, analyses]);

  const totalPages = Math.max(1, Math.ceil(allAnalyses.length / pageSize));
  const paginatedAnalyses = allAnalyses.slice((page - 1) * pageSize, page * pageSize);
  const showFrom = allAnalyses.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showTo = Math.min(page * pageSize, allAnalyses.length);

  const scoreDiff = teamAvgScore !== null && kpis.avgScore > 0 ? kpis.avgScore - teamAvgScore : null;

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            title="Call Intelligence"
            subtitle={isDemo
              ? 'Acompanhe suas análises de demonstrações com IA'
              : 'Acompanhe suas análises de chamadas com IA'}
            icon={isDemo ? <Presentation className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
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

        {/* SDR Upload Section (only for sdr_call context) */}
        {!isDemo && user && <SDRUploadSection userId={user.id} />}

        {/* KPI Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard
              icon={<BarChart3 className="h-4 w-4" />}
              label={isDemo ? 'Demos' : 'Análises'}
              value={String(kpis.total)}
            />
            <KpiCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Meu Score Médio"
              value={kpis.avgScore > 0 ? `${kpis.avgScore}` : '—'}
              subtitle="/100"
              color={kpis.avgScore >= 70 ? 'text-emerald-500' : kpis.avgScore >= 50 ? 'text-amber-500' : kpis.avgScore > 0 ? 'text-red-500' : undefined}
            />
            {/* Team average card */}
            <TeamAvgCard
              teamAvgScore={teamAvgScore}
              userAvgScore={kpis.avgScore > 0 ? kpis.avgScore : null}
              scoreDiff={scoreDiff}
            />
            <KpiCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Conexão Efetiva"
              value={kpis.total > 0 ? `${kpis.connectionRate}%` : '—'}
              subtitle="Efetivas / Total"
            />
            <KpiCard
              icon={<Target className="h-4 w-4" />}
              label="Potencial Conversão"
              value={kpis.total > 0 ? `${kpis.avgConversion}%` : '—'}
              subtitle="Média geral"
            />
            <KpiCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Próximo Passo"
              value={kpis.total > 0 ? `${kpis.nextStepRate}%` : '—'}
              subtitle="Definido / Total"
            />
          </div>
        )}

        {/* Chart + Macro Feedback */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 border border-border rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Evolução de Score — {isDemo ? 'Demos' : 'Ligações'}
              </CardTitle>
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
                      formatter={(v: number, name: string) => [v, name === 'score' ? 'Score' : isDemo ? 'Demos' : 'Ligações']}
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
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Mic className="h-3 w-3" /> {isDemo ? 'Fala Closer' : 'Fala SDR'}
                      </span>
                      <span className="font-semibold">{macroFeedback.avgSelfTalk}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${macroFeedback.avgSelfTalk}%` }} />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Mic className="h-3 w-3" /> Fala Lead
                      </span>
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
                      macroFeedback.earlyPitchRate > 30
                        ? 'border-red-500/20 text-red-500 bg-red-500/10'
                        : 'border-emerald-500/20 text-emerald-500 bg-emerald-500/10'
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
            <CardTitle className="text-sm font-semibold">
              {isDemo ? 'Análises de Demonstrações' : 'Análises de Ligações'}
            </CardTitle>
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
                    <TableHead className="text-xs text-center w-16">Venda</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : allAnalyses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                        Nenhuma análise encontrada no período
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedAnalyses.map(a => (
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
                            <Badge variant="outline" className={cn('text-[10px] capitalize', interestColors[a.interest_level?.toLowerCase()] || '')}>
                              {a.interest_level}
                            </Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          {a.converted_to_sale && (
                            <span className="inline-flex items-center justify-center text-success" title="Venda realizada">
                              <Trophy className="h-4 w-4" />
                            </span>
                          )}
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
            {/* Pagination bar */}
            {allAnalyses.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Linhas por página</span>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="w-[70px] h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  Mostrando {showFrom}–{showTo} de {allAnalyses.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs tabular-nums text-muted-foreground px-1">{page} / {totalPages}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
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

// ─── Sub-components ───────────────────────────────────────────────────────────

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

const TeamAvgCard = ({
  teamAvgScore,
  userAvgScore,
  scoreDiff,
}: {
  teamAvgScore: number | null;
  userAvgScore: number | null;
  scoreDiff: number | null;
}) => {
  const teamColor = teamAvgScore !== null
    ? teamAvgScore >= 70 ? 'text-emerald-500' : teamAvgScore >= 50 ? 'text-amber-500' : 'text-red-500'
    : 'text-muted-foreground';

  const diffColor = scoreDiff === null ? '' : scoreDiff > 0 ? 'text-emerald-600 dark:text-emerald-400' : scoreDiff < 0 ? 'text-red-500' : 'text-muted-foreground';
  const DiffIcon = scoreDiff === null ? null : scoreDiff > 0 ? ArrowUp : scoreDiff < 0 ? ArrowDown : Minus;

  return (
    <Card className="border border-border rounded-2xl shadow-sm hover:shadow-md transition-all duration-200">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Média da Equipe</span>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Users className="h-4 w-4" />
          </div>
        </div>
        <p className={cn("text-2xl font-bold tracking-tight", teamColor)}>
          {teamAvgScore !== null ? teamAvgScore : '—'}
        </p>
        {scoreDiff !== null && userAvgScore !== null && DiffIcon ? (
          <p className={cn("text-xs mt-1 flex items-center gap-0.5 font-medium", diffColor)}>
            <DiffIcon className="h-3 w-3" />
            {Math.abs(scoreDiff)} pts {scoreDiff > 0 ? 'acima da média' : scoreDiff < 0 ? 'abaixo da média' : 'na média'}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">/100 score médio</p>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Page exports ─────────────────────────────────────────────────────────────

export { CallIntelligenceView };

const SDRCallIntelligencePage = () => <CallIntelligenceView context="sdr_call" />;
export default SDRCallIntelligencePage;
