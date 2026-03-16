import { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, CreditCard, Receipt, QrCode, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useProducts } from '@/hooks/useProducts';
import { PageHeader } from '@/components/PageHeader';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const EvolucaoSimulatorPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const opportunityId = searchParams.get('opportunityId');

  const { products: setupProducts, isLoading: loadingSetup } = useProducts('setup_integracoes');

  const [proposalLoading, setProposalLoading] = useState(false);
  const [selectedIntegrations, setSelectedIntegrations] = useState<Record<string, boolean>>({});
  const [installments, setInstallments] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'boleto' | 'cartao'>('pix');
  const [setupOpen, setSetupOpen] = useState(true);

  // All setup products available for Evolução (no mandatory setup split)
  const allSetupProducts = useMemo(() => {
    return setupProducts.filter(p => p.active && p.frequency === 'unique');
  }, [setupProducts]);

  const toggleIntegration = (id: string) => {
    setSelectedIntegrations(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const selectedItems = useMemo(() => {
    return allSetupProducts.filter(p => selectedIntegrations[p.id]);
  }, [allSetupProducts, selectedIntegrations]);

  const setupTotal = useMemo(() => {
    return selectedItems.reduce((sum, p) => sum + p.price, 0);
  }, [selectedItems]);

  const handleGenerateProposal = async () => {
    if (setupTotal <= 0) {
      toast.error('Selecione pelo menos um item');
      return;
    }
    if (proposalLoading) return;
    setProposalLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('Você precisa estar logado');
        return;
      }

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

      const integrationsList = selectedItems.map(p => ({
        name: p.name,
        price: p.price,
        phase: 1,
        description: p.description || '',
      }));

      // Calculate total with fees
      const rate = paymentMethod === 'pix' ? 0 : installments === 1 ? 2.48 : installments <= 6 ? 3.49 : 3.99;
      const totalWithFees = paymentMethod === 'pix' ? setupTotal : setupTotal * (1 + (rate / 100) * installments);

      const { data: proposal, error } = await supabase
        .from('proposals')
        .insert({
          opportunity_id: opportunityId || null,
          created_by_user_id: userData.user.id,
          company_name: companyName,
          cnpj: cnpj || null,
          contact_name: contactName || null,
          contact_email: contactEmail || null,
          contact_phone: contactPhone || null,
          sdr_name: sdrName || null,
          closer_name: closerName || null,
          plan_name: 'Evolução',
          plan_price: 0,
          estimated_contacts: 0,
          estimated_messages: 0,
          meta_cost: 0,
          total_monthly: 0,
          setup_total: paymentMethod === 'pix' ? setupTotal : totalWithFees,
          setup_payment_method: paymentMethod,
          setup_installments: installments,
          integrations: integrationsList as any,
          contract_months: 0,
          cancellation_fee_percent: 0,
          validity_days: 15,
          notes: null,
          status: 'draft',
          product_type: 'evolucao_ez_chat',
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Proposta de Evolução gerada!');
      navigate(`/proposal/${proposal.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar proposta');
    } finally {
      setProposalLoading(false);
    }
  };

  if (loadingSetup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/closer"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <PageHeader
              icon={<Wrench className="h-5 w-5" strokeWidth={1.5} />}
              title="Simulador — Evolução EZ Chat"
              subtitle="Selecione os serviços de evolução do projeto."
              actions={
                <Link to="/proposals">
                  <Button variant="outline" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    Propostas
                  </Button>
                </Link>
              }
              className="pb-0 flex-1"
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        {/* Integrations selection */}
        <Card>
          <Collapsible open={setupOpen} onOpenChange={setSetupOpen}>
            <CardHeader>
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wrench className="h-5 w-5 text-primary" />
                  Investimento de Implementação
                </CardTitle>
                {setupOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CardDescription>Selecione os serviços que serão incluídos na proposta de evolução.</CardDescription>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {allSetupProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum produto de setup cadastrado.</p>
                ) : (
                  <div className="space-y-1">
                    {allSetupProducts.map(p => {
                      const selected = !!selectedIntegrations[p.id];
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50 cursor-pointer"
                          onClick={() => toggleIntegration(p.id)}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox checked={selected} />
                            <div>
                              <span className="text-sm font-medium">{p.name}</span>
                              {p.description && (
                                <p className="text-xs text-muted-foreground">{p.description}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-medium">{formatCurrency(p.price)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Separator />

                {/* Payment method */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm text-muted-foreground">Total Implementação</p>
                    <p className="text-2xl font-bold text-primary font-display">{formatCurrency(setupTotal)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedItems.length} item(ns) selecionado(s)</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
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
                        <RadioGroupItem value="pix" id="ev-pix" />
                        <Label htmlFor="ev-pix" className="flex items-center gap-1.5 cursor-pointer">
                          <QrCode className="h-4 w-4" /> Pix
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="boleto" id="ev-boleto" />
                        <Label htmlFor="ev-boleto" className="flex items-center gap-1.5 cursor-pointer">
                          <Receipt className="h-4 w-4" /> Boleto
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="cartao" id="ev-cartao" />
                        <Label htmlFor="ev-cartao" className="flex items-center gap-1.5 cursor-pointer">
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
                          <p className="text-2xl font-bold text-primary font-display">
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
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Sticky footer */}
        {setupTotal > 0 && (
          <div className="sticky bottom-4 z-10">
            <Card className="bg-primary text-primary-foreground shadow-lg">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Proposta de Evolução — {selectedItems.length} item(ns)</p>
                  <p className="text-3xl font-extrabold font-display">{formatCurrency(setupTotal)}</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 transition-colors"
                      onClick={handleGenerateProposal}
                      disabled={proposalLoading}
                    >
                      <FileText className="h-5 w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Gerar proposta de evolução</TooltipContent>
                </Tooltip>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default EvolucaoSimulatorPage;
