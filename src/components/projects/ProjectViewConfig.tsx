import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings2, GripVertical, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface FieldConfig {
  id: string;
  label: string;
  visible: boolean;
  required?: boolean;
}

interface ProjectViewConfigProps {
  title: string;
  fields: FieldConfig[];
  onFieldsChange: (fields: FieldConfig[]) => void;
  defaultFields: FieldConfig[];
}

export function ProjectViewConfig({ title, fields, onFieldsChange, defaultFields }: ProjectViewConfigProps) {
  const [open, setOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const toggleField = (id: string) => {
    onFieldsChange(
      fields.map((f) => (f.id === id && !f.required ? { ...f, visible: !f.visible } : f))
    );
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = useCallback(
    (targetIndex: number) => {
      if (draggedIndex === null || draggedIndex === targetIndex) {
        setDraggedIndex(null);
        setDragOverIndex(null);
        return;
      }
      const newFields = [...fields];
      const [moved] = newFields.splice(draggedIndex, 1);
      newFields.splice(targetIndex, 0, moved);
      onFieldsChange(newFields);
      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex, fields, onFieldsChange]
  );

  const resetToDefault = () => {
    onFieldsChange([...defaultFields]);
  };

  const visibleCount = fields.filter((f) => f.visible).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground">
              <Settings2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{title}</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" sideOffset={4} className="w-[240px] p-0 rounded-lg border-border/60 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
          <span className="text-xs font-medium text-foreground">{title}</span>
          <button
            onClick={resetToDefault}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Restaurar
          </button>
        </div>

        {/* Subtitle */}
        <div className="px-3 py-1.5 border-b border-border/20">
          <p className="text-[10px] text-muted-foreground/60">
            {visibleCount} de {fields.length} visíveis
          </p>
        </div>

        {/* Field list */}
        <div className="py-0.5 max-h-[340px] overflow-y-auto">
          {fields.map((field, index) => (
            <div
              key={field.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
              className={cn(
                'flex items-center gap-2 px-3 h-8 transition-all group cursor-grab active:cursor-grabbing',
                'hover:bg-muted/40',
                draggedIndex === index && 'opacity-30',
                dragOverIndex === index && draggedIndex !== null && 'bg-primary/5 border-l-2 border-primary',
              )}
            >
              <GripVertical className="h-3 w-3 text-muted-foreground/20 group-hover:text-muted-foreground/50 flex-shrink-0 transition-colors" />
              
              <button
                onClick={() => !field.required && toggleField(field.id)}
                className={cn(
                  'flex items-center justify-center h-4 w-4 rounded border flex-shrink-0 transition-all',
                  field.visible
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border/60 bg-transparent hover:border-muted-foreground/40',
                  field.required && 'opacity-50 cursor-not-allowed'
                )}
              >
                {field.visible && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              <span
                className={cn(
                  'flex-1 text-xs select-none transition-colors',
                  field.visible ? 'text-foreground' : 'text-muted-foreground/50'
                )}
              >
                {field.label}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---- Storage helpers ----
const STORAGE_KEY_PREFIX = 'project-view-config-';
const CONFIG_VERSION = 2;

export function loadFieldConfig(key: string, defaults: FieldConfig[]): FieldConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    if (!stored) return defaults;
    const parsed = JSON.parse(stored);
    // Support versioned format
    const version = parsed?.version ?? 1;
    const items: FieldConfig[] = Array.isArray(parsed) ? parsed : parsed.fields ?? [];
    if (version < CONFIG_VERSION || items.length === 0) {
      localStorage.removeItem(STORAGE_KEY_PREFIX + key);
      return defaults;
    }
    const storedMap = new Map(items.map((f) => [f.id, f]));
    const merged: FieldConfig[] = [];
    for (const item of items) {
      const def = defaults.find((d) => d.id === item.id);
      if (def) {
        merged.push({ ...def, visible: item.visible });
      }
    }
    for (const def of defaults) {
      if (!storedMap.has(def.id)) {
        merged.push(def);
      }
    }
    return merged;
  } catch {
    return defaults;
  }
}

export function saveFieldConfig(key: string, fields: FieldConfig[]) {
  localStorage.setItem(
    STORAGE_KEY_PREFIX + key,
    JSON.stringify({ version: CONFIG_VERSION, fields: fields.map(({ id, visible }) => ({ id, visible })) })
  );
}
