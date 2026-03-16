import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2, Building2, MapPin, X } from 'lucide-react';
import { useCnpjaSearch, CnpjaResult } from '@/hooks/useCnpjaSearch';
import { cn } from '@/lib/utils';

interface CompanySearchProps {
  onSelect: (result: CnpjaResult) => void;
  placeholder?: string;
  className?: string;
}

export const CompanySearch = ({ onSelect, placeholder = 'Buscar por nome ou CNPJ...', className }: CompanySearchProps) => {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const { searchByName, searchByCnpj, isSearching, results, clearResults } = useCnpjaSearch();
  const containerRef = useRef<HTMLDivElement>(null);

  const isCnpjQuery = (q: string) => {
    const digits = q.replace(/\D/g, '');
    return digits.length >= 11 && digits.length <= 14;
  };

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    let items: CnpjaResult[];
    if (isCnpjQuery(trimmed)) {
      const digits = trimmed.replace(/\D/g, '');
      // Pad to 14 digits if needed
      const cnpj = digits.padStart(14, '0');
      items = await searchByCnpj(cnpj);
    } else {
      if (trimmed.length < 3) return;
      items = await searchByName(trimmed);
    }
    if (items.length > 0) setShowResults(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleSelect = (result: CnpjaResult) => {
    onSelect(result);
    setShowResults(false);
    setQuery('');
    clearResults();
  };

  const handleClear = () => {
    setQuery('');
    setShowResults(false);
    clearResults();
  };

  // Format CNPJ for display
  const formatCnpjDisplay = (cnpj: string) => {
    const d = cnpj.replace(/\D/g, '');
    if (d.length !== 14) return cnpj;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="h-8 text-xs pr-7 bg-background"
            disabled={isSearching}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleSearch}
          disabled={isSearching || (!isCnpjQuery(query) && query.trim().length < 3)}
          className="h-8 px-2 gap-1"
        >
          {isSearching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          <span className="text-xs hidden sm:inline">CNPJá</span>
        </Button>
      </div>

      {/* Results dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-lg">
          <ScrollArea className="max-h-60">
            <div className="p-1">
              {results.map((result, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(result)}
                  className="w-full text-left p-2 rounded-sm hover:bg-accent transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {result.razao_social || result.nome_fantasia}
                      </p>
                      {result.nome_fantasia && result.razao_social && result.nome_fantasia !== result.razao_social && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {result.nome_fantasia}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatCnpjDisplay(result.cnpj)}
                        </span>
                        {result.city && result.state && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />
                            {result.city}/{result.state}
                          </span>
                        )}
                        {result.situacao_cadastral && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] h-4 px-1",
                              result.situacao_cadastral.toLowerCase() === 'ativa' || result.situacao_cadastral.toLowerCase() === 'active'
                                ? 'border-success/40 text-success bg-success/10'
                                : 'border-destructive/40 text-destructive bg-destructive/10'
                            )}
                          >
                            {result.situacao_cadastral}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
          <div className="border-t px-2 py-1">
            <p className="text-[10px] text-muted-foreground text-center">
              {results.length} resultado(s) • Powered by CNPJá
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
