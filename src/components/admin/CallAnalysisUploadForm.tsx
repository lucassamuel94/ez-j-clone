import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Loader2, FileAudio, FileVideo, Zap, X, Phone, Video } from 'lucide-react';
import { useUploadCallAnalysis } from '@/hooks/useCallAnalyses';
import { useSystemUsers } from '@/hooks/useSystemUsers';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { compressAudio, validateFileSize, shouldCompress, type CompressionProgress } from '@/utils/audioCompressor';
import { toast } from 'sonner';
import { EZCallImportTab } from './EZCallImportTab';

const MAX_VIDEO_SIZE_WARN_GB = 1; // acima disso avisa (mas não bloqueia)

const AUDIO_FORMATS = '.mp3,.wav,.m4a,.webm,.ogg';
const VIDEO_FORMATS = '.mp4,.webm,.mov,.avi,.mpeg';
const MAX_VIDEO_SIZE_GB = 2;


type UploadPhase = 'idle' | 'compressing' | 'uploading' | 'done';

export const CallAnalysisUploadForm = () => {
  const [file, setFile] = useState<File | null>(null);
  const [sdrUserId, setSdrUserId] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [compressionPercent, setCompressionPercent] = useState(0);
  const [compressionPhaseLabel, setCompressionPhaseLabel] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);

  // Video-specific state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [closerUserId, setCloserUserId] = useState('');
  const [videoLeadSearch, setVideoLeadSearch] = useState('');
  const [selectedVideoLeadId, setSelectedVideoLeadId] = useState('');
  const [videoPhase, setVideoPhase] = useState<UploadPhase>('idle');
  const upload = useUploadCallAnalysis();
  const { data: sdrs = [] } = useSystemUsers();

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-search-call', leadSearch],
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

  const { data: videoLeads = [] } = useQuery({
    queryKey: ['leads-search-video', videoLeadSearch],
    queryFn: async () => {
      if (!videoLeadSearch || videoLeadSearch.length < 2) return [];
      const { data } = await supabase
        .from('leads')
        .select('id, name, company')
        .or(`name.ilike.%${videoLeadSearch}%,company.ilike.%${videoLeadSearch}%`)
        .limit(10);
      return data || [];
    },
    enabled: videoLeadSearch.length >= 2,
  });

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase('idle');
    setCompressionPercent(0);
    toast.info('Processo cancelado.');
  }, []);

  const handleSubmit = async () => {
    if (!file || !sdrUserId) return;

    const sizeError = validateFileSize(file);
    if (sizeError) {
      toast.error(sizeError);
      return;
    }

    let fileToUpload = file;
    const controller = new AbortController();
    abortRef.current = controller;

    if (shouldCompress(file)) {
      setPhase('compressing');
      setCompressionPercent(0);
      try {
        fileToUpload = await compressAudio(file, (p: CompressionProgress) => {
          if (p.phase === 'decoding') {
            setCompressionPhaseLabel('Decodificando áudio...');
            setCompressionPercent(Math.round(p.percent * 0.3));
          } else if (p.phase === 'encoding') {
            setCompressionPhaseLabel('Comprimindo para MP3...');
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
      { file: fileToUpload, sdr_user_id: sdrUserId, lead_id: selectedLeadId || undefined, media_type: 'audio', analysis_context: 'sdr_call' },
      {
        onSuccess: () => {
          setFile(null);
          setLeadSearch('');
          setSelectedLeadId('');
          setPhase('idle');
          setCompressionPercent(0);
          if (fileRef.current) fileRef.current.value = '';
        },
        onError: () => {
          setPhase('idle');
        },
      }
    );
  };

  const handleVideoSubmit = async () => {
    if (!videoFile || !closerUserId) return;

    const sizeError = validateFileSize(videoFile);
    if (sizeError) {
      toast.error(sizeError);
      return;
    }

    // Aviso para arquivos muito grandes (não bloqueia)
    if (videoFile.size > MAX_VIDEO_SIZE_WARN_GB * 1024 * 1024 * 1024) {
      toast.warning(`Arquivo grande (${(videoFile.size / 1024 / 1024 / 1024).toFixed(1)}GB). O upload pode demorar alguns minutos.`);
    }

    setVideoPhase('uploading');

    upload.mutate(
      {
        file: videoFile,
        sdr_user_id: closerUserId,
        lead_id: selectedVideoLeadId || undefined,
        media_type: 'video',
        analysis_context: 'demo_closer',
      },
      {
        onSuccess: () => {
          setVideoFile(null);
          setVideoLeadSearch('');
          setSelectedVideoLeadId('');
          setVideoPhase('idle');
          if (videoFileRef.current) videoFileRef.current.value = '';
        },
        onError: () => {
          setVideoPhase('idle');
        },
      }
    );
  };

  const isProcessing = phase !== 'idle';
  const isVideoProcessing = videoPhase !== 'idle';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Upload de Mídia
        </CardTitle>
        <CardDescription>Envie gravações de ligações, vídeos de demonstração ou importe do PABX EZCall.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ezcall" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="ezcall" className="text-xs gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              Importar do EZCall
            </TabsTrigger>
            <TabsTrigger value="manual" className="text-xs gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Upload Manual
            </TabsTrigger>
            <TabsTrigger value="video" className="text-xs gap-1.5">
              <Video className="h-3.5 w-3.5" />
              Vídeo de Demo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* File */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Arquivo de Áudio</Label>
                <Input
                  ref={fileRef}
                  type="file"
                  accept={AUDIO_FORMATS}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="text-xs"
                  disabled={isProcessing}
                />
                {file && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileAudio className="h-3.5 w-3.5" />
                    {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                    {shouldCompress(file) && (
                      <span className="flex items-center gap-1 text-primary">
                        <Zap className="h-3 w-3" />
                        será comprimido
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* SDR */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">SDR</Label>
                <Select value={sdrUserId} onValueChange={setSdrUserId} disabled={isProcessing}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione o SDR" />
                  </SelectTrigger>
                  <SelectContent>
                    {sdrs.map((u: { id: string; name: string }) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lead */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Lead (opcional)</Label>
                <Input
                  placeholder="Buscar por nome ou empresa..."
                  value={leadSearch}
                  onChange={(e) => {
                    setLeadSearch(e.target.value);
                    setSelectedLeadId('');
                  }}
                  className="h-9 text-xs"
                  disabled={isProcessing}
                />
                {leads.length > 0 && !selectedLeadId && (
                  <div className="border rounded-md bg-background shadow-sm max-h-32 overflow-y-auto">
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
            </div>

            {/* Compression/Upload Progress */}
            {isProcessing && (
              <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    <span className="text-xs font-medium truncate">
                      {phase === 'compressing' ? compressionPhaseLabel : 'Enviando arquivo...'}
                    </span>
                    {phase === 'compressing' && (
                      <span className="text-xs text-muted-foreground">{compressionPercent}%</span>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCancel} title="Cancelar">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {phase === 'compressing' && (
                  <>
                    <Progress value={compressionPercent} className="h-2" />
                    <p className="text-[10px] text-muted-foreground">
                      Comprimindo {(file!.size / 1024 / 1024).toFixed(0)}MB → MP3 128kbps...
                    </p>
                  </>
                )}
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!file || !sdrUserId || isProcessing}
              className="w-full md:w-auto"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {phase === 'compressing' ? 'Comprimindo...' : 'Enviando...'}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload/Conversão
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="video" className="space-y-4 mt-0">
            <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
              <Zap className="h-4 w-4 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground">
                O vídeo será enviado diretamente e a transcrição é feita pelo ElevenLabs (suporta MP4 nativamente). Vídeos de até <strong>{MAX_VIDEO_SIZE_GB}GB</strong> são suportados.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Video File */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Vídeo da Demonstração</Label>
                <Input
                  ref={videoFileRef}
                  type="file"
                  accept={VIDEO_FORMATS}
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  className="text-xs"
                  disabled={isVideoProcessing}
                />
                {videoFile && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileVideo className="h-3.5 w-3.5" />
                    {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)
                  </div>
                )}
              </div>

              {/* Closer */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Closer</Label>
                <Select value={closerUserId} onValueChange={setCloserUserId} disabled={isVideoProcessing}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione o Closer" />
                  </SelectTrigger>
                  <SelectContent>
                    {sdrs.map((u: { id: string; name: string }) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lead */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Lead / Oportunidade (opcional)</Label>
                <Input
                  placeholder="Buscar por nome ou empresa..."
                  value={videoLeadSearch}
                  onChange={(e) => {
                    setVideoLeadSearch(e.target.value);
                    setSelectedVideoLeadId('');
                  }}
                  className="h-9 text-xs"
                  disabled={isVideoProcessing}
                />
                {videoLeads.length > 0 && !selectedVideoLeadId && (
                  <div className="border rounded-md bg-background shadow-sm max-h-32 overflow-y-auto">
                    {videoLeads.map((l: { id: string; name: string; company: string }) => (
                      <button
                        key={l.id}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          setSelectedVideoLeadId(l.id);
                          setVideoLeadSearch(`${l.name} — ${l.company}`);
                        }}
                      >
                        <span className="font-medium">{l.name}</span>
                        <span className="text-muted-foreground"> — {l.company}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Video Upload Progress */}
            {isVideoProcessing && (
              <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  <span className="text-xs font-medium">Enviando vídeo...</span>
                </div>
              </div>
            )}

            <Button
              onClick={handleVideoSubmit}
              disabled={!videoFile || !closerUserId || isVideoProcessing}
              className="w-full md:w-auto"
            >
              {isVideoProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Video className="h-4 w-4 mr-2" />
                  Upload de Vídeo
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="ezcall" className="mt-0">
            <EZCallImportTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
