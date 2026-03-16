import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, FileText, Eye, Search, Building2, X, Percent, Info } from 'lucide-react';
import { toast } from 'sonner';
import { searchLeadsForProposal, linkClientToProposal, fetchProposalById, saveProposal, type ProposalData, type ProposalLeadResult } from '@/services/proposalService';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageHeader } from '@/components/PageHeader';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });




const ProposalReviewPage = () => {
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const navigate = useNavigate();
  const [editFields, setEditFields] = useState({
    plan_name: '',
    plan_price: 0,
    estimated_contacts: 0,
    estimated_messages: 0,
    meta_cost: 0,
    total_monthly: 0,
    setup_total: 0,
    setup_payment_method: 'pix',
    setup_installments: 1,
    contract_months: 12,
    cancellation_fee_percent: 20,
    validity_days: 30,
    notes: '',
    project_objective: '',
    show_meta_costs: true,
    integrations: [] as { name: string; price: number; phase: number; details?: string; originalPrice?: number; discountLabel?: string }[],
  });

  // Client search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProposalLeadResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const searchLeads = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    try {
      const results = await searchLeadsForProposal(query);
      setSearchResults(results);
      setShowResults(true);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchLeads(value), 300);
  };

  const selectLead = async (lead: ProposalLeadResult) => {
    setShowResults(false);
    const displayName = lead.razao_social || lead.nome_fantasia || lead.company;
    setSearchQuery(displayName);
    
    if (!id) return;
    try {
      const updateData = await linkClientToProposal(id, lead);
      toast.success('Cliente vinculado à proposta');
      setProposal(prev => prev ? { ...prev, ...updateData } : prev);
      setSearchQuery('');
    } catch {
      toast.error('Erro ao vincular cliente');
    }
  };

  const clearClientSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!id) return;
    const loadProposal = async () => {
      try {
        const p = await fetchProposalById(id);
        setProposal(p);
        setEditFields({
          plan_name: p.plan_name,
          plan_price: p.plan_price,
          estimated_contacts: p.estimated_contacts,
          estimated_messages: p.estimated_messages,
          meta_cost: p.meta_cost,
          total_monthly: p.total_monthly,
          setup_total: p.setup_total,
          setup_payment_method: p.setup_payment_method,
          setup_installments: p.setup_installments,
          contract_months: p.contract_months,
          cancellation_fee_percent: p.cancellation_fee_percent,
          validity_days: p.validity_days,
          notes: p.notes || '',
          project_objective: p.project_objective || '',
          show_meta_costs: (p as any).show_meta_costs ?? true,
          integrations: (p.integrations || []) as any,
        });
        setLoading(false);
      } catch {
        toast.error('Erro ao carregar proposta');
      }
    };
    loadProposal();
  }, [id]);

  const computedSetupTotal = useMemo(() => {
    return editFields.integrations.reduce((sum, i) => sum + i.price, 0);
  }, [editFields.integrations]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await saveProposal(id, editFields, computedSetupTotal);
      toast.success('Proposta salva com sucesso!');
      const url = `${window.location.origin}/proposal-preview/${id}`;
      navigator.clipboard.writeText(url).then(() => {
        toast.success('Link da proposta copiado!', { duration: 3000 });
      }).catch(() => {});
      if (window.history.length > 2) {
        navigate(-1);
      } else {
        navigate('/proposals');
      }
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/proposal-preview/${id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Proposta não encontrada</p>
      </div>
    );
  }

  const validUntil = new Date(proposal.created_at);
  validUntil.setDate(validUntil.getDate() + editFields.validity_days);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/proposals')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <PageHeader
              icon={<FileText className="h-5 w-5" strokeWidth={1.5} />}
              title="Proposta Comercial"
              subtitle={proposal.company_name}
              badges={
                <Badge variant={proposal.status === 'draft' ? 'secondary' : 'default'}>
                  {proposal.status === 'draft' ? 'Rascunho' : proposal.status}
                </Badge>
              }
              actions={
                <div className="flex items-center gap-2">
                  <Button onClick={() => navigate(`/proposal-preview/${id}`)} variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizar proposta
                  </Button>
                  <Button onClick={handleCopyLink} variant="outline" size="sm">
                    {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copied ? 'Copiado!' : 'Copiar link da proposta'}
                  </Button>
                </div>
              }
              className="pb-0 flex-1"
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        {/* Client Data */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search field */}
            <div ref={searchRef} className="relative">
              <Label className="text-xs font-medium mb-1.5 block">Buscar e vincular cliente <span className="text-destructive">*</span></Label>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Razão social, nome fantasia ou CNPJ..."
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowResults(true)}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <button onClick={clearClientSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {showResults && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {searching ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Buscando...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado encontrado</div>
                  ) : (
                    searchResults.map(lead => (
                      <button
                        key={lead.id}
                        onClick={() => selectLead(lead)}
                        className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-start gap-2"
                      >
                        <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {lead.razao_social || lead.nome_fantasia || lead.company}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {lead.cnpj && `CNPJ: ${lead.cnpj}`}
                            {lead.cnpj && lead.name && ' · '}
                            {lead.name}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {!proposal.company_name || proposal.company_name === '—' || proposal.company_name.trim() === '' ? (
              <p className="text-xs text-destructive mt-1">Vincule um cliente para poder salvar a proposta.</p>
            ) : null}

            {/* Current client info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Empresa</p>
                <p className="font-medium">{proposal.company_name || '—'}</p>
              </div>
              {proposal.cnpj && (
                <div>
                  <p className="text-muted-foreground">CNPJ</p>
                  <p className="font-medium">{proposal.cnpj}</p>
                </div>
              )}
              {proposal.contact_name && (
                <div>
                  <p className="text-muted-foreground">Contato</p>
                  <p className="font-medium">{proposal.contact_name}</p>
                </div>
              )}
              {proposal.contact_email && (
                <div>
                  <p className="text-muted-foreground">E-mail</p>
                  <p className="font-medium">{proposal.contact_email}</p>
                </div>
              )}
              {proposal.contact_phone && (
                <div>
                  <p className="text-muted-foreground">Telefone</p>
                  <p className="font-medium">{proposal.contact_phone}</p>
                </div>
              )}
              {proposal.sdr_name && (
                <div>
                  <p className="text-muted-foreground">SDR</p>
                  <p className="font-medium">{proposal.sdr_name}</p>
                </div>
              )}
              {proposal.closer_name && (
                <div>
                  <p className="text-muted-foreground">Closer</p>
                  <p className="font-medium">{proposal.closer_name}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Project Objective */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Objetivo do Projeto</CardTitle>
          </CardHeader>
          <CardContent>
            <Label className="text-xs font-medium mb-1.5 block">Objetivo <span className="text-destructive">*</span></Label>
            <Select
              value={editFields.project_objective}
              onValueChange={v => setEditFields(prev => ({ ...prev, project_objective: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o objetivo do projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Automação de atendimento para escala, eficiência e redução de custos">Automação de atendimento para escala, eficiência e redução de custos</SelectItem>
                <SelectItem value="Atendimento 24/7 sem depender de equipe humana">Atendimento 24/7 sem depender de equipe humana</SelectItem>
                <SelectItem value="Redução de tempo médio de atendimento (TMA) e filas">Redução de tempo médio de atendimento (TMA) e filas</SelectItem>
                <SelectItem value="Padronização da comunicação e menos erro humano">Padronização da comunicação e menos erro humano</SelectItem>
                <SelectItem value="Aumento da taxa de conversão em vendas e pré-vendas">Aumento da taxa de conversão em vendas e pré-vendas</SelectItem>
                <SelectItem value="Qualificação automática de leads e demandas">Qualificação automática de leads e demandas</SelectItem>
                <SelectItem value="Visibilidade total da operação com métricas, relatórios e dashboards">Visibilidade total da operação com métricas, relatórios e dashboards</SelectItem>
                <SelectItem value="Melhoria da experiência do cliente com respostas rápidas e assertivas">Melhoria da experiência do cliente com respostas rápidas e assertivas</SelectItem>
                <SelectItem value="Monitoramento e análise de ligações para melhoria contínua (qualidade, script, performance)">Monitoramento e análise de ligações para melhoria contínua</SelectItem>
                <SelectItem value="Escalabilidade sem crescer custo proporcionalmente (cresce volume, não cresce folha)">Escalabilidade sem crescer custo proporcionalmente</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Plan & Simulation - Editable */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Plano & Simulação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Plano</Label>
                <Input
                  value={editFields.plan_name}
                  onChange={e => setEditFields(prev => ({ ...prev, plan_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor do Plano (R$)</Label>
                <Input
                  type="number"
                  value={editFields.plan_price}
                  onChange={e => setEditFields(prev => ({ ...prev, plan_price: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contatos estimados</Label>
                <Input
                  type="number"
                  value={editFields.estimated_contacts}
                  onChange={e => setEditFields(prev => ({ ...prev, estimated_contacts: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mensagens estimadas</Label>
                <Input
                  type="number"
                  value={editFields.estimated_messages}
                  onChange={e => setEditFields(prev => ({ ...prev, estimated_messages: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-3 mb-2">
              <Switch
                id="review-show-meta"
                checked={editFields.show_meta_costs}
                onCheckedChange={v => setEditFields(prev => ({ ...prev, show_meta_costs: v }))}
              />
              <Label htmlFor="review-show-meta" className="text-xs cursor-pointer">Incluir custos Meta na proposta</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    Quando desativado, a proposta enviada ao cliente não exibirá a estimativa de custos Meta WhatsApp.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Custo Meta WhatsApp (R$)</Label>
                <Input
                  type="number"
                  value={editFields.meta_cost}
                  onChange={e => setEditFields(prev => ({ ...prev, meta_cost: parseFloat(e.target.value) || 0 }))}
                  disabled={!editFields.show_meta_costs}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Total Mensal (R$)</Label>
                <Input
                  type="number"
                  value={editFields.total_monthly}
                  onChange={e => setEditFields(prev => ({ ...prev, total_monthly: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Método de Pagamento Setup</Label>
                <Select
                  value={editFields.setup_payment_method}
                  onValueChange={v => setEditFields(prev => ({ ...prev, setup_payment_method: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Parcelas Setup</Label>
                <Input
                  type="number"
                  min={1}
                  value={editFields.setup_installments}
                  onChange={e => setEditFields(prev => ({ ...prev, setup_installments: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground">Total Mensal</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(editFields.total_monthly)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Setup Total</p>
                <p className="text-2xl font-bold">{formatCurrency(computedSetupTotal)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Pagamento Setup</p>
                <p className="text-lg font-bold">
                  {editFields.setup_payment_method === 'pix'
                    ? 'Pix à vista'
                    : `${editFields.setup_installments}x ${editFields.setup_payment_method === 'boleto' ? 'Boleto' : 'Cartão'}`}
                </p>
                {editFields.setup_installments > 1 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatCurrency(computedSetupTotal / editFields.setup_installments)}/parcela
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Integrations - Editable */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">Itens de Setup & Integrações</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setEditFields(prev => ({
                    ...prev,
                    integrations: [...prev.integrations, { name: '', price: 0, phase: 1 }],
                  }))}
                >
                  <span className="text-lg leading-none">+</span> Adicionar item
                </Button>
              </div>
              {editFields.integrations.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum item de setup/integração adicionado.</p>
              ) : (
                <div className="space-y-2">
                  {editFields.integrations.map((integ, i) => {
                    const hasDiscount = integ.originalPrice != null && integ.originalPrice > integ.price;
                    const discountPct = integ.originalPrice ? Math.round((1 - integ.price / integ.originalPrice) * 100) : 0;
                    return (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-center">
                        <Input
                          placeholder="Nome do item"
                          value={integ.name}
                          onChange={e => {
                            const updated = [...editFields.integrations];
                            updated[i] = { ...updated[i], name: e.target.value };
                            setEditFields(prev => ({ ...prev, integrations: updated }));
                          }}
                          className="h-8 text-sm"
                        />
                        <Input
                          placeholder="Descrição (opcional)"
                          value={integ.details || ''}
                          onChange={e => {
                            const updated = [...editFields.integrations];
                            updated[i] = { ...updated[i], details: e.target.value };
                            setEditFields(prev => ({ ...prev, integrations: updated }));
                          }}
                          className="h-8 text-sm"
                        />
                        <div className="flex flex-col gap-0.5">
                          <Input
                            type="number"
                            placeholder="Valor"
                            value={integ.price}
                            onChange={e => {
                              const updated = [...editFields.integrations];
                              const newPrice = parseFloat(e.target.value) || 0;
                              updated[i] = { ...updated[i], price: newPrice };
                              if (updated[i].originalPrice && newPrice >= updated[i].originalPrice!) {
                                updated[i] = { ...updated[i], originalPrice: undefined, discountLabel: undefined };
                              }
                              setEditFields(prev => ({ ...prev, integrations: updated }));
                            }}
                            className="h-8 text-sm w-28"
                          />
                          {hasDiscount && (
                            <span className="text-[10px] text-muted-foreground line-through">
                              {formatCurrency(integ.originalPrice!)}
                            </span>
                          )}
                        </div>
                        <div className="relative w-20">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            placeholder="0"
                            value={hasDiscount ? discountPct : ''}
                            onChange={e => {
                              const pct = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                              const updated = [...editFields.integrations];
                              const base = integ.originalPrice || integ.price;
                              if (pct === 0 || e.target.value === '') {
                                updated[i] = { ...updated[i], price: base, originalPrice: undefined, discountLabel: undefined };
                              } else {
                                updated[i] = {
                                  ...updated[i],
                                  originalPrice: base,
                                  price: Math.round(base * (1 - pct / 100) * 100) / 100,
                                  discountLabel: `${pct}%`,
                                };
                              }
                              setEditFields(prev => ({ ...prev, integrations: updated }));
                            }}
                            className="h-8 text-xs pr-6"
                          />
                          <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                        </div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  const updated = [...editFields.integrations];
                                  updated.splice(i + 1, 0, { ...editFields.integrations[i] });
                                  setEditFields(prev => ({ ...prev, integrations: updated }));
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Duplicar item</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                                onClick={() => {
                                  const updated = editFields.integrations.filter((_, idx) => idx !== i);
                                  setEditFields(prev => ({ ...prev, integrations: updated }));
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Remover item</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contractual Terms - Editable */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Termos Contratuais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Prazo contratual (meses)</Label>
                <Input
                  type="number"
                  value={editFields.contract_months}
                  onChange={e => setEditFields(prev => ({ ...prev, contract_months: parseInt(e.target.value) || 12 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Multa rescisão (%)</Label>
                <Input
                  type="number"
                  value={editFields.cancellation_fee_percent}
                  onChange={e => setEditFields(prev => ({ ...prev, cancellation_fee_percent: parseFloat(e.target.value) || 20 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Validade (dias)</Label>
                <Input
                  type="number"
                  value={editFields.validity_days}
                  onChange={e => setEditFields(prev => ({ ...prev, validity_days: parseInt(e.target.value) || 30 }))}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Proposta válida até: {validUntil.toLocaleDateString('pt-BR')}
            </p>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={editFields.notes}
                onChange={e => setEditFields(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas adicionais para a proposta..."
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setConfirmOpen(true)} disabled={saving || !proposal.company_name || proposal.company_name.trim() === '' || proposal.company_name === '—' || !editFields.project_objective}>
                {saving ? 'Gerando...' : 'Salvar e Gerar Proposta'}
              </Button>
            </div>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Gerar proposta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ao confirmar, a proposta será finalizada e ficará disponível para envio ao cliente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSave} disabled={saving}>
                    {saving ? 'Gerando...' : 'Confirmar'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default ProposalReviewPage;
