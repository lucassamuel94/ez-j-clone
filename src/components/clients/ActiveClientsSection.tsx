import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  TableProvider,
  TableHeader,
  TableHeaderGroup,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableColumnHeader,
  type ColumnDef,
} from "@/components/kibo-ui/table";
import {
  Upload,
  Database,
  Search,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users,
  ChevronLeft,
  ChevronRight,
  XCircle,
  Settings2,
  UserCheck,
  Handshake,
  SlidersHorizontal,
  Columns3,
  X,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useActiveClients } from "@/hooks/useActiveClients";
import { useClientDeals } from "@/hooks/useClientDeals";
import { useSystemUsers } from "@/hooks/useSystemUsers";
import { usePermissions } from "@/hooks/usePermissions";
import { ClientImportDialog } from "./ClientImportDialog";
import { ClientDetailModal } from "./ClientDetailModal";
import { NewDealFromClientDialog } from "@/components/closer/NewDealFromClientDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ActiveClientRow {
  id: string;
  company: string;
  contact_name: string | null;
  cnpj: string | null;
  cnae_fiscal_descricao: string | null;
  porte: string | null;
  employee_count: string | null;
  city: string | null;
  state: string | null;
  enriched_at: string | null;
  account_owner_id: string | null;
  account_owner_name: string | null;
  status: string;
}

// --- Column visibility config ---
const COLUMN_STORAGE_KEY = "active_clients_visible_columns";
const PAGE_SIZE_STORAGE_KEY = "active_clients_page_size";

interface ColumnConfig {
  key: string;
  label: string;
  defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnConfig[] = [
  { key: "company", label: "Empresa", defaultVisible: true },
  { key: "cnpj", label: "CNPJ", defaultVisible: true },
  { key: "account_owner", label: "Closer Responsável", defaultVisible: true },
  { key: "cnae_fiscal_descricao", label: "CNAE", defaultVisible: false },
  { key: "porte", label: "Porte", defaultVisible: false },
  { key: "location", label: "Cidade/UF", defaultVisible: true },
  { key: "client_status", label: "Status", defaultVisible: true },
  { key: "deals", label: "Negociações", defaultVisible: false },
];

function loadVisibleColumns(): Set<string> {
  try {
    const stored = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));
}

function loadPageSize(): number {
  try {
    const stored = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    if (stored) return parseInt(stored, 10);
  } catch {}
  return 20;
}

// --- Advanced Filters ---
interface Filters {
  empresa: string;
  cnpj: string;
  cnae: string;
  porte: string;
  cidade: string;
  uf: string;
  clientStatus: string; // "all" | "ativo" | "pausado" | "inativo"
  closer: string; // user id or ""
}

const EMPTY_FILTERS: Filters = {
  empresa: "",
  cnpj: "",
  cnae: "",
  porte: "",
  cidade: "",
  uf: "",
  clientStatus: "all",
  closer: "",
};

function countActiveFilters(f: Filters): number {
  let count = 0;
  if (f.empresa) count++;
  if (f.cnpj) count++;
  if (f.cnae) count++;
  if (f.porte) count++;
  if (f.cidade) count++;
  if (f.uf) count++;
  if (f.clientStatus !== "all") count++;
  if (f.closer) count++;
  return count;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "bg-success/10 text-success border-success/20" },
  pausado: { label: "Pausado", className: "bg-warning/10 text-warning border-warning/20" },
  inativo: { label: "Inativo", className: "bg-muted text-muted-foreground border-border" },
};

