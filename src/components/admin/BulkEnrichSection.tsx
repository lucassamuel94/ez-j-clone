import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Database, Loader2, CheckCircle2, AlertCircle, Search, Users, X, AlertTriangle, ChevronDown, Play } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { DatabaseStatsSection } from './DatabaseStatsSection';
import { CnpjaFailedLeadsDialog } from './CnpjaFailedLeadsDialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTeams } from '@/hooks/useTeams';

interface UserProfile {
  id: string;
  name: string;
  role: string;
}

interface CnpjaLogEntry {
  leadId?: string;
  company: string;
  searchName: string;
  status: 'found' | 'not_found' | 'skipped' | 'error';
  skipReason?: string;
  cnpjReturned?: string;
  razaoSocialReturned?: string;
  fieldsUpdated: string[];
  errorMsg?: string;
  source?: 'cnpja' | 'perplexity';
}

interface CnpjaJob {
  id: string;
  status: string;
  total_eligible: number;
  total_processed: number;
  cnpja_success: number;
  perplexity_success: number;
  not_found_count: number;
  skipped_count: number;
  error_count: number;
  processed: number;
  logs: CnpjaLogEntry[];
  error_message: string | null;
  created_at: string;
  options?: {
    run_cnpja?: boolean;
    run_perplexity?: boolean;
    enrich_perplexity?: boolean;
  };
}

const BATCH_SIZE = 10;

// Helper to determine active source from job options
function getJobSource(job: CnpjaJob | null): 'cnpja' | 'perplexity' | 'both' {
  if (!job?.options) return 'cnpja';
  const opts = job.options;
  const runCnpja = opts.run_cnpja !== undefined ? !!opts.run_cnpja : true;
  const runPerplexity = opts.run_perplexity !== undefined ? !!opts.run_perplexity : !!opts.enrich_perplexity;
  if (runCnpja && runPerplexity) return 'both';
  if (runPerplexity) return 'perplexity';
  return 'cnpja';
}

// Helper to get the "found" count relevant to the active source
function getSuccessCount(job: CnpjaJob | null): number {
  if (!job) return 0;
  const source = getJobSource(job);
  if (source === 'perplexity') return job.perplexity_success || 0;
  if (source === 'cnpja') return job.cnpja_success || 0;
  return (job.cnpja_success || 0) + (job.perplexity_success || 0);
}

function getSourceLabel(source: 'cnpja' | 'perplexity' | 'both'): string {
  if (source === 'perplexity') return 'Perplexity IA';
  if (source === 'both') return 'CNPJá + Perplexity';
  return 'CNPJá';
}

