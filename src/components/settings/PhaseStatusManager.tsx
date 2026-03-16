import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePhaseStatuses, PhaseStatus } from '@/hooks/usePhaseStatuses';
import { ALL_PHASES, PHASE_LABELS } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
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
  Save,
  Loader2,
  Pencil,
  Check,
  X,
  ClipboardCheck,
  Palette,
  Code,
  GraduationCap,
  Rocket,
  Cog,
  Brain,
  RadioTower,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6b7280', '#78716c', '#a3a3a3',
];

function ColorPickerButton({ color, onChange }: { color: string | null; onChange: (c: string | null) => void }) {
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
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

const PHASE_ICONS: Record<string, React.ReactNode> = {
  validacao: <ClipboardCheck className="h-4 w-4" strokeWidth={1.5} />,
  ux_po: <Palette className="h-4 w-4" strokeWidth={1.5} />,
  dev_chatbot: <Code className="h-4 w-4" strokeWidth={1.5} />,
  treinamento: <GraduationCap className="h-4 w-4" strokeWidth={1.5} />,
  ativacao: <Rocket className="h-4 w-4" strokeWidth={1.5} />,
  automacao: <Cog className="h-4 w-4" strokeWidth={1.5} />,
  curadoria_ia: <Brain className="h-4 w-4" strokeWidth={1.5} />,
  go_live_assistido: <RadioTower className="h-4 w-4" strokeWidth={1.5} />,
  verificacao_bm: <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />,
};

interface LocalStatus {
  id: string;
  status_name: string;
  sort_order: number;
  is_system: boolean;
  color: string | null;
  isNew?: boolean;
}

function SortableStatusItem({
  item,
  onRename,
  onRemove,
  onColorChange,
}: {
  item: LocalStatus;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onColorChange: (id: string, color: string | null) => void;
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
    if (draft.trim()) {
      onRename(item.id, draft.trim().toUpperCase());
    }
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md border bg-card transition-colors',
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
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/50 hover:text-foreground" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/50 hover:text-destructive" onClick={() => onRemove(item.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </>
      )}
    </div>
  );
}

export function PhaseStatusManager({ embedded = false }: { embedded?: boolean }) {
  const isMobile = useIsMobile();
  const { allStatuses, isLoading, getStatusObjectsForPhase, addStatus, updateStatus, deleteStatus, reorderStatuses } = usePhaseStatuses();

  // Derive custom phases from DB not in ALL_PHASES
  const builtinPhases = new Set(ALL_PHASES as readonly string[]);
  const customPhases = useMemo(() => {
    const keys = new Set<string>();
    allStatuses.forEach((s) => {
      if (!builtinPhases.has(s.phase_name)) keys.add(s.phase_name);
    });
    return Array.from(keys).sort();
  }, [allStatuses]);

  const allPhasesList = [...ALL_PHASES, ...customPhases];

  const [selectedPhase, setSelectedPhase] = useState<string>(ALL_PHASES[0]);
  const [localStatuses, setLocalStatuses] = useState<LocalStatus[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newStatusName, setNewStatusName] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [showNewPhaseInput, setShowNewPhaseInput] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');

  const handleCreatePhase = async () => {
    const name = newPhaseName.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (allPhasesList.includes(slug)) {
      toast.error('Fase já existe');
      return;
    }
    try {
      // Create with system statuses BACKLOG and CONCLUÍDO
      await addStatus.mutateAsync({ phase_name: slug, status_name: 'BACKLOG', sort_order: 0, is_system: true } as any);
      await addStatus.mutateAsync({ phase_name: slug, status_name: 'CONCLUÍDO', sort_order: 100, is_system: true } as any);
      setNewPhaseName('');
      setShowNewPhaseInput(false);
      setSelectedPhase(slug);
      toast.success(`Fase "${name}" criada`);
    } catch {
      toast.error('Erro ao criar fase');
    }
  };

  useEffect(() => {
    if (!isLoading) {
      const dbStatuses = getStatusObjectsForPhase(selectedPhase);
      setLocalStatuses(dbStatuses.map((s) => ({ ...s, isNew: false })));
      setIsDirty(false);
      setShowAddInput(false);
      setNewStatusName('');
    }
  }, [selectedPhase, allStatuses, isLoading]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const systemFirst = localStatuses.find((s) => s.is_system && s.sort_order === 0);
  const systemLast = localStatuses.find((s) => s.is_system && s.sort_order > 0 && s.status_name === 'CONCLUÍDO');
  const intermediateStatuses = localStatuses
    .filter((s) => !s.is_system)
    .sort((a, b) => a.sort_order - b.sort_order);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLocalStatuses((prev) => {
      const intermediate = prev.filter((s) => !s.is_system).sort((a, b) => a.sort_order - b.sort_order);
      const oldIndex = intermediate.findIndex((s) => s.id === active.id);
      const newIndex = intermediate.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;

      const reordered = [...intermediate];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);

      // Reassign sort_order: system first = 0, intermediates start at 1, system last = last
      const result = prev.map((s) => {
        if (s.is_system && s.sort_order === 0) return s;
        if (s.is_system && s.status_name === 'CONCLUÍDO') return { ...s, sort_order: reordered.length + 1 };
        const idx = reordered.findIndex((r) => r.id === s.id);
        if (idx !== -1) return { ...s, sort_order: idx + 1 };
        return s;
      });
      return result;
    });
    setIsDirty(true);
  }, []);

  const handleAddStatus = () => {
    if (!newStatusName.trim()) return;
    const name = newStatusName.trim().toUpperCase();
    // Check duplicate
    if (localStatuses.some((s) => s.status_name === name)) {
      toast.error('Status já existe nesta fase');
      return;
    }
    const newSortOrder = intermediateStatuses.length + 1;
    const newId = `new-${Date.now()}`;
    setLocalStatuses((prev) => {
      // Insert before CONCLUÍDO
      const updated = prev.map((s) => {
        if (s.is_system && s.status_name === 'CONCLUÍDO') return { ...s, sort_order: newSortOrder + 1 };
        return s;
      });
      updated.push({
        id: newId,
        status_name: name,
        sort_order: newSortOrder,
        is_system: false,
        color: null,
        isNew: true,
      });
      return updated;
    });
    setNewStatusName('');
    setShowAddInput(false);
    setIsDirty(true);
  };

  const handleRename = (id: string, newName: string) => {
    setLocalStatuses((prev) => prev.map((s) => (s.id === id ? { ...s, status_name: newName } : s)));
    setIsDirty(true);
  };

  const handleRemove = (id: string) => {
    setLocalStatuses((prev) => prev.filter((s) => s.id !== id));
    setIsDirty(true);
  };

  const handleColorChange = useCallback((id: string, color: string | null) => {
    setLocalStatuses((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)));
    setIsDirty(true);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const dbStatuses = getStatusObjectsForPhase(selectedPhase);
      const dbIds = new Set(dbStatuses.map((s) => s.id));
      const localIds = new Set(localStatuses.filter((s) => !s.isNew).map((s) => s.id));

      // Delete removed
      for (const dbStatus of dbStatuses) {
        if (!dbStatus.is_system && !localIds.has(dbStatus.id)) {
          await deleteStatus.mutateAsync(dbStatus.id);
        }
      }

      // Add new
      for (const ls of localStatuses) {
        if (ls.isNew) {
          await addStatus.mutateAsync({
            phase_name: selectedPhase,
            status_name: ls.status_name,
            sort_order: ls.sort_order,
            color: ls.color || undefined,
          });
        }
      }

      // Update existing (rename + reorder)
      const reorderItems: { id: string; sort_order: number }[] = [];
      for (const ls of localStatuses) {
        if (!ls.isNew && dbIds.has(ls.id)) {
          const orig = dbStatuses.find((d) => d.id === ls.id);
          if (orig && (orig.status_name !== ls.status_name || orig.sort_order !== ls.sort_order || orig.color !== ls.color)) {
            await updateStatus.mutateAsync({
              id: ls.id,
              status_name: ls.status_name,
              sort_order: ls.sort_order,
              color: ls.color || undefined,
            });
          }
        }
      }

      toast.success('Status atualizados com sucesso');
      setIsDirty(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

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
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Etapas de Projeto</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os status intermediários de cada etapa. BACKLOG e CONCLUÍDO são fixos.
          </p>
        </div>
      )}

      <div className={cn('flex gap-6', isMobile && 'flex-col')}>
        {/* Phase selector sidebar */}
        <Card className={cn('shrink-0', isMobile ? 'w-full' : 'w-[220px]')}>
          <CardContent className="p-2">
            <ScrollArea className={cn(isMobile ? 'max-h-40' : 'max-h-[500px]')}>
              <div className="space-y-0.5">
                {allPhasesList.map((phase) => (
                  <button
                    key={phase}
                    onClick={() => setSelectedPhase(phase)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors text-sm',
                      selectedPhase === phase
                        ? 'bg-accent text-primary font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
                    )}
                  >
                    {PHASE_ICONS[phase] || <Cog className="h-4 w-4" strokeWidth={1.5} />}
                    <span className="truncate">{PHASE_LABELS[phase] || phase.charAt(0).toUpperCase() + phase.slice(1).replace(/_/g, ' ')}</span>
                  </button>
                ))}

                {showNewPhaseInput ? (
                  <div className="flex items-center gap-1 px-1 py-1">
                    <Input
                      value={newPhaseName}
                      onChange={(e) => setNewPhaseName(e.target.value)}
                      placeholder="Nome da fase..."
                      className="h-7 text-xs flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreatePhase();
                        if (e.key === 'Escape') { setShowNewPhaseInput(false); setNewPhaseName(''); }
                      }}
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCreatePhase}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setShowNewPhaseInput(false); setNewPhaseName(''); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewPhaseInput(true)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Nova fase</span>
                  </button>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Status list */}
        <Card className="flex-1">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{PHASE_LABELS[selectedPhase] || selectedPhase.charAt(0).toUpperCase() + selectedPhase.slice(1).replace(/_/g, ' ')}</h2>
                <p className="text-xs text-muted-foreground">{localStatuses.length} status configurados</p>
              </div>
              {isDirty && (
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                  Salvar alterações
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              {/* BACKLOG — fixed */}
              {systemFirst && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed bg-muted/20">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />
                  <Badge variant="outline" className="text-xs bg-muted/30 text-muted-foreground border-border/40">
                    {systemFirst.status_name}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground/50 ml-auto">Fixo</span>
                </div>
              )}

              {/* Intermediate — draggable */}
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

              {/* Add new status */}
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
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleAddStatus}>
                    <Check className="h-3.5 w-3.5" />
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

              {/* CONCLUÍDO — fixed */}
              {systemLast && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed bg-chart-3/5">
                  <Lock className="h-3.5 w-3.5 text-chart-3/40" />
                  <Badge variant="outline" className="text-xs bg-chart-3/10 text-chart-3 border-chart-3/20">
                    {systemLast.status_name}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground/50 ml-auto">Fixo</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
