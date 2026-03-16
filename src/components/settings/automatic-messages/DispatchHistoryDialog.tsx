import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, CheckCircle, AlertTriangle, XCircle, SkipForward, Clock } from 'lucide-react';

interface DispatchLog {
  id: string;
  message_id: string | null;
  triggered_at: string;
  trigger_source: string;
  recipients_resolved: Array<{ name: string; channel: string }>;
  recipients_ignored: Array<{ name: string; reason: string }>;
  channel: string;
  status: string;
  error_reason: string | null;
  ai_used: boolean;
  ai_response_time_ms: number | null;
  message_body: string | null;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  sent: { icon: <CheckCircle className="h-3 w-3" />, label: 'Enviado', color: 'bg-success/10 text-success' },
  partial: { icon: <AlertTriangle className="h-3 w-3" />, label: 'Parcial', color: 'bg-warning/10 text-warning' },
  failed: { icon: <XCircle className="h-3 w-3" />, label: 'Falhou', color: 'bg-destructive/10 text-destructive' },
  skipped: { icon: <SkipForward className="h-3 w-3" />, label: 'Ignorado', color: 'bg-muted text-muted-foreground' },
  pending: { icon: <Clock className="h-3 w-3" />, label: 'Pendente', color: 'bg-info/10 text-info' },
};

const SOURCE_LABELS: Record<string, string> = {
  cron: 'Agendamento',
  event: 'Evento',
  manual_test: 'Teste manual',
};

interface DispatchHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId?: string;
  messageName?: string;
}

export function DispatchHistoryDialog({ open, onOpenChange, messageId, messageName }: DispatchHistoryDialogProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<DispatchLog | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['dispatch-logs', messageId],
    queryFn: async () => {
      let query = supabase
        .from('message_dispatch_logs')
        .select('*')
        .order('triggered_at', { ascending: false })
        .limit(100);

      if (messageId) {
        query = query.eq('message_id', messageId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as DispatchLog[];
    },
    enabled: open,
  });

  const filtered = logs.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (l.error_reason || '').toLowerCase().includes(s) ||
        l.trigger_source.toLowerCase().includes(s) ||
        (l.message_body || '').toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Histórico de Disparos</DialogTitle>
            <DialogDescription>
              {messageName ? `Logs da mensagem "${messageName}"` : 'Todos os disparos registrados'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="partial">Parcial</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="skipped">Ignorado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">Nenhum log encontrado.</p>
            ) : (
              filtered.map((log) => {
                const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
                const resolved = Array.isArray(log.recipients_resolved) ? log.recipients_resolved : [];
                const ignored = Array.isArray(log.recipients_ignored) ? log.recipients_ignored : [];

                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="border border-border rounded-lg p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={cn('text-[10px] gap-1 px-1.5 py-0', cfg.color)}>
                          {cfg.icon} {cfg.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {SOURCE_LABELS[log.trigger_source] || log.trigger_source}
                        </span>
                        {log.ai_used && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-warning/10 text-warning">
                            IA {log.ai_response_time_ms ? `(${log.ai_response_time_ms}ms)` : ''}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(log.triggered_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      {resolved.length > 0 && (
                        <span className="text-success">
                          ✓ {resolved.length} enviado(s)
                        </span>
                      )}
                      {ignored.length > 0 && (
                        <span className="text-warning">
                          ⚠ {ignored.length} ignorado(s)
                        </span>
                      )}
                      {log.error_reason && (
                        <span className="text-destructive truncate max-w-[300px]">
                          {log.error_reason}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhe do Disparo</DialogTitle>
            <DialogDescription>
              {selectedLog && format(new Date(selectedLog.triggered_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-muted-foreground">Status</span>
                  <div className="mt-1">
                    <Badge variant="secondary" className={cn('text-xs gap-1', (STATUS_CONFIG[selectedLog.status] || STATUS_CONFIG.pending).color)}>
                      {(STATUS_CONFIG[selectedLog.status] || STATUS_CONFIG.pending).icon}
                      {(STATUS_CONFIG[selectedLog.status] || STATUS_CONFIG.pending).label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Fonte</span>
                  <p className="mt-1 text-foreground">{SOURCE_LABELS[selectedLog.trigger_source] || selectedLog.trigger_source}</p>
                </div>
              </div>

              {Array.isArray(selectedLog.recipients_resolved) && selectedLog.recipients_resolved.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Enviado para</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedLog.recipients_resolved.map((r, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {r.name} ({r.channel})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(selectedLog.recipients_ignored) && selectedLog.recipients_ignored.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Ignorados</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedLog.recipients_ignored.map((r, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] text-warning">
                        {r.name}: {r.reason}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedLog.error_reason && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Erro</span>
                  <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded p-2">
                    {selectedLog.error_reason}
                  </p>
                </div>
              )}

              {selectedLog.message_body && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Conteúdo enviado</span>
                  <div className="bg-muted/40 border border-border rounded-lg p-3 max-h-48 overflow-y-auto">
                    <p className="text-xs text-foreground whitespace-pre-wrap">{selectedLog.message_body}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
