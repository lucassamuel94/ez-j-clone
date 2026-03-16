import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCallAnalysisStats } from '@/hooks/useCallAnalyses';
import { useSystemUsers } from '@/hooks/useSystemUsers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Phone, TrendingUp, Target, AlertTriangle, Trophy } from 'lucide-react';

export const CallManagerDashboard = () => {
  const [sdrFilter, setSdrFilter] = useState<string>('all');
  const { data: users = [] } = useSystemUsers();
  const { data: analyses = [], isLoading } = useCallAnalysisStats(sdrFilter === 'all' ? undefined : sdrFilter);

  const sdrs = users.filter((u: any) => u.role === 'sdr' || u.role === 'admin' || u.role === 'manager');

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
    const grouped: Record<string, { month: string; avgScore: number; count: number; total: number }> = {};
    for (const a of analyses) {
      const d = new Date(a.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = { month: key, avgScore: 0, count: 0, total: 0 };
      grouped[key].total += a.call_score || 0;
      grouped[key].count++;
    }
    return Object.values(grouped)
      .map((g) => ({ ...g, avgScore: Math.round(g.total / g.count) }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [analyses]);

  // SDR ranking
  const sdrRanking = useMemo(() => {
    if (sdrFilter !== 'all') return [];
    const grouped: Record<string, { userId: string; name: string; total: number; scoreSum: number }> = {};
    for (const a of analyses) {
      if (!grouped[a.sdr_user_id]) {
        const user = users.find((u: any) => u.id === a.sdr_user_id);
        grouped[a.sdr_user_id] = { userId: a.sdr_user_id, name: user?.name || 'SDR', total: 0, scoreSum: 0 };
      }
      grouped[a.sdr_user_id].total++;
      grouped[a.sdr_user_id].scoreSum += a.call_score || 0;
    }
    return Object.values(grouped)
      .map((g) => ({ ...g, avgScore: Math.round(g.scoreSum / g.total) }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [analyses, sdrFilter, users]);

  // Objections frequency
  const objectionData = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const a of analyses) {
      const objs = a.objections || [];
      for (const o of objs) {
        freq[o] = (freq[o] || 0) + 1;
      }
    }
    return Object.entries(freq)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [analyses]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Filtrar por SDR</p>
          <Select value={sdrFilter} onValueChange={setSdrFilter}>
            <SelectTrigger className="w-48 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos os SDRs</SelectItem>
              {sdrs.map((u: any) => (
                <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <Phone className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ligações Analisadas</p>
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
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Potencial Conversão</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly Evolution */}
        {monthlyData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Evolução Mensal do Score</CardTitle>
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

        {/* Objections Chart */}
        {objectionData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Objeções Mais Frequentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={objectionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* SDR Ranking */}
      {sdrRanking.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning" />
              Ranking por Qualidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sdrRanking.map((sdr, i) => (
                <div key={sdr.userId} className="flex items-center justify-between border rounded-lg px-4 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                    <span className="text-sm font-medium">{sdr.name}</span>
                    <span className="text-xs text-muted-foreground">{sdr.total} ligações</span>
                  </div>
                  <Badge className={`${sdr.avgScore >= 70 ? 'bg-success/10 text-success' : sdr.avgScore >= 40 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'} text-xs`}>
                    Score: {sdr.avgScore}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
