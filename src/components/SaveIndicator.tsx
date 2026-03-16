import { useEffect } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SaveIndicatorProps {
  isSaving: boolean;
  lastSavedAt: Date | null;
  className?: string;
}

export const SaveIndicator = ({ isSaving, lastSavedAt, className }: SaveIndicatorProps) => {
  // Show nothing if not saving and not recently saved
  if (!isSaving && !lastSavedAt) {
    return null;
  }

  const showSaved = lastSavedAt && !isSaving;

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-xs transition-all duration-300',
        isSaving 
          ? 'text-muted-foreground' 
          : 'text-success',
        isSaving ? 'opacity-100' : showSaved ? 'opacity-100' : 'opacity-0',
        className
      )}
    >
      {isSaving ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Salvando...</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-3 w-3" />
          <span>Salvo</span>
        </>
      )}
    </div>
  );
};
