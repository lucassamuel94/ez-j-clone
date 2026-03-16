import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Building2, Search, Loader2, MapPin, Check, ShieldCheck } from 'lucide-react';
import { useActiveClients } from '@/hooks/useActiveClients';
import { createApiOficialDealFromClient } from '@/services/apiOficialService';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface NewApiOficialDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NewApiOficialDealDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewApiOficialDealDialogProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleOpenChange = useCallback((v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setSearch('');
      setDebouncedSearch('');
      setSelectedClientId(null);
    }
  }, [onOpenChange]);

  const { data: clients = [], isLoading } = useActiveClients(debouncedSearch);
  const displayClients = useMemo(() => clients.slice(0, 50), [clients]);
  const selectedClient = useMemo(
    () => clients.find(c => c.id === selectedClientId),
    [clients, selectedClientId],
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedClientId(prev => (prev === id ? null : id));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!selectedClientId) return;
    setIsCreating(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Usuário não autenticado');
      await createApiOficialDealFromClient(selectedClientId, user.id);
      await queryClient.invalidateQueries({ queryKey: ['api-oficial-deals'] });
      toast.success('Solicitação de API Oficial criada!');
      handleOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar solicitação';
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  }, [selectedClientId, queryClient, handleOpenChange, onSuccess]);

  const formatCnpj = (cnpj: string) => {
    const d = cnpj.replace(/\D/g, '');
    if (d.length !== 14) return cnpj;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            Nova Solicitação — API Oficial
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Selecione um cliente da base para iniciar uma solicitação de API Oficial.
          </p>
        </DialogHeader>

        <div className="px-6 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa, CNPJ, cidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 px-6">
          <ScrollArea className="h-[360px] rounded-lg border border-border">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Buscando clientes...</p>
              </div>
            ) : displayClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Building2 className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Nenhum cliente encontrado</p>
                {debouncedSearch && (
                  <p className="text-xs text-muted-foreground/60">Tente buscar com outro termo</p>
                )}
              </div>
            ) : (
              <div>
                {displayClients.map((client) => {
                  const isSelected = selectedClientId === client.id;
                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => handleSelect(client.id)}
                      className={cn(
                        'w-full text-left px-4 py-3 transition-all duration-150 border-b border-border last:border-b-0',
                        'hover:bg-accent/50',
                        isSelected && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors',
                            isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30',
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{client.company}</p>
                          {client.razao_social && client.razao_social !== client.company && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{client.razao_social}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {client.city && client.state && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />
                              {client.city}/{client.state}
                            </span>
                          )}
                          {client.cnpj && (
                            <Badge variant="outline" className="text-[10px] font-mono h-5 px-1.5">
                              {formatCnpj(client.cnpj)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          {!isLoading && displayClients.length > 0 && (
            <p className="text-[10px] text-muted-foreground text-right mt-1.5 pr-1">
              {displayClients.length === 50 ? '50+ resultados — refine a busca' : `${displayClients.length} resultado(s)`}
            </p>
          )}
        </div>

        {selectedClient && (
          <div className="mx-6 mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 flex-shrink-0">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{selectedClient.company}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {selectedClient.cnpj && (
                  <span className="text-[10px] text-muted-foreground font-mono">{formatCnpj(selectedClient.cnpj)}</span>
                )}
                {selectedClient.segment && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">{selectedClient.segment}</Badge>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t border-border mt-3">
          <Button variant="outline" onClick={() => handleOpenChange(false)} className="h-9">Cancelar</Button>
          <Button onClick={handleCreate} disabled={!selectedClientId || isCreating} className="h-9 min-w-[160px]">
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Criando...
              </>
            ) : (
              'Criar Solicitação'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
