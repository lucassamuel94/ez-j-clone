import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';

interface WhatsAppGroup {
  id: string;
  name: string;
  phone_or_id: string;
  description: string | null;
}

interface FormState {
  name: string;
  phone_or_id: string;
  description: string;
}

const EMPTY_FORM: FormState = { name: '', phone_or_id: '', description: '' };

export function WhatsAppGroupsManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['whatsapp-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_groups')
        .select('id, name, phone_or_id, description')
        .order('name');
      if (error) throw error;
      return (data ?? []) as WhatsAppGroup[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: FormState & { id?: string }) => {
      if (payload.id) {
        const { error } = await supabase.from('whatsapp_groups')
          .update({ name: payload.name, phone_or_id: payload.phone_or_id, description: payload.description || null })
          .eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('whatsapp_groups')
          .insert({ name: payload.name, phone_or_id: payload.phone_or_id, description: payload.description || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      setDialogOpen(false);
      toast.success(editingId ? 'Grupo atualizado!' : 'Grupo criado!');
    },
    onError: () => toast.error('Erro ao salvar grupo'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('whatsapp_groups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      setDeleteId(null);
      toast.success('Grupo excluído');
    },
  });

  const openNew = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((g: WhatsAppGroup) => {
    setEditingId(g.id);
    setForm({ name: g.name, phone_or_id: g.phone_or_id, description: g.description ?? '' });
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!form.phone_or_id.trim()) { toast.error('ID do grupo é obrigatório'); return; }
    saveMutation.mutate({ ...form, id: editingId ?? undefined });
  }, [form, editingId, saveMutation]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Grupos de WhatsApp</h3>
          <span className="text-xs text-muted-foreground">({groups.length})</span>
        </div>
        <Button variant="outline" size="sm" onClick={openNew} className="gap-1.5 h-7 text-xs">
          <Plus className="h-3 w-3" /> Novo Grupo
        </Button>
      </div>

      {isLoading ? (
        <div className="h-16 rounded-lg bg-muted/50 animate-pulse" />
      ) : groups.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground">Nenhum grupo cadastrado. Adicione um grupo para enviar mensagens automáticas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {groups.map((g) => (
            <div
              key={g.id}
              className={cn(
                'bg-card border border-border rounded-lg p-3 flex items-start justify-between gap-2',
                'hover:shadow-sm transition-all duration-200'
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">{g.phone_or_id}</p>
                {g.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{g.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(g)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteId(g.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Grupo' : 'Novo Grupo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Equipe Comercial" />
            </div>
            <div className="space-y-1.5">
              <Label>ID do Grupo (EZ Chat)</Label>
              <Input value={form.phone_or_id} onChange={(e) => setForm(f => ({ ...f, phone_or_id: e.target.value }))} placeholder="Ex: 5511999999999-group" className="font-mono text-sm" />
              <p className="text-[10px] text-muted-foreground">Identificador usado pela API para enviar mensagens ao grupo.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição (opcional)</Label>
              <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição do grupo" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir grupo?</AlertDialogTitle>
            <AlertDialogDescription>Mensagens automáticas configuradas para este grupo deixarão de funcionar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
