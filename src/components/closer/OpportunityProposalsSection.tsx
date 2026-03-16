import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink, Plus, Loader2, MoreHorizontal, Pencil, Trash2, Archive, Trophy, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ProposalSimulatorDialog } from './ProposalSimulatorDialog';
import { Lead } from '@/types/lead';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface OpportunityProposalsSectionProps {
  opportunityId: string;
  lead?: Lead | null;
  opportunity?: any;
}

export function OpportunityProposalsSection({ opportunityId, lead, opportunity }: OpportunityProposalsSectionProps) {
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('ez_chat');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['opportunity-proposals', opportunityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('id, product_type, status, total_monthly, setup_total, plan_name, created_at, company_name')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!opportunityId,
  });

  const formatCurrency = useCallback((value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value), []);

  const getTypeBadge = (type: string) => {
    if (type === 'evolucao_ez_chat') {
      return <Badge className="bg-warning/10 text-warning border-warning/20 text-[10px]">Evolução</Badge>;
    }
    if (type === 'ez_call') {
      return <Badge className="bg-success/10 text-success border-success/20 text-[10px]">EZ Call</Badge>;
    }
    return <Badge className="bg-info/10 text-info border-info/20 text-[10px]">EZ Chat</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Rascunho' },
      sent: { bg: 'bg-info/10', text: 'text-info', label: 'Enviada' },
      viewed: { bg: 'bg-warning/10', text: 'text-warning', label: 'Visualizada' },
      accepted: { bg: 'bg-success/10', text: 'text-success', label: 'Aceita' },
      rejected: { bg: 'bg-destructive/10', text: 'text-destructive', label: 'Recusada' },
      archived: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Arquivada' },
    };
    const s = map[status] || map.draft;
    return <Badge className={`${s.bg} ${s.text} text-[10px]`}>{s.label}</Badge>;
  };

  const handleUpdateStatus = useCallback(async (id: string, status: string) => {
    const { error } = await supabase.from('proposals').update({ status }).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar proposta');
    } else {
      const labels: Record<string, string> = { accepted: 'Proposta marcada como ganha!', archived: 'Proposta arquivada' };
      toast.success(labels[status] || 'Status atualizado');
      queryClient.invalidateQueries({ queryKey: ['opportunity-proposals', opportunityId] });
    }
  }, [opportunityId, queryClient]);

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('proposals').delete().eq('id', deleteId);
    if (error) {
      toast.error('Erro ao excluir proposta');
    } else {
      toast.success('Proposta excluída');
      queryClient.invalidateQueries({ queryKey: ['opportunity-proposals', opportunityId] });
    }
    setDeleteId(null);
  }, [deleteId, opportunityId, queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" />
          Propostas ({proposals.length})
        </h3>
        <Button variant="default" size="sm" className="h-7 text-xs gap-1" onClick={() => {
          const isCloserCreated = !opportunity?.sdr_user_id || opportunity?.created_by_user_id === opportunity?.assigned_to_user_id;
          if (!isCloserCreated) {
            const missingFields: string[] = [];
            if (!lead?.sqo_pain_category) missingFields.push('Dor');
            if (!lead?.sqo_urgency) missingFields.push('Urgência');
            if (!lead?.sqo_budget) missingFields.push('Orçamento');
            if (!lead?.sqo_decision_maker) missingFields.push('Decisor');
            if (!lead?.sqo_icp_fit) missingFields.push('ICP');
            if (missingFields.length > 0) {
              toast.error(`Preencha o SQO do cliente antes de gerar uma proposta. Campos pendentes: ${missingFields.join(', ')}`);
              return;
            }
          }
          setTypePickerOpen(true);
        }}>
          <Plus className="h-3 w-3" />
          Nova proposta
        </Button>
      </div>

      {proposals.length === 0 ? (
        <div className="rounded-lg border-dashed border-2 border-border/40 p-6 text-center">
          <FileText className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Nenhuma proposta vinculada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {proposals.map((proposal) => (
            <div
              key={proposal.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-1.5">
                  {getTypeBadge(proposal.product_type)}
                  {getStatusBadge(proposal.status)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {proposal.plan_name || 'Proposta'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(proposal.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                  {Number(proposal.total_monthly) > 0 && (
                    <p className="text-xs font-semibold tabular-nums">{formatCurrency(Number(proposal.total_monthly))}/mês</p>
                  )}
                  {Number(proposal.setup_total) > 0 && (
                    <p className="text-[10px] text-muted-foreground tabular-nums">Setup: {formatCurrency(Number(proposal.setup_total))}</p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => window.open(`/proposal-preview/${proposal.id}`, '_blank')}>
                      <ExternalLink className="h-4 w-4 mr-2" /> Abrir link
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const url = `${window.location.origin}/proposal-preview/${proposal.id}`;
                      navigator.clipboard.writeText(url);
                      toast.success('Link copiado!');
                    }}>
                      <Copy className="h-4 w-4 mr-2" /> Copiar link
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/proposal/${proposal.id}`)}>
                      <Pencil className="h-4 w-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleUpdateStatus(proposal.id, 'accepted')}>
                      <Trophy className="h-4 w-4 mr-2" /> Marcar como ganho
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUpdateStatus(proposal.id, 'archived')}>
                      <Archive className="h-4 w-4 mr-2" /> Arquivar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteId(proposal.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Type picker dialog */}
      <Dialog open={typePickerOpen} onOpenChange={setTypePickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tipo da proposta</DialogTitle>
            <DialogDescription>Selecione o tipo de produto para a nova proposta.</DialogDescription>
          </DialogHeader>
          <RadioGroup value={selectedType} onValueChange={setSelectedType} className="space-y-2">
            <div className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <RadioGroupItem value="ez_chat" id="type_ez" />
              <Label htmlFor="type_ez" className="cursor-pointer flex-1">
                <span className="text-sm font-medium">EZ Chat</span>
                <p className="text-xs text-muted-foreground">Plataforma de atendimento via WhatsApp</p>
              </Label>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <RadioGroupItem value="ez_call" id="type_call" />
              <Label htmlFor="type_call" className="cursor-pointer flex-1">
                <span className="text-sm font-medium">EZ Call</span>
                <p className="text-xs text-muted-foreground">Plataforma de telefonia inteligente</p>
              </Label>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <RadioGroupItem value="evolucao_ez_chat" id="type_evo" />
              <Label htmlFor="type_evo" className="cursor-pointer flex-1">
                <span className="text-sm font-medium">Evolução EZ Chat</span>
                <p className="text-xs text-muted-foreground">Upgrade de plano para clientes existentes</p>
              </Label>
            </div>
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypePickerOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              setTypePickerOpen(false);
              if (selectedType === 'evolucao_ez_chat') {
                navigate(`/simulator/evolucao?opportunityId=${opportunityId}`);
              } else if (selectedType === 'ez_call') {
                navigate(`/simulator?type=ez-call&opportunityId=${opportunityId}`);
              } else {
                setSimulatorOpen(true);
              }
            }}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProposalSimulatorDialog
        open={simulatorOpen}
        onOpenChange={setSimulatorOpen}
        opportunityId={opportunityId}
        lead={lead ?? null}
        opportunity={opportunity}
        productType={selectedType}
      />

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        description="Tem certeza que deseja excluir esta proposta? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
