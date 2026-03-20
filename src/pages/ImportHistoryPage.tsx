import { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TableProvider,
  TableHeader,
  TableHeaderGroup,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableColumnHeader,
  type ColumnDef,
} from '@/components/kibo-ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileSpreadsheet,
  Loader2,
  FileDown,
  Copy,
  AlertOctagon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportJob {
  id: string;
  file_name: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  success_count: number;
  error_count: number;
  duplicate_count: number;
  created_at: string;
  allocation_type: string;
  import_status: string;
  error_message: string | null;
  error_details: any[] | null;
  duplicate_details: any[] | null;
}

const DEFAULT_PAGE_SIZE = 20;

const getAllocationLabel = (type: string) => {
  const map: Record<string, string> = {
    importer: 'Importador',
    specific: 'SDR Específico',
    distribute: 'Distribuir SDRs',
    specific_closer: 'Closer Específico',
    distribute_closers: 'Distribuir Closers',
  };
  return map[type] || type;
};

export default function ImportHistoryPage() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedJob, setSelectedJob] = useState<ImportJob | null>(null);

  const totalPages = Math.ceil(totalCount / pageSize);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { count } = await supabase.from('import_jobs').select('*', { count: 'exact', head: true }) as any;
    const { data } = await supabase.from('import_jobs').select('*').order('created_at', { ascending: false }).range(from, to) as any;
    if (data) setJobs(data);
    if (count != null) setTotalCount(count);
    setIsLoading(false);
  }, [page, pageSize]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleDownloadReport = (job: ImportJob, type: 'all' | 'errors' | 'duplicates') => {
    const rows: Array<Record<string, string>> = [];
    const errorDetails: any[] = job.error_details || [];
    const duplicateDetails: any[] = job.duplicate_details || [];
    if (type === 'errors' || type === 'all') {
      errorDetails.forEach((err: any) => {
        rows.push({ 'Status': 'Erro', 'Linha': String(err.row_number || ''), 'Nome': err.name || '', 'Email': err.email || '', 'CNPJ': err.cnpj || '', 'Motivo': err.reason || '' });
      });
    }
    if (type === 'duplicates' || type === 'all') {
      duplicateDetails.forEach((dup: any) => {
        rows.push({ 'Status': 'Duplicado', 'Linha': String(dup.row_number || ''), 'Nome': dup.name || '', 'Email': dup.email || '', 'CNPJ': dup.cnpj || '', 'Motivo': 'ClickUp ID já existente' });
      });
    }
    if (rows.length === 0) { toast.info('Sem registros para exportar nesta categoria'); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type === 'all' ? 'Relatório' : type === 'errors' ? 'Erros' : 'Duplicados');
    XLSX.writeFile(wb, `relatorio-${type === 'all' ? 'completo' : type}-${job.file_name || 'importacao'}.xlsx`);
    toast.success('Relatório baixado com sucesso');
  };

  const columns = useMemo<ColumnDef<ImportJob>[]>(() => [
    {
      accessorKey: 'file_name',
      header: ({ column }) => <TableColumnHeader column={column} title="Arquivo" />,
      cell: ({ row }) => <span className="font-medium max-w-[200px] truncate block">{row.original.file_name}</span>,
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => <TableColumnHeader column={column} title="Data" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.created_at ? new Date(row.original.created_at).toLocaleString('pt-BR') : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <TableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const job = row.original;
        const hasSuccess = job.success_count > 0;
        const hasErrors = job.error_count > 0 || job.duplicate_count > 0;
        const notFullyProcessed = job.processed_rows < job.total_rows;
        let label = 'Pendente';
        let colorClass = 'bg-muted text-muted-foreground border-border';
        if (job.status === 'processing') {
          label = 'Processando';
            colorClass = 'bg-info/10 text-info border-info/20';
          } else if (job.status === 'completed' || job.status === 'failed') {
            if (hasSuccess && (hasErrors || notFullyProcessed)) {
              label = 'Concluído com erros';
              colorClass = 'bg-warning/10 text-warning border-warning/20';
            } else if (hasSuccess && !hasErrors) {
              label = 'Concluído';
              colorClass = 'bg-success/10 text-success border-success/20';
            } else {
              label = 'Falhou';
              colorClass = 'bg-destructive/10 text-destructive border-destructive/20';
            }
        }
        return <Badge variant="outline" className={cn("font-medium border", colorClass)}>{label}</Badge>;
      },
    },
    {
      accessorKey: 'total_rows',
      header: ({ column }) => <TableColumnHeader column={column} title="Total" />,
      cell: ({ row }) => <span className="text-right tabular-nums block">{row.original.total_rows.toLocaleString('pt-BR')}</span>,
    },
    {
      accessorKey: 'processed_rows',
      header: ({ column }) => <TableColumnHeader column={column} title="Processados" />,
      cell: ({ row }) => <span className="text-right tabular-nums block">{row.original.processed_rows.toLocaleString('pt-BR')}</span>,
    },
    {
      accessorKey: 'success_count',
      header: ({ column }) => <TableColumnHeader column={column} title="Sucesso" />,
      cell: ({ row }) => <span className="text-right tabular-nums font-medium text-success block">{row.original.success_count.toLocaleString('pt-BR')}</span>,
    },
    {
      accessorKey: 'duplicate_count',
      header: ({ column }) => <TableColumnHeader column={column} title="Duplicados" />,
      cell: ({ row }) => <span className="text-right tabular-nums font-medium text-warning block">{row.original.duplicate_count.toLocaleString('pt-BR')}</span>,
    },
    {
      accessorKey: 'error_count',
      header: ({ column }) => <TableColumnHeader column={column} title="Erros" />,
      cell: ({ row }) => <span className="text-right tabular-nums font-medium text-destructive block">{row.original.error_count}</span>,
    },
  ], []);

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader icon={<FileSpreadsheet className="h-5 w-5" />} title="Histórico de Importações" count={totalCount} />
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-16">
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma importação realizada ainda.</p>
              </div>
            ) : (
              <>
                <TableProvider columns={columns} data={jobs}>
                  <TableHeader>
                    {({ headerGroup }) => (
                      <TableHeaderGroup headerGroup={headerGroup}>
                        {({ header }) => <TableHead header={header} />}
                      </TableHeaderGroup>
                    )}
                  </TableHeader>
                  <TableBody>
                    {({ row }) => (
                      <TableRow
                        key={row.id}
                        row={row}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedJob(row.original as ImportJob)}
                      >
                        {({ cell }) => <TableCell cell={cell} />}
                      </TableRow>
                    )}
                  </TableBody>
                </TableProvider>

                {totalCount > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-muted-foreground">
                        Mostrando {Math.min(page * pageSize + 1, totalCount)}–{Math.min((page + 1) * pageSize, totalCount)} de {totalCount}
                      </p>
                      <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
                        <SelectTrigger className="h-7 w-[72px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">por página</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 0} onClick={() => setPage(p => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs font-medium px-2">{page + 1} / {totalPages}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog - kept as-is */}
      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Detalhes da Importação
            </DialogTitle>
            <DialogDescription>{selectedJob?.file_name}</DialogDescription>
          </DialogHeader>

          {selectedJob && (() => {
            const totalRows = selectedJob.total_rows || 0;
            const processedRows = selectedJob.processed_rows || 0;
            const notProcessed = totalRows - processedRows;
            const hasSuccess = selectedJob.success_count > 0;
            const hasErrors = selectedJob.error_count > 0 || selectedJob.duplicate_count > 0;
            const notFullyProcessed = processedRows < totalRows;
            let statusLabel = 'Pendente'; let statusColor = 'text-warning';
            if (selectedJob.status === 'processing') { statusLabel = 'Processando...'; statusColor = 'text-info'; }
            else if (selectedJob.status === 'completed' || selectedJob.status === 'failed') {
              if (hasSuccess && (hasErrors || notFullyProcessed)) { statusLabel = 'Concluído com erros'; statusColor = 'text-warning'; }
              else if (hasSuccess && !hasErrors) { statusLabel = 'Concluído'; statusColor = 'text-success'; }
              else { statusLabel = 'Falhou'; statusColor = 'text-destructive'; }
            }
            const createdAt = selectedJob.created_at ? new Date(selectedJob.created_at).toLocaleString('pt-BR') : '—';
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className={`font-semibold ${statusColor}`}>{statusLabel}</span>
                  <span className="text-muted-foreground">{createdAt}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold text-foreground">{totalRows.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-muted-foreground">Total no Arquivo</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold text-foreground">{processedRows.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-muted-foreground">Processados</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-success/5">
                    <p className="text-xl font-bold text-success">{selectedJob.success_count.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-muted-foreground">Sucesso</p>
                  </div>
                  <div className="p-3 rounded-lg bg-warning/5">
                    <p className="text-xl font-bold text-warning">{selectedJob.duplicate_count.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-muted-foreground">Duplicados</p>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/5">
                    <p className="text-xl font-bold text-destructive">{selectedJob.error_count.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-muted-foreground">Erros</p>
                  </div>
                </div>
                {notProcessed > 0 && (
                  <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                    <div className="flex items-center gap-2">
                      <AlertOctagon className="h-4 w-4 text-warning shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-warning">{notProcessed.toLocaleString('pt-BR')} leads não processados</p>
                        <p className="text-xs text-warning/70">Importação interrompida por timeout. Re-importe o arquivo para processar os restantes.</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs border-t pt-3">
                  <span className="text-muted-foreground">Alocação</span>
                  <span className="font-medium text-foreground text-right">{getAllocationLabel(selectedJob.allocation_type)}</span>
                  <span className="text-muted-foreground">Status Inicial</span>
                  <span className="font-medium text-foreground text-right">{selectedJob.import_status}</span>
                  {selectedJob.error_message && (
                    <>
                      <span className="text-muted-foreground">Motivo da falha</span>
                      <span className="font-medium text-destructive text-right">{selectedJob.error_message}</span>
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Downloads</p>
                  {(selectedJob.error_count > 0 || selectedJob.duplicate_count > 0) && (
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={() => handleDownloadReport(selectedJob, 'all')}>
                      <FileDown className="h-4 w-4 text-primary" /> Relatório Completo (Erros + Duplicados)
                    </Button>
                  )}
                  {selectedJob.duplicate_count > 0 && (
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={() => handleDownloadReport(selectedJob, 'duplicates')}>
                      <Copy className="h-4 w-4 text-warning" /> Apenas Duplicados ({selectedJob.duplicate_count.toLocaleString('pt-BR')})
                    </Button>
                  )}
                  {selectedJob.error_count > 0 && (
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={() => handleDownloadReport(selectedJob, 'errors')}>
                      <AlertOctagon className="h-4 w-4 text-destructive" /> Apenas Erros ({selectedJob.error_count})
                    </Button>
                  )}
                  {selectedJob.error_count === 0 && selectedJob.duplicate_count === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Importação perfeita — sem erros ou duplicados para baixar.</p>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
