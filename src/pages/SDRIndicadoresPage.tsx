import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUpdateLead } from '@/hooks/useLeads';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLeadModal } from '@/hooks/useLeadModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SDRExecutionDashboard } from '@/components/SDRExecutionDashboard';
import { LeadModal } from '@/components/LeadModal';

import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Lead } from '@/types/lead';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { BarChart3, Users, Loader2, CalendarDays, RefreshCw } from 'lucide-react';
import { startOfDay, startOfMonth, endOfDay, subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

// Lazy load heavy below-the-fold sections
const SDRStatsSection = lazy(() => import('@/components/SDRStatsSection').then(m => ({ default: m.SDRStatsSection })));
const SDRCallsSection = lazy(() => import('@/components/admin/SDRCallsSection').then(m => ({ default: m.SDRCallsSection })));

const SectionSkeleton = () => (
  <Card>
    <CardContent className="p-4 space-y-3">
      <Skeleton className="h-5 w-40" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    </CardContent>
  </Card>
);

export type ExecDatePeriod = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom';

export const getExecDateRange = (period: ExecDatePeriod, customRange?: DateRange) => {
  const now = new Date();
  switch (period) {
    case 'today':
      return { start: startOfDay(now).toISOString(), end: now.toISOString(), label: 'Hoje' };
    case 'yesterday': {
      const yesterdayStart = subDays(startOfDay(now), 1);
      const yesterdayEnd = new Date(startOfDay(now).getTime() - 1);
      return { start: yesterdayStart.toISOString(), end: yesterdayEnd.toISOString(), label: 'Ontem' };
    }
    case '7d':
      return { start: subDays(startOfDay(now), 6).toISOString(), end: now.toISOString(), label: '7 dias' };
    case '30d':
      return { start: subDays(startOfDay(now), 29).toISOString(), end: now.toISOString(), label: '30 dias' };
    case 'month':
      return { start: startOfMonth(now).toISOString(), end: now.toISOString(), label: 'Mês atual' };
    case 'custom': {
      if (customRange?.from) {
        const from = startOfDay(customRange.from);
        const to = customRange.to ? endOfDay(customRange.to) : endOfDay(customRange.from);
        const label = customRange.to
          ? `${format(from, 'dd/MM', { locale: ptBR })} – ${format(to, 'dd/MM', { locale: ptBR })}`
          : format(from, 'dd/MM/yyyy', { locale: ptBR });
        return { start: from.toISOString(), end: to.toISOString(), label };
      }
      return { start: startOfDay(now).toISOString(), end: now.toISOString(), label: 'Personalizado' };
    }
  }
};

const SDRIndicadoresPage = () => {
  const { isAdmin, isManager } = useAdminUsers();
  const { canAccessBoth } = useUserRole();
  const { user: currentUser } = useCurrentUser();
  const [selectedSdrId, setSelectedSdrId] = useState<string>('');
  const [datePeriod, setDatePeriod] = useState<ExecDatePeriod>('today');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const updateLeadMutation = useUpdateLead();
  const { lead: modalLead, isOpen: leadModalOpen, closeLead } = useLeadModal();

  // 2.2 Memoize dateRange to prevent queryKey invalidation on every render
  const dateRange = useMemo(() => getExecDateRange(datePeriod, customRange), [datePeriod, customRange]);

  const canFilterBySdr = isAdmin || isManager;

  const { data: sdrProfiles = [] } = useQuery({
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
    staleTime: 300_000,
  });

  useEffect(() => {
    if (canFilterBySdr && !selectedSdrId) {
      setSelectedSdrId('all');
    }
  }, [canFilterBySdr, selectedSdrId]);

  // 2.4 Memoize callbacks
  const handleLeadClick = useCallback((lead: Lead) => {
    navigate(`/leads?lead=${lead.id}`);
  }, [navigate]);

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

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-4 pb-20 space-y-4">
          <PageHeader
            icon={<BarChart3 className="h-5 w-5" />}
            title="Indicadores SDR"
            toolbar={
              canFilterBySdr ? (
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
              ) : undefined
            }
          />

          {/* Date Period Filter */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground mr-1" />
              {(['today', 'yesterday', '7d', 'month'] as ExecDatePeriod[]).map((p) => {
                const { label } = getExecDateRange(p);
                return (
                  <Button
                    key={p}
                    size="sm"
                    variant={datePeriod === p ? 'default' : 'outline'}
                    className="h-7 text-xs px-3"
                    onClick={() => { setDatePeriod(p); setCustomRange(undefined); }}
                  >
                    {label}
                  </Button>
                );
              })}
              <Popover open={rangePickerOpen} onOpenChange={setRangePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant={datePeriod === 'custom' ? 'default' : 'outline'}
                    className="h-7 text-xs px-3"
                  >
                    {datePeriod === 'custom' && customRange?.from
                      ? dateRange.label
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
                        setDatePeriod('custom');
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
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <RefreshCw className="h-3 w-3" />
              <span>Atualizado: {format(lastUpdated, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            </div>
          </div>

          {/* Execution Dashboard */}
          <SDRExecutionDashboard
            selectedSdrId={canFilterBySdr ? selectedSdrId : undefined}
            onLeadClick={handleLeadClick}
            dateRange={dateRange}
          />

          {/* Stats Section - lazy loaded */}
          <Suspense fallback={<SectionSkeleton />}>
            <SDRStatsSection selectedSdrId={canFilterBySdr ? selectedSdrId : undefined} dateRange={dateRange} />
          </Suspense>

          {/* Ligações EZCall - lazy loaded */}
          <Suspense fallback={<SectionSkeleton />}>
            <SDRCallsSection
              dateRange={dateRange}
              selectedSdrId={canFilterBySdr ? selectedSdrId : currentUser?.id}
            />
          </Suspense>

        </main>
      </div>

      {modalLead && (
        <LeadModal
          lead={modalLead}
          open={leadModalOpen}
          onClose={() => closeLead()}
          onUpdateLead={handleUpdateLead}
        />
      )}
    </AppLayout>
  );
};

export default SDRIndicadoresPage;
