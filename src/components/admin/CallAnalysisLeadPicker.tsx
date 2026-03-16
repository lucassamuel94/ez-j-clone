import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Pencil, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUpdateCallAnalysisLead } from '@/hooks/useCallAnalyses';

interface Props {
  analysisId: string;
  leadData: { name: string; company: string } | null;
  leadId: string | null;
}

export const CallAnalysisLeadPicker = ({ analysisId, leadData, leadId }: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const updateLead = useUpdateCallAnalysisLead();

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-search-picker', search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const { data } = await supabase
        .from('leads')
        .select('id, name, company')
        .or(`name.ilike.%${search}%,company.ilike.%${search}%`)
        .limit(10);
      return data || [];
    },
    enabled: search.length >= 2,
  });

  const handleSelect = (lead: { id: string; name: string; company: string }) => {
    updateLead.mutate({ analysisId, leadId: lead.id });
    setOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    updateLead.mutate({ analysisId, leadId: null });
    setOpen(false);
    setSearch('');
  };

  const displayText = leadData ? `${leadData.name} — ${leadData.company}` : '—';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex items-center gap-1 text-left max-w-[180px] cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="truncate text-xs">{displayText}</span>
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <Input
            placeholder="Buscar lead por nome ou empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs"
            autoFocus
          />
          {updateLead.isPending && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {leads.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {leads.map((l: any) => (
                <button
                  key={l.id}
                  type="button"
                  className="w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent transition-colors"
                  onClick={() => handleSelect(l)}
                >
                  <span className="font-medium">{l.name}</span>
                  <span className="text-muted-foreground"> — {l.company}</span>
                </button>
              ))}
            </div>
          )}
          {search.length >= 2 && leads.length === 0 && !updateLead.isPending && (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum lead encontrado</p>
          )}
          {leadId && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs text-destructive hover:text-destructive"
              onClick={handleClear}
            >
              <X className="h-3 w-3 mr-1" />
              Remover associação
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