export function ActiveClientsSection() {
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<{
    current: number;
    total: number;
    percent: number;
    cnpja: number;
    perplexity: number;
  } | null>(null);
  const [jobDone, setJobDone] = useState<{ total: number; cnpja: number; perplexity: number } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(loadPageSize);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOwnerId, setBulkOwnerId] = useState<string>("");
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [dealPreselectedClientId, setDealPreselectedClientId] = useState<string | undefined>(undefined);
  const [detailClient, setDetailClient] = useState<any>(null);

  const [enrichLimit, setEnrichLimit] = useState<string>("");
  const [useCnpja, setUseCnpja] = useState(true);
  const [usePerplexity, setUsePerplexity] = useState(true);
  const [enrichSettingsOpen, setEnrichSettingsOpen] = useState(false);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(loadVisibleColumns);
  const [columnsOpen, setColumnsOpen] = useState(false);

  // Advanced filters
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: clients = [], isLoading, importClients, deleteClient, updateOwner, refetch } = useActiveClients(search);

  // Auto-open client detail from URL param ?account=ID
  useEffect(() => {
    const accountId = searchParams.get('account');
    if (accountId && clients.length > 0 && !detailClient) {
      const found = clients.find((c: any) => c.id === accountId);
      if (found) {
        setDetailClient(found);
      } else {
        // Fetch directly if not in current page
        supabase.from('active_clients').select('*').eq('id', accountId).maybeSingle().then(({ data }) => {
          if (data) setDetailClient(data);
        });
      }
    }
  }, [searchParams, clients, detailClient]);
  const { data: systemUsers = [] } = useSystemUsers();
  const { hasPermission } = usePermissions();
  const canAccessBoth = hasPermission('access_admin');

  // Collect CNPJs for deals lookup
  const clientCnpjs = useMemo(() => clients.map(c => c.cnpj).filter(Boolean) as string[], [clients]);
  const { data: dealsMap } = useClientDeals(clientCnpjs);

  // Save column prefs
  useEffect(() => {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(Array.from(visibleColumns)));
  }, [visibleColumns]);

  // Save page size pref
  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
  }, [pageSize]);

  // Derive unique filter options from data
  const filterOptions = useMemo(() => {
    const portes = new Set<string>();
    const ufs = new Set<string>();
    clients.forEach((c) => {
      if (c.porte) portes.add(c.porte);
      if (c.state) ufs.add(c.state);
    });
    return {
      portes: Array.from(portes).sort(),
      ufs: Array.from(ufs).sort(),
    };
  }, [clients]);

  // Apply advanced filters
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (filters.empresa && !c.company?.toLowerCase().includes(filters.empresa.toLowerCase())) return false;
      if (filters.cnpj && !c.cnpj?.includes(filters.cnpj.replace(/\D/g, ""))) return false;
      if (filters.cnae && !c.cnae_fiscal_descricao?.toLowerCase().includes(filters.cnae.toLowerCase())) return false;
      if (filters.porte && c.porte !== filters.porte) return false;
      if (filters.cidade && !c.city?.toLowerCase().includes(filters.cidade.toLowerCase())) return false;
      if (filters.uf && c.state !== filters.uf) return false;
      if (filters.clientStatus !== "all" && (c as any).status !== filters.clientStatus) return false;
      if (filters.closer && c.account_owner_id !== filters.closer) return false;
      return true;
    });
  }, [clients, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const paginatedClients = useMemo(
    () => filteredClients.slice((page - 1) * pageSize, page * pageSize),
    [filteredClients, page, pageSize],
  );

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handlePageSizeChange = useCallback((val: string) => {
    setPageSize(Number(val));
    setPage(1);
  }, []);

  const handleImport = async (records: any[]) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    const withUser = records.map((r) => ({ ...r, imported_by: userId }));
    await importClients.mutateAsync(withUser);
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === paginatedClients.length) return new Set();
      return new Set(paginatedClients.map((c) => c.id));
    });
  }, [paginatedClients]);

  const handleBulkAssign = async () => {
    if (!bulkOwnerId || selectedIds.size === 0) return;
    await updateOwner.mutateAsync({
      clientIds: Array.from(selectedIds),
      ownerId: bulkOwnerId === "__none__" ? null : bulkOwnerId,
    });
    setSelectedIds(new Set());
    setBulkOwnerId("");
  };

  const handleSingleAssign = useCallback(
    async (clientId: string, ownerId: string) => {
      await updateOwner.mutateAsync({ clientIds: [clientId], ownerId: ownerId === "__none__" ? null : ownerId });
    },
    [updateOwner],
  );

  const toggleColumnVisibility = useCallback((key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }, []);

  const updateFilter = useCallback((key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  // Check for existing running job on mount
  useEffect(() => {
    const checkExistingJob = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data: runningJobs } = await (supabase
        .from("enrichment_jobs" as any)
        .select("id, status, total_eligible, processed, cnpja_success, perplexity_success")
        .eq("status", "running")
        .eq("started_by", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1) as any);
      if (runningJobs && runningJobs.length > 0) {
        const job = runningJobs[0];
        setActiveJobId(job.id);
        setJobProgress({
          current: job.processed || 0,
          total: job.total_eligible || 0,
          percent: job.total_eligible > 0 ? Math.round((job.processed / job.total_eligible) * 100) : 0,
          cnpja: job.cnpja_success || 0,
          perplexity: job.perplexity_success || 0,
        });
      }
    };
    checkExistingJob();
  }, []);

  // Poll for job progress
  useEffect(() => {
    if (!activeJobId) return;
    const interval = setInterval(async () => {
      const { data: job } = await (supabase
        .from("enrichment_jobs" as any)
        .select("status, total_eligible, processed, cnpja_success, perplexity_success, error_message")
        .eq("id", activeJobId)
        .single() as any);
      if (!job) return;
      if (job.status === "completed") {
        setActiveJobId(null);
        setJobProgress(null);
        setJobDone({ total: job.processed, cnpja: job.cnpja_success, perplexity: job.perplexity_success });
        toast.success(`Enriquecimento concluído: ${job.processed} clientes processados`);
        refetch();
        clearInterval(interval);
      } else if (job.status === "failed") {
        setActiveJobId(null);
        setJobProgress(null);
        toast.error("Erro no enriquecimento: " + (job.error_message || "Erro desconhecido"));
        clearInterval(interval);
      } else if (job.status === "cancelled") {
        setActiveJobId(null);
        setJobProgress(null);
        toast.info("Enriquecimento cancelado");
        refetch();
        clearInterval(interval);
      } else {
        setJobProgress({
          current: job.processed || 0,
          total: job.total_eligible || 0,
          percent: job.total_eligible > 0 ? Math.round((job.processed / job.total_eligible) * 100) : 0,
          cnpja: job.cnpja_success || 0,
          perplexity: job.perplexity_success || 0,
        });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeJobId, refetch]);

  const handleEnrich = async () => {
    if (!useCnpja && !usePerplexity) {
      toast.error("Selecione pelo menos uma fonte de enriquecimento");
      return;
    }
    setJobDone(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Faça login para enriquecer");
        return;
      }
      const { data: newJob, error: insertError } = await (supabase
        .from("enrichment_jobs" as any)
        .insert({ started_by: session.user.id } as any)
        .select("id")
        .single() as any);
      if (insertError) throw insertError;
      setActiveJobId(newJob.id);
      setJobProgress({ current: 0, total: 0, percent: 0, cnpja: 0, perplexity: 0 });
      const limit = enrichLimit ? parseInt(enrichLimit, 10) : 0;
      supabase.functions
        .invoke("enrich-active-clients", {
          body: {
            job_id: newJob.id,
            limit: limit > 0 ? limit : undefined,
            use_cnpja: useCnpja,
            use_perplexity: usePerplexity,
          },
        })
        .catch((err) => console.error("Edge function invoke error:", err));
      const sources = [useCnpja && "CNPJá", usePerplexity && "Perplexity"].filter(Boolean).join(" + ");
      toast.info(
        `Enriquecimento iniciado (${sources})${limit > 0 ? ` — limite: ${limit} clientes` : ""}. Pode sair da tela.`,
      );
    } catch (err: any) {
      toast.error("Erro ao iniciar enriquecimento: " + (err.message || "Erro desconhecido"));
    }
  };

  const handleCancel = async () => {
    if (!activeJobId) return;
    await (supabase
      .from("enrichment_jobs" as any)
      .update({ status: "cancelled" } as any)
      .eq("id", activeJobId) as any);
    setActiveJobId(null);
    setJobProgress(null);
    toast.info("Cancelamento solicitado");
  };

  const columns = useMemo<ColumnDef<ActiveClientRow>[]>(() => {
    const cols: ColumnDef<ActiveClientRow>[] = [];

    if (canAccessBoth) {
      cols.push({
        id: "select",
        size: 40,
        header: () => (
          <Checkbox
            checked={paginatedClients.length > 0 && selectedIds.size === paginatedClients.length}
            onCheckedChange={toggleSelectAll}
          />
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={() => toggleSelect(row.original.id)}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      });
    }

    if (visibleColumns.has("company")) {
      cols.push({
        accessorKey: "company",
        header: ({ column }) => <TableColumnHeader column={column} title="Empresa" />,
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="text-sm font-medium truncate block max-w-[220px]">{row.original.company}</span>
            {row.original.contact_name && (
              <span className="block text-xs text-muted-foreground truncate max-w-[220px]" title={row.original.contact_name}>
                {row.original.contact_name}
              </span>
            )}
          </div>
        ),
      });
    }

    if (visibleColumns.has("cnpj")) {
      cols.push({
        accessorKey: "cnpj",
        size: 160,
        header: ({ column }) => <TableColumnHeader column={column} title="CNPJ" />,
        cell: ({ row }) => <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">{row.original.cnpj || "—"}</span>,
      });
    }

    if (visibleColumns.has("account_owner")) {
      cols.push({
        id: "account_owner",
        size: 180,
        header: () => <span className="text-xs font-medium">Closer</span>,
        enableSorting: false,
        cell: ({ row }) => {
          if (canAccessBoth) {
            return (
              <Select
                value={row.original.account_owner_id || "__none__"}
                onValueChange={(val) => handleSingleAssign(row.original.id, val)}
              >
                <SelectTrigger className="h-7 w-full text-xs border-dashed">
                  <SelectValue placeholder="Não atribuído" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">Não atribuído</span>
                  </SelectItem>
                  {systemUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          }
          return (
            <span className="text-xs text-muted-foreground">{row.original.account_owner_name || "Não atribuído"}</span>
          );
        },
      });
    }

    if (visibleColumns.has("cnae_fiscal_descricao")) {
      cols.push({
        accessorKey: "cnae_fiscal_descricao",
        header: ({ column }) => <TableColumnHeader column={column} title="CNAE" />,
        cell: ({ row }) => {
          const desc = row.original.cnae_fiscal_descricao;
          return desc ? (
            <span className="text-xs truncate block max-w-[180px]" title={desc}>
              {desc}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        },
      });
    }

    if (visibleColumns.has("porte")) {
      cols.push({
        accessorKey: "porte",
        size: 120,
        header: ({ column }) => <TableColumnHeader column={column} title="Porte" />,
        cell: ({ row }) => (
          <span className="text-xs whitespace-nowrap">{row.original.porte || "—"}</span>
        ),
      });
    }

    if (visibleColumns.has("location")) {
      cols.push({
        id: "location",
        size: 140,
        header: () => <span className="text-xs font-medium">Cidade/UF</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const { city, state } = row.original;
          return <span className="text-xs whitespace-nowrap">{city && state ? `${city}/${state}` : city || state || "—"}</span>;
        },
      });
    }

    if (visibleColumns.has("client_status")) {
      cols.push({
        id: "client_status",
        size: 110,
        header: () => <span className="text-xs font-medium">Status</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const st = row.original.status || "ativo";
          const cfg = STATUS_CONFIG[st] || STATUS_CONFIG.ativo;
          if (canAccessBoth) {
            return (
              <Select
                value={st}
                onValueChange={async (val) => {
                  const { error } = await supabase
                    .from('accounts')
                    .update({ status: val })
                    .eq('id', row.original.id);
                  if (error) {
                    toast.error('Erro ao atualizar status');
                  } else {
                    refetch();
                  }
                }}
              >
                <SelectTrigger className="h-7 w-full text-xs border-dashed">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          }
          return (
            <Badge variant="outline" className={cn("text-[10px] border", cfg.className)}>
              {cfg.label}
            </Badge>
          );
        },
      });
    }

    if (visibleColumns.has("deals")) {
      cols.push({
        id: "deals",
        size: 130,
        header: () => <span className="text-xs font-medium">Negociações</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const cnpj = row.original.cnpj?.replace(/\D/g, '') || '';
          const deals = cnpj && dealsMap ? dealsMap.dealsMap.get(cnpj) || [] : [];
          if (deals.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-[10px] cursor-pointer gap-1">
                    <Handshake className="h-3 w-3" />
                    {deals.length}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs p-0">
                  <div className="p-2 space-y-1.5">
                    <p className="text-xs font-medium mb-1">Negociações</p>
                    {deals.map((d) => (
                      <button
                        key={d.id}
                        className="flex items-center gap-2 w-full text-left text-xs hover:bg-accent rounded px-1.5 py-1 transition-colors"
                        onClick={() => {
                          const route = d.opportunity_type === 'evolution' ? '/evolution-pipeline' : '/closer-pipeline';
                          navigate(route);
                        }}
                      >
                        <span className="truncate flex-1">{d.stage}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0">
                          {d.opportunity_type === 'evolution' ? 'Evolução' : 'New Biz'}
                        </Badge>
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      });
    }

    cols.push({
      id: "actions",
      size: 48,
      header: () => null,
      enableSorting: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              className="gap-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setDetailClient(row.original);
              }}
            >
              <Search className="h-3.5 w-3.5" />
              Mais detalhes
            </DropdownMenuItem>
            {(canAccessBoth || row.original.account_owner_id) && (
              <DropdownMenuItem
                className="gap-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setDealPreselectedClientId(row.original.id);
                  setDealDialogOpen(true);
                }}
              >
                <Handshake className="h-3.5 w-3.5" />
                Nova negociação
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="gap-2 text-xs text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                deleteClient.mutate(row.original.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    });

    return cols;
  }, [deleteClient, canAccessBoth, paginatedClients, selectedIds, systemUsers, visibleColumns, handleSingleAssign, toggleSelect, toggleSelectAll, dealsMap, navigate, refetch]);

  return (
    <div className="space-y-4 px-4 py-4 pb-20">
      <PageHeader
        icon={<Users className="h-5 w-5" />}
        title="Base de Clientes"
        subtitle="Gerencie e enriqueça sua base de clientes ativos"
        count={clients.length}
        badges={
          <>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <CheckCircle2 className="h-3 w-3" /> {clients.filter((c) => c.enriched_at).length} enriquecidos
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <AlertCircle className="h-3 w-3" /> {clients.filter((c) => !c.enriched_at).length} pendentes
            </Badge>
          </>
        }
        actions={
          <>
            <Popover open={enrichSettingsOpen} onOpenChange={setEnrichSettingsOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={!!activeJobId}>
                  <Settings2 className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-4">
                <p className="text-sm font-medium mb-3">Configurações de Enriquecimento</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="useCnpja" className="text-xs">
                      CNPJá (Dados Cadastrais)
                    </Label>
                    <Switch id="useCnpja" checked={useCnpja} onCheckedChange={setUseCnpja} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="usePerplexity" className="text-xs">
                      Perplexity (Dados de Mercado)
                    </Label>
                    <Switch id="usePerplexity" checked={usePerplexity} onCheckedChange={setUsePerplexity} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Limite de clientes</Label>
                  <Input
                    type="number"
                    placeholder="Todos os pendentes"
                    value={enrichLimit}
                    onChange={(e) => setEnrichLimit(e.target.value)}
                    className="h-8 text-xs"
                    min={1}
                  />
                  <p className="text-[11px] text-muted-foreground">Deixe vazio para processar todos.</p>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnrich}
              disabled={!!activeJobId || clients.length === 0 || (!useCnpja && !usePerplexity)}
            >
              {activeJobId ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Database className="h-3.5 w-3.5 mr-1.5" />
              )}
              Enriquecer{enrichLimit ? ` (${enrichLimit})` : ""}
            </Button>
            <Button size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Importar Base
            </Button>
          </>
        }
        toolbar={
           <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por empresa, CNPJ, contato..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 h-8 text-xs w-full"
              />
            </div>

            {/* Filters button */}
            <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs relative">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <Badge className="h-4 min-w-4 px-1 text-[10px] rounded-full ml-1">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Filtros Avançados</p>
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={clearFilters}>
                      <X className="h-3 w-3" /> Limpar
                    </Button>
                  )}
                </div>
                <div className="space-y-2.5">
                  <div>
                    <Label className="text-xs text-muted-foreground">Empresa</Label>
                    <Input
                      placeholder="Filtrar por empresa..."
                      value={filters.empresa}
                      onChange={(e) => updateFilter("empresa", e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">CNPJ</Label>
                    <Input
                      placeholder="Filtrar por CNPJ..."
                      value={filters.cnpj}
                      onChange={(e) => updateFilter("cnpj", e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">CNAE</Label>
                    <Input
                      placeholder="Filtrar por descrição CNAE..."
                      value={filters.cnae}
                      onChange={(e) => updateFilter("cnae", e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Porte</Label>
                      <Select value={filters.porte} onValueChange={(v) => updateFilter("porte", v)}>
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_portes">Todos</SelectItem>
                          {filterOptions.portes.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">UF</Label>
                      <Select value={filters.uf} onValueChange={(v) => updateFilter("uf", v)}>
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_ufs">Todas</SelectItem>
                          {filterOptions.ufs.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Cidade</Label>
                    <Input
                      placeholder="Filtrar por cidade..."
                      value={filters.cidade}
                      onChange={(e) => updateFilter("cidade", e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status do Cliente</Label>
                    <Select value={filters.clientStatus} onValueChange={(v) => updateFilter("clientStatus", v)}>
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="pausado">Pausado</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Closer Responsável</Label>
                    <Select value={filters.closer} onValueChange={(v) => updateFilter("closer", v)}>
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_closers">Todos</SelectItem>
                        {systemUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Configure columns button */}
            <Popover open={columnsOpen} onOpenChange={setColumnsOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <Columns3 className="h-3.5 w-3.5" />
                  Colunas
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-3">
                <p className="text-sm font-medium mb-2">Colunas visíveis</p>
                <div className="space-y-1.5">
                  {ALL_COLUMNS.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 cursor-pointer py-1">
                      <Checkbox
                        checked={visibleColumns.has(col.key)}
                        onCheckedChange={() => toggleColumnVisibility(col.key)}
                      />
                      <span className="text-xs">{col.label}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {filters.empresa && (
                  <Badge variant="secondary" className="text-[10px] gap-1 pr-1">
                    Empresa: {filters.empresa}
                    <button onClick={() => updateFilter("empresa", "")} className="ml-0.5 hover:text-foreground"><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {filters.cnpj && (
                  <Badge variant="secondary" className="text-[10px] gap-1 pr-1">
                    CNPJ: {filters.cnpj}
                    <button onClick={() => updateFilter("cnpj", "")} className="ml-0.5 hover:text-foreground"><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {filters.cnae && (
                  <Badge variant="secondary" className="text-[10px] gap-1 pr-1">
                    CNAE: {filters.cnae}
                    <button onClick={() => updateFilter("cnae", "")} className="ml-0.5 hover:text-foreground"><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {filters.porte && (
                  <Badge variant="secondary" className="text-[10px] gap-1 pr-1">
                    Porte: {filters.porte}
                    <button onClick={() => updateFilter("porte", "")} className="ml-0.5 hover:text-foreground"><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {filters.cidade && (
                  <Badge variant="secondary" className="text-[10px] gap-1 pr-1">
                    Cidade: {filters.cidade}
                    <button onClick={() => updateFilter("cidade", "")} className="ml-0.5 hover:text-foreground"><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {filters.uf && (
                  <Badge variant="secondary" className="text-[10px] gap-1 pr-1">
                    UF: {filters.uf}
                    <button onClick={() => updateFilter("uf", "")} className="ml-0.5 hover:text-foreground"><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {filters.clientStatus !== "all" && (
                  <Badge variant="secondary" className="text-[10px] gap-1 pr-1">
                    Status: {STATUS_CONFIG[filters.clientStatus]?.label || filters.clientStatus}
                    <button onClick={() => updateFilter("clientStatus", "all")} className="ml-0.5 hover:text-foreground"><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {filters.closer && (
                  <Badge variant="secondary" className="text-[10px] gap-1 pr-1">
                    Closer: {systemUsers.find((u) => u.id === filters.closer)?.name || "..."}
                    <button onClick={() => updateFilter("closer", "")} className="ml-0.5 hover:text-foreground"><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={clearFilters}>
                  Limpar
                </Button>
              </div>
            )}
          </div>
        }
      />

      {/* Bulk assignment bar */}
      {selectedIds.size > 0 && canAccessBoth && (
        <Card>
          <CardContent className="py-3 flex items-center gap-4">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{selectedIds.size} selecionado(s)</span>
            <Select value={bulkOwnerId} onValueChange={setBulkOwnerId}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue placeholder="Selecionar closer..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">Remover atribuição</span>
                </SelectItem>
                {systemUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleBulkAssign} disabled={!bulkOwnerId || updateOwner.isPending}>
              {updateOwner.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Atribuir
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedIds(new Set());
                setBulkOwnerId("");
              }}
            >
              Cancelar
            </Button>
          </CardContent>
        </Card>
      )}

      {activeJobId && jobProgress && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium">Enriquecendo clientes em background...</p>
                <p className="text-xs text-muted-foreground mt-0.5">Você pode sair desta tela.</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {jobProgress.current}/{jobProgress.total || "..."}
              </span>
            </div>
            <Progress value={jobProgress.percent} className="h-2" />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">
                CNPJa: {jobProgress.cnpja} • Perplexity: {jobProgress.perplexity}
              </span>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={handleCancel}>
                <XCircle className="h-3 w-3" /> Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {jobDone && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <div className="text-sm">
                <p>
                  <strong>{jobDone.total}</strong> clientes processados
                </p>
                <p className="text-muted-foreground">
                  CNPJa: {jobDone.cnpja} • Perplexity: {jobDone.perplexity}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Users className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhum cliente importado ainda</p>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4 mr-2" /> Importar Base
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-auto">
                <TableProvider columns={columns} data={paginatedClients as ActiveClientRow[]}>
                  <TableHeader className="bg-muted/40">
                    {({ headerGroup }) => (
                      <TableHeaderGroup headerGroup={headerGroup}>
                        {({ header }) => <TableHead header={header} className="h-10 px-3 text-xs" />}
                      </TableHeaderGroup>
                    )}
                  </TableHeader>
                  <TableBody>
                    {({ row }) => (
                      <TableRow key={row.id} row={row} className="h-10 cursor-pointer" onClick={() => setDetailClient(row.original)}>
                        {({ cell }) => <TableCell cell={cell} className="py-1.5 px-3" />}
                      </TableRow>
                    )}
                  </TableBody>
                </TableProvider>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <div className="flex items-center gap-3">
                  <p className="text-xs text-muted-foreground">
                    {filteredClients.length !== clients.length && (
                      <span>{filteredClients.length} filtrado(s) de {clients.length} • </span>
                    )}
                    Mostrando {Math.min((page - 1) * pageSize + 1, filteredClients.length)}–{Math.min(page * pageSize, filteredClients.length)} de{" "}
                    {filteredClients.length}
                  </p>
                  <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                    <SelectTrigger className="h-7 w-[72px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">por página</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-medium px-2">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ClientDetailModal
        client={detailClient}
        open={!!detailClient}
        onOpenChange={(open) => { if (!open) { setDetailClient(null); if (searchParams.has('account')) { searchParams.delete('account'); setSearchParams(searchParams, { replace: true }); } } }}
        onUpdated={refetch}
      />
      <ClientImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={handleImport} />
      <NewDealFromClientDialog
        open={dealDialogOpen}
        onOpenChange={setDealDialogOpen}
        preSelectedClientId={dealPreselectedClientId}
        onSuccess={() => {
          setDealPreselectedClientId(undefined);
        }}
      />
    </div>
  );
}
