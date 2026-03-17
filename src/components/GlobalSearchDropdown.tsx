import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2, Building2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export interface GlobalSearchResult {
  lead_id: string;
  lead_name: string;
  lead_company: string;
  lead_email: string | null;
  lead_cnpj: string | null;
  lead_status: string;
  opportunity_id: string | null;
  opp_stage: string | null;
  pipeline_label: 'sdr' | 'closer' | 'cliente';
  owner_name: string | null;
}

interface GlobalSearchDropdownProps {
  onSelect: (result: GlobalSearchResult) => void;
  onSearchChange?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

const PIPELINE_CONFIG: Record<string, { label: string; className: string }> = {
  sdr: { label: 'SDR', className: 'bg-primary/10 text-primary border-primary/20' },
  closer: { label: 'Closer', className: 'bg-[hsl(var(--chart-2))]/10 text-[hsl(var(--chart-2))] border-[hsl(var(--chart-2))]/20' },
  cliente: { label: 'Cliente', className: 'bg-[hsl(var(--chart-3))]/10 text-[hsl(var(--chart-3))] border-[hsl(var(--chart-3))]/20' },
};

const ResultItem = memo(({ result, onSelect }: { result: GlobalSearchResult; onSelect: (r: GlobalSearchResult) => void }) => {
  const config = PIPELINE_CONFIG[result.pipeline_label] || PIPELINE_CONFIG.sdr;
  return (
    <button
      type="button"
      className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors rounded-md cursor-pointer"
      onClick={() => onSelect(result)}
    >
      <div className="flex-shrink-0 mt-0.5">
        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{result.lead_company}</span>
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4 font-medium border', config.className)}>
            {config.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground truncate">{result.lead_name}</span>
          {result.lead_cnpj && (
            <>
              <span className="text-xs text-muted-foreground/50">·</span>
              <span className="text-[10px] text-muted-foreground/70 tabular-nums">{result.lead_cnpj}</span>
            </>
          )}
          {result.owner_name && (
            <>
              <span className="text-xs text-muted-foreground/50">·</span>
              <span className="text-xs text-muted-foreground/70 truncate flex items-center gap-1">
                <User className="h-3 w-3" />
                {result.owner_name}
              </span>
            </>
          )}
        </div>
        {result.opp_stage && (
          <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">Estágio: {result.opp_stage}</span>
        )}
      </div>
    </button>
  );
});

export const GlobalSearchDropdown = memo(({ onSelect, onSearchChange, placeholder = 'Busca global...', className }: GlobalSearchDropdownProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase.rpc('search_all_leads_global', {
        p_search: term.trim(),
        p_limit: 15,
      });
      if (error) throw error;
      const typedData = (data || []) as unknown as GlobalSearchResult[];
      setResults(typedData);
      setIsOpen(typedData.length > 0);
    } catch (err) {
      console.error('Global search error:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  const handleSelect = useCallback((result: GlobalSearchResult) => {
    onSelect(result);
    setQuery('');
    onSearchChange?.('');
    setResults([]);
    setIsOpen(false);
  }, [onSelect, onSearchChange]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className={cn('relative', className)}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          {isSearching && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
          )}
          <Input
            ref={inputRef}
            placeholder={placeholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); onSearchChange?.(e.target.value); }}
            onFocus={() => { if (results.length > 0 && query.trim().length >= 2) setIsOpen(true); }}
            className="pl-8 pr-8 h-8 text-xs font-medium bg-background"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[380px] p-1"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {query.trim().length >= 2 && (
          <div className="px-3 py-1.5 border-b border-border flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              Filtrando localmente • {results.length} resultado{results.length !== 1 ? 's' : ''} global{results.length !== 1 ? 'is' : ''}
            </span>
          </div>
        )}
        <div className="overflow-y-auto max-h-[320px] space-y-0.5">
          {results.map((r) => (
            <ResultItem key={r.lead_id} result={r} onSelect={handleSelect} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
});
