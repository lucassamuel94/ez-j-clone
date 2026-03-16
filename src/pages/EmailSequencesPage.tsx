import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Mail, Loader2, BarChart3, List } from 'lucide-react';
import { useEmailSequences, EmailSequence } from '@/hooks/useEmailSequences';
import { SequenceStepEditor } from '@/components/sequences/SequenceStepEditor';
import { SequenceDashboard } from '@/components/sequences/SequenceDashboard';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function EmailSequencesPage() {
  const { sequences, isLoading, createSequence, updateSequence, deleteSequence } = useEmailSequences();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmailSequence | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSequence, setSelectedSequence] = useState<EmailSequence | null>(null);
  const [activeTab, setActiveTab] = useState('sequences');

  const handleOpen = useCallback((seq?: EmailSequence) => {
    if (seq) {
      setEditing(seq);
      setName(seq.name);
      setDescription(seq.description || '');
    } else {
      setEditing(null);
      setName('');
      setDescription('');
    }
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error('Informe o nome da sequência');
      return;
    }
    try {
      if (editing) {
        await updateSequence.mutateAsync({ id: editing.id, name, description });
        setSelectedSequence(prev => prev?.id === editing.id ? { ...prev, name, description } : prev);
        toast.success('Sequência atualizada');
      } else {
        const created = await createSequence.mutateAsync({ name, description });
        setSelectedSequence(created as EmailSequence);
        setActiveTab('sequences');
        toast.success('Sequência criada — configure os steps ao lado');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Erro ao salvar sequência');
    }
  }, [name, description, editing, createSequence, updateSequence]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteSequence.mutateAsync(id);
      if (selectedSequence?.id === id) setSelectedSequence(null);
      toast.success('Sequência removida');
    } catch {
      toast.error('Erro ao remover sequência');
    }
  }, [deleteSequence, selectedSequence]);

  const handleToggleActive = useCallback(async (seq: EmailSequence) => {
    try {
      await updateSequence.mutateAsync({ id: seq.id, active: !seq.active });
      toast.success(seq.active ? 'Sequência pausada' : 'Sequência ativada');
    } catch {
      toast.error('Erro ao atualizar');
    }
  }, [updateSequence]);

  return (
    <>
    <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Sequências de E-mail"
          subtitle="Automatize follow-ups e cadências de e-mail para seus leads."
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="sequences" className="gap-1.5">
              <List className="h-4 w-4" />
              Sequências
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sequences" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sequences list */}
              <div className="lg:col-span-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Sequências
                  </h3>
                  <Button onClick={() => handleOpen()} size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Nova
                  </Button>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : sequences.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="p-6 text-center">
                      <Mail className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Nenhuma sequência criada ainda.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  sequences.map(seq => (
                    <Card
                      key={seq.id}
                      className={cn(
                        'cursor-pointer transition-all hover:shadow-sm',
                        selectedSequence?.id === seq.id
                          ? 'border-primary shadow-sm'
                          : 'border-border'
                      )}
                      onClick={() => setSelectedSequence(seq)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">{seq.name}</p>
                              <Badge
                                variant={seq.active ? 'default' : 'secondary'}
                                className="text-[10px] h-4 shrink-0"
                              >
                                {seq.active ? 'Ativa' : 'Pausada'}
                              </Badge>
                            </div>
                            {seq.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {seq.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                            <Switch
                              checked={seq.active}
                              onCheckedChange={() => handleToggleActive(seq)}
                              className="scale-75"
                            />
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpen(seq)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(seq.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Steps editor */}
              <div className="lg:col-span-2">
                {selectedSequence ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Mail className="h-5 w-5" />
                        Steps — {selectedSequence.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <SequenceStepEditor sequenceId={selectedSequence.id} />
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="p-12 text-center">
                      <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        Selecione uma sequência para editar seus steps.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="dashboard" className="mt-4">
            <SequenceDashboard />
          </TabsContent>
        </Tabs>
    </div>

    {/* Create/Edit Dialog */}
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Sequência' : 'Nova Sequência'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Follow-up pós-reunião" />
          </div>
          <div>
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descreva o objetivo desta sequência..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={createSequence.isPending || updateSequence.isPending}
          >
            {(createSequence.isPending || updateSequence.isPending) && (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
