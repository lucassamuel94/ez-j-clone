import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Shield, CheckCircle2, TrendingUp, Users, MessageSquare, Calculator, Eye, BarChart3, Wrench, ChevronDown, ChevronUp, Info, CreditCard, Receipt, QrCode, FileText, Percent, DollarSign, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { type ProposalData } from '@/components/ProposalConfirmationDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useProducts, Product } from '@/hooks/useProducts';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { calculateSimulation, recommendPlan, simulateGrowth, PlanData, SimulatorInput, MetaCostConfig, DEFAULT_META_CONFIG, AICostConfig, DEFAULT_AI_CONFIG, AI_MODELS, calculateEZCallSimulation, recommendEZCallPlan, EZCallSimulationResult } from '@/hooks/useSimulator';
import { MetaCostEditor } from '@/components/MetaCostEditor';
import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/lib/utils';

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
  minExtensions: p.min_extensions ?? undefined,
  maxExtensions: p.max_extensions ?? undefined,
  pricePerExtension: p.price_per_extension ?? undefined,
  customPricing: p.custom_pricing ?? undefined,
  features: (p.features as string[]) ?? undefined,
});

const STORAGE_KEY = 'simulator-state';

const loadSavedState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
};

const SimulatorPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const opportunityId = searchParams.get('opportunityId');
  const isEzCall = searchParams.get('type') === 'ez-call';
  const productType = isEzCall ? 'ez_call' : 'ez_chat';

  const { products: chatPlans, isLoading: loadingChat } = useProducts(productType);
  const { products: setupProducts, isLoading: loadingSetup } = useProducts('setup_integracoes');
  const { products: metaProducts, isLoading: loadingMeta } = useProducts('meta_custos');
  const { data: exchangeRate } = useExchangeRate();

  const [proposalLoading, setProposalLoading] = useState(false);

  const usdToBrl = exchangeRate?.rate ?? DEFAULT_META_CONFIG.usdToBrl;

  const baseMetaConfig: MetaCostConfig = useMemo(() => {
    const configProduct = metaProducts.find(p => p.subcategory === 'config');
    const conversationsPerContact = (configProduct?.features as any)?.conversations_per_contact ?? 1;
    const activeMetaProducts = metaProducts.filter(p => p.active && p.subcategory !== 'config');
    if (activeMetaProducts.length === 0) return { ...DEFAULT_META_CONFIG, usdToBrl, conversationsPerContact };
    return {
      entries: activeMetaProducts.map(p => ({
        name: p.name,
        priceUsd: p.price,
        percentage: (p.features as any)?.percentage ?? 0,
      })),
      usdToBrl,
      conversationsPerContact,
    };
  }, [metaProducts, usdToBrl]);

  const saved = useMemo(() => loadSavedState(), []);

  const [showMetaCosts, setShowMetaCosts] = useState(isEzCall ? false : (saved?.showMetaCosts ?? true));
  const [localPercentages, setLocalPercentages] = useState<Record<string, number>>(saved?.localPercentages ?? {});

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

  const [input, setInput] = useState<SimulatorInput>(saved?.input ?? {
    contacts: 500,
    messages: 15000,
    attendants: 3,
    growthPercent: 30,
  });

  const [showTechnical, setShowTechnical] = useState(false);
  const [fullSetup, setFullSetup] = useState(saved?.fullSetup ?? false);
  const [selectedIntegrations, setSelectedIntegrations] = useState<Record<string, 1 | 2>>(saved?.selectedIntegrations ?? {});
  const [customPrices, setCustomPrices] = useState<Record<string, number>>(saved?.customPrices ?? {});
  const [discounts, setDiscounts] = useState<Record<string, { type: 'reais' | 'percent'; value: number }>>(saved?.discounts ?? {});
  const [integrationDetails, setIntegrationDetails] = useState<Record<string, string>>(saved?.integrationDetails ?? {});
  const [installments, setInstallments] = useState(saved?.installments ?? 1);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'boleto' | 'cartao'>(saved?.paymentMethod ?? 'pix');
  const [aiConfig, setAIConfig] = useState<AICostConfig>(saved?.aiConfig ?? DEFAULT_AI_CONFIG);

  // Persist state to localStorage
  const saveState = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        input,
        fullSetup,
        selectedIntegrations,
        customPrices,
        discounts,
        integrationDetails,
        installments,
        paymentMethod,
        aiConfig,
        showMetaCosts,
        localPercentages,
      }));
    } catch {}
  }, [input, fullSetup, selectedIntegrations, customPrices, discounts, integrationDetails, installments, paymentMethod, aiConfig, showMetaCosts, localPercentages]);

  useEffect(() => {
    saveState();
  }, [saveState]);

  const plans = useMemo(() => chatPlans.filter(p => p.active).map(toPlanData), [chatPlans]);

  const recommended = useMemo(() => {
    if (!plans.length) return null;
    if (isEzCall) return recommendEZCallPlan(input.contacts, plans);
    return recommendPlan(input, plans, metaConfig, aiConfig);
  }, [input, plans, metaConfig, aiConfig, isEzCall]);

  const ezCallSimulation = useMemo((): EZCallSimulationResult | null => {
    if (!isEzCall || !recommended) return null;
    return calculateEZCallSimulation(input.contacts, recommended);
  }, [isEzCall, input.contacts, recommended]);

  const simulation = useMemo(() => {
    if (isEzCall) return null;
    if (!recommended) return null;
    return calculateSimulation(input, recommended, metaConfig, aiConfig);
  }, [input, recommended, metaConfig, aiConfig, isEzCall]);

  const growthScenarios = useMemo(() => {
    if (isEzCall || !recommended) return [];
    const g = input.growthPercent || 30;
    return [
      { label: 'Cenário atual', result: calculateSimulation(input, recommended, metaConfig, aiConfig), growth: 0 },
      { label: `+${g}% de crescimento`, result: simulateGrowth(input, recommended, g, metaConfig, aiConfig), growth: g },
      { label: 'Dobro do volume', result: simulateGrowth(input, recommended, 100, metaConfig, aiConfig), growth: 100 },
    ];
  }, [input, recommended, metaConfig, isEzCall]);

  const competitors = useMemo(() => {
    const base = isEzCall ? (ezCallSimulation?.totalMonthly ?? 0) : (simulation?.totalMonthly ?? 0);
    if (base === 0) return [];
    return [
      { name: isEzCall ? 'EZ Call' : 'EZ Chat', total: base, diff: 0 },
      { name: 'Concorrente A', total: base * 1.35, diff: 35 },
      { name: 'Concorrente B', total: base * 1.55, diff: 55 },
    ];
  }, [simulation, ezCallSimulation, isEzCall]);

  const essentialSetupIds = useMemo(() => {
    return setupProducts.filter(p => p.subcategory === 'Setup e Onboarding').map(p => p.id);
  }, [setupProducts]);

  const getFinalPrice = useCallback((id: string, basePrice: number) => {
    const discount = discounts[id];
    if (!discount || discount.value <= 0) return basePrice;
    if (discount.type === 'reais') return Math.max(0, basePrice - discount.value);
    return Math.max(0, basePrice * (1 - discount.value / 100));
  }, [discounts]);

  const setupTotal = useMemo(() => {
    const essentialTotal = setupProducts
      .filter(p => essentialSetupIds.includes(p.id))
      .reduce((sum, p) => {
        const base = customPrices[p.id] ?? p.price;
        return sum + getFinalPrice(p.id, base);
      }, 0);
    const integrationsTotal = Object.entries(selectedIntegrations)
      .filter(([, phase]) => phase === 1)
      .reduce((sum, [id]) => {
        const prod = setupProducts.find(p => p.id === id);
        const base = customPrices[id] ?? prod?.price ?? 0;
        return sum + getFinalPrice(id, base);
      }, 0);
    return essentialTotal + integrationsTotal;
  }, [setupProducts, essentialSetupIds, selectedIntegrations, customPrices, getFinalPrice]);

  const phase2Total = useMemo(() => {
    return Object.entries(selectedIntegrations)
      .filter(([, phase]) => phase === 2)
      .reduce((sum, [id]) => {
        const prod = setupProducts.find(p => p.id === id);
        const base = customPrices[id] ?? prod?.price ?? 0;
        return sum + getFinalPrice(id, base);
      }, 0);
  }, [selectedIntegrations, setupProducts, customPrices, getFinalPrice]);

  const integrationProducts = useMemo(() => {
    return setupProducts.filter(
      p => p.frequency === 'unique' && !essentialSetupIds.includes(p.id)
    );
  }, [setupProducts, essentialSetupIds]);

  const toggleIntegration = (id: string) => {
    setSelectedIntegrations(prev => {
      const current = prev[id];
      if (!current) return { ...prev, [id]: 1 };
      if (current === 1) return { ...prev, [id]: 2 };
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateInput = (field: keyof SimulatorInput, value: string) => {
    const num = parseInt(value) || 0;
    setInput(prev => ({ ...prev, [field]: num }));
  };

  // Build proposal data from current simulation
  const buildProposalData = async (): Promise<ProposalData> => {
    let companyName = '';
    let cnpj = '';
    let contactName = '';
    let contactEmail = '';
    let contactPhone = '';
    let sdrName = '';
    let closerName = '';

    if (opportunityId) {
      const { data: opp } = await supabase
        .from('opportunities')
        .select('*, lead:leads(*), sdr:profiles!opportunities_sdr_user_id_fkey(name), closer:profiles!opportunities_assigned_to_user_id_fkey(name)')
        .eq('id', opportunityId)
        .single();
      if (opp) {
        const lead = opp.lead as any;
        if (lead) {
          companyName = lead.company || '';
          cnpj = lead.cnpj || '';
          contactName = lead.name || '';
          contactEmail = lead.email || '';
          contactPhone = lead.phone || lead.whatsapp || '';
        }
        sdrName = (opp.sdr as any)?.name || '';
        closerName = (opp.closer as any)?.name || '';
      }
    }

    // Build essential setup items with discount info
    const essentialSetupList = setupProducts
      .filter(p => essentialSetupIds.includes(p.id))
      .map(p => {
        const base = customPrices[p.id] ?? p.price;
        const final = getFinalPrice(p.id, base);
        const disc = discounts[p.id];
        return {
          name: p.name,
          price: final,
          originalPrice: base !== final ? base : undefined,
          discountLabel: disc && disc.value > 0 ? (disc.type === 'percent' ? `${disc.value}%` : formatCurrency(disc.value)) : undefined,
          phase: 1 as number,
        };
      });

    const selectedIntegrationsList = Object.entries(selectedIntegrations)
      .map(([id, phase]) => {
        const prod = setupProducts.find(p => p.id === id);
        if (!prod) return null;
        const base = customPrices[id] ?? prod.price;
        const final = getFinalPrice(id, base);
        const disc = discounts[id];
        return {
          name: prod.name,
          price: final,
          originalPrice: base !== final ? base : undefined,
          discountLabel: disc && disc.value > 0 ? (disc.type === 'percent' ? `${disc.value}%` : formatCurrency(disc.value)) : undefined,
          phase,
          details: integrationDetails[id] || undefined,
        };
      })
      .filter(Boolean) as { name: string; price: number; originalPrice?: number; discountLabel?: string; phase: number; details?: string }[];

    return {
      companyName,
      cnpj,
      contactName,
      contactEmail,
      contactPhone,
      sdrName,
      closerName,
      planName: recommended?.name || '',
      planPrice: isEzCall ? (ezCallSimulation?.totalMonthly || 0) : (recommended?.price || 0),
      estimatedContacts: input.contacts,
      estimatedMessages: input.messages,
      metaCost: isEzCall ? 0 : (showMetaCosts ? (simulation?.metaCost || 0) : 0),
      aiCost: isEzCall ? 0 : (simulation?.aiCost || 0),
      excessMessages: isEzCall ? 0 : (simulation?.excessMessages || 0),
      excessContacts: isEzCall ? 0 : (simulation?.excessContacts || 0),
      excessMessageCost: isEzCall ? 0 : (simulation?.excessMessageCost || 0),
      excessContactCost: isEzCall ? 0 : (simulation?.excessContactCost || 0),
      appliedExcessCost: isEzCall ? 0 : (simulation?.appliedExcessCost || 0),
      totalMonthly: isEzCall ? (ezCallSimulation?.totalMonthly || 0) : (showMetaCosts ? (simulation?.totalMonthly || 0) : ((simulation?.totalMonthly || 0) - (simulation?.metaCost || 0))),
      setupTotal,
      setupPaymentMethod: paymentMethod,
      setupInstallments: installments,
      integrations: [...essentialSetupList, ...selectedIntegrationsList],
      contractMonths: 12,
      cancellationFeePercent: 20,
      validityDays: 30,
      notes: '',
      opportunityId: opportunityId || undefined,
    };
  };

  const handleGenerateProposal = async () => {
    if ((!simulation && !ezCallSimulation) || !recommended) {
      toast.error('Execute uma simulação primeiro');
      return;
    }
    if (proposalLoading) return;
    const data = await buildProposalData();
    await handleConfirmProposal(data);
  };

  const handleConfirmProposal = async (data: ProposalData) => {
    setProposalLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('Você precisa estar logado');
        return;
      }

      const { data: proposal, error } = await supabase
        .from('proposals')
        .insert({
          opportunity_id: data.opportunityId || null,
          created_by_user_id: userData.user.id,
          company_name: data.companyName,
          cnpj: data.cnpj || null,
          contact_name: data.contactName || null,
          contact_email: data.contactEmail || null,
          contact_phone: data.contactPhone || null,
          sdr_name: data.sdrName || null,
          closer_name: data.closerName || null,
          plan_name: data.planName,
          plan_price: data.planPrice,
          estimated_contacts: data.estimatedContacts,
          estimated_messages: data.estimatedMessages,
          meta_cost: data.metaCost,
          excess_messages: data.excessMessages,
          excess_contacts: data.excessContacts,
          excess_message_cost: data.excessMessageCost,
          excess_contact_cost: data.excessContactCost,
          applied_excess_cost: data.appliedExcessCost,
          total_monthly: data.totalMonthly,
          setup_total: data.setupTotal,
          setup_payment_method: data.setupPaymentMethod,
          setup_installments: data.setupInstallments,
          integrations: data.integrations as any,
          contract_months: data.contractMonths,
          cancellation_fee_percent: data.cancellationFeePercent,
          validity_days: data.validityDays,
          notes: data.notes || null,
          status: 'draft',
          product_type: productType,
          plan_messages_included: isEzCall ? 0 : (recommended?.messagesIncluded || 0),
          plan_contacts_included: isEzCall ? 0 : (recommended?.contactsIncluded || 0),
          plan_excess_message_price: isEzCall ? 0 : (recommended?.excessMessagePrice || 0),
          plan_excess_contact_price: isEzCall ? 0 : (recommended?.excessContactPrice || 0),
          show_meta_costs: showMetaCosts,
          meta_cost_config: Object.keys(localPercentages).length > 0 ? { entries: metaConfig.entries.map(e => ({ name: e.name, percentage: e.percentage })) } : null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Proposta gerada com sucesso!');
      
      navigate(`/proposal/${proposal.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar proposta');
    } finally {
      setProposalLoading(false);
    }
  };

  if (loadingChat || loadingSetup || loadingMeta) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/closer"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <PageHeader
              icon={<Calculator className="h-5 w-5" strokeWidth={1.5} />}
              title={`Simulador Comercial — ${isEzCall ? 'EZ Call' : 'EZ Chat'}`}
              subtitle="Simulação baseada no seu cenário atual."
              actions={
                <div className="flex items-center gap-2">
                  <Link to="/proposals">
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      Propostas
                    </Button>
                  </Link>
                  <span className="text-sm text-muted-foreground">Modo Técnico</span>
                  <Switch checked={showTechnical} onCheckedChange={setShowTechnical} />
                </div>
              }
              className="pb-0 flex-1"
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6 max-w-5xl">

        {/* BLOCK 1 — Client Context */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Contexto do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>{isEzCall ? 'Ramais estimados' : 'Contatos estimados/mês'}</Label>
                <Input
                  type="number"
                  value={input.contacts}
                  onChange={e => updateInput('contacts', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{isEzCall ? 'Minutos estimados/mês' : 'Mensagens estimadas/mês'}</Label>
                <Input
                  type="number"
                  value={input.messages}
                  onChange={e => updateInput('messages', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{isEzCall ? 'Nº de operadores' : 'Nº de atendentes'}</Label>
                <Input
                  type="number"
                  value={input.attendants}
                  onChange={e => updateInput('attendants', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Crescimento estimado (%)</Label>
                <Input
                  type="number"
                  value={input.growthPercent}
                  onChange={e => updateInput('growthPercent', e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Meta Cost Editor — only for EZ Chat */}
        {!isEzCall && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5 text-primary" />
                Custos Meta WhatsApp
              </CardTitle>
              <CardDescription>Configure as proporções e escolha se deseja incluir na proposta.</CardDescription>
            </CardHeader>
            <CardContent>
              <MetaCostEditor
                metaConfig={baseMetaConfig}
                showMetaCosts={showMetaCosts}
                onShowMetaCostsChange={setShowMetaCosts}
                localPercentages={localPercentages}
                onPercentageChange={(name, value) => setLocalPercentages(prev => ({ ...prev, [name]: value }))}
              />
            </CardContent>
          </Card>
        )}

        {/* BLOCK 1.5 — AI Cost Config — only for EZ Chat */}
        {!isEzCall && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bot className="h-5 w-5 text-primary" />
                  IA Generativa (OpenAI)
                </CardTitle>
                <Switch
                  checked={aiConfig.enabled}
                  onCheckedChange={(v) => setAIConfig(prev => ({ ...prev, enabled: v }))}
                />
              </div>
              <CardDescription>Estimativa de custo com uso de IA no atendimento.</CardDescription>
            </CardHeader>
            {aiConfig.enabled && (
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <Label>Modelo OpenAI</Label>
                    <Select
                      value={aiConfig.modelId}
                      onValueChange={(v) => setAIConfig(prev => ({ ...prev, modelId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_MODELS.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label>% de contatos que usam IA: <strong>{aiConfig.percentContacts}%</strong></Label>
                    <Slider
                      value={[aiConfig.percentContacts]}
                      onValueChange={([v]) => setAIConfig(prev => ({ ...prev, percentContacts: v }))}
                      min={5}
                      max={100}
                      step={5}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>Msgs médias por conversa IA</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={aiConfig.msgsPerConversation}
                      onChange={e => setAIConfig(prev => ({ ...prev, msgsPerConversation: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>Tokens médios input/msg</Label>
                    <Input
                      type="number"
                      value={aiConfig.avgInputTokens}
                      onChange={e => setAIConfig(prev => ({ ...prev, avgInputTokens: parseInt(e.target.value) || 100 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Markup (%)</Label>
                    <Input
                      type="number"
                      value={Math.round((aiConfig.markup - 1) * 100)}
                      onChange={e => setAIConfig(prev => ({ ...prev, markup: 1 + (parseInt(e.target.value) || 0) / 100 }))}
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* EZ Call Recommended Plan */}
        {isEzCall && ezCallSimulation && recommended && (
          <Card className="border-primary border-2 relative overflow-hidden">
            <div className="absolute top-0 right-0">
              <Badge className="rounded-none rounded-bl-lg text-xs">Recomendado</Badge>
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Plano Recomendado
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Plano ideal para o seu volume de ramais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Plano</p>
                  <p className="text-xl font-bold">{recommended.name}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Preço por Ramal</p>
                  <p className="text-xl font-bold">
                    {ezCallSimulation.customPricing ? 'Sob consulta' : formatCurrency(ezCallSimulation.pricePerExtension)}
                    {!ezCallSimulation.customPricing && <span className="text-sm font-normal text-muted-foreground">/mês</span>}
                  </p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Ramais</p>
                  <p className="text-xl font-bold">{input.contacts}</p>
                </div>
              </div>

              {/* Extension range info */}
              <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground bg-muted/30 rounded-lg py-2 px-4">
                <span>
                  Faixa do plano: <strong>{recommended.minExtensions ?? 0}</strong> a <strong>{recommended.maxExtensions ?? '∞'}</strong> ramais
                </span>
              </div>

              {/* Features */}
              {recommended.features && recommended.features.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recursos Inclusos</p>
                  <div className="flex flex-wrap gap-2">
                    {recommended.features.map((f, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-center p-6 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">Total Mensal Aproximado</p>
                {ezCallSimulation.customPricing ? (
                  <p className="text-2xl font-extrabold text-primary">Sob consulta</p>
                ) : (
                  <p className="text-4xl font-extrabold text-primary">
                    {formatCurrency(ezCallSimulation.totalMonthly)}
                  </p>
                )}
                {!ezCallSimulation.customPricing && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(ezCallSimulation.pricePerExtension)} × {input.contacts} ramais
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* EZ Chat Recommended Plan */}
        {!isEzCall && simulation && recommended && (
          <Card className="border-primary border-2 relative overflow-hidden">
            <div className="absolute top-0 right-0">
              <Badge className="rounded-none rounded-bl-lg text-xs">Recomendado</Badge>
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Plano Recomendado
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Modelo com proteção contra surpresa
              </CardDescription>
            </CardHeader>
             <CardContent className="space-y-4">
              <div className={`grid grid-cols-1 gap-4 ${!isEzCall && aiConfig.enabled ? 'md:grid-cols-4' : isEzCall ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Plano</p>
                  <p className="text-xl font-bold">{recommended.name}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Valor Mensal Base</p>
                  <p className="text-xl font-bold">{formatCurrency(simulation.basePrice)}</p>
                </div>
                {!isEzCall && (
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                              Custo Estimado Meta
                              <Info className="h-4 w-4 text-primary" />
                            </p>
                            <p className="text-xl font-bold">{formatCurrency(simulation.metaCost)}</p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <div className="space-y-1 text-xs">
                            <p className="font-medium">Estimativa de consumo Meta:</p>
                            <p>Multiplicador: <strong>{metaConfig.conversationsPerContact}</strong> conversa(s) por contato.</p>
                            <p>Distribuição: {metaConfig.entries.map(e => `${e.name} ${e.percentage}%`).join(', ')}.</p>
                            <p>Cada tipo tem preço diferente em USD, convertido para BRL (1 USD = {metaConfig.usdToBrl.toFixed(2)} BRL).</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
                {!isEzCall && aiConfig.enabled && simulation.aiBreakdown && (
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                              Custo IA Generativa
                              <Bot className="h-4 w-4 text-primary" />
                            </p>
                            <p className="text-xl font-bold">{formatCurrency(simulation.aiCost)}</p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <div className="space-y-1 text-xs">
                            <p className="font-medium">Detalhamento IA:</p>
                            <p>Modelo: <strong>{simulation.aiBreakdown.model.label}</strong></p>
                            <p>Contatos com IA: <strong>{simulation.aiBreakdown.contactsWithAI.toLocaleString('pt-BR')}</strong></p>
                            <p>Mensagens IA: <strong>{simulation.aiBreakdown.totalMessages.toLocaleString('pt-BR')}</strong></p>
                            <p>Tokens: <strong>{simulation.aiBreakdown.totalInputTokens.toLocaleString('pt-BR')}</strong> (in) + <strong>{simulation.aiBreakdown.totalOutputTokens.toLocaleString('pt-BR')}</strong> (out)</p>
                            <p>Custo USD: <strong>${simulation.aiBreakdown.costUsd.toFixed(4)}</strong></p>
                            <p>Markup: <strong>{Math.round((simulation.aiBreakdown.markup - 1) * 100)}%</strong></p>
                            <p>Câmbio: <strong>1 USD = {metaConfig.usdToBrl.toFixed(2)} BRL</strong></p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </div>

              {/* Plan limits & excess unit prices */}
              <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground bg-muted/30 rounded-lg py-2 px-4">
                <span>
                  Inclusos: <strong>{recommended.messagesIncluded.toLocaleString('pt-BR')}</strong> {isEzCall ? 'min' : 'msgs'} + <strong>{recommended.contactsIncluded.toLocaleString('pt-BR')}</strong> {isEzCall ? 'ramais' : 'contatos'}
                </span>
                <span className="text-border">|</span>
                <span>
                  Excedente: <strong>{formatCurrency(recommended.excessMessagePrice)}</strong>/{isEzCall ? 'min' : 'msg'} · <strong>{formatCurrency(recommended.excessContactPrice)}</strong>/{isEzCall ? 'ramal' : 'contato'}
                </span>
              </div>

              {/* Excess Breakdown */}
              {(simulation.excessMessages > 0 || simulation.excessContacts > 0) ? (
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Excedente Estimado
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            O sistema cobra apenas o <strong>menor</strong> excedente entre mensagens e contatos. Você nunca paga os dois ao mesmo tempo.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Messages excess */}
                      {(() => {
                        const isApplied = simulation.excessMessages > 0 && simulation.excessContacts > 0
                          ? simulation.excessMessageCost <= simulation.excessContactCost
                          : simulation.excessMessages > 0;
                        return (
                          <div className={cn(
                            'relative p-4 rounded-xl border transition-all duration-200',
                            isApplied
                              ? 'border-primary/30 bg-primary/5 shadow-sm'
                              : 'border-border/50 bg-muted/30'
                          )}>
                            {isApplied && (
                              <Badge className="absolute -top-2.5 right-3 text-[10px] px-2 py-0.5 bg-primary text-primary-foreground">
                                Cobrado
                              </Badge>
                            )}
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{isEzCall ? 'Minutos' : 'Mensagens'}</p>
                            <p className="text-2xl font-bold mt-1">{formatCurrency(simulation.excessMessageCost)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              +{simulation.excessMessages.toLocaleString('pt-BR')} {isEzCall ? 'min' : 'msgs'} excedentes
                            </p>
                          </div>
                        );
                      })()}
                      {/* Contacts excess */}
                      {(() => {
                        const isApplied = simulation.excessMessages > 0 && simulation.excessContacts > 0
                          ? simulation.excessContactCost < simulation.excessMessageCost
                          : simulation.excessContacts > 0;
                        return (
                          <div className={cn(
                            'relative p-4 rounded-xl border transition-all duration-200',
                            isApplied
                              ? 'border-primary/30 bg-primary/5 shadow-sm'
                              : 'border-border/50 bg-muted/30'
                          )}>
                            {isApplied && (
                              <Badge className="absolute -top-2.5 right-3 text-[10px] px-2 py-0.5 bg-primary text-primary-foreground">
                                Cobrado
                              </Badge>
                            )}
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{isEzCall ? 'Ramais' : 'Contatos'}</p>
                            <p className="text-2xl font-bold mt-1">{formatCurrency(simulation.excessContactCost)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              +{simulation.excessContacts.toLocaleString('pt-BR')} {isEzCall ? 'ramais' : 'contatos'} excedentes
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                    <Separator />
                    <div className="flex items-center justify-center gap-1.5 text-sm">
                      <span className="text-muted-foreground">Valor aplicado:</span>
                      <span className="font-bold text-primary text-base">{formatCurrency(simulation.appliedExcessCost)}</span>
                      <span className="text-muted-foreground text-xs">(o menor entre os dois)</span>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-center gap-2 p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Dentro do plano — sem excedente</span>
                </div>
              )}

              <div className="text-center p-6 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">Total Mensal Aproximado</p>
                <p className="text-4xl font-extrabold text-primary">
                  {formatCurrency(simulation.totalMonthly)}
                </p>
              </div>

            </CardContent>
          </Card>
        )}

        {/* BLOCK 3 — Growth Simulation */}
        {growthScenarios.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                Simulação de Segurança
              </CardTitle>
              <CardDescription>
                Mesmo com crescimento agressivo, o modelo mantém previsibilidade.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {growthScenarios.map((s, i) => (
                  <div
                    key={i}
                    className={`text-center p-5 rounded-lg border ${i === 0 ? 'border-primary/30 bg-primary/5' : 'bg-muted/30'}`}
                  >
                    <p className="text-sm text-muted-foreground mb-1">{s.label}</p>
                    <p className="text-2xl font-bold">{formatCurrency(s.result.totalMonthly)}</p>
                    {s.growth > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        +{s.growth}% volume
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* BLOCK 5 — Simplified Comparison */}
        {competitors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
                Comparativo Simplificado
              </CardTitle>
              <CardDescription>
                Modelo EZ evita dupla cobrança e janela 24h duplicada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {competitors.map((c, i) => (
                  <div
                    key={i}
                    className={`text-center p-5 rounded-lg border ${i === 0 ? 'border-primary/30 bg-primary/5' : 'bg-muted/30'}`}
                  >
                    <p className="text-sm font-medium mb-1">{c.name}</p>
                    <p className="text-2xl font-bold">{formatCurrency(c.total)}</p>
                    {c.diff > 0 && (
                      <Badge variant="secondary" className="mt-2">
                        +{c.diff}% mais caro
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* BLOCK 6 — Implementation Investment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wrench className="h-5 w-5 text-primary" />
              Investimento de Implementação
            </CardTitle>
            <CardDescription>Valor separado do investimento mensal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={fullSetup}
                  onCheckedChange={(checked) => {
                    setFullSetup(checked);
                    if (!checked) setSelectedIntegrations({});
                  }}
                />
                <Label>{fullSetup ? 'Implementação Completa' : 'Implementação Essencial (Go-live)'}</Label>
              </div>
            </div>

            <Separator />

            {/* Setup base - always visible */}
            <div>
              <p className="text-sm font-medium mb-2">Setup base (obrigatório)</p>
              {setupProducts
                .filter(p => essentialSetupIds.includes(p.id))
                .map(p => {
                  const basePrice = customPrices[p.id] ?? p.price;
                  const disc = discounts[p.id];
                  const finalPrice = getFinalPrice(p.id, basePrice);
                  const hasDiscount = disc && disc.value > 0;
                  return (
                    <div key={p.id} className="py-2 space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <span>{p.name}</span>
                        <Input
                          type="number"
                          className="w-28 h-7 text-right text-sm font-medium"
                          value={basePrice}
                          onChange={e => setCustomPrices(prev => ({ ...prev, [p.id]: Number(e.target.value) }))}
                        />
                      </div>
                      <div className="flex items-center gap-2 ml-0 bg-muted/30 rounded-md px-2 py-1">
                        <div className="flex items-center rounded-full overflow-hidden h-6 bg-muted">
                          <button
                            type="button"
                            className={`px-2.5 h-full text-xs font-medium flex items-center rounded-full transition-colors ${(!disc || disc.type === 'percent') ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}
                            onClick={() => setDiscounts(prev => ({ ...prev, [p.id]: { type: 'percent', value: prev[p.id]?.value ?? 0 } }))}
                          >
                            %
                          </button>
                          <button
                            type="button"
                            className={`px-2.5 h-full text-xs font-medium flex items-center rounded-full transition-colors ${disc?.type === 'reais' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}
                            onClick={() => setDiscounts(prev => ({ ...prev, [p.id]: { type: 'reais', value: prev[p.id]?.value ?? 0 } }))}
                          >
                            R$
                          </button>
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Desconto"
                          className="w-24 h-7 text-xs text-right"
                          value={disc?.value ?? ''}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            setDiscounts(prev => ({
                              ...prev,
                              [p.id]: { type: prev[p.id]?.type ?? 'percent', value: isNaN(val) ? 0 : val },
                            }));
                          }}
                        />
                        {hasDiscount && (
                           <span className="text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded whitespace-nowrap">
                            = {formatCurrency(finalPrice)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Integrations list - only when fullSetup is ON */}
            {fullSetup && integrationProducts.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Integrações (clique para alternar fase)</p>
                  <div className="space-y-1">
                    {integrationProducts.map(p => {
                      const phase = selectedIntegrations[p.id];
                      const currentPrice = customPrices[p.id] ?? p.price;
                      const disc = discounts[p.id];
                      const finalPrice = getFinalPrice(p.id, currentPrice);
                      const hasDiscount = disc && disc.value > 0;
                      return (
                        <div
                          key={p.id}
                          className="py-2 px-2 rounded-md hover:bg-muted/50 space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <div
                              className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                              onClick={() => toggleIntegration(p.id)}
                            >
                              <Checkbox checked={!!phase} />
                              <span className="text-sm truncate">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {phase && (
                                <Badge
                                  variant={phase === 1 ? 'default' : 'secondary'}
                                  className="text-xs cursor-pointer"
                                  onClick={() => toggleIntegration(p.id)}
                                >
                                  Fase {phase}
                                </Badge>
                              )}
                              <Input
                                type="number"
                                step="0.01"
                                value={currentPrice}
                                onChange={e => {
                                  const val = parseFloat(e.target.value);
                                  setCustomPrices(prev => ({
                                    ...prev,
                                    [p.id]: isNaN(val) ? 0 : val,
                                  }));
                                }}
                                className="w-24 h-7 text-xs text-right"
                                onClick={e => e.stopPropagation()}
                              />
                            </div>
                          </div>
                          <Textarea
                            placeholder="Detalhes da integração..."
                            className="ml-8 text-xs resize-none min-h-[32px] h-8 focus:h-20 transition-all"
                            value={integrationDetails[p.id] || ''}
                            onChange={e => setIntegrationDetails(prev => ({ ...prev, [p.id]: e.target.value }))}
                            onClick={e => e.stopPropagation()}
                          />
                          {phase && (
                            <div className="flex items-center gap-2 ml-8 bg-muted/30 rounded-md px-2 py-1">
                              <div className="flex items-center rounded-full overflow-hidden h-6 bg-muted">
                                <button
                                  type="button"
                                  className={`px-2.5 h-full text-xs font-medium flex items-center rounded-full transition-colors ${(!disc || disc.type === 'percent') ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}
                                  onClick={e => { e.stopPropagation(); setDiscounts(prev => ({ ...prev, [p.id]: { type: 'percent', value: prev[p.id]?.value ?? 0 } })); }}
                                >
                                  %
                                </button>
                                <button
                                  type="button"
                                  className={`px-2.5 h-full text-xs font-medium flex items-center rounded-full transition-colors ${disc?.type === 'reais' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}
                                  onClick={e => { e.stopPropagation(); setDiscounts(prev => ({ ...prev, [p.id]: { type: 'reais', value: prev[p.id]?.value ?? 0 } })); }}
                                >
                                  R$
                                </button>
                              </div>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Desconto"
                                className="w-24 h-7 text-xs text-right"
                                value={disc?.value ?? ''}
                                onChange={e => {
                                  const val = parseFloat(e.target.value);
                                  setDiscounts(prev => ({
                                    ...prev,
                                    [p.id]: { type: prev[p.id]?.type ?? 'percent', value: isNaN(val) ? 0 : val },
                                  }));
                                }}
                                onClick={e => e.stopPropagation()}
                              />
                              {hasDiscount && (
                                <span className="text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded whitespace-nowrap">
                                  = {formatCurrency(finalPrice)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground">{fullSetup ? 'Total Fase 1' : 'Total Implementação'}</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(setupTotal)}</p>
              </div>
              {fullSetup && phase2Total > 0 && (
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Total Fase 2 (futuro)</p>
                  <p className="text-2xl font-bold">{formatCurrency(phase2Total)}</p>
                </div>
              )}
              <div className="text-center p-4 rounded-lg col-span-1 md:col-span-2 bg-muted/50">
                <p className="text-sm text-muted-foreground mb-3">Forma de Pagamento</p>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(v) => {
                    const method = v as 'pix' | 'boleto' | 'cartao';
                    setPaymentMethod(method);
                    if (method === 'pix') setInstallments(1);
                    else if (method === 'boleto' && installments > 6) setInstallments(6);
                  }}
                  className="flex flex-wrap justify-center gap-4 mb-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="pix" id="pix" />
                    <Label htmlFor="pix" className="flex items-center gap-1.5 cursor-pointer">
                      <QrCode className="h-4 w-4" /> Pix
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="boleto" id="boleto" />
                    <Label htmlFor="boleto" className="flex items-center gap-1.5 cursor-pointer">
                      <Receipt className="h-4 w-4" /> Boleto
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="cartao" id="cartao" />
                    <Label htmlFor="cartao" className="flex items-center gap-1.5 cursor-pointer">
                      <CreditCard className="h-4 w-4" /> Cartão de Crédito
                    </Label>
                  </div>
                </RadioGroup>

                {paymentMethod !== 'pix' && (
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <Label className="text-sm">Parcelas:</Label>
                    <select
                      className="border rounded-md px-2 py-1 text-sm bg-background"
                      value={installments}
                      onChange={e => setInstallments(Number(e.target.value))}
                    >
                      {Array.from(
                        { length: paymentMethod === 'boleto' ? 6 : 12 },
                        (_, i) => i + 1
                      ).map(n => {
                        const rate = n === 1 ? 2.48 : n <= 6 ? 3.49 : 3.99;
                        return (
                          <option key={n} value={n}>
                            {n}x {n > 1 ? `(${rate}% a.m.)` : `(${rate}%)`}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {(() => {
                  const rate = paymentMethod === 'pix' ? 0 : installments === 1 ? 2.48 : installments <= 6 ? 3.49 : 3.99;
                  const totalWithFees = paymentMethod === 'pix' ? setupTotal : setupTotal * (1 + (rate / 100) * installments);
                  const installmentValue = paymentMethod === 'pix' ? setupTotal : totalWithFees / installments;
                  return (
                    <div className="space-y-1">
                      <p className="text-2xl font-bold text-primary">
                        {paymentMethod === 'pix' ? formatCurrency(setupTotal) : `${installments}x de ${formatCurrency(installmentValue)}`}
                      </p>
                      {paymentMethod !== 'pix' && (
                        <p className="text-xs text-muted-foreground">
                          Total: {formatCurrency(totalWithFees)} (juros de {rate}% a.m.)
                        </p>
                      )}
                      {paymentMethod === 'pix' && (
                        <p className="text-xs text-muted-foreground">À vista, sem juros</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Excess detail — always visible (EZ Chat only) */}
        {!isEzCall && simulation && recommended && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 rounded-lg p-4">
                <div>
                  <p className="text-muted-foreground text-xs">Msgs excedentes</p>
                  <p className="font-medium">{simulation.excessMessages.toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Contatos excedentes</p>
                  <p className="font-medium">{simulation.excessContacts.toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Preço exc./msg</p>
                  <p className="font-medium">{formatCurrency(recommended.excessMessagePrice)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Preço exc./contato</p>
                  <p className="font-medium">{formatCurrency(recommended.excessContactPrice)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground leading-relaxed">
                <p className="font-medium text-foreground mb-1">Regra de Excedente Inteligente</p>
                <p>O excedente só é cobrado se <strong>ambos</strong> os limites (mensagens e contatos) forem ultrapassados. Quando isso acontece, cobra-se o <strong>menor</strong> valor entre os dois — você nunca paga os dois ao mesmo tempo.</p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Você nunca paga dois excedentes
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Cobramos sempre o menor valor
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Acompanhe consumo em tempo real
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TECHNICAL MODE (EZ Chat only) */}
        {showTechnical && !isEzCall && simulation && recommended && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Eye className="h-5 w-5 text-muted-foreground" />
                Detalhamento Técnico
              </CardTitle>
              <CardDescription>Informações adicionais para análise interna.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Tabela Meta (WhatsApp Oficial)</p>
                  <Badge variant="outline" className="text-xs">
                    Câmbio: 1 USD = {usdToBrl.toFixed(2)} BRL
                  </Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Tipo</th>
                        <th className="text-right py-2">Preço (USD)</th>
                        <th className="text-right py-2">% Conversas</th>
                        <th className="text-right py-2">Qtd Estimada</th>
                        <th className="text-right py-2">Custo (BRL)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulation.metaBreakdown.entries.map((e, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-2">{e.name}</td>
                          <td className="text-right py-2">US$ {metaConfig.entries[i].priceUsd.toFixed(4)}</td>
                          <td className="text-right py-2">{metaConfig.entries[i].percentage}%</td>
                          <td className="text-right py-2">{e.conversations.toLocaleString('pt-BR')}</td>
                          <td className="text-right py-2">{formatCurrency(e.costBrl)}</td>
                        </tr>
                      ))}
                      <tr className="font-medium">
                        <td className="py-2" colSpan={4}>Total Meta</td>
                        <td className="text-right py-2">{formatCurrency(simulation.metaBreakdown.totalBrl)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium mb-2">Todos os Planos — Tabela Comparativa</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Plano</th>
                        <th className="text-right py-2">Preço</th>
                        <th className="text-right py-2">Msgs</th>
                        <th className="text-right py-2">Contatos</th>
                        <th className="text-right py-2">Exc. Msg</th>
                        <th className="text-right py-2">Exc. Contato</th>
                        <th className="text-right py-2">Total Estimado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map(p => {
                        const s = calculateSimulation(input, p, metaConfig);
                        const isRec = p.id === recommended.id;
                        return (
                          <tr key={p.id} className={`border-b ${isRec ? 'bg-primary/5 font-medium' : ''}`}>
                            <td className="py-2">{p.name} {isRec && '⭐'}</td>
                            <td className="text-right py-2">{formatCurrency(p.price)}</td>
                            <td className="text-right py-2">{p.messagesIncluded.toLocaleString('pt-BR')}</td>
                            <td className="text-right py-2">{p.contactsIncluded.toLocaleString('pt-BR')}</td>
                            <td className="text-right py-2">{formatCurrency(p.excessMessagePrice)}</td>
                            <td className="text-right py-2">{formatCurrency(p.excessContactPrice)}</td>
                            <td className="text-right py-2 font-medium">{formatCurrency(s.totalMonthly)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sticky total */}
        {(simulation || ezCallSimulation) && (
          <div className="sticky bottom-4 z-10">
            <Card className="bg-primary text-primary-foreground shadow-lg">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Total Mensal Estimado — {recommended?.name}</p>
                  <p className="text-3xl font-extrabold">
                    {isEzCall
                      ? (ezCallSimulation?.customPricing ? 'Sob consulta' : formatCurrency(ezCallSimulation?.totalMonthly ?? 0))
                      : formatCurrency(simulation?.totalMonthly ?? 0)
                    }
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm opacity-80">Implementação</p>
                    {(() => {
                      const rate = paymentMethod === 'pix' ? 0 : installments === 1 ? 2.48 : installments <= 6 ? 3.49 : 3.99;
                      const totalWithFees = paymentMethod === 'pix' ? setupTotal : setupTotal * (1 + (rate / 100) * installments);
                      const installmentValue = paymentMethod === 'pix' ? setupTotal : totalWithFees / installments;
                      return installments > 1 && paymentMethod !== 'pix' ? (
                        <p className="text-xl font-bold">{installments}x de {formatCurrency(installmentValue)}</p>
                      ) : (
                        <p className="text-xl font-bold">{formatCurrency(setupTotal)}</p>
                      );
                    })()}
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 transition-colors"
                        onClick={handleGenerateProposal}
                      >
                        <FileText className="h-5 w-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Gerar proposta</TooltipContent>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>



    </div>
  );
};

export default SimulatorPage;
