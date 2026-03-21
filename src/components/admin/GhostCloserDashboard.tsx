import { useState } from 'react';
import {
  useGhostCloserStats, useGhostCloserLogs, useCloserProfiles,
  useFollowUpRules, useRunGhostCloser, useRunGhostCloserLearn,
} from '@/hooks/useGhostCloser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Ghost, Sparkles, Loader2, Send, MessageSquare, Mail, Trophy,
  TrendingUp, DollarSign, Calendar, Brain, Zap, Users, Clock,
  CheckCircle, XCircle, ArrowRight, BarChart3,
} from 'lucide-react';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const channelIcon: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="h-3 w-3" />,
  email: <Mail className="h-3 w-3" />,
  both: <Zap className="h-3 w-3" />,
};

const statusStyles: Record<string, string> = {
  sent: 'bg-primary/10 text-primary border-primary/20',
  responded: 'bg-success/10 text-success border-success/20',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
  skipped: 'bg-muted text-muted-foreground border-border',
};

export function GhostCloserDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const { data: stats, isLoading: statsLoading } = useGhostCloserStats();
  const { data: logs, isLoading: logsLoading } = useGhostCloserLogs({ days: 30 });
  const { data: closerProfiles } = useCloserProfiles();
  const { rules, isLoading: rulesLoading } = useFollowUpRules();
  const runGhost = useRunGhostCloser();
  const runLearn = useRunGhostCloserLearn();

  const topCloser = (closerProfiles || []).find(c => c.is_top_performer);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Ghost className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Ghost Closer</h1>
            <p className="text-xs text-muted-foreground">Follow-up autônomo com IA</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => runLearn.mutate()} disabled={runLearn.isPending}>
            {runLearn.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
            Aprender
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => runGhost.mutate()} disabled={runGhost.isPending}>
            {runGhost.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Executar Agora
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Card><CardContent className="p-3 text-center">
            <Send className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.totalSent}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Enviados</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <CheckCircle className="h-4 w-4 text-success mx-auto mb-1" />
            <p className="text-2xl font-bold text-success">{stats.totalResponded}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Respostas</p>
          </CardContent></Card>
          <Card className="border-primary/20"><CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-primary">{stats.responseRate}%</p>
            <p className="text-[10px] text-muted-foreground uppercase">Taxa Resp.</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <Calendar className="h-4 w-4 text-warning mx-auto mb-1" />
            <p className="text-2xl font-bold text-warning">{stats.totalMeetings}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Reuniões</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <Trophy className="h-4 w-4 text-success mx-auto mb-1" />
            <p className="text-2xl font-bold text-success">{stats.totalWon}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Ganhos</p>
          </CardContent></Card>
          <Card className="border-success/20"><CardContent className="p-3 text-center">
            <DollarSign className="h-4 w-4 text-success mx-auto mb-1" />
            <p className="text-lg font-bold text-success">{formatCurrency(stats.revenueInfluenced)}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Receita</p>
          </CardContent></Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="overview" className="text-xs">Atividade</TabsTrigger>
          <TabsTrigger value="rules" className="text-xs">Regras</TabsTrigger>
          <TabsTrigger value="closers" className="text-xs">Closers</TabsTrigger>
          <TabsTrigger value="learning" className="text-xs">Aprendizado</TabsTrigger>
        </TabsList>

        {/* Activity Tab */}
        <TabsContent value="overview" className="space-y-4">
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-2">
              {(logs || []).slice(0, 30).map(log => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors">
                  <div className="mt-0.5">{channelIcon[log.channel] || <Send className="h-3 w-3" />}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn('text-[10px] h-5', statusStyles[log.status])}>
                        {log.status === 'sent' ? 'Enviado' : log.status === 'responded' ? 'Respondeu' : log.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">Step {log.step_number}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleDateString('pt-BR')} {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {log.led_to_meeting && <Badge variant="outline" className="text-[10px] h-4 bg-warning/10 text-warning border-warning/20">Reunião</Badge>}
                      {log.led_to_won && <Badge variant="outline" className="text-[10px] h-4 bg-success/10 text-success border-success/20">Ganho</Badge>}
                    </div>
                    <p className="text-xs text-foreground line-clamp-2">{log.message_content}</p>
                  </div>
                </div>
              ))}
              {(!logs || logs.length === 0) && (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum follow-up enviado ainda. Clique em "Executar Agora" para iniciar.</p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <p className="text-xs text-muted-foreground">Regras de follow-up por estágio do pipeline. O Ghost Closer segue essas regras automaticamente.</p>
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-2">
              {(rules || []).map(rule => (
                <div key={rule.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">{rule.stage}</span>
                      <Badge variant="secondary" className="text-[10px]">Step {rule.step_number}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">{channelIcon[rule.channel]} {rule.channel}</span>
                      <span><Clock className="h-3 w-3 inline mr-0.5" />{rule.delay_days}d</span>
                      <span>Tom: {rule.tone}</span>
                      {rule.strategy && <span>Estratégia: {rule.strategy}</span>}
                    </div>
                  </div>
                  <Switch checked={rule.active} disabled />
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Closers Tab */}
        <TabsContent value="closers" className="space-y-4">
          <p className="text-xs text-muted-foreground">Perfis dos closers analisados pela IA. O Ghost Closer clona o estilo do melhor performer.</p>
          <div className="space-y-3">
            {(closerProfiles || []).map((closer: any) => (
              <Card key={closer.user_id} className={cn(closer.is_top_performer && 'border-primary/30 bg-primary/5')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{closer.name}</span>
                      {closer.is_top_performer && (
                        <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          <Trophy className="h-3 w-3 mr-0.5" /> Top Performer
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Win: <strong className="text-foreground">{closer.win_rate}%</strong></span>
                      <span>Ticket: <strong className="text-foreground">{formatCurrency(closer.avg_deal_value)}</strong></span>
                      <span>Ciclo: <strong className="text-foreground">{Math.round(closer.avg_days_to_close)}d</strong></span>
                    </div>
                  </div>
                  {closer.writing_style && (
                    <div className="space-y-2 mt-2 pt-2 border-t border-border/30">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Estilo de escrita</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{closer.writing_style}</p>
                      </div>
                      {closer.common_phrases && closer.common_phrases.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {closer.common_phrases.map((phrase: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px]">"{phrase}"</Badge>
                          ))}
                        </div>
                      )}
                      {closer.objection_handling_style && (
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Objeções</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{closer.objection_handling_style}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {(!closerProfiles || closerProfiles.length === 0) && (
              <p className="text-center text-sm text-muted-foreground py-8">Clique em "Aprender" para analisar os closers.</p>
            )}
          </div>
        </TabsContent>

        {/* Learning Tab */}
        <TabsContent value="learning" className="space-y-4">
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold mb-1">Como o Ghost Closer aprende</h3>
                  <ol className="space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold shrink-0">1.</span>
                      <span><strong className="text-foreground">Analisa demos e calls</strong> — extrai tom, argumentos e objeções das transcrições semanais</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold shrink-0">2.</span>
                      <span><strong className="text-foreground">Estuda emails enviados</strong> — identifica estilo de escrita, frases recorrentes e tom de cada closer</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold shrink-0">3.</span>
                      <span><strong className="text-foreground">Identifica o melhor closer</strong> — maior win rate + ticket médio = modelo a ser clonado</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold shrink-0">4.</span>
                      <span><strong className="text-foreground">Rastreia resultados</strong> — qual canal, tom e horário gera mais resposta por segmento</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold shrink-0">5.</span>
                      <span><strong className="text-foreground">Otimiza continuamente</strong> — cada follow-up melhora o modelo, sem retreinamento</span>
                    </li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          {topCloser && (
            <Card className="border-success/20">
              <CardContent className="p-4 flex items-center gap-3">
                <Trophy className="h-5 w-5 text-success shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Top Performer: <span className="text-success">{(topCloser as any).name}</span></p>
                  <p className="text-xs text-muted-foreground">
                    Win rate {topCloser.win_rate}% | Ticket {formatCurrency(topCloser.avg_deal_value)} | {topCloser.total_deals_won} deals ganhos
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">O Ghost Closer clona o estilo deste closer para todos os follow-ups.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
