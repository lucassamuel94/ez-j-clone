import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle2, XCircle, MessageSquare, AlertTriangle, TrendingUp,
  Lightbulb, User, Users, Play, Pause, SkipBack, SkipForward,
  RotateCcw, Loader2, ThumbsUp, Target, ArrowUpRight,
  Download, Search, FileText, BarChart3, Mic, GraduationCap, Eye, EyeOff,
  Share2, Copy, Link, X as XIcon, Trophy,
} from 'lucide-react';
import { CallAnalysis, useShareCallAnalysis, useRevokeCallAnalysisShare } from '@/hooks/useCallAnalyses';
import { CallAnalysisLeadPicker } from './CallAnalysisLeadPicker';
import { CoachingAnnotationCard } from './coaching/CoachingAnnotationCard';
import { CoachTab } from './coaching/CoachTab';
import { KeyMomentBadge } from './coaching/KeyMomentBadge';
import type { CoachingData, CoachingAnnotation, KeyMoment } from './coaching/types';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Utility parsers ────────────────────────────────────────────────────────

function parseRecommendations(text: string): { title: string; body: string }[] {
  const normalized = text.replace(/(?<=[\.\!\?\:])\s+(?=\d+\.\s)/g, '\n');
  const parts = normalized.split(/(?:^|\n)\s*\d+\.\s+/).filter(Boolean);
  if (parts.length === 0) return [];
  return parts.map((part) => {
    const boldMatch = part.match(/^\*{2}(.+?)\*{2}:?\s*([\s\S]*)$/);
    if (boldMatch) return { title: boldMatch[1].trim(), body: boldMatch[2].trim() };
    const colonMatch = part.match(/^([^:]{3,60}):\s*([\s\S]+)$/);
    if (colonMatch) return { title: colonMatch[1].replace(/\*+/g, '').trim(), body: colonMatch[2].trim() };
    return { title: '', body: part.trim() };
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

/** Render a feedback section body with numbered/bullet list detection */
function renderSectionBody(text: string): React.ReactNode {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  type ParsedItem =
    | { kind: 'numbered'; num: number; content: string }
    | { kind: 'bullet'; content: string }
    | { kind: 'text'; content: string };

  const items: ParsedItem[] = [];

  for (const line of lines) {
    const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);

    if (numMatch) {
      items.push({ kind: 'numbered', num: parseInt(numMatch[1]), content: numMatch[2] });
    } else if (bulletMatch) {
      items.push({ kind: 'bullet', content: bulletMatch[1] });
    } else if (items.length > 0 && items[items.length - 1].kind !== 'text') {
      items[items.length - 1].content += ' ' + line;
    } else if (items.length > 0 && items[items.length - 1].kind === 'text') {
      items[items.length - 1].content += ' ' + line;
    } else {
      items.push({ kind: 'text', content: line });
    }
  }

  const hasStructured = items.some(i => i.kind === 'numbered' || i.kind === 'bullet');
  if (!hasStructured || items.length === 0) return renderMarkdownText(text);

  const splitTitleBody = (content: string): { title: string; body: string } => {
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
              <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-foreground/10 text-foreground text-xs font-bold mt-0.5">
                {item.num}
              </span>
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
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {parseInlineMarkdown(item.content)}
                  </p>
                )}
              </div>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm text-muted-foreground leading-[1.7]">
            {parseInlineMarkdown(item.content)}
          </p>
        );
      })}
    </div>
  );
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, term: string): React.ReactNode {
  if (!term.trim()) return text;
  const parts = text.split(new RegExp(`(${escapeRegex(term)})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/40 text-foreground rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface DemoQuality {
  rapport_score?: number;
  discovery_score?: number;
  value_proposition_score?: number;
  product_demo_score?: number;
  objection_handling_score?: number;
  client_engagement_score?: number;
  closing_score?: number;
  communication_score?: number;
}

interface ScoreBreakdownItem {
  criterion: string;
  max_points: number;
  points_earned: number;
  notes?: string;
}

interface Props {
  analysis: CallAnalysis | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const formatTime = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const SPEEDS = [1, 1.2, 1.5, 2];

const ModalAudioPlayer = ({
  url,
  seekToRef,
}: {
  url: string;
  seekToRef: React.MutableRefObject<((time: number) => void) | null>;
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;
    const onMeta = () => setDuration(audio.duration);
    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnd = () => setPlaying(false);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    seekToRef.current = (time: number) => {
      audio.currentTime = time;
      if (!playing) { audio.play(); setPlaying(true); }
    };
    return () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
      audio.pause();
      audio.src = '';
      seekToRef.current = null;
    };
  }, [url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause(); else audioRef.current.play();
    setPlaying(!playing);
  };
  const seek = (val: number[]) => { if (audioRef.current) audioRef.current.currentTime = val[0]; };
  const skip = (delta: number) => {
    if (audioRef.current)
      audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + delta));
  };
  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  return (
    <div className="bg-muted/40 border rounded-lg p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <Mic className="h-3.5 w-3.5" /> Player de Áudio
      </p>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => skip(-10)} title="Voltar 10s">
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full bg-primary/10 hover:bg-primary/20" onClick={togglePlay}>
          {playing ? <Pause className="h-4 w-4 text-primary" /> : <Play className="h-4 w-4 text-primary" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => skip(10)} title="Avançar 10s">
          <SkipForward className="h-4 w-4" />
        </Button>
        <span className="text-[11px] font-mono text-muted-foreground w-[90px] text-center shrink-0">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <Slider value={[currentTime]} max={duration || 1} step={0.5} onValueChange={seek} className="flex-1" />
        <Button
          variant="outline" size="sm"
          className="h-7 text-[11px] px-2 font-mono min-w-[42px] shrink-0"
          onClick={cycleSpeed} title="Velocidade"
        >
          {speed}x
        </Button>
      </div>
    </div>
  );
};

const ScoreGauge = ({ score }: { score: number }) => {
  const color = score >= 70 ? 'text-emerald-600 dark:text-emerald-400' : score >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive';
  const bg = score >= 70 ? 'bg-emerald-100 dark:bg-emerald-500/15 ring-emerald-200 dark:ring-emerald-500/30'
    : score >= 40 ? 'bg-amber-100 dark:bg-amber-500/15 ring-amber-200 dark:ring-amber-500/30'
    : 'bg-destructive/10 ring-destructive/20';
  return (
    <div className={`flex flex-col items-center justify-center h-[72px] w-[72px] rounded-full ring-2 shrink-0 ${bg}`}>
      <span className={`text-2xl font-bold leading-none ${color}`}>{score}</span>
      <span className="text-[9px] text-muted-foreground mt-0.5">/100</span>
    </div>
  );
};

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
        <Badge variant="outline" className={`text-[10px] h-5 shrink-0 border-current ${lostColor}`}>
          -{lost} pt{lost > 1 ? 's' : ''}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-[10px] h-5 shrink-0 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700">
          Perfeito
        </Badge>
      )}
    </div>
  );
};

// ─── PDF generation ──────────────────────────────────────────────────────────

function buildPdfHtml(analysis: CallAnalysis, speakerLabels: Record<string, string>): string {
  const isDemo = analysis.analysis_context === 'demo_closer';
  const title = isDemo ? 'Análise de Demonstração' : 'Análise de Ligação';
  const dateStr = new Date(analysis.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const sdrName = analysis.sdr_profile?.name || (isDemo ? 'Closer' : 'SDR');
  const leadName = analysis.lead_data?.name || analysis.lead_data?.company || 'Lead não vinculado';
  const score = analysis.call_score;
  const scoreColor = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626';

  const demoQuality = (analysis.ai_analysis as any)?.demo_quality as DemoQuality | undefined;
  const scoreBreakdown = (analysis.ai_analysis as any)?.score_breakdown as ScoreBreakdownItem[] | undefined;

  const demoLabels: Record<string, string> = {
    rapport_score: 'Rapport e Abertura',
    discovery_score: 'Discovery / Diagnóstico',
    value_proposition_score: 'Proposta de Valor',
    product_demo_score: 'Demonstração do Produto',
    objection_handling_score: 'Tratamento de Objeções',
    client_engagement_score: 'Engajamento do Cliente',
    closing_score: 'Fechamento / Próximos Passos',
    communication_score: 'Postura e Comunicação',
  };

  let breakdownHtml = '';
  if (demoQuality && Object.keys(demoQuality).length > 0) {
    const rows = Object.entries(demoLabels)
      .filter(([key]) => demoQuality[key as keyof DemoQuality] !== undefined)
      .map(([key, label]) => {
        const earned = demoQuality[key as keyof DemoQuality] ?? 0;
        const lost = 10 - earned;
        const pct = (earned / 10) * 100;
        return `<tr><td style="padding:6px 8px; font-size:13px;">${label}</td>
          <td style="padding:6px 8px; font-size:13px; text-align:center;">${earned}/10</td>
          <td style="padding:6px 8px;"><div style="background:#e5e7eb; border-radius:4px; height:8px; width:100%;"><div style="background:${pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'}; border-radius:4px; height:8px; width:${pct}%;"></div></div></td>
          <td style="padding:6px 8px; font-size:13px; color:${lost === 0 ? '#16a34a' : lost <= 2 ? '#d97706' : '#dc2626'}; text-align:center;">${lost > 0 ? `-${lost} pt${lost > 1 ? 's' : ''}` : '✓'}</td>
        </tr>`;
      }).join('');
    breakdownHtml = `<h3 style="margin:20px 0 8px; font-size:14px;">Pontuação por Critério</h3>
      <table style="width:100%; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
        <thead><tr style="background:#f9fafb;"><th style="padding:8px; font-size:12px; text-align:left; font-weight:600;">Critério</th><th style="padding:8px; font-size:12px;">Pontos</th><th style="padding:8px; font-size:12px; min-width:100px;">Barra</th><th style="padding:8px; font-size:12px;">Perda</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  } else if (scoreBreakdown && scoreBreakdown.length > 0) {
    const rows = scoreBreakdown.map(item => {
      const lost = item.max_points - item.points_earned;
      const pct = (item.points_earned / item.max_points) * 100;
      return `<tr><td style="padding:6px 8px; font-size:13px;">${item.criterion}</td>
        <td style="padding:6px 8px; font-size:13px; text-align:center;">${item.points_earned}/${item.max_points}</td>
        <td style="padding:6px 8px;"><div style="background:#e5e7eb; border-radius:4px; height:8px;"><div style="background:${pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'}; border-radius:4px; height:8px; width:${pct}%;"></div></div></td>
        <td style="padding:6px 8px; font-size:13px; color:${lost === 0 ? '#16a34a' : lost <= 2 ? '#d97706' : '#dc2626'}; text-align:center;">${lost > 0 ? `-${lost} pt${lost > 1 ? 's' : ''}` : '✓'}</td>
      </tr>`;
    }).join('');
    breakdownHtml = `<h3 style="margin:20px 0 8px; font-size:14px;">Pontuação por Critério</h3>
      <table style="width:100%; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
        <thead><tr style="background:#f9fafb;"><th style="padding:8px; font-size:12px; text-align:left; font-weight:600;">Critério</th><th style="padding:8px; font-size:12px;">Pontos</th><th style="padding:8px; font-size:12px; min-width:100px;">Barra</th><th style="padding:8px; font-size:12px;">Perda</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  const transcriptHtml = analysis.speaker_segments && (analysis.speaker_segments as any[]).length > 0
    ? `<h3 style="margin:20px 0 8px; font-size:14px; page-break-before:always;">Transcrição Completa</h3>
       <div style="font-size:12px; line-height:1.7;">
         ${(analysis.speaker_segments as any[]).map(seg => {
           const label = speakerLabels[seg.speaker] || seg.speaker;
           return `<div style="margin-bottom:8px; padding:6px 10px; border-left:3px solid ${label.includes('🎧') ? '#6366f1' : '#10b981'}; background:${label.includes('🎧') ? '#eef2ff' : '#f0fdf4'}; border-radius:0 6px 6px 0;">
             <span style="font-weight:600; font-size:11px; color:${label.includes('🎧') ? '#4f46e5' : '#059669'};">${label}</span>
             <span style="color:#9ca3af; font-size:10px; margin-left:8px;">${formatTime(seg.start)}</span>
             <p style="margin:4px 0 0; color:#374151;">${seg.text}</p>
           </div>`;
         }).join('')}
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${title} — ${sdrName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; background: #fff; padding: 40px; line-height: 1.5; }
  h2 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  h3 { font-size: 15px; font-weight: 600; color: #374151; }
  table { border-radius: 8px; }
  .chip { display:inline-block; padding:2px 8px; border-radius:9999px; font-size:11px; font-weight:600; }
  .section { margin-bottom: 20px; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .card { border:1px solid #e5e7eb; border-radius:8px; padding:12px 16px; background:#f9fafb; }
  .metric-label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#6b7280; margin-bottom:4px; }
  .metric-value { font-size:18px; font-weight:700; }
  @media print { body { padding:20px; } }
</style>
</head>
<body>
  <!-- Header -->
  <div style="display:flex; align-items:center; gap:20px; margin-bottom:24px; padding-bottom:20px; border-bottom:2px solid #e5e7eb;">
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:80px; height:80px; border-radius:50%; background:${scoreColor}20; border:3px solid ${scoreColor};">
      <span style="font-size:26px; font-weight:800; color:${scoreColor};">${score}</span>
      <span style="font-size:10px; color:#6b7280;">/100</span>
    </div>
    <div>
      <h2>${title}</h2>
      <p style="font-size:13px; color:#6b7280; margin-top:4px;">${sdrName} · ${leadName} · ${dateStr}</p>
    </div>
    <div style="margin-left:auto; text-align:right;">
      <span class="chip" style="background:${scoreColor}20; color:${scoreColor};">${score >= 70 ? 'Bom desempenho' : score >= 40 ? 'Desempenho médio' : 'Precisa melhorar'}</span>
    </div>
  </div>

  ${analysis.executive_summary ? `
  <div class="section">
    <h3 style="margin-bottom:8px;">📋 Resumo Executivo</h3>
    <p style="font-size:13px; color:#4b5563; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px 16px;">${analysis.executive_summary}</p>
  </div>` : ''}

  <div class="section">
    <h3 style="margin-bottom:8px;">📊 Indicadores</h3>
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px;">
      <div class="card" style="text-align:center;">
        <div class="metric-label">Conexão</div>
        <div style="font-size:20px;">${analysis.connection_effective ? '✅' : '❌'}</div>
      </div>
      <div class="card" style="text-align:center;">
        <div class="metric-label">Interesse</div>
        <div class="metric-value" style="font-size:14px;">${analysis.interest_level}</div>
      </div>
      <div class="card" style="text-align:center;">
        <div class="metric-label">Próx. Passo</div>
        <div style="font-size:20px;">${analysis.next_step_defined ? '✅' : '❌'}</div>
      </div>
      <div class="card" style="text-align:center;">
        <div class="metric-label">Conversão</div>
        <div class="metric-value">${analysis.conversion_potential}%</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h3 style="margin-bottom:8px;">🗣️ Métricas Comportamentais</h3>
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px;">
      <div class="card" style="text-align:center;">
        <div class="metric-label">SDR fala</div>
        <div class="metric-value">${analysis.sdr_talk_percentage}%</div>
      </div>
      <div class="card" style="text-align:center;">
        <div class="metric-label">Lead fala</div>
        <div class="metric-value">${analysis.lead_talk_percentage}%</div>
      </div>
      <div class="card" style="text-align:center;">
        <div class="metric-label">Pergs. Abertas</div>
        <div class="metric-value">${analysis.open_questions_count}</div>
      </div>
      <div class="card" style="text-align:center;">
        <div class="metric-label">Interrupções</div>
        <div class="metric-value">${analysis.interruptions_count}</div>
      </div>
      <div class="card" style="text-align:center;">
        <div class="metric-label">Pitch Precoce</div>
        <div style="font-size:20px;">${analysis.early_pitch ? '⚠️' : '✅'}</div>
      </div>
    </div>
  </div>

  ${analysis.objections && (analysis.objections as string[]).length > 0 ? `
  <div class="section">
    <h3 style="margin-bottom:8px;">⚠️ Objeções Detectadas</h3>
    <div>${(analysis.objections as string[]).map(obj => `<span class="chip" style="background:#fef3c7; color:#92400e; margin:3px;">${obj}</span>`).join('')}</div>
  </div>` : ''}

  ${analysis.feedback ? `
  <div class="section">
    <h3 style="margin-bottom:8px;">💡 Feedback Detalhado</h3>
    <div style="font-size:13px; color:#374151; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px 16px; white-space:pre-wrap;">${analysis.feedback}</div>
  </div>` : ''}

  ${breakdownHtml}

  ${(() => {
    const ai = analysis.ai_analysis as any;
    if (!ai) return '';
    const parts: string[] = [];

    // Coach overall message
    if (ai.coach_overall_message) {
      parts.push(`<div class="section" style="page-break-before:always;">
        <h3 style="margin-bottom:8px;">🎯 Mensagem do Coach</h3>
        <div style="font-size:13px; color:#374151; background:#eff6ff; border-left:4px solid #3b82f6; border-radius:0 8px 8px 0; padding:14px 18px; white-space:pre-wrap;">${ai.coach_overall_message}</div>
      </div>`);
    }

    // Key moments
    if (Array.isArray(ai.key_moments) && ai.key_moments.length > 0) {
      const momentTypeEmoji: Record<string, string> = { positive: '⭐', negative: '⚠️', turning_point: '⚡' };
      const rows = ai.key_moments.map((m: any) =>
        `<div style="margin-bottom:8px; padding:8px 12px; border-radius:8px; background:#f9fafb; border:1px solid #e5e7eb;">
          <span style="font-size:12px;">${momentTypeEmoji[m.type] || '•'}</span>
          <span style="font-weight:600; font-size:13px; margin-left:4px;">${m.title}</span>
          <p style="font-size:12px; color:#6b7280; margin-top:4px;">${m.description}</p>
        </div>`
      ).join('');
      parts.push(`<div class="section"><h3 style="margin-bottom:8px;">⚡ Momentos-Chave</h3>${rows}</div>`);
    }

    // Technique suggestions
    if (Array.isArray(ai.technique_suggestions) && ai.technique_suggestions.length > 0) {
      const rows = ai.technique_suggestions.map((t: any) =>
        `<div style="margin-bottom:8px; padding:8px 12px; border-radius:8px; background:#f9fafb; border:1px solid #e5e7eb;">
          <span style="font-weight:600; font-size:13px;">💡 ${t.technique_name || t.name}</span>
          <p style="font-size:12px; color:#6b7280; margin-top:4px;">${t.description}</p>
          <p style="font-size:12px; color:#374151; margin-top:4px; background:#eff6ff; padding:8px; border-radius:6px;">${t.application}</p>
        </div>`
      ).join('');
      parts.push(`<div class="section"><h3 style="margin-bottom:8px;">📚 Técnicas Recomendadas</h3>${rows}</div>`);
    }

    return parts.join('\n');
  })()}

  ${transcriptHtml}
</body>
</html>`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export const CallAnalysisDetailModal = ({ analysis, open, onOpenChange }: Props) => {
  const seekToRef = useRef<((time: number) => void) | null>(null);
  const [isRetranscribing, setIsRetranscribing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  const { mutate: shareAnalysis, isPending: isSharing } = useShareCallAnalysis();
  const { mutate: revokeShare, isPending: isRevoking } = useRevokeCallAnalysisShare();
  

  // Reset search when analysis changes
  useEffect(() => { setSearchTerm(''); }, [analysis?.id]);

  const { data: audioUrl } = useQuery({
    queryKey: ['call-audio-url', analysis?.audio_path, analysis?.media_type],
    queryFn: async () => {
      const primaryBucket = analysis!.media_type === 'video' ? 'demo-recordings' : 'call-recordings';
      const fallbackBucket = analysis!.media_type === 'video' ? 'call-recordings' : 'demo-recordings';
      const { data } = await supabase.storage.from(primaryBucket).createSignedUrl(analysis!.audio_path, 3600);
      if (data?.signedUrl) return data.signedUrl;
      const fallback = await supabase.storage.from(fallbackBucket).createSignedUrl(analysis!.audio_path, 3600);
      return fallback.data?.signedUrl || null;
    },
    enabled: open && !!analysis?.audio_path,
  });

  const handleRetranscribe = useCallback(async () => {
    if (!analysis) return;
    setIsRetranscribing(true);
    try {
      // Reset retry count so transcribe-video doesn't immediately fail
      await supabase
        .from('call_analyses')
        .update({ worker_retry_count: 0, status: 'processing', feedback: null } as any)
        .eq('id', analysis.id);

      const fnName = analysis.media_type === 'video' ? 'transcribe-video' : 'transcribe-call';
      const { error } = await supabase.functions.invoke(fnName, {
        body: { analysis_id: analysis.id, audio_path: analysis.audio_path },
      });
      if (error) throw error;
      toast.success('Re-transcrição iniciada! A análise será atualizada em breve.');
      queryClient.invalidateQueries({ queryKey: ['call-analyses'] });
    } catch (e) {
      console.error('Retranscribe error:', e);
      toast.error('Erro ao re-transcrever. Tente novamente.');
    } finally {
      setIsRetranscribing(false);
    }
  }, [analysis, queryClient]);

  // ── Speaker identification ─────────────────────────────────────────────────
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
    const sdrName = analysis.sdr_profile?.name || 'SDR';
    const clientName = analysis.lead_data?.company || 'Cliente';
    const labels: Record<string, string> = {};
    speakers.forEach(s => {
      labels[s] = s === sdrSpeaker ? `🎧 ${sdrName}` : `👤 ${clientName}`;
    });
    return labels;
  }, [analysis]);

  const speakerColors: Record<string, string> = useMemo(() => {
    if (!analysis?.speaker_segments) return {};
    const segments = analysis.speaker_segments as any[];
    const speakers = [...new Set(segments.map(s => s.speaker))] as string[];
    const colors: Record<string, string> = {};
    speakers.forEach(s => {
      colors[s] = speakerLabels[s]?.startsWith('🎧')
        ? 'bg-primary/10 border-primary/30 text-primary'
        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400';
    });
    return colors;
  }, [analysis, speakerLabels]);

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const handleExportPdf = useCallback(() => {
    if (!analysis) return;
    const html = buildPdfHtml(analysis, speakerLabels);
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('Não foi possível abrir a janela de impressão. Verifique as configurações do navegador.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }, [analysis, speakerLabels]);

  // ── Score breakdown data ───────────────────────────────────────────────────
  const demoQuality = useMemo<DemoQuality | undefined>(() => {
    if (!analysis?.ai_analysis) return undefined;
    const dq = (analysis.ai_analysis as any).demo_quality;
    if (!dq || typeof dq !== 'object') return undefined;
    return dq as DemoQuality;
  }, [analysis]);

  const scoreBreakdown = useMemo<ScoreBreakdownItem[] | undefined>(() => {
    if (!analysis?.ai_analysis) return undefined;
    const sb = (analysis.ai_analysis as any).score_breakdown;
    if (!Array.isArray(sb) || sb.length === 0) return undefined;
    return sb as ScoreBreakdownItem[];
  }, [analysis]);

  const hasDemoQuality = !!demoQuality && Object.keys(demoQuality).length > 0;
  const hasScoreBreakdown = !!scoreBreakdown && scoreBreakdown.length > 0;
  const hasBreakdown = hasDemoQuality || hasScoreBreakdown;

  // ── Coaching data extraction ──────────────────────────────────────────────
  const [showCoaching, setShowCoaching] = useState(true);

  const coachingData = useMemo<CoachingData | null>(() => {
    if (!analysis?.ai_analysis) return null;
    const ai = analysis.ai_analysis as any;
    const annotations = Array.isArray(ai.coaching_annotations) ? ai.coaching_annotations as CoachingAnnotation[] : [];
    const keyMoments = Array.isArray(ai.key_moments) ? ai.key_moments as KeyMoment[] : [];
    const missedOpportunities = Array.isArray(ai.missed_opportunities) ? ai.missed_opportunities : [];
    const techniques = Array.isArray(ai.technique_suggestions) ? ai.technique_suggestions : [];
    const coachMessage = typeof ai.coach_overall_message === 'string' ? ai.coach_overall_message : null;
    const rolePlay = ai.role_play_scenario && typeof ai.role_play_scenario === 'object' ? ai.role_play_scenario : null;
    if (!annotations.length && !keyMoments.length && !coachMessage) return null;
    return { annotations, keyMoments, missedOpportunities, coachMessage, techniques, rolePlay };
  }, [analysis]);

  const annotationsBySegment = useMemo(() => {
    if (!coachingData) return {};
    const map: Record<number, CoachingAnnotation[]> = {};
    for (const ann of coachingData.annotations) {
      if (!map[ann.segment_index]) map[ann.segment_index] = [];
      map[ann.segment_index].push(ann);
    }
    return map;
  }, [coachingData]);

  const keyMomentsBySegment = useMemo(() => {
    if (!coachingData) return {};
    const map: Record<number, KeyMoment> = {};
    for (const km of coachingData.keyMoments) {
      map[km.segment_index] = km;
    }
    return map;
  }, [coachingData]);

  // ── Filtered transcript segments (with original index) ────────────────────
  const filteredSegments = useMemo(() => {
    if (!analysis?.speaker_segments) return [];
    const segments = analysis.speaker_segments as any[];
    const withIndex = segments.map((seg, i) => ({ ...seg, _originalIndex: i }));
    if (!searchTerm.trim()) return withIndex;
    return withIndex.filter(seg =>
      (seg.text || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [analysis, searchTerm]);

  if (!analysis) return null;

  const isDemo = analysis.analysis_context === 'demo_closer';
  const interestColor = {
    Alto: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    Médio: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    Baixo: 'bg-destructive/10 text-destructive',
  }[analysis.interest_level] || 'bg-muted text-muted-foreground';

  const objectionColors: Record<string, string> = {
    Preço: 'bg-destructive/10 text-destructive',
    Concorrente: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    'Falta de urgência': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    'Sem orçamento': 'bg-destructive/10 text-destructive',
    'Sem decisor': 'bg-primary/10 text-primary',
    Timing: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  };

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

  // ── Feedback rendering ────────────────────────────────────────────────────
  const renderFeedback = () => {
    if (!analysis.feedback) return null;
    const sections = parseFeedbackSections(analysis.feedback);
    if (sections) {
      const sectionConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
        strengths: { icon: <ThumbsUp className="h-4 w-4" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/5 dark:border-emerald-500/20' },
        improvements: { icon: <Target className="h-4 w-4" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-500/5 dark:border-amber-500/20' },
        recommendations: { icon: <ArrowUpRight className="h-4 w-4" />, color: 'text-primary', bg: 'bg-primary/5 border-primary/20' },
      };
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
    // Fallback: render entire feedback with smart list detection
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Recomendações
          </CardTitle>
        </CardHeader>
        <CardContent>{renderSectionBody(analysis.feedback)}</CardContent>
      </Card>
    );
  };

  const segments = analysis.speaker_segments as any[] | null;
  const hasTranscript = !!segments && segments.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col overflow-hidden p-0">
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-5 pb-4 shrink-0 border-b">
          <DialogTitle asChild>
            <div className="flex items-center gap-4">
              <ScoreGauge score={analysis.call_score} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-base font-bold">
                    {isDemo ? 'Score da Demonstração' : 'Score da Ligação'}
                  </p>
                  {isDemo && <Badge className="bg-primary/10 text-primary text-[10px]">Demo</Badge>}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 flex-wrap">
                  <span>{analysis.sdr_profile?.name || (isDemo ? 'Closer' : 'SDR')} ·</span>
                  <CallAnalysisLeadPicker analysisId={analysis.id} leadData={analysis.lead_data || null} leadId={analysis.lead_id} />
                  <span>· {new Date(analysis.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Converted to sale indicator */}
                {analysis.converted_to_sale && (
                  <Badge className="bg-success/10 text-success border-success/20 gap-1.5 h-7 text-xs">
                    <Trophy className="h-3.5 w-3.5" />
                    Venda realizada
                  </Badge>
                )}
                {/* Share controls — only for completed analyses */}
                {analysis.status === 'completed' && (
                  analysis.share_token ? (
                    <>
                      <Badge variant="secondary" className="gap-1 text-[10px] h-6 px-2">
                        <Link className="h-3 w-3" /> Compartilhado
                      </Badge>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        title="Copiar link"
                        onClick={() => {
                          const url = `${window.location.origin}/call-analysis/share/${analysis.share_token}`;
                          navigator.clipboard.writeText(url).catch(() => {});
                          toast.success('Link copiado!');
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Revogar compartilhamento"
                        onClick={() => revokeShare(analysis.id)}
                        disabled={isRevoking}
                      >
                        {isRevoking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XIcon className="h-3.5 w-3.5" />}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
                      onClick={() => shareAnalysis(analysis)}
                      disabled={isSharing}
                      title="Gerar link público para esta análise"
                    >
                      {isSharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                      Compartilhar
                    </Button>
                  )
                )}
                <Button
                  variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
                  onClick={handleExportPdf} title="Exportar análise como PDF"
                >
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>
                <Button
                  variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
                  onClick={handleRetranscribe} disabled={isRetranscribing}
                  title="Re-transcrever com identificação de interlocutores melhorada"
                >
                  {isRetranscribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  Re-transcrever
                </Button>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* ── Tabs ── */}
        <Tabs defaultValue="analysis" className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-6 mt-3 w-auto self-start shrink-0">
            <TabsTrigger value="analysis" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" /> Análise
            </TabsTrigger>
            <TabsTrigger value="score" className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" /> Pontuação
            </TabsTrigger>
            <TabsTrigger value="transcript" className="gap-1.5 text-xs" disabled={!hasTranscript}>
              <MessageSquare className="h-3.5 w-3.5" /> Transcrição
              {hasTranscript && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">
                  {segments!.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="coach" className="gap-1.5 text-xs" disabled={!coachingData}>
              <GraduationCap className="h-3.5 w-3.5" /> Coach
              {coachingData && coachingData.annotations.length > 0 && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">
                  {coachingData.annotations.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Análise Tab ── */}
          <TabsContent value="analysis" className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 mt-3 space-y-4">
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

            {/* Classification */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border rounded-xl p-3 text-center space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Conexão</p>
                {analysis.connection_effective
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
                  : <XCircle className="h-5 w-5 text-destructive mx-auto" />}
                <p className="text-[10px] font-medium">{analysis.connection_effective ? 'Efetiva' : 'Falhou'}</p>
              </div>
              <div className="border rounded-xl p-3 text-center space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Interesse</p>
                <Badge className={`${interestColor} text-xs`}>{analysis.interest_level}</Badge>
              </div>
              <div className="border rounded-xl p-3 text-center space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Próx. Passo</p>
                {analysis.next_step_defined
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
                  : <XCircle className="h-5 w-5 text-destructive mx-auto" />}
                <p className="text-[10px] font-medium">{analysis.next_step_defined ? 'Definido' : 'Indefinido'}</p>
              </div>
              <div className="border rounded-xl p-3 text-center space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Conversão</p>
                <span className="text-xl font-bold">{analysis.conversion_potential}%</span>
              </div>
            </div>

            {/* Behavioral Metrics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" /> Métricas Comportamentais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <User className="h-3 w-3 text-primary" />
                      <span className="font-medium text-primary">{analysis.sdr_profile?.name?.split(' ')[0] || 'SDR'}</span>
                      <span className="text-muted-foreground">{analysis.sdr_talk_percentage}%</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{analysis.lead_talk_percentage}%</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">{analysis.lead_data?.company?.split(' ')[0] || 'Lead'}</span>
                      <Users className="h-3 w-3 text-emerald-500" />
                    </span>
                  </div>
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
                    <div className="bg-primary/70 transition-all" style={{ width: `${analysis.sdr_talk_percentage}%` }} />
                    <div className="bg-emerald-500/70 transition-all" style={{ width: `${analysis.lead_talk_percentage}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="border rounded-lg p-2.5">
                    <p className="text-lg font-bold">{analysis.open_questions_count}</p>
                    <p className="text-[10px] text-muted-foreground">Perguntas Abertas</p>
                  </div>
                  <div className="border rounded-lg p-2.5">
                    <p className="text-lg font-bold">{analysis.interruptions_count}</p>
                    <p className="text-[10px] text-muted-foreground">Interrupções</p>
                  </div>
                  <div className="border rounded-lg p-2.5">
                    <p className="text-[10px] text-muted-foreground mb-1">Pitch Precoce</p>
                    {analysis.early_pitch
                      ? <Badge variant="destructive" className="text-[10px]">Sim</Badge>
                      : <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700">Não</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Objections */}
            {analysis.objections && (analysis.objections as string[]).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" /> Objeções Detectadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(analysis.objections as string[]).map((obj, i) => (
                      <Badge key={i} className={`${objectionColors[obj] || 'bg-muted text-muted-foreground'} text-xs hover:!text-white`}>
                        {obj}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Feedback */}
            {renderFeedback()}
          </TabsContent>

          {/* ── Pontuação Tab ── */}
          <TabsContent value="score" className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 mt-3">
            <div className="space-y-4">
              {/* Overall score hero */}
              <Card className="border-0 bg-gradient-to-br from-muted/60 to-muted/30">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-6">
                    <ScoreGauge score={analysis.call_score} />
                    <div>
                      <p className="text-sm text-muted-foreground">Score geral</p>
                      <p className="text-3xl font-bold">{analysis.call_score}<span className="text-lg font-normal text-muted-foreground">/100</span></p>
                      <p className={`text-sm font-medium mt-0.5 ${analysis.call_score >= 70 ? 'text-emerald-600 dark:text-emerald-400' : analysis.call_score >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive'}`}>
                        {analysis.call_score >= 70 ? '✓ Bom desempenho' : analysis.call_score >= 40 ? '▲ Desempenho médio' : '✗ Precisa melhorar'}
                      </p>
                    </div>
                    {hasBreakdown && (
                      <div className="ml-auto text-right">
                        <p className="text-xs text-muted-foreground">Pontos perdidos</p>
                        <p className="text-2xl font-bold text-destructive">
                          {hasDemoQuality
                            ? Object.values(demoQuality!).reduce((acc, v) => acc + (10 - (v ?? 0)), 0)
                            : scoreBreakdown!.reduce((acc, item) => acc + (item.max_points - item.points_earned), 0)
                          }
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          de {hasDemoQuality
                            ? Object.keys(demoQuality!).length * 10
                            : scoreBreakdown!.reduce((acc, item) => acc + item.max_points, 0)
                          } possíveis
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Per-criterion breakdown */}
              {hasDemoQuality ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Pontuação por Critério
                      <Badge variant="secondary" className="text-[10px] ml-auto">
                        {Object.keys(demoQuality!).length} critérios
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(demoQualityLabels)
                      .filter(([key]) => demoQuality![key as keyof DemoQuality] !== undefined)
                      .sort(([ka], [kb]) => {
                        const a = demoQuality![ka as keyof DemoQuality] ?? 0;
                        const b = demoQuality![kb as keyof DemoQuality] ?? 0;
                        return a - b; // worst first
                      })
                      .map(([key, label]) => (
                        <ScoreRow
                          key={key}
                          label={label}
                          earned={demoQuality![key as keyof DemoQuality] ?? 0}
                          max={10}
                        />
                      ))}
                    <Separator />
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>Nota: critérios ordenados do pior ao melhor</span>
                      <span>Máximo: {Object.keys(demoQuality!).filter(k => demoQuality![k as keyof DemoQuality] !== undefined).length * 10} pts</span>
                    </div>
                  </CardContent>
                </Card>
              ) : hasScoreBreakdown ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Pontuação por Critério
                      <Badge variant="secondary" className="text-[10px] ml-auto">
                        {scoreBreakdown!.length} critérios
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[...scoreBreakdown!]
                      .sort((a, b) => (a.points_earned / a.max_points) - (b.points_earned / b.max_points))
                      .map((item, i) => (
                        <div key={i} className="space-y-1">
                          <ScoreRow label={item.criterion} earned={item.points_earned} max={item.max_points} />
                          {item.notes && (
                            <p className="text-[11px] text-muted-foreground pl-[210px]">{item.notes}</p>
                          )}
                        </div>
                      ))}
                    <Separator />
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>Critérios ordenados do pior ao melhor</span>
                      <span>Máximo: {scoreBreakdown!.reduce((a, i) => a + i.max_points, 0)} pts</span>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="pt-8 pb-8 text-center">
                    <BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Detalhamento não disponível</p>
                    <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs mx-auto">
                      {isDemo
                        ? 'Esta demo não possui pontuação por critério. Novas análises incluirão este detalhamento automaticamente.'
                        : 'O detalhamento por critério estará disponível em análises realizadas após a atualização do sistema.'}
                    </p>
                    {!isDemo && (
                      <Button variant="outline" size="sm" className="mt-4 gap-1.5 text-xs" onClick={handleRetranscribe} disabled={isRetranscribing}>
                        {isRetranscribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        Re-analisar com detalhamento
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ── Transcrição Tab ── */}
          <TabsContent value="transcript" className="flex flex-col flex-1 min-h-0 px-6 pb-6 mt-3 gap-3">
            {/* Audio Player */}
            {audioUrl && <ModalAudioPlayer url={audioUrl} seekToRef={seekToRef} />}

            {/* Search */}
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9 pr-9 h-9 text-sm"
                placeholder="Buscar palavra ou frase na conversa..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setSearchTerm('')}
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Results count + coaching toggle */}
            <div className="shrink-0 flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                {searchTerm && (
                  <>
                    <Badge variant={filteredSegments.length > 0 ? 'secondary' : 'outline'} className="text-xs">
                      {filteredSegments.length} ocorrência{filteredSegments.length !== 1 ? 's' : ''} de &quot;{searchTerm}&quot;
                    </Badge>
                    {filteredSegments.length === 0 && (
                      <span className="text-xs text-muted-foreground">Nenhum trecho encontrado</span>
                    )}
                  </>
                )}
              </div>
              {coachingData && coachingData.annotations.length > 0 && (
                <Button
                  variant={showCoaching ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 gap-1.5 text-[11px] shrink-0"
                  onClick={() => setShowCoaching(!showCoaching)}
                >
                  {showCoaching ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  Coach {showCoaching ? 'on' : 'off'}
                </Button>
              )}
            </div>

            {/* Segments */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
              {filteredSegments.length > 0 ? (
                filteredSegments.map((seg: any, i: number) => {
                  const origIdx = seg._originalIndex ?? i;
                  const segAnnotations = showCoaching ? (annotationsBySegment[origIdx] || []) : [];
                  const keyMoment = keyMomentsBySegment[origIdx];

                  return (
                    <div key={i}>
                      <div
                        className={`flex gap-3 p-2.5 rounded-lg cursor-pointer transition-colors group hover:bg-muted/60 ${searchTerm ? 'ring-1 ring-yellow-200 dark:ring-yellow-700/40' : ''}`}
                        onClick={() => seekToRef.current?.(seg.start)}
                        title={`Ir para ${formatTime(seg.start)}`}
                      >
                        <div className="flex flex-col items-center shrink-0 gap-1 pt-0.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-5 border whitespace-nowrap ${speakerColors[seg.speaker] || ''}`}
                          >
                            {speakerLabels[seg.speaker] || seg.speaker}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground/50 font-mono group-hover:text-primary transition-colors">
                            {formatTime(seg.start)}
                          </span>
                          {keyMoment && <KeyMomentBadge moment={keyMoment} />}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
                          {searchTerm ? highlightText(seg.text, searchTerm) : seg.text}
                        </p>
                      </div>
                      {segAnnotations.map((ann, j) => (
                        <CoachingAnnotationCard key={j} annotation={ann} />
                      ))}
                    </div>
                  );
                })
              ) : searchTerm ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum trecho contém &quot;{searchTerm}&quot;</p>
                  <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setSearchTerm('')}>
                    Limpar busca
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Transcrição não disponível</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Coach Tab ── */}
          <TabsContent value="coach" className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 mt-3">
            {coachingData && (
              <CoachTab
                data={coachingData}
                onSeekTo={(time) => seekToRef.current?.(time)}
                segments={segments as any[] || undefined}
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
