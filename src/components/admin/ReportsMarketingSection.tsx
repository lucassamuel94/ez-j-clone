import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { PageHeader } from '@/components/PageHeader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  CalendarDays,
  RefreshCw,
  Users,
  TrendingUp,
  DollarSign,
  Target,
  Megaphone,
  Loader2,
  Download,
  AlertTriangle,
  Clock,
  Timer,
  XCircle,
} from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMarketingReport, type MarketingFunnelRow, type SLAMetrics } from '@/hooks/useMarketingReport';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';

type DatePeriod = 'today' | 'week' | 'month' | 'quarter' | 'custom';

type DrillDownColumn = 'totalLeads' | 'novo' | 'emContato' | 'reuniao' | 'sqo' | 'proposta' | 'ganho' | 'perdido' | 'outros' | 'semUtm';

const COLUMN_LABELS: Record<DrillDownColumn, string> = {
  totalLeads: 'Leads',
  novo: 'Novo',
  emContato: 'Em contato',
  reuniao: 'Reunião',
  sqo: 'SQO',
  proposta: 'Proposta',
  ganho: 'Ganho',
  perdido: 'Perdido',
  outros: 'Outros',
  semUtm: 'Sem UTM',
};

const CONTACT_STATUSES = ['Em contato', 'Ocupado', 'Agendar retorno', 'Sem retorno', 'Interesse', 'Interesse/Agendar Retorno', 'Reagendar Reunião'];
const MEETING_STATUSES = ['Reunião agendada', 'Oportunidade criada'];

function getDateRange(period: DatePeriod, customDate?: Date) {
  const now = new Date();
  switch (period) {
    case 'today':
      return { start: startOfDay(now).toISOString(), end: endOfDay(now).toISOString(), label: 'Hoje' };
    case 'week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }).toISOString(), end: endOfWeek(now, { weekStartsOn: 1 }).toISOString(), label: 'Esta semana' };
    case 'month':
      return { start: startOfMonth(now).toISOString(), end: endOfMonth(now).toISOString(), label: 'Este mês' };
    case 'quarter':
      return { start: startOfQuarter(now).toISOString(), end: endOfQuarter(now).toISOString(), label: 'Este trimestre' };
    case 'custom':
      if (customDate) {
        return { start: startOfDay(customDate).toISOString(), end: endOfDay(customDate).toISOString(), label: format(customDate, 'dd/MM/yyyy') };
      }
      return { start: startOfDay(now).toISOString(), end: endOfDay(now).toISOString(), label: 'Hoje' };
  }
}

const fmt = (n: number) => n.toLocaleString('pt-BR');
const fmtCurrency = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

// ---------- KPI Card (clickable) ----------

interface KPICardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  subtitle?: string;
  onClick?: () => void;
}

function KPICard({ title, value, icon, subtitle, onClick }: KPICardProps) {
  const isClickable = !!onClick;
  return (
    <Card
      className={cn(
        "border border-border rounded-2xl shadow-sm transition-all duration-200",
        isClickable && "cursor-pointer hover:shadow-md hover:-translate-y-0.5",
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        </div>
        <p className={cn(
          "text-2xl font-bold tracking-tight text-foreground",
          isClickable && "underline decoration-dotted underline-offset-4 decoration-muted-foreground/40",
        )}>
          {value}
        </p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// ---------- Clickable Number ----------

interface ClickableNumberProps {
  value: number;
  onClick: () => void;
  className?: string;
}

function ClickableNumber({ value, onClick, className }: ClickableNumberProps) {
  if (value === 0) return <span className={className}>{fmt(value)}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'underline decoration-dotted underline-offset-2 cursor-pointer hover:text-primary transition-colors font-semibold',
        className,
      )}
    >
      {fmt(value)}
    </button>
  );
}

// ---------- DrillDown types ----------

interface DrillDownLead {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  status: string;
  source: string;
  created_at: string;
  extraLabel?: string;
  extraValue?: string;
}

interface DrillDownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  leads: DrillDownLead[];
  extraColumnHeader?: string;
}

