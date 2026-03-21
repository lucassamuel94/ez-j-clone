import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Search, Loader2, FolderKanban, Building2, User, Briefcase, Hash } from 'lucide-react';
import { PHASE_LABELS } from '@/types/project';
import type { GlobalSearchResult } from '@/components/GlobalSearchDropdown';

/* ─── types ──────────────────────────────────────── */
type FilterType = 'all' | 'projects' | 'leads' | 'clients';

interface ProjectResult {
  id: string;
  company_name: string;
  project_number: number;
  project_type: string;
  current_phase: string;
  overall_status: string;
  due_date: string | null;
  cnpj: string | null;
}

interface AccountResult {
  id: string;
  company_name: string;
  cnpj: string | null;
  contact_name: string | null;
  city: string | null;
  state: string | null;
}

interface UnifiedResult {
  id: string;
  section: 'projects' | 'leads' | 'clients';
  label: string;
  sublabel: string;
  badge?: string;
  badgeClass?: string;
  mono?: string;
  icon: typeof FolderKanban;
}

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  { value: 'projects', label: 'Projetos' },
  { value: 'leads', label: 'Leads' },
  { value: 'clients', label: 'Clientes' },
];

const SECTION_LABELS: Record<string, string> = {
  projects: 'Projetos',
  leads: 'Leads / Oportunidades',
  clients: 'Clientes',
};

const STATUS_COLOR: Record<string, string> = {
  atrasado: 'bg-destructive/10 text-destructive border-destructive/20',
  em_andamento: 'bg-primary/10 text-primary border-primary/20',
  no_prazo: 'bg-success/10 text-success border-success/20',
  concluido: 'bg-success/10 text-success border-success/20',
  cancelado: 'bg-muted text-muted-foreground border-border',
};

const PIPELINE_BADGE: Record<string, { label: string; cls: string }> = {
  sdr: { label: 'SDR', cls: 'bg-primary/10 text-primary border-primary/20' },
  closer: { label: 'Closer', cls: 'bg-[hsl(var(--chart-2))]/10 text-[hsl(var(--chart-2))] border-[hsl(var(--chart-2))]/20' },
  cliente: { label: 'Cliente', cls: 'bg-[hsl(var(--chart-3))]/10 text-[hsl(var(--chart-3))] border-[hsl(var(--chart-3))]/20' },
};

const TYPE_LABELS: Record<string, string> = {
  venda: 'Venda',
  migracao: 'Migração',
  evolucao: 'Evolução',
  api_oficial: 'API Oficial',
};

function isOverdue(due: string | null, status: string): boolean {
  if (!due || status === 'concluido' || status === 'cancelado') return false;
  return new Date(due) < new Date();
}

