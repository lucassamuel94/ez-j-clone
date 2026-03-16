import { useState, useMemo, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel';
import {
  Calculator, Users, Shield, CheckCircle2, TrendingUp, Wrench, Info,
  QrCode, Receipt, CreditCard, FileText, Loader2, Building2, ChevronDown, ChevronUp, Check, LayoutGrid
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useProducts, Product } from '@/hooks/useProducts';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  calculateSimulation, recommendPlan, simulateGrowth,
  PlanData, SimulatorInput, MetaCostConfig, DEFAULT_META_CONFIG,
} from '@/hooks/useSimulator';
import { MetaCostEditor } from '@/components/MetaCostEditor';
import { Lead } from '@/types/lead';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const toPlanData = (p: Product): PlanData => ({
  id: p.id,
  name: p.name,
  price: p.price,
  messagesIncluded: p.messages_included,
  contactsIncluded: p.contacts_included,
  excessMessagePrice: p.excess_message_price,
  excessContactPrice: p.excess_contact_price,
});

interface ProposalSimulatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  lead: Lead | null;
  opportunity: any;
  onSuccess?: () => void;
  productType?: string;
}

export function ProposalSimulatorDialog({
  open,
  onOpenChange,
  opportunityId,
  lead,
  opportunity,
  onSuccess,
  productType = 'ez_chat',
}: ProposalSimulatorDialogProps) {
  const queryClient = useQueryClient();
  const { user: authUser } = useCurrentUser();
  const { products: chatPlans, isLoading: loadingChat } = useProducts('ez_chat');
  const { products: setupProducts, isLoading: loadingSetup } = useProducts('setup_integracoes');
  const { products: metaProducts, isLoading: loadingMeta } = useProducts('meta_custos');
  const { data: exchangeRate } = useExchangeRate();

  const [proposalLoading, setProposalLoading] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [input, setInput] = useState<SimulatorInput>({ contacts: 500, messages: 15000, attendants: 3, growthPercent: 30 });
  const [fullSetup, setFullSetup] = useState(false);
  const [selectedIntegrations, setSelectedIntegrations] = useState<Record<string, 1 | 2>>({});
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [discounts, setDiscounts] = useState<Record<string, { type: 'reais' | 'percent'; value: number }>>({});
  const [integrationDetails, setIntegrationDetails] = useState<Record<string, string>>({});
  const [installments, setInstallments] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'boleto' | 'cartao'>('pix');
  const [contractMonths, setContractMonths] = useState(12);
  const [cancellationFee, setCancellationFee] = useState(20);
  const [validityDays, setValidityDays] = useState(30);
  const [notes, setNotes] = useState('');
  const [showMetaCosts, setShowMetaCosts] = useState(true);
  const [localPercentages, setLocalPercentages] = useState<Record<string, number>>({});

  // Pre-fill integration details from product descriptions
  useEffect(() => {
    if (setupProducts.length > 0) {
      setIntegrationDetails(prev => {
        const next = { ...prev };
        setupProducts.forEach(p => {
          if (p.description && !next[p.id]) {
            next[p.id] = p.description;
          }
        });
        return next;
      });
    }
  }, [setupProducts]);

  const usdToBrl = exchangeRate?.rate ?? DEFAULT_META_CONFIG.usdToBrl;

  // Auto-filled from lead
  const companyName = lead?.razao_social || lead?.nome_fantasia || lead?.company || '';
  const cnpj = lead?.cnpj || '';
  const contactName = lead?.name || '';
  const contactEmail = lead?.email || '';
  const contactPhone = lead?.phone || lead?.whatsapp || '';

  const baseMetaConfig: MetaCostConfig = useMemo(() => {
    const configProduct = metaProducts.find(p => p.subcategory === 'config');
    const conversationsPerContact = (configProduct?.features as any)?.conversations_per_contact ?? 1;
    const active = metaProducts.filter(p => p.active && p.subcategory !== 'config');
    if (active.length === 0) return { ...DEFAULT_META_CONFIG, usdToBrl, conversationsPerContact };
    return {
      entries: active.map(p => ({ name: p.name, priceUsd: p.price, percentage: (p.features as any)?.percentage ?? 0 })),
      usdToBrl,
      conversationsPerContact,
    };
  }, [metaProducts, usdToBrl]);

  const metaConfig: MetaCostConfig = useMemo(() => {
    if (Object.keys(localPercentages).length === 0) return baseMetaConfig;
    return {
      ...baseMetaConfig,
      entries: baseMetaConfig.entries.map(e => ({
        ...e,
        percentage: localPercentages[e.name] ?? e.percentage,
      })),
    };
  }, [baseMetaConfig, localPercentages]);

  const plans = useMemo(() => chatPlans.filter(p => p.active).map(toPlanData), [chatPlans]);
  const recommended = useMemo(() => plans.length ? recommendPlan(input, plans, metaConfig) : null, [input, plans, metaConfig]);
  const simulation = useMemo(() => recommended ? calculateSimulation(input, recommended, metaConfig) : null, [input, recommended, metaConfig]);

  const growthScenarios = useMemo(() => {
    if (!recommended) return [];
    const g = input.growthPercent || 30;
    return [
      { label: 'Cenário atual', result: calculateSimulation(input, recommended, metaConfig), growth: 0 },
      { label: `+${g}% crescimento`, result: simulateGrowth(input, recommended, g, metaConfig), growth: g },
    ];
  }, [input, recommended, metaConfig]);

  const essentialSetupIds = useMemo(() => setupProducts.filter(p => p.subcategory === 'Setup e Onboarding').map(p => p.id), [setupProducts]);

  const getFinalPrice = useCallback((id: string, basePrice: number) => {
    const d = discounts[id];
    if (!d || d.value <= 0) return basePrice;
    if (d.type === 'reais') return Math.max(0, basePrice - d.value);
    return Math.max(0, basePrice * (1 - d.value / 100));
  }, [discounts]);

  const setupTotal = useMemo(() => {
    const essential = setupProducts.filter(p => essentialSetupIds.includes(p.id)).reduce((s, p) => s + getFinalPrice(p.id, customPrices[p.id] ?? p.price), 0);
    const integrations = Object.entries(selectedIntegrations).filter(([, ph]) => ph === 1).reduce((s, [id]) => {
      const prod = setupProducts.find(p => p.id === id);
      return s + getFinalPrice(id, customPrices[id] ?? prod?.price ?? 0);
    }, 0);
    return essential + integrations;
  }, [setupProducts, essentialSetupIds, selectedIntegrations, customPrices, getFinalPrice]);

  const integrationProducts = useMemo(() => setupProducts.filter(p => p.frequency === 'unique' && !essentialSetupIds.includes(p.id)), [setupProducts, essentialSetupIds]);

  const toggleIntegration = useCallback((id: string) => {
    setSelectedIntegrations(prev => {
      const current = prev[id];
      if (!current) return { ...prev, [id]: 1 };
      if (current === 1) return { ...prev, [id]: 2 };
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const formatThousands = useCallback((value: number) => {
    return value ? value.toLocaleString('pt-BR') : '';
  }, []);

  const parseThousands = useCallback((value: string) => {
    return parseInt(value.replace(/\./g, '')) || 0;
  }, []);

  const updateInput = useCallback((field: keyof SimulatorInput, value: string) => {
    setInput(prev => ({ ...prev, [field]: parseThousands(value) }));
  }, [parseThousands]);

  const handleGenerate = useCallback(async () => {
    if (!simulation || !recommended) { toast.error('Execute uma simulação primeiro'); return; }
    if (proposalLoading) return;
    setProposalLoading(true);

    try {
      if (!authUser?.id) { toast.error('Você precisa estar logado'); return; }

      // Fetch SDR/Closer names in parallel
      let sdrName = '';
      let closerName = '';
      if (opportunity) {
        const profileIds = [opportunity.sdr_user_id, opportunity.assigned_to_user_id].filter(Boolean);
        if (profileIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', profileIds);
          if (profiles) {
            sdrName = profiles.find(p => p.id === opportunity.sdr_user_id)?.name || '';
            closerName = profiles.find(p => p.id === opportunity.assigned_to_user_id)?.name || '';
          }
        }
      }

      // Build integrations list
      const essentialList = setupProducts.filter(p => essentialSetupIds.includes(p.id)).map(p => {
        const base = customPrices[p.id] ?? p.price;
        const final = getFinalPrice(p.id, base);
        const disc = discounts[p.id];
        return {
          name: p.name, price: final,
          originalPrice: base !== final ? base : undefined,
          discountLabel: disc && disc.value > 0 ? (disc.type === 'percent' ? `${disc.value}%` : formatCurrency(disc.value)) : undefined,
          phase: 1,
          details: integrationDetails[p.id] || p.description || undefined,
        };
      });

      const integrationsList = Object.entries(selectedIntegrations).map(([id, phase]) => {
        const prod = setupProducts.find(p => p.id === id);
        if (!prod) return null;
        const base = customPrices[id] ?? prod.price;
        const final = getFinalPrice(id, base);
        const disc = discounts[id];
        return {
          name: prod.name, price: final,
          originalPrice: base !== final ? base : undefined,
          discountLabel: disc && disc.value > 0 ? (disc.type === 'percent' ? `${disc.value}%` : formatCurrency(disc.value)) : undefined,
          phase,
          details: integrationDetails[id] || undefined,
        };
      }).filter(Boolean);

      const { data: proposal, error } = await supabase
        .from('proposals')
        .insert({
          opportunity_id: opportunityId,
          created_by_user_id: authUser.id,
          company_name: companyName,
          cnpj: cnpj || null,
          contact_name: contactName || null,
          contact_email: contactEmail || null,
          contact_phone: contactPhone || null,
          sdr_name: sdrName || null,
          closer_name: closerName || null,
          plan_name: recommended.name,
          plan_price: recommended.price,
          estimated_contacts: input.contacts,
          estimated_messages: input.messages,
          meta_cost: showMetaCosts ? simulation.metaCost : 0,
          total_monthly: showMetaCosts ? simulation.totalMonthly : (simulation.totalMonthly - simulation.metaCost),
          show_meta_costs: showMetaCosts,
          meta_cost_config: Object.keys(localPercentages).length > 0 ? { entries: metaConfig.entries.map(e => ({ name: e.name, percentage: e.percentage })) } : null,
          setup_total: setupTotal,
          setup_payment_method: paymentMethod,
          setup_installments: installments,
          integrations: [...essentialList, ...integrationsList] as any,
          contract_months: contractMonths,
          cancellation_fee_percent: cancellationFee,
          validity_days: validityDays,
          notes: notes || null,
          status: 'sent',
          product_type: productType,
        })
        .select()
        .single();

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['opportunity-proposals', opportunityId] });
      onSuccess?.();
      onOpenChange(false);

      toast.success('Proposta gerada com sucesso!', {
        action: {
          label: 'Visualizar',
          onClick: () => window.open(`/proposal-preview/${proposal.id}`, '_blank'),
        },
      });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar proposta');
    } finally {
      setProposalLoading(false);
    }
  }, [simulation, recommended, proposalLoading, authUser, opportunity, setupProducts, essentialSetupIds, selectedIntegrations, customPrices, discounts, integrationDetails, getFinalPrice, companyName, cnpj, contactName, contactEmail, contactPhone, input, setupTotal, paymentMethod, installments, contractMonths, cancellationFee, validityDays, notes, productType, opportunityId, queryClient, onSuccess, onOpenChange, showMetaCosts, localPercentages, metaConfig]);

  const isLoading = loadingChat || loadingSetup || loadingMeta;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1366px] w-full max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5 text-primary" />
              Simulador Comercial — EZ Chat
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="modal-technical-mode" className="text-xs text-muted-foreground cursor-pointer">Modo Técnico</Label>
              <Switch id="modal-technical-mode" checked={showTechnical} onCheckedChange={setShowTechnical} />
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(90vh-160px)]">
            <div className="px-6 py-5 space-y-5">

              {/* Auto-filled company info */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Dados do Cliente (auto-preenchido)</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                  <div><span className="text-muted-foreground">Empresa:</span> <span className="font-medium">{companyName || '—'}</span></div>
                  <div><span className="text-muted-foreground">CNPJ:</span> <span className="font-medium">{cnpj || '—'}</span></div>
                  <div><span className="text-muted-foreground">Contato:</span> <span className="font-medium">{contactName || '—'}</span></div>
                  <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{contactEmail || '—'}</span></div>
                  <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{contactPhone || '—'}</span></div>
                </div>
              </div>

              {/* Plans Carousel - above context */}
              {chatPlans.length > 0 && (
                <Collapsible open={plansOpen} onOpenChange={setPlansOpen}>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between cursor-pointer">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <LayoutGrid className="h-3.5 w-3.5" /> Planos EZ Chat
                        </p>
                        {plansOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-4">
                        <Carousel opts={{ align: 'start', loop: false }} className="w-full">
                          <CarouselContent className="-ml-3">
                            {chatPlans.filter(p => p.active).map(plan => {
                              const isRecommended = recommended?.name === plan.name;
                              return (
                                <CarouselItem key={plan.id} className="pl-3 basis-full md:basis-1/3 pt-4">
                                  <div className={`relative rounded-lg border p-4 h-full flex flex-col transition-all hover:shadow-md bg-background ${
                                    isRecommended ? 'border-2 border-primary shadow-[0_0_16px_hsl(var(--primary)/0.12)]' : 'border-border'
                                  }`}>
                                    {plan.recommended && (
                                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                                        Recomendado
                                      </span>
                                    )}
                                    {isRecommended && !plan.recommended && (
                                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                                        Seu Plano
                                      </span>
                                    )}
                                    <h4 className="text-sm font-bold mt-1">{plan.name}</h4>
                                    {plan.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{plan.description}</p>}
                                    <p className="text-xl font-bold text-primary mt-2 font-display">
                                      {formatCurrency(plan.price)}<span className="text-[10px] font-normal text-muted-foreground">/mês</span>
                                    </p>
                                    <div className="mt-3 space-y-1.5 flex-1">
                                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                        <Check className="h-3 w-3 text-primary shrink-0" />
                                        {plan.messages_included.toLocaleString('pt-BR')} mensagens
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                        <Check className="h-3 w-3 text-primary shrink-0" />
                                        {plan.contacts_included.toLocaleString('pt-BR')} contatos
                                      </div>
                                    </div>
                                    <div className="mt-2 pt-2 border-t text-[10px] text-muted-foreground">
                                      Exc.: {formatCurrency(plan.excess_message_price)}/msg · {formatCurrency(plan.excess_contact_price)}/contato
                                    </div>
                                  </div>
                                </CarouselItem>
                              );
                            })}
                          </CarouselContent>
                          <CarouselPrevious className="hidden md:flex -left-3 h-7 w-7" />
                          <CarouselNext className="hidden md:flex -right-3 h-7 w-7" />
                        </Carousel>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}

              {/* Client Context */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" /> Contexto do Cliente
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Contatos/mês</Label>
                    <Input type="text" inputMode="numeric" value={formatThousands(input.contacts)} onChange={e => updateInput('contacts', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Mensagens/mês</Label>
                    <Input type="text" inputMode="numeric" value={formatThousands(input.messages)} onChange={e => updateInput('messages', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Atendentes</Label>
                    <Input type="number" value={input.attendants} onChange={e => updateInput('attendants', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Crescimento (%)</Label>
                    <Input type="number" value={input.growthPercent} onChange={e => updateInput('growthPercent', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Meta Cost Editor */}
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Custos Meta WhatsApp</p>
                <MetaCostEditor
                  metaConfig={baseMetaConfig}
                  showMetaCosts={showMetaCosts}
                  onShowMetaCostsChange={setShowMetaCosts}
                  localPercentages={localPercentages}
                  onPercentageChange={(name, value) => setLocalPercentages(prev => ({ ...prev, [name]: value }))}
                  compact
                />
              </div>

              {/* Recommended Plan */}
              {simulation && recommended && (
                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" /> Plano Recomendado
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-lg bg-background">
                      <p className="text-xs text-muted-foreground">Plano</p>
                      <p className="text-lg font-bold">{recommended.name}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-background">
                      <p className="text-xs text-muted-foreground">Valor Base</p>
                      <p className="text-lg font-bold">{formatCurrency(simulation.basePrice)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-background text-center">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        Custo Meta (aprox.)
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-sm text-xs leading-relaxed p-3">
                              <p className="font-medium mb-1">Premissa: cada contato abre <strong>{metaConfig.conversationsPerContact}</strong> conversa{metaConfig.conversationsPerContact !== 1 ? 's' : ''} por mês, distribuída{metaConfig.conversationsPerContact !== 1 ? 's' : ''} proporcionalmente entre os tipos:</p>
                              <ul className="list-none space-y-0.5 mt-1">
                                {metaConfig.entries.map((e) => (
                                  <li key={e.name}>• {e.name}: <strong>{e.percentage}%</strong></li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </p>
                      <p className="text-lg font-bold">{formatCurrency(simulation.metaCost)}</p>
                    </div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-primary/10 border border-primary/20">
                    <p className="text-xs text-muted-foreground mb-1">Total Mensal Aproximado</p>
                    <p className="text-3xl font-extrabold text-primary">{formatCurrency(simulation.totalMonthly)}</p>
                  </div>
                </div>
              )}

              {/* Growth Simulation */}
              {growthScenarios.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5" /> Simulação de Segurança
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {growthScenarios.map((s, i) => (
                      <div key={i} className={`text-center p-4 rounded-lg border ${i === 0 ? 'border-primary/30 bg-primary/5' : 'bg-muted/30'}`}>
                        <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                        <p className="text-xl font-bold">{formatCurrency(s.result.totalMonthly)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Excess info - always visible */}
              {simulation && recommended && (
                <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="p-2 rounded-md bg-muted/30">
                      <p className="text-xs text-muted-foreground">Msgs excedentes</p>
                      <p className="font-semibold">{simulation.excessMessages.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted/30">
                      <p className="text-xs text-muted-foreground">Contatos excedentes</p>
                      <p className="font-semibold">{simulation.excessContacts.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted/30">
                      <p className="text-xs text-muted-foreground">Preço exc./msg</p>
                      <p className="font-semibold">{formatCurrency(recommended.excessMessagePrice)}</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted/30">
                      <p className="text-xs text-muted-foreground">Preço exc./contato</p>
                      <p className="font-semibold">{formatCurrency(recommended.excessContactPrice)}</p>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground bg-muted/20 rounded-md px-3 py-2">
                    <strong>Regra:</strong> Excedente só é cobrado se <em>ambos</em> os limites (mensagens e contatos) forem ultrapassados. Nesse caso, cobra-se o <strong>menor</strong> valor entre os dois.
                    {simulation.appliedExcessCost > 0
                      ? <span className="ml-1 font-semibold text-foreground">Excedente aplicado: {formatCurrency(simulation.appliedExcessCost)}</span>
                      : <span className="ml-1 font-semibold text-[hsl(var(--success))]">Nenhum excedente aplicado.</span>}
                  </div>
                </div>
              )}

              {/* Technical Detail - Meta table only */}
              {showTechnical && simulation && recommended && (
                <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Info className="h-3.5 w-3.5" /> Detalhamento Técnico
                  </p>

                  {/* Meta table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tabela Meta (WhatsApp Oficial)</p>
                      <Badge variant="secondary" className="text-[10px]">USD → BRL: {usdToBrl.toFixed(2)}</Badge>
                    </div>
                    <div className="overflow-auto rounded-md border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tipo</th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Preço USD</th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">% Conversas</th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qtd Estimada</th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Custo BRL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {simulation.metaBreakdown.entries.map((entry, idx) => (
                            <tr key={idx} className="border-b last:border-0">
                              <td className="px-3 py-1.5">{entry.name}</td>
                              <td className="text-right px-3 py-1.5">${metaConfig.entries[idx]?.priceUsd?.toFixed(4) ?? '—'}</td>
                              <td className="text-right px-3 py-1.5">{metaConfig.entries[idx]?.percentage ?? 0}%</td>
                              <td className="text-right px-3 py-1.5">{entry.conversations.toLocaleString('pt-BR')}</td>
                              <td className="text-right px-3 py-1.5 font-medium">{formatCurrency(entry.costBrl)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-muted/30 font-semibold">
                            <td colSpan={4} className="px-3 py-2 text-right">Total Meta</td>
                            <td className="text-right px-3 py-2">{formatCurrency(simulation.metaBreakdown.totalBrl)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5" /> Investimento de Implementação
                </p>

                <div className="flex items-center gap-2 mb-3">
                  <Switch checked={fullSetup} onCheckedChange={c => { setFullSetup(c); if (!c) setSelectedIntegrations({}); }} />
                  <Label className="text-sm">{fullSetup ? 'Completa' : 'Essencial (Go-live)'}</Label>
                </div>

                {/* Essential setup */}
                <div className="space-y-1.5">
                  {setupProducts.filter(p => essentialSetupIds.includes(p.id)).map(p => {
                    const base = customPrices[p.id] ?? p.price;
                    const disc = discounts[p.id];
                    const final = getFinalPrice(p.id, base);
                    const hasDisc = disc && disc.value > 0;
                    return (
                      <div key={p.id} className="space-y-1">
                        <div className="flex justify-between items-center text-sm">
                          <span>{p.name}</span>
                          <Input type="number" className="w-28 h-7 text-right text-sm font-medium" value={base}
                            onChange={e => setCustomPrices(prev => ({ ...prev, [p.id]: Number(e.target.value) }))} />
                        </div>
                        <div className="flex items-center gap-2 bg-muted/30 rounded-md px-2 py-1">
                          <div className="flex items-center rounded-full overflow-hidden h-6 bg-muted">
                            <button type="button" className={`px-2 h-full text-xs font-medium rounded-full transition-colors ${(!disc || disc.type === 'percent') ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}
                              onClick={() => setDiscounts(prev => ({ ...prev, [p.id]: { type: 'percent', value: prev[p.id]?.value ?? 0 } }))}>%</button>
                            <button type="button" className={`px-2 h-full text-xs font-medium rounded-full transition-colors ${disc?.type === 'reais' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}
                              onClick={() => setDiscounts(prev => ({ ...prev, [p.id]: { type: 'reais', value: prev[p.id]?.value ?? 0 } }))}>R$</button>
                          </div>
                          <Input type="number" step="0.01" placeholder="Desc." className="w-20 h-7 text-xs text-right"
                            value={disc?.value ?? ''} onChange={e => {
                              const val = parseFloat(e.target.value);
                              setDiscounts(prev => ({ ...prev, [p.id]: { type: prev[p.id]?.type ?? 'percent', value: isNaN(val) ? 0 : val } }));
                            }} />
                          {hasDisc && <span className="text-xs font-semibold text-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)] px-2 py-0.5 rounded whitespace-nowrap">= {formatCurrency(final)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Integration products */}
                {fullSetup && integrationProducts.length > 0 && (
                  <>
                    <Separator className="my-3" />
                    <p className="text-xs font-medium mb-2">Integrações (clique para alternar fase)</p>
                    <div className="space-y-1.5">
                      {integrationProducts.map(p => {
                        const phase = selectedIntegrations[p.id];
                        const price = customPrices[p.id] ?? p.price;
                        const disc = discounts[p.id];
                        const final = getFinalPrice(p.id, price);
                        const hasDisc = disc && disc.value > 0;
                        return (
                          <div key={p.id} className="py-1.5 px-2 rounded-md hover:bg-muted/50 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 cursor-pointer flex-1 min-w-0" onClick={() => toggleIntegration(p.id)}>
                                <Checkbox checked={!!phase} />
                                <span className="text-sm truncate">{p.name}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {phase && <Badge variant={phase === 1 ? 'default' : 'secondary'} className="text-xs cursor-pointer" onClick={() => toggleIntegration(p.id)}>Fase {phase}</Badge>}
                                <Input type="number" step="0.01" value={price} className="w-24 h-7 text-xs text-right"
                                  onChange={e => setCustomPrices(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))}
                                  onClick={e => e.stopPropagation()} />
                              </div>
                            </div>
                            <Textarea placeholder="Detalhes da integração..." className="ml-8 text-xs resize-none min-h-[32px] h-8 focus:h-16 transition-all w-[calc(100%-2rem)]"
                              value={integrationDetails[p.id] || ''} onChange={e => setIntegrationDetails(prev => ({ ...prev, [p.id]: e.target.value }))}
                              onClick={e => e.stopPropagation()} />
                            {phase && (
                              <div className="flex items-center gap-2 ml-8 bg-muted/30 rounded-md px-2 py-1">
                                <div className="flex items-center rounded-full overflow-hidden h-6 bg-muted">
                                  <button type="button" className={`px-2 h-full text-xs font-medium rounded-full transition-colors ${(!disc || disc.type === 'percent') ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}
                                    onClick={e => { e.stopPropagation(); setDiscounts(prev => ({ ...prev, [p.id]: { type: 'percent', value: prev[p.id]?.value ?? 0 } })); }}>%</button>
                                  <button type="button" className={`px-2 h-full text-xs font-medium rounded-full transition-colors ${disc?.type === 'reais' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}
                                    onClick={e => { e.stopPropagation(); setDiscounts(prev => ({ ...prev, [p.id]: { type: 'reais', value: prev[p.id]?.value ?? 0 } })); }}>R$</button>
                                </div>
                                <Input type="number" step="0.01" placeholder="Desc." className="w-20 h-7 text-xs text-right"
                                  value={disc?.value ?? ''} onChange={e => {
                                    const val = parseFloat(e.target.value);
                                    setDiscounts(prev => ({ ...prev, [p.id]: { type: prev[p.id]?.type ?? 'percent', value: isNaN(val) ? 0 : val } }));
                                  }} onClick={e => e.stopPropagation()} />
                                {hasDisc && <span className="text-xs font-semibold text-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)] px-2 py-0.5 rounded whitespace-nowrap">= {formatCurrency(final)}</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                <Separator className="my-3" />

                {/* Setup total + payment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="text-center p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm text-muted-foreground">Total Implementação</p>
                    <p className="text-2xl font-bold text-primary font-display">{formatCurrency(setupTotal)}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <p className="text-sm text-muted-foreground text-center">Forma de Pagamento</p>
                    <RadioGroup value={paymentMethod} onValueChange={v => {
                      const m = v as 'pix' | 'boleto' | 'cartao';
                      setPaymentMethod(m);
                      if (m === 'pix') setInstallments(1);
                      else if (m === 'boleto' && installments > 6) setInstallments(6);
                    }} className="flex justify-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="pix" id="modal-pix" />
                        <Label htmlFor="modal-pix" className="flex items-center gap-1 text-xs cursor-pointer"><QrCode className="h-3.5 w-3.5" /> Pix</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="boleto" id="modal-boleto" />
                        <Label htmlFor="modal-boleto" className="flex items-center gap-1 text-xs cursor-pointer"><Receipt className="h-3.5 w-3.5" /> Boleto</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="cartao" id="modal-cartao" />
                        <Label htmlFor="modal-cartao" className="flex items-center gap-1 text-xs cursor-pointer"><CreditCard className="h-3.5 w-3.5" /> Cartão</Label>
                      </div>
                    </RadioGroup>
                    {paymentMethod !== 'pix' && (
                      <div className="flex items-center justify-center gap-2">
                        <Label className="text-xs">Parcelas:</Label>
                        <select className="border rounded-md px-2 py-1 text-xs bg-background" value={installments}
                          onChange={e => setInstallments(Number(e.target.value))}>
                          {Array.from({ length: paymentMethod === 'boleto' ? 6 : 12 }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>{n}x</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Contract terms */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Termos Contratuais</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Prazo (meses)</Label>
                    <Input type="number" value={contractMonths} onChange={e => setContractMonths(parseInt(e.target.value) || 12)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Multa rescisão (%)</Label>
                    <Input type="number" value={cancellationFee} onChange={e => setCancellationFee(parseFloat(e.target.value) || 20)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Validade (dias)</Label>
                    <Input type="number" value={validityDays} onChange={e => setValidityDays(parseInt(e.target.value) || 30)} />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Observações</Label>
                <Textarea placeholder="Observações adicionais..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="resize-none text-sm" />
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="px-6 py-4 border-t gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={proposalLoading}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={proposalLoading || !simulation}>
            {proposalLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando...</> : <><FileText className="h-4 w-4 mr-2" /> Gerar Proposta</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
