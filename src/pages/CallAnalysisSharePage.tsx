import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2, XCircle, TrendingUp, Lightbulb, ThumbsUp, Target,
  ArrowUpRight, MessageSquare, User, Users, AlertTriangle,
} from 'lucide-react';
import { usePublicCallAnalysis } from '@/hooks/useCallAnalyses';
import type { CallAnalysis } from '@/hooks/useCallAnalyses';

// ─── Utility functions (self-contained for public page) ──────────────────────

const formatTime = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

function parseInlineMarkdown(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*{2}(.+?)\*{2}|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
    if (match[2]) parts.push(<strong key={key++} className="font-semibold text-foreground">{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={key++}>{match[3]}</em>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) parts.push(line.slice(lastIndex));
  return parts.length > 0 ? parts : [line];
}

function renderMarkdownText(text: string): React.ReactNode {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((paragraph, i) => {
    const lines = paragraph.split(/\n/);
    return (
      <p key={i} className="mb-2 last:mb-0 text-sm text-muted-foreground leading-[1.7]">
        {lines.map((line, j) => (
          <React.Fragment key={j}>
            {parseInlineMarkdown(line)}
            {j < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    );
  });
}

function parseFeedbackSections(text: string): { key: string; title: string; body: string }[] | null {
  const sectionRegex = /(?:\*{2}\s*)?(PONTOS?\s+(?:FORTES?|DE\s+MELHORIA)|RECOMENDAÇÕES?)(?:\s*\*{2})?:?\s*/gi;
  const matches = [...text.matchAll(sectionRegex)];
  if (matches.length < 2) return null;
  const sections: { key: string; title: string; body: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const rawTitle = matches[i][1].trim();
    const key = rawTitle.toLowerCase().includes('forte') ? 'strengths'
      : rawTitle.toLowerCase().includes('melhoria') ? 'improvements'
      : 'recommendations';
    sections.push({ key, title: rawTitle, body: text.slice(start, end).trim() });
  }
  return sections;
}

function renderSectionBody(text: string): React.ReactNode {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  type Item = { kind: 'numbered'; num: number; content: string } | { kind: 'bullet'; content: string } | { kind: 'text'; content: string };
  const items: Item[] = [];
  for (const line of lines) {
    const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    if (numMatch) {
      items.push({ kind: 'numbered', num: parseInt(numMatch[1]), content: numMatch[2] });
    } else if (bulletMatch) {
      items.push({ kind: 'bullet', content: bulletMatch[1] });
    } else if (items.length > 0 && items[items.length - 1].kind !== 'text') {
      items[items.length - 1].content += ' ' + line;
    } else {
      items.push({ kind: 'text', content: line });
    }
  }
  const hasStructured = items.some(i => i.kind === 'numbered' || i.kind === 'bullet');
  if (!hasStructured || items.length === 0) return renderMarkdownText(text);
  const splitTitleBody = (content: string) => {
    const boldMatch = content.match(/^\*{2}(.+?)\*{2}(?::?\s*-?\s*)([\s\S]*)$/);
    if (boldMatch) return { title: boldMatch[1].trim(), body: boldMatch[2].trim() };
    const colonMatch = content.match(/^([^:]{3,50}):\s*(.+)$/s);
    if (colonMatch) return { title: colonMatch[1].replace(/\*+/g, '').trim(), body: colonMatch[2].trim() };
    return { title: '', body: content };
  };
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        if (item.kind === 'numbered') {
          const { title, body } = splitTitleBody(item.content);
          return (
            <div key={i} className="flex gap-3 items-start">
              <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-foreground/10 text-foreground text-xs font-bold mt-0.5">{item.num}</span>
              <div className="min-w-0 flex-1">
                {title && <p className="text-sm font-semibold text-foreground mb-0.5">{title}</p>}
                <p className="text-sm text-muted-foreground leading-relaxed">{parseInlineMarkdown(body)}</p>
              </div>
            </div>
          );
        }
        if (item.kind === 'bullet') {
          const { title, body } = splitTitleBody(item.content);
          return (
            <div key={i} className="flex gap-2.5 items-start">
              <span className="shrink-0 mt-[7px] h-1.5 w-1.5 rounded-full bg-foreground/35" />
              <div className="min-w-0 flex-1">
                {title ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">{title}</span>
                    {body && <span> {parseInlineMarkdown(body)}</span>}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed">{parseInlineMarkdown(item.content)}</p>
                )}
              </div>
            </div>
          );
        }
        return <p key={i} className="text-sm text-muted-foreground leading-[1.7]">{parseInlineMarkdown(item.content)}</p>;
      })}
    </div>
  );
}

// ─── ScoreGauge ───────────────────────────────────────────────────────────────

