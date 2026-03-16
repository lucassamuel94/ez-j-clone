import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type CloserMetricType = 'opportunities_worked' | 'activities' | 'meetings' | 'proposals' | 'won' | 'lost';

interface CloserBreakdownDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closerId: string;
  closerName: string;
  metricType: CloserMetricType;
  dateStart: string;
  dateEnd: string;
}

const metricLabels: Record<CloserMetricType, string> = {
  opportunities_worked: 'Oportunidades Trabalhadas',
  activities: 'Atividades Registradas',
  meetings: 'Reuniões Realizadas',
  proposals: 'Propostas Enviadas',
  won: 'Oportunidades Ganhas',
  lost: 'Oportunidades Perdidas',
};

export const CloserBreakdownDetailModal = ({
  open,
  onOpenChange,
  closerId,
  closerName,
  metricType,
  dateStart,
  dateEnd,
}: CloserBreakdownDetailModalProps) => {
  const navigate = useNavigate();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['closer-breakdown-detail', closerId, metricType, dateStart, dateEnd],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_closer_breakdown_detail', {
        p_closer_id: closerId,
        p_metric: metricType,
        p_start: dateStart,
        p_end: dateEnd,
      });
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        lead_id: string;
        opportunity_id: string;
        company: string;
        contact_name: string;
        detail: string;
        event_date: string;
      }>;
    },
    enabled: open,
  });

  const handleClick = (opportunityId?: string) => {
    if (!opportunityId) return;
    onOpenChange(false);
    navigate(`/closer?opp=${opportunityId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {closerName} — {metricLabels[metricType]}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhum registro encontrado.</p>
        ) : (
          <ScrollArea className="max-h-[450px]">
            <div className="divide-y">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 px-1">
                  <div className="min-w-0">
                    <button
                      onClick={() => handleClick(item.opportunity_id)}
                      className="text-xs font-medium text-foreground truncate block max-w-full text-left hover:text-primary hover:underline cursor-pointer transition-colors"
                    >
                      {item.company}
                    </button>
                    <p className="text-[11px] text-muted-foreground truncate">{item.contact_name}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 border-0 bg-primary/10 text-primary max-w-[200px] truncate shrink-0">
                    {item.detail}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                    {item.event_date ? format(new Date(item.event_date), 'dd/MM HH:mm', { locale: ptBR }) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
