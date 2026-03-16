import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  User,
  Phone,
  Mail,
  Globe,
  MapPin,
  FileText,
  Handshake,
  Sparkles,
  Save,
  ExternalLink,
  Pencil,
  Briefcase,
  Hash,
  Calendar,
  DollarSign,
  Users as UsersIcon,
  ChevronRight,
  CircleDot,
  X,
  AlertTriangle,
  ClipboardCheck,
} from "lucide-react";
import { MAX_EVOLUTIONS_BEFORE_WARNING } from "@/services/closerService";
import { ActiveClient } from "@/hooks/useActiveClients";
import { useClientDeals, ClientDeal, ClientApiOficialDeal } from "@/hooks/useClientDeals";
import { formatDateBR } from "@/utils/dateFormat";
import { useSystemUsers } from "@/hooks/useSystemUsers";
import { useUserRole } from "@/hooks/useUserRole";
import { updateActiveClient } from "@/services/clientService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  ativo: {
    label: "Ativo",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  pausado: {
    label: "Pausado",
    dot: "bg-warning",
    badge: "bg-warning/10 text-warning border-warning/20",
  },
  inativo: { label: "Inativo", dot: "bg-muted-foreground/40", badge: "bg-muted text-muted-foreground border-border" },
};

interface Props {
  client: ActiveClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function ClientDetailModal({ client, open, onOpenChange, onUpdated }: Props) {
  const navigate = useNavigate();
  const { data: systemUsers = [] } = useSystemUsers();
  const { canAccessBoth } = useUserRole();

  const cnpjs = useMemo(() => (client?.cnpj ? [client.cnpj] : []), [client?.cnpj]);
  const { data: clientDealsData } = useClientDeals(cnpjs);

  const clientCnpjDigits = useMemo(() => client?.cnpj?.replace(/\D/g, "") || "", [client?.cnpj]);

  const { data: checkoutData } = useQuery({
    queryKey: ["checkout-session", clientCnpjDigits],
    enabled: !!clientCnpjDigits,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkout_sessions")
        .select("*")
        .eq("cnpj", clientCnpjDigits)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const deals = useMemo(() => {
    if (!client?.cnpj || !clientDealsData) return [];
    return clientDealsData.dealsMap.get(client.cnpj.replace(/\D/g, "")) || [];
  }, [client?.cnpj, clientDealsData]);

  const apiOficialDeals = useMemo(() => {
    if (!client?.cnpj || !clientDealsData) return [];
    return clientDealsData.apiOficialMap.get(client.cnpj.replace(/\D/g, "")) || [];
  }, [client?.cnpj, clientDealsData]);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<ActiveClient>>({});
  const [saving, setSaving] = useState(false);

  const startEditing = useCallback(() => {
    if (!client) return;
    setForm({
      company: client.company,
      contact_name: client.contact_name,
      email: client.email,
      phone: client.phone,
      website: client.website,
      segment: client.segment,
      notes: client.notes,
      status: client.status,
      account_owner_id: client.account_owner_id,
      city: client.city,
      state: client.state,
      cep: client.cep,
      employee_count: client.employee_count,
      revenue_range: client.revenue_range,
    });
    setEditing(true);
  }, [client]);

  const handleSave = useCallback(async () => {
    if (!client) return;
    setSaving(true);
    try {
      await updateActiveClient(client.id, form);
      toast.success("Cliente atualizado");
      setEditing(false);
      onUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao salvar: " + msg);
    } finally {
      setSaving(false);
    }
  }, [client, form, onUpdated]);

  const updateField = useCallback((key: string, value: string | null) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  if (!client) return null;

  const fmtCnpj = (cnpj: string) => {
    const d = cnpj.replace(/\D/g, "");
    if (d.length !== 14) return cnpj;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  };
  const fmtCpf = (cpf: string) => {
    const d = cpf.replace(/\D/g, "");
    if (d.length !== 11) return cpf;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  };
  const fmtCurrency = (v: number | null) =>
    v ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

  const st = STATUS_CONFIG[client.status] || STATUS_CONFIG.ativo;
  const aiData = client.ai_enrichment_data;
  const hasAiData = aiData && typeof aiData === "object" && Object.keys(aiData).length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setEditing(false);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-[820px] max-h-[90vh] p-0 gap-0 overflow-hidden rounded-2xl [&>button[data-radix-collection-item]]:hidden [&>.absolute]:hidden">
        {/* ─── Header ─── */}
        <div className="px-6 pt-6 pb-5 border-b border-border space-y-4">
          {/* Top row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="h-6 w-6 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold tracking-tight truncate">{client.company}</h2>
                  {client.nome_fantasia && client.nome_fantasia !== client.company && (
                    <p className="text-xs text-muted-foreground truncate">{client.nome_fantasia}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {!editing ? (
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={startEditing}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSave} disabled={saving}>
                    <Save className="h-3.5 w-3.5" /> Salvar
                  </Button>
                </>
              )}
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                  <X className="h-4 w-4" />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Summary metrics strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricChip
              label="Status"
              value={
                editing && canAccessBoth ? (
                  <Select value={form.status || "ativo"} onValueChange={(v) => updateField("status", v)}>
                    <SelectTrigger className="h-6 w-full text-xs border-0 bg-transparent p-0 shadow-none font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([k, { label }]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", st.dot)} />
                    {st.label}
                  </span>
                )
              }
            />
            <MetricChip label="CNPJ" value={client.cnpj ? fmtCnpj(client.cnpj) : "—"} mono />
            <MetricChip
              label="Closer"
              value={
                editing && canAccessBoth ? (
                  <Select
                    value={form.account_owner_id || "__none__"}
                    onValueChange={(v) => updateField("account_owner_id", v === "__none__" ? null : v)}
                  >
                    <SelectTrigger className="h-6 w-full text-xs border-0 bg-transparent p-0 shadow-none font-medium">
                      <SelectValue placeholder="Não atribuído" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Não atribuído</SelectItem>
                      {systemUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  client.account_owner_name || <span className="text-muted-foreground">Não atribuído</span>
                )
              }
            />
            <MetricChip label="Negociações" value={deals.length > 0 ? `${deals.length} ativa(s)` : "Nenhuma"} />
          </div>
        </div>

        {/* ─── Body ─── */}
        <ScrollArea className="flex-1" style={{ maxHeight: "calc(90vh - 200px)" }}>
          <div className="p-6 space-y-6">
            {/* ── Dados Cadastrais ── */}
            <Section title="Dados Cadastrais" icon={Building2}>
              <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                <Field
                  label="Empresa"
                  value={editing ? form.company : client.company}
                  editing={editing}
                  onChange={(v) => updateField("company", v)}
                />
                <Field label="Razão Social" value={client.razao_social} />
                <Field
                  label="Segmento"
                  value={editing ? form.segment : client.segment}
                  editing={editing}
                  onChange={(v) => updateField("segment", v)}
                />
                <Field label="CNAE" value={client.cnae_fiscal_descricao} />
                <Field label="Porte" value={client.porte} />
                <Field
                  label="Funcionários"
                  value={editing ? form.employee_count : client.employee_count}
                  editing={editing}
                  onChange={(v) => updateField("employee_count", v)}
                />
                <Field
                  label="Faixa de Receita"
                  value={editing ? form.revenue_range : client.revenue_range}
                  editing={editing}
                  onChange={(v) => updateField("revenue_range", v)}
                />
                <Field label="Capital Social" value={fmtCurrency(client.capital_social)} />
                <Field label="Situação Cadastral" value={client.situacao_cadastral} />
                <Field
                  label="Cidade"
                  value={editing ? form.city : client.city}
                  editing={editing}
                  onChange={(v) => updateField("city", v)}
                />
                <Field
                  label="UF"
                  value={editing ? form.state : client.state}
                  editing={editing}
                  onChange={(v) => updateField("state", v)}
                />
                <Field
                  label="CEP"
                  value={editing ? form.cep : client.cep}
                  editing={editing}
                  onChange={(v) => updateField("cep", v)}
                />
                <Field label="Início Atividade" value={client.data_inicio_atividade} />
              </div>
            </Section>

            <Separator />

            {/* ── Contato ── */}
            <Section title="Contato" icon={User}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <Field
                  label="Nome"
                  value={editing ? form.contact_name : client.contact_name}
                  editing={editing}
                  onChange={(v) => updateField("contact_name", v)}
                />
                <Field
                  label="Telefone"
                  value={editing ? form.phone : client.phone}
                  editing={editing}
                  onChange={(v) => updateField("phone", v)}
                />
                <Field
                  label="E-mail"
                  value={editing ? form.email : client.email}
                  editing={editing}
                  onChange={(v) => updateField("email", v)}
                />
                <Field
                  label="Website"
                  value={editing ? form.website : client.website}
                  editing={editing}
                  onChange={(v) => updateField("website", v)}
                  link
                />
              </div>
            </Section>

            {/* ── Cadastro Contratual ── */}
            {checkoutData && (
              <>
                <Separator />
                <Section
                  title="Cadastro Contratual"
                  icon={ClipboardCheck}
                  subtitle={`Preenchido em ${new Date(checkoutData.created_at).toLocaleDateString("pt-BR")}`}
                >
                  <div className="space-y-4">
                    {/* Dados da Empresa */}
                    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" /> Dados da Empresa
                      </p>
                      <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                        <Field label="CNPJ" value={checkoutData.cnpj ? fmtCnpj(checkoutData.cnpj) : null} />
                        <Field label="Razão Social" value={checkoutData.razao_social} />
                        <Field label="Nome Fantasia" value={checkoutData.nome_fantasia} />
                        <Field label="Logradouro" value={checkoutData.logradouro} />
                        <Field label="Número" value={checkoutData.numero} />
                        <Field label="Complemento" value={checkoutData.complemento} />
                        <Field label="Bairro" value={checkoutData.bairro} />
                        <Field label="Cidade" value={checkoutData.city} />
                        <Field label="UF" value={checkoutData.state} />
                        <Field label="CEP" value={checkoutData.cep} />
                      </div>
                    </div>

                    {/* Representante Legal */}
                    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" /> Representante Legal
                      </p>
                      <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                        <Field label="Nome" value={checkoutData.rep_name} />
                        <Field label="CPF" value={checkoutData.rep_cpf ? fmtCpf(checkoutData.rep_cpf) : null} />
                        <Field label="Cargo" value={checkoutData.rep_role} />
                        <Field label="Telefone" value={checkoutData.rep_phone} />
                        <Field label="E-mail" value={checkoutData.rep_email} />
                      </div>
                    </div>

                    {/* Responsável Financeiro */}
                    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5" /> Responsável Financeiro
                      </p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                        <Field label="Nome" value={checkoutData.fin_name} />
                        <Field label="E-mail" value={checkoutData.fin_email} />
                        <Field label="Telefone" value={checkoutData.fin_phone} />
                      </div>
                    </div>
                  </div>
                </Section>
              </>
            )}

            <Separator />

            {/* ── Observações ── */}
            <Section title="Observações" icon={FileText}>
              {editing ? (
                <Textarea
                  value={form.notes || ""}
                  onChange={(e) => updateField("notes", e.target.value)}
                  className="text-sm min-h-[100px] resize-none"
                  placeholder="Notas sobre o cliente..."
                />
              ) : (
                <div className="text-sm whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-3 min-h-[60px]">
                  {client.notes || (
                    <span className="text-muted-foreground/60 italic text-xs">Nenhuma observação registrada</span>
                  )}
                </div>
              )}
            </Section>

            <Separator />

            {/* ── Negociações ── */}
            <Section title="Negociações" icon={Handshake} count={deals.length}>
              {(() => {
                const activeEvolutions = deals.filter(d => d.opportunity_type === "evolution" && d.stage !== "Perdido");
                return activeEvolutions.length >= MAX_EVOLUTIONS_BEFORE_WARNING ? (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-2.5 flex items-start gap-2 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-warning">
                      {activeEvolutions.length} evoluções ativas simultâneas para este cliente.
                    </p>
                  </div>
                ) : null;
              })()}
              {deals.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-xs text-muted-foreground/60">Nenhuma negociação vinculada a este cliente</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {deals.map((deal) => (
                    <DealRow
                      key={deal.id}
                      deal={deal}
                      onNavigate={() => {
                        const route = deal.opportunity_type === "evolution" ? "/closer/evolucao" : "/closer-pipeline";
                        onOpenChange(false);
                        navigate(route);
                      }}
                    />
                  ))}
                </div>
              )}
            </Section>

