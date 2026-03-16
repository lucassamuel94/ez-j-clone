import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Eye, Phone, BarChart3, CheckCircle2, AlertCircle, Trash2, Play, Upload, Volume2, Square, Pause, Video } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { CallAnalysisUploadForm } from './CallAnalysisUploadForm';
import { CallAnalysisDetailModal } from './CallAnalysisDetailModal';
import { CallManagerDashboard } from './CallManagerDashboard';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { useCallAnalyses, useDeleteCallAnalysis, useStartAnalysis, CallAnalysis } from '@/hooks/useCallAnalyses';
import { CallAnalysisLeadPicker } from './CallAnalysisLeadPicker';

const useElapsedSeconds = (since: string | null, active: boolean) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active || !since) return;
    const start = new Date(since).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since, active]);
  return elapsed;
};

const formatEta = (seconds: number) => {
  if (seconds <= 0) return 'Finalizando...';
  if (seconds < 60) return `~${seconds}s restantes`;
  const min = Math.ceil(seconds / 60);
  return `~${min}min restante${min > 1 ? 's' : ''}`;
};

const ProcessingIndicator = ({ status, createdAt, transcribedAt, avgTranscriptionSec, avgAnalysisSec, errorMessage, heartbeatAt, chunkCursor, totalChunks }: {
  status: string;
  createdAt: string;
  transcribedAt: string | null;
  avgTranscriptionSec: number;
  avgAnalysisSec: number;
  errorMessage?: string | null;
  heartbeatAt?: string | null;
  chunkCursor?: number | null;
  totalChunks?: number | null;
}) => {
  if (status === 'uploaded') {
    return <Badge className="bg-muted text-muted-foreground text-[10px]">Aguardando análise</Badge>;
  }
  if (status === 'completed') {
    return <Badge className="bg-success/15 text-success text-[10px]">Concluído</Badge>;
  }
  if (status === 'error') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-help">
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            <Badge className="bg-destructive/15 text-destructive text-[10px]">Erro</Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {errorMessage || 'Erro no processamento. Abra os detalhes para mais informações.'}
        </TooltipContent>
      </Tooltip>
    );
  }

  const isTranscribed = status === 'transcribed';
  const hasChunkProgress = !isTranscribed && totalChunks && totalChunks > 1 && chunkCursor != null;
  const chunkProgressPct = hasChunkProgress ? Math.round(((chunkCursor ?? 0) / totalChunks!) * 50) : 0;
  const progressValue = isTranscribed ? 66 : (hasChunkProgress ? Math.max(10, chunkProgressPct) : 33);
  const stepLabel = isTranscribed ? 'Analisando com IA...' : (hasChunkProgress ? `Transcrevendo chunk ${chunkCursor}/${totalChunks}...` : 'Transcrevendo áudio...');
  const stepText = isTranscribed ? 'Etapa 3/3' : 'Etapa 2/3';

  const since = isTranscribed ? transcribedAt : createdAt;
  const estimatedTotal = isTranscribed ? avgAnalysisSec : avgTranscriptionSec;
  const elapsed = useElapsedSeconds(since, true);
  const remaining = Math.max(0, estimatedTotal - elapsed);

  // Show last heartbeat time for transparency
  const lastUpdate = heartbeatAt
    ? new Date(heartbeatAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="flex flex-col gap-1 min-w-[180px]">
      <div className="flex items-center gap-1.5">
        {isTranscribed ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
        )}
        <span className="text-xs font-medium text-muted-foreground">{stepLabel}</span>
      </div>
      <div className="flex items-center gap-2">
        <Progress value={progressValue} className="h-1.5 flex-1" />
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{stepText}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground/70">{formatEta(remaining)}</span>
        {lastUpdate && (
          <span className="text-[9px] text-muted-foreground/50">Atualizado: {lastUpdate}</span>
        )}
      </div>
    </div>
  );
};

