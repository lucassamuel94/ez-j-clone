import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search,
  ScrollText,
  Filter,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  ArrowRightLeft,
  Plus,
  Trash2,
  Edit,
  Calendar as CalendarIcon,
  PhoneCall,
  Target,
  MessageSquare,
  X,
  CalendarDays,
} from 'lucide-react';

const PAGE_SIZE = 50;

const ACTION_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: string }> = {
  created: { label: 'Criação', icon: <Plus className="h-3.5 w-3.5" />, variant: 'bg-success/15 text-success' },
  status_changed: { label: 'Status', icon: <ArrowRightLeft className="h-3.5 w-3.5" />, variant: 'bg-info/15 text-info' },
  temperature_changed: { label: 'Score', icon: <Target className="h-3.5 w-3.5" />, variant: 'bg-warning/15 text-warning' },
  field_updated: { label: 'Campo', icon: <Edit className="h-3.5 w-3.5" />, variant: 'bg-muted text-muted-foreground' },
  owner_assigned: { label: 'Responsável', icon: <UserCircle className="h-3.5 w-3.5" />, variant: 'bg-primary/15 text-primary' },
  owner_removed: { label: 'Responsável', icon: <UserCircle className="h-3.5 w-3.5" />, variant: 'bg-destructive/15 text-destructive' },
  note_added: { label: 'Nota', icon: <MessageSquare className="h-3.5 w-3.5" />, variant: 'bg-info/15 text-info' },
  note_updated: { label: 'Nota', icon: <Edit className="h-3.5 w-3.5" />, variant: 'bg-info/15 text-info' },
  note_deleted: { label: 'Nota', icon: <Trash2 className="h-3.5 w-3.5" />, variant: 'bg-destructive/15 text-destructive' },
  interaction_added: { label: 'Interação', icon: <PhoneCall className="h-3.5 w-3.5" />, variant: 'bg-primary/15 text-primary' },
  interaction_registered: { label: 'Interação', icon: <PhoneCall className="h-3.5 w-3.5" />, variant: 'bg-primary/15 text-primary' },
  cadence_started: { label: 'Cadência', icon: <Target className="h-3.5 w-3.5" />, variant: 'bg-warning/15 text-warning' },
  cadence_step_changed: { label: 'Cadência', icon: <ArrowRightLeft className="h-3.5 w-3.5" />, variant: 'bg-warning/15 text-warning' },
  meeting_scheduled: { label: 'Reunião', icon: <CalendarIcon className="h-3.5 w-3.5" />, variant: 'bg-success/15 text-success' },
  opportunity_created: { label: 'Oportunidade', icon: <Plus className="h-3.5 w-3.5" />, variant: 'bg-success/15 text-success' },
};

function getActionConfig(type: string) {
  return ACTION_TYPE_CONFIG[type] || { label: type, icon: <ScrollText className="h-3.5 w-3.5" />, variant: 'bg-muted text-muted-foreground' };
}

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Todo período' },
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'custom', label: 'Personalizado' },
];

interface LogRow {
  id: string;
  lead_id: string;
  user_id: string | null;
  action_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string;
  created_at: string;
  user_name: string;
  lead_name: string;
  lead_company: string;
}