function DrillDownModal({ open, onOpenChange, title, leads, extraColumnHeader }: DrillDownModalProps) {
  const handleExport = useCallback(() => {
    const rows = leads.map((l) => {
      const base: Record<string, string> = {
        Nome: l.name,
        Empresa: l.company,
        Telefone: l.phone || '',
        'E-mail': l.email || '',
        Status: l.status,
        Fonte: l.source || '',
        'Criado em': l.created_at ? format(new Date(l.created_at), 'dd/MM/yyyy HH:mm') : '',
      };
      if (extraColumnHeader && l.extraValue) {
        base[extraColumnHeader] = l.extraValue;
      }
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, `marketing-leads-${title.replace(/\s+/g, '-').toLowerCase()}.xlsx`);
  }, [leads, title, extraColumnHeader]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold truncate">{title}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {leads.length} {leads.length === 1 ? 'lead encontrado' : 'leads encontrados'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 shrink-0 text-xs hover:scale-[1.02] active:scale-[0.98] transition-transform"
            onClick={handleExport}
          >
            <Download className="h-3.5 w-3.5" />
            Exportar Excel
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          {leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhum lead encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground pl-6">Lead</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Fonte</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Status</TableHead>
                  {extraColumnHeader && (
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-right">{extraColumnHeader}</TableHead>
                  )}
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground pr-6 text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id} className="group hover:bg-muted/20 transition-colors">
                    <TableCell className="pl-6 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground leading-tight">{lead.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{lead.company || '—'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="secondary" className="text-[10px]">{lead.source || '—'}</Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0.5">
                        {lead.status}
                      </Badge>
                    </TableCell>
                    {extraColumnHeader && (
                      <TableCell className="py-3 text-right">
                        <span className="text-sm font-medium tabular-nums">{lead.extraValue || '—'}</span>
                      </TableCell>
                    )}
                    <TableCell className="pr-6 py-3 text-right">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {lead.created_at ? format(new Date(lead.created_at), 'dd/MM/yyyy') : '—'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- KPI Drill-down types ----------

type KpiDrillType =
  | 'totalLeads'
  | 'receitaTotal'
  | 'dealsGanhos'
  | 'naoAcionados'
  | 'tempoPrimeiroContato'
  | 'tempoSQO'
  | 'tempoDescarte'
  | 'slaFonteTotal'
  | 'slaFonteNaoAcionados';

interface KpiDrillState {
  type: KpiDrillType;
  sourceFilter?: string; // for SLA per-source clicks
}

const KPI_DRILL_TITLES: Record<KpiDrillType, string> = {
  totalLeads: 'Total Leads',
  receitaTotal: 'Receita Total',
  dealsGanhos: 'Deals Ganhos',
  naoAcionados: 'Leads Não Acionados',
  tempoPrimeiroContato: 'Tempo até 1º Contato',
  tempoSQO: 'Tempo até SQO',
  tempoDescarte: 'Tempo até Descarte',
  slaFonteTotal: 'Total por Fonte',
  slaFonteNaoAcionados: 'Não Acionados por Fonte',
};

const KPI_DRILL_EXTRA_HEADERS: Partial<Record<KpiDrillType, string>> = {
  receitaTotal: 'Receita',
  tempoPrimeiroContato: 'Tempo',
  tempoSQO: 'Tempo',
  tempoDescarte: 'Tempo',
  naoAcionados: 'Espera',
};

// ---------- Main component ----------

export function ReportsMarketingSection() {
  const [datePeriod, setDatePeriod] = useState<DatePeriod>('month');
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [leadType, setLeadType] = useState<'all' | 'INBOUND' | 'OUTBOUND'>('INBOUND');
  const [utmMedium, setUtmMedium] = useState('all');
  const [utmSource, setUtmSource] = useState('all');
  const [drillDown, setDrillDown] = useState<{ source: string; column: DrillDownColumn } | null>(null);
  const [kpiDrill, setKpiDrill] = useState<KpiDrillState | null>(null);
  const queryClient = useQueryClient();

  const dateRange = useMemo(
    () => getDateRange(datePeriod, customDate),
    [datePeriod, customDate]
  );

  const { funnelBySource, campaignRows, kpis, rawLeads, oppsMap, slaMetrics, isLoading } = useMarketingReport({
    dateRange,
    leadType,
    utmMedium,
    utmSource,
  });

  // Extract unique UTM values for filter selects
  const utmMediumOptions = useMemo(() => {
    if (!rawLeads) return [];
    const set = new Set<string>();
    for (const l of rawLeads) {
      const m = (l as Record<string, unknown>).utm_medium as string | null;
      if (m) set.add(m);
    }
    return Array.from(set).sort();
  }, [rawLeads]);

  const utmSourceOptions = useMemo(() => {
    if (!rawLeads) return [];
    const set = new Set<string>();
    for (const l of rawLeads) {
      const s = (l as Record<string, unknown>).utm_source as string | null;
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [rawLeads]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['marketing-leads'] });
    queryClient.invalidateQueries({ queryKey: ['marketing-opportunities'] });
  }, [queryClient]);

  const chartData = useMemo(
    () =>
      (funnelBySource || []).slice(0, 10).map((row) => ({
        source: row.source.length > 15 ? row.source.substring(0, 15) + '…' : row.source,
        Leads: row.totalLeads,
        Reunião: row.reuniao,
        SQO: row.sqo,
        Ganho: row.ganho,
      })),
    [funnelBySource]
  );

  // ---------- Funnel drill-down ----------

  const drillDownLeads = useMemo<DrillDownLead[]>(() => {
    if (!drillDown || !rawLeads) return [];
    const { source, column } = drillDown;

    const sourceLeads = rawLeads.filter((l) => (l.source || 'Sem fonte') === source);

    return sourceLeads.filter((lead) => {
      switch (column) {
        case 'totalLeads':
          return true;
        case 'novo':
          return lead.status === 'Novo';
        case 'emContato':
          return CONTACT_STATUSES.includes(lead.status);
        case 'reuniao':
          return MEETING_STATUSES.includes(lead.status);
        case 'sqo':
          return !!lead.sqo_approved_at;
        case 'proposta': {
          const opps = oppsMap?.get(lead.id) || [];
          return opps.some((o) => ['Proposta', 'Negociação'].includes(o.stage));
        }
        case 'ganho': {
          const opps = oppsMap?.get(lead.id) || [];
          return opps.some((o) => o.stage === 'Ganho');
        }
        case 'perdido': {
          const opps = oppsMap?.get(lead.id) || [];
          return opps.some((o) => o.stage === 'Perdido');
        }
        case 'outros': {
          return lead.status !== 'Novo' && !CONTACT_STATUSES.includes(lead.status) && !MEETING_STATUSES.includes(lead.status);
        }
        case 'semUtm': {
          const camp = (lead as Record<string, unknown>).utm_campaign as string | null;
          return !camp;
        }
        default:
          return false;
      }
    }) as DrillDownLead[];
  }, [drillDown, rawLeads, oppsMap]);

  const openDrillDown = useCallback((source: string, column: DrillDownColumn) => {
    setDrillDown({ source, column });
  }, []);

  // ---------- KPI drill-down ----------

  const msToHours = (ms: number) => ms / (1000 * 60 * 60);
  const msToDays = (ms: number) => ms / (1000 * 60 * 60 * 24);

  const kpiDrillLeads = useMemo<DrillDownLead[]>(() => {
    if (!kpiDrill || !rawLeads) return [];
    const { type, sourceFilter } = kpiDrill;
    const now = Date.now();

    const applySourceFilter = (leads: typeof rawLeads) =>
      sourceFilter ? leads.filter(l => (l.source || 'Sem fonte') === sourceFilter) : leads;

    switch (type) {
      case 'totalLeads':
        return applySourceFilter(rawLeads).map(l => ({
          id: l.id, name: l.name, company: l.company, phone: l.phone,
          email: l.email, status: l.status, source: l.source || 'Sem fonte', created_at: l.created_at,
        }));

      case 'receitaTotal':
      case 'dealsGanhos': {
        const result: DrillDownLead[] = [];
        for (const lead of applySourceFilter(rawLeads)) {
          const opps = oppsMap?.get(lead.id) || [];
          const wonOpp = opps.find(o => o.stage === 'Ganho');
          if (wonOpp) {
            result.push({
              id: lead.id, name: lead.name, company: lead.company, phone: lead.phone,
              email: lead.email, status: lead.status, source: lead.source || 'Sem fonte', created_at: lead.created_at,
              extraValue: type === 'receitaTotal' ? fmtCurrency(wonOpp.deal_value || 0) : undefined,
            });
          }
        }
        return result;
      }

      case 'naoAcionados': {
        return applySourceFilter(rawLeads)
          .filter(l => l.status === 'Novo')
          .map(l => {
            const horasEspera = Math.round(msToHours(now - new Date(l.created_at).getTime()) * 10) / 10;
            return {
              id: l.id, name: l.name, company: l.company, phone: l.phone,
              email: l.email, status: l.status, source: l.source || 'Sem fonte', created_at: l.created_at,
              extraValue: horasEspera >= 24
                ? `${Math.floor(horasEspera / 24)}d ${Math.round(horasEspera % 24)}h`
                : `${horasEspera}h`,
            };
          })
          .sort((a, b) => {
            // Sort by wait time descending
            const aH = msToHours(now - new Date(a.created_at).getTime());
            const bH = msToHours(now - new Date(b.created_at).getTime());
            return bH - aH;
          });
      }

      case 'tempoPrimeiroContato': {
        return applySourceFilter(rawLeads)
          .filter(l => l.last_contact_at && l.status !== 'Novo')
          .map(l => {
            const diffMs = new Date(l.last_contact_at!).getTime() - new Date(l.created_at).getTime();
            const hours = Math.max(0, Math.round(msToHours(diffMs) * 10) / 10);
            return {
              id: l.id, name: l.name, company: l.company, phone: l.phone,
              email: l.email, status: l.status, source: l.source || 'Sem fonte', created_at: l.created_at,
              extraValue: hours >= 24 ? `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h` : `${hours}h`,
            };
          })
          .sort((a, b) => {
            const aT = new Date(a.created_at).getTime();
            const bT = new Date(b.created_at).getTime();
            return aT - bT;
          });
      }

      case 'tempoSQO': {
        return applySourceFilter(rawLeads)
          .filter(l => l.sqo_approved_at)
          .map(l => {
            const diffMs = new Date(l.sqo_approved_at!).getTime() - new Date(l.created_at).getTime();
            const days = Math.max(0, Math.round(msToDays(diffMs) * 10) / 10);
            return {
              id: l.id, name: l.name, company: l.company, phone: l.phone,
              email: l.email, status: l.status, source: l.source || 'Sem fonte', created_at: l.created_at,
              extraValue: `${days}d`,
            };
          });
      }

      case 'tempoDescarte': {
        return applySourceFilter(rawLeads)
          .filter(l => l.status === 'Descartado' && l.updated_at)
          .map(l => {
            const diffMs = new Date(l.updated_at!).getTime() - new Date(l.created_at).getTime();
            const days = Math.max(0, Math.round(msToDays(diffMs) * 10) / 10);
            return {
              id: l.id, name: l.name, company: l.company, phone: l.phone,
              email: l.email, status: l.status, source: l.source || 'Sem fonte', created_at: l.created_at,
              extraValue: `${days}d`,
            };
          });
      }

      case 'slaFonteTotal':
        return applySourceFilter(rawLeads).map(l => ({
          id: l.id, name: l.name, company: l.company, phone: l.phone,
          email: l.email, status: l.status, source: l.source || 'Sem fonte', created_at: l.created_at,
        }));

      case 'slaFonteNaoAcionados':
        return applySourceFilter(rawLeads)
          .filter(l => l.status === 'Novo')
          .map(l => {
            const horasEspera = Math.round(msToHours(now - new Date(l.created_at).getTime()) * 10) / 10;
            return {
              id: l.id, name: l.name, company: l.company, phone: l.phone,
              email: l.email, status: l.status, source: l.source || 'Sem fonte', created_at: l.created_at,
              extraValue: horasEspera >= 24
                ? `${Math.floor(horasEspera / 24)}d ${Math.round(horasEspera % 24)}h`
                : `${horasEspera}h`,
            };
          });

      default:
        return [];
    }
  }, [kpiDrill, rawLeads, oppsMap]);

  const kpiDrillTitle = useMemo(() => {
    if (!kpiDrill) return '';
    const base = KPI_DRILL_TITLES[kpiDrill.type];
    return kpiDrill.sourceFilter ? `${base} — ${kpiDrill.sourceFilter}` : base;
  }, [kpiDrill]);

  const openKpiDrill = useCallback((type: KpiDrillType, sourceFilter?: string) => {
    setKpiDrill({ type, sourceFilter });
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatório de Marketing"
        subtitle="Acompanhe o funil dos leads por fonte de origem, campanha e conversão em receita."
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={datePeriod} onValueChange={(v) => setDatePeriod(v as DatePeriod)}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <CalendarDays className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="quarter">Este trimestre</SelectItem>
            <SelectItem value="custom">Data específica</SelectItem>
          </SelectContent>
        </Select>

        {datePeriod === 'custom' && (
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-sm">
                {customDate ? format(customDate, 'dd/MM/yyyy') : 'Selecionar data'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={customDate}
                onSelect={(d) => { setCustomDate(d || undefined); setCalendarOpen(false); }}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        )}

        <Select value={leadType} onValueChange={(v) => setLeadType(v as 'all' | 'INBOUND' | 'OUTBOUND')}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="INBOUND">Inbound</SelectItem>
            <SelectItem value="OUTBOUND">Outbound</SelectItem>
          </SelectContent>
        </Select>
        {utmMediumOptions.length > 0 && (
          <Select value={utmMedium} onValueChange={setUtmMedium}>
            <SelectTrigger className="w-[150px] h-9 text-sm">
              <SelectValue placeholder="UTM Medium" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Medium: Todos</SelectItem>
              {utmMediumOptions.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {utmSourceOptions.length > 0 && (
          <Select value={utmSource} onValueChange={setUtmSource}>
            <SelectTrigger className="w-[150px] h-9 text-sm">
              <SelectValue placeholder="UTM Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Source: Todos</SelectItem>
              {utmSourceOptions.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button variant="ghost" size="sm" className="h-9" onClick={handleRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Atualizar
        </Button>

        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard
            title="Total Leads"
            value={fmt(kpis.totalLeads)}
            icon={<Users className="h-4 w-4" />}
            onClick={() => openKpiDrill('totalLeads')}
          />
          <KPICard title="Taxa SQL" value={fmtPct(kpis.taxaSQL)} icon={<Target className="h-4 w-4" />} subtitle="Reuniões / Leads" />
          <KPICard title="Taxa SQO" value={fmtPct(kpis.taxaSQO)} icon={<TrendingUp className="h-4 w-4" />} subtitle="SQO aprovados / Leads" />
          <KPICard title="Taxa Conversão" value={fmtPct(kpis.taxaConversao)} icon={<Megaphone className="h-4 w-4" />} subtitle="Ganhos / Leads" />
          <KPICard
            title="Receita Total"
            value={fmtCurrency(kpis.receitaTotal)}
            icon={<DollarSign className="h-4 w-4" />}
            onClick={() => openKpiDrill('receitaTotal')}
          />
          <KPICard
            title="Deals Ganhos"
            value={fmt(kpis.totalGanhos)}
            icon={<TrendingUp className="h-4 w-4" />}
            onClick={() => openKpiDrill('dealsGanhos')}
          />
        </div>
      )}

      <Tabs defaultValue="funnel" className="space-y-4">
        <TabsList>
         <TabsTrigger value="funnel">Funil por Fonte</TabsTrigger>
          <TabsTrigger value="sla">SLA & Atendimento</TabsTrigger>
          <TabsTrigger value="chart">Gráfico</TabsTrigger>
          {(campaignRows || []).length > 0 && (
            <TabsTrigger value="campaigns">Campanhas UTM</TabsTrigger>
          )}
        </TabsList>

        {/* Funnel table */}
        <TabsContent value="funnel">
          <Card className="border border-border rounded-2xl shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[160px]">Fonte</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Novo</TableHead>
                      <TableHead className="text-right">Em contato</TableHead>
                      <TableHead className="text-right">Reunião</TableHead>
                      <TableHead className="text-right">SQO</TableHead>
                      <TableHead className="text-right">Proposta</TableHead>
                      <TableHead className="text-right">Ganho</TableHead>
                      <TableHead className="text-right">Perdido</TableHead>
                      <TableHead className="text-right">Outros</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Conv. %</TableHead>
                      <TableHead className="text-right">Sem UTM</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(funnelBySource || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center text-muted-foreground py-10">
                          Nenhum lead encontrado no período selecionado
                        </TableCell>
                      </TableRow>
                    )}
                    {(funnelBySource || []).map((row) => (
                      <TableRow key={row.source}>
                        <TableCell className="font-medium">
                          <Badge variant="secondary" className="text-xs">{row.source}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <ClickableNumber value={row.totalLeads} className="font-semibold" onClick={() => openDrillDown(row.source, 'totalLeads')} />
                        </TableCell>
                        <TableCell className="text-right">
                          <ClickableNumber value={row.novo} onClick={() => openDrillDown(row.source, 'novo')} />
                        </TableCell>
                        <TableCell className="text-right">
                          <ClickableNumber value={row.emContato} onClick={() => openDrillDown(row.source, 'emContato')} />
                        </TableCell>
                        <TableCell className="text-right">
                          <ClickableNumber value={row.reuniao} onClick={() => openDrillDown(row.source, 'reuniao')} />
                        </TableCell>
                        <TableCell className="text-right">
                          <ClickableNumber value={row.sqo} onClick={() => openDrillDown(row.source, 'sqo')} />
                        </TableCell>
                        <TableCell className="text-right">
                          <ClickableNumber value={row.proposta} onClick={() => openDrillDown(row.source, 'proposta')} />
                        </TableCell>
                        <TableCell className="text-right">
                          <ClickableNumber
                            value={row.ganho}
                            className={cn(row.ganho > 0 && 'text-green-600 dark:text-green-400')}
                            onClick={() => openDrillDown(row.source, 'ganho')}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <ClickableNumber
                            value={row.perdido}
                            className={cn(row.perdido > 0 && 'text-destructive')}
                            onClick={() => openDrillDown(row.source, 'perdido')}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <ClickableNumber value={row.outros} className="text-muted-foreground" onClick={() => openDrillDown(row.source, 'outros')} />
                        </TableCell>
                        <TableCell className="text-right font-semibold">{fmtCurrency(row.receita)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={row.taxaConversao > 0 ? 'default' : 'secondary'} className="text-xs">
                            {fmtPct(row.taxaConversao)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {row.semUtm > 0 ? (
                            <button
                              type="button"
                              onClick={() => openDrillDown(row.source, 'semUtm')}
                              className="inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                            >
                              <Badge className="text-[10px] bg-warning/15 text-warning border-warning/30 hover:bg-warning/20">
                                {fmt(row.semUtm)}
                              </Badge>
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SLA & Atendimento */}
        <TabsContent value="sla">
          {slaMetrics && (
            <div className="space-y-6">
              {/* SLA KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card
                  className={cn(
                    "border rounded-2xl shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md hover:-translate-y-0.5",
                    slaMetrics.leadsNaoAcionados > 0 ? "border-destructive/40 bg-destructive/5" : "border-border"
                  )}
                  onClick={() => openKpiDrill('naoAcionados')}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Não acionados</span>
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center",
                        slaMetrics.leadsNaoAcionados > 0 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                      )}>
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                    </div>
                    <p className={cn(
                      "text-2xl font-bold tracking-tight underline decoration-dotted underline-offset-4 decoration-muted-foreground/40",
                      slaMetrics.leadsNaoAcionados > 0 ? "text-destructive" : "text-foreground"
                    )}>
                      {fmt(slaMetrics.leadsNaoAcionados)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Leads com status "Novo"</p>
                  </CardContent>
                </Card>

                <KPICard
                  title="Tempo 1º contato"
                  value={slaMetrics.tempoMedioPrimeiroContatoHoras !== null ? `${slaMetrics.tempoMedioPrimeiroContatoHoras}h` : '—'}
                  icon={<Clock className="h-4 w-4" />}
                  subtitle="Média em horas"
                  onClick={slaMetrics.tempoMedioPrimeiroContatoHoras !== null ? () => openKpiDrill('tempoPrimeiroContato') : undefined}
                />
                <KPICard
                  title="Tempo até SQO"
                  value={slaMetrics.tempoMedioSQODias !== null ? `${slaMetrics.tempoMedioSQODias}d` : '—'}
                  icon={<Timer className="h-4 w-4" />}
                  subtitle="Média em dias"
                  onClick={slaMetrics.tempoMedioSQODias !== null ? () => openKpiDrill('tempoSQO') : undefined}
                />
                <KPICard
                  title="Tempo até descarte"
                  value={slaMetrics.tempoMedioDescarteDias !== null ? `${slaMetrics.tempoMedioDescarteDias}d` : '—'}
                  icon={<XCircle className="h-4 w-4" />}
                  subtitle="Média em dias"
                  onClick={slaMetrics.tempoMedioDescarteDias !== null ? () => openKpiDrill('tempoDescarte') : undefined}
                />
              </div>

              {/* SLA por Fonte */}
              {slaMetrics.slaPorFonte.length > 0 && (
                <Card className="border border-border rounded-2xl shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">SLA por Fonte</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[160px]">Fonte</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Não acionados</TableHead>
                            <TableHead className="text-right">% Pendente</TableHead>
                            <TableHead className="text-right">Tempo médio 1º contato</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {slaMetrics.slaPorFonte.map((row) => (
                            <TableRow key={row.source}>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">{row.source}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <ClickableNumber
                                  value={row.total}
                                  className="font-medium"
                                  onClick={() => openKpiDrill('slaFonteTotal', row.source)}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <ClickableNumber
                                  value={row.naoAcionados}
                                  className={cn(row.naoAcionados > 0 && "text-destructive font-semibold")}
                                  onClick={() => openKpiDrill('slaFonteNaoAcionados', row.source)}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant={row.naoAcionados > 0 ? 'destructive' : 'secondary'} className="text-xs">
                                  {row.total > 0 ? fmtPct((row.naoAcionados / row.total) * 100) : '0%'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {row.tempoMedioPrimeiroContatoHoras !== null ? `${row.tempoMedioPrimeiroContatoHoras}h` : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Leads não acionados */}
              {slaMetrics.leadsNaoAcionadosList.length > 0 && (
                <Card className="border border-border rounded-2xl shadow-sm">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Leads aguardando primeiro contato
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => {
                        const rows = slaMetrics.leadsNaoAcionadosList.map(l => ({
                          Nome: l.name,
                          Empresa: l.company,
                          Telefone: l.phone || '',
                          'E-mail': l.email || '',
                          Fonte: l.source,
                          'Criado em': l.created_at ? format(new Date(l.created_at), 'dd/MM/yyyy HH:mm') : '',
                          'Horas de espera': l.horasEspera,
                        }));
                        const ws = XLSX.utils.json_to_sheet(rows);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, 'Não acionados');
                        XLSX.writeFile(wb, 'leads-nao-acionados.xlsx');
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Exportar
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead className="min-w-[180px]">Lead</TableHead>
                            <TableHead>Contato</TableHead>
                            <TableHead>Fonte</TableHead>
                            <TableHead className="text-right">Criado em</TableHead>
                            <TableHead className="text-right">Espera</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {slaMetrics.leadsNaoAcionadosList.map((lead) => (
                            <TableRow key={lead.id} className="hover:bg-muted/20 transition-colors">
                              <TableCell className="py-3">
                                <div>
                                  <p className="text-sm font-medium text-foreground leading-tight">{lead.name}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{lead.company || '—'}</p>
                                </div>
                              </TableCell>
                              <TableCell className="py-3">
                                <div className="space-y-0.5">
                                  {lead.phone && <p className="text-xs text-muted-foreground tabular-nums">{lead.phone}</p>}
                                  {lead.email && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{lead.email}</p>}
                                </div>
                              </TableCell>
                              <TableCell className="py-3">
                                <Badge variant="secondary" className="text-[10px]">{lead.source}</Badge>
                              </TableCell>
                              <TableCell className="py-3 text-right">
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {format(new Date(lead.created_at), 'dd/MM HH:mm')}
                                </span>
                              </TableCell>
                              <TableCell className="py-3 text-right">
                                <Badge variant={lead.horasEspera > 24 ? 'destructive' : lead.horasEspera > 4 ? 'default' : 'secondary'} className="text-xs tabular-nums">
                                  {lead.horasEspera >= 24
                                    ? `${Math.round(lead.horasEspera / 24)}d ${Math.round(lead.horasEspera % 24)}h`
                                    : `${lead.horasEspera}h`}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="chart">
          <Card className="border border-border rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Funil por Fonte (Top 10)</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">Sem dados para o período</p>
              ) : (
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Reunião" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="SQO" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Ganho" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* UTM Campaigns */}
        {(campaignRows || []).length > 0 && (
          <TabsContent value="campaigns">
            <Card className="border border-border rounded-2xl shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Campanha</TableHead>
                        <TableHead className="min-w-[150px]">Fonte</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Reunião</TableHead>
                        <TableHead className="text-right">SQO</TableHead>
                        <TableHead className="text-right">Ganho</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-right">Conv. %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(campaignRows || []).map((row) => (
                        <TableRow key={row.campaign}>
                          <TableCell className="font-medium">{row.campaign}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {row.sources.map((src) => (
                                <Badge key={src} variant="secondary" className="text-xs">
                                  {src}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{fmt(row.totalLeads)}</TableCell>
                          <TableCell className="text-right">{fmt(row.reuniao)}</TableCell>
                          <TableCell className="text-right">{fmt(row.sqo)}</TableCell>
                          <TableCell className="text-right">
                            <span className={cn(row.ganho > 0 && 'text-green-600 dark:text-green-400 font-semibold')}>
                              {fmt(row.ganho)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{fmtCurrency(row.receita)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={row.taxaConversao > 0 ? 'default' : 'secondary'} className="text-xs">
                              {fmtPct(row.taxaConversao)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Funnel drill-down modal */}
      <DrillDownModal
        open={!!drillDown}
        onOpenChange={(open) => { if (!open) setDrillDown(null); }}
        title={drillDown ? `${drillDown.source} — ${COLUMN_LABELS[drillDown.column]}` : ''}
        leads={drillDownLeads}
      />

      {/* KPI drill-down modal */}
      <DrillDownModal
        open={!!kpiDrill}
        onOpenChange={(open) => { if (!open) setKpiDrill(null); }}
        title={kpiDrillTitle}
        leads={kpiDrillLeads}
        extraColumnHeader={kpiDrill ? KPI_DRILL_EXTRA_HEADERS[kpiDrill.type] : undefined}
      />
    </div>
  );
}
