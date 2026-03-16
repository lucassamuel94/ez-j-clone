import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, X, CheckSquare, Trash2, XCircle, Hash, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  totalFilteredCount?: number;
  allFilteredSelected?: boolean;
  onSelectAll: () => void;
  onSelectAllFiltered?: () => void;
  onSelectCustomCount?: (count: number) => void;
  onDeselectAll: () => void;
  onReassign?: () => void;
  onDelete?: () => void;
  onDiscard?: () => void;
  showDelete?: boolean;
  showReassign?: boolean;
  showDiscard?: boolean;
  isLoadingSelection?: boolean;
  className?: string;
}

export const BulkActionsBar = ({
  selectedCount,
  totalCount,
  totalFilteredCount,
  allFilteredSelected = false,
  onSelectAll,
  onSelectAllFiltered,
  onSelectCustomCount,
  onDeselectAll,
  onReassign,
  onDelete,
  onDiscard,
  showDelete = false,
  showReassign = true,
  showDiscard = false,
  isLoadingSelection = false,
  className,
}: BulkActionsBarProps) => {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customCount, setCustomCount] = useState('');

  if (selectedCount === 0) return null;

  const allPageSelected = selectedCount >= totalCount && totalCount > 0;
  const showSelectAllFiltered = allPageSelected && onSelectAllFiltered && totalFilteredCount && totalFilteredCount > totalCount && !allFilteredSelected;
  const maxSelectable = totalFilteredCount || totalCount;

  const handleCustomSubmit = () => {
    const num = parseInt(customCount, 10);
    if (!num || num <= 0) return;
    const clamped = Math.min(num, maxSelectable);
    onSelectCustomCount?.(clamped);
    setShowCustomInput(false);
    setCustomCount('');
  };

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
        'bg-card border shadow-lg rounded-lg px-4 py-3',
        'flex flex-col items-center gap-2',
        className
      )}
    >
      {/* Select all filtered banner */}
      {showSelectAllFiltered && (
        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
          <span>Todos os {totalCount} desta página estão selecionados.</span>
          <button
            className="text-primary font-medium hover:underline"
            onClick={onSelectAllFiltered}
            disabled={isLoadingSelection}
          >
            {isLoadingSelection ? (
              <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Carregando...</span>
            ) : (
              `Selecionar todos os ${totalFilteredCount.toLocaleString('pt-BR')} filtrados`
            )}
          </button>
          {onSelectCustomCount && (
            <>
              <span className="text-muted-foreground">ou</span>
              {showCustomInput ? (
                <span className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={1}
                    max={maxSelectable}
                    value={customCount}
                    onChange={(e) => setCustomCount(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                    placeholder={`1-${maxSelectable.toLocaleString('pt-BR')}`}
                    className="h-6 w-28 text-xs"
                    autoFocus
                  />
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleCustomSubmit}>
                    OK
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => { setShowCustomInput(false); setCustomCount(''); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </span>
              ) : (
                <button
                  className="text-primary font-medium hover:underline"
                  onClick={() => setShowCustomInput(true)}
                >
                  selecionar quantidade específica
                </button>
              )}
            </>
          )}
        </div>
      )}

      {allFilteredSelected && totalFilteredCount && (
        <div className="text-xs text-primary font-medium">
          Todos os {totalFilteredCount.toLocaleString('pt-BR')} filtrados estão selecionados.{' '}
          <button
            className="text-muted-foreground hover:underline"
            onClick={onDeselectAll}
          >
            Limpar seleção
          </button>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          {isLoadingSelection ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <CheckSquare className="h-4 w-4 text-primary" />
          )}
          <span className="font-medium">{selectedCount.toLocaleString('pt-BR')}</span>
          <span className="text-muted-foreground">
            de {(allFilteredSelected ? totalFilteredCount : totalCount)?.toLocaleString('pt-BR')} selecionados
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-2">
          {!allFilteredSelected && selectedCount < totalCount ? (
            <Button variant="ghost" size="sm" onClick={onSelectAll}>
              Selecionar página
            </Button>
          ) : !allFilteredSelected ? (
            <Button variant="ghost" size="sm" onClick={onDeselectAll}>
              Limpar seleção
            </Button>
          ) : null}
          
          {showReassign && onReassign && (
            <Button size="sm" onClick={onReassign} disabled={isLoadingSelection}>
              <Users className="h-4 w-4 mr-2" />
              Redistribuir
            </Button>
          )}

          {showDiscard && onDiscard && (
            <Button size="sm" variant="destructive" onClick={onDiscard} disabled={isLoadingSelection}>
              <XCircle className="h-4 w-4 mr-2" />
              Marcar como Perdido
            </Button>
          )}

          {showDelete && onDelete && (
            <Button size="sm" variant="destructive" onClick={onDelete} disabled={isLoadingSelection}>
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onDeselectAll}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
