import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { CheckCircle2, XCircle, MessageSquare, AlertTriangle, TrendingUp, Lightbulb, User, Users, Play, Pause, SkipBack, SkipForward, RotateCcw, Loader2 } from 'lucide-react';
import { CallAnalysis } from '@/hooks/useCallAnalyses';
import { CallAnalysisLeadPicker } from './CallAnalysisLeadPicker';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/** Parse numbered recommendations from AI text into structured items */
function parseRecommendations(text: string): { title: string; body: string }[] {
  // Normalize: insert \n before mid-text numbered items (e.g. "...texto. 3. **Título**")
  const normalized = text.replace(/(?<=[\.\!\?\:])\s+(?=\d+\.\s)/g, '\n');
  const parts = normalized.split(/(?:^|\n)\s*\d+\.\s+/).filter(Boolean);
  if (parts.length === 0) return [];

  return parts.map((part) => {
    // Try to extract "**Title:** body" or "Title: body"
    const boldMatch = part.match(/^\*{2}(.+?)\*{2}:?\s*([\s\S]*)$/);
    if (boldMatch) {
      return { title: boldMatch[1].trim(), body: boldMatch[2].trim() };
    }
    const colonMatch = part.match(/^([^:]{3,60}):\s*([\s\S]+)$/);
    if (colonMatch) {
      return { title: colonMatch[1].replace(/\*+/g, '').trim(), body: colonMatch[2].trim() };
    }
    return { title: '', body: part.trim() };
  });
}

/** Convert inline markdown (**bold**, *italic*) to React elements */
function parseInlineMarkdown(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*{2}(.+?)\*{2}|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={key++} className="font-semibold text-foreground">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={key++}>{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [line];
}

/** Render AI markdown text as structured React paragraphs */
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

interface Props {
  analysis: CallAnalysis | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ScoreGauge = ({ score }: { score: number }) => {
  const color = score >= 70 ? 'text-success' : score >= 40 ? 'text-warning' : 'text-destructive';
  const bg = score >= 70 ? 'bg-emerald-100 dark:bg-emerald-500/15' : score >= 40 ? 'bg-amber-100 dark:bg-amber-500/15' : 'bg-destructive/10';
  return (
    <div className={`flex items-center justify-center h-20 w-20 rounded-full ${bg}`}>
      <span className={`text-2xl font-bold ${color}`}>{score}</span>
    </div>
  );
};

const formatTime = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const SPEEDS = [1, 1.2, 1.5, 2];

const ModalAudioPlayer = ({ url, seekToRef }: { url: string; seekToRef: React.MutableRefObject<((time: number) => void) | null> }) => {
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
    if (playing) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setPlaying(!playing);
  };

  const seek = (val: number[]) => {
    if (audioRef.current) audioRef.current.currentTime = val[0];
  };

  const skip = (delta: number) => {
    if (audioRef.current) audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + delta));
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Player de Áudio</p>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => skip(-10)} title="Voltar 10s">
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={togglePlay}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => skip(10)} title="Avançar 10s">
          <SkipForward className="h-4 w-4" />
        </Button>
        <span className="text-[11px] font-mono text-muted-foreground w-[90px] text-center shrink-0">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <Slider
          value={[currentTime]}
          max={duration || 1}
          step={0.5}
          onValueChange={seek}
          className="flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] px-2 font-mono min-w-[42px] shrink-0"
          onClick={cycleSpeed}
          title="Velocidade"
        >
          {speed}x
        </Button>
      </div>
    </div>
  );
};

