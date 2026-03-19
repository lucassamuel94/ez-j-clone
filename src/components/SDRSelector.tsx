import { useState, useEffect, useMemo } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Check, User, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface Profile {
  id: string;
  name: string;
  active: boolean;
}

interface SDRSelectorProps {
  leadId: string;
  currentOwnerId: string | null;
  currentOwnerName: string | null;
  disabled?: boolean;
  selfAssignOnly?: boolean;
  sdrOnly?: boolean;
}

export const SDRSelector = ({
  leadId,
  currentOwnerId,
  currentOwnerName,
  disabled = false,
  selfAssignOnly = false,
  sdrOnly = false,
}: SDRSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [sdrList, setSdrList] = useState<Profile[]>([]);
  const [roleUserIds, setRoleUserIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchSdrs = async () => {
      setIsLoading(true);
      
      if (selfAssignOnly) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, active')
            .eq('id', user.id)
            .single();
          setSdrList(profile ? [profile] : []);
          setRoleUserIds(new Set(profile ? [profile.id] : []));
        }
      } else if (sdrOnly) {
        const [{ data: roleRows }, { data: assignedRows }] = await Promise.all([
          supabase.from('user_roles').select('user_id').in('role', ['sdr', 'admin', 'manager']),
          supabase.from('leads').select('owner_user_id').not('owner_user_id', 'is', null),
        ]);
        const roleIds = new Set((roleRows || []).map(r => r.user_id));
        const assignedIds = (assignedRows || []).map(r => r.owner_user_id).filter(Boolean) as string[];
        const allIds = [...new Set([...roleIds, ...assignedIds])];
        if (allIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, active')
            .in('id', allIds)
            .eq('active', true)
            .order('name');
          if (profiles) setSdrList(profiles);
        }
        setRoleUserIds(roleIds);
      } else {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, active')
          .eq('active', true)
          .order('name');
        if (profiles) {
          setSdrList(profiles);
          setRoleUserIds(new Set(profiles.map(p => p.id)));
        }
      }
      
      setIsLoading(false);
    };

    if (open) {
      setSearch('');
      fetchSdrs();
    }
  }, [open, selfAssignOnly, sdrOnly]);

  const filteredList = useMemo(() => {
    if (!search.trim()) return sdrList;
    const q = search.toLowerCase();
    return sdrList.filter(s => s.name.toLowerCase().includes(q));
  }, [sdrList, search]);

  const handleSelectSdr = async (sdrId: string | null) => {
    if (sdrId === currentOwnerId) {
      setOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.rpc('transfer_lead_owner', {
        p_lead_id: leadId,
        p_new_owner_id: sdrId
      });

      if (error) throw error;
      if (!data) throw new Error('Sem permissão para transferir este lead');

      const sdrName = sdrId ? sdrList.find(s => s.id === sdrId)?.name : null;
      toast.success(sdrName 
        ? `Lead alocado para ${sdrName}` 
        : 'Lead desatribuído'
      );
      
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setOpen(false);
    } catch (error) {
      console.error('Error updating lead owner:', error);
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
      <span className="text-xs text-muted-foreground">
        {currentOwnerName || 'Não atribuído'}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={handleClick}>
        <button
          className={cn(
            "text-xs px-2 py-1 rounded-md transition-colors cursor-pointer",
            "hover:bg-accent hover:text-accent-foreground",
            currentOwnerName 
              ? "text-muted-foreground" 
              : "text-destructive/70 italic"
          )}
        >
          {currentOwnerName || 'Não atribuído'}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-56 p-0" 
        align="center"
        onClick={handleClick}
      >
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
              {/* Option to unassign - hidden for SDR-only mode */}
              {!sdrOnly && !search.trim() && <button
                onClick={() => handleSelectSdr(null)}
                disabled={isSaving}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md",
                  "hover:bg-accent hover:text-accent-foreground",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  !currentOwnerId && "bg-accent"
                )}
              >
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-left italic text-muted-foreground">
                  Não atribuído
                </span>
                {!currentOwnerId && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>}

              {filteredList.map((sdr) => (
                <button
                  key={sdr.id}
                  onClick={() => handleSelectSdr(sdr.id)}
                  disabled={isSaving}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md",
                    "hover:bg-accent hover:text-accent-foreground",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    currentOwnerId === sdr.id && "bg-accent"
                  )}
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left">
                    {sdr.name}
                    {!roleUserIds.has(sdr.id) && (
                      <span className="ml-1 text-[10px] text-muted-foreground font-normal">(atribuído)</span>
                    )}
                  </span>
                  {currentOwnerId === sdr.id && (
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
