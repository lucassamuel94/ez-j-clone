import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Check, X, ArrowRight, Loader2,
  BookText, Info, GripVertical,
} from 'lucide-react';

interface VocabRule {
  id: string;
  from_text: string;
  to_text: string;
  is_regex: boolean;
  is_active: boolean;
  priority: number;
  notes: string | null;
  created_at: string;
}

const QUERY_KEY = ['transcription-vocabulary'];

function useVocabulary() {
  return useQuery<VocabRule[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transcription_vocabulary' as any)
        .select('*')
        .order('priority', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as VocabRule[];
    },
  });
}

// ─── Empty form state ──────────────────────────────────────────────────────────

const emptyForm = (): Omit<VocabRule, 'id' | 'created_at'> => ({
  from_text: '',
  to_text: '',
  is_regex: false,
  is_active: true,
  priority: 10,
  notes: '',
});

// ─── Inline row editor ────────────────────────────────────────────────────────

interface RowEditorProps {
  initial: Omit<VocabRule, 'id' | 'created_at'>;
  onSave: (values: Omit<VocabRule, 'id' | 'created_at'>) => void;
  onCancel: () => void;
  saving: boolean;
}

const RowEditor = ({ initial, onSave, onCancel, saving }: RowEditorProps) => {
  const [v, setV] = useState(initial);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) =>
    setV(prev => ({ ...prev, [k]: val }));

  return (
    <TableRow className="bg-muted/30">
      <TableCell className="text-center py-2">
        <Input
          value={v.priority}
          onChange={e => set('priority', Number(e.target.value))}
          type="number"
          min={1}
          className="h-7 w-16 text-xs text-center"
        />
      </TableCell>
      <TableCell className="py-2">
        <Input
          value={v.from_text}
          onChange={e => set('from_text', e.target.value)}
          placeholder="Palavra / regex original"
          className="h-7 text-xs font-mono"
          autoFocus
        />
      </TableCell>
      <TableCell className="py-2">
        <Input
          value={v.to_text}
          onChange={e => set('to_text', e.target.value)}
          placeholder="Substituição"
          className="h-7 text-xs font-mono"
        />
      </TableCell>
      <TableCell className="py-2 text-center">
        <Switch
          checked={v.is_regex}
          onCheckedChange={val => set('is_regex', val)}
          className="scale-75"
        />
      </TableCell>
      <TableCell className="py-2 text-center">
        <Switch
          checked={v.is_active}
          onCheckedChange={val => set('is_active', val)}
          className="scale-75"
        />
      </TableCell>
      <TableCell className="py-2">
        <Input
          value={v.notes || ''}
          onChange={e => set('notes', e.target.value)}
          placeholder="Observação opcional"
          className="h-7 text-xs"
        />
      </TableCell>
      <TableCell className="py-2">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-success hover:text-success hover:bg-success/5 dark:hover:bg-success/5"
            onClick={() => onSave(v)}
            disabled={saving || !v.from_text.trim() || !v.to_text.trim()}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel} disabled={saving}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────

