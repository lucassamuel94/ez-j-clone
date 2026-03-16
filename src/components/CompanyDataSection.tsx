import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lead } from '@/types/lead';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Globe, MapPin, Users, DollarSign, Search, Loader2, ExternalLink, BadgeCheck, Landmark, Hash, Phone, ChevronDown, Sparkles, Link2, Copy, PhoneCall, ClipboardCheck } from 'lucide-react';
import { WhatsAppIcon } from './icons/WhatsAppIcon';

import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { checkCnpjDuplicate } from '@/services/leadService';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { CompanySearch } from '@/components/CompanySearch';
import { CnpjaResult } from '@/hooks/useCnpjaSearch';

// Employee count options
// Brazilian states
const STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

interface CompanyDataSectionProps {
  lead: Lead;
  onUpdateLead: (lead: Lead) => void;
}

// CNPJ mask helper
const formatCNPJ = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

// CEP mask helper
const formatCEP = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

// Format capital social
const formatCurrency = (value: number | undefined): string => {
  if (value === undefined || value === null) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// Map porte from BrasilAPI
const mapPorte = (porte: string): string => {
  const map: Record<string, string> = {
    'ME': 'Microempresa',
    'EPP': 'Empresa de Pequeno Porte',
    'DEMAIS': 'Demais',
  };
  return map[porte] || porte || '';
};

// Map situacao_cadastral
const mapSituacao = (codigo: number): string => {
  const map: Record<number, string> = {
    1: 'Nula',
    2: 'Ativa',
    3: 'Suspensa',
    4: 'Inapta',
    8: 'Baixada',
  };
  return map[codigo] || `Código ${codigo}`;
};

// Format phone from BrasilAPI (ddd + number)
const formatPhoneFromApi = (dddPhone: string): string => {
  if (!dddPhone) return '';
  const digits = dddPhone.replace(/\D/g, '');
  if (digits.length < 10) return dddPhone;
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length === 9) {
    return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
  }
  return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
};

// Section wrapper component
const SectionCard = ({ icon, title, children, badge }: { icon: React.ReactNode; title: string; children: React.ReactNode; badge?: React.ReactNode }) => (
  <div className="rounded-lg border bg-card overflow-hidden">
    <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary">
          {icon}
        </span>
        <span className="text-xs font-medium">{title}</span>
      </div>
      {badge}
    </div>
    <div className="p-3 space-y-2">{children}</div>
  </div>
);

// Enrichment row helper
const EnrichRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start gap-2 text-xs">
    <span className="font-medium text-foreground min-w-[80px] shrink-0">{label}:</span>
    <span className="text-foreground">{value}</span>
  </div>
);

// Compact input row
const CompactInput = ({ label, value, onChange, placeholder, className, readOnly = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; className?: string; readOnly?: boolean;
}) => (
  <div className={cn("flex items-center gap-2", className)}>
    <Label className="text-xs text-muted-foreground whitespace-nowrap min-w-[80px] flex-shrink-0">{label}</Label>
    <div className="flex-1 rounded-md border bg-card transition-all hover:border-primary/50 focus-within:border-primary">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={cn("h-8 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0", readOnly && "text-muted-foreground")}
      />
    </div>
  </div>
);

