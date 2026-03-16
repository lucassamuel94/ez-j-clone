import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  CheckCircle2, AlertTriangle, XCircle, MinusCircle, Clock,
  RefreshCw, Sparkles, ChevronRight, Users, UserX,
} from 'lucide-react';

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

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; dotClass: string; badgeClass: string }> = {
  sent: {
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: 'Enviado',
    dotClass: 'bg-success',
    badgeClass: 'border-success/20 bg-success/8 text-success dark:bg-success/10',
  },
  partial: {
    icon: <AlertTriangle className="h-3 w-3" />,
    label: 'Parcial',
    dotClass: 'bg-warning',
    badgeClass: 'border-warning/20 bg-warning/8 text-warning dark:bg-warning/10',
  },
  failed: {
    icon: <XCircle className="h-3 w-3" />,
    label: 'Falhou',
    dotClass: 'bg-destructive',
    badgeClass: 'border-destructive/20 bg-destructive/8 text-destructive dark:bg-destructive/10',
  },
  skipped: {
    icon: <MinusCircle className="h-3 w-3" />,
    label: 'Ignorado',
    dotClass: 'bg-muted-foreground',
    badgeClass: 'border-border bg-muted text-muted-foreground',
  },
  pending: {
    icon: <Clock className="h-3 w-3" />,
    label: 'Pendente',
    dotClass: 'bg-muted-foreground',
    badgeClass: 'border-border bg-muted text-muted-foreground',
  },
};

const SOURCE_LABELS: Record<string, string> = {
  cron: 'Agendamento',
  event: 'Evento',
  manual_test: 'Teste manual',
};

interface MessageDispatchLogsProps {
  messageId: string;
}

export function MessageDispatchLogs({ messageId }: MessageDispatchLogsProps) {
  const [selectedLog, setSelectedLog] = useState<DispatchLog | null>(null);

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dispatch-logs', messageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_dispatch_logs')
        .select('*')
        .eq('message_id', messageId)
        .order('triggered_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as DispatchLog[];
    },
  });

  const sentCount = logs.filter(l => l.status === 'sent').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;
  const skippedCount = logs.filter(l => l.status === 'skipped' || l.status === 'partial').length;

  return (
    <>
      <div className="space-y-4">
        {/* Stats bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5 text-xs font-medium">
            <span className="text-muted-foreground tabular-nums">
              {logs.length} disparo{logs.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              <span className="text-muted-foreground tabular-nums">{sentCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              <span className="text-muted-foreground tabular-nums">{failedCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <span className="text-muted-foreground tabular-nums">{skippedCount}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
            Atualizar
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
              <Clock className="h-4.5 w-4.5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">Nenhum disparo registrado.</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Os logs aparecerão aqui após o primeiro envio.</p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
            {logs.map((log) => {
              const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
              const resolved = Array.isArray(log.recipients_resolved) ? log.recipients_resolved : [];
              const ignored = Array.isArray(log.recipients_ignored) ? log.recipients_ignored : [];

              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                  {/* Status indicator */}
                  <span className={cn('h-2 w-2 rounded-full shrink-0', cfg.dotClass)} />

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] font-medium gap-1 px-1.5 py-0 border shrink-0', cfg.badgeClass)}
                      >
                        {cfg.icon} {cfg.label}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {SOURCE_LABELS[log.trigger_source] || log.trigger_source}
                      </span>
                      {log.ai_used && (
                        <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                          <Sparkles className="h-2.5 w-2.5" />
                          IA
                        </span>
                      )}
                    </div>

                    {/* Metrics row */}
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground/70">
                      {resolved.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {resolved.length} enviado{resolved.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {ignored.length > 0 && (
                        <span className="flex items-center gap-1">
                          <UserX className="h-3 w-3" />
                          {ignored.length} ignorado{ignored.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {log.error_reason && (
                        <span className="text-destructive/70 truncate max-w-[220px]">
                          {log.error_reason}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Timestamp + chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                      {format(new Date(log.triggered_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Detalhe do Disparo</DialogTitle>
            <DialogDescription>
              {selectedLog && format(new Date(selectedLog.triggered_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (() => {
            const cfg = STATUS_CONFIG[selectedLog.status] || STATUS_CONFIG.pending;
            return (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Status</span>
                    <div className="mt-1.5">
                      <Badge variant="outline" className={cn('text-xs gap-1 border', cfg.badgeClass)}>
                        {cfg.icon} {cfg.label}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Fonte</span>
                    <p className="mt-1.5 text-sm text-foreground">{SOURCE_LABELS[selectedLog.trigger_source] || selectedLog.trigger_source}</p>
                  </div>
                </div>

                {Array.isArray(selectedLog.recipients_resolved) && selectedLog.recipients_resolved.length > 0 && (
                  <div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 block mb-1.5">
                      Enviado para
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {selectedLog.recipients_resolved.map((r, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                          {r.name} · {r.channel}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(selectedLog.recipients_ignored) && selectedLog.recipients_ignored.length > 0 && (
                  <div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 block mb-1.5">
                      Ignorados
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {selectedLog.recipients_ignored.map((r, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] font-normal text-muted-foreground">
                          {r.name} — {r.reason}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedLog.error_reason && (
                  <div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 block mb-1.5">Erro</span>
                    <div className="text-xs text-destructive bg-destructive/5 border border-destructive/10 rounded-md px-3 py-2 font-mono">
                      {selectedLog.error_reason}
                    </div>
                  </div>
                )}

                {selectedLog.message_body && (
                  <div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 block mb-1.5">
                      Conteúdo enviado
                    </span>
                    <div className="bg-muted/30 border border-border rounded-md p-3 max-h-48 overflow-y-auto">
                      <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{selectedLog.message_body}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
