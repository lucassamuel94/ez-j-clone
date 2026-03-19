import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, Loader2, X, FileAudio, FileVideo, Zap, Search } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUploadCallAnalysis, useStartAnalysis } from '@/hooks/useCallAnalyses';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { compressAudio, shouldCompress, validateFileSize, type CompressionProgress } from '@/utils/audioCompressor';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MAX_DAILY_UPLOADS = 2;
const ACCEPTED_FORMATS = '.mp3,.wav,.m4a,.webm,.ogg,.mp4,.mov,.avi,.mpeg';
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'avi', 'mpeg', 'webm']);

function getMediaType(file: File): 'audio' | 'video' {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return VIDEO_EXTENSIONS.has(ext) ? 'video' : 'audio';
}

async function getDailyUploadCount(userId: string): Promise<number> {
  const now = new Date();
  const spFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = spFormatter.format(now);
  const startOfDay = new Date(`${todayStr}T00:00:00-03:00`).toISOString();

  const { count, error } = await supabase
    .from('call_analyses' as any)
    .select('*', { count: 'exact', head: true })
    .eq('uploaded_by', userId)
    .gte('created_at', startOfDay) as { count: number | null; error: unknown };

  if (error) {
    console.error('Daily upload count check error:', error);
    return 0;
  }
  return count ?? 0;
}

type Phase = 'idle' | 'compressing' | 'uploading';

