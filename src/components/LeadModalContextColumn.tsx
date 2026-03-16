import { useMemo } from 'react';
import { Lead } from '@/types/lead';
import { LeadAISummary } from './LeadAISummary';
import { CompanyDataSection } from './CompanyDataSection';
import { CompanyInfoSection } from './CompanyInfoSection';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Building2, Users, Activity, MapPin, Globe, Sparkles, ClipboardList, ClipboardCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDateBR } from '@/utils/dateFormat';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface LeadModalContextColumnProps {
  lead: Lead;
  onUpdateLead: (lead: Lead) => void;
  readOnlyQualification?: boolean;
}

interface CollapsibleBlockProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleBlock = ({ title, icon, defaultOpen = false, children }: CollapsibleBlockProps) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border bg-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-5 w-5 rounded bg-primary/10 text-primary">
                {icon}
              </span>
              <span className="text-xs font-medium">{title}</span>
            </div>
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// Helper row
const InfoRow = ({ label, value }: { label: string; value: string | undefined | null }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-[10px] py-1">
      <span className="font-medium text-muted-foreground min-w-[90px] shrink-0">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
};

export const LeadModalContextColumn = ({ lead, onUpdateLead, readOnlyQualification = false }: LeadModalContextColumnProps) => {
  // Format helpers
  const fmtCnpj = (v: string | null) => {
    if (!v) return '';
    const d = v.replace(/\D/g, '').slice(0, 14);
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };
  const fmtCpf = (v: string | null) => {
    if (!v) return '';
    const d = v.replace(/\D/g, '').slice(0, 11);
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  };

  // Fetch checkout registration by CNPJ
  const leadCnpjDigits = lead.cnpj?.replace(/\D/g, '') || '';
  const { data: checkoutData } = useQuery({
    queryKey: ['checkout-session-lead', leadCnpjDigits],
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
  // Memoize QSA and CNAE parsing to avoid re-parsing JSON on every render
  const partners = useMemo(() => {
    if (!lead.qsa) return [];
    try {
      const parsed = JSON.parse(lead.qsa);
      if (Array.isArray(parsed)) {
        return parsed.map((p: any) => ({
          nome: p.nome_socio || p.nome || '',
          qual: p.qualificacao_socio || p.faixa_etaria || '',
        }));
      }
    } catch {}
    return lead.qsa.split('; ').filter(Boolean).map(s => ({ nome: s, qual: '' }));
  }, [lead.qsa]);

  const cnaes = useMemo(() => {
    if (!lead.cnaes_secundarios) return [];
    try {
      const parsed = JSON.parse(lead.cnaes_secundarios);
      if (Array.isArray(parsed)) {
        return parsed.map((c: any) => ({
          codigo: String(c.codigo || ''),
          descricao: c.descricao || '',
        }));
      }
    } catch {}
    return lead.cnaes_secundarios.split('; ').filter(Boolean).map(s => ({ codigo: '', descricao: s }));
  }, [lead.cnaes_secundarios]);

  return (
    <div className="space-y-3 p-4 overflow-auto">
      {/* 1. AI Summary (expanded) */}
      <CollapsibleBlock title="Resumo Inteligente da IA" icon={<Sparkles className="h-3 w-3" />}>
        <LeadAISummary lead={lead} onUpdateLead={onUpdateLead} />
      </CollapsibleBlock>

      {/* 2. Company Data - Editable */}
      <CollapsibleBlock title="Dados da Empresa" icon={<Building2 className="h-3 w-3" />}>
        <CompanyDataSection lead={lead} onUpdateLead={onUpdateLead} />
      </CollapsibleBlock>

      {/* 2.5. Qualification (SDR) */}
      <CollapsibleBlock title="Qualificação (SDR)" icon={<ClipboardList className="h-3 w-3" />} defaultOpen={!!lead.qualification_notes}>
        <div className="p-3">
          <CompanyInfoSection lead={lead} onUpdateLead={onUpdateLead} readOnly={readOnlyQualification} />
        </div>
      </CollapsibleBlock>

      {/* 3. Partners */}
      {partners.length > 0 && (
        <CollapsibleBlock title="Sócios" icon={<Users className="h-3 w-3" />}>
          <div className="p-3 space-y-1">
            {partners.map((p, i) => (
              <p key={i} className="text-[10px] text-foreground">
                • {p.nome}{p.qual ? ` (${p.qual})` : ''}
              </p>
            ))}
          </div>
        </CollapsibleBlock>
      )}

      {/* 4. Economic Activity */}
      <CollapsibleBlock title="Atividade Econômica" icon={<Activity className="h-3 w-3" />}>
        <div className="p-3 space-y-1">
          <InfoRow label="CNAE Principal" value={lead.cnae_fiscal_descricao ? `${lead.cnae_fiscal} - ${lead.cnae_fiscal_descricao}` : undefined} />
          {cnaes.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-medium text-muted-foreground mb-1">CNAEs Secundários:</p>
              {cnaes.slice(0, 5).map((c, i) => (
                <p key={i} className="text-[10px] text-foreground">
                  • {c.codigo ? `${c.codigo} - ` : ''}{c.descricao}
                </p>
              ))}
              {cnaes.length > 5 && (
                <p className="text-[10px] text-muted-foreground mt-1">+{cnaes.length - 5} outros</p>
              )}
            </div>
          )}
        </div>
      </CollapsibleBlock>

      {/* 5. Address */}
      <CollapsibleBlock title="Endereço" icon={<MapPin className="h-3 w-3" />}>
        <div className="p-3 space-y-1">
          <InfoRow label="CEP" value={lead.cep} />
          <InfoRow label="Logradouro" value={lead.logradouro} />
          <InfoRow label="Número" value={lead.numero} />
          <InfoRow label="Complemento" value={lead.complemento} />
          <InfoRow label="Bairro" value={lead.bairro} />
          <InfoRow label="Cidade" value={lead.city} />
          <InfoRow label="Estado" value={lead.state} />
        </div>
      </CollapsibleBlock>

      {/* 6. Website */}
      {lead.website && (
        <CollapsibleBlock title="Site" icon={<Globe className="h-3 w-3" />}>
          <div className="p-3">
            <a
              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-primary hover:underline break-all"
            >
              {lead.website}
            </a>
          </div>
        </CollapsibleBlock>
      )}

      {/* 7. Cadastro Contratual (checkout) */}
      {checkoutData && (
        <CollapsibleBlock title="Cadastro Contratual" icon={<ClipboardCheck className="h-3 w-3" />}>
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-end">
              <span className="text-[9px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
                Preenchido em {formatDateBR(checkoutData.created_at)}
              </span>
            </div>

            {/* Dados da Empresa */}
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dados da Empresa</p>
              <InfoRow label="Razão Social" value={checkoutData.razao_social} />
              <InfoRow label="Nome Fantasia" value={checkoutData.nome_fantasia} />
              <InfoRow label="CNPJ" value={fmtCnpj(checkoutData.cnpj)} />
              <InfoRow label="CEP" value={checkoutData.cep} />
              <InfoRow label="Logradouro" value={checkoutData.logradouro} />
              <InfoRow label="Número" value={checkoutData.numero} />
              <InfoRow label="Complemento" value={checkoutData.complemento} />
              <InfoRow label="Bairro" value={checkoutData.bairro} />
              <InfoRow label="Cidade" value={checkoutData.city} />
              <InfoRow label="Estado" value={checkoutData.state} />
            </div>

            {/* Representante Legal */}
            {checkoutData.rep_name && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Representante Legal</p>
                <InfoRow label="Nome" value={checkoutData.rep_name} />
                <InfoRow label="CPF" value={fmtCpf(checkoutData.rep_cpf)} />
                <InfoRow label="Cargo" value={checkoutData.rep_role} />
                <InfoRow label="E-mail" value={checkoutData.rep_email} />
                <InfoRow label="Telefone" value={checkoutData.rep_phone} />
              </div>
            )}

            {/* Responsável Financeiro */}
            {checkoutData.fin_name && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Responsável Financeiro</p>
                <InfoRow label="Nome" value={checkoutData.fin_name} />
                <InfoRow label="E-mail" value={checkoutData.fin_email} />
                <InfoRow label="Telefone" value={checkoutData.fin_phone} />
              </div>
            )}
          </div>
        </CollapsibleBlock>
      )}
    </div>
  );
};