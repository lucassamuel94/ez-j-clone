import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Users, Building2, AlertCircle, Briefcase, CalendarDays } from 'lucide-react';
import { useSDRProspectingCNAEs } from '@/hooks/useSDRProspectingCNAEs';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePermissions } from '@/hooks/usePermissions';
import { useSystemUsers } from '@/hooks/useSystemUsers';
import { useICPAnalysis } from '@/hooks/useICPAnalysis';
import { ICPChatSection } from '@/components/clients/ICPChatSection';

function KPICard({ icon: Icon, label, value, loading }: { icon: any; label: string; value: number; loading: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="h-6 w-16 mt-0.5" /> : <p className="text-xl font-bold text-foreground">{value.toLocaleString('pt-BR')}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function RankedList({ title, data, loading }: { title: string; data: { name: string; count: number }[]; loading: boolean }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
        ) : !data.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhum dado encontrado</p>
          </div>
        ) : (
          <ol className="space-y-1.5">
            {data.map((item, i) => (
              <li key={item.name} className="flex items-center gap-2 text-sm">
                <span className="text-xs font-bold text-muted-foreground w-6 text-right shrink-0">{i + 1}.</span>
                <span className="truncate flex-1 text-foreground">{item.name}</span>
                <span className="text-xs font-semibold text-primary tabular-nums shrink-0">{item.count}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export default function SDRICPAnalysisPage() {
  const { user } = useCurrentUser();
  const { hasPermission } = usePermissions();
  const canViewAll = hasPermission('access_admin') || hasPermission('view_closer_pipeline');
  const { data: allUsers } = useSystemUsers();

  const [selectedSdr, setSelectedSdr] = useState<string>('');
  const [dateFromInput, setDateFromInput] = useState<string>('');
  const [dateToInput, setDateToInput] = useState<string>('');
  const [appliedDateFrom, setAppliedDateFrom] = useState<string>('');
  const [appliedDateTo, setAppliedDateTo] = useState<string>('');
  const ownerFilter = canViewAll
    ? (selectedSdr && selectedSdr !== 'all' ? selectedSdr : null)
    : (user?.id || null);

  const { data, isLoading } = useSDRProspectingCNAEs(ownerFilter, appliedDateFrom || undefined, appliedDateTo || undefined);

  const applyDateFilter = () => {
    setAppliedDateFrom(dateFromInput);
    setAppliedDateTo(dateToInput);
  };

  const clearDateFilter = () => {
    setDateFromInput('');
    setDateToInput('');
    setAppliedDateFrom('');
    setAppliedDateTo('');
  };

  const hasUnappliedChanges = dateFromInput !== appliedDateFrom || dateToInput !== appliedDateTo;
  const { data: analyses } = useICPAnalysis();
  const latestAnalysisId = analyses?.[0]?.id;

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <PageHeader
              title="Análise de ICP — Prospecção SDR"
              subtitle="Visão dos CNAEs e Sub-CNAEs que você está prospectando ativamente"
            />
            {canViewAll && (
              <Select value={selectedSdr} onValueChange={setSelectedSdr}>
                <SelectTrigger className="w-52 h-9">
                  <SelectValue placeholder="Todos os SDRs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os SDRs</SelectItem>
                  {allUsers?.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* KPI Cards — Prospecção */}
          <div>
            <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Minha Prospecção (Leads que estou trabalhando)</p>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-1.5">
                  <Input
                    type="date"
                    value={dateFromInput}
                    onChange={(e) => setDateFromInput(e.target.value)}
                    className="h-8 w-36 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input
                    type="date"
                    value={dateToInput}
                    onChange={(e) => setDateToInput(e.target.value)}
                    className="h-8 w-36 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  variant={hasUnappliedChanges ? 'default' : 'secondary'}
                  className="h-8 text-xs px-3"
                  onClick={applyDateFilter}
                  disabled={!dateFromInput && !dateToInput}
                >
                  Aplicar
                </Button>
                {(appliedDateFrom || appliedDateTo) && (
                  <button
                    onClick={clearDateFilter}
                    className="text-xs text-primary hover:underline"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KPICard icon={Users} label="Total de Leads" value={data?.prospecting?.total || 0} loading={isLoading} />
              <KPICard icon={Building2} label="Com CNAE Preenchido" value={data?.prospecting?.withCnae || 0} loading={isLoading} />
              <KPICard icon={AlertCircle} label="Sem CNAE" value={data?.prospecting?.withoutCnae || 0} loading={isLoading} />
            </div>
          </div>

          {/* KPI Cards — Carteira EZ */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-3">Carteira de Clientes EZ (Base ativa)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KPICard icon={Briefcase} label="Total de Clientes" value={data?.clients?.total || 0} loading={isLoading} />
              <KPICard icon={Building2} label="Com CNAE Preenchido" value={data?.clients?.withCnae || 0} loading={isLoading} />
              <KPICard icon={AlertCircle} label="Sem CNAE" value={data?.clients?.withoutCnae || 0} loading={isLoading} />
            </div>
          </div>

          {/* Ranked Lists side by side */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-3">CNAEs — Prospecção vs. Carteira EZ</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RankedList title="🔍 Meus Leads em Prospecção — Top 20 CNAEs" data={data?.prospecting.topCNAEs || []} loading={isLoading} />
              <RankedList title="🏢 Clientes Ativos EZ — Top 20 CNAEs" data={data?.clients.topCNAEs || []} loading={isLoading} />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-3">Sub-CNAEs — Prospecção vs. Carteira EZ</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RankedList title="🔍 Meus Leads em Prospecção — Top 20 Sub-CNAEs" data={data?.prospecting.topSubCNAEs || []} loading={isLoading} />
              <RankedList title="🏢 Clientes Ativos EZ — Top 20 Sub-CNAEs" data={data?.clients.topSubCNAEs || []} loading={isLoading} />
            </div>
          </div>

          {/* Chat IA */}
          <ICPChatSection analysisId={latestAnalysisId} />
        </div>
      </div>
    </AppLayout>
  );
}
