import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePermissions } from '@/hooks/usePermissions';
import { useUserRole } from '@/hooks/useUserRole';
import { useMyClients, type MyClient } from '@/hooks/useMyClients';
import { useSystemUsers } from '@/hooks/useSystemUsers';
import { ClientPortfolioModal } from '@/components/clients/ClientPortfolioModal';
import { createDealFromActiveClient } from '@/services/closerService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/PageHeader';
import { AppLayout } from '@/components/AppLayout';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Loader2, Search, UserCheck, Building2, MapPin, FolderKanban, Rocket,
  ChevronLeft, ChevronRight, Plus,
} from 'lucide-react';

const formatCnpj = (cnpj: string) => {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

const formatRelative = (days: number | null) => {
  if (days === null) return '—';
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}m`;
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: 'Ativo', className: 'bg-success/10 text-success border-success/20' },
  cancelled: { label: 'Cancelado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const PAGE_SIZE_KEY = 'my_clients_page_size';

function loadPageSize(): number {
  try {
    const v = localStorage.getItem(PAGE_SIZE_KEY);
    if (v) return parseInt(v, 10);
  } catch { /* noop */ }
  return 20;
}

export default function SDRMyClientsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { hasPermission } = usePermissions();
  const { isCloser, isSdr } = useUserRole();
  const isAdminOrManager = hasPermission('access_admin');
  const canEditClient = isAdminOrManager || isCloser;

  const viewMode = isAdminOrManager ? 'admin' : isCloser ? 'closer' : 'sdr';

  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<MyClient | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(loadPageSize);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOwnerId, setBulkOwnerId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [creatingDeal, setCreatingDeal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [closerFilter, setCloserFilter] = useState<string>('all');

  const { data: clients = [], isLoading, refetch } = useMyClients(user?.id ?? null, viewMode);
  const { data: systemUsers = [] } = useSystemUsers();

  // Deep-link: open client modal from ?account=ID
  useEffect(() => {
    const accountId = searchParams.get('account');
    if (!accountId || selectedClient) return;

    const found = clients.find(c => c.id === accountId);
    if (found) {
      setSelectedClient(found);
    } else if (!isLoading && clients.length > 0) {
      supabase
        .from('accounts')
        .select('id, company_name, cnpj, city, state, lifecycle_stage, account_owner_id, status')
        .eq('id', accountId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setSelectedClient({
              id: data.id,
              company_name: data.company_name,
              cnpj: data.cnpj,
              city: data.city,
              state: data.state,
              lifecycle_stage: data.lifecycle_stage,
              situacao_cadastral: null,
              account_owner_id: data.account_owner_id,
              account_owner_name: null,
              closer_name: null,
              sdr_name: null,
              won_at: null,
              deal_value: null,
              total_revenue: 0,
              active_projects_count: 0,
              evolution_count: 0,
              last_activity_date: null,
              days_since_last_activity: null,
              health_score: 50,
              health_label: 'yellow',
              products: [],
              status: data.status || 'active',
            } as MyClient);
          }
        });
    }
  }, [searchParams, clients, isLoading, selectedClient]);

  // Unique closers for filter dropdown
  const closerOptions = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach(c => {
      if (c.account_owner_id && c.closer_name) map.set(c.account_owner_id, c.closer_name);
    });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [clients]);

  const filtered = useMemo(() => {
    let result = clients;

    if (statusFilter !== 'all') {
      result = result.filter(c => (c.status || 'active') === statusFilter);
    }
    if (closerFilter !== 'all') {
      result = result.filter(c => c.account_owner_id === closerFilter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      const qDigits = q.replace(/\D/g, '');
      result = result.filter(c => {
        if (c.company_name?.toLowerCase().includes(q)) return true;
        if (c.city?.toLowerCase().includes(q)) return true;
        if (c.closer_name?.toLowerCase().includes(q)) return true;
        if (c.sdr_name?.toLowerCase().includes(q)) return true;
        // CNPJ: compare normalized digits
        if (c.cnpj && qDigits.length >= 3) {
          const cnpjDigits = c.cnpj.replace(/\D/g, '');
          if (cnpjDigits.includes(qDigits)) return true;
        }
        if (c.cnpj?.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    return result;
  }, [clients, search, statusFilter, closerFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const totalRevenue = useMemo(
    () => filtered.reduce((sum, c) => sum + c.total_revenue, 0),
    [filtered],
  );

  const avgHealth = useMemo(() => {
    if (filtered.length === 0) return 0;
    return Math.round(filtered.reduce((sum, c) => sum + c.health_score, 0) / filtered.length);
  }, [filtered]);

  const handleRowClick = useCallback((client: MyClient) => {
    setSelectedClient(client);
  }, []);

  const handleNewDeal = useCallback(async (clientId: string) => {
    if (creatingDeal) return;
    setCreatingDeal(true);
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) throw new Error('Usuário não autenticado');
      await createDealFromActiveClient(clientId, authUser.id, 'evolution');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['closer-opportunities'] }),
        queryClient.invalidateQueries({ queryKey: ['closer-opportunities-paginated'] }),
        queryClient.invalidateQueries({ queryKey: ['closer-tab-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['closer-kanban-data'] }),
        queryClient.invalidateQueries({ queryKey: ['client_deals'] }),
        queryClient.invalidateQueries({ queryKey: ['my-clients'] }),
      ]);
      toast.success('Negociação criada com sucesso!');
      setSelectedClient(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar negociação';
      toast.error(message);
    } finally {
      setCreatingDeal(false);
    }
  }, [creatingDeal, queryClient]);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handlePageSizeChange = useCallback((val: string) => {
    const n = Number(val);
    setPageSize(n);
    setPage(1);
    localStorage.setItem(PAGE_SIZE_KEY, val);
  }, []);

  // Selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === paginated.length) return new Set();
      return new Set(paginated.map(c => c.id));
    });
  }, [paginated]);

  // Single closer assign (optimistic)
  const handleSingleAssign = useCallback(async (clientId: string, ownerId: string) => {
    const newOwnerId = ownerId === '__none__' ? null : ownerId;
    const newOwnerName = systemUsers.find(u => u.id === newOwnerId)?.name || null;

    // Optimistic update
    queryClient.setQueryData<MyClient[]>(['my-clients', user?.id, viewMode], (old) =>
      old?.map(c => c.id === clientId ? { ...c, account_owner_id: newOwnerId, closer_name: newOwnerName, account_owner_name: newOwnerName } : c)
    );

    const { error } = await supabase
      .from('accounts')
      .update({ account_owner_id: newOwnerId })
      .eq('id', clientId);
    if (error) {
      toast.error('Erro ao atribuir closer');
      queryClient.invalidateQueries({ queryKey: ['my-clients'] });
    }
  }, [queryClient, systemUsers, user?.id, viewMode]);

  // Bulk closer assign
  const handleBulkAssign = useCallback(async () => {
    if (!bulkOwnerId || selectedIds.size === 0) return;
    setAssigning(true);
    try {
      const ids = Array.from(selectedIds);
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const { error } = await supabase
          .from('accounts')
          .update({ account_owner_id: bulkOwnerId === '__none__' ? null : bulkOwnerId })
          .in('id', chunk);
        if (error) throw error;
      }
      toast.success(`${ids.length} cliente(s) atualizado(s)`);
      setSelectedIds(new Set());
      setBulkOwnerId('');
      queryClient.invalidateQueries({ queryKey: ['my-clients'] });
    } catch (err: any) {
      toast.error('Erro ao atribuir: ' + (err.message || 'Erro'));
    } finally {
      setAssigning(false);
    }
  }, [bulkOwnerId, selectedIds, queryClient]);

  // Single status change (optimistic)
  const handleStatusChange = useCallback(async (clientId: string, status: string) => {
    // Optimistic update
    queryClient.setQueryData<MyClient[]>(['my-clients', user?.id, viewMode], (old) =>
      old?.map(c => c.id === clientId ? { ...c, status } : c)
    );

    const { error } = await supabase
      .from('accounts')
      .update({ status })
      .eq('id', clientId);
    if (error) {
      toast.error('Erro ao atualizar status');
      queryClient.invalidateQueries({ queryKey: ['my-clients'] });
    }
  }, [queryClient, user?.id, viewMode]);

  const subtitle = viewMode === 'admin'
    ? 'Todos os clientes ativos da base'
    : viewMode === 'closer'
      ? 'Clientes da sua carteira'
      : 'Clientes originados de leads que você qualificou';

  const colSpan = (isAdminOrManager ? 12 : 11);

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="px-3 sm:px-4 py-3">
            <PageHeader
              title="Meus Clientes"
              subtitle={subtitle}
              icon={<UserCheck className="h-5 w-5" />}
              actions={
                <Button size="sm" className="h-8 text-xs font-medium gap-1.5" disabled={creatingDeal} onClick={() => {
                  // Placeholder — New deal flow needs a selected client
                  toast.info('Selecione um cliente na tabela para criar uma negociação');
                }}>
                  <Rocket className="h-3.5 w-3.5" />
                  Nova negociação
                </Button>
              }
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="py-3 px-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Clientes</p>
                <p className="text-2xl font-bold">{isLoading ? '—' : filtered.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Receita total</p>
                <p className="text-2xl font-bold text-success">{isLoading ? '—' : formatCurrency(totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saúde média</p>
                <div className="flex items-center gap-2">
                  <div className={cn('h-3 w-3 rounded-full', {
                    'bg-success': avgHealth >= 70,
                    'bg-warning': avgHealth >= 40 && avgHealth < 70,
                    'bg-destructive': avgHealth < 40,
                  })} />
                  <p className="text-2xl font-bold">{isLoading ? '—' : avgHealth}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Evoluções ativas</p>
                <p className="text-2xl font-bold">{isLoading ? '—' : filtered.reduce((s, c) => s + c.evolution_count, 0)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Search + Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative max-w-sm flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa, CNPJ, cidade, closer..."
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={val => { setStatusFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={closerFilter} onValueChange={val => { setCloserFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <SelectValue placeholder="Closer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os closers</SelectItem>
                {closerOptions.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bulk assign bar */}
          {selectedIds.size > 0 && isAdminOrManager && (
            <Card>
              <CardContent className="py-3 flex items-center gap-4">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{selectedIds.size} selecionado(s)</span>
                <Select value={bulkOwnerId} onValueChange={setBulkOwnerId}>
                  <SelectTrigger className="h-8 w-[200px] text-xs">
                    <SelectValue placeholder="Selecionar closer..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">Remover atribuição</span>
                    </SelectItem>
                    {systemUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleBulkAssign} disabled={!bulkOwnerId || assigning}>
                  {assigning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Atribuir
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedIds(new Set()); setBulkOwnerId(''); }}>
                  Cancelar
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <div className="border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {isAdminOrManager && (
                    <TableHead className="text-xs w-10">
                      <Checkbox
                        checked={paginated.length > 0 && selectedIds.size === paginated.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                  )}
                  <TableHead className="text-xs w-5" />
                  <TableHead className="text-xs">Empresa</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Cidade/UF</TableHead>
                  <TableHead className="text-xs">Closer</TableHead>
                  {isAdminOrManager && <TableHead className="text-xs">SDR</TableHead>}
                  <TableHead className="text-xs">Produtos</TableHead>
                  <TableHead className="text-xs text-center">Projetos</TableHead>
                  <TableHead className="text-xs text-center">Evoluções</TableHead>
                  <TableHead className="text-xs text-center">Atividade</TableHead>
                  <TableHead className="text-xs text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={colSpan} className="text-center py-10">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Carregando...</span>
                    </TableCell>
                  </TableRow>
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colSpan} className="text-center py-14">
                      <Building2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {search ? 'Nenhum resultado para esta busca' : 'Nenhum cliente na carteira'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map(client => (
                    <TableRow
                      key={client.id}
                      className="group cursor-pointer hover:bg-accent/30 transition-colors"
                      onClick={() => handleRowClick(client)}
                    >
                      {/* Checkbox */}
                      {isAdminOrManager && (
                        <TableCell className="py-2.5" onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(client.id)}
                            onCheckedChange={() => toggleSelect(client.id)}
                          />
                        </TableCell>
                      )}
                      {/* Health dot */}
                      <TableCell className="py-2.5 pr-0">
                        <div className={cn('h-2.5 w-2.5 rounded-full mx-auto', {
                          'bg-success': client.health_label === 'green',
                          'bg-warning': client.health_label === 'yellow',
                          'bg-destructive': client.health_label === 'red',
                        })} title={`Saúde: ${client.health_score}`} />
                      </TableCell>
                      {/* Empresa */}
                      <TableCell className="py-2.5">
                        <div>
                          <p className="text-sm font-medium">{client.company_name}</p>
                          {client.cnpj && (
                            <p className="text-[10px] font-mono text-muted-foreground">{formatCnpj(client.cnpj)}</p>
                          )}
                        </div>
                      </TableCell>
                      {/* Status */}
                      <TableCell className="py-2.5" onClick={e => e.stopPropagation()}>
                        {canEditClient ? (
                          <Select
                            value={client.status || 'active'}
                            onValueChange={val => handleStatusChange(client.id, val)}
                          >
                            <SelectTrigger className="h-7 w-[110px] text-xs border-dashed">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                                <SelectItem key={key} value={key}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={cn('text-[10px] border', (STATUS_CONFIG[client.status || 'active'] || STATUS_CONFIG.active).className)}>
                            {(STATUS_CONFIG[client.status || 'active'] || STATUS_CONFIG.active).label}
                          </Badge>
                        )}
                      </TableCell>
                      {/* Cidade */}
                      <TableCell className="text-xs py-2.5">
                        {client.city && client.state ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {client.city}/{client.state}
                          </span>
                        ) : '—'}
                      </TableCell>
                      {/* Closer */}
                      <TableCell className="text-xs py-2.5" onClick={e => e.stopPropagation()}>
                        {canEditClient ? (
                          <Select
                            value={client.account_owner_id || '__none__'}
                            onValueChange={val => handleSingleAssign(client.id, val)}
                          >
                            <SelectTrigger className="h-7 w-full text-xs border-dashed">
                              <SelectValue placeholder="Não atribuído" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">
                                <span className="text-muted-foreground">Não atribuído</span>
                              </SelectItem>
                              {systemUsers.map(u => (
                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-muted-foreground">{client.closer_name || 'Não atribuído'}</span>
                        )}
                      </TableCell>
                      {/* SDR (admin only) */}
                      {isAdminOrManager && (
                        <TableCell className="text-xs py-2.5">
                          {client.sdr_name || '—'}
                        </TableCell>
                      )}
                      {/* Produtos */}
                      <TableCell className="py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {client.products.length > 0 ? client.products.map(p => (
                            <Badge key={p} variant="outline" className="text-[9px] h-4 px-1.5">{p}</Badge>
                          )) : <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      {/* Projetos */}
                      <TableCell className="text-center py-2.5">
                        {client.active_projects_count > 0 ? (
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 border-info/30 text-info">
                            <FolderKanban className="h-2.5 w-2.5" />{client.active_projects_count}
                          </Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      {/* Evoluções */}
                      <TableCell className="text-center py-2.5">
                        {client.evolution_count > 0 ? (
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 border-primary/30 text-primary">
                            <Rocket className="h-2.5 w-2.5" />{client.evolution_count}
                          </Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      {/* Última atividade */}
                      <TableCell className="text-center py-2.5">
                        <span className={cn('text-xs', {
                          'text-success': client.days_since_last_activity !== null && client.days_since_last_activity <= 7,
                          'text-warning': client.days_since_last_activity !== null && client.days_since_last_activity > 7 && client.days_since_last_activity <= 30,
                          'text-destructive': client.days_since_last_activity !== null && client.days_since_last_activity > 30,
                          'text-muted-foreground': client.days_since_last_activity === null,
                        })}>
                          {formatRelative(client.days_since_last_activity)}
                        </span>
                      </TableCell>
                      {/* Receita */}
                      <TableCell className="text-xs py-2.5 text-right font-medium">
                        {client.total_revenue > 0 ? (
                          <span className="text-success">{formatCurrency(client.total_revenue)}</span>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!isLoading && filtered.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  {filtered.length !== clients.length && (
                    <span>{filtered.length} filtrado(s) de {clients.length} &middot; </span>
                  )}
                  Mostrando {Math.min((page - 1) * pageSize + 1, filtered.length)}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}
                </p>
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="h-7 w-[72px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">por página</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium px-2">{page} / {totalPages}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ClientPortfolioModal
        client={selectedClient}
        open={!!selectedClient}
        onClose={() => {
          setSelectedClient(null);
          if (searchParams.has('account')) {
            const next = new URLSearchParams(searchParams);
            next.delete('account');
            setSearchParams(next, { replace: true });
          }
        }}
        onNewDeal={handleNewDeal}
      />

    </AppLayout>
  );
}
