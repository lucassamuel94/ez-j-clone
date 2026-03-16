import { useState, useCallback, memo, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePipelineStatuses, PipelineStatus } from '@/hooks/usePipelineStatuses';
import { PhaseStatusManager } from '@/components/settings/PhaseStatusManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Lock,
  Plus,
  Trash2,
  Loader2,
  Pencil,
  Check,
  X,
  MessageSquareMore,
  Handshake,
  Globe,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6b7280', '#78716c', '#a3a3a3',
];

const SortableStatusItem = memo(function SortableStatusItem({
  item,
  onRename,
  onRemove,
  onColorChange,
}: {
  item: PipelineStatus;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.status_name);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== item.status_name) {
      onRename(item.id, trimmed);
    }
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card transition-colors',
        isDragging && 'shadow-md',
        
      )}
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground/50 hover:text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </button>

      {editing ? (
        <div className="flex items-center gap-1.5 flex-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-7 text-xs font-medium"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') { setDraft(item.status_name); setEditing(false); }
            }}
            onBlur={handleSave}
          />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSave}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setDraft(item.status_name); setEditing(false); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <>
          <ColorPickerButton color={item.color} onChange={(c) => onColorChange(item.id, c)} />
          <span className="text-sm font-medium text-foreground flex-1">{item.status_name}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/50 hover:text-foreground" onClick={() => { setDraft(item.status_name); setEditing(true); }}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/50 hover:text-destructive" onClick={() => onRemove(item.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </>
      )}
    </div>
  );
});

