import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plug, Search, Pencil, Trash2, Check, X, Star } from 'lucide-react';

interface CatalogEntry {
  key: string;           // lowercase name used as grouping key
  integration_name: string;
  notes: string | null;
  is_new: boolean;
  project_count: number;
}

function useCatalogAdmin() {
  return useQuery({
    queryKey: ['integrations-catalog-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_integrations')
        .select('integration_name, notes, is_new, project_id');
      if (error) throw error;

      const map = new Map<string, CatalogEntry>();
      for (const row of data || []) {
        const key = row.integration_name.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            key,
            integration_name: row.integration_name.trim(),
            notes: row.notes,
            is_new: row.is_new,
            project_count: 0,
          });
        }
        const entry = map.get(key)!;
        entry.project_count += 1;
        if (row.notes && (!entry.notes || row.notes.length > entry.notes.length)) entry.notes = row.notes;
        if (row.is_new) entry.is_new = true;
      }

      return Array.from(map.values()).sort((a, b) => b.project_count - a.project_count);
    },
  });
}

export function IntegrationsCatalogSection() {
  const queryClient = useQueryClient();
  const { data: entries = [], isLoading } = useCatalogAdmin();

  const [search, setSearch] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editIsNew, setEditIsNew] = useState(false);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);

  const filtered = entries.filter((e) =>
    !search || e.integration_name.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (entry: CatalogEntry) => {
    setEditingKey(entry.key);
    setEditName(entry.integration_name);
    setEditNotes(entry.notes || '');
    setEditIsNew(entry.is_new);
  };

  const cancelEdit = () => setEditingKey(null);

  const saveEdit = useMutation({
    mutationFn: async ({ oldKey, newName, notes, isNew }: { oldKey: string; newName: string; notes: string; isNew: boolean }) => {
      const updatePayload: Record<string, unknown> = {
        integration_name: newName.trim(),
        notes: notes.trim() || null,
        is_new: isNew,
      };
      const { error } = await supabase
        .from('project_integrations')
        .update(updatePayload as any)
        .ilike('integration_name', oldKey);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations-catalog-admin'] });
      queryClient.invalidateQueries({ queryKey: ['integrations-catalog'] });
      toast.success('Integração atualizada');
      setEditingKey(null);
    },
    onError: () => toast.error('Erro ao atualizar integração'),
  });

  const deleteEntry = useMutation({
    mutationFn: async (key: string) => {
      const { error } = await supabase
        .from('project_integrations')
        .delete()
        .ilike('integration_name', key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations-catalog-admin'] });
      queryClient.invalidateQueries({ queryKey: ['integrations-catalog'] });
      toast.success('Integração removida do catálogo');
      setDeleteKey(null);
    },
    onError: () => toast.error('Erro ao remover integração'),
  });

  const toggleNew = useMutation({
    mutationFn: async ({ key, isNew }: { key: string; isNew: boolean }) => {
      const { error } = await supabase
        .from('project_integrations')
        .update({ is_new: isNew } as any)
        .ilike('integration_name', key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations-catalog-admin'] });
      queryClient.invalidateQueries({ queryKey: ['integrations-catalog'] });
    },
    onError: () => toast.error('Erro ao atualizar flag'),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Catálogo de Integrações</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Gerencie os sistemas integrados registrados nas entregas de projetos.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar integração..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 pl-9 text-sm"
        />
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Plug className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">Nenhuma integração encontrada</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sistema</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-center w-24">Projetos</TableHead>
                <TableHead className="text-center w-20">Nova?</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => {
                const isEditing = editingKey === entry.key;
                return (
                  <TableRow key={entry.key}>
                    <TableCell className="align-top pt-3">
                      {isEditing ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 text-sm w-48"
                        />
                      ) : (
                        <span className="font-medium text-sm">{entry.integration_name}</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top pt-3">
                      {isEditing ? (
                        <Textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="text-sm min-h-[60px] w-full"
                          placeholder="Descrição / função desta integração"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground line-clamp-2">{entry.notes || '—'}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center align-top pt-3">
                      <Badge variant="secondary" className="text-xs font-semibold">
                        {entry.project_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center align-top pt-3">
                      {isEditing ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title={editIsNew ? 'Marcar como existente' : 'Marcar como nova'}
                          className={`h-8 w-8 ${editIsNew ? 'text-warning' : 'text-muted-foreground'}`}
                          onClick={() => setEditIsNew(!editIsNew)}
                        >
                          <Star className={`h-4 w-4 ${editIsNew ? 'fill-current' : ''}`} />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          title={entry.is_new ? 'Remover flag Nova' : 'Marcar como Nova'}
                          className={`h-8 w-8 ${entry.is_new ? 'text-warning' : 'text-muted-foreground hover:text-warning'}`}
                          disabled={toggleNew.isPending}
                          onClick={() => toggleNew.mutate({ key: entry.key, isNew: !entry.is_new })}
                        >
                          <Star className={`h-4 w-4 ${entry.is_new ? 'fill-current' : ''}`} />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="align-top pt-2">
                      <div className="flex items-center gap-1 justify-end">
                        {isEditing ? (
                          <>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8 text-chart-3 hover:text-chart-3"
                              disabled={saveEdit.isPending}
                              onClick={() => saveEdit.mutate({ oldKey: entry.key, newName: editName, notes: editNotes, isNew: editIsNew })}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelEdit}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => startEdit(entry)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteKey(entry.key)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog open={!!deleteKey} onOpenChange={() => setDeleteKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover integração do catálogo?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá <strong>todos</strong> os registros de "{deleteKey}" do catálogo de integrações.
              Os projetos associados não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteKey && deleteEntry.mutate(deleteKey)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