const ScoreGauge = ({ score }: { score: number }) => {
  const color = score >= 70 ? 'text-emerald-600 dark:text-emerald-400' : score >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive';
  const bg = score >= 70
    ? 'bg-emerald-100 dark:bg-emerald-500/15 ring-emerald-200 dark:ring-emerald-500/30'
    : score >= 40
    ? 'bg-amber-100 dark:bg-amber-500/15 ring-amber-200 dark:ring-amber-500/30'
    : 'bg-destructive/10 ring-destructive/20';
  return (
    <div className={`flex flex-col items-center justify-center h-20 w-20 rounded-full ring-2 shrink-0 ${bg}`}>
      <span className={`text-3xl font-bold leading-none ${color}`}>{score}</span>
      <span className="text-[10px] text-muted-foreground mt-0.5">/100</span>
    </div>
  );
};

// ─── Feedback renderer ────────────────────────────────────────────────────────

function RenderFeedback({ feedback }: { feedback: string }) {
  const sections = parseFeedbackSections(feedback);
  const sectionConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    strengths: { icon: <ThumbsUp className="h-4 w-4" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/5 dark:border-emerald-500/20' },
    improvements: { icon: <Target className="h-4 w-4" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-500/5 dark:border-amber-500/20' },
    recommendations: { icon: <ArrowUpRight className="h-4 w-4" />, color: 'text-primary', bg: 'bg-primary/5 border-primary/20' },
  };
  if (sections) {
    return (
      <div className="space-y-3">
        {sections.map((section) => {
          const cfg = sectionConfig[section.key] || sectionConfig.recommendations;
          return (
            <Card key={section.key} className={`border ${cfg.bg}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm flex items-center gap-2 ${cfg.color}`}>
                  {cfg.icon}
                  {section.title.charAt(0).toUpperCase() + section.title.slice(1).toLowerCase()}
                </CardTitle>
              </CardHeader>
              <CardContent>{renderSectionBody(section.body)}</CardContent>
            </Card>
          );
        })}
      </div>
    );
  }
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Recomendações
        </CardTitle>
      </CardHeader>
      <CardContent>{renderSectionBody(feedback)}</CardContent>
    </Card>
  );
}

// ─── Score breakdown row ──────────────────────────────────────────────────────

