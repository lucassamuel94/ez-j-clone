import { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Lead } from '@/types/lead';
import { LeadTypeBadge } from './LeadBadge';
import { CloserSelector } from './CloserSelector';
import { OpportunitySDRSelector } from './OpportunitySDRSelector';
import { CloserOpportunity, updateOpportunityDealValue, OpportunityType, returnLeadToSdr } from '@/services/closerService';
import { calculateClosingProbability, isDealStuck } from '@/utils/behavioralScore';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { createActivityLog } from '@/services/activityLogService';
import { toast } from 'sonner';
import {
  DollarSign,
  Pencil,
  UserCheck,
  Repeat,
  Save,
  Briefcase,
  Building2,
  RotateCcw,
  User,
  ChevronDown,
  Check,
} from 'lucide-react';
import { ContactChipPanel } from './ContactChipPanel';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

interface IntegrationItem {
  name: string;
  price: number;
  phase?: number;
  originalPrice?: number;
  discountLabel?: string;
  details?: string;
  [key: string]: any;
}

interface CloserModalHeaderProps {
  lead: Lead;
  opportunity: CloserOpportunity;
  opportunityId?: string;
  currentCloserId?: string | null;
  closerName?: string | null;
  currentUserId?: string | null;
  canManage?: boolean;
}

