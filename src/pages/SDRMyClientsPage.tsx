import { useState, useMemo, useCallback } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePermissions } from '@/hooks/usePermissions';
import { useUserRole } from '@/hooks/useUserRole';
import { useMyClients, type MyClient } from '@/hooks/useMyClients';
import { ClientPortfolioModal } from '@/components/clients/ClientPortfolioModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { AppLayout } from '@/components/AppLayout';
import { cn } from '@/lib/utils';
import { Loader2, Search, UserCheck, Building2, MapPin, FolderKanban, Rocket } from 'lucide-react';

const formatCnpj = (cnpj: string) => {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const formatRelative = (days: number | null) => {
  if (days === null) return '—';
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}m`;
};

export default function SDRMyClientsPage() {
  const { user } = useCurrentUser();
  const { hasPermission } = usePermissions();
  const { isCloser, isSdr } = useUserRole();
  const isAdminOrManager = hasPermission('access_admin');

  const viewMode = isAdminOrManager ? 'admin' : isCloser ? 'closer' : 'sdr';

  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<MyClient | null>(null);

  const { data: clients = [], isLoading } = useMyClients(user?.id ?? null, viewMode);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.company_name?.toLowerCase().includes(q) ||
      c.cnpj?.includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.closer_name?.toLowerCase().includes(q) ||
      c.sdr_name?.toLowerCase().includes(q),
    );
  }, [clients, search]);

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

  const subtitle = viewMode === 'admin'
    ? 'Todos os clientes ativos da base'
    : viewMode === 'closer'
      ? 'Clientes da sua carteira'
      : 'Clientes originados de leads que você qualificou';

  const colSpan = isAdminOrManager ? 10 : 9;

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        <PageHeader
          title="Meus Clientes"
          subtitle={subtitle}
          icon={<UserCheck className="h-5 w-5" />}
        />

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

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa, CNPJ, cidade, closer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Table */}
          <div className="border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs w-5" />
                  <TableHead className="text-xs">Empresa</TableHead>
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
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colSpan} className="text-center py-14">
                      <Building2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {search ? 'Nenhum resultado para esta busca' : 'Nenhum cliente na carteira'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(client => (
                    <TableRow
                      key={client.id}
                      className="group cursor-pointer hover:bg-accent/30 transition-colors"
                      onClick={() => handleRowClick(client)}
                    >
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
                      <TableCell className="text-xs py-2.5">
                        {client.closer_name || '—'}
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

          {!isLoading && filtered.length > 0 && (
            <p className="text-[10px] text-muted-foreground text-right pr-1">
              {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
              {search ? ` encontrado${filtered.length !== 1 ? 's' : ''}` : ''}
            </p>
          )}
        </div>
      </div>

      <ClientPortfolioModal
        client={selectedClient}
        open={!!selectedClient}
        onClose={() => setSelectedClient(null)}
      />
    </AppLayout>
  );
}
