import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  useCadences,
  useCreateCadence,
  useUpdateCadence,
  useDeleteCadence,
  useCreateCadenceStep,
  useUpdateCadenceStep,
  useDeleteCadenceStep,
} from '@/hooks/useCadences';
import { Cadence, CadenceStep, Channel } from '@/types/lead';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Mail,
  Phone,
  Clock,
  Target,
  FileText,
  ArrowLeft,
  Loader2,
  PlayCircle,
  PauseCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { PageHeader } from '@/components/PageHeader';

const CadencesPage = () => {
  const { data: cadences, isLoading } = useCadences();
  const createCadenceMutation = useCreateCadence();
  const updateCadenceMutation = useUpdateCadence();
  const deleteCadenceMutation = useDeleteCadence();
  const createStepMutation = useCreateCadenceStep();
  const updateStepMutation = useUpdateCadenceStep();
  const deleteStepMutation = useDeleteCadenceStep();

  const [showNewCadenceDialog, setShowNewCadenceDialog] = useState(false);
  const [selectedCadence, setSelectedCadence] = useState<Cadence | null>(null);
  const [editingStep, setEditingStep] = useState<CadenceStep | null>(null);
  const [newCadenceName, setNewCadenceName] = useState('');
  const [newCadenceDescription, setNewCadenceDescription] = useState('');

  // New step form state
  const [newStepChannel, setNewStepChannel] = useState<Channel>('email');
  const [newStepWaitHours, setNewStepWaitHours] = useState(0);
  const [newStepObjective, setNewStepObjective] = useState('');
  const [newStepScript, setNewStepScript] = useState('');
  const [showNewStepForm, setShowNewStepForm] = useState(false);

  const handleCreateCadence = async () => {
    if (!newCadenceName.trim()) {
      toast.error('Nome da cadência é obrigatório');
      return;
    }

    try {
      await createCadenceMutation.mutateAsync({
        name: newCadenceName,
        description: newCadenceDescription,
      });
      toast.success('Cadência criada com sucesso!');
      setShowNewCadenceDialog(false);
      setNewCadenceName('');
      setNewCadenceDescription('');
    } catch {
      toast.error('Erro ao criar cadência');
    }
  };

  const handleToggleCadence = async (cadence: Cadence) => {
    try {
      await updateCadenceMutation.mutateAsync({
        id: cadence.id,
        updates: { active: !cadence.active },
      });
      toast.success(cadence.active ? 'Cadência pausada' : 'Cadência ativada');
    } catch {
      toast.error('Erro ao atualizar cadência');
    }
  };

  const handleDeleteCadence = async (id: string) => {
    try {
      await deleteCadenceMutation.mutateAsync(id);
      toast.success('Cadência excluída');
      if (selectedCadence?.id === id) {
        setSelectedCadence(null);
      }
    } catch {
      toast.error('Erro ao excluir cadência');
    }
  };

  const handleCreateStep = async () => {
    if (!selectedCadence) return;
    if (!newStepObjective.trim() || !newStepScript.trim()) {
      toast.error('Objetivo e script são obrigatórios');
      return;
    }

    try {
      await createStepMutation.mutateAsync({
        cadence_id: selectedCadence.id,
        step_number: (selectedCadence.steps?.length || 0) + 1,
        channel: newStepChannel,
        wait_hours: newStepWaitHours,
        objective: newStepObjective,
        script_template: newStepScript,
      });
      toast.success('Etapa adicionada!');
      setShowNewStepForm(false);
      resetStepForm();
    } catch {
      toast.error('Erro ao criar etapa');
    }
  };

  const handleUpdateStep = async () => {
    if (!editingStep) return;

    try {
      await updateStepMutation.mutateAsync({
        id: editingStep.id,
        updates: {
          channel: editingStep.channel,
          wait_hours: editingStep.wait_hours,
          objective: editingStep.objective,
          script_template: editingStep.script_template,
        },
      });
      toast.success('Etapa atualizada!');
      setEditingStep(null);
    } catch {
      toast.error('Erro ao atualizar etapa');
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    try {
      await deleteStepMutation.mutateAsync(stepId);
      toast.success('Etapa excluída');
    } catch {
      toast.error('Erro ao excluir etapa');
    }
  };

  const resetStepForm = () => {
    setNewStepChannel('email');
    setNewStepWaitHours(0);
    setNewStepObjective('');
    setNewStepScript('');
  };

  const getChannelIcon = (channel: Channel) => {
    switch (channel) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'whatsapp':
        return <WhatsAppIcon className="h-4 w-4" size={16} />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getChannelColor = (channel: Channel) => {
    switch (channel) {
      case 'email':
        return 'text-chart-2';
      case 'call':
        return 'text-chart-1';
      case 'whatsapp':
        return 'text-chart-3';
      default:
        return 'text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <PageHeader
              icon={<Target className="h-5 w-5" strokeWidth={1.5} />}
              title="Cadências"
              subtitle="Gerencie suas sequências de prospecção outbound"
              actions={
                <Button onClick={() => setShowNewCadenceDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Cadência
                </Button>
              }
              className="pb-0 flex-1"
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cadences List */}
          <div className="lg:col-span-1">
            <div className="space-y-3">
              {(!cadences || cadences.length === 0) ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <Target className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma cadência criada ainda
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setShowNewCadenceDialog(true)}
                    >
                      Criar primeira cadência
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                cadences.map((cadence) => (
                  <Card
                    key={cadence.id}
                    className={cn(
                      'cursor-pointer transition-all hover:border-primary/50',
                      selectedCadence?.id === cadence.id && 'border-primary bg-accent/30'
                    )}
                    onClick={() => setSelectedCadence(cadence)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{cadence.name}</CardTitle>
                        <Badge
                          variant={cadence.active ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {cadence.active ? 'Ativa' : 'Pausada'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {cadence.description || 'Sem descrição'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Target className="h-3 w-3" />
                        <span>{cadence.steps?.length || 0} etapas</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Cadence Details */}
          <div className="lg:col-span-2">
            {selectedCadence ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{selectedCadence.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedCadence.description || 'Sem descrição'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="active-switch" className="text-sm">
                          {selectedCadence.active ? 'Ativa' : 'Pausada'}
                        </Label>
                        <Switch
                          id="active-switch"
                          checked={selectedCadence.active}
                          onCheckedChange={() => handleToggleCadence(selectedCadence)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteCadence(selectedCadence.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Etapas da Cadência</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowNewStepForm(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Etapa
                    </Button>
                  </div>

                  {/* New Step Form */}
                  {showNewStepForm && (
                    <Card className="mb-4 border-primary/50 bg-accent/20">
                      <CardContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Canal</Label>
                            <Select
                              value={newStepChannel}
                              onValueChange={(v) => setNewStepChannel(v as Channel)}
                            >
                              <SelectTrigger className="bg-card">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-popover border">
                                <SelectItem value="email">E-mail</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                <SelectItem value="call">Ligação</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Aguardar (horas)</Label>
                            <Input
                              type="number"
                              min={0}
                              value={newStepWaitHours}
                              onChange={(e) => setNewStepWaitHours(parseInt(e.target.value) || 0)}
                              className="bg-card"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Objetivo da etapa</Label>
                          <Input
                            placeholder="Ex: Abrir conversa e gerar curiosidade"
                            value={newStepObjective}
                            onChange={(e) => setNewStepObjective(e.target.value)}
                            className="bg-card"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Script / Template</Label>
                          <Textarea
                            placeholder="Escreva o script da mensagem..."
                            value={newStepScript}
                            onChange={(e) => setNewStepScript(e.target.value)}
                            className="min-h-[150px] bg-card"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleCreateStep}>
                            <Save className="h-4 w-4 mr-2" />
                            Salvar Etapa
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setShowNewStepForm(false);
                              resetStepForm();
                            }}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Steps List */}
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {(!selectedCadence.steps || selectedCadence.steps.length === 0) ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Nenhuma etapa ainda</p>
                        </div>
                      ) : (
                        selectedCadence.steps.map((step, index) => (
                          <Card key={step.id} className="relative">
                            {/* Step number indicator */}
                            <div className="absolute -left-3 top-4 flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                              {index + 1}
                            </div>

                            <CardContent className="pt-4 pl-6">
                              {editingStep?.id === step.id ? (
                                // Editing mode
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Canal</Label>
                                      <Select
                                        value={editingStep.channel}
                                        onValueChange={(v) =>
                                          setEditingStep({ ...editingStep, channel: v as Channel })
                                        }
                                      >
                                        <SelectTrigger className="bg-card">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-popover border">
                                          <SelectItem value="email">E-mail</SelectItem>
                                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                          <SelectItem value="call">Ligação</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Aguardar (horas)</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        value={editingStep.wait_hours}
                                        onChange={(e) =>
                                          setEditingStep({
                                            ...editingStep,
                                            wait_hours: parseInt(e.target.value) || 0,
                                          })
                                        }
                                        className="bg-card"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Objetivo</Label>
                                    <Input
                                      value={editingStep.objective}
                                      onChange={(e) =>
                                        setEditingStep({ ...editingStep, objective: e.target.value })
                                      }
                                      className="bg-card"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Script</Label>
                                    <Textarea
                                      value={editingStep.script_template}
                                      onChange={(e) =>
                                        setEditingStep({
                                          ...editingStep,
                                          script_template: e.target.value,
                                        })
                                      }
                                      className="min-h-[150px] bg-card"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={handleUpdateStep}>
                                      <Save className="h-4 w-4 mr-1" />
                                      Salvar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingStep(null)}
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                // View mode
                                <>
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                      <div className={cn('p-2 rounded-md bg-muted', getChannelColor(step.channel))}>
                                        {getChannelIcon(step.channel)}
                                      </div>
                                      <div>
                                        <p className="font-medium capitalize">{step.channel}</p>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <Clock className="h-3 w-3" />
                                          {step.wait_hours === 0
                                            ? 'Imediato'
                                            : `Após ${step.wait_hours}h`}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setEditingStep(step)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => handleDeleteStep(step.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="mb-2">
                                    <p className="text-xs text-muted-foreground mb-1">Objetivo:</p>
                                    <p className="text-sm font-medium">{step.objective}</p>
                                  </div>
                                  <Separator className="my-3" />
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Script:</p>
                                    <pre className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md max-h-32 overflow-y-auto">
                                      {step.script_template}
                                    </pre>
                                  </div>
                                </>
                              )}
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full min-h-[400px] flex items-center justify-center border-dashed">
                <CardContent className="text-center">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium text-foreground mb-1">Selecione uma cadência</h3>
                  <p className="text-sm text-muted-foreground">
                    Escolha uma cadência ao lado para editar suas etapas
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* New Cadence Dialog */}
      <Dialog open={showNewCadenceDialog} onOpenChange={setShowNewCadenceDialog}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Nova Cadência</DialogTitle>
            <DialogDescription>
              Crie uma nova sequência de prospecção para seus leads outbound
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da cadência</Label>
              <Input
                id="name"
                placeholder="Ex: Cadência B2B Tech"
                value={newCadenceName}
                onChange={(e) => setNewCadenceName(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                placeholder="Descreva o objetivo desta cadência..."
                value={newCadenceDescription}
                onChange={(e) => setNewCadenceDescription(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCadenceDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCadence}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Cadência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CadencesPage;
