import { useState } from 'react';
import { useCtrlEnter } from '@/hooks/useCtrlEnter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { XCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ReasonItem {
  id: string;
  label: string;
  description: string;
}

interface GenericReasonDialogProps<T extends ReasonItem> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: T) => void;
  title: string;
  subtitle: string;
  confirmLabel: string;
  reasons: T[];
  selectedCount?: number;
}

export function GenericReasonDialog<T extends ReasonItem>({
  open,
  onOpenChange,
  onConfirm,
  title,
  subtitle,
  confirmLabel,
  reasons,
  selectedCount,
}: GenericReasonDialogProps<T>) {
  const [selectedReason, setSelectedReason] = useState<T | null>(null);

  useCtrlEnter(() => handleConfirm(), open && !!selectedReason);

  const handleConfirm = () => {
    if (selectedReason) {
      onConfirm(selectedReason);
      setSelectedReason(null);
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            {title}
            {selectedCount && selectedCount > 1 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({selectedCount} leads)
              </span>
            )}
          </DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-2">
            {reasons.map((reason) => {
              const isSelected = selectedReason?.id === reason.id;
              return (
                <button
                  key={reason.id}
                  onClick={() => setSelectedReason(reason)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-all',
                    'hover:border-primary/50 hover:bg-accent/50',
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors',
                        isSelected
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      )}
                    >
                      {isSelected && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{reason.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {reason.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!selectedReason}
            className="flex-1"
          >
            <XCircle className="h-4 w-4 mr-2" />
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