const ScoreRow = ({ label, earned, max }: { label: string; earned: number; max: number }) => {
  const pct = Math.round((earned / max) * 100);
  const lost = max - earned;
  const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-destructive';
  const lostColor = lost === 0 ? 'text-emerald-600 dark:text-emerald-400' : lost <= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive';
  return (
    <div className="flex items-center gap-3">
      <p className="text-sm text-foreground w-[200px] shrink-0 truncate" title={label}>{label}</p>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-mono text-muted-foreground w-[36px] shrink-0 text-right">{earned}/{max}</span>
      </div>
      {lost > 0 ? (
        <Badge variant="outline" className={`text-[10px] h-5 shrink-0 border-current ${lostColor}`}>-{lost} pt{lost > 1 ? 's' : ''}</Badge>
      ) : (
        <Badge variant="outline" className="text-[10px] h-5 shrink-0 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700">Perfeito</Badge>
      )}
    </div>
  );
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

const LoadingSkeleton = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-4">
      <Skeleton className="h-20 w-20 rounded-full" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
    </div>
    <Skeleton className="h-32 w-full" />
    <div className="grid grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
    </div>
    <Skeleton className="h-40 w-full" />
    <Skeleton className="h-40 w-full" />
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CallAnalysisSharePage() {
  const { token } = useParams<{ token: string }>();
  const { data: analysis, isLoading, error } = usePublicCallAnalysis(token);

  const isDemo = analysis?.analysis_context === 'demo_closer';
  const title = isDemo ? 'Análise de Demonstração' : 'Análise de Ligação';

  const interestColor = {
    Alto: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    Médio: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    Baixo: 'bg-destructive/10 text-destructive',
  }[(analysis?.interest_level || '')] || 'bg-muted text-muted-foreground';

  const objectionColors: Record<string, string> = {
    Preço: 'bg-destructive/10 text-destructive',
    Concorrente: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    'Falta de urgência': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    'Sem orçamento': 'bg-destructive/10 text-destructive',
    'Sem decisor': 'bg-primary/10 text-primary',
    Timing: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  };

  const speakerLabels = useMemo<Record<string, string>>(() => {
    if (!analysis?.speaker_segments || (analysis.speaker_segments as any[]).length === 0) return {};
    const segments = analysis.speaker_segments as any[];
    const speakers = [...new Set(segments.map(s => s.speaker))] as string[];
    const talkTime: Record<string, number> = {};
    speakers.forEach(s => { talkTime[s] = 0; });
    segments.forEach(seg => { talkTime[seg.speaker] = (talkTime[seg.speaker] || 0) + ((seg.end || 0) - (seg.start || 0)); });
    const totalTime = Object.values(talkTime).reduce((a, b) => a + b, 0) || 1;
    const sdrPct = analysis.sdr_talk_percentage || 0;
    let sdrSpeaker = speakers[0];
    let minDiff = Infinity;
    speakers.forEach(s => {
      const diff = Math.abs((talkTime[s] / totalTime) * 100 - sdrPct);
      if (diff < minDiff) { minDiff = diff; sdrSpeaker = s; }
    });
    const sdrName = analysis.sdr_profile?.name || (isDemo ? 'Closer' : 'SDR');
    const clientName = analysis.lead_data?.company || 'Cliente';
    const labels: Record<string, string> = {};
    speakers.forEach(s => {
      labels[s] = s === sdrSpeaker ? `🎧 ${sdrName}` : `👤 ${clientName}`;
    });
    return labels;
  }, [analysis, isDemo]);

  const demoQualityLabels: Record<string, string> = {
    rapport_score: 'Rapport e Abertura',
    discovery_score: 'Discovery / Diagnóstico',
    value_proposition_score: 'Proposta de Valor',
    product_demo_score: 'Demonstração do Produto',
    objection_handling_score: 'Tratamento de Objeções',
    client_engagement_score: 'Engajamento do Cliente',
    closing_score: 'Fechamento / Próximos Passos',
    communication_score: 'Postura e Comunicação',
  };

  const demoQuality = (analysis?.ai_analysis as any)?.demo_quality as Record<string, number> | undefined;
  const scoreBreakdown = (analysis?.ai_analysis as any)?.score_breakdown as Array<{ criterion: string; max_points: number; points_earned: number; notes?: string }> | undefined;
  const hasDemoQuality = !!demoQuality && Object.keys(demoQuality).length > 0;
  const hasScoreBreakdown = !!scoreBreakdown && scoreBreakdown.length > 0;

  const segments = analysis?.speaker_segments as any[] | null;
  const hasTranscript = !!segments && segments.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">EZ</span>
            </div>
            <div>
              <p className="text-sm font-semibold">Ez Journey</p>
              <p className="text-xs text-muted-foreground">{title} compartilhada</p>
            </div>
          </div>
          {analysis && (
            <Badge variant="outline" className="text-xs">
              {new Date(analysis.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {isLoading && <LoadingSkeleton />}

        {(error || (!isLoading && !analysis)) && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold">Link inválido ou revogado</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Este link de compartilhamento não é mais válido. Solicite um novo link ao responsável pela análise.
            </p>
          </div>
        )}

        {analysis && (
          <div className="space-y-6">
            {/* Hero — score + meta */}
            <div className="flex items-center gap-5">
              <ScoreGauge score={analysis.call_score} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xl font-bold">{title}</p>
                  {isDemo && <Badge className="bg-primary/10 text-primary text-[10px]">Demo</Badge>}
                  <Badge
                    className={`text-[10px] ${analysis.call_score >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : analysis.call_score >= 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' : 'bg-destructive/10 text-destructive'}`}
                  >
                    {analysis.call_score >= 70 ? 'Bom desempenho' : analysis.call_score >= 40 ? 'Desempenho médio' : 'Precisa melhorar'}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground flex-wrap">
                  {analysis.sdr_profile?.name && (
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {analysis.sdr_profile.name}
                    </span>
                  )}
                  {(analysis.lead_data?.name || analysis.lead_data?.company) && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {analysis.lead_data.name || analysis.lead_data.company}
                      </span>
                    </>
                  )}
                  {analysis.original_filename && (
                    <>
                      <span>·</span>
                      <span className="truncate max-w-[200px]" title={analysis.original_filename}>
                        {analysis.original_filename}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Executive Summary */}
            {analysis.executive_summary && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" /> Resumo Executivo
                  </CardTitle>
                </CardHeader>
                <CardContent>{renderMarkdownText(analysis.executive_summary)}</CardContent>
              </Card>
            )}

            {/* Metrics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Connection */}
              <Card>
                <CardContent className="pt-4 flex flex-col items-center gap-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Conexão</p>
                  {analysis.connection_effective
                    ? <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                    : <XCircle className="h-7 w-7 text-destructive" />}
                  <p className="text-xs font-medium">{analysis.connection_effective ? 'Efetiva' : 'Falhou'}</p>
                </CardContent>
              </Card>
              {/* Interest */}
              <Card>
                <CardContent className="pt-4 flex flex-col items-center gap-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Interesse</p>
                  <p className="text-2xl font-bold">{analysis.interest_level?.[0] || '—'}</p>
                  <Badge className={`text-[10px] ${interestColor}`}>{analysis.interest_level}</Badge>
                </CardContent>
              </Card>
              {/* Next step */}
              <Card>
                <CardContent className="pt-4 flex flex-col items-center gap-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Próx. Passo</p>
                  {analysis.next_step_defined
                    ? <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                    : <XCircle className="h-7 w-7 text-destructive" />}
                  <p className="text-xs font-medium">{analysis.next_step_defined ? 'Definido' : 'Indefinido'}</p>
                </CardContent>
              </Card>
              {/* Conversion potential */}
              <Card>
                <CardContent className="pt-4 flex flex-col items-center gap-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Conversão</p>
                  <p className="text-2xl font-bold">{analysis.conversion_potential}%</p>
                  <p className="text-xs text-muted-foreground">potencial</p>
                </CardContent>
              </Card>
            </div>

            {/* Behavioral metrics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Comportamental</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>🎧 {analysis.sdr_profile?.name || (isDemo ? 'Closer' : 'SDR')}</span>
                    <span>{analysis.sdr_talk_percentage?.toFixed(0)}%</span>
                  </div>
                  <Progress value={analysis.sdr_talk_percentage} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>👤 {analysis.lead_data?.company || 'Lead'}</span>
                    <span>{analysis.lead_talk_percentage?.toFixed(0)}%</span>
                  </div>
                  <Progress value={analysis.lead_talk_percentage} className="h-2 [&>div]:bg-emerald-500" />
                </div>
                <Separator />
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold">{analysis.open_questions_count}</p>
                    <p className="text-[11px] text-muted-foreground">Perguntas abertas</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{analysis.interruptions_count}</p>
                    <p className="text-[11px] text-muted-foreground">Interrupções</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${analysis.early_pitch ? 'text-destructive' : 'text-emerald-600'}`}>
                      {analysis.early_pitch ? 'Sim' : 'Não'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Pitch antecipado</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Objections */}
            {analysis.objections && analysis.objections.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" /> Objeções Detectadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {analysis.objections.map((obj: string, i: number) => (
                      <Badge key={i} className={`text-xs ${objectionColors[obj] || 'bg-muted text-muted-foreground'}`}>
                        {obj}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Score breakdown */}
            {hasDemoQuality && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pontuação por Critério</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(demoQualityLabels)
                    .filter(([key]) => demoQuality![key] !== undefined)
                    .sort(([, la], [, lb]) => {
                      const a = demoQuality![la] ?? 0;
                      const b = demoQuality![lb] ?? 0;
                      return a - b;
                    })
                    .map(([key, label]) => (
                      <ScoreRow key={key} label={label} earned={demoQuality![key] ?? 0} max={10} />
                    ))}
                  <Separator />
                  <p className="text-xs text-muted-foreground text-right">
                    Total: {Object.keys(demoQualityLabels).filter(k => demoQuality![k] !== undefined).reduce((sum, k) => sum + (demoQuality![k] ?? 0), 0)} / {Object.keys(demoQualityLabels).filter(k => demoQuality![k] !== undefined).length * 10} pts
                  </p>
                </CardContent>
              </Card>
            )}

            {hasScoreBreakdown && !hasDemoQuality && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pontuação por Critério</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[...(scoreBreakdown!)]
                    .sort((a, b) => (a.points_earned / a.max_points) - (b.points_earned / b.max_points))
                    .map((item, i) => (
                      <div key={i} className="space-y-1">
                        <ScoreRow label={item.criterion} earned={item.points_earned} max={item.max_points} />
                        {item.notes && <p className="text-xs text-muted-foreground pl-[212px]">{item.notes}</p>}
                      </div>
                    ))}
                  <Separator />
                  <p className="text-xs text-muted-foreground text-right">
                    Total: {scoreBreakdown!.reduce((s, i) => s + i.points_earned, 0)} / {scoreBreakdown!.reduce((s, i) => s + i.max_points, 0)} pts
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Feedback / Coaching */}
            {analysis.feedback && (
              <div>
                <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Feedback da IA
                </p>
                <RenderFeedback feedback={analysis.feedback} />
              </div>
            )}

            {/* Transcript */}
            {hasTranscript && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> Transcrição
                    <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-1">{segments!.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                  {(segments as any[]).map((seg, i) => {
                    const label = speakerLabels[seg.speaker] || seg.speaker;
                    const isSDR = label.startsWith('🎧');
                    return (
                      <div
                        key={i}
                        className={`rounded-lg px-3 py-2 border-l-2 ${isSDR ? 'bg-primary/5 border-primary/30' : 'bg-emerald-500/5 border-emerald-500/30'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            className={`text-[10px] h-5 px-1.5 ${isSDR ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'}`}
                          >
                            {label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">{formatTime(seg.start)}</span>
                        </div>
                        <p className="text-sm text-foreground/90 leading-relaxed">{seg.text}</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Footer */}
            <Separator />
            <p className="text-center text-xs text-muted-foreground pb-8">
              Análise gerada por IA — Ez Journey
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