export const CloserModalHeader = ({ lead, opportunity, opportunityId, currentCloserId, closerName, currentUserId, canManage = false }: CloserModalHeaderProps) => {
  const canEditCloser = canManage || (!!currentUserId && currentCloserId === currentUserId);
  const queryClient = useQueryClient();
  const probability = useMemo(() => calculateClosingProbability(lead, opportunity), [lead, opportunity]);
  const stuckInfo = useMemo(() => isDealStuck(opportunity), [opportunity]);

  const changeTypeMutation = useMutation({
    mutationFn: async (newType: OpportunityType) => {
      const { error } = await supabase
        .from('opportunities')
        .update({ opportunity_type: newType })
        .eq('id', opportunity.id);
      if (error) throw error;
      await createActivityLog({
        lead_id: opportunity.lead_id,
        action_type: 'field_updated',
        field_name: 'opportunity_type',
        old_value: opportunity.opportunity_type || 'new_business',
        new_value: newType,
        description: `alterou tipo de negociação para ${newType === 'evolution' ? 'Evolução' : 'Novo Cliente'}`,
      }).catch(console.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closer-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['opportunity-by-id'] });
      toast.success('Tipo de negociação atualizado');
    },
    onError: () => toast.error('Erro ao atualizar tipo'),
  });

  const [pipelinePopoverOpen, setPipelinePopoverOpen] = useState(false);
  const [moveToPrevendaOpen,   setMoveToPrevendaOpen]   = useState(false);
  const [prevendaReason,       setPrevendaReason]       = useState('');

  const moveToPrevenda = useMutation({
    mutationFn: (reason: string) =>
      returnLeadToSdr(opportunity.id, reason || 'Reciclagem administrativa'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closer-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['closer-opportunities-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['closer-tab-counts'] });
      queryClient.invalidateQueries({ queryKey: ['closer-opportunities'] });
      toast.success('Cliente movido para Pré-vendas');
      setMoveToPrevendaOpen(false);
      setPipelinePopoverOpen(false);
    },
    onError: () => toast.error('Erro ao mover cliente'),
  });

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editItems, setEditItems] = useState<IntegrationItem[]>([]);
  const [editDealValue, setEditDealValue] = useState(0);

  // Fetch proposal data linked to this opportunity
  const { data: proposal } = useQuery({
    queryKey: ['proposal-for-opportunity', opportunity.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('proposals')
        .select('id, setup_total, total_monthly, plan_price, integrations')
        .eq('opportunity_id', opportunity.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });

  const hasProposal = !!proposal;

  // Save proposal integrations
  const saveProposalMutation = useMutation({
    mutationFn: async (items: IntegrationItem[]) => {
      if (!proposal?.id) throw new Error('Sem proposta');
      const newTotal = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
      const oldTotal = Number(proposal.setup_total) || 0;

      const { error } = await supabase
        .from('proposals')
        .update({
          setup_total: newTotal,
          integrations: items as any,
        })
        .eq('id', proposal.id);
      if (error) throw error;

      // Log activity
      await createActivityLog({
        lead_id: opportunity.lead_id,
        action_type: 'field_updated',
        field_name: 'setup_total',
        old_value: String(oldTotal),
        new_value: String(newTotal),
        description: `atualizou valor de Setup da proposta de ${formatCurrency(oldTotal)} para ${formatCurrency(newTotal)}`,
      }).catch(console.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-for-opportunity', opportunity.id] });
      queryClient.invalidateQueries({ queryKey: ['closer-pipeline'] });
      toast.success('Setup atualizado');
      setPopoverOpen(false);
    },
    onError: () => toast.error('Erro ao salvar'),
  });

  // Save deal_value directly
  const saveDealValueMutation = useMutation({
    mutationFn: (value: number) => updateOpportunityDealValue(opportunity.id, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closer-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['proposal-for-opportunity', opportunity.id] });
      toast.success('Valor atualizado');
      setPopoverOpen(false);
    },
    onError: () => toast.error('Erro ao salvar'),
  });

  const handleOpenPopover = (open: boolean) => {
    if (open) {
      if (hasProposal) {
        const items = (proposal.integrations as IntegrationItem[]) || [];
        setEditItems(items.map(i => ({ ...i })));
      } else {
        setEditDealValue(Number(opportunity.deal_value) || 0);
      }
    }
    setPopoverOpen(open);
  };

  const handleItemPriceChange = (index: number, value: string) => {
    setEditItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], price: Number(value) || 0 };
      return next;
    });
  };

  const handleItemDetailsChange = (index: number, value: string) => {
    setEditItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], details: value };
      return next;
    });
  };

  const handleSave = () => {
    if (hasProposal) {
      saveProposalMutation.mutate(editItems);
    } else {
      saveDealValueMutation.mutate(editDealValue);
    }
  };

  const isSaving = saveProposalMutation.isPending || saveDealValueMutation.isPending;

  const daysInPipeline = Math.round(
    (new Date().getTime() - new Date(opportunity.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const setupValue = proposal ? Number(proposal.setup_total) || 0 : Number(opportunity.deal_value) || 0;
  const mrrValue = proposal ? (Number(proposal.total_monthly) || 0) * 12 : 0;


  const editTotal = hasProposal
    ? editItems.reduce((s, i) => s + (Number(i.price) || 0), 0)
    : editDealValue;

  const opportunityTypeLabel = (opportunity.opportunity_type || 'new_business') === 'evolution' ? 'Evolução' : 'Novo Cliente';

  return (
    <div className="border-b px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0 space-y-3">
      {/* Row 1 — Identity */}
      <div className="flex flex-col gap-1 min-w-0 pr-16 sm:pr-24">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 shrink-0">
            <Building2 className="h-3.5 w-3.5 text-primary" />
          </span>
          <h2 className="text-xs sm:text-sm font-semibold text-foreground tracking-tight truncate">
            {lead.razao_social || lead.nome_fantasia || lead.company}
          </h2>
          <LeadTypeBadge type={lead.lead_type} />
          <Select
            value={opportunity.opportunity_type || 'new_business'}
            onValueChange={(v) => changeTypeMutation.mutate(v as OpportunityType)}
            disabled={changeTypeMutation.isPending}
          >
             <SelectTrigger className="h-5 w-auto gap-1 px-2.5 text-[10px] font-medium border-primary/30 text-primary bg-primary/5 rounded-full shrink-0 [&>svg]:h-3 [&>svg]:w-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new_business" className="text-xs">Novo Cliente</SelectItem>
              <SelectItem value="evolution" className="text-xs">Evolução</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {lead.cnpj && (
            <span className="text-[10px] text-muted-foreground font-medium tracking-wide">
              CNPJ {lead.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
            </span>
          )}
          {lead.cnpj && <span className="text-[10px] text-muted-foreground">·</span>}
          <ContactChipPanel
            lead={lead}
            onSaveContact={async (index, values) => {
              const updates: Record<string, string | null> = index === 0
                ? { name: values.name, phone: values.phone, email: values.email || null }
                : { contact_name_2: values.name, phone_3: values.phone, email_2: values.email || null };
              const { error } = await supabase.from('leads').update(updates).eq('id', lead.id);
              if (error) throw error;
              queryClient.invalidateQueries({ queryKey: ['lead-by-id', lead.id] });
              queryClient.invalidateQueries({ queryKey: ['leads'] });
              queryClient.invalidateQueries({ queryKey: ['closer-pipeline'] });
              queryClient.invalidateQueries({ queryKey: ['opportunity-by-id'] });
            }}
            onAddContact={async (values) => {
              const updates = { contact_name_2: values.name, phone_3: values.phone, email_2: values.email || null };
              const { error } = await supabase.from('leads').update(updates).eq('id', lead.id);
              if (error) throw error;
              queryClient.invalidateQueries({ queryKey: ['lead-by-id', lead.id] });
              queryClient.invalidateQueries({ queryKey: ['leads'] });
              queryClient.invalidateQueries({ queryKey: ['closer-pipeline'] });
            }}
            onDeleteContact={async (index) => {
              if (index !== 1) return;
              const { error } = await supabase.from('leads')
                .update({ contact_name_2: null, phone_3: null, phone_4: null, email_2: null })
                .eq('id', lead.id);
              if (error) throw error;
              queryClient.invalidateQueries({ queryKey: ['lead-by-id', lead.id] });
              queryClient.invalidateQueries({ queryKey: ['leads'] });
              queryClient.invalidateQueries({ queryKey: ['closer-pipeline'] });
              queryClient.invalidateQueries({ queryKey: ['opportunity-by-id'] });
            }}
          />
        </div>
      </div>

      {/* Row 2 — Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-px bg-border/40 rounded-xl overflow-hidden border border-border/40">

        {/* Setup */}
        <Popover open={popoverOpen} onOpenChange={handleOpenPopover}>
          <PopoverTrigger asChild>
            <div className="space-y-1 px-4 py-3 bg-[#f4f3f9] dark:bg-accent/20 cursor-pointer group hover:bg-[#eceaf5] dark:hover:bg-accent/30 transition-colors">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <DollarSign className="h-3 w-3 shrink-0" /> Setup
                <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary ml-auto" />
              </p>
              <p className="text-sm font-bold text-foreground font-display group-hover:text-primary transition-colors whitespace-nowrap">
                {formatCurrency(setupValue)}
              </p>
            </div>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-[calc(100vw-2rem)] sm:w-96 p-3 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Editar Setup</p>
            {hasProposal ? (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {editItems.length === 0 && <p className="text-xs text-muted-foreground italic">Nenhum item na proposta</p>}
                {editItems.map((item, idx) => (
                  <div key={idx} className="space-y-1 border-b border-border/50 pb-2 last:border-0 last:pb-0 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-foreground truncate flex-1" title={item.name}>{item.name}</span>
                      <Input type="text" inputMode="numeric" className="h-7 w-28 text-xs text-right focus-visible:ring-0 focus-visible:border-primary"
                        value={item.price.toLocaleString('pt-BR')} onChange={(e) => handleItemPriceChange(idx, e.target.value.replace(/\D/g, ''))} />
                    </div>
                    <Textarea placeholder="Detalhes da integração..." rows={1} className="text-xs min-h-7 h-auto resize-none w-full focus-visible:ring-0 focus-visible:border-primary"
                      value={item.details || ''} onChange={(e) => handleItemDetailsChange(idx, e.target.value)} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Valor do deal</label>
                <Input type="text" inputMode="numeric" className="h-8 text-sm focus-visible:ring-0 focus-visible:border-primary"
                  value={editDealValue.toLocaleString('pt-BR')} onChange={(e) => setEditDealValue(Number(e.target.value.replace(/\D/g, '')) || 0)} />
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t">
              <span className="text-xs font-semibold text-foreground">Total: {formatCurrency(editTotal)}</span>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave} disabled={isSaving}>
                <Save className="h-3 w-3" />{isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Receita Anual */}
        <div className="space-y-1 px-4 py-3 bg-[#f4f3f9] dark:bg-accent/20">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 whitespace-nowrap">
            <Repeat className="h-3 w-3 shrink-0" /> Receita Anual
          </p>
          <p className="text-sm font-bold text-primary font-display whitespace-nowrap">
            {mrrValue > 0 ? formatCurrency(mrrValue) : <span className="text-[10px] text-muted-foreground font-normal">Sem proposta</span>}
          </p>
        </div>

        {/* Probabilidade — arc SVG */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-3 px-4 py-3 bg-accent/20 cursor-help">
              <svg width="40" height="40" viewBox="0 0 44 44" className="flex-shrink-0">
                <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-border" />
                <circle cx="22" cy="22" r="18" fill="none" strokeWidth="3.5" strokeLinecap="round"
                  stroke={probability >= 71 ? 'hsl(var(--success))' : probability >= 41 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'}
                  strokeDasharray={`${(probability / 100) * (2 * Math.PI * 18)} ${2 * Math.PI * 18}`}
                  style={{ transformOrigin: '22px 22px', transform: 'rotate(-90deg)' }}
                />
                <text x="22" y="26" textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="var(--font-display, sans-serif)"
                  fill={probability >= 71 ? 'hsl(var(--success))' : probability >= 41 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'}>
                  {probability}%
                </text>
              </svg>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide whitespace-nowrap">Probabilidade</p>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[280px] text-[10px] leading-relaxed">
            <p className="font-semibold mb-1">Probabilidade de Fechamento</p>
            <p>Calculada automaticamente com base em 7 fatores: qualificação do lead, presença de decisor, valor do deal, tempo no pipeline, objeções ativas, estágio atual e histórico de interações.</p>
          </TooltipContent>
        </Tooltip>

        {/* Pipeline */}
        {canManage ? (
          <Popover open={pipelinePopoverOpen} onOpenChange={setPipelinePopoverOpen}>
            <PopoverTrigger asChild>
              <div className="space-y-1 px-4 py-3 bg-[#f4f3f9] dark:bg-accent/20 cursor-pointer group hover:bg-[#eceaf5] dark:hover:bg-accent/30 transition-colors">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 whitespace-nowrap">
                  <Briefcase className="h-3 w-3 shrink-0" /> Pipeline
                  <ChevronDown className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary ml-auto" />
                </p>
                <p className="text-sm font-semibold text-primary whitespace-nowrap">
                  {opportunityTypeLabel}
                </p>
                <p className={cn("text-[10px] whitespace-nowrap",
                  daysInPipeline > 14 ? 'text-destructive' : daysInPipeline > 7 ? 'text-[hsl(var(--chart-2))]' : 'text-muted-foreground')}>
                  {daysInPipeline} dias
                </p>
              </div>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-48 p-1">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-accent transition-colors"
                onClick={() => { changeTypeMutation.mutate('new_business'); setPipelinePopoverOpen(false); }}
              >
                <Briefcase className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="flex-1 text-left">Novo Negócio</span>
                {(opportunity.opportunity_type || 'new_business') === 'new_business' && <Check className="h-3 w-3 text-primary" />}
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-accent transition-colors"
                onClick={() => { changeTypeMutation.mutate('evolution'); setPipelinePopoverOpen(false); }}
              >
                <Repeat className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="flex-1 text-left">Evolução</span>
                {opportunity.opportunity_type === 'evolution' && <Check className="h-3 w-3 text-primary" />}
              </button>
              <Separator className="my-1" />
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-destructive/10 transition-colors text-destructive"
                onClick={() => { setPipelinePopoverOpen(false); setPrevendaReason(''); setMoveToPrevendaOpen(true); }}
              >
                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 text-left">Pré-vendas (Reciclagem)</span>
              </button>
            </PopoverContent>
          </Popover>
        ) : (
          <div className="space-y-1 px-4 py-3 bg-[#f4f3f9] dark:bg-accent/20">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 whitespace-nowrap">
              <Briefcase className="h-3 w-3 shrink-0" /> Pipeline
            </p>
            <p className="text-sm font-semibold text-primary whitespace-nowrap">
              {opportunityTypeLabel}
            </p>
            <p className={cn("text-[10px] whitespace-nowrap",
              daysInPipeline > 14 ? 'text-destructive' : daysInPipeline > 7 ? 'text-[hsl(var(--chart-2))]' : 'text-muted-foreground')}>
              {daysInPipeline} dias
            </p>
          </div>
        )}

        {/* SDR */}
        <div className="space-y-1 px-4 py-3 bg-[#f4f3f9] dark:bg-accent/20">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 whitespace-nowrap">
            <User className="h-3 w-3 shrink-0" /> SDR
          </p>
          <div onClick={(e) => e.stopPropagation()}>
            <OpportunitySDRSelector
              opportunityId={opportunity.id}
              currentSdrId={opportunity.sdr_user_id ?? null}
              currentSdrName={opportunity.sdr_name ?? null}
              disabled={!canManage}
            />
          </div>
        </div>

        {/* Closer */}
        {opportunityId && (
          <div className="space-y-1 px-4 py-3 bg-[#f4f3f9] dark:bg-accent/20">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 whitespace-nowrap">
              <UserCheck className="h-3 w-3 shrink-0" /> Closer
            </p>
            <div onClick={(e) => e.stopPropagation()}>
              <CloserSelector opportunityId={opportunityId} currentCloserId={currentCloserId ?? null}
                currentCloserName={closerName ?? null} disabled={!canEditCloser} closerOnly={true} />
            </div>
          </div>
        )}
      </div>

      {/* AlertDialog — confirm move to Pré-vendas */}
      <AlertDialog open={moveToPrevendaOpen} onOpenChange={setMoveToPrevendaOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover para Pré-vendas?</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente será devolvido ao pipeline do SDR para reciclagem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Motivo (opcional): ex: reciclagem, sem budget agora..."
            value={prevendaReason}
            onChange={(e) => setPrevendaReason(e.target.value)}
            className="mt-1"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => moveToPrevenda.mutate(prevendaReason)}
              disabled={moveToPrevenda.isPending}
            >
              {moveToPrevenda.isPending ? 'Movendo...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
