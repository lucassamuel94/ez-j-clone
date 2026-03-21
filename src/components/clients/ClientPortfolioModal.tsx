import { memo, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Building2, TrendingUp, FolderKanban, FileText, Clock, MapPin, Briefcase, Activity, Rocket, Trash2, Loader2 } from 'lucide-react';
import { useClientDeals, type ClientDeal } from '@/hooks/useClientDeals';
import { useClientProjects, type ClientProject } from '@/hooks/useClientProjects';
import { useClientProposals, type ClientProposal } from '@/hooks/useClientProposals';
import { useClientTimeline, type ClientTimelineEntry } from '@/hooks/useClientTimeline';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { MyClient } from '@/hooks/useMyClients';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const formatRelative = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 30) return `${days}d atrás`;
  if (days < 365) return `${Math.floor(days / 30)}m atrás`;
  return `${Math.floor(days / 365)}a atrás`;
};

const STAGE_COLORS: Record<string, string> = {
  'Ganho': 'bg-success/10 text-success border-success/30',
  'Perdido': 'bg-destructive/10 text-destructive border-destructive/30',
  'Demonstração': 'bg-info/10 text-info border-info/30',
  'Proposta enviada': 'bg-warning/10 text-warning border-warning/30',
  'Negociação': 'bg-primary/10 text-primary border-primary/30',
};

const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-info/10 text-info',
  viewed: 'bg-warning/10 text-warning',
  accepted: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
};

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviada',
  viewed: 'Visualizada',
  accepted: 'Aceita',
  rejected: 'Rejeitada',
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  em_andamento: 'bg-info/10 text-info',
  concluido: 'bg-success/10 text-success',
  cancelado: 'bg-destructive/10 text-destructive',
  pausado: 'bg-warning/10 text-warning',
};

const PHASE_LABELS: Record<string, string> = {
  validacao: 'Validação', ux_po: 'UX/PO', verificacao_bm: 'Verif. BM',
  dev_chatbot: 'Dev Chatbot', treinamento: 'Treinamento', ativacao: 'Ativação',
  automacao: 'Automação', curadoria_ia: 'Curadoria IA', go_live_assistido: 'Go-live',
  concluido: 'Entregue',
};

// ── Tab: Resumo ──
const ResumoTab = memo(({ client }: { client: MyClient }) => {
  const allProducts = ['Chatbot', 'API Oficial', 'PABX', 'Evolução'];
  const hasProducts = new Set(client.products);
  const missingProducts = allProducts.filter(p => !hasProducts.has(p));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="py-3 px-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Receita total</p>
          <p className="text-lg font-bold text-success">{client.total_revenue > 0 ? formatCurrency(client.total_revenue) : '—'}</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Projetos</p>
          <p className="text-lg font-bold">{client.active_projects_count}</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Evoluções</p>
          <p className="text-lg font-bold">{client.evolution_count}</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saúde</p>
          <div className="flex items-center gap-2">
            <div className={cn('h-3 w-3 rounded-full', {
              'bg-success': client.health_label === 'green',
              'bg-warning': client.health_label === 'yellow',
              'bg-destructive': client.health_label === 'red',
            })} />
            <p className="text-lg font-bold">{client.health_score}</p>
          </div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card><CardContent className="py-4 px-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Dados da empresa</p>
          <div className="space-y-1.5 text-sm">
            <p><span className="text-muted-foreground">CNPJ:</span> {client.cnpj || '—'}</p>
            {client.city && <p className="flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" />{client.city}/{client.state}</p>}
            <p><span className="text-muted-foreground">Closer:</span> {client.closer_name || '—'}</p>
            <p><span className="text-muted-foreground">SDR:</span> {client.sdr_name || '—'}</p>
            {client.won_at && <p><span className="text-muted-foreground">Cliente desde:</span> {formatDate(client.won_at)}</p>}
          </div>
        </CardContent></Card>

        <Card><CardContent className="py-4 px-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Produtos</p>
          <div className="flex flex-wrap gap-1.5">
            {client.products.map(p => (
              <Badge key={p} className="bg-success/10 text-success border border-success/30 text-[10px]">{p}</Badge>
            ))}
          </div>
          {missingProducts.length > 0 && (
            <>
              <p className="text-[10px] text-muted-foreground mt-3">Oportunidades de cross-sell</p>
              <div className="flex flex-wrap gap-1.5">
                {missingProducts.map(p => (
                  <Badge key={p} variant="outline" className="text-[10px] text-muted-foreground border-dashed">{p}</Badge>
                ))}
              </div>
            </>
          )}
        </CardContent></Card>
      </div>
    </div>
  );
});
ResumoTab.displayName = 'ResumoTab';

