import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCallAnalysisStats } from '@/hooks/useCallAnalyses';
import { useSystemUsers } from '@/hooks/useSystemUsers';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Phone, TrendingUp, Target, AlertTriangle, Trophy, Presentation, ThumbsUp, Lightbulb } from 'lucide-react';

type ViewMode = 'sdr_call' | 'demo_closer';

const PIE_COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#f97316', '#14b8a6'];

function extractFeedbackItems(
  feedback: string,
  key: 'strengths' | 'improvements' | 'recommendations',
): string[] {
  const sectionRegex = /(?:\*{2}\s*)?(PONTOS?\s+(?:FORTES?|DE\s+MELHORIA)|RECOMENDAÇÕES?)(?:\s*\*{2})?:?\s*/gi;
  const matches = [...feedback.matchAll(sectionRegex)];
  for (let i = 0; i < matches.length; i++) {
    const rawTitle = matches[i][1].trim().toLowerCase();
    const sectionKey = rawTitle.includes('forte') ? 'strengths' : rawTitle.includes('melhoria') ? 'improvements' : 'recommendations';
    if (sectionKey !== key) continue;
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : feedback.length;
    return feedback
      .slice(start, end)
      .trim()
      .split('\n')
      .map(l => l.replace(/^[\s\-\*\d\.\)\:]+/, '').trim())
      .filter(l => l.length > 8)
      .slice(0, 5);
  }
  return [];
}

