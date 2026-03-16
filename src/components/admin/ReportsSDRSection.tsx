import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ReportsKPICards, ReportsCharts } from './ReportsSection';
import { SDRPerformancePanel } from '@/components/SDRPerformancePanel';
import { SDRCallsSection } from './SDRCallsSection';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Users, CalendarDays, RefreshCw, BarChart3, Activity, Info, Loader2, Headphones } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExecDatePeriod, getExecDateRange } from '@/pages/SDRIndicadoresPage';
import { useSDRActivityBreakdown } from '@/hooks/useSDRActivityBreakdown';
import { useSDRCallQuality } from '@/hooks/useSDRCallQuality';
import { Badge } from '@/components/ui/badge';

const fmt = (n: number) => n.toLocaleString('pt-BR');

export const ReportsSDRSection = () => {
  const [selectedSdrId, setSelectedSdrId] = useState<string>('all');
  const [datePeriod, setDatePeriod] = useState<ExecDatePeriod | 'custom'>('today');
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const dateRange = useMemo(() => {
    if (datePeriod === 'custom' && customDate) {
      return {
        start: startOfDay(customDate).toISOString(),
        end: endOfDay(customDate).toISOString(),
        label: format(customDate, 'dd/MM/yyyy'),
      };
    }
    return getExecDateRange(datePeriod === 'custom' ? 'today' : datePeriod);
  }, [datePeriod, customDate]);

  const { data: sdrProfiles = [], dataUpdatedAt } = useQuery({
    queryKey: ['sdrProfiles'],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'sdr');
      if (roleError) throw roleError;
      const userIds = (roleData || []).map(r => r.user_id);
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('active', true)
        .in('id', userIds)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: activityBreakdown = [], isLoading: isLoadingActivity } = useSDRActivityBreakdown({ dateRange });
  const { data: callQuality = [], isLoading: isLoadingQuality } = useSDRCallQuality({ dateRange });

  useEffect(() => {
    if (dataUpdatedAt) setLastUpdated(new Date());
  }, [dataUpdatedAt]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<BarChart3 className="h-5 w-5" />}
        title="Relatórios SDR"
        subtitle="Métricas e performance da equipe de prospecção"
      />

      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground mr-1" />
            {(['today', 'yesterday', '7d', '30d', 'month'] as ExecDatePeriod[]).map((p) => {
              const { label } = getExecDateRange(p);
              return (
                <Button
                  key={p}
                  size="sm"
                  variant={datePeriod === p ? 'default' : 'outline'}
                  className="h-7 text-xs px-3"
                  onClick={() => { setDatePeriod(p); setCustomDate(undefined); }}
                >
                  {label}
                </Button>
              );
            })}

            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant={datePeriod === 'custom' ? 'default' : 'outline'}
                  className="h-7 text-xs px-3 gap-1.5"
                >
                  <CalendarDays className="h-3 w-3" />
                  {datePeriod === 'custom' && customDate
                    ? format(customDate, 'dd/MM/yyyy')
                    : 'Data específica'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customDate}
                  onSelect={(date) => {
                    setCustomDate(date);
                    if (date) {
                      setDatePeriod('custom');
                      setCalendarOpen(false);
                    }
                  }}
                  locale={ptBR}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={selectedSdrId} onValueChange={setSelectedSdrId}>
              <SelectTrigger className="w-[180px] h-8 text-xs font-medium">
                <SelectValue placeholder="Filtrar por SDR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os SDRs</SelectItem>
                {sdrProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          <span>Atualizado: {format(lastUpdated, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <ReportsKPICards
        selectedSdrId={selectedSdrId !== 'all' ? selectedSdrId : undefined}
        dateRange={dateRange}
      />

      {/* SDR Performance Panel (metrics cards + breakdown table) */}
      <SDRPerformancePanel
        selectedSdrId={selectedSdrId !== 'all' ? selectedSdrId : undefined}
        dateRange={dateRange}
      />

      {/* EZCall - Ligações */}
      <SDRCallsSection
        dateRange={dateRange}
        selectedSdrId={selectedSdrId !== 'all' ? selectedSdrId : undefined}
      />

      {/* Activity Breakdown by SDR */}
      {selectedSdrId === 'all' && (
        <TooltipProvider delayDuration={300}>
          <Card>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Atividade por SDR</span>
              </div>
              {isLoadingActivity ? (
                <div className="flex items-center justify-center h-[200px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activityBreakdown.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[120px] text-center">
                  <Activity className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhuma atividade registrada no período</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">SDR</th>
                        <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 cursor-help">Leads Trabalhados <Info className="h-3 w-3 text-muted-foreground/50" /></span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p className="text-xs">Leads únicos que receberam alguma nota ou registro no período</p>
                            </TooltipContent>
                          </Tooltip>
                        </th>
                        <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 cursor-help">Atividades <Info className="h-3 w-3 text-muted-foreground/50" /></span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p className="text-xs">Total de registros: ligações, e-mails, WhatsApp, tarefas e observações</p>
                            </TooltipContent>
                          </Tooltip>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {activityBreakdown.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-foreground">{row.name}</td>
                          <td className="text-center px-3 py-2.5 tabular-nums">{fmt(row.leadsWorked)}</td>
                          <td className="text-center px-3 py-2.5 tabular-nums font-semibold">{fmt(row.activities)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TooltipProvider>
      )}

      {/* Call Quality by SDR */}
      {selectedSdrId === 'all' && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <Headphones className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Qualidade por SDR</span>
            </div>
            {isLoadingQuality ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : callQuality.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[120px] text-center">
                <Headphones className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">Nenhuma análise concluída no período</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">SDR</th>
                      <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">Análises</th>
                      <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">Nota Média</th>
                      <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">% Conexão</th>
                      <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">Maior Objeção</th>
                      <th className="text-center px-3 py-2.5 font-bold uppercase tracking-widest text-muted-foreground">Pitch Precoce</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {callQuality.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-foreground">{row.name}</td>
                        <td className="text-center px-3 py-2.5 tabular-nums">{fmt(row.totalAnalyses)}</td>
                        <td className="text-center px-3 py-2.5 tabular-nums font-semibold">
                          <Badge variant={row.avgScore >= 70 ? 'default' : row.avgScore >= 50 ? 'secondary' : 'destructive'} className="text-[10px]">
                            {row.avgScore}
                          </Badge>
                        </td>
                        <td className="text-center px-3 py-2.5 tabular-nums">{row.connectionRate}%</td>
                        <td className="text-center px-3 py-2.5 max-w-[200px] truncate text-muted-foreground">{row.topObjection || '—'}</td>
                        <td className="text-center px-3 py-2.5 tabular-nums">{row.earlyPitchRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Distribution Charts */}
      <ReportsCharts
        dateRange={dateRange}
        selectedSdrId={selectedSdrId !== 'all' ? selectedSdrId : undefined}
      />
    </div>
  );
};