export const CallAnalysisDetailModal = ({ analysis, open, onOpenChange }: Props) => {
  const seekToRef = useRef<((time: number) => void) | null>(null);
  const [isRetranscribing, setIsRetranscribing] = useState(false);
  const queryClient = useQueryClient();
  // Signed URL for audio — must be before any early return
  const { data: audioUrl } = useQuery({
    queryKey: ['call-audio-url', analysis?.audio_path, analysis?.media_type],
    queryFn: async () => {
      const primaryBucket = analysis!.media_type === 'video' ? 'demo-recordings' : 'call-recordings';
      const fallbackBucket = analysis!.media_type === 'video' ? 'call-recordings' : 'demo-recordings';
      const { data } = await supabase.storage
        .from(primaryBucket)
        .createSignedUrl(analysis!.audio_path, 3600);
      if (data?.signedUrl) return data.signedUrl;
      // Fallback for legacy records stored in the other bucket
      const fallback = await supabase.storage
        .from(fallbackBucket)
        .createSignedUrl(analysis!.audio_path, 3600);
      return fallback.data?.signedUrl || null;
    },
    enabled: open && !!analysis?.audio_path,
  });

  const handleRetranscribe = useCallback(async () => {
    if (!analysis) return;
    setIsRetranscribing(true);
    try {
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

  if (!analysis) return null;
  const interestColor = {
    Alto: 'bg-success/10 text-success',
    Médio: 'bg-warning/10 text-warning',
    Baixo: 'bg-destructive/10 text-destructive',
  }[analysis.interest_level] || 'bg-muted text-muted-foreground';

  const objectionColors: Record<string, string> = {
    Preço: 'bg-destructive/10 text-destructive',
    Concorrente: 'bg-warning/10 text-warning',
    'Falta de urgência': 'bg-warning/10 text-warning',
    'Sem orçamento': 'bg-destructive/10 text-destructive',
    'Sem decisor': 'bg-primary/10 text-primary',
    Timing: 'bg-info/10 text-info',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <ScoreGauge score={analysis.call_score} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold">
                  {analysis.analysis_context === 'demo_closer' ? 'Score da Demonstração' : 'Score da Ligação'}
                </p>
                {analysis.analysis_context === 'demo_closer' && (
                  <Badge className="bg-primary/10 text-primary text-[10px]">Demo</Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{analysis.sdr_profile?.name || (analysis.analysis_context === 'demo_closer' ? 'Closer' : 'SDR')} ·</span>
                <CallAnalysisLeadPicker analysisId={analysis.id} leadData={analysis.lead_data || null} leadId={analysis.lead_id} />
                <span>· {new Date(analysis.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={handleRetranscribe}
              disabled={isRetranscribing}
              title="Re-transcrever com identificação de interlocutores melhorada"
            >
              {isRetranscribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Re-transcrever
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          <div className="space-y-4">
            {/* Executive Summary */}
            {analysis.executive_summary && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    Resumo Executivo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {renderMarkdownText(analysis.executive_summary)}
                </CardContent>
              </Card>
            )}

            {/* Classification */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Conexão</p>
                {analysis.connection_effective ? (
                   <CheckCircle2 className="h-5 w-5 text-success mx-auto" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive mx-auto" />
                )}
              </div>
              <div className="border rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Interesse</p>
                <Badge className={`${interestColor} text-xs`}>{analysis.interest_level}</Badge>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Próx. Passo</p>
                {analysis.next_step_defined ? (
                  <CheckCircle2 className="h-5 w-5 text-success mx-auto" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive mx-auto" />
                )}
              </div>
              <div className="border rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Conversão</p>
                <span className="text-lg font-bold">{analysis.conversion_potential}%</span>
              </div>
            </div>

            {/* Behavioral Metrics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Métricas Comportamentais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> SDR: {analysis.sdr_talk_percentage}%</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Lead: {analysis.lead_talk_percentage}%</span>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                    <div className="bg-primary/70 transition-all" style={{ width: `${analysis.sdr_talk_percentage}%` }} />
                    <div className="bg-success/70 transition-all" style={{ width: `${analysis.lead_talk_percentage}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold">{analysis.open_questions_count}</p>
                    <p className="text-[10px] text-muted-foreground">Perguntas Abertas</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{analysis.interruptions_count}</p>
                    <p className="text-[10px] text-muted-foreground">Interrupções</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Pitch Precoce</p>
                    {analysis.early_pitch ? (
                      <Badge variant="destructive" className="text-[10px]">Sim</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Não</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Objections */}
            {analysis.objections && analysis.objections.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    Objeções Detectadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {analysis.objections.map((obj: string, i: number) => (
                      <Badge key={i} className={`${objectionColors[obj] || 'bg-muted text-muted-foreground'} text-xs`}>
                        {obj}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Feedback / Recomendações */}
            {analysis.feedback && (() => {
              const items = parseRecommendations(analysis.feedback);
              const hasStructured = items.length > 0;

              return (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Recomendações
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {hasStructured ? (
                      <ol className="space-y-3 list-none p-0 m-0">
                        {items.map((item, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                              {i + 1}
                            </span>
                            <div className="min-w-0">
                              {item.title && <p className="text-sm font-semibold text-foreground">{item.title}</p>}
                              {renderMarkdownText(item.body)}
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div>{renderMarkdownText(analysis.feedback)}</div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Audio Player */}
             {audioUrl && (
              <>
                <Separator />
                <ModalAudioPlayer url={audioUrl} seekToRef={seekToRef} />
              </>
            )}

            {/* Transcription */}
            {analysis.speaker_segments && analysis.speaker_segments.length > 0 && (() => {
              // Calculate total talk time per speaker to match with sdr_talk_percentage
              const speakers = [...new Set(analysis.speaker_segments.map((s: any) => s.speaker))] as string[];
              const talkTime: Record<string, number> = {};
              speakers.forEach(s => { talkTime[s] = 0; });
              analysis.speaker_segments.forEach((seg: any) => {
                const dur = (seg.end || 0) - (seg.start || 0);
                if (talkTime[seg.speaker] !== undefined) talkTime[seg.speaker] += dur;
              });
              const totalTime = Object.values(talkTime).reduce((a, b) => a + b, 0) || 1;

              // The speaker whose talk % is closest to sdr_talk_percentage is the SDR
              const sdrPct = analysis.sdr_talk_percentage || 0;
              let sdrSpeaker = speakers[0];
              let minDiff = Infinity;
              speakers.forEach(s => {
                const pct = (talkTime[s] / totalTime) * 100;
                const diff = Math.abs(pct - sdrPct);
                if (diff < minDiff) { minDiff = diff; sdrSpeaker = s; }
              });

              const sdrName = analysis.sdr_profile?.name || 'SDR';
              const clientName = analysis.lead_data?.company || 'Cliente';

              const speakerLabels: Record<string, string> = {};
              const speakerColors: Record<string, string> = {};
              speakers.forEach(s => {
                if (s === sdrSpeaker) {
                  speakerLabels[s] = `🎧 ${sdrName}`;
                  speakerColors[s] = 'bg-primary/10 border-primary/30 text-primary';
                } else {
                  speakerLabels[s] = `👤 ${clientName}`;
                  speakerColors[s] = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400';
                }
              });

              return (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-3">Transcrição Completa</p>
                    <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                      {analysis.speaker_segments.map((seg: any, i: number) => (
                        <div
                          key={i}
                          className="flex gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors group"
                          onClick={() => seekToRef.current?.(seg.start)}
                          title={`Ir para ${formatTime(seg.start)}`}
                        >
                          <div className="flex flex-col items-center shrink-0 gap-0.5">
                            <Badge variant="outline" className={`text-[10px] h-5 border ${speakerColors[seg.speaker] || ''}`}>
                              {speakerLabels[seg.speaker] || seg.speaker}
                            </Badge>
                            <span className="text-[9px] text-muted-foreground/60 font-mono group-hover:text-primary transition-colors">
                              {formatTime(seg.start)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{seg.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
