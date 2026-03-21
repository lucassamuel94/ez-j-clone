import { useState, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useSmartSearch } from '@/hooks/useSmartSearch';
import { Search, Sparkles, Loader2, Brain, Users, Handshake, FolderKanban } from 'lucide-react';

interface SmartSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXAMPLE_QUERIES = [
  'Leads do segmento de saúde',
  'Oportunidades acima de R$10.000',
  'Qual o ticket médio dos deals ganhos?',
  'Projetos em andamento',
];

const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

export function SmartSearchDialog({ open, onOpenChange }: SmartSearchDialogProps) {
  const [query, setQuery] = useState('');
  const { search, result, isSearching, clear } = useSmartSearch();

  const handleSearch = useCallback(() => {
    if (query.trim().length < 3) return;
    search(query.trim());
  }, [query, search]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  }, [handleSearch]);

  const handleClose = useCallback((o: boolean) => {
    if (!o) { setQuery(''); clear(); }
    onOpenChange(o);
  }, [onOpenChange, clear]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0">
        {/* Search Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte qualquer coisa..."
            className="border-0 shadow-none focus-visible:ring-0 px-0 text-sm"
            autoFocus
          />
          {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="p-4 space-y-4">
            {/* AI Answer */}
            {result?.results.answer && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3 flex gap-2">
                  <Brain className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground leading-relaxed">{result.results.answer}</p>
                </CardContent>
              </Card>
            )}

            {/* Leads */}
            {result && result.results.leads.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Leads ({result.results.leads.length})</span>
                </div>
                <div className="space-y-1">
                  {result.results.leads.map((lead: any) => (
                    <div key={lead.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{lead.name || 'Sem nome'}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{lead.razao_social || lead.company}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] h-5 shrink-0">{lead.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opportunities */}
            {result && result.results.opportunities.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Handshake className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Oportunidades ({result.results.opportunities.length})</span>
                </div>
                <div className="space-y-1">
                  {result.results.opportunities.map((opp: any) => (
                    <div key={opp.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{opp.stage}</p>
                      </div>
                      <span className="text-xs font-semibold text-foreground">{formatCurrency(Number(opp.deal_value) || 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Projects */}
            {result && result.results.projects.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Projetos ({result.results.projects.length})</span>
                </div>
                <div className="space-y-1">
                  {result.results.projects.map((proj: any) => (
                    <div key={proj.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{proj.name}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] h-5 shrink-0">{proj.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty / No results */}
            {result && result.totalResults === 0 && !result.results.answer && (
              <p className="text-center text-sm text-muted-foreground py-4">Nenhum resultado encontrado</p>
            )}

            {/* Example queries */}
            {!result && !isSearching && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Tente perguntar:</p>
                {EXAMPLE_QUERIES.map((q, i) => (
                  <button
                    key={i}
                    className="block w-full text-left text-xs text-muted-foreground hover:text-foreground p-2 rounded-md hover:bg-muted/30 transition-colors"
                    onClick={() => { setQuery(q); search(q); }}
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
