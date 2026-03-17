import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { LeadStatus } from '@/types/lead';
import { useCloserStages } from '@/hooks/useCloserStages';

// === SDR Filters ===
const SDR_STAGES: { value: LeadStatus; label: string }[] = [
  { value: 'Novo', label: 'Novo/Sem contato' },
  { value: 'Devolvido pelo Closer', label: 'Devolvido pelo Closer' },
  { value: 'Lead Quente', label: 'Lead Quente' },
  { value: 'Reunião agendada', label: 'Reunião Agendada' },
  { value: 'Reunião Confirmada', label: 'Reunião Confirmada' },
  { value: 'Oportunidade criada', label: 'Reunião Realizada' },
  { value: 'Oportunidade Futura', label: 'Oportunidade Futura' },
  { value: 'Reciclagem', label: 'Reciclagem' },
  { value: 'Descartado', label: 'Perdido' },
];

const SDR_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: 'Ocupado', label: 'Ocupado' },
  { value: 'Sem retorno', label: 'Sem retorno' },
  { value: 'Agendar retorno', label: 'Agendar Retorno' },
  { value: 'Em contato', label: 'Em contato' },
];

// Build label map for lookup (SDR only — closer labels built dynamically)
const SDR_LABELS: Record<string, string> = {};
[...SDR_STAGES, ...SDR_STATUSES].forEach(
  (item) => { SDR_LABELS[item.value] = item.label; }
);

interface LeadAdvancedFilterProps {
  selectedStatuses: Set<string>;
  onSelectedStatusesChange: (statuses: Set<string>) => void;
  mode?: 'sdr' | 'closer';
}

export const LeadAdvancedFilter = ({ selectedStatuses, onSelectedStatusesChange, mode = 'sdr' }: LeadAdvancedFilterProps) => {
  const [open, setOpen] = useState(false);
  const { stages: closerStages } = useCloserStages();

  const toggleStatus = (status: string) => {
    const newSet = new Set(selectedStatuses);
    if (newSet.has(status)) {
      newSet.delete(status);
    } else {
      newSet.add(status);
    }
    onSelectedStatusesChange(newSet);
  };

  const clearAll = () => {
    onSelectedStatusesChange(new Set());
  };

  const activeCount = selectedStatuses.size;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8 relative shrink-0">
          <Filter className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-medium">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Filtros avançados</h4>
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-6 px-2 text-xs text-muted-foreground">
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          {mode === 'sdr' ? (
            <>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Estágio do Lead</p>
                <div className="flex flex-wrap gap-1.5">
                  {SDR_STAGES.map((stage) => (
                    <button
                      key={stage.value}
                      onClick={() => toggleStatus(stage.value)}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-md border transition-colors",
                        selectedStatuses.has(stage.value)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:bg-muted"
                      )}
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Status do Lead</p>
                <div className="flex flex-wrap gap-1.5">
                  {SDR_STATUSES.map((status) => (
                    <button
                      key={status.value}
                      onClick={() => toggleStatus(status.value)}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-md border transition-colors",
                        selectedStatuses.has(status.value)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:bg-muted"
                      )}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Estágio da Oportunidade</p>
              <div className="flex flex-wrap gap-1.5">
                {closerStages.map((stage) => (
                  <button
                    key={stage}
                    onClick={() => toggleStatus(stage)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-md border transition-colors",
                      selectedStatuses.has(stage)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:bg-muted"
                    )}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// === Active Filter Chips (inline display) ===

interface ActiveFilterChipsProps {
  selectedStatuses: Set<string>;
  onRemove: (status: string) => void;
  onClearAll: () => void;
}

export function ActiveFilterChips({ selectedStatuses, onRemove, onClearAll }: ActiveFilterChipsProps) {
  if (selectedStatuses.size === 0) return null;

  const items = Array.from(selectedStatuses);

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
      {items.map((status) => (
        <button
          key={status}
          onClick={() => onRemove(status)}
          className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors whitespace-nowrap shrink-0"
        >
          {SDR_LABELS[status] || status}
          <X className="h-2.5 w-2.5" />
        </button>
      ))}
      {items.length > 1 && (
        <button
          onClick={onClearAll}
          className="inline-flex items-center gap-0.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors whitespace-nowrap shrink-0"
        >
          <X className="h-2.5 w-2.5" />
          Limpar
        </button>
      )}
    </div>
  );
}
