import { useState, lazy, Suspense } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { usePosVendaDashboard } from '@/hooks/usePosVendaDashboard';
import { useBlockedProjects } from '@/hooks/useBlockedProjects';
import { useTeamCapacity } from '@/hooks/useTeamCapacity';
import { useApiActivations } from '@/hooks/useApiActivations';
import { useWorkload } from '@/hooks/useWorkload';
import { BarChart3 } from 'lucide-react';

const PosVendaResumoTab = lazy(() => import('@/components/posvenda/PosVendaResumoTab'));
const PosVendaFilaTab = lazy(() => import('@/components/posvenda/PosVendaFilaTab'));
const PosVendaTravadosTab = lazy(() => import('@/components/posvenda/PosVendaTravadosTab'));
const PosVendaEquipesTab = lazy(() => import('@/components/posvenda/PosVendaEquipesTab'));
const PosVendaApiActivationTab = lazy(() => import('@/components/posvenda/PosVendaApiActivationTab'));
const PosVendaWorkloadTab = lazy(() => import('@/components/posvenda/PosVendaWorkloadTab'));

type Period = 'week' | 'month' | 'quarter';
type Tab = 'resumo' | 'fila' | 'travados' | 'equipes' | 'api' | 'carga';

const PERIOD_OPTIONS: {value: Period;label: string;}[] = [
{ value: 'week', label: 'Semana' },
{ value: 'month', label: 'Mês' },
{ value: 'quarter', label: 'Trimestre' }];


const TAB_OPTIONS: {value: Tab;label: string;}[] = [
{ value: 'resumo', label: 'Resumo' },
{ value: 'fila', label: 'Fila de projetos' },
{ value: 'travados', label: 'O que está travado' },
{ value: 'equipes', label: 'Equipes' },
{ value: 'api', label: 'Ativação de API' },
{ value: 'carga', label: 'Carga de trabalho' }];


const now = new Date();
const monthYear = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

export default function PostVendaDashboardPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [tab, setTab] = useState<Tab>('resumo');
  const { data, isLoading } = usePosVendaDashboard(period);
  const { data: blockedData, isLoading: blockedLoading } = useBlockedProjects(period, tab === 'travados');
  const { data: teamsData, isLoading: teamsLoading } = useTeamCapacity(period, tab === 'equipes');
  const { data: apiData, isLoading: apiLoading } = useApiActivations(period, tab === 'api');
  const { data: workloadData, isLoading: workloadLoading } = useWorkload(period, tab === 'carga');

  return (
    <AppLayout>
      <div className="bg-background min-h-screen">
        <main className="space-y-0 p-3 sm:p-4 md:p-6 pb-20">
          <PageHeader
            icon={<BarChart3 className="h-5 w-5" strokeWidth={1.5} />}
            title="Pós-venda — visão do gestor"
            subtitle={`Atualizado agora · ${monthYear}`}
            sticky
            actions={
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5">
                {PERIOD_OPTIONS.map((o) =>
              <button
                key={o.value}
                onClick={() => setPeriod(o.value)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  period === o.value ?
                  'bg-primary text-primary-foreground' :
                  'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                )}>
                
                    {o.label}
                  </button>
              )}
              </div>
            } />
          

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border/40 overflow-x-auto mt-2">
            {TAB_OPTIONS.map((t) =>
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === t.value ?
                'border-primary text-primary' :
                'border-transparent text-muted-foreground hover:text-foreground'
              )}>
              
                {t.label}
              </button>
            )}
          </div>

          {/* Content */}
          <div className="mt-4 pt-[8px] py-0">
            {tab === 'travados' ?
            blockedLoading ?
            <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                  </div>
                  <Skeleton className="h-64 rounded-xl" />
                </div> :
            blockedData ?
            <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
                  <PosVendaTravadosTab data={blockedData} />
                </Suspense> :
            null :
            tab === 'equipes' ?
            teamsLoading ?
            <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
                  </div>
                </div> :
            teamsData ?
            <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
                  <PosVendaEquipesTab data={teamsData} />
                </Suspense> :
            null :
            tab === 'api' ?
            apiLoading ?
            <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                  </div>
                  <Skeleton className="h-64 rounded-xl" />
                </div> :
            apiData ?
            <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
                  <PosVendaApiActivationTab data={apiData} />
                </Suspense> :
            null :
            tab === 'carga' ?
            workloadLoading ?
            <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                  </div>
                  <Skeleton className="h-64 rounded-xl" />
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <Skeleton className="h-64 rounded-xl" />
                    <Skeleton className="h-64 rounded-xl" />
                  </div>
                </div> :
            workloadData ?
            <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
                  <PosVendaWorkloadTab data={workloadData} />
                </Suspense> :
            null :
            isLoading ?
            <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                </div>
                <Skeleton className="h-64 rounded-xl" />
              </div> :
            data ?
            <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
                {tab === 'resumo' ?
              <PosVendaResumoTab
                kpis={data.kpis}
                teamDeliveryBars={data.teamDeliveryBars}
                typeTimeBars={data.typeTimeBars}
                typeDonut={data.typeDonut}
                riskProjects={data.riskProjects}
                deliveryHistory={data.deliveryHistory} /> :


              <PosVendaFilaTab rows={data.projectRows} queueKpis={data.queueKpis} />
              }
              </Suspense> :
            null}
          </div>
        </main>
      </div>
    </AppLayout>);

}