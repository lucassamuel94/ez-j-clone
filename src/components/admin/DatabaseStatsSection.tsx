import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { BarChart3, Loader2, RefreshCw, Users, Building2, Phone, Brain, MapPin, Download, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Copy, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

type LeadFilter = 'todos' | 'sdr' | 'closer';
type SortDir = 'asc' | 'desc' | null;
type SortField = 'company' | 'name' | 'cnpj' | 'phone' | 'email' | 'status' | 'owner_name' | 'location';

interface DbStats {
  totalLeads: number;
  semCnpj: number;
  semRazaoSocial: number;
  semNomeFantasia: number;
  semTelefone: number;
  semEnriquecimentoIA: number;
  semPerplexity: number;
  semEmail: number;
  semSegmento: number;
  semCnae: number;
  semCidade: number;
  semEstado: number;
  comRazaoSemCnpj: number;
}

interface StatItemDef {
  label: string;
  value: number;
  icon: any;
  color: string;
  key: string;
}

interface DrillDownLead {
  id: string;
  name: string;
  company: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  owner_name?: string;
  city: string | null;
  state: string | null;
}

const CLOSER_STATUSES = ['Oportunidade criada'] as const;
const PAGE_SIZE = 1000;
const DRILL_PAGE_SIZE = 50;

interface DatabaseStatsProps {
  externalTeamFilter?: string;
  externalUserIds?: string[];
  externalStatuses?: string[];
  externalTeamMemberIds?: string[];
}

export const DatabaseStatsSection = ({ externalTeamFilter, externalUserIds, externalStatuses, externalTeamMemberIds }: DatabaseStatsProps = {}) => {
  const hasExternalFilters = externalTeamFilter !== undefined || (externalUserIds && externalUserIds.length > 0) || (externalStatuses && externalStatuses.length > 0);
  const [stats, setStats] = useState<DbStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<LeadFilter>('todos');

  // Drill-down modal state
  const [selectedStat, setSelectedStat] = useState<StatItemDef | null>(null);
  const [drillLeads, setDrillLeads] = useState<DrillDownLead[]>([]);
  const [isDrillLoading, setIsDrillLoading] = useState(false);
  const [drillTotal, setDrillTotal] = useState(0);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [drillPage, setDrillPage] = useState(0);

  // Dedup state
  const [dedupOpen, setDedupOpen] = useState(false);
  const [dedupLoading, setDedupLoading] = useState(false);
  const [dedupPreview, setDedupPreview] = useState<any>(null);
  const [dedupConfirmOpen, setDedupConfirmOpen] = useState(false);
  const [dedupExecuting, setDedupExecuting] = useState(false);
  const [dedupResult, setDedupResult] = useState<any>(null);

  // Selection & delete state for drill-down
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const buildQuery = useCallback((extraFilter?: string) => {
    let q = supabase.from('leads').select('id', { count: 'exact', head: true });
    
    // Apply external filters if provided
    if (hasExternalFilters) {
      if (externalUserIds && externalUserIds.length > 0) {
        q = q.in('owner_user_id', externalUserIds);
      } else if (externalTeamMemberIds && externalTeamMemberIds.length > 0) {
        q = q.in('owner_user_id', externalTeamMemberIds);
      }
      if (externalStatuses && externalStatuses.length > 0) {
        q = q.in('status', externalStatuses as any);
      }
    } else {
      if (filter === 'closer') {
        q = q.in('status', CLOSER_STATUSES);
      } else if (filter === 'sdr') {
        q = q.not('status', 'in', `(${CLOSER_STATUSES.join(',')})`);
      }
    }
    return q;
  }, [filter, hasExternalFilters, externalTeamFilter, JSON.stringify(externalUserIds), JSON.stringify(externalStatuses), JSON.stringify(externalTeamMemberIds)]);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        { count: totalLeads },
        { count: semCnpj },
        { count: semRazaoSocial },
        { count: semNomeFantasia },
        { count: semTelefone },
        { count: semEnriquecimentoIA },
        { count: semPerplexity },
        { count: semEmail },
        { count: semSegmento },
        { count: semCnae },
        { count: semCidade },
        { count: semEstado },
        { count: comRazaoSemCnpj },
      ] = await Promise.all([
        buildQuery(),
        buildQuery().or('cnpj.is.null,cnpj.eq.,cnpj.eq.0'),
        buildQuery().or('razao_social.is.null,razao_social.eq.'),
        buildQuery().or('nome_fantasia.is.null,nome_fantasia.eq.'),
        buildQuery().or('phone.is.null,phone.eq.'),
        buildQuery().is('ai_enrichment_data', null),
        buildQuery().not('cnpj', 'is', null).neq('cnpj', '').is('ai_enrichment_data', null),
        buildQuery().or('email.is.null,email.eq.'),
        buildQuery().or('company_segment.is.null,company_segment.eq.'),
        buildQuery().or('cnae_fiscal_descricao.is.null,cnae_fiscal_descricao.eq.'),
        buildQuery().or('city.is.null,city.eq.'),
        buildQuery().or('state.is.null,state.eq.'),
        buildQuery().not('razao_social', 'is', null).neq('razao_social', '').or('cnpj.is.null,cnpj.eq.,cnpj.eq.0'),
      ]);

      setStats({
        totalLeads: totalLeads ?? 0,
        semCnpj: semCnpj ?? 0,
        semRazaoSocial: semRazaoSocial ?? 0,
        semNomeFantasia: semNomeFantasia ?? 0,
        semTelefone: semTelefone ?? 0,
        semEnriquecimentoIA: semEnriquecimentoIA ?? 0,
        semPerplexity: semPerplexity ?? 0,
        semEmail: semEmail ?? 0,
        semSegmento: semSegmento ?? 0,
        semCnae: semCnae ?? 0,
        semCidade: semCidade ?? 0,
        semEstado: semEstado ?? 0,
        comRazaoSemCnpj: comRazaoSemCnpj ?? 0,
      });
    } catch (error) {
      console.error('Error fetching db stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const pct = (val: number) => {
    if (!stats || stats.totalLeads === 0) return 0;
    return Math.round((val / stats.totalLeads) * 100);
  };

  // Apply the stat-specific filter to a query that selects lead data
  const applyStatFilter = (q: any, statKey: string) => {
    // Apply team/user/status filter first
    if (hasExternalFilters) {
      if (externalUserIds && externalUserIds.length > 0) {
        q = q.in('owner_user_id', externalUserIds);
      } else if (externalTeamMemberIds && externalTeamMemberIds.length > 0) {
        q = q.in('owner_user_id', externalTeamMemberIds);
      }
      if (externalStatuses && externalStatuses.length > 0) {
        q = q.in('status', externalStatuses as any);
      }
    } else {
      if (filter === 'closer') {
        q = q.in('status', CLOSER_STATUSES);
      } else if (filter === 'sdr') {
        q = q.not('status', 'in', `(${CLOSER_STATUSES.join(',')})`);
      }
    }

    switch (statKey) {
      case 'semCnpj':
        return q.or('cnpj.is.null,cnpj.eq.,cnpj.eq.0');
      case 'comRazaoSemCnpj':
        return q.not('razao_social', 'is', null).neq('razao_social', '').or('cnpj.is.null,cnpj.eq.,cnpj.eq.0');
      case 'semRazaoSocial':
        return q.or('razao_social.is.null,razao_social.eq.');
      case 'semNomeFantasia':
        return q.or('nome_fantasia.is.null,nome_fantasia.eq.');
      case 'semTelefone':
        return q.or('phone.is.null,phone.eq.');
      case 'semEmail':
        return q.or('email.is.null,email.eq.');
      case 'semEnriquecimentoIA':
        return q.is('ai_enrichment_data', null);
      case 'semPerplexity':
        return q.not('cnpj', 'is', null).neq('cnpj', '').is('ai_enrichment_data', null);
      case 'semSegmento':
        return q.or('company_segment.is.null,company_segment.eq.');
      case 'semCnae':
        return q.or('cnae_fiscal_descricao.is.null,cnae_fiscal_descricao.eq.');
      case 'semCidade':
        return q.or('city.is.null,city.eq.');
      case 'semEstado':
        return q.or('state.is.null,state.eq.');
      default:
        return q;
    }
  };

  const handleStatClick = async (item: StatItemDef) => {
    setSelectedStat(item);
    setDrillLeads([]);
    setDrillTotal(item.value);
    setIsDrillLoading(true);
    setSortField(null);
    setSortDir(null);
    setDrillPage(0);
    setSelectedIds(new Set());

    try {
      let q = supabase
        .from('leads')
        .select('id, name, company, razao_social, nome_fantasia, cnpj, phone, email, status, owner_user_id, city, state')
        .order('created_at', { ascending: false })
        .limit(200);

      q = applyStatFilter(q, item.key);

      const { data, error } = await q;
      if (error) throw error;

      const ownerIds = [...new Set((data || []).map(l => l.owner_user_id).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', ownerIds);
        if (profiles) {
          profileMap = Object.fromEntries(profiles.map(p => [p.id, p.name]));
        }
      }

      setDrillLeads(
        (data || []).map(l => ({
          ...l,
          owner_name: l.owner_user_id ? profileMap[l.owner_user_id] || '—' : '—',
        }))
      );
    } catch (err) {
      console.error('Error fetching drill-down leads:', err);
      toast.error('Erro ao buscar leads');
    } finally {
      setIsDrillLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    setDrillPage(0);
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortField(null); setSortDir(null); }
      else setSortDir('asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const getFieldValue = (lead: DrillDownLead, field: SortField): string => {
    switch (field) {
      case 'company': return (lead.razao_social || lead.nome_fantasia || lead.company || '').toLowerCase();
      case 'name': return (lead.name || '').toLowerCase();
      case 'cnpj': return (lead.cnpj || '').toLowerCase();
      case 'phone': return (lead.phone || '').toLowerCase();
      case 'email': return (lead.email || '').toLowerCase();
      case 'status': return (lead.status || '').toLowerCase();
      case 'owner_name': return (lead.owner_name || '').toLowerCase();
      case 'location': return [lead.city, lead.state].filter(Boolean).join('/').toLowerCase();
      default: return '';
    }
  };

  const sortedLeads = useMemo(() => {
    if (!sortField || !sortDir) return drillLeads;
    return [...drillLeads].sort((a, b) => {
      const va = getFieldValue(a, sortField);
      const vb = getFieldValue(b, sortField);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [drillLeads, sortField, sortDir]);

  const totalDrillPages = Math.max(1, Math.ceil(sortedLeads.length / DRILL_PAGE_SIZE));
  const paginatedLeads = sortedLeads.slice(drillPage * DRILL_PAGE_SIZE, (drillPage + 1) * DRILL_PAGE_SIZE);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    if (sortDir === 'asc') return <ArrowUp className="h-3 w-3 ml-1 text-primary" />;
    return <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const handleExportExcel = async () => {
    if (!selectedStat) return;
    toast.info('Gerando arquivo Excel...');

    try {
      // Fetch ALL leads matching filter (paginated)
      let allLeads: any[] = [];
      let page = 0;

      while (true) {
        let q = supabase
          .from('leads')
          .select('id, name, company, razao_social, nome_fantasia, cnpj, phone, phone_2, email, status, owner_user_id, city, state, company_segment, source, created_at')
          .order('created_at', { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        q = applyStatFilter(q, selectedStat.key);

        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;

        allLeads = allLeads.concat(data);
        if (data.length < PAGE_SIZE) break;
        page++;
      }

      // Fetch owner names
      const ownerIds = [...new Set(allLeads.map(l => l.owner_user_id).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', ownerIds);
        if (profiles) {
          profileMap = Object.fromEntries(profiles.map(p => [p.id, p.name]));
        }
      }

      const rows = allLeads.map(l => ({
        'Nome': l.name,
        'Empresa': l.company,
        'Razão Social': l.razao_social || '',
        'Nome Fantasia': l.nome_fantasia || '',
        'CNPJ': l.cnpj || '',
        'Telefone': l.phone || '',
        'Telefone 2': l.phone_2 || '',
        'Email': l.email || '',
        'Status': l.status,
        'Responsável': l.owner_user_id ? (profileMap[l.owner_user_id] || '') : '',
        'Cidade': l.city || '',
        'Estado': l.state || '',
        'Segmento': l.company_segment || '',
        'Origem': l.source || '',
        'Criado em': l.created_at ? new Date(l.created_at).toLocaleDateString('pt-BR') : '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leads');

      const safeName = selectedStat.label.replace(/[^a-zA-Z0-9À-ú ]/g, '').replace(/\s+/g, '_');
      XLSX.writeFile(wb, `${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${allLeads.length} leads exportados com sucesso!`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Erro ao exportar leads');
    }
  };

  const toggleSelectLead = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === sortedLeads.length && sortedLeads.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedLeads.map(l => l.id)));
    }
  }, [selectedIds.size, sortedLeads]);

  const toggleSelectPage = useCallback(() => {
    const pageIds = paginatedLeads.map(l => l.id);
    const allPageSelected = pageIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach(id => next.delete(id));
      } else {
        pageIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, [paginatedLeads, selectedIds]);

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const idsToDelete = Array.from(selectedIds);

      // Delete related records first
      for (const table of ['lead_notes', 'interactions', 'lead_cadences', 'meetings', 'lead_activity_logs', 'lead_contacts', 'lead_score_history', 'sent_emails']) {
        await supabase.from(table as any).delete().in('lead_id', idsToDelete);
      }
      // Nullify optional FKs
      for (const table of ['call_history', 'call_analyses', 'form_submissions', 'ai_usage_logs']) {
        await supabase.from(table as any).update({ lead_id: null }).in('lead_id', idsToDelete);
      }
      // Delete opportunities and projects linked
      await supabase.from('opportunities').delete().in('lead_id', idsToDelete);
      await supabase.from('project_tasks').delete().in('lead_id', idsToDelete);
      await supabase.from('projects').delete().in('lead_id', idsToDelete);

      const { error } = await supabase.from('leads').delete().in('id', idsToDelete);
      if (error) throw error;

      // Remove deleted leads from UI
      setDrillLeads(prev => prev.filter(l => !selectedIds.has(l.id)));
      setDrillTotal(prev => prev - idsToDelete.length);
      setSelectedIds(new Set());
      setDeleteConfirmOpen(false);
      toast.success(`${idsToDelete.length} lead(s) deletado(s) com sucesso`);
      fetchStats();
    } catch (err: any) {
      console.error('Error deleting leads:', err);
      toast.error('Erro ao deletar leads: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsDeleting(false);
    }
  };

  const statItems: StatItemDef[] = stats ? [
    { label: 'Sem CNPJ', value: stats.semCnpj, icon: Building2, color: 'text-warning', key: 'semCnpj' },
    { label: 'Com Razão Social, sem CNPJ', value: stats.comRazaoSemCnpj, icon: Building2, color: 'text-warning', key: 'comRazaoSemCnpj' },
    { label: 'Sem Razão Social', value: stats.semRazaoSocial, icon: Building2, color: 'text-warning', key: 'semRazaoSocial' },
    { label: 'Sem Nome Fantasia', value: stats.semNomeFantasia, icon: Building2, color: 'text-warning', key: 'semNomeFantasia' },
    { label: 'Sem Telefone', value: stats.semTelefone, icon: Phone, color: 'text-destructive', key: 'semTelefone' },
    { label: 'Sem Email', value: stats.semEmail, icon: Users, color: 'text-destructive', key: 'semEmail' },
    { label: 'Sem Enriquecimento IA', value: stats.semEnriquecimentoIA, icon: Brain, color: 'text-primary', key: 'semEnriquecimentoIA' },
    { label: 'Pendentes Perplexity (com CNPJ)', value: stats.semPerplexity, icon: Brain, color: 'text-warning', key: 'semPerplexity' },
    { label: 'Sem Segmento', value: stats.semSegmento, icon: BarChart3, color: 'text-info', key: 'semSegmento' },
    { label: 'Sem CNAE', value: stats.semCnae, icon: BarChart3, color: 'text-info', key: 'semCnae' },
    { label: 'Sem Cidade', value: stats.semCidade, icon: MapPin, color: 'text-info', key: 'semCidade' },
    { label: 'Sem Estado', value: stats.semEstado, icon: MapPin, color: 'text-info', key: 'semEstado' },
  ] : [];

  const handleDedupDryRun = useCallback(async () => {
    setDedupLoading(true);
    setDedupPreview(null);
    setDedupResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('deduplicate-leads', {
        body: { dry_run: true },
      });
      if (res.error) throw new Error(res.error.message);
      setDedupPreview(res.data);
      setDedupOpen(true);
    } catch (err: any) {
      toast.error(`Erro ao analisar duplicatas: ${err.message}`);
    } finally {
      setDedupLoading(false);
    }
  }, []);

  const handleDedupExecute = useCallback(async () => {
    setDedupExecuting(true);
    setDedupConfirmOpen(false);
    try {
      let totalRemoved = 0;
      let totalProcessed = 0;
      let allMigrations: Record<string, number> = {};
      let allErrors: string[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const res = await supabase.functions.invoke('deduplicate-leads', {
          body: { dry_run: false, batch_size: 20, offset },
        });
        if (res.error) throw new Error(res.error.message);
        const data = res.data;
        totalRemoved += data.leads_removed || 0;
        totalProcessed += data.groups_processed || 0;
        allErrors = allErrors.concat(data.errors || []);
        for (const [table, count] of Object.entries(data.migrations || {})) {
          allMigrations[table] = (allMigrations[table] || 0) + (count as number);
        }
        hasMore = data.has_more;
        offset = data.next_offset;
      }

      setDedupResult({
        groups_processed: totalProcessed,
        leads_removed: totalRemoved,
        migrations: allMigrations,
        errors: allErrors,
      });
      toast.success(`Deduplicação concluída: ${totalRemoved} leads removidos`);
      fetchStats();
    } catch (err: any) {
      toast.error(`Erro na deduplicação: ${err.message}`);
    } finally {
      setDedupExecuting(false);
    }
  }, [fetchStats]);

  return (
    <>
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Extrato da Base</h3>
          </div>
          <div className="flex items-center gap-2">
            {!hasExternalFilters && (
              <Select value={filter} onValueChange={(v) => setFilter(v as LeadFilter)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="sdr">SDR</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button variant="ghost" size="icon" onClick={fetchStats} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleDedupDryRun}
              disabled={dedupLoading}
            >
              {dedupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Deduplicar
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Visão geral da qualidade dos dados na sua base de leads. Clique em um card para ver os leads.
        </p>
        <div>
          {isLoading && !stats ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : stats ? (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Total de leads{filter !== 'todos' ? ` (${filter.toUpperCase()})` : ''}:</span>
                <Badge variant="secondary" className="text-base">{stats.totalLeads}</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {statItems.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-lg border p-3 space-y-1 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleStatClick(item)}
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className={`h-4 w-4 ${item.color}`} />
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold">{item.value}</span>
                      <Badge variant="outline" className="text-xs">
                        {pct(item.value)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Drill-down Modal */}
      <Dialog open={!!selectedStat} onOpenChange={(open) => { if (!open) setSelectedStat(null); }}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col gap-0 p-0">
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
            <div>
              <h2 className="text-lg font-semibold">{selectedStat?.label}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {drillTotal} leads encontrados {drillLeads.length < drillTotal && `· exibindo ${drillLeads.length}`}
                {selectedIds.size > 0 && (
                  <span className="ml-2 text-primary font-medium">· {selectedIds.size} selecionado(s)</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Deletar ({selectedIds.size})
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportExcel}>
                <Download className="h-4 w-4" />
                Exportar Excel
              </Button>
            </div>
          </div>

          {isDrillLoading ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-auto min-h-0">
                <table className="w-full caption-bottom text-sm">
                  <thead className="sticky top-0 z-10 bg-muted">
                    <tr className="border-b">
                      <th className="h-10 px-3 w-10">
                        <Checkbox
                          checked={paginatedLeads.length > 0 && paginatedLeads.every(l => selectedIds.has(l.id))}
                          onCheckedChange={toggleSelectPage}
                          aria-label="Selecionar página"
                        />
                      </th>
                      {([
                        ['company', 'Empresa'],
                        ['name', 'Contato'],
                        ['cnpj', 'CNPJ'],
                        ['phone', 'Telefone'],
                        ['email', 'Email'],
                        ['status', 'Status'],
                        ['owner_name', 'Responsável'],
                        ['location', 'Cidade/UF'],
                      ] as [SortField, string][]).map(([field, label]) => (
                        <th
                          key={field}
                          className="h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap"
                          onClick={() => handleSort(field)}
                        >
                          <span className="flex items-center">
                            {label}
                            <SortIcon field={field} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLeads.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center text-muted-foreground py-8 text-sm">
                          Nenhum lead encontrado
                        </td>
                      </tr>
                    ) : (
                      paginatedLeads.map((lead) => (
                        <tr key={lead.id} className={cn(
                          "border-b hover:bg-muted/50 transition-colors",
                          selectedIds.has(lead.id) && "bg-primary/5"
                        )}>
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={selectedIds.has(lead.id)}
                              onCheckedChange={() => toggleSelectLead(lead.id)}
                              aria-label={`Selecionar ${lead.name}`}
                            />
                          </td>
                          <td className="px-3 py-2 text-xs font-medium max-w-[160px] truncate">
                            {lead.razao_social || lead.nome_fantasia || lead.company}
                          </td>
                          <td className="px-3 py-2 text-xs max-w-[120px] truncate">{lead.name}</td>
                          <td className="px-3 py-2 text-xs font-mono">{lead.cnpj || '—'}</td>
                          <td className="px-3 py-2 text-xs whitespace-nowrap">{lead.phone || '—'}</td>
                          <td className="px-3 py-2 text-xs max-w-[140px] truncate">{lead.email || '—'}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-[10px] whitespace-nowrap">{lead.status}</Badge>
                          </td>
                          <td className="px-3 py-2 text-xs whitespace-nowrap">{lead.owner_name}</td>
                          <td className="px-3 py-2 text-xs whitespace-nowrap">
                            {[lead.city, lead.state].filter(Boolean).join('/') || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {sortedLeads.length > 0
                      ? `${drillPage * DRILL_PAGE_SIZE + 1}–${Math.min((drillPage + 1) * DRILL_PAGE_SIZE, sortedLeads.length)} de ${sortedLeads.length}`
                      : '0 leads'}
                    {drillLeads.length < drillTotal && ` (total: ${drillTotal})`}
                  </span>
                  {sortedLeads.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={toggleSelectAll}
                    >
                      {selectedIds.size === sortedLeads.length ? 'Limpar seleção' : `Selecionar todos (${sortedLeads.length})`}
                    </Button>
                  )}
                </div>
                {totalDrillPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={drillPage === 0}
                      onClick={() => setDrillPage(p => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs px-2 text-muted-foreground">
                      {drillPage + 1} / {totalDrillPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={drillPage >= totalDrillPages - 1}
                      onClick={() => setDrillPage(p => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dedup Preview Dialog */}
      <Dialog open={dedupOpen} onOpenChange={(open) => { if (!open) { setDedupOpen(false); setDedupResult(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Deduplicação de Leads
            </DialogTitle>
            <DialogDescription>
              Análise de leads duplicados por nome de empresa
            </DialogDescription>
          </DialogHeader>

          {dedupExecuting ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processando deduplicação em batches...</p>
            </div>
          ) : dedupResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Deduplicação concluída!</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Grupos processados</p>
                  <p className="text-lg font-semibold">{dedupResult.groups_processed}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Leads removidos</p>
                  <p className="text-lg font-semibold">{dedupResult.leads_removed}</p>
                </div>
              </div>
              {Object.keys(dedupResult.migrations || {}).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Registros migrados:</p>
                  {Object.entries(dedupResult.migrations).map(([table, count]) => (
                    <div key={table} className="flex items-center justify-between text-xs">
                      <span className="font-mono">{table}</span>
                      <Badge variant="secondary">{count as number}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {(dedupResult.errors || []).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-destructive">Erros ({dedupResult.errors.length}):</p>
                  <ScrollArea className="max-h-32">
                    {dedupResult.errors.map((e: string, i: number) => (
                      <p key={i} className="text-xs text-destructive">{e}</p>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </div>
          ) : dedupPreview ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Grupos duplicados</p>
                  <p className="text-lg font-semibold">{dedupPreview.total_groups}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Leads a remover</p>
                  <p className="text-lg font-semibold text-destructive">{dedupPreview.total_leads_to_remove}</p>
                </div>
              </div>

              {dedupPreview.sample_groups?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Amostra (10 primeiros grupos):</p>
                  <ScrollArea className="max-h-40">
                    <div className="space-y-1">
                      {dedupPreview.sample_groups.map((g: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs rounded border px-2 py-1.5">
                          <span className="truncate max-w-[200px]">{g.company}</span>
                          <Badge variant="outline" className="text-[10px]">
                            -{g.remove_count} lead{g.remove_count > 1 ? 's' : ''}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setDedupOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={() => setDedupConfirmOpen(true)} className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Executar Deduplicação
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={dedupConfirmOpen} onOpenChange={setDedupConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Deduplicação
            </DialogTitle>
            <DialogDescription>
              Esta ação irá remover {dedupPreview?.total_leads_to_remove} leads duplicados 
              e migrar todos os dados relacionados. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDedupConfirmOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDedupExecute}>
              Confirmar e Executar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete leads confirmation */}
      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Confirmar exclusão de leads"
        description={`Tem certeza que deseja excluir ${selectedIds.size} lead(s)? Todos os dados relacionados (notas, interações, oportunidades) serão removidos. Esta ação não pode ser desfeita.`}
        onConfirm={handleDeleteSelected}
        isDeleting={isDeleting}
      />
    </>
  );
};
