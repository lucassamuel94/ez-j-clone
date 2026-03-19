import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Play, Square, Loader2, CheckCircle2, AlertCircle, ListChecks, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const START_DATE = '2026-03-02';
const END_DATE = '2026-03-16';

function parseMMSS(value: string): number {
  const parts = value.split(':');
  const minutes = parseInt(parts[0] || '0', 10);
  const seconds = parseInt(parts[1] || '0', 10);
  return minutes * 60 + seconds;
}

interface QueueCounts {
  queued: number;
  processing: number;
  completed: number;
  error: number;
}

type Phase = 'idle' | 'scanning' | 'previewed' | 'confirming' | 'scanned' | 'dispatching' | 'done';

interface BulkCallAnalysisPanelProps {
  processingCount?: number;
  analyzingCount?: number;
}

export const BulkCallAnalysisPanel = ({ processingCount = 0, analyzingCount = 0 }: BulkCallAnalysisPanelProps) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [previewResult, setPreviewResult] = useState<{ found: number; newCount: number } | null>(null);
  const [counts, setCounts] = useState<QueueCounts>({ queued: 0, processing: 0, completed: 0, error: 0 });
  const [dispatched, setDispatched] = useState(0);
  const [dispatchErrors, setDispatchErrors] = useState(0);
  const stopRef = useRef(false);
  const [minDuration, setMinDuration] = useState('2:30');
  const [maxPerSdr, setMaxPerSdr] = useState('');
  const [allowReanalyze, setAllowReanalyze] = useState(false);

  const fetchCounts = useCallback(async (): Promise<QueueCounts> => {
    const [q, p, c, e] = await Promise.all([
      supabase.from('call_analyses').select('id', { count: 'exact', head: true }).eq('status', 'queued'),
      supabase.from('call_analyses').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('call_analyses').select('id', { count: 'exact', head: true }).eq('status', 'completed').eq('auto_generated', true),
      supabase.from('call_analyses').select('id', { count: 'exact', head: true }).eq('status', 'error').eq('auto_generated', true),
    ]);
    const result = {
      queued: q.count || 0,
      processing: p.count || 0,
      completed: c.count || 0,
      error: e.count || 0,
    };
    setCounts(result);
    return result;
  }, []);

  // Auto-load counts on mount and set phase accordingly
  useEffect(() => {
    fetchCounts().then((c) => {
      if (c.queued > 0) setPhase('scanned');
      else if (c.processing > 0) setPhase('done');
    });
  }, [fetchCounts]);

  const buildBody = useCallback(() => {
    const minSec = parseMMSS(minDuration);
    if (minSec < 1) return null;
    const body: Record<string, unknown> = {
      startDate: START_DATE,
      endDate: END_DATE,
      minDurationSeconds: minSec,
      allowReanalyze,
    };
    const maxVal = parseInt(maxPerSdr, 10);
    if (maxPerSdr && maxVal > 0) body.maxCallsPerSdr = maxVal;
    return body;
  }, [minDuration, maxPerSdr, allowReanalyze]);

  // Phase 1: dry-run scan (no inserts)
  const handleScan = useCallback(async () => {
    const body = buildBody();
    if (!body) { toast.error('Duração mínima inválida'); return; }

    setPhase('scanning');
    setPreviewResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-scan-calls', {
        body: { ...body, confirm: false },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setPreviewResult({ found: data.found, newCount: data.newCount });
      setPhase('previewed');
      toast.success(`Busca concluída: ${data.found} encontradas, ${data.newCount} novas`);
    } catch (err) {
      console.error('Scan error:', err);
      toast.error(`Erro no scan: ${(err as Error).message}`);
      setPhase('idle');
    }
  }, [buildBody]);

  // Phase 2: confirm and enqueue
  const handleConfirm = useCallback(async () => {
    const body = buildBody();
    if (!body) return;

    setPhase('confirming');
    try {
      const { data, error } = await supabase.functions.invoke('bulk-scan-calls', {
        body: { ...body, confirm: true },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      await fetchCounts();
      setPhase('scanned');
      toast.success(`${data.queued} chamadas enfileiradas para análise`);
    } catch (err) {
      console.error('Confirm error:', err);
      toast.error(`Erro ao enfileirar: ${(err as Error).message}`);
      setPhase('previewed');
    }
  }, [buildBody, fetchCounts]);

  const handleCancelPreview = useCallback(() => {
    setPreviewResult(null);
    setPhase('idle');
    toast.info('Busca cancelada. Nenhum registro foi criado.');
  }, []);

  // Phase 3: dispatch queue (1 at a time, returns fast)
  const handleDispatch = useCallback(async () => {
    setPhase('dispatching');
    stopRef.current = false;
    setDispatched(0);
    setDispatchErrors(0);

    const initial = await fetchCounts();
    if (initial.queued === 0) {
      toast.info('Nenhum item na fila para processar');
      setPhase('done');
      return;
    }

    let totalDispatched = 0;
    let totalErrors = 0;
    let consecutiveErrors = 0;

    while (!stopRef.current) {
      try {
        const { data, error } = await supabase.functions.invoke('bulk-process-queue', { body: {} });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        if (data.processed > 0) {
          totalDispatched += data.processed;
          setDispatched(totalDispatched);
          consecutiveErrors = 0;
        }

        if (data.errors > 0) {
          totalErrors += data.errors;
          setDispatchErrors(totalErrors);
        }

        // Refresh full counts to show processing/completed in real time
        const latest = await fetchCounts();

        if (latest.queued === 0) {
          setPhase('done');
          toast.success(`Despacho concluído! ${totalDispatched} chamadas enviadas para transcrição.`);
          break;
        }

        // Small delay between dispatches
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        consecutiveErrors++;
        totalErrors++;
        setDispatchErrors(totalErrors);
        console.error('Dispatch error:', err);

        if (consecutiveErrors >= 3) {
          toast.error('Muitos erros consecutivos. Processamento pausado.');
          setPhase('scanned');
          break;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    if (stopRef.current) {
      await fetchCounts();
      setPhase('scanned');
      toast.info('Processamento interrompido pelo usuário.');
    }
  }, [fetchCounts]);

  const handleStop = useCallback(() => {
    stopRef.current = true;
  }, []);

  const handleRefreshCounts = useCallback(async () => {
    const c = await fetchCounts();
    if (c.queued > 0) setPhase('scanned');
    else if (c.processing > 0) setPhase('done');
    toast.info(`Fila: ${c.queued} pendentes, ${c.processing} processando`);
  }, [fetchCounts]);

  const total = counts.queued + counts.processing + dispatched;
  const progressPct = total > 0 ? Math.round(((dispatched) / total) * 100) : 0;
  const isInputDisabled = phase === 'scanning' || phase === 'confirming' || phase === 'dispatching';

  return (
    <Card className="border border-border rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          Busca Massiva de Ligações
          <Badge variant="outline" className="text-xs ml-auto font-normal">
            {START_DATE} → {END_DATE}
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Busca chamadas no período e enfileira para análise automática por IA.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Duração mínima (mm:ss)</Label>
            <Input
              value={minDuration}
              onChange={(e) => setMinDuration(e.target.value)}
              placeholder="2:30"
              className="w-24 h-8 text-sm"
              disabled={isInputDisabled}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Máx. por SDR (vazio = todas)</Label>
            <Input
              value={maxPerSdr}
              onChange={(e) => setMaxPerSdr(e.target.value.replace(/\D/g, ''))}
              placeholder="Sem limite"
              className="w-32 h-8 text-sm"
              disabled={isInputDisabled}
            />
          </div>
          <div className="flex items-center gap-2 self-end pb-0.5">
            <Switch
              id="allow-reanalyze"
              checked={allowReanalyze}
              onCheckedChange={setAllowReanalyze}
              disabled={isInputDisabled}
            />
            <Label htmlFor="allow-reanalyze" className="text-xs text-muted-foreground cursor-pointer">
              Permitir reavaliar ligações já analisadas
            </Label>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          {(phase === 'idle' || phase === 'scanned' || phase === 'done') && (
            <Button
              onClick={handleScan}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Search className="h-4 w-4" />
              Buscar Ligações
            </Button>
          )}

          {phase === 'scanning' && (
            <Button disabled variant="outline" size="sm" className="gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando...
            </Button>
          )}

          {phase === 'previewed' && previewResult && (
            <>
              <Button onClick={handleConfirm} size="sm" className="gap-2">
                <ListChecks className="h-4 w-4" />
                Confirmar e Enfileirar ({previewResult.newCount})
              </Button>
              <Button onClick={handleCancelPreview} variant="ghost" size="sm" className="gap-2">
                <X className="h-4 w-4" />
                Cancelar
              </Button>
            </>
          )}

          {phase === 'confirming' && (
            <Button disabled size="sm" className="gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Enfileirando...
            </Button>
          )}

          {counts.queued > 0 && phase !== 'dispatching' && phase !== 'scanning' && phase !== 'confirming' && phase !== 'previewed' && (
            <Button onClick={handleDispatch} size="sm" className="gap-2">
              <Play className="h-4 w-4" />
              Despachar Fila ({counts.queued})
            </Button>
          )}

          {phase === 'dispatching' && (
            <Button onClick={handleStop} variant="destructive" size="sm" className="gap-2">
              <Square className="h-4 w-4" />
              Parar
            </Button>
          )}

          {(phase === 'idle' || phase === 'done') && (
            <Button onClick={handleRefreshCounts} variant="ghost" size="sm" className="text-xs gap-1">
              <RefreshCw className="h-3 w-3" />
              Atualizar contadores
            </Button>
          )}
        </div>

        {/* Preview result */}
        {phase === 'previewed' && previewResult && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{previewResult.found}</p>
              <p className="text-xs text-muted-foreground">Encontradas (total)</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
              <p className="text-2xl font-bold text-primary">{previewResult.newCount}</p>
              <p className="text-xs text-muted-foreground">Novas (não analisadas)</p>
            </div>
          </div>
        )}

        {/* Live counters */}
        {(phase === 'scanned' || phase === 'dispatching' || phase === 'done' ||
          counts.queued > 0 || counts.processing > 0 || dispatched > 0 || processingCount > 0 || analyzingCount > 0) && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
              <p className="text-2xl font-bold text-primary">{counts.queued}</p>
              <p className="text-xs text-muted-foreground">Na fila</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
              <p className="text-2xl font-bold text-success">{dispatched}</p>
              <p className="text-xs text-muted-foreground">Despachadas</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
              <p className="text-2xl font-bold text-warning">{counts.processing + processingCount}</p>
              <p className="text-xs text-muted-foreground">Transcrevendo</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
              <p className="text-2xl font-bold text-orange-400">{analyzingCount}</p>
              <p className="text-xs text-muted-foreground">Analisando IA</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
              <p className="text-2xl font-bold text-success">{counts.completed}</p>
              <p className="text-xs text-muted-foreground">Concluídas</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
              <p className="text-2xl font-bold text-destructive">{dispatchErrors + counts.error}</p>
              <p className="text-xs text-muted-foreground">Erros</p>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {phase === 'dispatching' && (
          <div className="space-y-1">
            <Progress value={progressPct} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">{progressPct}%</p>
          </div>
        )}

        {/* Done */}
        {phase === 'done' && counts.queued === 0 && (
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            {counts.processing > 0
              ? `Todas despachadas! ${counts.processing} ainda transcrevendo em background.`
              : 'Todas as chamadas foram processadas e enviadas para análise.'}
          </div>
        )}

        {dispatchErrors > 0 && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {dispatchErrors} erro(s) durante o despacho. Verifique os logs.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
