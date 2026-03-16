import { useState, useMemo, useCallback } from 'react';
import { useCloserPipeline } from '@/hooks/useCloserPipeline';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useQueryClient } from '@tanstack/react-query';
import { CloserStatsSection, CloserPeriodType } from '@/components/CloserStatsSection';
import { CloserRevenueDashboard } from '@/components/CloserRevenueDashboard';
import { LeadModal } from '@/components/LeadModal';
import { Lead } from '@/types/lead';
import { CloserOpportunity } from '@/services/closerService';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { useUpdateLead } from '@/hooks/useLeads';
import { useLeadModal } from '@/hooks/useLeadModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { TrendingUp, Users, Loader2, CalendarDays } from 'lucide-react';
import { format, endOfDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

const periodOptions: { value: CloserPeriodType; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: '7d', label: '7 dias' },
  { value: 'month', label: 'Mês atual' },
];

const CloserIndicadoresPage = () => {
  const { opportunities, isLoading } = useCloserPipeline();
  const { isAdmin, isManager } = useAdminUsers();
  const queryClient = useQueryClient();
  const updateLeadMutation = useUpdateLead();

  const [selectedCloserId, setSelectedCloserId] = useState<string>('all');
  const [period, setPeriod] = useState<CloserPeriodType>('today');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const { lead: modalLead, opportunity: modalOpp, isOpen: leadModalOpen, openLead, closeLead } = useLeadModal();

  const canFilterByCloser = isAdmin || isManager;

  const closerProfiles = useMemo(() => {
    const map = new Map<string, string>();
    opportunities.forEach(o => {
      if (o.assigned_to_user_id && o.closer_name) {
        map.set(o.assigned_to_user_id, o.closer_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [opportunities]);

  const handleOpenLeadModal = useCallback((opp: CloserOpportunity) => {
    openLead(opp.lead_id, opp.id);
  }, [openLead]);

  const handleUpdateLead = useCallback((updatedLead: Lead) => {
    queryClient.setQueryData<Lead[]>(['leads'], (prev) => {
      if (!prev) return prev;
      return prev.map((l) => (l.id === updatedLead.id ? updatedLead : l));
    });
    updateLeadMutation.mutate({
      id: updatedLead.id,
      updates: updatedLead,
    });
  }, [queryClient, updateLeadMutation]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Carregando indicadores...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-4 pb-24 space-y-3">
          <PageHeader
            icon={<TrendingUp className="h-5 w-5" />}
            title="Indicadores Closer"
            toolbar={
              canFilterByCloser ? (
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
                    <SelectTrigger className="w-[180px] h-8 text-xs font-medium">
                      <SelectValue placeholder="Filtrar por Closer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Closers</SelectItem>
                      {closerProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : undefined
            }
          />

          {/* Date Period Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground mr-1" />
            {periodOptions.map((p) => (
              <Button
                key={p.value}
                size="sm"
                variant={period === p.value ? 'default' : 'outline'}
                className="h-7 text-xs px-3"
                onClick={() => { setPeriod(p.value); setCustomRange(undefined); }}
              >
                {p.label}
              </Button>
            ))}
            <Popover open={rangePickerOpen} onOpenChange={setRangePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant={period === 'custom' ? 'default' : 'outline'}
                  className="h-7 text-xs px-3"
                >
                  {period === 'custom' && customRange?.from
                    ? (customRange.to
                        ? `${format(customRange.from, 'dd/MM', { locale: ptBR })} – ${format(customRange.to, 'dd/MM', { locale: ptBR })}`
                        : format(customRange.from, 'dd/MM/yyyy', { locale: ptBR }))
                    : 'Personalizado'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={(range) => {
                    setCustomRange(range);
                    if (range?.from) {
                      setPeriod('custom');
                      if (range.to) setRangePickerOpen(false);
                    }
                  }}
                  numberOfMonths={2}
                  locale={ptBR}
                  disabled={(date) => date > new Date()}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <CloserStatsSection
            selectedCloserId={selectedCloserId !== 'all' ? selectedCloserId : undefined}
            period={period}
            onPeriodChange={setPeriod}
            customRange={customRange}
          />

          <CloserRevenueDashboard
            opportunities={opportunities}
            onOpenLead={handleOpenLeadModal}
            selectedCloserId={selectedCloserId !== 'all' ? selectedCloserId : undefined}
          />
        </main>
      </div>

      {modalLead && (
        <LeadModal
          lead={modalLead}
          open={leadModalOpen}
          onClose={() => closeLead()}
          onUpdateLead={handleUpdateLead}
          mode="closer"
          opportunity={modalOpp as any}
        />
      )}
    </AppLayout>
  );
};

export default CloserIndicadoresPage;
