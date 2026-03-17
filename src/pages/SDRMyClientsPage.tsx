import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePermissions } from '@/hooks/usePermissions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { Loader2, Search, UserCheck, Building2, MapPin, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QualifiedClient {
  id: string;
  company_name: string;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  lifecycle_stage: string;
  account_owner_name: string | null;
  won_at: string | null;
  sdr_name: string | null;
  deal_value: number | null;
  situacao_cadastral: string | null;
}

function useSdrQualifiedClients(sdrUserId: string | null, isAdminOrManager: boolean) {
  return useQuery<QualifiedClient[]>({
    queryKey: ['sdr-qualified-clients', sdrUserId, isAdminOrManager],
    queryFn: async () => {
      // Fetch accounts with lifecycle_stage = 'client' filtered by sdr
      // Plus their winning opportunity info (won_at, deal_value, sdr name)
      let query = supabase
        .from('accounts')
        .select(`
          id,
          company_name,
          cnpj,
          city,
          state,
          lifecycle_stage,
          situacao_cadastral,
          account_owner:profiles!accounts_account_owner_id_profiles_fkey(name)
        `)
        .eq('lifecycle_stage', 'client')
        .order('created_at', { ascending: false });

      const { data: accounts, error } = await query;
      if (error) throw error;
      if (!accounts || accounts.length === 0) return [];

      const accountIds = accounts.map((a: any) => a.id);

      // Fetch winning opportunities to get won_at, deal_value and sdr info
      const { data: wonOpps } = await supabase
        .from('opportunities')
        .select('account_id, won_at, deal_value, sdr_user_id, sdr:profiles!opportunities_sdr_user_id_fkey(name)')
        .in('account_id', accountIds)
        .eq('stage', 'Ganho')
        .order('won_at', { ascending: false });

      // Build a map: account_id → best (latest) won opportunity
      const oppMap = new Map<string, any>();
      for (const opp of wonOpps || []) {
        if (!oppMap.has(opp.account_id)) {
          oppMap.set(opp.account_id, opp);
        }
      }

      // If not admin/manager, filter to accounts where current user is the SDR
      const result: QualifiedClient[] = accounts
        .filter((a: any) => {
          if (isAdminOrManager) return true;
          const opp = oppMap.get(a.id);
          return opp?.sdr_user_id === sdrUserId;
        })
        .map((a: any) => {
          const opp = oppMap.get(a.id);
          return {
            id: a.id,
            company_name: a.company_name,
            cnpj: a.cnpj,
            city: a.city,
            state: a.state,
            lifecycle_stage: a.lifecycle_stage,
            situacao_cadastral: a.situacao_cadastral,
            account_owner_name: (a.account_owner as any)?.name || null,
            won_at: opp?.won_at || null,
            sdr_name: (opp?.sdr as any)?.name || null,
            deal_value: opp?.deal_value || null,
          };
        });

      return result;
    },
    enabled: isAdminOrManager || !!sdrUserId,
  });
}

const formatCnpj = (cnpj: string) => {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function SDRMyClientsPage() {
  const { user } = useCurrentUser();
  const { hasPermission } = usePermissions();
  const isAdminOrManager = hasPermission('access_admin');
  const navigate = useNavigate();

  const [search, setSearch] = useState('');

  const { data: clients = [], isLoading } = useSdrQualifiedClients(
    user?.id ?? null,
    isAdminOrManager,
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.company_name?.toLowerCase().includes(q) ||
      c.cnpj?.includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.account_owner_name?.toLowerCase().includes(q) ||
      c.sdr_name?.toLowerCase().includes(q),
    );
  }, [clients, search]);

  const totalValue = useMemo(
    () => filtered.reduce((sum, c) => sum + (c.deal_value || 0), 0),
    [filtered],
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Meus Clientes"
        subtitle={
          isAdminOrManager
            ? 'Clientes ganhos por todos os SDRs'
            : 'Clientes originados de leads que você qualificou'
        }
        icon={<UserCheck className="h-5 w-5" />}
      />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Total de clientes</p>
              <p className="text-2xl font-bold">{isLoading ? '—' : filtered.length}</p>
            </CardContent>
          </Card>
          {totalValue > 0 && (
            <Card>
              <CardContent className="py-3 px-4">
                <p className="text-xs text-muted-foreground">Valor total captado</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalValue)}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa, CNPJ, cidade..."
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
                <TableHead className="text-xs">Empresa</TableHead>
                <TableHead className="text-xs">CNPJ</TableHead>
                <TableHead className="text-xs">Cidade/UF</TableHead>
                <TableHead className="text-xs">Closer</TableHead>
                {isAdminOrManager && <TableHead className="text-xs">SDR</TableHead>}
                <TableHead className="text-xs">Data da venda</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isAdminOrManager ? 8 : 7} className="text-center py-10">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Carregando...</span>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdminOrManager ? 8 : 7} className="text-center py-14">
                    <Building2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {search ? 'Nenhum resultado para esta busca' : 'Nenhum cliente qualificado ainda'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(client => (
                  <TableRow key={client.id} className="group">
                    <TableCell className="py-2.5">
                      <div>
                        <p className="text-sm font-medium">{client.company_name}</p>
                        {client.situacao_cadastral && (
                          <Badge
                            variant="outline"
                            className={`text-[9px] h-3.5 px-1 mt-0.5 ${
                              client.situacao_cadastral.toLowerCase() === 'ativa'
                                ? 'border-success/40 text-success'
                                : 'border-muted-foreground/30 text-muted-foreground'
                            }`}
                          >
                            {client.situacao_cadastral}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground py-2.5">
                      {client.cnpj ? formatCnpj(client.cnpj) : '—'}
                    </TableCell>
                    <TableCell className="text-xs py-2.5">
                      {client.city && client.state ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {client.city}/{client.state}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-xs py-2.5">
                      {client.account_owner_name || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    {isAdminOrManager && (
                      <TableCell className="text-xs py-2.5">
                        {client.sdr_name || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    )}
                    <TableCell className="text-xs py-2.5 text-muted-foreground">
                      {client.won_at ? formatDate(client.won_at) : '—'}
                    </TableCell>
                    <TableCell className="text-xs py-2.5 text-right font-medium">
                      {client.deal_value ? (
                        <span className="text-emerald-600">{formatCurrency(client.deal_value)}</span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => navigate(`/accounts`)}
                        title="Ver na base de clientes"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
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
  );
}
