import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FailedLead {
  leadId: string;
  company: string;
  searchName: string;
  status: 'not_found' | 'error' | 'skipped';
  errorMsg?: string;
}

interface CnpjaFailedLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  failedLeads: FailedLead[];
  onLeadsDeleted?: () => void;
}

export const CnpjaFailedLeadsDialog = ({
  open,
  onOpenChange,
  failedLeads,
  onLeadsDeleted,
}: CnpjaFailedLeadsDialogProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const visibleLeads = useMemo(
    () => failedLeads.filter(l => !deletedIds.has(l.leadId)),
    [failedLeads, deletedIds]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === visibleLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleLeads.map(l => l.leadId)));
    }
  }, [selectedIds.size, visibleLeads]);

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    try {
      const idsToDelete = Array.from(selectedIds);

      // Delete related records first, then leads
      for (const table of ['lead_notes', 'interactions', 'lead_cadences', 'meetings', 'lead_activity_logs', 'lead_contacts', 'lead_score_history', 'sent_emails']) {
        await supabase.from(table as any).delete().in('lead_id', idsToDelete);
      }
      // Nullify optional FKs
      for (const table of ['call_history', 'call_analyses', 'form_submissions', 'ai_usage_logs']) {
        await supabase.from(table as any).update({ lead_id: null }).in('lead_id', idsToDelete);
      }
      // Delete opportunities linked to these leads
      await supabase.from('opportunities').delete().in('lead_id', idsToDelete);
      // Delete projects linked
      await supabase.from('project_tasks').delete().in('lead_id', idsToDelete);
      await supabase.from('projects').delete().in('lead_id', idsToDelete);

      const { error } = await supabase.from('leads').delete().in('id', idsToDelete);
      if (error) throw error;

      setDeletedIds(prev => {
        const next = new Set(prev);
        idsToDelete.forEach(id => next.add(id));
        return next;
      });
      setSelectedIds(new Set());
      toast.success(`${idsToDelete.length} lead(s) deletado(s) com sucesso`);
      onLeadsDeleted?.();
    } catch (err: any) {
      console.error('Error deleting leads:', err);
      toast.error('Erro ao deletar leads: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleKeepAll = () => {
    onOpenChange(false);
    toast.info('Todos os leads foram mantidos na base.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Leads com falha no enriquecimento
          </DialogTitle>
          <DialogDescription>
            {visibleLeads.length} lead(s) não puderam ser enriquecidos (não encontrados, termos insuficientes ou erros). Selecione os que deseja remover da base ou mantenha todos.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[50vh] border rounded-md">
          <div className="p-2 space-y-1">
            {/* Select all header */}
            <label className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/50 cursor-pointer sticky top-0 z-10">
              <Checkbox
                checked={selectedIds.size === visibleLeads.length && visibleLeads.length > 0}
                onCheckedChange={toggleAll}
              />
              <span className="text-xs font-medium text-muted-foreground">
                {selectedIds.size === visibleLeads.length && visibleLeads.length > 0
                  ? 'Desmarcar todos'
                  : `Selecionar todos (${visibleLeads.length})`}
              </span>
            </label>

            {visibleLeads.map(lead => (
              <label
                key={lead.leadId}
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selectedIds.has(lead.leadId)}
                  onCheckedChange={() => toggleSelect(lead.leadId)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{lead.company}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    Busca: "{lead.searchName}"
                    {lead.errorMsg && <span className="text-destructive ml-1">· {lead.errorMsg}</span>}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                     lead.status === 'not_found' ? 'text-warning border-warning/30' :
                     lead.status === 'skipped' ? 'text-muted-foreground border-border' :
                     'text-destructive border-destructive/30'
                  }
                >
                  {lead.status === 'not_found' ? 'Não encontrado' : lead.status === 'skipped' ? 'Ignorado' : 'Erro'}
                </Badge>
              </label>
            ))}

            {visibleLeads.length === 0 && (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
                <CheckCircle2 className="h-4 w-4 text-chart-3" />
                Todos os leads foram processados!
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={handleKeepAll}
            disabled={isDeleting}
          >
            Manter todos na base
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0 || isDeleting}
            className="gap-2"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Deletar selecionados ({selectedIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
