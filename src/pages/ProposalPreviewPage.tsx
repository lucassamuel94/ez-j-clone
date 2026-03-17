import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Building2, FileText, MessageSquare, Shield, CheckCircle2, Clock, Headphones, ChevronDown, ChevronUp, Check, LayoutGrid, Download } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel';
import type { Product } from '@/hooks/useProducts';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { supabase } from '@/integrations/supabase/client';
import ezLogo from '@/assets/ez-journey-logo-white.svg';
import metaPartnerLogo from '@/assets/meta-business-partner.png';
import gptwBadge from '@/assets/gptw-badge.png';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

interface Proposal {
  id: string;
  company_name: string;
  razao_social?: string | null;
  cnpj: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  sdr_name: string | null;
  closer_name: string | null;
  plan_name: string;
  plan_price: number;
  estimated_contacts: number;
  estimated_messages: number;
  meta_cost: number;
  excess_messages: number;
  excess_contacts: number;
  excess_message_cost: number;
  excess_contact_cost: number;
  applied_excess_cost: number;
  total_monthly: number;
  setup_total: number;
  setup_payment_method: string;
  setup_installments: number;
  integrations: { name: string; price: number; phase: number; description?: string }[];
  contract_months: number;
  cancellation_fee_percent: number;
  validity_days: number;
  status: string;
  notes: string | null;
  project_objective: string | null;
  product_type: string;
  created_at: string;
}

const ProposalPreviewPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [closerWhatsapp, setCloserWhatsapp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Product[]>([]);
  const [plansOpen, setPlansOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = useCallback(async () => {
    if (!contentRef.current || !proposal || pdfGenerating) return;
    setPdfGenerating(true);

    // Force collapsible plans open for PDF capture
    const wasPlansOpen = plansOpen;
    if (!wasPlansOpen && plans.length > 0) setPlansOpen(true);

    // Wait for React re-render (hides buttons + opens collapsible)
    await new Promise(r => setTimeout(r, 400));

    try {
      const html2pdf = (await import('html2pdf.js')).default;

      const proposalCode = `EZ-${new Date(proposal.created_at).toISOString().replace(/[-T:.Z]/g, '').slice(0, 14)}-${proposal.id.slice(0, 4).toUpperCase()}`;
      const fileName = `Proposta_${proposal.company_name.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').replace(/\s+/g, '_')}_${proposalCode}.pdf`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (html2pdf() as any)
        .set({
          margin: [6, 6, 6, 6],
          filename: fileName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            logging: false,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        })
        .from(contentRef.current)
        .save();

      toast.success('PDF baixado com sucesso!');
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    } finally {
      if (!wasPlansOpen) setPlansOpen(false);
      setPdfGenerating(false);
    }
  }, [proposal, pdfGenerating, plansOpen, plans.length]);

  const handleAccept = () => {
    if (!id) return;
    navigate(`/checkout?id=${id}`);
  };

  const handleReject = async () => {
    if (!id || actionLoading) return;
    setActionLoading(true);
    const { error } = await supabase.rpc('update_proposal_status', {
      p_proposal_id: id,
      p_status: 'rejected'
    });
    setActionLoading(false);
    if (error) {
      console.error('Error rejecting proposal:', error);
      toast.error('Erro ao recusar proposta. Tente novamente.');
      return;
    }
    if (proposal) setProposal({ ...proposal, status: 'rejected' });
  };

  const handleWhatsAppContact = (message: string) => {
    if (!closerWhatsapp) return;
    const phone = closerWhatsapp.replace(/\D/g, '');
    const text = encodeURIComponent(message);
    // wa.me works cross-platform (mobile app + WhatsApp Web on desktop)
    window.open(`https://wa.me/55${phone}?text=${text}`, '_blank');
  };

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      // Track view — fire-and-forget, does not block proposal load
      supabase.rpc('increment_proposal_views', {
        proposal_id: id,
        p_user_agent: navigator.userAgent,
      }).then(({ error }) => {
        if (error) console.error('Failed to track proposal view:', error);
      });

      // Notify closer — independent of view tracking
      supabase.functions.invoke('notify-proposal-view', {
        body: { proposal_id: id },
      }).catch((err) => console.warn('Notify proposal view failed:', err));

      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) {
        setProposal({ ...(data as unknown as Proposal), product_type: (data as any).product_type || 'ez_chat' });

        // Fetch closer's whatsapp from profile
        if (data.created_by_user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('whatsapp')
            .eq('id', data.created_by_user_id)
            .maybeSingle();
          setCloserWhatsapp(profile?.whatsapp || null);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    if (!proposal) return;
    const fetchPlans = async () => {
      const category = proposal.product_type || 'ez_chat';
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('category', category)
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (data) setPlans(data as unknown as Product[]);
    };
    fetchPlans();
  }, [proposal?.product_type]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#e8e8e8] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-[#7c3aed] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-[#e8e8e8] flex items-center justify-center">
        <p className="text-[#666]">Proposta não encontrada</p>
      </div>
    );
  }

  const isEvolucao = proposal.product_type === 'evolucao_ez_chat';

  const validUntil = new Date(proposal.created_at);
  validUntil.setDate(validUntil.getDate() + proposal.validity_days);

  const proposalCode = `EZ-${new Date(proposal.created_at).toISOString().replace(/[-T:.Z]/g, '').slice(0, 14)}-${proposal.id.slice(0, 4).toUpperCase()}`;

  const integrations = (proposal.integrations || []) as { name: string; price: number; originalPrice?: number; discountLabel?: string; phase: number; details?: string }[];
  
  // If integrations contain essential setup items (with phase=1 and no integration prefix), use them directly
  // Otherwise fall back to calculating setupBase from the total
  const hasDetailedSetup = integrations.some(i => i.originalPrice !== undefined) || integrations.length > 0;
  
  const setupItems = hasDetailedSetup && integrations.length > 0
    ? integrations.map(i => ({
        name: i.name,
        description: i.details || (i.phase === 2 ? `Integração ${i.name} (Fase 2)` : undefined) as string | undefined,
        price: i.price,
        originalPrice: i.originalPrice,
        discountLabel: i.discountLabel,
      }))
    : (() => {
        const setupBase = proposal.setup_total - integrations.reduce((sum, i) => sum + i.price, 0);
        return [
          ...(setupBase > 0 ? [{
            name: 'Setup e Configuração Inicial',
            description: 'Nosso processo de Onboarding é um diferencial que oferecemos para garantir a primeira entrega de valor e a aplicação das melhores práticas de uso do produto.' as string | undefined,
            price: setupBase,
            originalPrice: undefined as number | undefined,
            discountLabel: undefined as string | undefined,
          }] : []),
          ...integrations.map(i => ({
            name: i.name,
            description: i.details || (`Integração ${i.name}${i.phase === 2 ? ' (Fase 2)' : ''}`) as string | undefined,
            price: i.price,
            originalPrice: undefined as number | undefined,
            discountLabel: undefined as string | undefined,
          })),
        ];
      })();

  const paymentLabel = proposal.setup_payment_method === 'pix'
    ? 'PIX'
    : proposal.setup_payment_method === 'boleto'
    ? 'Boleto'
    : 'Cartão de Crédito';

  const installmentValue = proposal.setup_installments > 0
    ? proposal.setup_total / proposal.setup_installments
    : proposal.setup_total;

  const onboardingSteps = [
    { num: 1, title: 'Kick-off', who: 'EZ + Cliente (Google Meet)', desc: 'Reunião inicial de boas-vindas para apresentação das equipes, alinhamento de expectativas, definição de objetivos e coleta de informações.' },
    { num: 2, title: 'Design', who: 'EZ + Cliente (assíncrono e síncrono)', desc: 'Elaboração do design estratégico do chatbot, com mapeamento dos fluxos conversacionais e integrações necessárias.' },
    { num: 3, title: 'Desenvolvimento', who: 'EZ + Cliente (assíncrono e síncrono)', desc: 'Construção dos fluxos no Flow Builder, configuração das integrações e implementação dos ajustes aprovados.' },
    { num: 4, title: 'Testes (QA)', who: 'EZ (interno)', desc: 'Execução de testes em ambiente de pré-produção, com simulação de cenários reais, identificação e correção de falhas.' },
    { num: 5, title: 'Treinamento', who: 'EZ + Cliente (Google Meet)', desc: 'Treinamento online personalizado, com entrega de materiais de apoio, capacitando a equipe do Cliente a operar a plataforma.' },
    { num: 6, title: 'Go Live (Ativação)', who: 'EZ + Cliente', desc: 'Ativação do chatbot em ambiente produtivo, com acompanhamento e monitoramento inicial.' },
    { num: 7, title: 'Operação Assistida', who: 'EZ + Cliente (assíncrono e síncrono)', desc: 'Suporte contínuo nos primeiros dias de operação, com ajustes em tempo real, validação de boas práticas e otimizações.' },
  ];

  return (
    <div className="min-h-screen bg-[#e8e8e8]">
      {/* Top bar */}
      <div className="bg-white border-b border-[#ddd] sticky top-0 z-50 no-pdf">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#7c3aed] hover:underline text-sm font-medium">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={pdfGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7c3aed] text-white font-medium text-sm hover:bg-[#6d28d9] transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {pdfGenerating ? 'Gerando PDF...' : 'Baixar PDF'}
          </button>
        </div>
      </div>

      <div ref={contentRef} className="max-w-4xl mx-auto px-4 py-6">
        {/* Proposal code */}
        <h1 className="text-2xl font-bold text-[#1a1a2e] mb-1 font-display">Proposta {proposalCode}</h1>
        <p className="text-[#666] mb-6">Para: {proposal.company_name}</p>

        {/* Hero section - Purple */}
        <div className="rounded-xl overflow-hidden mb-8" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)' }}>
          <div className="px-8 pt-8 pb-6">
            {/* Logos */}
            <div className="flex items-start justify-between mb-8">
              <img src={ezLogo} alt="EZ Journey" className="h-10" />
              <div className="flex items-center gap-3">
                <img src={gptwBadge} alt="Great Place to Work" className="h-[72px] rounded" />
                <img src={metaPartnerLogo} alt="Meta Business Partner" className="h-[52px] rounded" />
              </div>
            </div>

            {/* Company info */}
            <p className="text-white/70 text-sm tracking-wider uppercase font-medium">{isEvolucao ? 'Proposta de Evolução' : 'Proposta Comercial'}</p>
            <h2 className="text-3xl font-bold text-white mt-1 font-display">{proposal.company_name}</h2>
            {proposal.razao_social && proposal.razao_social !== proposal.company_name && (
              <p className="text-white/70 text-sm mt-1">{proposal.razao_social}</p>
            )}
            <div className="mb-6" />


            {proposal.project_objective && (
              <div className="mb-4">
                <p className="text-white/60 text-xs tracking-wider uppercase">Objetivo do Projeto</p>
                <p className="text-white text-sm mt-1">{proposal.project_objective}</p>
              </div>
            )}

            <div className="flex items-end justify-between">
              <div>
                <p className="text-white/60 text-xs tracking-wider uppercase">Solicitante</p>
                <p className="text-white font-semibold mt-1">{proposal.closer_name || proposal.sdr_name || '—'}</p>
                {proposal.contact_name && (
                  <p className="text-white/80 text-sm mt-0.5">{proposal.contact_name}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-white/60 text-xs tracking-wider uppercase">Data de Criação</p>
                <p className="text-white font-semibold mt-1">{formatDate(proposal.created_at)}</p>
                <p className="text-white/70 text-xs mt-0.5">Válido até {validUntil.toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          </div>
        </div>

        {isEvolucao ? (
          /* ============ EVOLUÇÃO LAYOUT ============ */
          <>
            {/* Intro text */}
            <div className="bg-white rounded-xl p-8 mb-6 border border-[#e5e5e5]">
              <p className="text-[#555] text-sm leading-relaxed">
                Olá <strong>{proposal.contact_name || proposal.closer_name || 'Cliente'}</strong>,
              </p>
              <p className="text-[#555] text-sm leading-relaxed mt-2">
                Conforme alinhado, aqui está a proposta para a evolução do seu projeto:
              </p>
            </div>

            {/* Items table */}
            <div className="bg-white rounded-xl p-8 mb-6 border border-[#e5e5e5]">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-9 w-9 rounded-lg bg-[#f3f0ff] flex items-center justify-center">
                  <FileText className="h-5 w-5 text-[#7c3aed]" />
                </div>
                <h3 className="text-xl font-bold text-[#7c3aed] font-display">O que será entregue / Investimento</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-[#e5e5e5]">
                      <th className="text-left py-3 text-[#666] font-semibold">Item</th>
                      <th className="text-right py-3 text-[#666] font-semibold">Valor Unit.</th>
                      <th className="text-right py-3 text-[#666] font-semibold">Valor Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {integrations.map((item, i) => (
                      <tr key={i} className="border-b border-[#f0f0f0]">
                        <td className="py-3">
                          <p className="font-medium text-[#1a1a2e]">{item.name}</p>
                          {item.details && (
                            <p className="text-xs text-[#888] mt-0.5 whitespace-pre-line">{item.details}</p>
                          )}
                          {item.discountLabel && (
                            <p className="text-xs text-green-600 mt-0.5">Desconto: {item.discountLabel}</p>
                          )}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          {item.originalPrice ? (
                            <span className="text-xs text-[#888] line-through">{formatCurrency(item.originalPrice)}</span>
                          ) : (
                            <span className="font-medium text-[#1a1a2e]">{formatCurrency(item.price)}</span>
                          )}
                        </td>
                        <td className="py-3 text-right font-medium text-[#1a1a2e] whitespace-nowrap">{formatCurrency(item.price)}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#f8f8f8]">
                      <td className="py-3 font-bold text-[#7c3aed]">Total</td>
                      <td className="py-3 text-right font-bold text-[#1a1a2e]">{formatCurrency(proposal.setup_total)}</td>
                      <td className="py-3 text-right font-bold text-[#7c3aed]">{formatCurrency(proposal.setup_total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment conditions */}
            <div className="bg-white rounded-xl p-8 mb-6 border border-[#e5e5e5]">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-9 w-9 rounded-lg bg-[#f3f0ff] flex items-center justify-center">
                  <FileText className="h-5 w-5 text-[#7c3aed]" />
                </div>
                <h3 className="text-xl font-bold text-[#7c3aed] font-display">Condições de Pagamento</h3>
              </div>
              <div className="bg-[#f8f6ff] rounded-lg p-4">
                <p className="text-sm text-[#555]">{paymentLabel}</p>
                <p className="text-lg font-bold text-[#7c3aed] mt-1">
                  {proposal.setup_installments}x de {formatCurrency(installmentValue)}
                </p>
                <div className="flex justify-end mt-2">
                  <div className="text-right">
                    <p className="text-xs text-[#888]">Valor total</p>
                    <p className="text-lg font-bold text-[#1a1a2e]">{formatCurrency(proposal.setup_total)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Acceptance */}
            <div className="bg-white rounded-xl p-8 mb-6 border border-[#e5e5e5]">
               <h3 className="text-xl font-bold text-[#1a1a2e] mb-4 font-display">Aceitação do Projeto</h3>
              <p className="text-[#555] text-sm leading-relaxed mb-6">
                Após a manifestação de "de acordo" por parte da Contratante, será encaminhado o <strong>Contrato de Prestação de Serviços</strong> para formalização da contratação, por meio do qual as Partes reconhecem a <strong>integridade, autenticidade, validade, executividade e regularidade</strong> dos termos acordados.
              </p>
              {proposal.status === 'accepted' ? (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-green-700 font-semibold text-sm">Proposta aceita! Entraremos em contato para formalização do contrato.</p>
                </div>
              ) : proposal.status === 'rejected' ? (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-red-600 font-semibold text-sm">Esta proposta foi recusada.</p>
                </div>
              ) : !pdfGenerating ? (
                <>
                  <h4 className="font-semibold text-[#1a1a2e] text-sm mb-4">O que deseja fazer?</h4>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={handleAccept} disabled={actionLoading} className="px-6 py-3 rounded-lg bg-[#7c3aed] text-white font-semibold text-sm hover:bg-[#6d28d9] transition-colors flex items-center gap-2 disabled:opacity-50">
                      <CheckCircle2 className="h-4 w-4" /> {actionLoading ? 'Processando...' : 'Aceitar Proposta'}
                    </button>
                    <button onClick={() => handleWhatsAppContact(`Olá! Tenho dúvidas sobre a proposta ${proposal.company_name}.`)} className="px-6 py-3 rounded-lg border border-[#ddd] text-[#555] font-medium text-sm hover:bg-[#f5f5f5] transition-colors">
                      Tenho Dúvidas
                    </button>
                    <button onClick={() => handleWhatsAppContact(`Olá! Gostaria de solicitar alterações na proposta ${proposal.company_name}.`)} className="px-6 py-3 rounded-lg border border-[#ddd] text-[#555] font-medium text-sm hover:bg-[#f5f5f5] transition-colors">
                      Solicitar Alterações
                    </button>
                    <button onClick={handleReject} disabled={actionLoading} className="px-6 py-3 rounded-lg border border-red-200 text-red-500 font-medium text-sm hover:bg-red-50 transition-colors disabled:opacity-50">
                      Recusar Proposta
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </>
        ) : (
          /* ============ EZ CHAT STANDARD LAYOUT ============ */
          <>
        {/* Plans Carousel */}
        {plans.length > 0 && (
          <Collapsible open={plansOpen} onOpenChange={setPlansOpen}>
            <div className="bg-white rounded-xl p-8 mb-6 border border-[#e5e5e5]">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-[#f3f0ff] flex items-center justify-center">
                      <LayoutGrid className="h-5 w-5 text-[#7c3aed]" />
                    </div>
                    <h3 className="text-lg font-bold text-[#1a1a2e]">Planos EZ Chat</h3>
                  </div>
                  {plansOpen ? (
                    <ChevronUp className="h-5 w-5 text-[#888]" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-[#888]" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-6">
                  <Carousel opts={{ align: 'start', loop: false }} className="w-full">
                    <CarouselContent className="-ml-3">
                      {plans.map((plan) => {
                        const isSelected = plan.name === proposal?.plan_name;
                        return (
                          <CarouselItem key={plan.id} className="pl-3 basis-full md:basis-1/3">
                            <div
                              className={`relative rounded-xl border p-5 h-full flex flex-col transition-all hover:shadow-md ${
                                isSelected
                                  ? 'border-2 border-[#7c3aed] shadow-[0_0_20px_rgba(124,58,237,0.15)]'
                                  : 'border-[#e5e5e5]'
                              }`}
                            >
                              {plan.recommended && (
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#7c3aed] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                                  Recomendado
                                </span>
                              )}
                              {isSelected && !plan.recommended && (
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#7c3aed] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                                  Seu Plano
                                </span>
                              )}
                              <h4 className="text-base font-bold text-[#1a1a2e] mt-1">{plan.name}</h4>
                              {plan.description && (
                                <p className="text-xs text-[#888] mt-1 line-clamp-2">{plan.description}</p>
                              )}
                              <p className="text-2xl font-bold text-[#7c3aed] mt-3">
                                {plan.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                <span className="text-xs font-normal text-[#888]">/mês</span>
                              </p>
                              <div className="mt-4 space-y-2 flex-1">
                                <div className="flex items-center gap-2 text-xs text-[#555]">
                                  <Check className="h-3.5 w-3.5 text-[#7c3aed] shrink-0" />
                                  <span>{plan.messages_included.toLocaleString('pt-BR')} mensagens incluídas</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-[#555]">
                                  <Check className="h-3.5 w-3.5 text-[#7c3aed] shrink-0" />
                                  <span>{plan.contacts_included.toLocaleString('pt-BR')} contatos incluídos</span>
                                </div>
                              </div>
                              <div className="mt-3 pt-3 border-t border-[#f0f0f0] space-y-1">
                                <p className="text-[10px] text-[#aaa]">
                                  Excedente: {formatCurrency(plan.excess_message_price)}/msg · {formatCurrency(plan.excess_contact_price)}/contato
                                </p>
                              </div>
                            </div>
                          </CarouselItem>
                        );
                      })}
                    </CarouselContent>
                    <CarouselPrevious className="hidden md:flex -left-4" />
                    <CarouselNext className="hidden md:flex -right-4" />
                  </Carousel>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        <div className="bg-white rounded-xl p-8 mb-6 border border-[#e5e5e5]">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-[#f3f0ff] flex items-center justify-center">
              <Building2 className="h-5 w-5 text-[#7c3aed]" />
            </div>
            <h3 className="text-lg font-bold text-[#1a1a2e]">SOBRE A EZ SOFT</h3>
          </div>
          <p className="text-[#7c3aed] font-medium text-sm mb-3">Sua parceira em Soluções de Atendimento</p>
          <p className="text-[#555] text-sm leading-relaxed">
            Nossa missão é atuar <strong>lado a lado</strong> com sua empresa, integrando{' '}
            <strong className="text-[#7c3aed]">pessoas e tecnologia</strong> em uma única plataforma para{' '}
            <strong>simplificar operações</strong>, <strong>ganhar escala</strong> e gerar{' '}
            <strong>resultados reais</strong>. Na EZ, inovação não é discurso — é{' '}
            <strong>parceria aplicada ao crescimento</strong> do seu negócio.
          </p>
        </div>

        {/* Introdução */}
        <div className="bg-white rounded-xl p-8 mb-6 border border-[#e5e5e5]">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-5 w-5 text-[#7c3aed]" />
            <h3 className="text-xl font-bold text-[#7c3aed]">Introdução</h3>
          </div>
          <p className="text-[#555] text-sm leading-relaxed">
            Esta Proposta Comercial tem como objetivo apresentar os valores de investimento e o escopo dos serviços necessários para a implantação completa do chatbot na plataforma EZ Chat, incluindo onboarding, treinamentos, parametrizações, integrações, implantações e mentorias, bem como estabelecer as premissas, condições e responsabilidades para garantir uma operação eficiente, escalável e alinhada aos objetivos do negócio.
          </p>
        </div>

        {/* Apresentação EZ Chat */}
        <div className="bg-white rounded-xl p-8 mb-6 border border-[#e5e5e5]">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="h-5 w-5 text-[#7c3aed]" />
            <h3 className="text-xl font-bold text-[#7c3aed]">Apresentação EZ Chat</h3>
          </div>
          <p className="text-[#555] text-sm leading-relaxed mb-3">
            A EZ Chat é uma plataforma low-code de hiperautomação, desenvolvida para a criação, implantação e gestão de chatbots nos principais canais digitais, além da integração e orquestração de sistemas e processos de forma centralizada.
          </p>
          <p className="text-[#555] text-sm leading-relaxed mb-3">
            Com uma interface prática e intuitiva, a plataforma permite o desenvolvimento de chatbots inteligentes e resolutivos, capazes de automatizar atendimentos, qualificar demandas e escalar operações.
          </p>
          <p className="text-[#555] text-sm leading-relaxed">
            A EZ Chat conecta pessoas, simplifica processos e integra tecnologias em uma única plataforma de automação conversacional, orientada a eficiência, controle e resultados.
          </p>
        </div>

        {/* Termos e Condições */}
        <div className="bg-white rounded-xl p-8 mb-6 border border-[#e5e5e5]">
          <h3 className="text-xl font-bold text-[#1a1a2e] mb-6">Termos e Condições</h3>

          <h4 className="font-bold text-[#1a1a2e] text-sm mb-3">Execução dos Serviços</h4>
          <p className="text-[#555] text-sm leading-relaxed mb-4">
            A Contratante poderá adquirir, a qualquer momento, serviços relacionados à implantação e evolução do chatbot na plataforma EZ Chat, incluindo onboarding, treinamentos, implantações, integrações, parametrizações, mentorias e serviços correlatos.
          </p>

          <h4 className="font-bold text-[#1a1a2e] text-sm mb-3">Metodologia de Execução dos Serviços</h4>
          <ul className="text-[#555] text-sm leading-relaxed space-y-2 mb-4 list-disc list-inside">
            <li>A contratação dos serviços ocorrerá mediante agendamento prévio e disponibilidade da equipe de Serviços da EZ Chat.</li>
            <li>Os serviços serão prestados de forma remota, utilizando exclusivamente a plataforma EZ Chat.</li>
            <li>Os serviços contemplados nesta proposta serão executados em dias úteis, das 8h às 17h.</li>
            <li>A Contratante deverá indicar um colaborador responsável como facilitador do projeto.</li>
            <li>A EZ Chat terá o prazo de até 10 (dez) dias úteis para iniciar os serviços após o aceite da proposta.</li>
          </ul>

          <h4 className="font-bold text-[#1a1a2e] text-sm mb-3">Premissas e Restrições</h4>
          <ul className="text-[#555] text-sm leading-relaxed space-y-2 mb-4 list-disc list-inside">
            <li>A EZ Chat não realiza migração de dados, desenvolvimento de relatórios personalizados ou dashboards avançados.</li>
            <li>A EZ Chat executa serviços exclusivamente em sua própria plataforma.</li>
            <li>O fornecimento de acessos, tokens e credenciais é de responsabilidade da Contratante.</li>
            <li>A responsabilidade da EZ Chat limita-se aos serviços descritos nesta proposta.</li>
          </ul>

          <p className="text-[#555] text-sm leading-relaxed mb-3">
            <strong>Custos de Inteligência Artificial:</strong> Custos adicionais relacionados à contratação de provedores de IA (OpenAI, Gemini, etc.) não estão inclusos na mensalidade, sendo de responsabilidade exclusiva da Contratante.
          </p>
          <p className="text-[#555] text-sm leading-relaxed">
            <strong>Pagamentos junto à Meta (WhatsApp Oficial):</strong> A contratação, gestão e pagamento dos custos relacionados ao WhatsApp Oficial são de responsabilidade exclusiva da Contratante.
          </p>
        </div>

        {/* Suporte e SLA */}
        <div className="bg-white rounded-xl p-8 mb-6 border border-[#e5e5e5]">
          <div className="flex items-center gap-3 mb-4">
            <Headphones className="h-5 w-5 text-[#7c3aed]" />
            <h3 className="text-xl font-bold text-[#7c3aed]">Suporte e SLA</h3>
          </div>
          <p className="text-[#555] text-sm leading-relaxed">
            As políticas de Suporte e SLA da Plataforma EZ Chat estão descritas no link abaixo:
          </p>
          <a href="https://ezsoft.com.br/sla" target="_blank" rel="noopener noreferrer" className="text-[#7c3aed] text-sm hover:underline mt-2 inline-block">
            Termos de suporte e acordos de nível de serviço (SLA) da Plataforma EZ Chat →
          </a>
        </div>

        {/* Investimento */}
        <div className="bg-white rounded-xl p-8 mb-6 border border-[#e5e5e5]">
          <h3 className="text-xl font-bold text-[#1a1a2e] mb-6">Investimento</h3>

          {/* Setup */}
          {proposal.setup_total > 0 && (
            <>
              <h4 className="font-bold text-[#1a1a2e] mb-4">Investimento Inicial (Único)</h4>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-[#e5e5e5]">
                      <th className="text-left py-3 text-[#666] font-semibold">Item</th>
                      <th className="text-right py-3 text-[#666] font-semibold">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {setupItems.map((item, i) => (
                      <tr key={i} className="border-b border-[#f0f0f0]">
                        <td className="py-3">
                          <p className="font-medium text-[#1a1a2e]">{item.name}</p>
                          {item.description && <p className="text-xs text-[#888] mt-0.5 whitespace-pre-line">{item.description}</p>}
                          {item.discountLabel && <p className="text-xs text-green-600 mt-0.5">Desconto: {item.discountLabel}</p>}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          {item.originalPrice ? (
                            <>
                              <span className="text-xs text-[#888] line-through">{formatCurrency(item.originalPrice)}</span>
                              <span className="font-medium text-[#1a1a2e] ml-2">{formatCurrency(item.price)}</span>
                            </>
                          ) : (
                            <span className="font-medium text-[#1a1a2e]">{formatCurrency(item.price)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#f8f8f8]">
                      <td className="py-3 font-bold text-[#1a1a2e]">Total Setup</td>
                      <td className="py-3 text-right font-bold text-[#1a1a2e]">{formatCurrency(proposal.setup_total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-[#f8f6ff] rounded-lg p-4 mb-8">
                <p className="text-sm text-[#555] mb-1">Condições de Pagamento:</p>
                <p className="text-sm font-bold text-[#7c3aed]">{paymentLabel}</p>
                <p className="text-sm text-[#555]">
                  {proposal.setup_installments}x de {formatCurrency(installmentValue)}
                </p>
                <p className="text-xs text-[#888] mt-1">Valor total: {formatCurrency(proposal.setup_total)}</p>
              </div>
            </>
          )}

          {/* Monthly */}
          <h4 className="font-bold text-[#1a1a2e] mb-4">Investimento Mensal (Licença de Uso)</h4>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#e5e5e5]">
                  <th className="text-left py-3 text-[#666] font-semibold">Item</th>
                  <th className="text-right py-3 text-[#666] font-semibold">Valor/mês</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#f0f0f0]">
                  <td className="py-3">
                    <p className="font-medium text-[#1a1a2e]">Plano {proposal.plan_name}</p>
                    <p className="text-xs text-[#888] mt-0.5">Mensalidade da plataforma EZ Chat</p>
                    {(() => {
                      const matchedPlan = plans.find(p => p.name === proposal.plan_name);
                      const msgsIncl = ((proposal as any).plan_messages_included || null) ?? matchedPlan?.messages_included ?? null;
                      const contsIncl = ((proposal as any).plan_contacts_included || null) ?? matchedPlan?.contacts_included ?? null;
                      const exMsgPrice = ((proposal as any).plan_excess_message_price || null) ?? matchedPlan?.excess_message_price ?? null;
                      const exContPrice = ((proposal as any).plan_excess_contact_price || null) ?? matchedPlan?.excess_contact_price ?? null;
                      if (msgsIncl == null && contsIncl == null) return null;
                      return (
                        <div className="text-xs text-[#777] mt-1 space-y-0.5">
                          <p>Inclusos: {(msgsIncl ?? 0).toLocaleString('pt-BR')} msgs + {(contsIncl ?? 0).toLocaleString('pt-BR')} contatos</p>
                          <p>Excedente além dos limites: {formatCurrency(exMsgPrice ?? 0)}/msg · {formatCurrency(exContPrice ?? 0)}/contato</p>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-3 text-right font-medium text-[#1a1a2e]">{formatCurrency(proposal.plan_price)}</td>
                </tr>
                {proposal.applied_excess_cost > 0 && (
                  <tr className="border-b border-[#f0f0f0]">
                    <td className="py-3">
                      <p className="font-medium text-[#1a1a2e]">Excedente estimado</p>
                      <p className="text-xs text-[#888] mt-0.5">
                        O menor entre: {proposal.excess_messages.toLocaleString('pt-BR')} msgs excedidas ({formatCurrency(proposal.excess_message_cost)}) e {proposal.excess_contacts.toLocaleString('pt-BR')} contatos excedidos ({formatCurrency(proposal.excess_contact_cost)})
                      </p>
                    </td>
                    <td className="py-3 text-right font-medium text-[#1a1a2e]">{formatCurrency(proposal.applied_excess_cost)}</td>
                  </tr>
                )}
                <tr className="border-b border-[#f0f0f0]">
                  <td className="py-3">
                    <p className="font-medium text-[#1a1a2e]">Custo WhatsApp API</p>
                    <p className="text-xs text-[#888] mt-0.5">Pago diretamente à Meta</p>
                  </td>
                  <td className="py-3 text-right text-[#888] text-xs">De acordo com perfil de consumo</td>
                </tr>
                {proposal.meta_cost > 0 && (proposal as any).show_meta_costs !== false && (
                  <>
                    <tr className="border-b border-[#f0f0f0]">
                      <td className="py-3">
                        <p className="font-medium text-[#1a1a2e]">Custo Meta WhatsApp estimado</p>
                        <p className="text-xs text-[#888] mt-0.5">{proposal.estimated_messages.toLocaleString('pt-BR')} mensagens / {proposal.estimated_contacts.toLocaleString('pt-BR')} contatos</p>
                        {(() => {
                          const cfg = (proposal as any).meta_cost_config;
                          if (!cfg?.entries?.length) return null;
                          return (
                            <p className="text-[11px] text-[#aaa] mt-1">
                              Proporção: {cfg.entries.map((e: { name: string; percentage: number }) => `${e.name} ${e.percentage}%`).join(' · ')}
                            </p>
                          );
                        })()}
                      </td>
                      <td className="py-3 text-right font-medium text-[#1a1a2e]">≈ {formatCurrency(proposal.meta_cost)}</td>
                    </tr>
                  </>
                )}
                <tr className="bg-[#f8f8f8]">
                  <td className="py-3 font-bold text-[#1a1a2e]">Total Mensal</td>
                  <td className="py-3 text-right font-bold text-[#1a1a2e]">{formatCurrency(proposal.total_monthly)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Excess detailing */}
          {(() => {
            const hasExcess = proposal.excess_messages > 0 || proposal.excess_contacts > 0;
            const matchedPlan = plans.find(p => p.name === proposal.plan_name);
            const exMsgPrice = (proposal as any).plan_excess_message_price ?? matchedPlan?.excess_message_price ?? 0;
            const exContPrice = (proposal as any).plan_excess_contact_price ?? matchedPlan?.excess_contact_price ?? 0;
            return (
              <div className="mb-6 rounded-lg border border-[#e5e5e5] p-5">
                <h4 className="font-bold text-[#1a1a2e] text-sm mb-3">Detalhamento de Excedente</h4>
                {hasExcess ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div>
                        <p className="text-[#888] text-xs">Msgs excedentes</p>
                        <p className="font-medium text-[#1a1a2e]">{proposal.excess_messages.toLocaleString('pt-BR')}</p>
                      </div>
                      <div>
                        <p className="text-[#888] text-xs">Contatos excedentes</p>
                        <p className="font-medium text-[#1a1a2e]">{proposal.excess_contacts.toLocaleString('pt-BR')}</p>
                      </div>
                      <div>
                        <p className="text-[#888] text-xs">Preço exc./msg</p>
                        <p className="font-medium text-[#1a1a2e]">{formatCurrency(exMsgPrice)}</p>
                      </div>
                      <div>
                        <p className="text-[#888] text-xs">Preço exc./contato</p>
                        <p className="font-medium text-[#1a1a2e]">{formatCurrency(exContPrice)}</p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#f8f6ff] p-3 text-xs text-[#555] leading-relaxed">
                      <p className="font-medium text-[#1a1a2e] mb-1">Regra de Excedente Inteligente</p>
                      <p>O excedente só é cobrado se <strong>ambos</strong> os limites (mensagens e contatos) forem ultrapassados. Quando isso acontece, cobra-se o <strong>menor</strong> valor entre os dois — você nunca paga os dois ao mesmo tempo.</p>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <p className="text-green-700 text-sm font-medium">Nenhum excedente aplicado — volume dentro do plano.</p>
                  </div>
                )}
              </div>
            );
          })()}

          <p className="text-[#555] text-sm leading-relaxed mb-6">
            O pagamento da licença de uso da plataforma é realizado no modelo <strong>pós-pago</strong>, podendo ser efetuado via Pix, boleto bancário ou cartão de crédito. As cobranças são geradas no primeiro dia útil de cada mês, com <strong>vencimento no dia 10 de cada mês</strong>.
          </p>

          {/* Additional Services */}
          <h4 className="font-bold text-[#1a1a2e] mb-3">Serviços Adicionais</h4>
          <p className="text-[#555] text-sm leading-relaxed mb-2">
            Havendo necessidade de serviços adicionais, a Contratante poderá adquirir novas horas de desenvolvimentos a qualquer momento mediante nova proposta comercial.
          </p>
          <div className="bg-[#f8f6ff] rounded-lg p-4 mb-6 inline-block">
            <p className="text-xs text-[#888]">Valor por hora de projeto</p>
            <p className="text-lg font-bold text-[#7c3aed]">R$ 250,00</p>
          </div>

          {/* Summary */}
          <h4 className="font-bold text-[#1a1a2e] mb-4">Resumo do Investimento</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {proposal.setup_total > 0 && (
              <div className="bg-[#f8f6ff] rounded-xl p-6 border border-[#e5e0ff]">
                <p className="text-xs text-[#888] uppercase tracking-wider">Investimento Inicial</p>
                <p className="text-2xl font-bold text-[#1a1a2e] mt-1">{formatCurrency(proposal.setup_total)}</p>
                <p className="text-xs text-[#888] mt-1">pagamento único</p>
                <p className="text-sm text-[#7c3aed] font-medium mt-2">
                  {paymentLabel} em {proposal.setup_installments}x de {formatCurrency(installmentValue)}
                </p>
              </div>
            )}
            <div className="bg-[#f8f6ff] rounded-xl p-6 border border-[#e5e0ff]">
              <p className="text-xs text-[#888] uppercase tracking-wider">Mensalidade</p>
              <p className="text-2xl font-bold text-[#1a1a2e] mt-1">{formatCurrency(proposal.total_monthly)}</p>
              <p className="text-xs text-[#888] mt-1">recorrente</p>
              <div className="mt-2 space-y-0.5">
                <p className="text-xs text-[#666]">Plano: {formatCurrency(proposal.plan_price)}</p>
                {proposal.applied_excess_cost > 0 && (
                  <p className="text-xs text-[#666]">Excedente: {formatCurrency(proposal.applied_excess_cost)}</p>
                )}
                {proposal.meta_cost > 0 && (proposal as any).show_meta_costs !== false && (
                  <p className="text-xs text-[#666]">Meta WhatsApp: ≈ {formatCurrency(proposal.meta_cost)}</p>
                )}
              </div>
              {(() => {
                const msgsIncl = (proposal as any).plan_messages_included ?? null;
                const contsIncl = (proposal as any).plan_contacts_included ?? null;
                const exMsgPrice = (proposal as any).plan_excess_message_price ?? null;
                const exContPrice = (proposal as any).plan_excess_contact_price ?? null;
                if (msgsIncl == null && contsIncl == null) return null;
                return (
                  <div className="mt-3 pt-3 border-t border-[#e5e0ff] space-y-0.5">
                    <p className="text-[11px] text-[#888]">Inclusos: {(msgsIncl ?? 0).toLocaleString('pt-BR')} msgs + {(contsIncl ?? 0).toLocaleString('pt-BR')} contatos</p>
                    <p className="text-[11px] text-[#888]">Excedente: {formatCurrency(exMsgPrice ?? 0)}/msg · {formatCurrency(exContPrice ?? 0)}/contato</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Etapas do Onboarding */}
        <div className="bg-white rounded-xl p-8 mb-6 border border-[#e5e5e5]">
          <h3 className="text-xl font-bold text-[#1a1a2e] mb-6">Etapas e Entregáveis do Onboarding</h3>
          <p className="text-[#555] text-sm mb-6">
            Após a confirmação da assinatura do contrato e do pagamento do valor de Implantação, a equipe de Projetos da EZ entrará em contato para dar início à execução dos serviços contratados.
          </p>
          <div className="space-y-4">
            {onboardingSteps.map(step => (
              <div key={step.num} className="flex gap-4">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#7c3aed] text-white flex items-center justify-center font-bold text-sm">
                  {step.num}
                </div>
                <div className="flex-1 pb-4 border-b border-[#f0f0f0] last:border-0">
                  <h5 className="font-bold text-[#1a1a2e] text-sm">{step.title}</h5>
                  <p className="text-xs text-[#7c3aed] mb-1">{step.who}</p>
                  <p className="text-[#555] text-sm">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contract Terms */}
        <div className="bg-white rounded-xl p-8 mb-6 border border-[#e5e5e5]">
          <h3 className="text-xl font-bold text-[#1a1a2e] mb-6">Termos de Contrato</h3>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[#f8f6ff] rounded-lg p-4 text-center">
              <p className="text-xs text-[#888]">Vigência do Contrato</p>
              <p className="text-xl font-bold text-[#1a1a2e] mt-1">{proposal.contract_months} meses</p>
            </div>
            <div className="bg-[#f8f6ff] rounded-lg p-4 text-center">
              <p className="text-xs text-[#888]">Multa por Cancelamento</p>
              <p className="text-xl font-bold text-[#1a1a2e] mt-1">{proposal.cancellation_fee_percent}% do valor restante</p>
            </div>
          </div>
          <p className="text-[#555] text-sm leading-relaxed mb-3">
            <strong>Vigência e Renovação:</strong> O presente contrato terá vigência de <strong>{proposal.contract_months} meses</strong>, contados a partir da data de sua assinatura, sendo automaticamente renovado por iguais e sucessivos períodos, salvo manifestação em contrário com antecedência mínima de 30 dias.
          </p>
          <p className="text-[#555] text-sm leading-relaxed">
            <strong>Rescisão Antecipada:</strong> Em caso de cancelamento antes do término do período contratado, será aplicada multa de <strong>{proposal.cancellation_fee_percent}%</strong> sobre o valor restante do contrato.
          </p>
        </div>

        {/* Confidentiality */}
        <div className="bg-white rounded-xl p-8 mb-6 border border-[#e5e5e5]">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-5 w-5 text-[#7c3aed]" />
            <h3 className="text-xl font-bold text-[#1a1a2e]">Termo de Confidencialidade</h3>
          </div>
          <p className="text-[#555] text-sm leading-relaxed mb-3">
            Todo o conteúdo desta proposta comercial, bem como quaisquer materiais, dados e informações compartilhados entre as partes, são considerados <strong>informações confidenciais</strong>.
          </p>
          <p className="text-[#555] text-sm leading-relaxed">
            A Contratante compromete-se a <strong>não divulgar, reproduzir ou disponibilizar</strong> a terceiros, direta ou indiretamente, quaisquer informações constantes nesta proposta, sem prévia autorização expressa da EZ Softwares.
          </p>
        </div>

        {/* Acceptance */}
        <div className="bg-white rounded-xl p-8 mb-6 border border-[#e5e5e5]">
          <h3 className="text-xl font-bold text-[#1a1a2e] mb-4">Aceitação do Projeto</h3>
          <p className="text-[#555] text-sm leading-relaxed mb-6">
            Após a manifestação de "de acordo" por parte da Contratante, será encaminhado o <strong>Contrato de Prestação de Serviços</strong> para formalização da contratação.
          </p>
          {proposal.status === 'accepted' ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-green-700 font-semibold text-sm">Proposta aceita! Entraremos em contato para formalização do contrato.</p>
            </div>
          ) : proposal.status === 'rejected' ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-red-600 font-semibold text-sm">Esta proposta foi recusada.</p>
            </div>
          ) : !pdfGenerating ? (
            <>
              <h4 className="font-semibold text-[#1a1a2e] text-sm mb-4">O que deseja fazer?</h4>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleAccept} disabled={actionLoading} className="px-6 py-3 rounded-lg bg-[#7c3aed] text-white font-semibold text-sm hover:bg-[#6d28d9] transition-colors flex items-center gap-2 disabled:opacity-50">
                  <CheckCircle2 className="h-4 w-4" /> {actionLoading ? 'Processando...' : 'Aceitar Proposta'}
                </button>
                <button onClick={() => handleWhatsAppContact(`Olá! Tenho dúvidas sobre a proposta ${proposal.company_name}.`)} className="px-6 py-3 rounded-lg border border-[#ddd] text-[#555] font-medium text-sm hover:bg-[#f5f5f5] transition-colors">
                  Tenho Dúvidas
                </button>
                <button onClick={() => handleWhatsAppContact(`Olá! Gostaria de solicitar alterações na proposta ${proposal.company_name}.`)} className="px-6 py-3 rounded-lg border border-[#ddd] text-[#555] font-medium text-sm hover:bg-[#f5f5f5] transition-colors">
                  Solicitar Alterações
                </button>
                <button onClick={handleReject} disabled={actionLoading} className="px-6 py-3 rounded-lg border border-red-200 text-red-500 font-medium text-sm hover:bg-red-50 transition-colors disabled:opacity-50">
                  Recusar Proposta
                </button>
              </div>
            </>
          ) : null}
        </div>
          </>
        )}

        {/* Footer */}
        <div className="bg-[#1a1a2e] rounded-xl p-8 text-center mb-8">
          <p className="text-white/60 text-sm mb-2">Dúvidas? Entre em contato comigo</p>
          {proposal.closer_name && (
            <p className="text-white font-semibold text-lg">{proposal.closer_name}</p>
          )}
          {closerWhatsapp && (
            <a
              href={`https://web.whatsapp.com/send?phone=55${closerWhatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/70 text-sm mt-1 inline-block hover:text-white underline underline-offset-2 transition-colors"
            >
              <WhatsAppIcon className="h-4 w-4 inline-block mr-1 align-text-bottom" />
              {closerWhatsapp}
            </a>
          )}
          <p className="text-white/60 text-xs mt-1">Executivo Comercial</p>
          <div className="mt-4">
            <img src={ezLogo} alt="EZ Journey" className="h-6 mx-auto brightness-0 invert opacity-50" />
          </div>
          <p className="text-white/40 text-xs mt-4">Avenida Cesário Alvim, 3813 · Uberlândia/MG · 18.531.719/0001-49</p>
        </div>
      </div>
    </div>
  );
};

export default ProposalPreviewPage;
