import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { subDays } from 'date-fns';

export type MetricType = 'agendados' | 'confirmados' | 'parados' | 'sqo';

interface SDRPerformanceDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sdrId: string;
  sdrName: string;
  metricType: MetricType;
  filterStart: string;
}

const metricLabels: Record<MetricType, string> = {
  agendados: 'Agendados (SQL)',
  confirmados: 'Reuniões Confirmadas',
  parados: 'Leads Parados (5d+)',
  sqo: 'Promovidos SQO',
};

export const SDRPerformanceDetailModal = ({
  open,
  onOpenChange,
  sdrId,
  sdrName,
  metricType,
  filterStart,
}: SDRPerformanceDetailModalProps) => {
  const navigate = useNavigate();
  const fiveDaysAgo = subDays(new Date(), 5).toISOString();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['sdr-perf-detail', sdrId, metricType, filterStart],
    queryFn: async () => {
      if (metricType === 'agendados') {
        const { data: meetings } = await supabase
          .from('meetings')
          .select('id, lead_id, meeting_datetime, title')
          .eq('user_id', sdrId)
          .gte('created_at', filterStart)
          .order('meeting_datetime', { ascending: false })
          .limit(500);

        if (!meetings || meetings.length === 0) return [];

        // Deduplicate by lead_id, keeping most recent (already sorted DESC)
        const seenLeads = new Set<string>();
        const uniqueMeetings = meetings.filter(m => {
          if (seenLeads.has(m.lead_id)) return false;
          seenLeads.add(m.lead_id);
          return true;
        });

        const leadIds = [...new Set(uniqueMeetings.map(m => m.lead_id))];
        const { data: leadData } = await supabase
          .from('leads')
          .select('id, company, razao_social, nome_fantasia, name, status, updated_at')
          .in('id', leadIds);

        return uniqueMeetings.map(m => {
          const lead = (leadData || []).find(l => l.id === m.lead_id);
          return {
            id: m.id,
            leadId: lead?.id,
            company: lead?.razao_social || lead?.nome_fantasia || lead?.company || '—',
            contactName: lead?.name || '—',
            status: lead?.status || '—',
            date: m.meeting_datetime,
          };
        });
      }

      if (metricType === 'confirmados') {
        // Confirmed = SDR clicked "Reunião Confirmada" (activity log with "confirmou presença")
        const { data: logs } = await supabase
          .from('lead_activity_logs')
          .select('id, lead_id, created_at')
          .eq('action_type', 'opportunity_created')
          .eq('user_id', sdrId)
          .ilike('description', '%confirmou presença%')
          .gte('created_at', filterStart)
          .order('created_at', { ascending: false })
          .limit(500);

        if (!logs || logs.length === 0) return [];

        // Deduplicate by lead_id
        const seen = new Set<string>();
        const uniqueLogs = logs.filter(l => {
          if (seen.has(l.lead_id)) return false;
          seen.add(l.lead_id);
          return true;
        });

        const leadIds = uniqueLogs.map(l => l.lead_id);
        const { data: leadData } = await supabase
          .from('leads')
          .select('id, company, razao_social, nome_fantasia, name, status')
          .in('id', leadIds);

        const leadMap = new Map((leadData || []).map(l => [l.id, l]));

        return uniqueLogs.map(log => {
          const lead = leadMap.get(log.lead_id);
          return {
            id: log.id,
            leadId: lead?.id,
            company: lead?.razao_social || lead?.nome_fantasia || lead?.company || '—',
            contactName: lead?.name || '—',
            status: 'Reunião confirmada',
            date: log.created_at,
          };
        });
      }

      if (metricType === 'parados') {
        const { data } = await supabase
          .from('leads')
          .select('id, company, razao_social, nome_fantasia, name, status, updated_at')
          .eq('owner_user_id', sdrId)
          .not('status', 'in', '("Descartado","Oportunidade criada")')
          .lt('updated_at', fiveDaysAgo)
          .order('updated_at', { ascending: true })
          .limit(500);
        return (data || []).map(l => ({
          id: l.id,
          leadId: l.id,
          company: l.razao_social || l.nome_fantasia || l.company || '—',
          contactName: l.name || '—',
          status: l.status,
          date: l.updated_at,
        }));
      }

      if (metricType === 'sqo') {
        const { data } = await supabase
          .from('leads')
          .select('id, company, razao_social, nome_fantasia, name, status, sqo_approved_at')
          .eq('owner_user_id', sdrId)
          .not('sqo_approved_at', 'is', null)
          .gte('sqo_approved_at', filterStart)
          .order('sqo_approved_at', { ascending: false })
          .limit(500);
        return (data || []).map(l => ({
          id: l.id,
          leadId: l.id,
          company: l.razao_social || l.nome_fantasia || l.company || '—',
          contactName: l.name || '—',
          status: 'SQO Aprovado',
          date: l.sqo_approved_at,
        }));
      }

      return [];
    },
    enabled: open,
  });

  const handleLeadClick = (leadId?: string) => {
    if (!leadId) return;
    onOpenChange(false);
    navigate(`/leads?lead=${leadId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {sdrName} — {metricLabels[metricType]}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : leads.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhum registro encontrado.</p>
        ) : (
          <ScrollArea className="max-h-[400px] pr-3">
            <div className="divide-y">
              {leads.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2.5 px-1 gap-3">
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => handleLeadClick(item.leadId)}
                      className="text-xs font-medium text-foreground truncate block max-w-full text-left hover:text-primary hover:underline cursor-pointer transition-colors"
                    >
                      {item.company}
                    </button>
                    <p className="text-[11px] text-muted-foreground truncate">{item.contactName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 border-0 ${metricType === 'confirmados' || metricType === 'sqo' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                      {metricType === 'confirmados' ? 'Reunião confirmada' : metricType === 'sqo' ? 'SQO Aprovado' : item.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {item.date ? format(new Date(item.date), "dd/MM HH:mm", { locale: ptBR }) : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
