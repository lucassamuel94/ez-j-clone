import { useState } from 'react';
import {
  useGhostSdrStats, useGhostSdrLogs, useSdrProfiles,
  useRunGhostSdr, useRunGhostSdrLearn,
} from '@/hooks/useGhostSdr';
import { useFollowUpRules } from '@/hooks/useGhostCloser';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Ghost, Sparkles, Loader2, Send, MessageSquare, Mail, Trophy,
  TrendingUp, Calendar, Brain, Zap, Clock, CheckCircle, Target,
  Crosshair, DollarSign, Phone,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const channelIcon: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="h-3 w-3" />,
  email: <Mail className="h-3 w-3" />,
  both: <Zap className="h-3 w-3" />,
};

const statusStyles: Record<string, string> = {
  sent: 'bg-primary/10 text-primary border-primary/20',
  responded: 'bg-success/10 text-success border-success/20',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
};

export function GhostSdrDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const { data: stats } = useGhostSdrStats();
  const { data: logs } = useGhostSdrLogs({ days: 30 });
  const { data: sdrProfiles } = useSdrProfiles();
  const runGhost = useRunGhostSdr();
  const runLearn = useRunGhostSdrLearn();

  // Fetch SDR rules separately
  const { data: sdrRules } = useQuery({
    queryKey: ['sdr-follow-up-rules'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('sdr_follow_up_rules' as any) as any).select('*').order('lead_status').order('step_number');
      if (error) throw error;
      return data || [];
    },
  });

  const topSdr = (sdrProfiles || []).find((s: any) => s.is_top_performer);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Ghost className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Ghost SDR</h1>
            <p className="text-xs text-muted-foreground">Prospecção autônoma com IA — foco em SQO e conversão</p>
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

      {/* Stats — foco em SQO e conversão */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          <Card><CardContent className="p-3 text-center">
            <Send className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.totalSent}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Enviados</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <CheckCircle className="h-4 w-4 text-success mx-auto mb-1" />
            <p className="text-2xl font-bold text-success">{stats.totalResponded}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Respostas</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-primary">{stats.responseRate}%</p>
            <p className="text-[10px] text-muted-foreground uppercase">Taxa Resp.</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <Calendar className="h-4 w-4 text-warning mx-auto mb-1" />
            <p className="text-2xl font-bold text-warning">{stats.totalMeetingsConfirmed}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Reuniões Conf.</p>
          </CardContent></Card>
          <Card className="border-primary/20"><CardContent className="p-3 text-center">
            <Crosshair className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-primary">{stats.totalSqos}</p>
            <p className="text-[10px] text-muted-foreground uppercase">SQOs</p>
          </CardContent></Card>
          <Card className="border-success/20"><CardContent className="p-3 text-center">
            <Trophy className="h-4 w-4 text-success mx-auto mb-1" />
            <p className="text-2xl font-bold text-success">{stats.totalSales}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Vendas</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <Target className="h-4 w-4 text-foreground mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.totalSqos > 0 ? Math.round((stats.totalSales / stats.totalSqos) * 100) : 0}%</p>
            <p className="text-[10px] text-muted-foreground uppercase">SQO→Venda</p>
          </CardContent></Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="overview" className="text-xs">Atividade</TabsTrigger>
          <TabsTrigger value="rules" className="text-xs">Regras</TabsTrigger>
          <TabsTrigger value="sdrs" className="text-xs">SDRs</TabsTrigger>
        </TabsList>

        {/* Activity */}
        <TabsContent value="overview">
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-2">
              {(logs || []).slice(0, 30).map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors">
                  <div className="mt-0.5">{channelIcon[log.channel] || <Send className="h-3 w-3" />}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className={cn('text-[10px] h-5', statusStyles[log.status])}>{log.status === 'sent' ? 'Enviado' : log.status === 'responded' ? 'Respondeu' : log.status}</Badge>
                      <span className="text-[10px] text-muted-foreground">Step {log.step_number}</span>
                      <Badge variant="outline" className="text-[10px] h-4">{log.lead_status}</Badge>
                      <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleDateString('pt-BR')} {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {log.led_to_sqo && <Badge variant="outline" className="text-[10px] h-4 bg-primary/10 text-primary">SQO</Badge>}
                      {log.led_to_sale && <Badge variant="outline" className="text-[10px] h-4 bg-success/10 text-success">Venda</Badge>}
                    </div>
                    <p className="text-xs text-foreground line-clamp-2">{log.message_content}</p>
                  </div>
                </div>
              ))}
              {(!logs || logs.length === 0) && (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum outreach enviado. Clique em "Executar Agora".</p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Rules */}
        <TabsContent value="rules">
          <p className="text-xs text-muted-foreground mb-3">Regras de outreach por status do lead.</p>
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-2">
              {(sdrRules || []).map((rule: any) => (
                <div key={rule.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">{rule.lead_status}</span>
                      <Badge variant="secondary" className="text-[10px]">Step {rule.step_number}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">{channelIcon[rule.channel]} {rule.channel}</span>
                      <span><Clock className="h-3 w-3 inline mr-0.5" />{rule.delay_days}d</span>
                      <span>Tom: {rule.tone}</span>
                      {rule.strategy && <span className="text-primary">{rule.strategy}</span>}
                    </div>
                  </div>
                  <Switch checked={rule.active} disabled />
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* SDR Profiles */}
        <TabsContent value="sdrs">
          <p className="text-xs text-muted-foreground mb-3">Top performer = maior taxa SQO→Venda dentro da meta + qualidade de qualificação.</p>
          <div className="space-y-3">
            {(sdrProfiles || []).map((sdr: any) => (
              <Card key={sdr.user_id} className={cn(sdr.is_top_performer && 'border-primary/30 bg-primary/5')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{sdr.name}</span>
                      {sdr.is_top_performer && (
                        <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          <Trophy className="h-3 w-3 mr-0.5" /> Top Performer
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>SQOs: <strong className="text-primary">{sdr.total_sqos}</strong></span>
                      <span>SQO→Venda: <strong className="text-success">{sdr.sqo_to_sale_rate}%</strong></span>
                      <span>Calls: <strong>{sdr.total_calls}</strong></span>
                      <span>Score: <strong>{sdr.avg_call_score}</strong></span>
                    </div>
                  </div>
                  {sdr.writing_style && (
                    <div className="space-y-2 mt-2 pt-2 border-t border-border/30">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Estilo</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{sdr.writing_style}</p>
                      </div>
                      {sdr.opening_style && (
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Abertura</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{sdr.opening_style}</p>
                        </div>
                      )}
                      {sdr.qualification_style && (
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Qualificação</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{sdr.qualification_style}</p>
                        </div>
                      )}
                      {sdr.common_phrases && sdr.common_phrases.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {sdr.common_phrases.map((phrase: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px]">"{phrase}"</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {(!sdrProfiles || sdrProfiles.length === 0) && (
              <p className="text-center text-sm text-muted-foreground py-8">Clique em "Aprender" para analisar os SDRs.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