function ColorPickerButton({ color, onChange }: { color: string | null; onChange: (c: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="h-5 w-5 rounded-full border border-border/60 shrink-0 transition-transform hover:scale-110"
          style={{ backgroundColor: color || '#a3a3a3' }}
          title="Escolher cor"
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="grid grid-cols-5 gap-1.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChange(c)}
              className={cn(
                'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                color === c ? 'border-foreground scale-110' : 'border-transparent',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FixedStatusRow({ label, variant }: { label: string; variant: 'start' | 'end' }) {
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-md border border-dashed',
      variant === 'start' ? 'bg-muted/20' : 'bg-chart-3/5',
    )}>
      <Lock className={cn('h-3.5 w-3.5', variant === 'start' ? 'text-muted-foreground/40' : 'text-chart-3/40')} />
      <Badge
        variant="outline"
        className={cn(
          'text-xs',
          variant === 'start'
            ? 'bg-muted/30 text-muted-foreground border-border/40'
            : 'bg-chart-3/10 text-chart-3 border-chart-3/20',
        )}
      >
        {label}
      </Badge>
      <span className="text-[10px] text-muted-foreground/50 ml-auto">Fixo</span>
    </div>
  );
}

function PipelineTab({ pipeline }: { pipeline: 'sdr' | 'closer' | 'api_oficial' | 'evolution' }) {
  const { getStatusObjectsForPipeline, addStatus, updateStatus, deleteStatus } = usePipelineStatuses();
  const [newStatusName, setNewStatusName] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  

  const dbStatuses = getStatusObjectsForPipeline(pipeline);
  const systemStatuses = dbStatuses.filter((s) => s.is_system).sort((a, b) => a.sort_order - b.sort_order);
  const systemFirst = systemStatuses.filter((s) => s.sort_order < 50);
  const systemLast = systemStatuses.filter((s) => s.sort_order >= 50);
  const intermediateStatuses = dbStatuses
    .filter((s) => !s.is_system)
    .sort((a, b) => a.sort_order - b.sort_order);


  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const intermediate = dbStatuses.filter((s) => !s.is_system).sort((a, b) => a.sort_order - b.sort_order);
    const oldIndex = intermediate.findIndex((s) => s.id === active.id);
    const newIndex = intermediate.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...intermediate];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Save all reordered sort_orders
    try {
      await Promise.all(
        reordered.map((s, idx) =>
          s.sort_order !== idx + 1
            ? updateStatus.mutateAsync({ id: s.id, sort_order: idx + 1 })
            : Promise.resolve()
        )
      );
    } catch {
      toast.error('Erro ao reordenar');
    }
  }, [dbStatuses, updateStatus]);

  const handleAddStatus = async () => {
    if (!newStatusName.trim()) return;
    const name = newStatusName.trim();
    if (dbStatuses.some((s) => s.status_name.toLowerCase() === name.toLowerCase())) {
      toast.error('Status já existe neste pipeline');
      return;
    }
    const newSortOrder = intermediateStatuses.length + 1;
    setNewStatusName('');
    setShowAddInput(false);
    try {
      await addStatus.mutateAsync({ pipeline, status_name: name, sort_order: newSortOrder });
      toast.success(`"${name}" adicionado`);
    } catch {
      toast.error('Erro ao criar status');
    }
  };

  const handleRename = useCallback((id: string, newName: string) => {
    updateStatus.mutate({ id, status_name: newName }, {
      onError: () => toast.error('Erro ao renomear'),
    });
  }, [updateStatus]);

  const handleRemove = useCallback((id: string) => {
    deleteStatus.mutate(id, {
      onError: () => toast.error('Erro ao remover'),
      onSuccess: () => toast.success('Status removido'),
    });
  }, [deleteStatus]);

  const handleColorChange = useCallback((id: string, color: string) => {
    updateStatus.mutate({ id, color }, {
      onError: () => toast.error('Erro ao alterar cor'),
    });
  }, [updateStatus]);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">{dbStatuses.length} status configurados</p>

        <div className="space-y-1.5">
          {systemFirst.map((s) => (
            <FixedStatusRow key={s.id} label={s.status_name} variant="start" />
          ))}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={intermediateStatuses.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {intermediateStatuses.map((item) => (
                <SortableStatusItem
                  key={item.id}
                  item={item}
                  onRename={handleRename}
                  onRemove={handleRemove}
                  onColorChange={handleColorChange}
                  
                />
              ))}
            </SortableContext>
          </DndContext>

          {showAddInput ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-primary/30 bg-primary/5">
              <Input
                value={newStatusName}
                onChange={(e) => setNewStatusName(e.target.value)}
                placeholder="Nome do status..."
                className="h-7 text-xs font-medium flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddStatus();
                  if (e.key === 'Escape') { setShowAddInput(false); setNewStatusName(''); }
                }}
              />
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleAddStatus} disabled={addStatus.isPending}>
                {addStatus.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setShowAddInput(false); setNewStatusName(''); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground gap-2" onClick={() => setShowAddInput(true)}>
              <Plus className="h-3.5 w-3.5" />
              Adicionar status
            </Button>
          )}

          {systemLast.map((s) => (
            <FixedStatusRow key={s.id} label={s.status_name} variant="end" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const BUILTIN_PIPELINES: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: 'sdr', label: 'SDR', icon: <MessageSquareMore className="h-4 w-4" strokeWidth={1.5} /> },
  { key: 'closer', label: 'Oportunidades', icon: <Handshake className="h-4 w-4" strokeWidth={1.5} /> },
  { key: 'api_oficial', label: 'API Oficial', icon: <Globe className="h-4 w-4" strokeWidth={1.5} /> },
  { key: 'evolution', label: 'Evolução', icon: <TrendingUp className="h-4 w-4" strokeWidth={1.5} /> },
];

function CommercialPipelinePanel() {
  const { allStatuses, addStatus } = usePipelineStatuses();
  const [selectedPipeline, setSelectedPipeline] = useState<string>('sdr');
  const [showNewInput, setShowNewInput] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const isMobile = useIsMobile();

  const builtinKeys = new Set(['sdr', 'closer', 'api_oficial', 'evolution']);
  const customPipelines = useMemo(() => {
    const keys = new Set<string>();
    allStatuses.forEach((s) => {
      if (!builtinKeys.has(s.pipeline)) keys.add(s.pipeline);
    });
    return Array.from(keys).sort();
  }, [allStatuses]);

  const allPipelineOptions = [
    ...BUILTIN_PIPELINES,
    ...customPipelines.map((key) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      icon: <Handshake className="h-4 w-4" strokeWidth={1.5} />,
    })),
  ];

  const handleCreatePipeline = async () => {
    const name = newPipelineName.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if ([...builtinKeys, ...customPipelines].includes(slug)) {
      toast.error('Pipeline já existe');
      return;
    }
    try {
      await (addStatus as { mutateAsync: (p: Record<string, unknown>) => Promise<void> }).mutateAsync({
        pipeline: slug,
        status_name: 'Novo',
        sort_order: 0,
        is_system: true,
      });
      setNewPipelineName('');
      setShowNewInput(false);
      setSelectedPipeline(slug);
      toast.success(`Pipeline "${name}" criado`);
    } catch {
      toast.error('Erro ao criar pipeline');
    }
  };

  return (
    <div className={cn('flex gap-6', isMobile && 'flex-col')}>
      <Card className={cn('shrink-0', isMobile ? 'w-full' : 'w-[220px]')}>
        <CardContent className="p-2">
          <ScrollArea className={cn(isMobile ? 'max-h-24' : 'max-h-[500px]')}>
            <div className="space-y-0.5">
              {allPipelineOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSelectedPipeline(opt.key)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors text-sm',
                    selectedPipeline === opt.key
                      ? 'bg-accent text-primary font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
                  )}
                >
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}

              {showNewInput ? (
                <div className="flex items-center gap-1 px-1 py-1">
                  <Input
                    value={newPipelineName}
                    onChange={(e) => setNewPipelineName(e.target.value)}
                    placeholder="Nome do pipeline..."
                    className="h-7 text-xs flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreatePipeline();
                      if (e.key === 'Escape') { setShowNewInput(false); setNewPipelineName(''); }
                    }}
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCreatePipeline}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setShowNewInput(false); setNewPipelineName(''); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewInput(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30"
                >
                  <Plus className="h-4 w-4" />
                  <span>Novo pipeline</span>
                </button>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="flex-1">
        <PipelineTab pipeline={selectedPipeline as 'sdr' | 'closer' | 'api_oficial' | 'evolution'} />
      </div>
    </div>
  );
}

export function PipelineStatusManager() {
  const { isLoading } = usePipelineStatuses();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Etapas do Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os status dos pipelines Comercial e Projetos. Status fixos não podem ser removidos.
        </p>
      </div>

      <Tabs defaultValue="commercial" className="w-full">
        <TabsList>
          <TabsTrigger value="commercial">Comercial</TabsTrigger>
          <TabsTrigger value="projects">Projetos</TabsTrigger>
        </TabsList>
        <TabsContent value="commercial">
          <CommercialPipelinePanel />
        </TabsContent>
        <TabsContent value="projects">
          <PhaseStatusManager embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