export const CompanyDataSection = ({ lead, onUpdateLead }: CompanyDataSectionProps) => {
  // Checkout registration query
  const leadCnpjDigits = lead.cnpj?.replace(/\D/g, '') || '';
  const { data: checkoutData } = useQuery({
    queryKey: ['checkout-session-company', leadCnpjDigits],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkout_sessions')
        .select('*')
        .eq('cnpj', leadCnpjDigits)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: leadCnpjDigits.length >= 14,
    staleTime: 60_000,
  });

  const fmtCpf = (v: string | null) => {
    if (!v) return '';
    const d = v.replace(/\D/g, '').slice(0, 11);
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  };
  
  const [isLoadingCNPJ, setIsLoadingCNPJ] = useState(false);
  const [isLoadingCEP, setIsLoadingCEP] = useState(false);
  const [cnpjDuplicateError, setCnpjDuplicateError] = useState('');
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentData, setEnrichmentData] = useState<any>(lead.ai_enrichment_data || null);
  const [enrichmentCitations, setEnrichmentCitations] = useState<string[]>(lead.ai_enrichment_data?.citations || []);
  
  const [localCnpj, setLocalCnpj] = useState(lead.cnpj || '');
  const [localCep, setLocalCep] = useState(lead.cep || '');

  const handleCnpjaSelect = (result: CnpjaResult) => {
    const updates: Partial<Lead> = {
      cnpj: result.cnpj,
      razao_social: result.razao_social || lead.razao_social,
      nome_fantasia: result.nome_fantasia || lead.nome_fantasia,
      porte: result.porte || lead.porte,
      capital_social: result.capital_social ?? lead.capital_social,
      cnae_fiscal: result.cnae_fiscal ?? lead.cnae_fiscal,
      cnae_fiscal_descricao: result.cnae_fiscal_descricao || lead.cnae_fiscal_descricao,
      cnaes_secundarios: result.cnaes_secundarios || lead.cnaes_secundarios,
      situacao_cadastral: result.situacao_cadastral || lead.situacao_cadastral,
      data_inicio_atividade: result.data_inicio_atividade || lead.data_inicio_atividade,
      logradouro: result.logradouro || lead.logradouro,
      numero: result.numero || (lead as any).numero,
      complemento: result.complemento || (lead as any).complemento,
      bairro: result.bairro || lead.bairro,
      city: result.city || lead.city,
      state: result.state || lead.state,
      cep: result.cep || lead.cep,
    };
    if (result.phone && !lead.phone) (updates as any).phone = result.phone;
    if (result.phone_2 && !lead.phone_2) (updates as any).phone_2 = result.phone_2;
    if (result.email && !lead.email) (updates as any).email = result.email;
    // Auto-fill company_segment from cnae_fiscal_descricao if empty
    if (result.cnae_fiscal_descricao && !lead.company_segment) {
      updates.company_segment = result.cnae_fiscal_descricao;
    }

    onUpdateLead({ ...lead, ...updates } as Lead);
    setLocalCnpj(result.cnpj || '');
    if (result.cep) setLocalCep(result.cep);

    const filledCount = Object.values(updates).filter(Boolean).length;
    toast.success(`Empresa selecionada! ${filledCount} campos preenchidos.`);
  };
  
  useEffect(() => {
    const leadCnpj = lead.cnpj || '';
    if (leadCnpj !== localCnpj.replace(/\D/g, '') && leadCnpj !== localCnpj) {
      setLocalCnpj(leadCnpj);
    }
  }, [lead.cnpj]);

  useEffect(() => {
    const leadCep = lead.cep || '';
    if (leadCep !== localCep.replace(/\D/g, '') && leadCep !== localCep) {
      setLocalCep(leadCep);
    }
  }, [lead.cep]);

  const handleFieldChange = (field: string, value: string | number | undefined) => {
    onUpdateLead({ ...lead, [field]: value } as Lead);
  };

  const handleCNPJChange = (value: string) => {
    const formatted = formatCNPJ(value);
    setLocalCnpj(formatted);
    setCnpjDuplicateError('');
    handleFieldChange('cnpj', formatted);
    const cleanCNPJ = formatted.replace(/\D/g, '');
    if (cleanCNPJ.length === 14) {
      fetchCNPJDataAuto(formatted);
    }
  };

  const validateCnpjUniqueness = async (cnpjValue: string): Promise<boolean> => {
    const cleanCNPJ = cnpjValue.replace(/\D/g, '');
    if (cleanCNPJ.length !== 14) return true;
    const result = await checkCnpjDuplicate(cnpjValue, lead.id);
    if (result.isDuplicate) {
      const msg = `CNPJ já cadastrado no lead "${result.existingLeadName}" (${result.existingLeadCompany})`;
      setCnpjDuplicateError(msg);
      toast.error(msg);
      return false;
    }
    setCnpjDuplicateError('');
    return true;
  };

  const handleCNPJBlur = async () => {
    const cleanCNPJ = localCnpj.replace(/\D/g, '');
    if (cleanCNPJ.length === 14) {
      await validateCnpjUniqueness(localCnpj);
    }
  };

  const fetchCNPJDataFromValue = useCallback(async (cnpjValue: string) => {
    const cleanCNPJ = cnpjValue.replace(/\D/g, '');
    if (cleanCNPJ.length !== 14) {
      toast.error('CNPJ inválido. Digite 14 dígitos.');
      return;
    }

    const isUnique = await validateCnpjUniqueness(cnpjValue);
    if (!isUnique) return;

    setIsLoadingCNPJ(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
      if (!response.ok) throw new Error('CNPJ não encontrado');
      const data = await response.json();

      // Map CNAE to segment (use the main CNAE description)
      const cnaeDescricao = data.cnae_fiscal_descricao || '';

      const updates: Partial<Lead> = {
        razao_social: data.razao_social || '',
        nome_fantasia: data.nome_fantasia || '',
        porte: mapPorte(data.porte),
        capital_social: data.capital_social ?? undefined,
        cnae_fiscal: data.cnae_fiscal ?? undefined,
        cnae_fiscal_descricao: cnaeDescricao,
        cnaes_secundarios: Array.isArray(data.cnaes_secundarios)
          ? data.cnaes_secundarios
              .filter((c: any) => c.codigo && c.codigo !== 0)
              .map((c: any) => `${c.codigo} - ${c.descricao}`)
              .join('; ')
          : '',
        situacao_cadastral: data.descricao_situacao_cadastral || (data.situacao_cadastral ? mapSituacao(data.situacao_cadastral) : ''),
        data_inicio_atividade: data.data_inicio_atividade || '',
        qsa: Array.isArray(data.qsa)
          ? data.qsa
              .filter((s: any) => s.nome_socio)
              .map((s: any) => `${s.nome_socio} (${s.qualificacao_socio || 'Sócio'})`)
              .join('; ')
          : '',
        // Address
        cep: data.cep ? formatCEP(data.cep) : lead.cep,
        logradouro: data.logradouro || lead.logradouro,
        numero: data.numero || (lead as any).numero || '',
        complemento: data.complemento || (lead as any).complemento || '',
        bairro: data.bairro || lead.bairro,
        city: data.municipio || lead.city,
        state: data.uf || lead.state,
        country: 'Brasil',
        // Website from email domain if available
        website: lead.website || '',
        // Auto-fill company_segment from cnae_fiscal_descricao if empty
        ...(cnaeDescricao && !lead.company_segment ? { company_segment: cnaeDescricao } : {}),
      };

      // Fill phone fields if empty
      if (!lead.phone && data.ddd_telefone_1) {
        (updates as any).phone = formatPhoneFromApi(data.ddd_telefone_1);
      }
      if (!lead.phone_2 && data.ddd_telefone_2) {
        (updates as any).phone_2 = formatPhoneFromApi(data.ddd_telefone_2);
      }
      // Fill email if empty
      if (!lead.email && data.email) {
        (updates as any).email = data.email;
      }

      onUpdateLead({ ...lead, ...updates, cnpj: cnpjValue } as Lead);
      
      // Update local CEP state
      if (data.cep) {
        setLocalCep(formatCEP(data.cep));
      }

      const filledCount = Object.values(updates).filter(Boolean).length;
      toast.success(`Dados carregados! ${filledCount} campos preenchidos.`);
    } catch {
      toast.error('Erro ao buscar dados do CNPJ.');
    } finally {
      setIsLoadingCNPJ(false);
    }
  }, [lead, onUpdateLead]);

  const fetchCNPJData = () => fetchCNPJDataFromValue(localCnpj);
  const fetchCNPJDataAuto = (formatted: string) => fetchCNPJDataFromValue(formatted);

  const fetchCEPData = useCallback(async (cepValue: string) => {
    const cleanCEP = cepValue.replace(/\D/g, '');
    if (cleanCEP.length !== 8) return;
    setIsLoadingCEP(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      if (!response.ok) throw new Error('CEP não encontrado');
      const data = await response.json();
      if (data.erro) throw new Error('CEP não encontrado');
      onUpdateLead({
        ...lead,
        cep: cepValue,
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || '',
        complemento: data.complemento || (lead as any).complemento || '',
      } as Lead);
      toast.success('Endereço carregado!');
    } catch {
      toast.error('Erro ao buscar CEP.');
    } finally {
      setIsLoadingCEP(false);
    }
  }, [lead, onUpdateLead]);

  const handleCEPChange = (value: string) => {
    const formatted = formatCEP(value);
    setLocalCep(formatted);
    handleFieldChange('cep', formatted);
    const cleanCEP = formatted.replace(/\D/g, '');
    if (cleanCEP.length === 8) {
      fetchCEPData(formatted);
    }
  };

  const handleManualCEPFetch = () => {
    const cleanCEP = localCep.replace(/\D/g, '');
    if (cleanCEP.length !== 8) {
      toast.error('CEP inválido. Digite 8 dígitos.');
      return;
    }
    fetchCEPData(localCep);
  };

  const openWebsite = () => {
    if (lead.website) {
      const url = lead.website.startsWith('http') ? lead.website : `https://${lead.website}`;
      window.open(url, '_blank');
    }
  };

  const handleEnrichWithAI = async () => {
    if (!lead.cnpj && !lead.company && !lead.razao_social) {
      toast.error('Preencha o CNPJ ou nome da empresa antes de enriquecer.');
      return;
    }
    setIsEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-company', {
        body: {
          cnpj: lead.cnpj,
          company_name: lead.company,
          razao_social: lead.razao_social,
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      const enrichment = data?.enrichment || {};
      const citations = data?.citations || [];
      setEnrichmentData(enrichment);
      setEnrichmentCitations(citations);

      // Auto-fill empty fields + persist AI data
      const updates: Partial<Lead> = {
        ai_enrichment_data: { ...enrichment, citations } as any,
      };
      if (!lead.company_segment && enrichment.company_segment) updates.company_segment = enrichment.company_segment;
      if (!lead.employee_count && enrichment.employee_count) updates.employee_count = enrichment.employee_count;
      if (!lead.revenue_range && enrichment.revenue_range) updates.revenue_range = enrichment.revenue_range;
      if (!lead.website && enrichment.website) updates.website = enrichment.website;
      if (!lead.phone && enrichment.phone) (updates as any).phone = enrichment.phone;
      if (!lead.phone_2 && enrichment.phone_2) (updates as any).phone_2 = enrichment.phone_2;
      if (!lead.whatsapp && enrichment.whatsapp) (updates as any).whatsapp = enrichment.whatsapp;
      if (!lead.email && enrichment.email) (updates as any).email = enrichment.email;

      onUpdateLead({ ...lead, ...updates } as Lead);
      const autoFilled = Object.keys(updates).length - 1; // subtract ai_enrichment_data
      if (autoFilled > 0) {
        toast.success(`Enriquecido! ${autoFilled} campos preenchidos automaticamente.`);
      } else {
        toast.success('Dados encontrados e salvos!');
      }
    } catch (e) {
      console.error('Enrichment error:', e);
      toast.error('Erro ao enriquecer dados com IA.');
    } finally {
      setIsEnriching(false);
    }
  };

  // Count filled fields for progress
  const requiredFields = [lead.cnpj, lead.razao_social];
  const requiredFilledCount = requiredFields.filter(Boolean).length;
  const totalOptionalFields = [
    lead.nome_fantasia, lead.porte, lead.capital_social,
    lead.cnae_fiscal_descricao,
    lead.cep, lead.city, lead.state, lead.website,
  ];
  const optionalFilledCount = totalOptionalFields.filter(Boolean).length;
  const totalFilled = requiredFilledCount + optionalFilledCount;
  const totalFields = requiredFields.length + totalOptionalFields.length;

  // Situação badge color
  const situacaoLower = (lead.situacao_cadastral || '').toLowerCase();
  const situacaoBadge = lead.situacao_cadastral ? (
    <Badge variant="outline" className={cn(
      "text-[10px] h-5",
      situacaoLower === 'ativa' ? 'border-success/40 text-success bg-success/10' :
      ['baixada', 'inapta', 'suspensa', 'nula'].includes(situacaoLower) ? 'border-destructive/40 text-destructive bg-destructive/10' :
      'border-muted-foreground/40 text-muted-foreground'
    )}>
      {lead.situacao_cadastral}
    </Badge>
  ) : null;

  return (
    <div className="space-y-4">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium flex items-center gap-1.5">
          <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
            <Building2 className="h-3.5 w-3.5 text-primary" />
          </div>
          Dados da Empresa
        </h3>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[...Array(totalFields)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 w-2.5 rounded-full transition-colors",
                  i < totalFilled ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{totalFilled}/{totalFields}</span>
        </div>
      </div>

      {/* ===== IDENTIFICAÇÃO (Colapsável - fechado por padrão) ===== */}
      <Collapsible>
        <div className="rounded-lg border bg-card overflow-hidden">
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 border-b bg-muted/30 hover:bg-muted/50 transition-colors group">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary">
                <BadgeCheck className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-medium">Identificação</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-3 space-y-2">
        {/* Search by name via CNPJá */}
        {!lead.cnpj && (
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Buscar por nome (CNPJá)</Label>
            <CompanySearch onSelect={handleCnpjaSelect} placeholder="Buscar empresa por nome..." />
          </div>
        )}

        {/* CNPJ */}
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">
            CNPJ <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-1.5">
            <div className={cn(
              "flex-1 rounded-md border bg-card transition-all hover:border-primary/50 focus-within:border-primary",
              cnpjDuplicateError && "border-destructive hover:border-destructive focus-within:border-destructive"
            )}>
              <Input
                value={localCnpj}
                onChange={(e) => handleCNPJChange(e.target.value)}
                onBlur={handleCNPJBlur}
                placeholder="00.000.000/0000-00"
                className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleEnrichWithAI}
              disabled={isEnriching || (!lead.cnpj && !lead.company && !lead.razao_social)}
              className="h-8 w-8 shrink-0"
              title="Enriquecer dados com IA"
            >
              {isEnriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={fetchCNPJData}
              disabled={isLoadingCNPJ}
              className="h-8 w-8 shrink-0"
              title="Buscar dados na Receita Federal"
            >
              {isLoadingCNPJ ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {cnpjDuplicateError && (
            <p className="text-xs text-destructive">{cnpjDuplicateError}</p>
          )}
        </div>

        {/* Razão Social */}
        <CompactInput
          label="Razão Social *"
          value={lead.razao_social || ''}
          onChange={(v) => handleFieldChange('razao_social', v)}
          placeholder="Razão social da empresa"
        />


        <CompactInput
          label="Nome Fantasia"
          value={lead.nome_fantasia || ''}
          onChange={(v) => handleFieldChange('nome_fantasia', v)}
          placeholder="Nome fantasia"
        />

        {/* Situação Cadastral + Data Início */}
        {(lead.situacao_cadastral || lead.data_inicio_atividade) && (
          <div className="grid grid-cols-2 gap-1.5">
            {lead.situacao_cadastral && (
              <CompactInput
                label="Situação"
                value={lead.situacao_cadastral}
                onChange={() => {}}
                placeholder=""
                readOnly
              />
            )}
            {lead.data_inicio_atividade && (
              <CompactInput
                label="Início"
                value={lead.data_inicio_atividade.split('-').reverse().join('/')}
                onChange={() => {}}
                placeholder=""
                readOnly
              />
            )}
          </div>
        )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* ===== DADOS DA IA ===== */}
      {enrichmentData && (
        <div className="space-y-2">

            <Collapsible>
              <div className="rounded-lg border bg-card overflow-hidden">
                <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 border-b bg-muted/30 hover:bg-muted/50 transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-medium">Dados encontrados pela IA</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-3 space-y-2">
                    {/* Description */}
                    {enrichmentData.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 rounded-lg p-3 border border-border/50">
                        {enrichmentData.description}
                      </p>
                    )}

                    {/* Key Info Grid */}
                    {(enrichmentData.company_segment || enrichmentData.products_services || enrichmentData.technologies_used || enrichmentData.website) && (
                      <div className="grid gap-2 min-w-0 overflow-hidden">
                        {enrichmentData.company_segment && (
                          <div className="flex items-start gap-3 text-xs">
                            <span className="font-semibold text-foreground min-w-[90px] shrink-0">Segmento:</span>
                            <span className="text-muted-foreground">{enrichmentData.company_segment}</span>
                          </div>
                        )}
                        {enrichmentData.products_services && (
                          <div className="flex items-start gap-3 text-xs">
                            <span className="font-semibold text-foreground min-w-[90px] shrink-0">Produtos:</span>
                            <span className="text-muted-foreground">{enrichmentData.products_services}</span>
                          </div>
                        )}
                        {enrichmentData.technologies_used && (
                          <div className="flex items-start gap-3 text-xs">
                            <span className="font-semibold text-foreground min-w-[90px] shrink-0">Tecnologias:</span>
                            <span className="text-muted-foreground">{enrichmentData.technologies_used}</span>
                          </div>
                        )}
                        {enrichmentData.employee_count && (
                          <div className="flex items-start gap-3 text-xs">
                            <span className="font-semibold text-foreground min-w-[90px] shrink-0">Funcionários:</span>
                            <span className="text-muted-foreground">{enrichmentData.employee_count}</span>
                          </div>
                        )}
                        {enrichmentData.revenue_range && (
                          <div className="flex items-start gap-3 text-xs">
                            <span className="font-semibold text-foreground min-w-[90px] shrink-0">Faturamento:</span>
                            <span className="text-muted-foreground">{enrichmentData.revenue_range}</span>
                          </div>
                        )}
                        {enrichmentData.target_market && (
                          <div className="flex items-start gap-3 text-xs">
                            <span className="font-semibold text-foreground min-w-[90px] shrink-0">Público-alvo:</span>
                            <span className="text-muted-foreground">{enrichmentData.target_market}</span>
                          </div>
                        )}
                        {enrichmentData.main_competitors && (
                          <div className="flex items-start gap-3 text-xs">
                            <span className="font-semibold text-foreground min-w-[90px] shrink-0">Concorrentes:</span>
                            <span className="text-muted-foreground">{enrichmentData.main_competitors}</span>
                          </div>
                        )}
                        {enrichmentData.founded_year && (
                          <div className="flex items-start gap-3 text-xs">
                            <span className="font-semibold text-foreground min-w-[90px] shrink-0">Fundação:</span>
                            <span className="text-muted-foreground">{enrichmentData.founded_year}</span>
                          </div>
                        )}
                        {enrichmentData.website && (
                          <div className="flex items-start gap-3 text-xs min-w-0">
                            <span className="font-semibold text-foreground min-w-[90px] shrink-0">Site:</span>
                            <a href={enrichmentData.website.startsWith('http') ? enrichmentData.website : `https://${enrichmentData.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate min-w-0">
                              {enrichmentData.website}
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Social Media Links */}
                    {(enrichmentData.linkedin || enrichmentData.instagram || enrichmentData.facebook || enrichmentData.youtube || enrichmentData.twitter) && (
                      <div className="pt-2 border-t border-primary/10">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Redes Sociais</span>
                        <div className="flex flex-wrap gap-1.5">
                          {enrichmentData.linkedin && (
                            <a href={enrichmentData.linkedin} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:bg-primary/10 bg-primary/5 rounded-md px-2.5 py-1.5 border border-primary/15 transition-colors">
                              LinkedIn <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {enrichmentData.instagram && (
                            <a href={enrichmentData.instagram} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:bg-primary/10 bg-primary/5 rounded-md px-2.5 py-1.5 border border-primary/15 transition-colors">
                              Instagram <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {enrichmentData.facebook && (
                            <a href={enrichmentData.facebook} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:bg-primary/10 bg-primary/5 rounded-md px-2.5 py-1.5 border border-primary/15 transition-colors">
                              Facebook <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {enrichmentData.youtube && (
                            <a href={enrichmentData.youtube} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:bg-primary/10 bg-primary/5 rounded-md px-2.5 py-1.5 border border-primary/15 transition-colors">
                              YouTube <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {enrichmentData.twitter && (
                            <a href={enrichmentData.twitter} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:bg-primary/10 bg-primary/5 rounded-md px-2.5 py-1.5 border border-primary/15 transition-colors">
                              X/Twitter <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Legacy social_media field */}
                    {enrichmentData.social_media && !enrichmentData.linkedin && (
                      <EnrichRow label="Social" value={enrichmentData.social_media} />
                    )}

                    {/* Citations / Sources */}
                    {enrichmentCitations.length > 0 && (
                      <div className="pt-2 border-t border-primary/10">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                          <Link2 className="h-3 w-3" /> Fontes
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {enrichmentCitations.slice(0, 5).map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                              className="text-[11px] text-primary hover:bg-primary/10 rounded-md px-2 py-1 border border-border/50 transition-colors truncate max-w-[180px]">
                              {new URL(url).hostname}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
        </div>
      )}


      {/* ===== SÓCIOS (QSA) - Colapsável ===== */}
      {lead.qsa && (
        <Collapsible>
          <div className="rounded-lg border bg-card overflow-hidden">
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 border-b bg-muted/30 hover:bg-muted/50 transition-colors group">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary">
                  <Users className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-medium">Sócios</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-3 space-y-1">
                {(() => {
                  // Try parsing as JSON array first
                  try {
                    const parsed = JSON.parse(lead.qsa);
                    if (Array.isArray(parsed)) {
                      return parsed.map((s: any, i: number) => {
                        const nome = s.nome_socio || s.nome || '';
                        const qual = s.qualificacao_socio || s.qual || 'Sócio';
                        const faixa = s.faixa_etaria || '';
                        return (
                          <p key={i} className="text-xs text-foreground">
                            • {nome} ({qual}){faixa ? ` — ${faixa}` : ''}
                          </p>
                        );
                      });
                    }
                  } catch {}
                  // Fallback: semicolon-separated
                  return lead.qsa.split('; ').filter(Boolean).map((socio, i) => (
                    <p key={i} className="text-xs text-foreground">• {socio}</p>
                  ));
                })()}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* ===== ATIVIDADE ECONÔMICA (Colapsável) ===== */}
      <Collapsible>
        <div className="rounded-lg border bg-card overflow-hidden">
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 border-b bg-muted/30 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary">
                <Hash className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-medium">Atividade Econômica</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-3 space-y-2">
              {(lead.cnae_fiscal || lead.cnae_fiscal_descricao) && (
                <CompactInput
                  label="CNAE"
                  value={lead.cnae_fiscal ? `${lead.cnae_fiscal} - ${lead.cnae_fiscal_descricao || ''}` : lead.cnae_fiscal_descricao || ''}
                  onChange={() => {}}
                  placeholder=""
                  readOnly
                />
              )}

              {lead.cnaes_secundarios && (
                <div className="flex gap-2 items-start">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap min-w-[80px] flex-shrink-0 pt-2">Sub-CNAEs</Label>
                  <div className="flex-1 rounded-md border border-input bg-background px-3 py-2 space-y-0.5">
                    {(() => {
                      const raw = lead.cnaes_secundarios;
                      let items: string[] = [];
                      try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) {
                          items = parsed.map((c: { codigo?: number; descricao?: string; id?: number; text?: string }) => 
                            `${c.codigo || c.id || ''} - ${c.descricao || c.text || ''}`
                          ).filter(Boolean);
                        }
                      } catch {
                        items = raw.split('; ').filter(Boolean);
                      }
                      return items.map((cnae, i) => (
                        <p key={i} className="text-[11px] text-muted-foreground/80 leading-relaxed">
                          • {cnae}
                        </p>
                      ));
                    })()}
                  </div>
                </div>
              )}

              <CompactInput
                label="Segmento"
                value={lead.company_segment || ''}
                onChange={(v) => handleFieldChange('company_segment', v)}
                placeholder="Ex: Tecnologia, Varejo, Saúde"
              />

              <CompactInput
                label="Porte"
                value={lead.porte || ''}
                onChange={(v) => handleFieldChange('porte', v)}
                placeholder="Ex: Microempresa, EPP, Demais"
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* ===== CAPITAL SOCIAL (Colapsável) ===== */}
      {lead.capital_social ? (
        <Collapsible>
          <div className="rounded-lg border bg-card overflow-hidden">
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 border-b bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary">
                  <DollarSign className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-medium">Capital Social</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-3">
                <CompactInput
                  label="Capital Social"
                  value={formatCurrency(lead.capital_social)}
                  onChange={() => {}}
                  placeholder="Preenchido automaticamente via CNPJ"
                  readOnly
                />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ) : null}

      {/* ===== ENDEREÇO (Colapsável) ===== */}
      <Collapsible>
        <div className="rounded-lg border bg-card overflow-hidden">
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 border-b bg-muted/30 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary">
                <MapPin className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-medium">Endereço</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-3 space-y-2">
              {/* CEP */}
              <div className="flex gap-1.5">
                <div className="flex-1 rounded-md border bg-card transition-all hover:border-primary/50 focus-within:border-primary">
                  <Input
                    value={localCep}
                    onChange={(e) => handleCEPChange(e.target.value)}
                    placeholder="CEP"
                    className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <Button
                  type="button" variant="outline" size="icon"
                  onClick={handleManualCEPFetch} disabled={isLoadingCEP}
                  className="h-8 w-8 shrink-0" title="Buscar endereço"
                >
                  {isLoadingCEP ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                </Button>
              </div>

              {/* Logradouro + Número */}
              <div className="grid grid-cols-4 gap-1.5">
                <div className="col-span-3 rounded-md border bg-card transition-all hover:border-primary/50 focus-within:border-primary">
                  <Input
                    value={lead.logradouro || ''}
                    onChange={(e) => handleFieldChange('logradouro', e.target.value)}
                    placeholder="Logradouro"
                    className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <div className="rounded-md border bg-card transition-all hover:border-primary/50 focus-within:border-primary">
                  <Input
                    value={(lead as any).numero || ''}
                    onChange={(e) => handleFieldChange('numero', e.target.value)}
                    placeholder="Nº"
                    className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>

              {/* Complemento */}
              <div className="rounded-md border bg-card transition-all hover:border-primary/50 focus-within:border-primary">
                <Input
                  value={(lead as any).complemento || ''}
                  onChange={(e) => handleFieldChange('complemento', e.target.value)}
                  placeholder="Complemento"
                  className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>

              {/* Bairro + Cidade + UF */}
              <div className="grid grid-cols-6 gap-1.5">
                <div className="col-span-2 rounded-md border bg-card transition-all hover:border-primary/50 focus-within:border-primary">
                  <Input
                    value={lead.bairro || ''}
                    onChange={(e) => handleFieldChange('bairro', e.target.value)}
                    placeholder="Bairro"
                    className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <div className="col-span-3 rounded-md border bg-card transition-all hover:border-primary/50 focus-within:border-primary">
                  <Input
                    value={lead.city || ''}
                    onChange={(e) => handleFieldChange('city', e.target.value)}
                    placeholder="Cidade"
                    className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <Select value={lead.state || ''} onValueChange={(v) => handleFieldChange('state', v)}>
                  <SelectTrigger className={cn("bg-card border h-8 text-xs", lead.state ? "border-primary/20" : "border-input")}>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover max-h-60">
                    {STATES.map((uf) => (
                      <SelectItem key={uf} value={uf} className="text-xs">{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>


      <Collapsible>
        <div className="rounded-lg border bg-card overflow-hidden">
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 border-b bg-muted/30 hover:bg-muted/50 transition-colors group">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary">
                <Globe className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-medium">Site</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-3">
              <div className="flex gap-1.5">
                <div className="flex-1 rounded-md border bg-card transition-all hover:border-primary/50 focus-within:border-primary">
                  <Input
                    value={lead.website || ''}
                    onChange={(e) => handleFieldChange('website', e.target.value)}
                    placeholder="https://www.exemplo.com.br"
                    className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                {lead.website && (
                  <Button type="button" variant="outline" size="icon" onClick={openWebsite} className="h-8 w-8 shrink-0" title="Abrir site">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Cadastro Contratual (checkout) */}
      {checkoutData && (
        <Collapsible>
          <div className="rounded-lg border bg-card overflow-hidden">
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 border-b bg-muted/30 hover:bg-muted/50 transition-colors group">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-medium">Cadastro Contratual</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {new Date(checkoutData.created_at).toLocaleDateString('pt-BR')}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-3 space-y-4">
                {/* Dados da Empresa */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dados da Empresa</p>
                  <div className="space-y-1">
                    <EnrichRow label="Razão Social" value={checkoutData.razao_social || ''} />
                    <EnrichRow label="Nome Fantasia" value={checkoutData.nome_fantasia || ''} />
                    <EnrichRow label="CNPJ" value={formatCNPJ(checkoutData.cnpj || '')} />
                    {checkoutData.cep && <EnrichRow label="CEP" value={formatCEP(checkoutData.cep)} />}
                    {checkoutData.logradouro && <EnrichRow label="Logradouro" value={`${checkoutData.logradouro}${checkoutData.numero ? `, ${checkoutData.numero}` : ''}${checkoutData.complemento ? ` - ${checkoutData.complemento}` : ''}`} />}
                    {checkoutData.bairro && <EnrichRow label="Bairro" value={checkoutData.bairro} />}
                    {(checkoutData.city || checkoutData.state) && <EnrichRow label="Cidade/UF" value={[checkoutData.city, checkoutData.state].filter(Boolean).join(' / ')} />}
                  </div>
                </div>

                {/* Representante Legal */}
                {checkoutData.rep_name && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Representante Legal</p>
                    <div className="space-y-1">
                      <EnrichRow label="Nome" value={checkoutData.rep_name} />
                      {checkoutData.rep_cpf && <EnrichRow label="CPF" value={fmtCpf(checkoutData.rep_cpf)} />}
                      {checkoutData.rep_role && <EnrichRow label="Cargo" value={checkoutData.rep_role} />}
                      {checkoutData.rep_email && <EnrichRow label="E-mail" value={checkoutData.rep_email} />}
                      {checkoutData.rep_phone && <EnrichRow label="Telefone" value={checkoutData.rep_phone} />}
                    </div>
                  </div>
                )}

                {/* Responsável Financeiro */}
                {checkoutData.fin_name && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Responsável Financeiro</p>
                    <div className="space-y-1">
                      <EnrichRow label="Nome" value={checkoutData.fin_name} />
                      {checkoutData.fin_email && <EnrichRow label="E-mail" value={checkoutData.fin_email} />}
                      {checkoutData.fin_phone && <EnrichRow label="Telefone" value={checkoutData.fin_phone} />}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}
    </div>
  );
};

// Helper to check if key company data fields are filled
export const isCompanyDataComplete = (lead: Lead): boolean => {
  return Boolean(lead.cnpj && lead.razao_social && lead.company_segment);
};

// Helper to get missing company data field names
export const getMissingCompanyDataFields = (lead: Lead): string[] => {
  const missing: string[] = [];
  if (!lead.cnpj) missing.push('CNPJ');
  if (!lead.razao_social) missing.push('Razão Social');
  return missing;
};
