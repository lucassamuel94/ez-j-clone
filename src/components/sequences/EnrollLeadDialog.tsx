import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, Check } from 'lucide-react';
import { useEmailSequences, useSequenceEnrollments } from '@/hooks/useEmailSequences';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EnrollLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
}

export function EnrollLeadDialog({ open, onOpenChange, leadId, leadName }: EnrollLeadDialogProps) {
  const { sequences, isLoading } = useEmailSequences();
  const { enrollments, enrollLead } = useSequenceEnrollments({ leadId });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeSequences = sequences.filter(s => s.active);
  const enrolledSequenceIds = new Set(
    enrollments.filter(e => e.status === 'active').map(e => e.sequence_id)
  );

  const handleEnroll = useCallback(async () => {
    if (!selectedId) return;
    try {
      await enrollLead.mutateAsync({ sequence_id: selectedId, lead_id: leadId });
      toast.success('Lead inscrito na sequência');
      onOpenChange(false);
      setSelectedId(null);
    } catch (err: any) {
      if (err?.message?.includes('duplicate')) {
        toast.error('Lead já está inscrito nesta sequência');
      } else {
        toast.error('Erro ao inscrever lead');
      }
    }
  }, [selectedId, leadId, enrollLead, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Inscrever em Sequência
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Inscrever <strong>{leadName}</strong> em uma sequência de e-mails automatizada.
          </p>
        </DialogHeader>

        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : activeSequences.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma sequência ativa disponível.
            </p>
          ) : (
            activeSequences.map(seq => {
              const isEnrolled = enrolledSequenceIds.has(seq.id);
              const isSelected = selectedId === seq.id;
              return (
                <button
                  key={seq.id}
                  type="button"
                  disabled={isEnrolled}
                  onClick={() => setSelectedId(isSelected ? null : seq.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-all",
                    isEnrolled
                      ? "opacity-50 cursor-not-allowed border-border bg-muted/30"
                      : isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/30 hover:bg-muted/20"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{seq.name}</p>
                      {seq.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{seq.description}</p>
                      )}
                    </div>
                    {isEnrolled ? (
                      <Badge variant="secondary" className="text-[10px] h-5">
                        <Check className="h-3 w-3 mr-0.5" />
                        Inscrito
                      </Badge>
                    ) : isSelected ? (
                      <div className="h-5 w-5 rounded-full border-2 border-primary bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleEnroll}
            disabled={!selectedId || enrollLead.isPending}
          >
            {enrollLead.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Inscrever
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