/* ─── component ──────────────────────────────────── */
export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [leadResults, setLeadResults] = useState<GlobalSearchResult[]>([]);
  const [projectResults, setProjectResults] = useState<ProjectResult[]>([]);
  const [accountResults, setAccountResults] = useState<AccountResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();

  // Cmd+J listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setFilter('all');
      setActiveIndex(0);
      setLeadResults([]);
      setProjectResults([]);
      setAccountResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search
  const search = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setLeadResults([]);
      setProjectResults([]);
      setAccountResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const t = term.trim();
      // Normalize: strip CNPJ formatting chars so "18531719000114" matches "18.531.719/0001-14"
      const tDigits = t.replace(/[.\-\/]/g, '');
      const cnpjVariants = tDigits !== t
        ? `cnpj.ilike.%${t}%,cnpj.ilike.%${tDigits}%`
        : `cnpj.ilike.%${t}%`;

      const [leadRes, projRes, acctRes] = await Promise.all([
        supabase.rpc('search_all_leads_global', { p_search: t, p_limit: 8 }),
        supabase.from('projects')
          .select('id, company_name, project_number, project_type, current_phase, overall_status, due_date, cnpj')
          .is('deleted_at', null)
          .eq('archived', false)
          .or(`company_name.ilike.%${t}%,${cnpjVariants}`)
          .order('project_number', { ascending: false })
          .limit(8),
        supabase.from('accounts')
          .select('id, company_name, cnpj, contact_name, city, state')
          .eq('lifecycle_stage', 'client')
          .is('deleted_at', null)
          .or(`company_name.ilike.%${t}%,${cnpjVariants},contact_name.ilike.%${t}%`)
          .order('company_name')
          .limit(8),
      ]);
      setLeadResults((leadRes.data || []) as unknown as GlobalSearchResult[]);
      setProjectResults((projRes.data || []) as ProjectResult[]);
      setAccountResults((acctRes.data || []) as AccountResult[]);
    } catch (err) {
      console.error('Command palette search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  // Unify results
  const unified = useMemo<UnifiedResult[]>(() => {
    const items: UnifiedResult[] = [];

    // Projects
    if (filter === 'all' || filter === 'projects') {
      projectResults.slice(0, 4).forEach(p => {
        items.push({
          id: `proj-${p.id}`,
          section: 'projects',
          label: p.company_name,
          sublabel: PHASE_LABELS[p.current_phase] || p.current_phase,
          badge: TYPE_LABELS[p.project_type] || p.project_type,
          badgeClass: 'bg-muted text-muted-foreground border-border',
          mono: `PROJ-${String(p.project_number).padStart(4, '0')}`,
          icon: FolderKanban,
        });
      });
    }

    // Leads / Opportunities (exclude clients from lead results)
    if (filter === 'all' || filter === 'leads') {
      leadResults.slice(0, 4).forEach(r => {
        if (r.pipeline_label === 'cliente') return;
        const pb = PIPELINE_BADGE[r.pipeline_label] || PIPELINE_BADGE.sdr;
        items.push({
          id: `lead-${r.lead_id}`,
          section: 'leads',
          label: r.lead_company,
          sublabel: [r.lead_name, r.opp_stage, r.owner_name].filter(Boolean).join(' · '),
          badge: pb.label,
          badgeClass: pb.cls,
          mono: r.lead_cnpj || undefined,
          icon: r.opportunity_id ? Briefcase : User,
        });
      });
    }

    // Clients (from accounts table)
    if (filter === 'all' || filter === 'clients') {
      accountResults.slice(0, 4).forEach(a => {
        const location = [a.city, a.state].filter(Boolean).join('/');
        items.push({
          id: `cli-${a.id}`,
          section: 'clients',
          label: a.company_name,
          sublabel: [a.contact_name, location].filter(Boolean).join(' · '),
          badge: 'Cliente',
          badgeClass: 'bg-[hsl(var(--chart-3))]/10 text-[hsl(var(--chart-3))] border-[hsl(var(--chart-3))]/20',
          mono: a.cnpj || undefined,
          icon: Building2,
        });
      });
    }

    return items.slice(0, 12);
  }, [projectResults, leadResults, accountResults, filter]);

  // Group by section
  const grouped = useMemo(() => {
    const map = new Map<string, UnifiedResult[]>();
    unified.forEach(item => {
      const arr = map.get(item.section) || [];
      arr.push(item);
      map.set(item.section, arr);
    });
    return map;
  }, [unified]);

  // Keyboard nav
  useEffect(() => { setActiveIndex(0); }, [unified.length, filter]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, unified.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && unified[activeIndex]) {
      e.preventDefault();
      selectItem(unified[activeIndex]);
    }
  }, [unified, activeIndex]);

  const selectItem = useCallback((item: UnifiedResult) => {
    setOpen(false);
    const realId = item.id.replace(/^(proj|lead|cli)-/, '');
    if (item.section === 'projects') {
      navigate(`/projects?project=${realId}`);
    } else if (item.section === 'leads') {
      navigate(`/leads?lead=${realId}`);
    } else {
      // Clients — navigate to meus clientes page with deep-link
      navigate(`/sdr/meus-clientes?account=${realId}`);
    }
  }, [navigate]);

  const hasResults = unified.length > 0;
  const hasQuery = query.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="p-0 gap-0 max-w-[560px] overflow-hidden border-border/60 shadow-2xl [&>button]:hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 border-b border-border/40">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar projetos, leads, clientes..."
            className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          {isSearching && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />}
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border/50 bg-muted/50 px-1.5 text-[10px] font-medium text-muted-foreground">
            Esc
          </kbd>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border/30">
          {FILTERS.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
                filter === f.value
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted/60'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto">
          {!hasQuery && (
            <div className="py-12 text-center text-sm text-muted-foreground/60">
              Digite para buscar...
            </div>
          )}

          {hasQuery && !hasResults && !isSearching && (
            <div className="py-12 text-center text-sm text-muted-foreground/60">
              Nenhum resultado encontrado
            </div>
          )}

          {hasResults && Array.from(grouped.entries()).map(([section, items]) => (
            <div key={section}>
              <div className="px-4 py-1.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                  {SECTION_LABELS[section] || section}
                </span>
              </div>
              {items.map(item => {
                const idx = unified.indexOf(item);
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors cursor-pointer',
                      idx === activeIndex ? 'bg-accent/60' : 'hover:bg-accent/30'
                    )}
                    onClick={() => selectItem(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <div className="h-7 w-7 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{item.label}</span>
                        {item.badge && (
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4 font-medium border shrink-0', item.badgeClass)}>
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground truncate block">{item.sublabel}</span>
                    </div>
                    {item.mono && (
                      <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0">{item.mono}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border/30 bg-muted/20">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <kbd className="inline-flex h-4 items-center rounded border border-border/50 bg-muted/60 px-1 text-[10px] font-mono">↑↓</kbd>
            navegar
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <kbd className="inline-flex h-4 items-center rounded border border-border/50 bg-muted/60 px-1 text-[10px] font-mono">↵</kbd>
            abrir
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <kbd className="inline-flex h-4 items-center rounded border border-border/50 bg-muted/60 px-1 text-[10px] font-mono">Esc</kbd>
            fechar
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