export const CallIntelligenceSection = () => {
  const [selectedAnalysis, setSelectedAnalysis] = useState<CallAnalysis | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CallAnalysis | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [contextFilter, setContextFilter] = useState<'all' | 'sdr_call' | 'demo_closer'>('all');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { data: analyses = [], isLoading } = useCallAnalyses();
  const deleteAnalysis = useDeleteCallAnalysis();
  const startAnalysis = useStartAnalysis();

  const filteredAnalyses = useMemo(() => {
    if (contextFilter === 'all') return analyses;
    return analyses.filter(a => a.analysis_context === contextFilter);
  }, [analyses, contextFilter]);

  const handlePlayAudio = useCallback(async (analysisId: string, audioPath: string, mediaType: string = 'audio') => {
    // If already playing this one, stop it
    if (playingId === analysisId) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      setPlaybackRate(1);
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingId(null);
    }

    setLoadingAudioId(analysisId);
    try {
      const primaryBucket = mediaType === 'video' ? 'demo-recordings' : 'call-recordings';
      const fallbackBucket = mediaType === 'video' ? 'call-recordings' : 'demo-recordings';
      let { data, error } = await supabase.storage
        .from(primaryBucket)
        .createSignedUrl(audioPath, 3600);

      // Fallback: try the other bucket for legacy records
      if ((error || !data?.signedUrl) && fallbackBucket) {
        const fallback = await supabase.storage
          .from(fallbackBucket)
          .createSignedUrl(audioPath, 3600);
        data = fallback.data;
        error = fallback.error;
      }

      if (error || !data?.signedUrl) {
        toast.error('Erro ao gerar URL do áudio');
        setLoadingAudioId(null);
        return;
      }

      const audio = new Audio(data.signedUrl);
      audio.playbackRate = 1;
      setPlaybackRate(1);
      audio.onended = () => { setPlayingId(null); setPlaybackRate(1); audioRef.current = null; };
      audio.onerror = () => { toast.error('Erro ao reproduzir áudio'); setPlayingId(null); setPlaybackRate(1); audioRef.current = null; };
      audioRef.current = audio;
      await audio.play();
      setPlayingId(analysisId);
    } catch {
      toast.error('Erro ao reproduzir áudio');
    } finally {
      setLoadingAudioId(null);
    }
  }, [playingId]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  // Uploaded items that can be selected for bulk analysis
  const uploadedItems = useMemo(() => filteredAnalyses.filter(a => a.status === 'uploaded'), [filteredAnalyses]);
  const allUploadedSelected = uploadedItems.length > 0 && uploadedItems.every(a => selectedIds.has(a.id));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allUploadedSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(uploadedItems.map(a => a.id)));
    }
  };

  const handleStartBulk = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startAnalysis.mutate(ids, {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const handleStartSingle = (id: string) => {
    startAnalysis.mutate([id]);
  };

  // Calculate historical averages for ETA
  const { avgTranscriptionSec, avgAnalysisSec } = useMemo(() => {
    const completed = analyses.filter(a => a.status === 'completed' && a.transcribed_at && a.completed_at);
    if (completed.length === 0) return { avgTranscriptionSec: 60, avgAnalysisSec: 20 };
    const recent = completed.slice(0, 20);
    const transcriptionTimes = recent
      .map(a => (new Date(a.transcribed_at!).getTime() - new Date(a.created_at).getTime()) / 1000)
      .filter(t => t > 0 && t < 600);
    const analysisTimes = recent
      .map(a => (new Date(a.completed_at!).getTime() - new Date(a.transcribed_at!).getTime()) / 1000)
      .filter(t => t > 0 && t < 300);
    return {
      avgTranscriptionSec: transcriptionTimes.length > 0 ? Math.round(transcriptionTimes.reduce((a, b) => a + b, 0) / transcriptionTimes.length) : 60,
      avgAnalysisSec: analysisTimes.length > 0 ? Math.round(analysisTimes.reduce((a, b) => a + b, 0) / analysisTimes.length) : 20,
    };
  }, [analyses]);

  const interestMap: Record<string, string> = {
    Alto: 'bg-success/10 text-success',
    Médio: 'bg-warning/10 text-warning',
    Baixo: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="analyses">
        <TabsList>
          <TabsTrigger value="analyses" className="gap-2">
            <Phone className="h-4 w-4" />
            Análises
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Painel Gerencial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analyses" className="space-y-4 mt-4">
          <CallAnalysisUploadForm />

          {/* Context filter */}
          <div className="flex items-center gap-2">
            <Button
              variant={contextFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setContextFilter('all')}
            >
              Todos
            </Button>
            <Button
              variant={contextFilter === 'sdr_call' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setContextFilter('sdr_call')}
            >
              <Phone className="h-3 w-3" />
              Ligações SDR
            </Button>
            <Button
              variant={contextFilter === 'demo_closer' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setContextFilter('demo_closer')}
            >
              <Video className="h-3 w-3" />
              Demos Closer
            </Button>
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-primary/5">
              <span className="text-xs font-medium text-muted-foreground">
                {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
              </span>
              <Button
                size="sm"
                onClick={handleStartBulk}
                disabled={startAnalysis.isPending}
                className="h-7 text-xs gap-1.5"
              >
                {startAnalysis.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Analisar Selecionados
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                className="h-7 text-xs"
              >
                Limpar seleção
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAnalyses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Phone className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Nenhuma análise encontrada.</p>
              <p className="text-xs">Faça upload de um áudio ou vídeo acima para começar.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      {uploadedItems.length > 0 && (
                        <Checkbox
                          checked={allUploadedSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Selecionar todos pendentes"
                        />
                      )}
                    </TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Arquivo</TableHead>
                    <TableHead className="text-xs text-center">Duração</TableHead>
                    <TableHead className="text-xs">{contextFilter === 'demo_closer' ? 'Closer' : 'SDR'}</TableHead>
                    <TableHead className="text-xs">Lead / Empresa</TableHead>
                    <TableHead className="text-xs text-center">Score</TableHead>
                    <TableHead className="text-xs text-center">Interesse</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAnalyses.map((a) => {
                    const isInProgress = a.status === 'processing' || a.status === 'transcribed';
                    const isUploaded = a.status === 'uploaded';
                    return (
                      <TableRow
                        key={a.id}
                        className={`cursor-pointer hover:bg-muted/50 ${isInProgress ? 'bg-primary/5' : ''} ${isUploaded ? 'bg-muted/30' : ''}`}
                        onClick={() => a.status === 'completed' && setSelectedAnalysis(a)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {isUploaded && (
                            <Checkbox
                              checked={selectedIds.has(a.id)}
                              onCheckedChange={() => toggleSelect(a.id)}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {a.analysis_context === 'demo_closer' ? (
                            <Badge className="bg-primary/10 text-primary text-[10px] gap-1">
                              <Video className="h-2.5 w-2.5" />
                              Demo
                            </Badge>
                          ) : (
                            <Badge className="bg-muted text-muted-foreground text-[10px] gap-1">
                              <Phone className="h-2.5 w-2.5" />
                              Ligação
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(a.created_at).toLocaleDateString('pt-BR')}{' '}
                          {new Date(a.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate" title={a.original_filename || a.audio_path.split('/').pop() || ''}>
                          {a.original_filename || a.audio_path.split('/').pop() || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-center text-muted-foreground">
                          {a.duration_seconds > 0
                            ? `${Math.floor(a.duration_seconds / 60)}:${String(a.duration_seconds % 60).padStart(2, '0')}`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{a.sdr_profile?.name || '—'}</TableCell>
                        <TableCell className="text-xs" onClick={(e) => e.stopPropagation()}>
                          <CallAnalysisLeadPicker analysisId={a.id} leadData={a.lead_data || null} leadId={a.lead_id} />
                        </TableCell>
                        <TableCell className="text-center">
                          {a.status === 'completed' ? (
                            <span className={`text-sm font-bold ${a.call_score >= 70 ? 'text-success' : a.call_score >= 40 ? 'text-warning' : 'text-destructive'}`}>
                              {a.call_score}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          {a.status === 'completed' ? (
                            <Badge className={`${interestMap[a.interest_level] || ''} text-[10px]`}>{a.interest_level}</Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <ProcessingIndicator status={a.status} createdAt={a.created_at} transcribedAt={a.transcribed_at} avgTranscriptionSec={avgTranscriptionSec} avgAnalysisSec={avgAnalysisSec} errorMessage={a.feedback} heartbeatAt={(a as unknown as Record<string, unknown>).worker_heartbeat_at as string | null} chunkCursor={(a as unknown as Record<string, unknown>).worker_chunk_cursor as number | null} totalChunks={(a as unknown as Record<string, unknown>).worker_total_chunks as number | null} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {/* Audio player button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${playingId === a.id ? 'text-primary' : ''}`}
                              onClick={() => handlePlayAudio(a.id, a.audio_path, a.media_type)}
                              disabled={loadingAudioId === a.id}
                              title={playingId === a.id ? 'Parar' : 'Ouvir ligação'}
                            >
                              {loadingAudioId === a.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : playingId === a.id ? (
                                <Square className="h-3.5 w-3.5" />
                              ) : (
                                <Volume2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            {playingId === a.id && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10); }}
                                  title="Voltar 10s"
                                >
                                  <span className="text-[10px] font-bold">-10</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 10); }}
                                  title="Avançar 10s"
                                >
                                  <span className="text-[10px] font-bold">+10</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[10px] px-1.5 font-mono min-w-[40px]"
                                  onClick={() => {
                                    const speeds = [1, 1.2, 1.5, 2];
                                    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
                                    const newRate = speeds[nextIdx];
                                    setPlaybackRate(newRate);
                                    if (audioRef.current) audioRef.current.playbackRate = newRate;
                                  }}
                                  title="Alterar velocidade"
                                >
                                  {playbackRate}x
                                </Button>
                              </>
                            )}
                            {isUploaded && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => handleStartSingle(a.id)}
                                disabled={startAnalysis.isPending}
                              >
                                <Play className="h-3 w-3" />
                                Analisar
                              </Button>
                            )}
                            {a.status === 'completed' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedAnalysis(a)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(a)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4">
          <CallManagerDashboard />
        </TabsContent>
      </Tabs>

      <CallAnalysisDetailModal
        analysis={selectedAnalysis}
        open={!!selectedAnalysis}
        onOpenChange={(open) => !open && setSelectedAnalysis(null)}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteAnalysis.mutate(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        title="Excluir análise"
        description={`Tem certeza que deseja excluir a análise de ${deleteTarget?.sdr_profile?.name || 'SDR'} — ${deleteTarget ? new Date(deleteTarget.created_at).toLocaleDateString('pt-BR') : ''}?`}
      />
    </div>
  );
};