export const CallManagerDashboard = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('sdr_call');
  const [personFilter, setPersonFilter] = useState<string>('all');
  const { data: users = [] } = useSystemUsers();
  const { data: analyses = [], isLoading } = useCallAnalysisStats(
    personFilter === 'all' ? undefined : personFilter,
    viewMode,
  );

  const isDemo = viewMode === 'demo_closer';

  // Reset person filter when switching view
  const handleViewChange = (v: string) => {
    setViewMode(v as ViewMode);
    setPersonFilter('all');
  };

  // People who have analyses in current context
  const activePersonIds = useMemo(() => {
    return [...new Set(analyses.map((a: any) => a.sdr_user_id).filter(Boolean))] as string[];
  }, [analyses]);

  const peopleOptions = useMemo(() => {
    return activePersonIds
      .map(id => users.find((u: any) => u.id === id))
      .filter(Boolean) as any[];
  }, [activePersonIds, users]);

  const stats = useMemo(() => {
    if (!analyses.length) return { total: 0, avgScore: 0, nextStepRate: 0, avgConversion: 0 };
    const total = analyses.length;
    const avgScore = Math.round(analyses.reduce((s: number, a: any) => s + (a.call_score || 0), 0) / total);
    const nextStepRate = Math.round((analyses.filter((a: any) => a.next_step_defined).length / total) * 100);
    const avgConversion = Math.round(analyses.reduce((s: number, a: any) => s + (a.conversion_potential || 0), 0) / total);
    return { total, avgScore, nextStepRate, avgConversion };
  }, [analyses]);

  // Monthly evolution
  const monthlyData = useMemo(() => {
    const grouped: Record<string, { month: string; count: number; total: number }> = {};
    for (const a of analyses) {
      const d = new Date(a.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = { month: key, count: 0, total: 0 };
      grouped[key].total += a.call_score || 0;
      grouped[key].count++;
    }
    return Object.values(grouped)
      .map(g => ({ ...g, avgScore: Math.round(g.total / g.count) }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [analyses]);

  // Ranking (only when viewing all)
  const ranking = useMemo(() => {
    if (personFilter !== 'all') return [];
    const grouped: Record<string, { userId: string; name: string; total: number; scoreSum: number }> = {};
    for (const a of analyses) {
      if (!a.sdr_user_id) continue;
      if (!grouped[a.sdr_user_id]) {
        const user = users.find((u: any) => u.id === a.sdr_user_id);
        grouped[a.sdr_user_id] = { userId: a.sdr_user_id, name: user?.name || (isDemo ? 'Closer' : 'SDR'), total: 0, scoreSum: 0 };
      }
      grouped[a.sdr_user_id].total++;
      grouped[a.sdr_user_id].scoreSum += a.call_score || 0;
    }
    return Object.values(grouped)
      .map(g => ({ ...g, avgScore: Math.round(g.scoreSum / g.total) }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [analyses, personFilter, users, isDemo]);

  // Objections frequency
  const objectionData = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const a of analyses) {
      for (const o of (a.objections || [])) {
        freq[o] = (freq[o] || 0) + 1;
      }
    }
    return Object.entries(freq)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [analyses]);

  // Feedback section aggregation
  const feedbackCharts = useMemo(() => {
    const freq = {
      strengths: {} as Record<string, number>,
      improvements: {} as Record<string, number>,
      recommendations: {} as Record<string, number>,
    };
    for (const a of analyses) {
      if (!(a as any).feedback) continue;
      for (const k of ['strengths', 'improvements', 'recommendations'] as const) {
        for (const item of extractFeedbackItems((a as any).feedback, k)) {
          const norm = item.toLowerCase().slice(0, 60);
          freq[k][norm] = (freq[k][norm] || 0) + 1;
        }
      }
    }
    const toChart = (obj: Record<string, number>) =>
      Object.entries(obj)
        .map(([name, count]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
    return {
      strengths: toChart(freq.strengths),
      improvements: toChart(freq.improvements),
      recommendations: toChart(freq.recommendations),
    };
  }, [analyses]);

  const hasFeedbackData = feedbackCharts.strengths.length > 0 || feedbackCharts.improvements.length > 0 || feedbackCharts.recommendations.length > 0;

  const scoreColor = (s: number) =>
    s >= 70 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    : s >= 40 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    : 'bg-destructive/10 text-destructive';

  const truncateLabel = (value: string, maxLen = 22) =>
    value.length > maxLen ? value.slice(0, maxLen) + '…' : value;

  return (
    <div className="space-y-6">
      {/* Context toggle + person filter */}
      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Visualização</p>
          <Tabs value={viewMode} onValueChange={handleViewChange}>
            <TabsList className="h-9">
              <TabsTrigger value="sdr_call" className="gap-1.5 text-xs px-3">
                <Phone className="h-3.5 w-3.5" /> SDRs — Ligações
              </TabsTrigger>
              <TabsTrigger value="demo_closer" className="gap-1.5 text-xs px-3">
                <Presentation className="h-3.5 w-3.5" /> Closers — Demos
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {peopleOptions.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {isDemo ? 'Filtrar por Closer' : 'Filtrar por SDR'}
            </p>
            <Select value={personFilter} onValueChange={setPersonFilter}>
              <SelectTrigger className="w-48 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  {isDemo ? 'Todos os Closers' : 'Todos os SDRs'}
                </SelectItem>
                {peopleOptions.map((u: any) => (
                  <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            {isDemo
              ? <Presentation className="h-5 w-5 text-primary mx-auto mb-1" />
              : <Phone className="h-5 w-5 text-primary mx-auto mb-1" />}
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {isDemo ? 'Demos Analisadas' : 'Ligações Analisadas'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.avgScore}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Score Médio</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Target className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.nextStepRate}%</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Próximo Passo Definido</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="h-5 w-5 text-success mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.avgConversion}%</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Potencial de Conversão</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts — Score evolution + Objections pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {monthlyData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Evolução Mensal do Score — {isDemo ? 'Demos' : 'Ligações'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgScore" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {objectionData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Objeções Mais Frequentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={objectionData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={80}
                    label={false}
                  >
                    {objectionData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => truncateLabel(value, 32)}
                    wrapperStyle={{ fontSize: '10px', lineHeight: '18px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Feedback charts — Pontos Fortes, Melhoria, Recomendações */}
      {hasFeedbackData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {feedbackCharts.strengths.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-emerald-500" />
                  Pontos Fortes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={feedbackCharts.strengths} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={130}
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v: string) => truncateLabel(v)}
                    />
                    <Tooltip formatter={(value) => [value, 'Frequência']} />
                    <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {feedbackCharts.improvements.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-500" />
                  Pontos de Melhoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={feedbackCharts.improvements} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={130}
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v: string) => truncateLabel(v)}
                    />
                    <Tooltip formatter={(value) => [value, 'Frequência']} />
                    <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {feedbackCharts.recommendations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Recomendações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={feedbackCharts.recommendations} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={130}
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v: string) => truncateLabel(v)}
                    />
                    <Tooltip formatter={(value) => [value, 'Frequência']} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Ranking */}
      {ranking.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning" />
              Ranking por Qualidade — {isDemo ? 'Closers' : 'SDRs'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ranking.map((person, i) => (
                <div key={person.userId} className="flex items-center justify-between border rounded-lg px-4 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                    <span className="text-sm font-medium">{person.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {person.total} {isDemo ? (person.total !== 1 ? 'demos' : 'demo') : (person.total !== 1 ? 'ligações' : 'ligação')}
                    </span>
                  </div>
                  <Badge className={`${scoreColor(person.avgScore)} text-xs`}>
                    Score: {person.avgScore}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && analyses.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            {isDemo
              ? <Presentation className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              : <Phone className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />}
            <p className="text-sm font-medium text-muted-foreground">
              Nenhuma {isDemo ? 'demonstração analisada' : 'ligação analisada'} ainda
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {isDemo
                ? 'Faça upload de vídeos de demo para ver as métricas dos closers aqui.'
                : 'Faça upload de áudios de ligações para ver as métricas dos SDRs aqui.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
