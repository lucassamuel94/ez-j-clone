import { useState } from 'react';
import { useActivityLogs } from '@/hooks/useActivityLogs';
import { Skeleton } from '@/components/ui/skeleton';
import { History, AlertCircle, ChevronDown, RefreshCw, MessageSquare, ArrowRightLeft, Clock, Calendar, Star, UserPlus, UserMinus, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ActivityLog } from '@/services/activityLogService';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ActivityLogSectionProps {
  leadId: string | null;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  created: <Star className="h-3 w-3" strokeWidth={1.5} />,
  status_changed: <RefreshCw className="h-3 w-3" strokeWidth={1.5} />,
  temperature_changed: <Zap className="h-3 w-3" strokeWidth={1.5} />,
  field_updated: <RefreshCw className="h-3 w-3" strokeWidth={1.5} />,
  owner_assigned: <UserPlus className="h-3 w-3" strokeWidth={1.5} />,
  owner_removed: <UserMinus className="h-3 w-3" strokeWidth={1.5} />,
  note_added: <MessageSquare className="h-3 w-3" strokeWidth={1.5} />,
  note_updated: <MessageSquare className="h-3 w-3" strokeWidth={1.5} />,
  note_deleted: <MessageSquare className="h-3 w-3" strokeWidth={1.5} />,
  interaction_added: <ArrowRightLeft className="h-3 w-3" strokeWidth={1.5} />,
  interaction_registered: <ArrowRightLeft className="h-3 w-3" strokeWidth={1.5} />,
  cadence_started: <Zap className="h-3 w-3" strokeWidth={1.5} />,
  cadence_step_changed: <ArrowRightLeft className="h-3 w-3" strokeWidth={1.5} />,
  meeting_scheduled: <Calendar className="h-3 w-3" strokeWidth={1.5} />,
  opportunity_created: <Star className="h-3 w-3" strokeWidth={1.5} />,
};

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-chart-3/10 text-chart-3',
  status_changed: 'bg-primary/10 text-primary',
  temperature_changed: 'bg-chart-5/10 text-chart-5',
  field_updated: 'bg-muted/50 text-muted-foreground',
  owner_assigned: 'bg-chart-4/10 text-chart-4',
  owner_removed: 'bg-chart-4/10 text-chart-4',
  note_added: 'bg-chart-5/10 text-chart-5',
  note_updated: 'bg-chart-5/10 text-chart-5',
  note_deleted: 'bg-destructive/10 text-destructive',
  interaction_added: 'bg-primary/10 text-primary',
  interaction_registered: 'bg-primary/10 text-primary',
  cadence_started: 'bg-chart-2/10 text-chart-2',
  cadence_step_changed: 'bg-chart-2/10 text-chart-2',
  meeting_scheduled: 'bg-chart-3/10 text-chart-3',
  opportunity_created: 'bg-chart-3/10 text-chart-3',
};

const ACTION_LABELS: Record<string, string> = {
  created: 'criou o lead',
  status_changed: 'alterou status',
  temperature_changed: 'alterou qualificação',
  field_updated: 'atualizou campo',
  owner_assigned: 'atribuiu responsável',
  owner_removed: 'removeu responsável',
  note_added: 'adicionou observação',
  note_updated: 'editou observação',
  note_deleted: 'excluiu observação',
  interaction_added: 'registrou interação',
  interaction_registered: 'registrou interação',
  cadence_started: 'iniciou cadência',
  cadence_step_changed: 'avançou cadência',
  meeting_scheduled: 'agendou reunião',
  opportunity_created: 'criou oportunidade',
};

const ActivityLogItem = ({ log }: { log: ActivityLog }) => {
  const fullDate = format(log.created_at, "dd/MM/yyyy", { locale: ptBR });
  const actionIcon = ACTION_ICONS[log.action_type] || <Clock className="h-3 w-3" strokeWidth={1.5} />;
  const actionColor = ACTION_COLORS[log.action_type] || 'bg-muted/30 text-muted-foreground';
  const actionLabel = ACTION_LABELS[log.action_type] || log.action_type;

  return (
    <div className="group">
      <div className="flex items-start gap-2.5">
        <div className={cn('flex items-center justify-center h-6 w-6 rounded-full flex-shrink-0 mt-0.5', actionColor)}>
          {actionIcon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-foreground">
              {log.user_name || 'Sistema'}
            </span>
            <span className="text-xs text-muted-foreground/40">
              {actionLabel}
            </span>
            <span className="text-xs text-muted-foreground/25 ml-auto flex-shrink-0">
              {fullDate}
            </span>
          </div>
          {log.description && (
            <div className="mt-1.5 rounded-lg bg-muted/15 border border-border/20 px-3 py-2">
              <p className="text-xs text-foreground/70 whitespace-pre-line leading-relaxed">{log.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ActivityLogSection = ({ leadId }: ActivityLogSectionProps) => {
  const { data: logs, isLoading, error } = useActivityLogs(leadId);
  const [isOpen, setIsOpen] = useState(true);

  if (!leadId) return null;

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
          <span className="flex items-center justify-center h-5 w-5 rounded bg-primary/10 text-primary">
            <History className="h-3 w-3" />
          </span>
          <span className="text-xs font-medium">Histórico de atividades/logs</span>
        </div>
        <div className="border-t px-3 py-3 space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-2">
              <Skeleton className="w-6 h-6 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          <span className="text-xs text-destructive">Erro ao carregar atividades</span>
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border bg-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-5 w-5 rounded bg-primary/10 text-primary">
                <History className="h-3 w-3" />
              </span>
              <span className="text-xs font-medium">Histórico de atividades/logs</span>
            </div>
            <div className="flex items-center gap-2">
              {logs && logs.length > 0 && (
                <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                  {logs.length}
                </span>
              )}
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t max-h-[500px] overflow-y-auto">
            <div className="px-3 py-3">
              {logs && logs.length > 0 ? (
                <div className="space-y-3">
                  {logs.map(log => (
                    <ActivityLogItem key={log.id} log={log} />
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-muted-foreground">
                  <History className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
                  <p className="text-xs">Nenhuma atividade registrada</p>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
