import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, Loader2, Phone } from 'lucide-react';
import { useEZCallReports, useEZCallRecordingUrl, type EZCallRecord } from '@/hooks/useEZCallReports';
import { useSystemUsers } from '@/hooks/useSystemUsers';
import { useUploadCallAnalysis } from '@/hooks/useCallAnalyses';
import { formatDateTimeBR } from '@/utils/dateFormat';
import { toast } from 'sonner';

const today = new Date().toISOString().split('T')[0];
const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

export const EZCallImportTab = () => {
  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [selectedSdrId, setSelectedSdrId] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const { data: sdrs = [] } = useSystemUsers();
  const { playRecording } = useEZCallRecordingUrl();
  const upload = useUploadCallAnalysis();

  const dateRange = useMemo(() => ({
    start: `${startDate}T00:00:00`,
    end: `${endDate}T23:59:59`,
  }), [startDate, endDate]);

  const { data: reports = [], isLoading, refetch } = useEZCallReports({
    dateRange,
    selectedSdrId: selectedSdrId || undefined,
  });

  // Flatten all calls from all SDR reports, filter only answered with billsec > 10
  const allCalls = useMemo(() => {
    const calls: Array<EZCallRecord & { sdrName: string; sdrUserId: string }> = [];
    for (const report of reports) {
      for (const call of report.calls) {
        if (call.disposition === 'ANSWERED' && call.billsec > 10) {
          calls.push({ ...call, sdrName: report.name, sdrUserId: report.userId });
        }
      }
    }
    return calls.sort((a, b) => b.calldate.localeCompare(a.calldate));
  }, [reports]);

  const handleSearch = useCallback(() => {
    if (!selectedSdrId) {
      toast.error('Selecione um SDR');
      return;
    }
    setSearchEnabled(true);
    setSelectedIds(new Set());
    refetch();
  }, [selectedSdrId, refetch]);

  const toggleSelect = useCallback((linkedid: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(linkedid)) next.delete(linkedid);
      else next.add(linkedid);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === allCalls.length
        ? new Set()
        : new Set(allCalls.map(c => c.linkedid))
    );
  }, [allCalls]);

  const handleImport = useCallback(async () => {
    const selected = allCalls.filter(c => selectedIds.has(c.linkedid));
    if (selected.length === 0) return;

    setImporting(true);
    setImportProgress({ current: 0, total: selected.length });
    let successCount = 0;

    for (let i = 0; i < selected.length; i++) {
      const call = selected[i];
      setImportProgress({ current: i + 1, total: selected.length });

      try {
        // Download audio blob via edge function
        const blobUrl = await playRecording(call.linkedid);
        const res = await fetch(blobUrl);
        const blob = await res.blob();
        URL.revokeObjectURL(blobUrl);

        const file = new File([blob], `ezcall_${call.linkedid}.mp3`, { type: 'audio/mpeg' });

        // Upload using existing mutation (promisified)
        await new Promise<void>((resolve, reject) => {
          upload.mutate(
            { file, sdr_user_id: call.sdrUserId },
            {
              onSuccess: () => { successCount++; resolve(); },
              onError: (err) => reject(err),
            }
          );
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error(`Falha ao importar ${call.linkedid}:`, msg);
      }
    }

    setImporting(false);
    setSelectedIds(new Set());
    if (successCount > 0) {
      toast.success(`${successCount} de ${selected.length} ligações importadas com sucesso!`);
    } else {
      toast.error('Nenhuma ligação foi importada.');
    }
  }, [allCalls, selectedIds, playRecording, upload]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Data Início</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 text-xs"
            disabled={importing}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Data Fim</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 text-xs"
            disabled={importing}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">SDR</Label>
          <Select value={selectedSdrId} onValueChange={setSelectedSdrId} disabled={importing}>
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
        <Button onClick={handleSearch} disabled={!selectedSdrId || isLoading || importing} className="h-9">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
          Buscar Ligações
        </Button>
      </div>

      {/* Import progress */}
      {importing && (
        <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs font-medium">
              Importando {importProgress.current} de {importProgress.total}...
            </span>
          </div>
          <Progress value={(importProgress.current / importProgress.total) * 100} className="h-2" />
        </div>
      )}

      {/* Results table */}
      {searchEnabled && !isLoading && allCalls.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {allCalls.length} ligações atendidas encontradas (≥10s)
            </p>
            <Button
              onClick={handleImport}
              disabled={selectedIds.size === 0 || importing}
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Importar {selectedIds.size} selecionada{selectedIds.size !== 1 ? 's' : ''}
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.size === allCalls.length && allCalls.length > 0}
                      onCheckedChange={toggleAll}
                      disabled={importing}
                    />
                  </TableHead>
                  <TableHead className="text-xs">Data/Hora</TableHead>
                  {!selectedSdrId && <TableHead className="text-xs">SDR</TableHead>}
                  <TableHead className="text-xs">Destino</TableHead>
                  <TableHead className="text-xs">Duração</TableHead>
                  <TableHead className="text-xs">Tempo Falado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allCalls.map((call) => (
                  <TableRow key={call.linkedid}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(call.linkedid)}
                        onCheckedChange={() => toggleSelect(call.linkedid)}
                        disabled={importing}
                      />
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDateTimeBR(call.calldate)}
                    </TableCell>
                    {!selectedSdrId && (
                      <TableCell className="text-xs font-medium">{call.sdrName}</TableCell>
                    )}
                    <TableCell className="text-xs font-mono">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {call.dst}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{formatDuration(call.duration)}</TableCell>
                    <TableCell className="text-xs">{formatDuration(call.billsec)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {searchEnabled && !isLoading && allCalls.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhuma ligação atendida encontrada no período selecionado.
        </div>
      )}
    </div>
  );
};
