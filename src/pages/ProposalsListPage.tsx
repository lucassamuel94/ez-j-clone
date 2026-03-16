import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { AppLayout } from '@/components/AppLayout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Eye, Copy, ExternalLink, Trash2, Pencil, Search,
  RefreshCw, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';

import { useIsMobile } from '@/hooks/use-mobile';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDateTime = (d: string) => {
  const date = new Date(d);
  return {
    date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
};

type PeriodFilter = 'today' | 'yesterday' | 'last_week' | 'last_15' | 'this_month' | 'last_month' | 'all';

const periodFilters: { label: string; value: PeriodFilter }[] = [
  { label: 'Hoje', value: 'today' },
  { label: 'Ontem', value: 'yesterday' },
  { label: 'Sem. Passada', value: 'last_week' },
  { label: 'Últ. Quinzena', value: 'last_15' },
  { label: 'Este Mês', value: 'this_month' },
  { label: 'Mês Passado', value: 'last_month' },
  { label: 'Tudo', value: 'all' },
];

const getDateRange = (period: PeriodFilter): { from: Date | null; to: Date } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(today.getTime() + 86400000);

  switch (period) {
    case 'today':
      return { from: today, to };
    case 'yesterday': {
      const y = new Date(today.getTime() - 86400000);
      return { from: y, to: today };
    }
    case 'last_week': {
      const lw = new Date(today.getTime() - 7 * 86400000);
      return { from: lw, to };
    }
    case 'last_15': {
      const l15 = new Date(today.getTime() - 15 * 86400000);
      return { from: l15, to };
    }
    case 'this_month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
    case 'last_month': {
      const firstLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: firstLastMonth, to: firstThisMonth };
    }
    case 'all':
      return { from: null, to };
  }
};

const PAGE_SIZE = 15;

/* ─── Metric Pill ─── */
const MetricPill = ({ label, value, ariaLabel }: { label: string; value: number | string; ariaLabel?: string }) => (
  <div
    className="flex flex-col items-center gap-0.5 bg-muted/40 rounded-xl px-4 py-3 min-w-[100px] snap-start"
    role="group"
    aria-label={ariaLabel || `${label}: ${value}`}
  >
    <span className="text-base md:text-lg font-semibold text-foreground tabular-nums">{value}</span>
    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">{label}</span>
  </div>
);

const ProposalsListPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [period, setPeriod] = useState<PeriodFilter>('this_month');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [executiveFilter, setExecutiveFilter] = useState('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [summaryProposal, setSummaryProposal] = useState<any | null>(null);
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [viewsProposalId, setViewsProposalId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const { data: proposalViews = [], isLoading: viewsLoading } = useQuery({
    queryKey: ['proposal-views', viewsProposalId],
    queryFn: async () => {
      if (!viewsProposalId) return [];
      const { data, error } = await supabase
        .from('proposal_views')
        .select('*')
        .eq('proposal_id', viewsProposalId)
        .order('viewed_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!viewsProposalId,
  });

  const { data: proposals = [], isLoading, refetch } = useQuery({
    queryKey: ['proposals-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { from, to } = getDateRange(period);

  // Reset page when filters change
  const filterKey = `${from?.getTime()}-${to.getTime()}-${search}-${statusFilter}-${executiveFilter}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(0);
  }

  const filtered = useMemo(() => {
    return proposals.filter((p: any) => {
      const created = new Date(p.created_at);
      if (from && created < from) return false;
      if (created > to) return false;
      if (search) {
        const s = search.toLowerCase();
        const matchFields = [
          p.company_name, p.contact_name, p.closer_name, p.sdr_name,
          p.cnpj, p.plan_name, p.id,
        ].filter(Boolean).map((f: string) => f.toLowerCase());
        if (!matchFields.some(f => f.includes(s))) return false;
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (executiveFilter !== 'all' && p.closer_name !== executiveFilter) return false;
      return true;
    });
  }, [proposals, from, to, search, statusFilter, executiveFilter]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const sorted = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case 'code': valA = a.created_at; valB = b.created_at; break;
        case 'client': valA = (a.company_name || '').toLowerCase(); valB = (b.company_name || '').toLowerCase(); break;
        case 'executive': valA = (a.closer_name || '').toLowerCase(); valB = (b.closer_name || '').toLowerCase(); break;
        case 'product': valA = (a.plan_name || '').toLowerCase(); valB = (b.plan_name || '').toLowerCase(); break;
        case 'value': valA = (a.setup_total || 0) + (a.total_monthly || 0); valB = (b.setup_total || 0) + (b.total_monthly || 0); break;
        case 'views': valA = a.view_count || 0; valB = b.view_count || 0; break;
        case 'status': valA = a.status; valB = b.status; break;
        case 'created_at': valA = a.created_at; valB = b.created_at; break;
        default: return 0;
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const showingFrom = sorted.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, sorted.length);

  const stats = useMemo(() => {
    const periodProposals = proposals.filter((p: any) => {
      const created = new Date(p.created_at);
      if (from && created < from) return false;
      if (created > to) return false;
      return true;
    });
    return {
      total: periodProposals.length,
      viewed: periodProposals.filter((p: any) => p.status === 'viewed' || p.status === 'accepted').length,
      sent: periodProposals.filter((p: any) => p.status === 'sent').length,
      interested: periodProposals.filter((p: any) => p.status === 'accepted').length,
    };
  }, [proposals, from, to]);

  const executives = useMemo(() => {
    const names = new Set<string>();
    proposals.forEach((p: any) => { if (p.closer_name) names.add(p.closer_name); });
    return Array.from(names).sort();
  }, [proposals]);

  const handleCopyLink = (id: string) => {
    const url = `${window.location.origin}/proposal-preview/${id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('proposals').delete().eq('id', deleteId);
    if (error) {
      toast.error('Erro ao deletar proposta');
    } else {
      toast.success('Proposta deletada');
      queryClient.invalidateQueries({ queryKey: ['proposals-list'] });
    }
    setDeleteId(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary">Rascunho</Badge>;
      case 'sent': return <Badge variant="outline">Criada</Badge>;
      case 'viewed': return <Badge className="bg-chart-3/20 text-chart-3 border-chart-3/30">Visualizada</Badge>;
      case 'accepted': return <Badge className="bg-chart-1/20 text-chart-1 border-chart-1/30">Aceita</Badge>;
      case 'rejected': return <Badge variant="destructive">Recusada</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const generateProposalCode = (p: any) => {
    const date = new Date(p.created_at);
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
    const shortId = p.id.slice(0, 5).toUpperCase();
    return `EZ-${dateStr}-${timeStr}-${shortId}`;
  };

  const getProductLabel = (p: any) =>
    p.product_type === 'evolucao_ez_chat' ? 'Evolução EZ Chat' : p.plan_name?.startsWith('EZ Call') ? 'EZ Call' : 'EZ Chat';

  /* ─── Actions Dropdown (shared desktop & mobile) ─── */
  const ActionsMenu = ({ p }: { p: any }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Ações da proposta"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => navigate(`/proposal/${p.id}`)}>
          <Pencil className="h-4 w-4 mr-2" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCopyLink(p.id)}>
          <Copy className="h-4 w-4 mr-2" /> Copiar link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open(`/proposal-preview/${p.id}`, '_blank')}>
          <ExternalLink className="h-4 w-4 mr-2" /> Abrir proposta
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setSummaryProposal(p)}>
          <Eye className="h-4 w-4 mr-2" /> Ver resumo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setViewsProposalId(p.id)}>
          <Eye className="h-4 w-4 mr-2" /> Views ({p.view_count || 0})
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setDeleteId(p.id)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" /> Deletar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        {/* ═══ Sticky Header ═══ */}
        <div className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-3 sm:px-4 py-3">
            <PageHeader
              icon={<FileText className="h-5 w-5" strokeWidth={1.5} />}
              title="Propostas Comerciais"
              actions={
                <>
                  
                </>
              }
              toolbar={
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    Para gerar uma nova proposta, acesse o pipeline do Closer e abra o modal do cliente desejado.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Period Select */}
                    <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
                      <SelectTrigger className="w-[140px] h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {periodFilters.map(f => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Search */}
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar empresa, contato..."
                        className="pl-8 h-9 text-xs"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>
                    {/* Executive Filter */}
                    <Select value={executiveFilter} onValueChange={setExecutiveFilter}>
                      <SelectTrigger className="w-[150px] h-9 text-xs">
                        <SelectValue placeholder="Executivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos Executivos</SelectItem>
                        {executives.map(name => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Status Filter */}
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[130px] h-9 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos Status</SelectItem>
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="sent">Criada</SelectItem>
                        <SelectItem value="viewed">Visualizada</SelectItem>
                        <SelectItem value="accepted">Aceita</SelectItem>
                        <SelectItem value="rejected">Recusada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              }
            />
          </div>
        </div>

        <main className="container mx-auto px-3 sm:px-4 py-3 space-y-3 pb-24">
          {/* ═══ MetricStrip ═══ */}
          <div className="flex gap-2 overflow-x-auto pb-1 snap-x scrollbar-none -mx-1 px-1">
            <MetricPill label="Total" value={stats.total} />
            <MetricPill label="Enviadas" value={stats.sent} />
            <MetricPill label="Visualizadas" value={stats.viewed} />
            <MetricPill label="Com Interesse" value={stats.interested} />
          </div>

          {/* ═══ Data: Mobile Cards / Desktop Table ═══ */}
          {isMobile ? (
            /* ── Mobile Card List ── */
            <div className="space-y-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Carregando propostas...</p>
              ) : paginated.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <FileText className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Nenhuma proposta encontrada</p>
                </div>
              ) : (
                paginated.map((p: any) => {
                  const dt = formatDateTime(p.created_at);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-card hover:bg-accent/50 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
                      tabIndex={0}
                      onClick={() => setSummaryProposal(p)}
                      onKeyDown={e => e.key === 'Enter' && setSummaryProposal(p)}
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {p.company_name || '—'}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {getProductLabel(p)}
                          </Badge>
                          {getStatusBadge(p.status)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground tabular-nums">
                            {formatCurrency(p.setup_total || 0)}
                          </span>
                          <span>{dt.date}</span>
                          {(p.view_count || 0) > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Eye className="h-3 w-3" /> {p.view_count}
                            </span>
                          )}
                        </div>
                      </div>
                      <div onClick={e => e.stopPropagation()}>
                        <ActionsMenu p={p} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* ── Desktop Table ── */
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort('code')}>
                        <span className="flex items-center">PROPOSTA<SortIcon column="code" /></span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort('client')}>
                        <span className="flex items-center">CLIENTE<SortIcon column="client" /></span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort('executive')}>
                        <span className="flex items-center">EXECUTIVO<SortIcon column="executive" /></span>
                      </TableHead>
                      <TableHead className="text-center cursor-pointer select-none" onClick={() => handleSort('product')}>
                        <span className="flex items-center justify-center">PRODUTO<SortIcon column="product" /></span>
                      </TableHead>
                      <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('value')}>
                        <span className="flex items-center justify-end">VALOR<SortIcon column="value" /></span>
                      </TableHead>
                      <TableHead className="text-center cursor-pointer select-none" onClick={() => handleSort('views')}>
                        <span className="flex items-center justify-center">VIEWS<SortIcon column="views" /></span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status')}>
                        <span className="flex items-center">STATUS<SortIcon column="status" /></span>
                      </TableHead>
                      <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('created_at')}>
                        <span className="flex items-center justify-end">CRIADA EM<SortIcon column="created_at" /></span>
                      </TableHead>
                      <TableHead className="text-right w-[60px]">AÇÕES</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          Carregando propostas...
                        </TableCell>
                      </TableRow>
                    ) : paginated.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          Nenhuma proposta encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginated.map((p: any) => {
                        const dt = formatDateTime(p.created_at);
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {generateProposalCode(p)}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm text-foreground">{p.company_name || '—'}</p>
                                {p.contact_name && (
                                  <p className="text-xs text-muted-foreground">{p.contact_name}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-foreground">{p.closer_name || '—'}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                                  {getProductLabel(p)}
                                </Badge>
                                <p className="text-xs text-muted-foreground">{p.plan_name || '—'}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div>
                                <p className="font-semibold text-sm text-foreground tabular-nums">{formatCurrency(p.setup_total || 0)}</p>
                                <p className="text-xs text-muted-foreground tabular-nums">+{formatCurrency(p.total_monthly || 0)}/mês</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs font-medium min-h-[44px]"
                                onClick={() => setViewsProposalId(p.id)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                {p.view_count || 0}
                              </Button>
                            </TableCell>
                            <TableCell>{getStatusBadge(p.status)}</TableCell>
                            <TableCell className="text-right">
                              <p className="text-sm text-foreground">{dt.date}</p>
                              <p className="text-xs text-muted-foreground">{dt.time}</p>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end">
                                <ActionsMenu p={p} />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* ═══ Pagination ═══ */}
          {sorted.length > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground tabular-nums">
                Mostrando {showingFrom}–{showingTo} de {sorted.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 min-h-[44px] min-w-[44px]"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground px-2 tabular-nums">
                  {page + 1}/{totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 min-h-[44px] min-w-[44px]"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </main>

        {/* ═══ Delete Confirmation ═══ */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deletar proposta?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A proposta será removida permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Deletar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ═══ Summary Dialog ═══ */}
        <Dialog open={!!summaryProposal} onOpenChange={() => setSummaryProposal(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Resumo da Proposta</DialogTitle>
            </DialogHeader>
            {summaryProposal && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Empresa</span>
                  <span className="font-medium text-foreground">{summaryProposal.company_name}</span>
                </div>
                {summaryProposal.contact_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contato</span>
                    <span className="font-medium text-foreground">{summaryProposal.contact_name}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plano</span>
                  <span className="font-medium text-foreground">{summaryProposal.plan_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Setup</span>
                  <span className="font-medium text-foreground">{formatCurrency(summaryProposal.setup_total || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mensal</span>
                  <span className="font-medium text-foreground">{formatCurrency(summaryProposal.total_monthly || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Custo Meta</span>
                  <span className="font-medium text-foreground">{formatCurrency(summaryProposal.meta_cost || 0)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Executivo</span>
                  <span className="font-medium text-foreground">{summaryProposal.closer_name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  {getStatusBadge(summaryProposal.status)}
                </div>
                {summaryProposal.project_objective && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground mb-1">Objetivo do Projeto</p>
                      <p className="text-foreground text-xs">{summaryProposal.project_objective}</p>
                    </div>
                  </>
                )}
                {summaryProposal.notes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground mb-1">Observações</p>
                      <p className="text-foreground text-xs">{summaryProposal.notes}</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ═══ Views Detail Dialog ═══ */}
        <Dialog open={!!viewsProposalId} onOpenChange={() => setViewsProposalId(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Histórico de Visualizações
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto">
              {viewsLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
              ) : proposalViews.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma visualização registrada</p>
              ) : (
                <div className="space-y-2">
                  {proposalViews.map((v: any, i: number) => {
                    const date = new Date(v.viewed_at);
                    const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
                    const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' });
                    const viewIsMobile = v.user_agent?.match(/Mobile|Android|iPhone/i);
                    const browser = v.user_agent?.match(/(Chrome|Firefox|Safari|Edge|Opera)/i)?.[1] || 'Desconhecido';
                    return (
                      <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {proposalViews.length - i}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{formattedDate} às {formattedTime}</p>
                            <p className="text-xs text-muted-foreground">
                              {viewIsMobile ? '📱 Mobile' : '💻 Desktop'} • {browser}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground text-center">
              Total: {proposalViews.length} visualização(ões)
            </p>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default ProposalsListPage;
