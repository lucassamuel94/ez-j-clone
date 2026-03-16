import { useState, useMemo } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface CloserSelectorProps {
  opportunityId: string;
  currentCloserId: string | null;
  currentCloserName: string | null;
  disabled?: boolean;
  closerOnly?: boolean;
}

const fetchCloserProfiles = async (): Promise<Profile[]> => {
  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'closer');
  const userIds = [...new Set((roleRows || []).map(r => r.user_id))];
  if (userIds.length === 0) return [];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, active')
    .in('id', userIds)
    .eq('active', true)
    .order('name');
  return profiles || [];
};

const fetchAllProfiles = async (): Promise<Profile[]> => {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, active')
    .eq('active', true)
    .order('name');
  return profiles || [];
};

export const CloserSelector = ({
  opportunityId,
  currentCloserId,
  currentCloserName,
  disabled = false,
  closerOnly = false,
}: CloserSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  // Use react-query with long staleTime so all CloserSelector instances share the cache
  const { data: closerList = [], isLoading } = useQuery({
    queryKey: ['closer-selector-profiles', closerOnly],
    queryFn: closerOnly ? fetchCloserProfiles : fetchAllProfiles,
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const filteredList = useMemo(() => {
    if (!search.trim()) return closerList;
    const q = search.toLowerCase();
    return closerList.filter(c => c.name.toLowerCase().includes(q));
  }, [closerList, search]);

  const handleSelectCloser = async (closerId: string | null) => {
    if (closerId === currentCloserId) {
      setOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      const { data: success, error } = await supabase.rpc('transfer_opportunity_owner', {
        p_opportunity_id: opportunityId,
        p_new_owner_id: closerId,
      });

      if (error) throw error;
      if (!success) throw new Error('Sem permissão para reatribuir');

      const closerName = closerId ? closerList.find(c => c.id === closerId)?.name : null;
      toast.success(closerName
        ? `Oportunidade alocada para ${closerName}`
        : 'Oportunidade desatribuída'
      );

      queryClient.invalidateQueries({ queryKey: ['closer-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['closer-opportunities-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['closer-kanban-data'] });
      queryClient.invalidateQueries({ queryKey: ['closer-tab-counts'] });
      queryClient.invalidateQueries({ queryKey: ['opportunity-by-id'] });
      setOpen(false);
    } catch (error) {
      console.error('Error updating opportunity closer:', error);
      toast.error('Erro ao atualizar Closer');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (disabled) {
    return (
      <span className="text-xs text-muted-foreground truncate">
        {currentCloserName || '—'}
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
            currentCloserName
              ? "text-foreground font-semibold"
              : "text-destructive/70 italic"
          )}
        >
          {currentCloserName || 'Não atribuído'}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-0"
        align="center"
        onClick={handleClick}
      >
        <div className="px-3 py-2 border-b">
          <p className="text-sm font-medium">Selecionar Closer</p>
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
              {!closerOnly && !search.trim() && (
                <button
                  onClick={() => handleSelectCloser(null)}
                  disabled={isSaving}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md",
                    "hover:bg-accent hover:text-accent-foreground",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    !currentCloserId && "bg-accent"
                  )}
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left italic text-muted-foreground">
                    Não atribuído
                  </span>
                  {!currentCloserId && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              )}

              {filteredList.map((closer) => (
                <button
                  key={closer.id}
                  onClick={() => handleSelectCloser(closer.id)}
                  disabled={isSaving}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md",
                    "hover:bg-accent hover:text-accent-foreground",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    currentCloserId === closer.id && "bg-accent"
                  )}
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left">{closer.name}</span>
                  {currentCloserId === closer.id && (
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