export const TranscriptionVocabularyEditor = () => {
  const { data: rules = [], isLoading } = useVocabulary();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);

  // ── Toggle active ──────────────────────────────────────────────────────────
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('transcription_vocabulary' as any)
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error('Erro ao atualizar regra'),
  });

  // ── Save (insert or update) ────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string | null;
      values: Omit<VocabRule, 'id' | 'created_at'>;
    }) => {
      const payload = {
        from_text: values.from_text.trim(),
        to_text: values.to_text.trim(),
        is_regex: values.is_regex,
        is_active: values.is_active,
        priority: values.priority,
        notes: values.notes?.trim() || null,
      };
      if (id) {
        const { error } = await supabase
          .from('transcription_vocabulary' as any)
          .update(payload)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('transcription_vocabulary' as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_, { id }) => {
      toast.success(id ? 'Regra atualizada' : 'Regra adicionada');
      setEditingId(null);
      setAddingNew(false);
      invalidate();
    },
    onError: () => toast.error('Erro ao salvar regra'),
  });

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transcription_vocabulary' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Regra removida');
      setDeletingId(null);
      invalidate();
    },
    onError: () => toast.error('Erro ao remover regra'),
  });

  const activeCount = rules.filter(r => r.is_active).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BookText className="h-4 w-4 text-primary" />
            Vocabulário de Transcrição
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Regras aplicadas automaticamente após cada transcrição do Deepgram.
            {activeCount > 0 && (
              <span className="ml-1">
                <Badge variant="secondary" className="text-[10px] h-4">{activeCount} ativa{activeCount > 1 ? 's' : ''}</Badge>
              </span>
            )}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => { setAddingNew(true); setEditingId(null); }}
          disabled={addingNew}
        >
          <Plus className="h-3.5 w-3.5" /> Nova regra
        </Button>
      </div>

      {/* Info card */}
      <Card className="border-info/20 bg-info/5 dark:border-info/20 dark:bg-info/10">
        <CardContent className="py-3 px-4">
          <div className="flex gap-2 text-xs text-info dark:text-info">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p><strong>Literal:</strong> substitui a palavra exata (case-insensitive). Ex: <code className="bg-info/15 dark:bg-info/10 px-1 rounded">Easy Chat</code> → <code className="bg-info/15 dark:bg-info/10 px-1 rounded">EZ Chat</code></p>
              <p><strong>Regex:</strong> usa expressão regular. Ex: <code className="bg-info/15 dark:bg-info/10 px-1 rounded">\bEasy\b</code> substitui "Easy" como palavra isolada.</p>
              <p><strong>Prioridade:</strong> menor número = aplicado primeiro. Coloque regras compostas (ex: "Easy Chat") antes das simples (ex: "Easy").</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs w-16 text-center">Prioridade</TableHead>
              <TableHead className="text-xs">De (original)</TableHead>
              <TableHead className="text-xs">Para (substituição)</TableHead>
              <TableHead className="text-xs text-center w-20">Regex</TableHead>
              <TableHead className="text-xs text-center w-20">Ativa</TableHead>
              <TableHead className="text-xs">Observação</TableHead>
              <TableHead className="text-xs w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* New row form */}
            {addingNew && (
              <RowEditor
                initial={emptyForm()}
                onSave={values => save.mutate({ id: null, values })}
                onCancel={() => setAddingNew(false)}
                saving={save.isPending}
              />
            )}

            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando...
                </TableCell>
              </TableRow>
            ) : rules.length === 0 && !addingNew ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                  Nenhuma regra cadastrada. Clique em "Nova regra" para adicionar.
                </TableCell>
              </TableRow>
            ) : (
              rules.map(rule => {
                if (editingId === rule.id) {
                  return (
                    <RowEditor
                      key={rule.id}
                      initial={{
                        from_text: rule.from_text,
                        to_text: rule.to_text,
                        is_regex: rule.is_regex,
                        is_active: rule.is_active,
                        priority: rule.priority,
                        notes: rule.notes,
                      }}
                      onSave={values => save.mutate({ id: rule.id, values })}
                      onCancel={() => setEditingId(null)}
                      saving={save.isPending}
                    />
                  );
                }

                return (
                  <TableRow
                    key={rule.id}
                    className={!rule.is_active ? 'opacity-40' : undefined}
                  >
                    <TableCell className="text-xs text-center font-mono text-muted-foreground">
                      {rule.priority}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      <span className="bg-muted px-1.5 py-0.5 rounded text-foreground">{rule.from_text}</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="font-mono bg-success/5 dark:bg-success/5 text-success dark:text-success px-1.5 py-0.5 rounded">{rule.to_text}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {rule.is_regex ? (
                        <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-600 dark:text-violet-400">Regex</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Literal</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={val => toggleActive.mutate({ id: rule.id, is_active: val })}
                        className="scale-75"
                        disabled={toggleActive.isPending}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {rule.notes || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => { setEditingId(rule.id); setAddingNew(false); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">Editar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeletingId(rule.id)}
                              disabled={deletingId === rule.id && deleteRule.isPending}
                            >
                              {deletingId === rule.id && deleteRule.isPending
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />
                              }
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">Remover</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirm delete */}
      {deletingId && !deleteRule.isPending && (
        <div className="flex items-center justify-between p-3 border border-destructive/30 bg-destructive/5 rounded-lg text-sm">
          <span className="text-destructive font-medium">Confirmar exclusão desta regra?</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setDeletingId(null)}>Cancelar</Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => deleteRule.mutate(deletingId)}
            >
              Excluir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
