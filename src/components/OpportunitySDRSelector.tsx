import { useState, useMemo } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Check, User, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';

interface Profile {
  id: string;
  name: string;
  active: boolean;
}

interface OpportunitySDRSelectorProps {
  opportunityId: string;
  currentSdrId: string | null;
  currentSdrName: string | null;
  disabled?: boolean;
}

interface FetchResult {
  profiles: Profile[];
  roleUserIds: Set<string>;
}

const fetchSDRProfiles = async (): Promise<FetchResult> => {
  const [{ data: roleRows }, { data: assignedRows }] = await Promise.all([
    supabase.from('user_roles').select('user_id').in('role', ['sdr', 'admin', 'manager']),
    supabase.from('opportunities').select('sdr_user_id').not('sdr_user_id', 'is', null),
  ]);
  const roleIds = new Set((roleRows || []).map(r => r.user_id));
  const assignedIds = (assignedRows || []).map(r => r.sdr_user_id).filter(Boolean) as string[];
  const allIds = [...new Set([...roleIds, ...assignedIds])];
  if (allIds.length === 0) return { profiles: [], roleUserIds: roleIds };
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, active')
    .in('id', allIds)
    .eq('active', true)
    .order('name');
  return { profiles: profiles || [], roleUserIds: roleIds };
};

export const OpportunitySDRSelector = ({
  opportunityId,
  currentSdrId,
  currentSdrName,
  disabled = false,
}: OpportunitySDRSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: fetchResult, isLoading } = useQuery({
    queryKey: ['opp-sdr-selector-profiles'],
    queryFn: fetchSDRProfiles,
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const sdrList = fetchResult?.profiles ?? [];
  const roleUserIds = fetchResult?.roleUserIds ?? new Set<string>();

  const filteredList = useMemo(() => {
    if (!search.trim()) return sdrList;
    const q = search.toLowerCase();
    return sdrList.filter(s => s.name.toLowerCase().includes(q));
  }, [sdrList, search]);

  const handleSelectSdr = async (sdrId: string | null) => {
    if (sdrId === currentSdrId) {
      setOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('opportunities')
        .update({ sdr_user_id: sdrId })
        .eq('id', opportunityId);

      if (error) throw error;

      const sdrName = sdrId ? sdrList.find(s => s.id === sdrId)?.name : null;
      toast.success(sdrName ? `SDR alterado para ${sdrName}` : 'SDR removido');

      queryClient.invalidateQueries({ queryKey: ['closer-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['closer-opportunities-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['closer-kanban-data'] });
      queryClient.invalidateQueries({ queryKey: ['closer-tab-counts'] });
      queryClient.invalidateQueries({ queryKey: ['opportunity-by-id'] });
      queryClient.invalidateQueries({ queryKey: ['closer-pipeline'] });
      setOpen(false);
    } catch (error) {
      console.error('Error updating opportunity SDR:', error);
      toast.error('Erro ao atualizar SDR');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (disabled) {
    return (
      <span className="text-sm font-medium text-foreground truncate">
        {currentSdrName || <span className="text-[10px] text-muted-foreground font-normal">Sem SDR</span>}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setSearch(''); }}>
      <PopoverTrigger asChild onClick={handleClick}>
        <button
          className={cn(
            "text-xs px-2 py-1 rounded-md transition-colors cursor-pointer truncate max-w-full",
            "hover:bg-accent hover:text-accent-foreground",
            currentSdrName
              ? "text-foreground font-semibold"
              : "text-destructive/70 italic"
          )}
        >
          {currentSdrName || 'Sem SDR'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="center" onClick={handleClick}>
        <div className="px-3 py-2 border-b">
          <p className="text-sm font-medium">Selecionar SDR</p>
        </div>
        <div className="px-2 py-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 text-sm"
              autoFocus
            />
          </div>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-h-[200px] overflow-y-auto">
            <div className="p-1">
              {filteredList.map((sdr) => (
                <button
                  key={sdr.id}
                  onClick={() => handleSelectSdr(sdr.id)}
                  disabled={isSaving}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md",
                    "hover:bg-accent hover:text-accent-foreground",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    currentSdrId === sdr.id && "bg-accent"
                  )}
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left">
                    {sdr.name}
                    {!roleUserIds.has(sdr.id) && (
                      <span className="ml-1 text-[10px] text-muted-foreground font-normal">(atribuído)</span>
                    )}
                  </span>
                  {currentSdrId === sdr.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
              {filteredList.length === 0 && !isLoading && (
                <p className="text-xs text-muted-foreground text-center py-3">Nenhum resultado</p>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