export function CloserSelfUploadSection() {
  const { user } = useCurrentUser();
  const [file, setFile] = useState<File | null>(null);
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [creditsUsed, setCreditsUsed] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [compressionPercent, setCompressionPercent] = useState(0);
  const [compressionLabel, setCompressionLabel] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const upload = useUploadCallAnalysis();
  const startAnalysis = useStartAnalysis();

  // Load daily count on mount
  useEffect(() => {
    if (user?.id) {
      getDailyUploadCount(user.id).then(setCreditsUsed);
    }
  }, [user?.id]);

  const remaining = creditsUsed !== null ? Math.max(0, MAX_DAILY_UPLOADS - creditsUsed) : null;
  const isLimitReached = remaining !== null && remaining <= 0;
  const isProcessing = phase !== 'idle';

  // Lead search
  const { data: leads = [] } = useQuery({
    queryKey: ['leads-search-closer-upload', leadSearch],
    queryFn: async () => {
      if (!leadSearch || leadSearch.length < 2) return [];
      const { data } = await supabase
        .from('leads')
        .select('id, name, company')
        .or(`name.ilike.%${leadSearch}%,company.ilike.%${leadSearch}%`)
        .limit(10);
      return data || [];
    },
    enabled: leadSearch.length >= 2,
  });

  const handleFileSelect = useCallback((f: File | null) => {
    if (!f) return;
    const sizeError = validateFileSize(f);
    if (sizeError) {
      toast.error(sizeError);
      return;
    }
    setFile(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase('idle');
    setCompressionPercent(0);
    toast.info('Processo cancelado.');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file || !user?.id) return;

    // Re-check limit
    const used = await getDailyUploadCount(user.id);
    if (used >= MAX_DAILY_UPLOADS) {
      setCreditsUsed(used);
      toast.error(`Limite diário de ${MAX_DAILY_UPLOADS} análises atingido. Tente novamente amanhã.`);
      return;
    }

    const mediaType = getMediaType(file);
    let fileToUpload = file;
    const controller = new AbortController();
    abortRef.current = controller;

    // Compress audio if needed (skip for video — video goes direct)
    if (mediaType === 'audio' && shouldCompress(file)) {
      setPhase('compressing');
      setCompressionPercent(0);
      try {
        fileToUpload = await compressAudio(file, (p: CompressionProgress) => {
          if (p.phase === 'decoding') {
            setCompressionLabel('Decodificando áudio...');
            setCompressionPercent(Math.round(p.percent * 0.3));
          } else if (p.phase === 'encoding') {
            setCompressionLabel('Comprimindo para MP3...');
            setCompressionPercent(30 + Math.round(p.percent * 0.7));
          }
        }, controller.signal);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        toast.error(`Erro na compressão: ${msg}`);
        setPhase('idle');
        return;
      }
    }

    if (controller.signal.aborted) return;

    setPhase('uploading');

    upload.mutate(
      {
        file: fileToUpload,
        sdr_user_id: user.id,
        lead_id: selectedLeadId || undefined,
        media_type: mediaType,
        analysis_context: 'demo_closer',
      },
      {
        onSuccess: (analysis) => {
          // Auto-trigger transcription
          if (analysis?.id) {
            startAnalysis.mutate([analysis.id]);
          }
          setCreditsUsed((prev) => (prev ?? 0) + 1);
          setFile(null);
          setLeadSearch('');
          setSelectedLeadId('');
          setPhase('idle');
          setCompressionPercent(0);
          if (fileInputRef.current) fileInputRef.current.value = '';
          toast.success('Gravação enviada! Quando a análise estiver pronta, você receberá um e-mail com o relatório completo.', { duration: 6000 });
        },
        onError: () => {
          setPhase('idle');
          setCompressionPercent(0);
        },
      },
    );
  }, [file, user?.id, selectedLeadId, upload, startAnalysis]);

  const mediaType = file ? getMediaType(file) : null;

  return (
    <Card className="border border-border rounded-2xl shadow-sm">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Drop Zone */}
          <div
            className={cn(
              'flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 py-8 px-4 cursor-pointer transition-colors min-h-[120px]',
              dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
              isProcessing && 'pointer-events-none opacity-60',
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FORMATS}
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            />

            {isProcessing ? (
              <div className="w-full max-w-xs space-y-2">
                <div className="flex items-center gap-2 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {phase === 'compressing' ? compressionLabel : 'Enviando arquivo...'}
                  </span>
                </div>
                {phase === 'compressing' && (
                  <Progress value={compressionPercent} className="h-2" />
                )}
              </div>
            ) : file ? (
              <div className="flex items-center gap-2 text-sm">
                {mediaType === 'video' ? (
                  <FileVideo className="h-4 w-4 text-primary" />
                ) : (
                  <FileAudio className="h-4 w-4 text-primary" />
                )}
                <span className="font-medium truncate max-w-[300px]">{file.name}</span>
                <span className="text-muted-foreground">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                {mediaType === 'audio' && shouldCompress(file) && (
                  <span className="flex items-center gap-1 text-xs text-primary">
                    <Zap className="h-3 w-3" />
                    será comprimido
                  </span>
                )}
                <button
                  className="ml-1 p-0.5 rounded hover:bg-muted transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Arraste um áudio ou vídeo ou clique para selecionar
                </p>
              </>
            )}
          </div>

          {/* Right side: Lead search + counter + button */}
          <div className="flex flex-col gap-3 md:w-[280px] shrink-0">
            {/* Lead search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar lead (opcional)"
                value={leadSearch}
                onChange={(e) => {
                  setLeadSearch(e.target.value);
                  setSelectedLeadId('');
                }}
                className="h-9 text-xs pl-8"
                disabled={isProcessing}
              />
              {leads.length > 0 && !selectedLeadId && (
                <div className="absolute z-10 top-full mt-1 w-full border rounded-md bg-background shadow-md max-h-32 overflow-y-auto">
                  {leads.map((l: { id: string; name: string; company: string }) => (
                    <button
                      key={l.id}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setSelectedLeadId(l.id);
                        setLeadSearch(`${l.name} — ${l.company}`);
                      }}
                    >
                      <span className="font-medium">{l.name}</span>
                      <span className="text-muted-foreground"> — {l.company}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Counter + Button */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs shrink-0 tabular-nums">
                {creditsUsed ?? '…'}/{MAX_DAILY_UPLOADS} hoje
              </Badge>
              <Button
                onClick={handleSubmit}
                disabled={!file || isLimitReached || isProcessing}
                className="flex-1 gap-2"
                size="sm"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {phase === 'compressing' ? 'Comprimindo...' : 'Enviando...'}
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    Enviar para Análise
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Limit warning */}
        {isLimitReached && (
          <p className="text-xs text-destructive mt-3">
            Limite diário atingido ({MAX_DAILY_UPLOADS}/{MAX_DAILY_UPLOADS}). Tente novamente amanhã.
          </p>
        )}

        {/* Cancel button during processing */}
        {isProcessing && phase === 'compressing' && (
          <div className="mt-2 flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleCancel} className="text-xs h-7">
              <X className="h-3 w-3 mr-1" /> Cancelar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