export const BulkEnrichSection = () => {
  const [cnpjaLimit, setCnpjaLimit] = useState<string>('');
  const [enrichSource, setEnrichSource] = useState<'cnpja' | 'perplexity' | 'both'>('cnpja');
  const [ignoreCnpjaCache, setIgnoreCnpjaCache] = useState(false);
  const [cacheDays, setCacheDays] = useState<number>(90);
  const [preserveExisting, setPreserveExisting] = useState(false);

  // CNPJá background job state
  const [cnpjaJob, setCnpjaJob] = useState<CnpjaJob | null>(null);
  const [cnpjaLogs, setCnpjaLogs] = useState<CnpjaLogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Team/User/Status filter state
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedDataConditions, setSelectedDataConditions] = useState<string[]>(['sem_cnpj']);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showConditionPicker, setShowConditionPicker] = useState(false);
  const userPickerRef = useRef<HTMLDivElement>(null);
  const statusPickerRef = useRef<HTMLDivElement>(null);
  const conditionPickerRef = useRef<HTMLDivElement>(null);

  const DATA_CONDITIONS = [
    { key: 'sem_cnpj', label: 'Sem CNPJ', field: 'cnpj', mode: 'empty' as const },
    { key: 'com_cnpj', label: 'Com CNPJ', field: 'cnpj', mode: 'filled' as const },
    { key: 'sem_telefone', label: 'Sem Telefone', field: 'phone', mode: 'empty' as const },
    { key: 'sem_email', label: 'Sem Email', field: 'email', mode: 'empty' as const },
    { key: 'sem_nome_fantasia', label: 'Sem Nome Fantasia', field: 'nome_fantasia', mode: 'empty' as const },
    { key: 'sem_razao_social', label: 'Sem Razão Social', field: 'razao_social', mode: 'empty' as const },
    { key: 'sem_website', label: 'Sem Website', field: 'website', mode: 'empty' as const },
    { key: 'sem_segmento', label: 'Sem Segmento', field: 'company_segment', mode: 'empty' as const },
    { key: 'sem_cidade', label: 'Sem Cidade', field: 'city', mode: 'empty' as const },
    { key: 'sem_porte', label: 'Sem Porte', field: 'porte', mode: 'empty' as const },
    { key: 'sem_cnae', label: 'Sem CNAE', field: 'cnae_fiscal_descricao', mode: 'empty' as const },
  ] as const;

  // Fetch real teams from DB
  const { teams, teamMembers } = useTeams();

  // Filter profiles by selected team
  const filteredProfiles = useMemo(() => {
    if (teamFilter === 'all') return profiles;
    const memberUserIds = teamMembers
      .filter(m => m.team_id === teamFilter)
      .map(m => m.user_id);
    return profiles.filter(p => memberUserIds.includes(p.id));
  }, [teamFilter, profiles, teamMembers]);

  // Failed leads dialog state
  const [failedDialogOpen, setFailedDialogOpen] = useState(false);

  // Query: leads without CNPJ grouped by owner
  const filterKey = useMemo(() => ({
    team: teamFilter,
    users: selectedUserIds,
    statuses: selectedStatuses,
    conditions: selectedDataConditions,
    filteredProfileIds: filteredProfiles.map(p => p.id),
  }), [teamFilter, selectedUserIds, selectedStatuses, selectedDataConditions, filteredProfiles]);

  const { data: filteredLeadsConsolidated } = useQuery({
    queryKey: ['leads-filtered-consolidated', filterKey],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('owner_user_id');

      // Apply data condition filters (AND — lead must match ALL selected conditions)
      for (const condKey of selectedDataConditions) {
        const cond = DATA_CONDITIONS.find(c => c.key === condKey);
        if (cond) {
          if (cond.mode === 'filled') {
            query = query.not(cond.field, 'is', null).neq(cond.field, '');
          } else {
            query = query.or(`${cond.field}.is.null,${cond.field}.eq.`);
          }
        }
      }

      // Apply user filters
      const hasNone = selectedUserIds.includes('__none__');
      const realUserIds = selectedUserIds.filter(id => id !== '__none__');
      const targetUserIds = realUserIds.length > 0
        ? realUserIds
        : teamFilter !== 'all'
          ? filteredProfiles.map(p => p.id)
          : [];

      if (hasNone && targetUserIds.length > 0) {
        query = query.or(`owner_user_id.is.null,owner_user_id.in.(${targetUserIds.join(',')})`);
      } else if (hasNone) {
        query = query.is('owner_user_id', null);
      } else if (targetUserIds.length > 0) {
        query = query.in('owner_user_id', targetUserIds);
      }

      if (selectedStatuses.length > 0) {
        query = query.in('status', selectedStatuses as any);
      }

      const { data, error } = await query.limit(5000);
      if (error) throw error;

      // Group by owner_user_id
      const counts: Record<string, number> = {};
      (data || []).forEach(row => {
        const uid = row.owner_user_id || '__none__';
        counts[uid] = (counts[uid] || 0) + 1;
      });

      // Map to names from profiles
      return Object.entries(counts)
        .map(([userId, count]) => ({
          userId,
          name: userId === '__none__'
            ? 'Sem responsável'
            : profiles.find(p => p.id === userId)?.name || 'Desconhecido',
          count,
        }))
        .sort((a, b) => b.count - a.count);
    },
    staleTime: 60_000,
    enabled: profiles.length > 0,
  });

  const isRunning = false; // kept for disabled checks on filters
  const isSearchingCnpja = cnpjaJob?.status === 'running';

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showUserPicker && userPickerRef.current && !userPickerRef.current.contains(e.target as Node)) {
        setShowUserPicker(false);
      }
      if (showStatusPicker && statusPickerRef.current && !statusPickerRef.current.contains(e.target as Node)) {
        setShowStatusPicker(false);
      }
      if (showConditionPicker && conditionPickerRef.current && !conditionPickerRef.current.contains(e.target as Node)) {
        setShowConditionPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserPicker, showStatusPicker, showConditionPicker]);

  const ALL_STATUSES = [
    'Novo', 'Em contato', 'Ocupado', 'Agendar retorno',
    'Sem retorno', 'Interesse', 'Interesse/Agendar Retorno', 'Reagendar Reunião',
    'Oportunidade criada', 'Descartado', 'Reciclagem', 'Devolvido pelo Closer',
  ];

  // Fetch profiles on mount
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('active', true)
        .order('name');
      if (data) setProfiles(data);
    };
    fetchProfiles();
  }, []);

  // Check for existing running CNPJá job on mount
  useEffect(() => {
    const checkRunningJob = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) return;
      
      const { data } = await supabase
        .from('enrichment_jobs')
        .select('*')
        .eq('job_type', 'cnpja_search')
        .eq('status', 'running')
        .order('created_at', { ascending: false })
        .limit(1) as any;
      
      if (data && data.length > 0) {
        const job = data[0];
        setCnpjaJob(job as CnpjaJob);
        setCnpjaLogs(Array.isArray(job.logs) ? job.logs : []);
      }
    };
    checkRunningJob();
  }, []);

  // Subscribe to realtime updates for the active job
  useEffect(() => {
    if (!cnpjaJob?.id) return;

    const channel = supabase
      .channel(`enrichment-job-${cnpjaJob.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'enrichment_jobs',
          filter: `id=eq.${cnpjaJob.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setCnpjaJob(updated as CnpjaJob);
          setCnpjaLogs(Array.isArray(updated.logs) ? updated.logs : []);

          if (updated.status === 'completed') {
            const source = getJobSource(updated as CnpjaJob);
            const successCount = getSuccessCount(updated as CnpjaJob);
            toast.success(`Enriquecimento ${getSourceLabel(source)} concluído: ${successCount} encontrados, ${updated.processed || 0} atualizados`);
          } else if (updated.status === 'error') {
            toast.error(`Erro no enriquecimento: ${updated.error_message || 'Erro desconhecido'}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cnpjaJob?.id]);

  // Auto-scroll log container
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [cnpjaLogs]);

  const CLOSER_STATUS = 'Oportunidade criada';

  const getOwnerFilter = () => {
    const base: any = {};
    const hasNone = selectedUserIds.includes('__none__');
    const realIds = selectedUserIds.filter(id => id !== '__none__');
    if (realIds.length > 0 || hasNone) {
      base.userFilter = { type: 'users' as const, ids: realIds, includeUnassigned: hasNone };
    } else if (teamFilter !== 'all') {
      const memberIds = teamMembers
        .filter(m => m.team_id === teamFilter)
        .map(m => m.user_id);
      if (memberIds.length > 0) {
        base.userFilter = { type: 'users' as const, ids: memberIds };
      }
    }
    if (selectedStatuses.length > 0) base.statuses = selectedStatuses;
    return base;
  };

  const handleCnpjaSearch = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) {
        toast.error('Usuário não autenticado');
        return;
      }

      // Count eligible leads first
      const filter = getOwnerFilter();
      let countQuery = supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .or('company.neq.,razao_social.neq.');

      // Apply same data condition filters
      for (const condKey of selectedDataConditions) {
        const cond = DATA_CONDITIONS.find(c => c.key === condKey);
        if (cond) {
          if (cond.mode === 'filled') {
            countQuery = countQuery.not(cond.field, 'is', null).neq(cond.field, '');
          } else {
            countQuery = countQuery.or(`${cond.field}.is.null,${cond.field}.eq.`);
          }
        }
      }

      if (filter?.userFilter) {
        if (filter.userFilter.includeUnassigned && filter.userFilter.ids.length > 0) {
          countQuery = countQuery.or(`owner_user_id.is.null,owner_user_id.in.(${filter.userFilter.ids.join(',')})`);
        } else if (filter.userFilter.includeUnassigned) {
          countQuery = countQuery.is('owner_user_id', null);
        } else {
          countQuery = countQuery.in('owner_user_id', filter.userFilter.ids);
        }
      }
      if (filter?.statuses?.length > 0) {
        countQuery = countQuery.in('status', filter.statuses);
      }

      const { count } = await countQuery;
      const userLimit = cnpjaLimit ? parseInt(cnpjaLimit, 10) : 0;
      const totalEligible = userLimit > 0 ? Math.min(count || 0, userLimit) : (count || 0);

      if (totalEligible === 0) {
        toast.info('Nenhum lead elegível encontrado');
        return;
      }

      // Determine source flags
      const runCnpja = enrichSource === 'cnpja' || enrichSource === 'both';
      const runPerplexity = enrichSource === 'perplexity' || enrichSource === 'both';

      // Create the job
      const jobData: any = {
        started_by: user.user.id,
        total_eligible: totalEligible,
        status: 'running',
        job_type: 'cnpja_search',
        options: {
          preserve_existing: preserveExisting,
          ignore_cache: ignoreCnpjaCache,
          cache_days: cacheDays,
          run_cnpja: runCnpja,
          run_perplexity: runPerplexity,
          enrich_perplexity: runPerplexity, // backward compat
          user_limit: userLimit,
          user_filter: filter?.userFilter || null,
          status_filter: filter?.statuses || null,
          data_conditions: selectedDataConditions,
        },
        logs: [],
      };

      const { data: newJob, error: insertError } = await supabase
        .from('enrichment_jobs')
        .insert(jobData as any)
        .select()
        .single();

      if (insertError) throw insertError;

      setCnpjaJob(newJob as unknown as CnpjaJob);
      setCnpjaLogs([]);
      const sourceLabel = getSourceLabel(enrichSource);
      const timeHint = enrichSource !== 'cnpja' ? ' Primeiros resultados em ~10s.' : '';
      toast.success(`Enriquecimento ${sourceLabel} iniciado para ~${totalEligible} leads.${timeHint} Pode trocar de aba!`);

      // Trigger the edge function
      await supabase.functions.invoke('bulk-cnpja-search', {
        body: { job_id: (newJob as any).id, offset: 0 },
      });
    } catch (error: any) {
      console.error('Error starting enrichment job:', error);
      toast.error('Erro ao iniciar enriquecimento: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleCancelCnpja = async () => {
    if (!cnpjaJob?.id) return;
    try {
      await supabase
        .from('enrichment_jobs')
        .update({ status: 'cancelled' } as any)
        .eq('id', cnpjaJob.id);
      const source = getJobSource(cnpjaJob);
      toast.info(`Enriquecimento ${getSourceLabel(source)} cancelado. Progresso parcial salvo.`);
      setCnpjaJob(prev => prev ? { ...prev, status: 'cancelled' } : null);
    } catch (err) {
      toast.error('Erro ao cancelar');
    }
  };

  const handleDismissJob = () => {
    setCnpjaJob(null);
    setCnpjaLogs([]);
  };

  const cnpjaJobDone = cnpjaJob && (cnpjaJob.status === 'completed' || cnpjaJob.status === 'cancelled' || cnpjaJob.status === 'error');
  const activeJobSource = getJobSource(cnpjaJob);

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <CardTitle>Enriquecimento de Dados</CardTitle>
        </div>
        <CardDescription>
          Atualize dados cadastrais e de mercado dos seus leads automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* ── FILTRO DE EQUIPE / USUÁRIO ── */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Etapa 1 — Filtro de Leads</h3>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Equipe</Label>
              <Select value={teamFilter} onValueChange={(v) => { setTeamFilter(v); setSelectedUserIds([]); }} disabled={isRunning || isSearchingCnpja}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {teams.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground">Responsáveis específicos</Label>
              <div className="relative" ref={userPickerRef}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full h-8 text-xs justify-start font-normal"
                  onClick={() => setShowUserPicker(!showUserPicker)}
                  disabled={isRunning || isSearchingCnpja}
                >
                  {selectedUserIds.length === 0 
                    ? 'Todos os responsáveis' 
                    : `${selectedUserIds.length} selecionado(s)`}
                </Button>
                {showUserPicker && (
                  <div className="absolute z-10 top-9 left-0 w-full max-h-48 overflow-y-auto bg-popover border rounded-md shadow-md p-2 space-y-1">
                    <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted rounded px-1 py-0.5">
                      <Checkbox 
                        checked={selectedUserIds.includes('__none__')}
                        onCheckedChange={(checked) => {
                          setSelectedUserIds(prev => 
                            checked ? [...prev, '__none__'] : prev.filter(id => id !== '__none__')
                          );
                        }}
                      />
                      <span className="italic text-muted-foreground">Não atribuído</span>
                    </label>
                    {filteredProfiles.map(p => (
                      <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted rounded px-1 py-0.5">
                        <Checkbox 
                          checked={selectedUserIds.includes(p.id)}
                          onCheckedChange={(checked) => {
                            setSelectedUserIds(prev => 
                              checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                            );
                          }}
                        />
                        <span>{p.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto">{p.role}</Badge>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Selected users chips */}
          {selectedUserIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedUserIds.map(uid => {
                const isNone = uid === '__none__';
                const user = isNone ? null : profiles.find(p => p.id === uid);
                return (
                  <Badge key={uid} variant="secondary" className="text-xs gap-1">
                    {isNone ? 'Não atribuído' : (user?.name || uid.slice(0, 8))}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedUserIds(prev => prev.filter(id => id !== uid))} />
                  </Badge>
                );
              })}
              <Button variant="ghost" size="sm" className="h-5 text-xs px-1" onClick={() => setSelectedUserIds([])}>Limpar</Button>
            </div>
          )}

          {/* Status filter */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <div className="relative" ref={statusPickerRef}>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full h-8 text-xs justify-start font-normal"
                onClick={() => setShowStatusPicker(!showStatusPicker)}
                disabled={isRunning || isSearchingCnpja}
              >
                {selectedStatuses.length === 0 
                  ? 'Todos os status' 
                  : `${selectedStatuses.length} status selecionado(s)`}
              </Button>
              {showStatusPicker && (
                <div className="absolute z-10 top-9 left-0 w-full max-h-48 overflow-y-auto bg-popover border rounded-md shadow-md p-2 space-y-1">
                  {ALL_STATUSES.map(s => (
                    <label key={s} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted rounded px-1 py-0.5">
                      <Checkbox 
                        checked={selectedStatuses.includes(s)}
                        onCheckedChange={(checked) => {
                          setSelectedStatuses(prev => 
                            checked ? [...prev, s] : prev.filter(st => st !== s)
                          );
                        }}
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected statuses chips */}
          {selectedStatuses.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedStatuses.map(s => (
                <Badge key={s} variant="secondary" className="text-xs gap-1">
                  {s}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedStatuses(prev => prev.filter(st => st !== s))} />
                </Badge>
              ))}
              <Button variant="ghost" size="sm" className="h-5 text-xs px-1" onClick={() => setSelectedStatuses([])}>Limpar</Button>
            </div>
           )}

          {/* Data condition filter */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Condição dos dados</Label>
            <div className="relative" ref={conditionPickerRef}>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full h-8 text-xs justify-start font-normal"
                onClick={() => setShowConditionPicker(!showConditionPicker)}
                disabled={isRunning || isSearchingCnpja}
              >
                {selectedDataConditions.length === 0 
                  ? 'Todos (sem filtro de campo)' 
                  : `${selectedDataConditions.length} condição(ões) selecionada(s)`}
              </Button>
              {showConditionPicker && (
                <div className="absolute z-10 top-9 left-0 w-full max-h-48 overflow-y-auto bg-popover border rounded-md shadow-md p-2 space-y-1">
                  {DATA_CONDITIONS.map(c => (
                    <label key={c.key} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted rounded px-1 py-0.5">
                      <Checkbox 
                        checked={selectedDataConditions.includes(c.key)}
                        onCheckedChange={(checked) => {
                          setSelectedDataConditions(prev => 
                            checked ? [...prev, c.key] : prev.filter(k => k !== c.key)
                          );
                        }}
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected conditions chips */}
          {selectedDataConditions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedDataConditions.map(key => {
                const cond = DATA_CONDITIONS.find(c => c.key === key);
                return (
                  <Badge key={key} variant="secondary" className="text-xs gap-1">
                    {cond?.label || key}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedDataConditions(prev => prev.filter(k => k !== key))} />
                  </Badge>
                );
              })}
              <Button variant="ghost" size="sm" className="h-5 text-xs px-1" onClick={() => setSelectedDataConditions([])}>Limpar</Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {teamFilter === 'all' && selectedUserIds.length === 0 && selectedStatuses.length === 0 && selectedDataConditions.length === 0 && 'Enriquecendo todos os leads.'}
            {teamFilter !== 'all' && selectedUserIds.length === 0 && (() => {
              const teamName = teams.find(t => t.id === teamFilter)?.name || teamFilter;
              return `Apenas leads dos membros da equipe "${teamName}".`;
            })()}
            {selectedUserIds.length > 0 && `Apenas leads dos ${selectedUserIds.length} responsáveis selecionados. `}
            {selectedStatuses.length > 0 && `Filtrado por ${selectedStatuses.length} status. `}
            {selectedDataConditions.length > 0 && `Filtrado por ${selectedDataConditions.length} condição(ões) de dados.`}
          </p>

          {/* Consolidated: filtered leads per user */}
          {filteredLeadsConsolidated && filteredLeadsConsolidated.length > 0 && (
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
                <h4 className="text-xs font-semibold text-muted-foreground">
                  {selectedDataConditions.length > 0 
                    ? `Leads filtrados por responsável (${selectedDataConditions.map(k => DATA_CONDITIONS.find(c => c.key === k)?.label).join(', ')})`
                    : 'Leads por responsável'}
                </h4>
                <ChevronDown className="h-3.5 w-3.5 ml-auto text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border">
                      <TableHead className="h-7 px-2 text-xs">Responsável</TableHead>
                      <TableHead className="h-7 px-2 text-xs text-right">Qtd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeadsConsolidated.map(row => (
                      <TableRow key={row.userId} className="border-b border-border/50">
                        <TableCell className="py-1 px-2 text-xs">{row.name}</TableCell>
                        <TableCell className="py-1 px-2 text-xs text-right font-medium">{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="py-1 px-2 text-xs font-semibold">Total</TableCell>
                      <TableCell className="py-1 px-2 text-xs text-right font-semibold">
                        {filteredLeadsConsolidated.reduce((sum, r) => sum + r.count, 0)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <Separator />
        {/* ── SEÇÃO 2: Enriquecer dados — Background ── */}
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Etapa 2 — Enriquecer dados</h3>
          </div>

          {/* Source selector */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Fonte de enriquecimento</Label>
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'cnpja' as const, label: 'CNPJá', desc: 'Dados cadastrais (CNPJ, razão social, endereço, CNAE)' },
                { value: 'perplexity' as const, label: 'Perplexity IA', desc: 'Dados de mercado (segmento, site, telefones, redes)' },
                { value: 'both' as const, label: 'Ambos', desc: 'CNPJá + Perplexity (completo)' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEnrichSource(opt.value)}
                  disabled={isRunning || isSearchingCnpja}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-all duration-200',
                    enrichSource === opt.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border hover:border-primary/40 hover:bg-muted/50',
                    (isRunning || isSearchingCnpja) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span className="text-xs font-medium">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {enrichSource === 'cnpja' && (
              <>Consulta a API CNPJá para leads com <strong>razão social ou empresa</strong> preenchidos.</>
            )}
            {enrichSource === 'perplexity' && (
              <>Consulta a Perplexity IA para buscar dados de mercado dos leads selecionados. Primeiros resultados aparecem em ~10 segundos.</>
            )}
            {enrichSource === 'both' && (
              <>Primeiro consulta CNPJá (dados cadastrais), depois Perplexity IA (dados de mercado).</>
            )}
            {' '}
            {preserveExisting 
              ? <>Campos já preenchidos no lead <strong>não serão sobrescritos</strong>.</>
              : <>Dados retornados <strong>sobrescrevem</strong> os campos existentes.</>
            }
          </p>

          <div className="flex items-center gap-2">
            <Checkbox 
              id="preserveExisting" 
              checked={preserveExisting} 
              onCheckedChange={(checked) => setPreserveExisting(!!checked)}
              disabled={isRunning || isSearchingCnpja}
            />
            <Label htmlFor="preserveExisting" className="text-xs cursor-pointer">
              Preservar dados existentes (não sobrescrever campos já preenchidos)
            </Label>
          </div>

          {(enrichSource === 'cnpja' || enrichSource === 'both') && (
            <div className="flex items-center gap-2">
              <Checkbox 
                id="ignoreCnpjaCache" 
                checked={ignoreCnpjaCache} 
                onCheckedChange={(checked) => setIgnoreCnpjaCache(!!checked)}
                disabled={isRunning || isSearchingCnpja}
              />
              <Label htmlFor="ignoreCnpjaCache" className="text-xs cursor-pointer">
                Ignorar cache de
              </Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={cacheDays}
                onChange={(e) => setCacheDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 90)))}
                disabled={isRunning || isSearchingCnpja || !ignoreCnpjaCache}
                className="w-20 h-7 text-xs"
              />
              <span className="text-xs text-muted-foreground">dias (forçar re-consulta)</span>
            </div>
          )}

          {/* Progress — Background Job */}
          {cnpjaJob && cnpjaJob.status === 'running' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Enriquecendo via {getSourceLabel(activeJobSource)} (background)...
                </span>
                <span>{cnpjaJob.total_processed || 0} / {cnpjaJob.total_eligible || '...'}</span>
              </div>
              <Progress 
                value={cnpjaJob.total_eligible > 0 ? Math.round(((cnpjaJob.total_processed || 0) / cnpjaJob.total_eligible) * 100) : 0} 
                className="h-2" 
              />
              <div className="flex justify-between text-xs">
                <span className="text-chart-3 font-medium">✅ Processando em background — pode trocar de aba</span>
                <span className="text-muted-foreground">
                  {activeJobSource === 'perplexity' ? (
                    <>{cnpjaJob.perplexity_success || 0} encontrados (IA)</>
                  ) : activeJobSource === 'cnpja' ? (
                    <>{cnpjaJob.cnpja_success || 0} encontrados (CNPJá)</>
                  ) : (
                    <>{cnpjaJob.cnpja_success || 0} CNPJá · {cnpjaJob.perplexity_success || 0} Perplexity</>
                  )}
                  {' · '}{cnpjaJob.not_found_count || 0} não encontrados · {cnpjaJob.skipped_count || 0} ignorados
                </span>
              </div>
            </div>
          )}

          {/* Results */}
          {cnpjaJobDone && (
            <div className="rounded-md bg-muted/50 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {cnpjaJob.status === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4 text-chart-3" />
                  ) : cnpjaJob.status === 'cancelled' ? (
                    <AlertCircle className="h-4 w-4 text-warning" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-sm font-medium">
                    {cnpjaJob.status === 'completed' ? 'Concluído' : 
                     cnpjaJob.status === 'cancelled' ? 'Cancelado (progresso parcial salvo)' : 'Erro'}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{getSourceLabel(activeJobSource)}</Badge>
                </div>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleDismissJob}>
                  Fechar
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processados:</span>
                  <Badge variant="secondary">{cnpjaJob.total_processed || 0}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Encontrados:</span>
                  <Badge variant="outline" className="text-chart-3">
                    {activeJobSource === 'both' ? (
                      <>{(cnpjaJob.cnpja_success || 0) + (cnpjaJob.perplexity_success || 0)} ({cnpjaJob.cnpja_success || 0} CNPJá + {cnpjaJob.perplexity_success || 0} IA)</>
                    ) : activeJobSource === 'perplexity' ? (
                      <>{cnpjaJob.perplexity_success || 0}</>
                    ) : (
                      <>{cnpjaJob.cnpja_success || 0}</>
                    )}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Atualizados:</span>
                  <Badge variant="outline" className="text-chart-3">{cnpjaJob.processed || 0}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ignorados:</span>
                  <Badge variant="outline">{cnpjaJob.skipped_count || 0}</Badge>
                </div>
              </div>

              {cnpjaJob.error_message && (
                <p className="text-xs text-destructive">{cnpjaJob.error_message}</p>
              )}

              {/* Detailed breakdown */}
              {cnpjaLogs.length > 0 && (() => {
                const skippedLogs = cnpjaLogs.filter(l => l.status === 'skipped');
                const errorLogs = cnpjaLogs.filter(l => l.status === 'error');
                const notFoundLogs = cnpjaLogs.filter(l => l.status === 'not_found');
                
                const skipReasons: Record<string, number> = {};
                skippedLogs.forEach(l => {
                  const reason = l.skipReason || 'Motivo não especificado';
                  const key = reason.includes('Cache') || reason.includes('cache') ? 'Cache de 90 dias' :
                              reason.includes('vazio') || reason.includes('2 caracteres') || reason.includes('curto') ? 'Nome vazio/curto' :
                              reason.includes('genéricos') || reason.includes('limpo') ? 'Nome só com termos genéricos' : reason;
                  skipReasons[key] = (skipReasons[key] || 0) + 1;
                });

                const errorReasons: Record<string, number> = {};
                errorLogs.forEach(l => {
                  const reason = l.errorMsg || 'Erro desconhecido';
                  const key = reason.includes('tentativas') ? 'Rate limit / timeout' :
                              reason.includes('permissão') ? 'Bloqueio de permissão (RLS)' :
                              reason.includes('salvar') ? 'Erro ao salvar no banco' : reason;
                  errorReasons[key] = (errorReasons[key] || 0) + 1;
                });

                // Group not-found by source
                const notFoundCnpja = notFoundLogs.filter(l => l.source === 'cnpja' || !l.source).length;
                const notFoundPerplexity = notFoundLogs.filter(l => l.source === 'perplexity').length;

                return (
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    {Object.keys(skipReasons).length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Motivos de leads ignorados:</span>
                        <ul className="mt-1 space-y-0.5">
                          {Object.entries(skipReasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                            <li key={reason} className="text-xs flex items-center gap-2">
                              <span className="text-muted-foreground">⏭️</span>
                              <span className="text-foreground">{reason}</span>
                              <Badge variant="outline" className="text-[10px] px-1 py-0">{count}</Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {notFoundLogs.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Não encontrados:</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          ❌ {notFoundLogs.length} empresas sem resultados
                          {activeJobSource === 'both' && notFoundCnpja > 0 && notFoundPerplexity > 0 && (
                            <> ({notFoundCnpja} CNPJá, {notFoundPerplexity} Perplexity)</>
                          )}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 gap-1.5 text-xs"
                          onClick={() => setFailedDialogOpen(true)}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Revisar {notFoundLogs.length + errorLogs.length} lead(s) com problema
                        </Button>
                      </div>
                    )}
                    {Object.keys(errorReasons).length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-destructive">Erros encontrados:</span>
                        <ul className="mt-1 space-y-0.5">
                          {Object.entries(errorReasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                            <li key={reason} className="text-xs flex items-center gap-2">
                              <span className="text-destructive">⚠️</span>
                              <span className="text-foreground">{reason}</span>
                              <Badge variant="outline" className="text-destructive text-[10px] px-1 py-0">{count}</Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Debug Log */}
          {cnpjaLogs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Log de consultas ({cnpjaLogs.filter(l => l.status === 'found').length} encontrados / {cnpjaLogs.filter(l => l.status === 'not_found').length} não encontrados / {cnpjaLogs.filter(l => l.status === 'skipped').length} ignorados / {cnpjaLogs.filter(l => l.status === 'error').length} erros)
                </span>
                {cnpjaJobDone && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setCnpjaLogs([])}>Limpar</Button>
                )}
              </div>
              <div 
                ref={logContainerRef}
                className="max-h-64 overflow-y-auto rounded border bg-muted/30 p-2 space-y-1 text-xs font-mono"
              >
                {cnpjaLogs.map((log, idx) => (
                  <div key={idx} className={cn(
                    'flex flex-col gap-0.5 p-1.5 rounded',
                    log.status === 'found' ? 'bg-chart-3/10' :
                    log.status === 'not_found' ? 'bg-destructive/10' :
                    log.status === 'skipped' ? 'bg-muted' :
                    'bg-destructive/20'
                  )}>
                    <div className="flex items-center gap-2">
                      <span>{log.status === 'found' ? '✅' : log.status === 'not_found' ? '❌' : log.status === 'skipped' ? '⏭️' : '⚠️'}</span>
                      {log.source && (
                        <Badge variant="outline" className={cn(
                          "text-[9px] px-1 py-0 font-normal",
                          log.source === 'perplexity' ? 'border-primary/40 text-primary' : 'border-border'
                        )}>
                          {log.source === 'perplexity' ? 'IA' : 'CNPJá'}
                        </Badge>
                      )}
                      <span className="font-semibold truncate">{log.company}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-muted-foreground truncate">busca: "{log.searchName}"</span>
                    </div>
                    {log.status === 'found' && log.source !== 'perplexity' && (
                      <div className="ml-6 text-muted-foreground">
                        CNPJ: {log.cnpjReturned} | Razão: {log.razaoSocialReturned} | Campos: {log.fieldsUpdated.length > 0 ? log.fieldsUpdated.join(', ') : '(nenhum)'}
                      </div>
                    )}
                    {log.status === 'found' && log.source === 'perplexity' && (
                      <div className="ml-6 text-muted-foreground">
                        Campos: {log.fieldsUpdated.length > 0 ? log.fieldsUpdated.join(', ') : '(nenhum novo)'}
                      </div>
                    )}
                    {log.status === 'skipped' && log.skipReason && (
                      <div className="ml-6 text-muted-foreground">{log.skipReason}</div>
                    )}
                    {log.status === 'error' && log.errorMsg && (
                      <div className="ml-6 text-destructive">{log.errorMsg}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 justify-end">
            {isSearchingCnpja ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancelCnpja}
                className="gap-2"
              >
                <AlertCircle className="h-4 w-4" />
                Cancelar ({cnpjaJob?.total_processed || 0}/{cnpjaJob?.total_eligible || 0})
              </Button>
            ) : (
              <>
                <Input
                  type="number"
                  placeholder="Limite (todos)"
                  value={cnpjaLimit}
                  onChange={(e) => setCnpjaLimit(e.target.value)}
                  disabled={isRunning || isSearchingCnpja}
                  className="w-32 h-8"
                  min={1}
                />
                <Button
                  size="sm"
                  onClick={handleCnpjaSearch}
                  disabled={isRunning || isSearchingCnpja}
                  className="gap-1.5 h-8"
                >
                  <Play className="h-3.5 w-3.5" />
                  Executar
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── EXTRATO DA BASE (respeitando filtros) ── */}
        <DatabaseStatsSection
          externalTeamFilter={teamFilter}
          externalUserIds={selectedUserIds}
          externalStatuses={selectedStatuses}
          externalTeamMemberIds={teamFilter !== 'all' ? teamMembers.filter(m => m.team_id === teamFilter).map(m => m.user_id) : undefined}
        />

      </CardContent>
    </Card>

    {/* Failed leads action dialog */}
    <CnpjaFailedLeadsDialog
      open={failedDialogOpen}
      onOpenChange={setFailedDialogOpen}
      failedLeads={cnpjaLogs
        .filter(l => (l.status === 'not_found' || l.status === 'error' || l.status === 'skipped') && l.leadId)
        .map(l => ({
          leadId: l.leadId!,
          company: l.company,
          searchName: l.searchName,
          status: l.status === 'skipped' ? 'skipped' as const : l.status as 'not_found' | 'error',
          errorMsg: l.errorMsg || l.skipReason,
        }))}
    />
  </>
  );
};