            <Separator />

            {/* ── API Oficial ── */}
            <Section title="API Oficial" icon={ClipboardCheck} count={apiOficialDeals.length}>
              {apiOficialDeals.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-xs text-muted-foreground/60">Nenhuma solicitação de API Oficial</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {apiOficialDeals.map((deal) => (
                    <ApiOficialDealRow
                      key={deal.id}
                      deal={deal}
                      onNavigate={() => {
                        onOpenChange(false);
                        navigate(`/closer/api-oficial?lead=${deal.lead_id}`);
                      }}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* ── Enriquecimento AI ── */}
            {(hasAiData || client.enriched_at) && (
              <>
                <Separator />
                <Section
                  title="Enriquecimento AI"
                  icon={Sparkles}
                  subtitle={
                    client.enriched_at
                      ? `Atualizado em ${new Date(client.enriched_at).toLocaleDateString("pt-BR")}`
                      : undefined
                  }
                >
                  {!hasAiData ? (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-xs text-muted-foreground/60">Dados de enriquecimento não disponíveis</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      {Object.entries(aiData as Record<string, unknown>).map(([key, value]) => {
                        if (!value || (typeof value === "string" && !value.trim())) return null;
                        const display = typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
                        return (
                          <div key={key} className={cn(display.length > 80 && "col-span-2")}>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">
                              {key.replace(/_/g, " ")}
                            </p>
                            <p className="text-sm whitespace-pre-wrap break-words">{display}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Section>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sub-components ─── */

function MetricChip({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">{label}</p>
      <div className={cn("text-xs font-medium truncate", mono && "font-mono")}>{value}</div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  count,
  subtitle,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  count?: number;
  subtitle?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium tracking-tight">{title}</h3>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px] rounded-full">
            {count}
          </Badge>
        )}
        {subtitle && <span className="text-[10px] text-muted-foreground ml-auto">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  editing,
  onChange,
  link,
}: {
  label: string;
  value: string | null | undefined;
  editing?: boolean;
  onChange?: (v: string) => void;
  link?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      {editing && onChange ? (
        <Input value={value || ""} onChange={(e) => onChange(e.target.value)} className="h-7 text-sm" />
      ) : link && value ? (
        <a
          href={value.startsWith("http") ? value : `https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1 truncate"
        >
          {value} <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ) : (
        <p className="text-sm truncate">{value || <span className="text-muted-foreground/50">—</span>}</p>
      )}
    </div>
  );
}

function DealRow({ deal, onNavigate }: { deal: ClientDeal; onNavigate: () => void }) {
  const isEvo = deal.opportunity_type === "evolution";

  return (
    <button
      onClick={onNavigate}
      className="w-full flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-all duration-200 hover:bg-accent/50 hover:border-primary/20 group"
    >
      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
          isEvo ? "bg-info/10" : "bg-primary/10",
        )}
      >
        <Handshake className={cn("h-4 w-4", isEvo ? "text-info" : "text-primary")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{deal.stage}</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[9px] border shrink-0",
              isEvo
                ? "bg-info/10 text-info border-info/20"
                : "bg-primary/10 text-primary border-primary/20",
            )}
          >
            {isEvo ? "Evolução" : "New Biz"}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          {deal.deal_value ? (
            <span className="font-medium">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(deal.deal_value)}
            </span>
          ) : null}
          {deal.assigned_to_name && <span>• {deal.assigned_to_name}</span>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
    </button>
  );
}

const API_OFICIAL_STAGE_COLORS: Record<string, string> = {
  "Acionar": "bg-primary/10 text-primary border-primary/20",
  "Em contato": "bg-info/10 text-info border-info/20",
  "Reunião agendada": "bg-warning/10 text-warning border-warning/20",
  "Aguardando retorno": "bg-muted text-muted-foreground border-border",
  "Não quer agora": "bg-destructive/10 text-destructive border-destructive/20",
  "Enviar Pós Venda": "bg-success/10 text-success border-success/20",
};

function ApiOficialDealRow({ deal, onNavigate }: { deal: ClientApiOficialDeal; onNavigate: () => void }) {
  const stageColor = API_OFICIAL_STAGE_COLORS[deal.stage] || "bg-muted text-muted-foreground border-border";

  return (
    <button
      onClick={onNavigate}
      className="w-full flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-all duration-200 hover:bg-accent/50 hover:border-primary/20 group"
    >
      <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
        <ClipboardCheck className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{deal.lead_company || deal.lead_name || "Sem nome"}</span>
          <Badge variant="outline" className={cn("text-[9px] border shrink-0", stageColor)}>
            {deal.stage}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>{formatDateBR(deal.created_at)}</span>
          {deal.assigned_to_name && <span>• {deal.assigned_to_name}</span>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
    </button>
  );
}