export function SystemLogsSection() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();
  const [page, setPage] = useState(0);

  // Fetch users for filter
  const { data: users } = useQuery({
    queryKey: ['system-logs-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (periodFilter) {
      case 'today':
        return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
      case '7d':
        return { from: startOfDay(subDays(now, 7)).toISOString(), to: endOfDay(now).toISOString() };
      case '30d':
        return { from: startOfDay(subDays(now, 30)).toISOString(), to: endOfDay(now).toISOString() };
      case 'custom':
        return {
          from: customDateFrom ? startOfDay(customDateFrom).toISOString() : undefined,
          to: customDateTo ? endOfDay(customDateTo).toISOString() : undefined,
        };
      default:
        return { from: undefined, to: undefined };
    }
  }, [periodFilter, customDateFrom, customDateTo]);

  const { data, isLoading } = useQuery({
    queryKey: ['system-logs', page, actionFilter, userFilter, dateRange.from, dateRange.to],
    queryFn: async () => {
      let query = supabase
        .from('lead_activity_logs')
        .select('*, profiles:user_id(name), leads:lead_id(name, company)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (actionFilter !== 'all') {
        query = query.eq('action_type', actionFilter);
      }
      if (userFilter !== 'all') {
        query = query.eq('user_id', userFilter);
      }
      if (dateRange.from) {
        query = query.gte('created_at', dateRange.from);
      }
      if (dateRange.to) {
        query = query.lte('created_at', dateRange.to);
      }

      const { data: rows, error, count } = await query;

      if (error) throw error;

      const logs: LogRow[] = (rows || []).map((r: any) => ({
        id: r.id,
        lead_id: r.lead_id,
        user_id: r.user_id,
        action_type: r.action_type,
        field_name: r.field_name,
        old_value: r.old_value,
        new_value: r.new_value,
        description: r.description,
        created_at: r.created_at,
        user_name: r.profiles?.name || 'Sistema',
        lead_name: r.leads?.name || '—',
        lead_company: r.leads?.company || '—',
      }));

      return { logs, total: count || 0 };
    },
  });

  const filteredLogs = useMemo(() => {
    if (!data?.logs) return [];
    if (!search.trim()) return data.logs;
    const q = search.toLowerCase();
    return data.logs.filter(
      (l) =>
        l.description.toLowerCase().includes(q) ||
        l.user_name.toLowerCase().includes(q) ||
        l.lead_name.toLowerCase().includes(q) ||
        l.lead_company.toLowerCase().includes(q)
    );
  }, [data?.logs, search]);

  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  // Count active filters
  const activeFilterCount = [
    actionFilter !== 'all',
    userFilter !== 'all',
    periodFilter !== 'all',
    search.trim().length > 0,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearch('');
    setActionFilter('all');
    setPeriodFilter('all');
    setUserFilter('all');
    setCustomDateFrom(undefined);
    setCustomDateTo(undefined);
    setPage(0);
  };

  const activeFilterBadges = useMemo(() => {
    const badges: { key: string; label: string; onRemove: () => void }[] = [];
    if (actionFilter !== 'all') {
      const config = ACTION_TYPE_CONFIG[actionFilter];
      badges.push({
        key: 'action',
        label: `Tipo: ${config?.label || actionFilter}`,
        onRemove: () => { setActionFilter('all'); setPage(0); },
      });
    }
    if (userFilter !== 'all') {
      const user = users?.find(u => u.id === userFilter);
      badges.push({
        key: 'user',
        label: `Usuário: ${user?.name || 'Desconhecido'}`,
        onRemove: () => { setUserFilter('all'); setPage(0); },
      });
    }
    if (periodFilter !== 'all') {
      const period = PERIOD_OPTIONS.find(p => p.value === periodFilter);
      let label = `Período: ${period?.label}`;
      if (periodFilter === 'custom') {
        const from = customDateFrom ? format(customDateFrom, 'dd/MM', { locale: ptBR }) : '...';
        const to = customDateTo ? format(customDateTo, 'dd/MM', { locale: ptBR }) : '...';
        label = `Período: ${from} – ${to}`;
      }
      badges.push({
        key: 'period',
        label,
        onRemove: () => { setPeriodFilter('all'); setCustomDateFrom(undefined); setCustomDateTo(undefined); setPage(0); },
      });
    }
    if (search.trim()) {
      badges.push({
        key: 'search',
        label: `Busca: "${search.trim()}"`,
        onRemove: () => { setSearch(''); },
      });
    }
    return badges;
  }, [actionFilter, userFilter, periodFilter, search, customDateFrom, customDateTo, users]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Logs do Sistema</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Registro completo de todas as ações realizadas no sistema.
        </p>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar descrição, usuário, lead..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Action Type */}
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="Tipo de ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(ACTION_TYPE_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-1.5">
                    {config.icon}
                    {config.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* User Filter */}
          <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setPage(0); }}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="Usuário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os usuários</SelectItem>
              {(users || []).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Period Filter */}
          <Select value={periodFilter} onValueChange={(v) => { setPeriodFilter(v); setPage(0); }}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Custom Date Pickers */}
          {periodFilter === 'custom' && (
            <div className="flex items-center gap-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-normal">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {customDateFrom ? format(customDateFrom, 'dd/MM/yyyy', { locale: ptBR }) : 'De'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customDateFrom}
                    onSelect={(d) => { setCustomDateFrom(d); setPage(0); }}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-normal">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {customDateTo ? format(customDateTo, 'dd/MM/yyyy', { locale: ptBR }) : 'Até'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customDateTo}
                    onSelect={(d) => { setCustomDateTo(d); setPage(0); }}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Counter & Clear */}
          <div className="flex items-center gap-2 ml-auto">
            {data?.total != null && (
              <span className="text-xs text-muted-foreground">
                {data.total.toLocaleString('pt-BR')} registros
              </span>
            )}
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground" onClick={clearAllFilters}>
                <X className="h-3.5 w-3.5" />
                Limpar ({activeFilterCount})
              </Button>
            )}
          </div>
        </div>

        {/* Active filter badges */}
        {activeFilterBadges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeFilterBadges.map((b) => (
              <Badge
                key={b.key}
                variant="secondary"
                className="gap-1 text-[11px] font-medium pl-2 pr-1 py-0.5 cursor-pointer hover:bg-destructive/10 transition-colors"
                onClick={b.onRemove}
              >
                {b.label}
                <X className="h-3 w-3 ml-0.5" />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ScrollText className="h-10 w-10 mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium">Nenhum registro encontrado</p>
            {activeFilterCount > 0 && (
              <Button variant="link" size="sm" className="mt-2 text-xs" onClick={clearAllFilters}>
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(100vh-380px)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Data/Hora</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Usuário</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Tipo</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Lead</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const config = getActionConfig(log.action_type);
                  return (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground font-mono">
                        {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-medium text-foreground">{log.user_name}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Badge variant="secondary" className={`gap-1 text-[10px] font-medium px-1.5 py-0.5 ${config.variant}`}>
                          {config.icon}
                          {config.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 max-w-[180px]">
                        <div className="truncate text-xs font-medium text-foreground">{log.lead_name}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{log.lead_company}</div>
                      </td>
                      <td className="px-4 py-2.5 max-w-[300px]">
                        <span className="text-xs text-muted-foreground line-clamp-2">{log.description}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
