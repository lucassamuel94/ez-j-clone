import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Phone, PhoneCall, PhoneOff, Clock, Play, Pause,
  ChevronDown, ChevronRight, Loader2, Info,
  SkipBack, SkipForward, ArrowUpDown, ArrowUp, ArrowDown, BrainCircuit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEZCallReports, useEZCallRecordingUrl, type EZCallSDRReport, type EZCallRecord } from '@/hooks/useEZCallReports';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SDRCallsSectionProps {
  dateRange: { start: string; end: string };
  selectedSdrId?: string;
}

const fmt = (n: number) => n.toLocaleString('pt-BR');

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const DISPOSITION_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'ANSWERED', label: 'Atendida' },
  { value: 'NO ANSWER', label: 'Sem resposta' },
  { value: 'BUSY', label: 'Ocupado' },
  { value: 'FAILED', label: 'Falhou' },
] as const;

function dispositionLabel(d: string): string {
  const found = DISPOSITION_OPTIONS.find((o) => o.value === d);
  return found ? found.label : d;
}

/* ─── KPI Card ─── */
function CallKPICard({ icon: Icon, label, value, subtitle, className }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtitle?: string;
  className?: string;
}) {
  return (
    <Card className={cn('flex-1 min-w-[140px]', className)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

/* ─── Daily credit check helper ─── */
const MAX_DAILY_ANALYSES = 5;

async function getDailyAnalysisCount(sdrUserId: string): Promise<number> {
  // "Today" in São Paulo timezone
  const now = new Date();
  const spFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const todayStr = spFormatter.format(now); // YYYY-MM-DD
  const startOfDay = new Date(`${todayStr}T00:00:00-03:00`).toISOString();

  const { count, error } = await supabase
    .from('call_analyses' as any)
    .select('*', { count: 'exact', head: true })
    .eq('sdr_user_id', sdrUserId)
    .gte('created_at', startOfDay) as { count: number | null; error: unknown };

  if (error) {
    console.error('Credit check error:', error);
    return 0;
  }
  return count ?? 0;
}

/* ─── Send to Call Intelligence ─── */
const SendToAIButton = memo(function SendToAIButton({ linkedid, sdrUserId, callDate }: { linkedid: string; sdrUserId: string; callDate: string }) {
  const { playRecording } = useEZCallRecordingUrl();
  const [sending, setSending] = useState(false);
  const [creditsUsed, setCreditsUsed] = useState<number | null>(null);

  // Load credits on mount
  useEffect(() => {
    getDailyAnalysisCount(sdrUserId).then(setCreditsUsed);
  }, [sdrUserId]);

  const remaining = creditsUsed !== null ? Math.max(0, MAX_DAILY_ANALYSES - creditsUsed) : null;
  const isLimitReached = remaining !== null && remaining <= 0;

  const handleSend = useCallback(async () => {
    setSending(true);
    try {
      // Re-check limit in real time
      const used = await getDailyAnalysisCount(sdrUserId);
      if (used >= MAX_DAILY_ANALYSES) {
        setCreditsUsed(used);
        toast.error(`Limite diário de ${MAX_DAILY_ANALYSES} análises atingido. Tente novamente amanhã.`);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Fetch audio blob from EZCall
      const url = await playRecording(linkedid);
      const resp = await fetch(url);
      const blob = await resp.blob();

      // Upload to storage
      const path = `${user.id}/ezcall_${linkedid}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from('call-recordings')
        .upload(path, blob, { contentType: 'audio/mpeg', upsert: true });
      if (uploadError) {
        console.error('[CallAI] Storage upload error:', uploadError);
        throw uploadError;
      }

      // Create call_analyses record with status 'processing'
      const { data: insertedData, error: insertError } = await (supabase
        .from('call_analyses' as any)
        .insert({
          uploaded_by: user.id,
          sdr_user_id: sdrUserId,
          audio_path: path,
          original_filename: `EZCall_${linkedid}_${callDate}.mp3`,
          status: 'processing',
        } as any)
        .select('id')
        .single() as any);
      if (insertError) {
        console.error('[CallAI] Insert error:', insertError);
        throw insertError;
      }

      // Auto-start transcription (which chains into analyze-call)
      const analysisId = (insertedData as { id: string }).id;
      supabase.functions.invoke('transcribe-call', {
        body: { analysis_id: analysisId, audio_path: path },
      }).catch((err: unknown) => console.error('Auto-transcribe invoke error:', err));

      setCreditsUsed((prev) => (prev ?? 0) + 1);
      toast.success('Gravação enviada! Quando a análise estiver pronta, você receberá um e-mail com o relatório completo.', { duration: 6000 });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('[CallAI] FAILED:', errMsg, err);
      toast.error(`Erro ao enviar gravação: ${errMsg}`);
    } finally {
      setSending(false);
    }
  }, [linkedid, sdrUserId, callDate, playRecording]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 shrink-0"
          onClick={handleSend}
          disabled={sending || isLimitReached}
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <BrainCircuit className={cn(
              "h-3.5 w-3.5 transition-colors",
              isLimitReached ? "text-muted-foreground/30" : "text-muted-foreground hover:text-primary"
            )} />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">
          {isLimitReached
            ? 'Limite diário atingido (5/5)'
            : `Enviar para IA (${creditsUsed ?? '…'}/${MAX_DAILY_ANALYSES} hoje)`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
});

/* ─── Inline Audio Player with timeline + speed ─── */
const InlineAudioPlayer = memo(function InlineAudioPlayer({ linkedid, sdrUserId, callDate }: { linkedid: string; sdrUserId: string; callDate: string }) {
  const { playRecording } = useEZCallRecordingUrl();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  const loadAudio = useCallback(async () => {
    if (audioRef.current) return;
    setLoading(true);
    try {
      const url = await playRecording(linkedid);
      const audio = new Audio(url);
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
        setReady(true);
      };
      audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
      audio.onended = () => setPlaying(false);
      audio.onpause = () => setPlaying(false);
      audio.onplay = () => setPlaying(true);
      audioRef.current = audio;
    } catch {
      console.error('Failed to load recording');
    } finally {
      setLoading(false);
    }
  }, [linkedid, playRecording]);

  const togglePlay = useCallback(async () => {
    if (!audioRef.current) {
      await loadAudio();
      setTimeout(() => audioRef.current?.play(), 100);
      return;
    }
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [playing, loadAudio]);

  const skip = useCallback((delta: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.duration, audioRef.current.currentTime + delta));
  }, []);

  const handleSeek = useCallback((vals: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = vals[0];
    setCurrentTime(vals[0]);
  }, []);

  const handleSpeedChange = useCallback((v: string) => {
    const rate = parseFloat(v);
    setSpeed(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex items-center gap-2 min-w-[320px]" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 shrink-0"
        onClick={togglePlay}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : playing ? (
          <Pause className="h-3.5 w-3.5 text-primary" />
        ) : (
          <Play className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </Button>

      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => skip(-10)} disabled={!ready}>
        <SkipBack className="h-3 w-3 text-muted-foreground" />
      </Button>

      <div className="flex-1 flex items-center gap-1.5 min-w-0">
        <span className="text-[10px] tabular-nums text-muted-foreground w-[32px] text-right shrink-0">
          {formatSeconds(currentTime)}
        </span>
        <Slider
          value={[currentTime]}
          max={duration || 1}
          step={0.5}
          onValueChange={handleSeek}
          className="flex-1"
          disabled={!ready}
        />
        <span className="text-[10px] tabular-nums text-muted-foreground w-[32px] shrink-0">
          {duration > 0 ? formatSeconds(duration) : '--:--'}
        </span>
      </div>

      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => skip(10)} disabled={!ready}>
        <SkipForward className="h-3 w-3 text-muted-foreground" />
      </Button>

      <Select value={String(speed)} onValueChange={handleSpeedChange}>
        <SelectTrigger className="h-6 w-[52px] text-[10px] px-1.5 font-medium border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
            <SelectItem key={r} value={String(r)} className="text-xs">
              {r}x
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Send to Call Intelligence */}
      <SendToAIButton linkedid={linkedid} sdrUserId={sdrUserId} callDate={callDate} />
    </div>
  );
});

/* ─── Call Row ─── */
const CallRow = memo(function CallRow({ call, sdrUserId }: { call: EZCallRecord; sdrUserId: string }) {
  const isAnswered = call.disposition === 'ANSWERED';
  return (
    <tr className="text-xs border-b last:border-b-0 hover:bg-muted/20 transition-colors">
      <td className="px-3 py-2 tabular-nums text-muted-foreground">{call.calldate}</td>
      <td className="px-3 py-2 tabular-nums font-medium">{call.dst}</td>
      <td className="px-3 py-2">
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] font-medium',
            isAnswered
              ? 'border-success/30 bg-success/10 text-success dark:text-success'
              : 'border-destructive/30 bg-destructive/10 text-destructive',
          )}
        >
          {dispositionLabel(call.disposition)}
        </Badge>
      </td>
      <td className="px-3 py-2 tabular-nums text-muted-foreground">{formatSeconds(call.duration)}</td>
      <td className="px-3 py-2 tabular-nums text-muted-foreground">{isAnswered ? formatSeconds(call.billsec) : '—'}</td>
      <td className="px-3 py-2">
        {isAnswered ? (
          <InlineAudioPlayer linkedid={call.linkedid} sdrUserId={sdrUserId} callDate={call.calldate} />
        ) : (
          <span className="text-muted-foreground/40 text-[10px]">—</span>
        )}
      </td>
    </tr>
  );
});

/* ─── Sort helpers ─── */
type SortKey = 'calldate' | 'dst' | 'disposition' | 'duration' | 'billsec';
type SortDir = 'asc' | 'desc';

function SortableHeader({ label, sortKey, current, dir, onSort, className }: {
  label: string;
  sortKey: SortKey;
  current: SortKey | null;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = current === sortKey;
  return (
    <th
      className={cn(
        'text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground text-[10px] cursor-pointer select-none hover:text-foreground transition-colors',
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      <div className="inline-flex items-center gap-1">
        {label}
        {active ? (
          dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />
        )}
      </div>
    </th>
  );
}

/* ─── SDR Expandable Row ─── */
function SDRCallRow({ report }: { report: EZCallSDRReport }) {
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ANSWERED');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir('desc');
      return key;
    });
  }, []);

  const sortedCalls = useMemo(() => {
    let calls = statusFilter === 'all'
      ? report.calls
      : report.calls.filter((c) => c.disposition === statusFilter);

    if (!sortKey) return calls;

    const copy = [...calls];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'calldate': cmp = a.calldate.localeCompare(b.calldate); break;
        case 'dst': cmp = a.dst.localeCompare(b.dst); break;
        case 'disposition': cmp = a.disposition.localeCompare(b.disposition); break;
        case 'duration': cmp = a.duration - b.duration; break;
        case 'billsec': cmp = a.billsec - b.billsec; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [report.calls, statusFilter, sortKey, sortDir]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-toggle]')) return;
    setOpen((v) => !v);
  }, []);

  return (
    <>
      <tr
        className="hover:bg-muted/30 transition-colors cursor-pointer border-b"
        onClick={handleToggle}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="font-medium text-foreground text-xs">{report.name}</span>
          </div>
        </td>
        <td className="px-3 py-2.5 text-center text-xs tabular-nums text-muted-foreground">{report.extension}</td>
        <td className="px-3 py-2.5 text-center text-xs tabular-nums font-semibold">{fmt(report.totalCalls)}</td>
        <td className="px-3 py-2.5 text-center text-xs tabular-nums font-semibold text-success dark:text-success">{fmt(report.answeredCalls)}</td>
        <td className="px-3 py-2.5 text-center text-xs tabular-nums">{report.answerRate}%</td>
        <td className="px-3 py-2.5 text-center text-xs tabular-nums">{formatSeconds(report.avgTalkTime)}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="p-0">
            <div className="bg-muted/10 border-t">
              {/* Sub-header with status filter */}
              <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {sortedCalls.length} ligação(ões)
                </span>
                <div className="flex items-center gap-1.5" data-no-toggle onClick={(e) => e.stopPropagation()}>
                  <span className="text-[10px] text-muted-foreground">Status:</span>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-6 w-[120px] text-[10px] px-2 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISPOSITION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <SortableHeader label="Data/Hora" sortKey="calldate" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Destino" sortKey="dst" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Status" sortKey="disposition" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Duração" sortKey="duration" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Conversação" sortKey="billsec" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground text-[10px] min-w-[300px]">Gravação</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCalls.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-muted-foreground">Nenhuma ligação encontrada</td>
                    </tr>
                  ) : (
                    sortedCalls.map((call) => (
                      <CallRow key={call.linkedid} call={call} sdrUserId={report.userId} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
/* ─── Main Section ─── */
export function SDRCallsSection({ dateRange, selectedSdrId }: SDRCallsSectionProps) {
  const { data: reports = [], isLoading } = useEZCallReports({ dateRange, selectedSdrId });

  const totals = useMemo(() => {
    const totalCalls = reports.reduce((s, r) => s + r.totalCalls, 0);
    const totalAnswered = reports.reduce((s, r) => s + r.answeredCalls, 0);
    const answerRate = totalCalls > 0 ? Math.round((totalAnswered / totalCalls) * 100) : 0;
    const avgTalkTime = totalAnswered > 0
      ? Math.round(reports.reduce((s, r) => s + r.avgTalkTime * r.answeredCalls, 0) / totalAnswered)
      : 0;
    return { totalCalls, totalAnswered, answerRate, avgTalkTime };
  }, [reports]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <div className="flex gap-3 flex-wrap">
          <CallKPICard icon={Phone} label="Tentativas" value={isLoading ? '…' : fmt(totals.totalCalls)} />
          <CallKPICard icon={PhoneCall} label="Atendidas" value={isLoading ? '…' : fmt(totals.totalAnswered)} />
          <CallKPICard icon={PhoneOff} label="Taxa Atend." value={isLoading ? '…' : `${totals.answerRate}%`} />
          <CallKPICard icon={Clock} label="TMA" value={isLoading ? '…' : formatSeconds(totals.avgTalkTime)} subtitle="Tempo médio de atendimento" />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ligações por SDR</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Dados do PABX EZCall. Clique em um SDR para ver as chamadas individuais.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[120px] text-center">
                <Phone className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">
                  Nenhum dado de ligação encontrado. Verifique se os SDRs possuem ramal configurado.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">SDR</th>
                      <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">Ramal</th>
                      <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">Tentativas</th>
                      <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">Atendidas</th>
                      <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dashed border-muted-foreground/40">Taxa (%)</span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom"><p className="text-xs">Taxa de conversão: Atendidas ÷ Tentativas × 100</p></TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dashed border-muted-foreground/40">TMA</span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom"><p className="text-xs">Tempo médio de atendimento</p></TooltipContent>
                        </Tooltip>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                  {[...reports].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((report) => (
                      <SDRCallRow key={report.userId} report={report} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
