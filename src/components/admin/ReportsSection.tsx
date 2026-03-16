import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminReports } from '@/hooks/useAdminReports';
import { Card, CardContent } from '@/components/ui/card';
import {
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Loader2,
  Info,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const fmt = (v: number) => v.toLocaleString('pt-BR');

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--muted))'];

const STATUS_COLORS: Record<string, string> = {
  'Novo': 'hsl(var(--chart-1))',
  'Em contato': 'hsl(var(--chart-2))',
  'Interesse': 'hsl(var(--chart-3))',
  'Interesse/Agendar Retorno': 'hsl(var(--chart-4))',
  'Oportunidade criada': 'hsl(var(--chart-5))',
  'Descartado': 'hsl(var(--muted))',
};

export const useReportsData = () => {
  return useAdminReports();
};

interface ReportsKPICardsProps {
  selectedSdrId?: string;
  dateRange?: { start: string; end: string };
}

export const ReportsKPICards = ({ selectedSdrId, dateRange }: ReportsKPICardsProps) => {
  const { metrics, isLoadingMetrics, error } = useAdminReports({ selectedSdrId, dateRange });

  if (isLoadingMetrics) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm text-destructive font-medium">Erro ao carregar métricas</p>
        <p className="text-xs text-muted-foreground mt-1">{String(error)}</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 mb-1 cursor-help">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Leads no Período</span>
                  <Info className="h-3 w-3 text-muted-foreground/50" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Total de leads criados no período selecionado</p>
              </TooltipContent>
            </Tooltip>
            <p className="text-2xl font-bold text-foreground">{fmt(metrics?.totalLeads || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 mb-1 cursor-help">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Convertidos</span>
                  <Info className="h-3 w-3 text-muted-foreground/50" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Leads convertidos no período (taxa = convertidos ÷ total do período)</p>
              </TooltipContent>
            </Tooltip>
            <p className="text-2xl font-bold text-foreground">{fmt(metrics?.convertedThisMonth || 0)}</p>
            <span className="text-[10px] text-muted-foreground">Taxa: {metrics?.conversionRate || 0}%</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 mb-1 cursor-help">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-muted-foreground">Atrasados</span>
                  <Info className="h-3 w-3 text-muted-foreground/50" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Leads aguardando ação há mais tempo que o esperado</p>
              </TooltipContent>
            </Tooltip>
            <p className={cn("text-2xl font-bold", (metrics?.overdueLeads || 0) > 0 ? 'text-destructive' : 'text-foreground')}>
              {fmt(metrics?.overdueLeads || 0)}
            </p>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

interface ReportsChartsProps {
  dateRange?: { start: string; end: string };
  selectedSdrId?: string;
}

export const ReportsCharts = ({ dateRange, selectedSdrId }: ReportsChartsProps = {}) => {
  const { data: leadsByStatus = [], isLoading: isLoadingByStatus } = useQuery({
    queryKey: ['leadsByStatus', dateRange?.start, dateRange?.end, selectedSdrId],
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase.from('leads').select('status').limit(20000);
      if (dateRange?.start) q = q.gte('created_at', dateRange.start);
      if (dateRange?.end) q = q.lte('created_at', dateRange.end);
      if (selectedSdrId && selectedSdrId !== 'all') q = q.eq('owner_user_id', selectedSdrId);
      const { data, error } = await q;
      if (error) throw error;
      const statusCounts: Record<string, number> = {};
      data?.forEach(lead => { statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1; });
      return Object.entries(statusCounts).map(([status, count]) => ({ status, count }));
    },
  });

  const { data: leadsByType = [], isLoading: isLoadingByType } = useQuery({
    queryKey: ['leadsByType', dateRange?.start, dateRange?.end, selectedSdrId],
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase.from('leads').select('lead_type').limit(20000);
      if (dateRange?.start) q = q.gte('created_at', dateRange.start);
      if (dateRange?.end) q = q.lte('created_at', dateRange.end);
      if (selectedSdrId && selectedSdrId !== 'all') q = q.eq('owner_user_id', selectedSdrId);
      const { data, error } = await q;
      if (error) throw error;
      const typeCounts: Record<string, number> = {};
      data?.forEach(lead => { typeCounts[lead.lead_type] = (typeCounts[lead.lead_type] || 0) + 1; });
      return Object.entries(typeCounts).map(([type, count]) => ({ type, count }));
    },
  });

  const statusTotal = leadsByStatus.reduce((sum, s) => sum + s.count, 0);
  const typeTotal = leadsByType.reduce((sum, i) => sum + i.count, 0);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Leads by Status */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Leads por Status</span>
          </div>
          <div className="p-4">
            {isLoadingByStatus ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {leadsByStatus.map((entry, index) => {
                  const pct = statusTotal > 0 ? Math.round((entry.count / statusTotal) * 100) : 0;
                  const color = STATUS_COLORS[entry.status] || COLORS[index % COLORS.length];
                  return (
                    <div key={entry.status} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-xs font-medium text-foreground truncate">{entry.status}</span>
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {fmt(entry.count)} <span className="text-muted-foreground/60">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Leads by Type */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Leads por Tipo</span>
          </div>
          <div className="p-4">
            {isLoadingByType ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {leadsByType.map((item, index) => {
                  const percentage = typeTotal > 0 ? Math.round((item.count / typeTotal) * 100) : 0;
                  const color = COLORS[index % COLORS.length];
                  return (
                    <div key={item.type} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-xs font-medium text-foreground">{item.type}</span>
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {fmt(item.count)} <span className="text-muted-foreground/60">({percentage}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/** @deprecated Use ReportsKPICards and ReportsCharts separately */
export const ReportsSection = () => (
  <div className="space-y-4">
    <ReportsKPICards />
    <ReportsCharts />
  </div>
);
