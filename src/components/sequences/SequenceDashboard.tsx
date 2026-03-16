import { useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, Users, CheckCircle2, MessageSquare, BarChart3, XCircle } from 'lucide-react';
import { useSequenceDashboard, useSequenceEnrollments } from '@/hooks/useEmailSequences';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SequenceDashboardProps {
  sequenceId?: string;
}

export function SequenceDashboard({ sequenceId }: SequenceDashboardProps) {
  const { data: stats, isLoading: statsLoading } = useSequenceDashboard();
  const { enrollments, isLoading: enrollLoading, unenrollLead } = useSequenceEnrollments(
    sequenceId ? { sequenceId } : undefined
  );

  const handleUnenroll = useCallback(async (enrollmentId: string) => {
    try {
      await unenrollLead.mutateAsync(enrollmentId);
      toast.success('Lead removido da sequência');
    } catch {
      toast.error('Erro ao remover lead');
    }
  }, [unenrollLead]);

  const kpis = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Inscritos ativos', value: stats.active, icon: Users, color: 'text-info' },
      { label: 'E-mails enviados', value: stats.totalSent, icon: Mail, color: 'text-primary' },
      { label: 'Taxa de abertura', value: `${stats.openRate.toFixed(1)}%`, icon: BarChart3, color: 'text-warning' },
      { label: 'Taxa de reply', value: `${stats.replyRate.toFixed(1)}%`, icon: MessageSquare, color: 'text-success' },
      { label: 'Concluídos', value: stats.completed, icon: CheckCircle2, color: 'text-muted-foreground' },
      { label: 'Replies', value: stats.replied, icon: MessageSquare, color: 'text-success' },
    ];
  }, [stats]);

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      active: { label: 'Ativo', className: 'bg-info/10 text-info' },
      completed: { label: 'Concluído', className: 'bg-muted text-muted-foreground' },
      replied: { label: 'Respondeu', className: 'bg-success/10 text-success' },
      unsubscribed: { label: 'Cancelado', className: 'bg-destructive/10 text-destructive' },
    };
    const s = map[status] || { label: status, className: '' };
    return <Badge className={cn('text-[10px] h-5 border-0', s.className)}>{s.label}</Badge>;
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(kpi => (
          <Card key={kpi.label} className="border border-border shadow-xs">
            <CardContent className="p-4 text-center">
              <kpi.icon className={cn('h-5 w-5 mx-auto mb-1', kpi.color)} />
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Enrollment list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inscrições</CardTitle>
        </CardHeader>
        <CardContent>
          {enrollLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma inscrição encontrada.
            </p>
          ) : (
            <div className="space-y-2">
              {enrollments.map((enr: any) => (
                <div
                  key={enr.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">
                        {enr.leads?.name || 'Lead'}
                      </p>
                      {statusBadge(enr.status)}
                      <Badge variant="outline" className="text-[10px] h-5">
                        Step {enr.current_step}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {enr.leads?.company || ''} · {enr.email_sequences?.name || ''}
                    </p>
                  </div>
                  {enr.status === 'active' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                      onClick={() => handleUnenroll(enr.id)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