// ── Tab: Negociações (com propostas inline) ──
const DealsTab = memo(({ accountId, cnpj, onDealClick }: { accountId: string; cnpj: string | null; onDealClick?: (leadId: string, oppId: string) => void }) => {
  const cleanCnpj = cnpj?.replace(/\D/g, '') || '';
  const { data: dealsData, isLoading } = useClientDeals(cleanCnpj ? [cleanCnpj] : []);
  const deals = useMemo(() => dealsData?.dealsMap.get(cleanCnpj) || [], [dealsData, cleanCnpj]);
  const { data: proposals = [], isLoading: proposalsLoading } = useClientProposals(accountId);

  const proposalsByOpp = useMemo(() => {
    const map = new Map<string, ClientProposal[]>();
    for (const p of proposals) {
      if (!p.opportunity_id) continue;
      if (!map.has(p.opportunity_id)) map.set(p.opportunity_id, []);
      map.get(p.opportunity_id)!.push(p);
    }
    return map;
  }, [proposals]);

  const orphanProposals = useMemo(() => {
    const dealIds = new Set(deals.map(d => d.id));
    return proposals.filter(p => !p.opportunity_id || !dealIds.has(p.opportunity_id));
  }, [proposals, deals]);

  if (isLoading || proposalsLoading) return <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>;
  if (deals.length === 0 && proposals.length === 0) return <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma negociação encontrada</p>;

  return (
    <div className="space-y-2">
      {deals.map((deal: ClientDeal) => {
        const dealProposals = proposalsByOpp.get(deal.id) || [];
        return (
          <div key={deal.id} className="rounded-lg border border-border/50 bg-card overflow-hidden">
            <div className="flex items-center justify-between p-3 hover:bg-accent/20 transition-colors cursor-pointer" onClick={() => onDealClick?.(deal.lead_id, deal.id)}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{deal.lead_company || '—'}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className={cn('text-[10px] h-4', STAGE_COLORS[deal.stage] || 'bg-muted text-muted-foreground')}>
                    {deal.stage}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{deal.opportunity_type === 'evolution' ? 'Evolução' : 'Negócio novo'}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                {deal.deal_value ? <p className="text-sm font-semibold">{formatCurrency(deal.deal_value)}</p> : null}
                {deal.assigned_to_name && <p className="text-[10px] text-muted-foreground">{deal.assigned_to_name}</p>}
              </div>
            </div>
            {dealProposals.length > 0 && (
              <div className="border-t border-border/30 bg-muted/20 px-3 py-2 space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Propostas</p>
                {dealProposals.map(prop => (
                  <div key={prop.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                      <Badge variant="outline" className={cn('text-[10px] h-4', PROPOSAL_STATUS_COLORS[prop.status] || '')}>
                        {PROPOSAL_STATUS_LABELS[prop.status] || prop.status}
                      </Badge>
                      {prop.view_count > 0 && <span className="text-[10px] text-muted-foreground">{prop.view_count} view(s)</span>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {prop.total_monthly ? <span className="text-[11px] font-medium">{formatCurrency(prop.total_monthly)}/mês</span> : null}
                      <span className="text-[10px] text-muted-foreground ml-2">{formatDate(prop.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {orphanProposals.length > 0 && (
        <>
          {deals.length > 0 && <div className="h-px bg-border/30 my-2" />}
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Propostas avulsas</p>
          {orphanProposals.map(prop => (
            <div key={prop.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/20 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{prop.company_name || '—'}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className={cn('text-[10px] h-4', PROPOSAL_STATUS_COLORS[prop.status] || '')}>
                    {PROPOSAL_STATUS_LABELS[prop.status] || prop.status}
                  </Badge>
                  {prop.view_count > 0 && <span className="text-[10px] text-muted-foreground">{prop.view_count} visualização(ões)</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                {prop.total_monthly ? <p className="text-sm font-semibold">{formatCurrency(prop.total_monthly)}/mês</p> : null}
                <p className="text-[10px] text-muted-foreground">{formatDate(prop.created_at)}</p>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
});
DealsTab.displayName = 'DealsTab';

// ── Tab: Projetos ──
const ProjectsTab = memo(({ accountId }: { accountId: string }) => {
  const { data: projects = [], isLoading } = useClientProjects(accountId);

  if (isLoading) return <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>;
  if (projects.length === 0) return <p className="text-sm text-muted-foreground py-6 text-center">Nenhum projeto encontrado</p>;

  return (
    <div className="space-y-2">
      {projects.map((proj: ClientProject) => (
        <div key={proj.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/20 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{proj.company_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className={cn('text-[10px] h-4', PROJECT_STATUS_COLORS[proj.overall_status] || 'bg-muted text-muted-foreground')}>
                {proj.overall_status === 'concluido' ? 'Entregue' : proj.overall_status === 'em_andamento' ? 'Em andamento' : proj.overall_status}
              </Badge>
              {proj.current_phase && (
                <span className="text-[10px] text-muted-foreground">{PHASE_LABELS[proj.current_phase] || proj.current_phase}</span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            {proj.delivered_at ? (
              <p className="text-[10px] text-success">Entregue {formatDate(proj.delivered_at)}</p>
            ) : proj.due_date ? (
              <p className="text-[10px] text-muted-foreground">Prazo: {formatDate(proj.due_date)}</p>
            ) : null}
            {proj.project_type && <p className="text-[10px] text-muted-foreground capitalize">{proj.project_type}</p>}
          </div>
        </div>
      ))}
    </div>
  );
});
ProjectsTab.displayName = 'ProjectsTab';


// ── Tab: Timeline ──
const TimelineTab = memo(({ accountId }: { accountId: string }) => {
  const { data: entries = [], isLoading } = useClientTimeline(accountId);

  if (isLoading) return <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>;
  if (entries.length === 0) return <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma atividade registrada</p>;

  return (
    <div className="space-y-0 relative">
      <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
      {entries.map((e: ClientTimelineEntry) => (
        <div key={e.id} className="flex gap-3 py-2 relative">
          <div className="h-2 w-2 rounded-full bg-primary mt-1.5 z-10 ring-2 ring-background flex-shrink-0 ml-[7px]" />
          <div className="flex-1 min-w-0">
            <p className="text-xs">{e.description}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {e.user_name && <span className="text-[10px] text-muted-foreground">{e.user_name}</span>}
              <span className="text-[10px] text-muted-foreground">{formatRelative(e.created_at)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});
TimelineTab.displayName = 'TimelineTab';

// ── Main Modal ──
interface ClientPortfolioModalProps {
  client: MyClient | null;
  open: boolean;
  onClose: () => void;
  onNewDeal?: (clientId: string) => void;
}

export const ClientPortfolioModal = memo(({ client, open, onClose, onNewDeal }: ClientPortfolioModalProps) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('resumo');
  const [deleting, setDeleting] = useState(false);
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const isAdmin = hasPermission('access_admin');

  const handleSoftDelete = useCallback(async () => {
    if (!client) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', client.id);
      if (error) throw error;
      toast.success(`"${client.company_name}" removido da base de clientes`);
      queryClient.invalidateQueries({ queryKey: ['my-clients'] });
      queryClient.invalidateQueries({ queryKey: ['active_clients'] });
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover cliente');
    } finally {
      setDeleting(false);
    }
  }, [client, queryClient, onClose]);

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center gap-3 pr-8">
            <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 shrink-0">
              <Building2 className="h-4 w-4 text-primary" />
            </span>

            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm font-semibold tracking-tight truncate">
                {client.company_name}
              </DialogTitle>
              {client.cnpj && (
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  {client.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                </p>
              )}
            </div>

            {onNewDeal && (
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5 shrink-0"
                onClick={() => onNewDeal(client.id)}
              >
                <Rocket className="h-3.5 w-3.5" />
                Nova negociação
              </Button>
            )}
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4 h-8">
            <TabsTrigger value="resumo" className="text-[11px] gap-1"><TrendingUp className="h-3 w-3" />Resumo</TabsTrigger>
            <TabsTrigger value="deals" className="text-[11px] gap-1"><Briefcase className="h-3 w-3" />Negociações</TabsTrigger>
            <TabsTrigger value="projects" className="text-[11px] gap-1"><FolderKanban className="h-3 w-3" />Projetos</TabsTrigger>
            <TabsTrigger value="timeline" className="text-[11px] gap-1"><Activity className="h-3 w-3" />Timeline</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-3">
            <TabsContent value="resumo" className="mt-0"><ResumoTab client={client} /></TabsContent>
            <TabsContent value="deals" className="mt-0"><DealsTab accountId={client.id} cnpj={client.cnpj} onDealClick={(leadId, oppId) => { onClose(); navigate(`/leads?lead=${leadId}&opp=${oppId}`); }} /></TabsContent>
            <TabsContent value="projects" className="mt-0"><ProjectsTab accountId={client.id} /></TabsContent>
            <TabsContent value="timeline" className="mt-0"><TimelineTab accountId={client.id} /></TabsContent>
          </div>
        </Tabs>

        {isAdmin && (
          <div className="border-t border-border/40 pt-3 px-1 flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 gap-1.5">
                  <Trash2 className="h-3 w-3" />
                  Remover cliente
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover cliente</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja remover <strong>{client.company_name}</strong> da base de clientes? Esta ação pode ser revertida por um administrador.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleSoftDelete}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});
ClientPortfolioModal.displayName = 'ClientPortfolioModal';
