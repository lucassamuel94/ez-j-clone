import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Gauge } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ComplexityLevelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSaved: () => void;
}

export const ComplexityLevelDialog = ({
  open,
  onOpenChange,
  projectId,
  onSaved,
}: ComplexityLevelDialogProps) => {
  const [level, setLevel] = useState<'baixa' | 'media' | 'alta' | ''>('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!level) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ complexity_level: level })
        .eq('id', projectId);

      if (error) throw error;

      toast.success('Nível de complexidade definido');
      onSaved();
      onOpenChange(false);
      setLevel('');
    } catch {
      toast.error('Erro ao salvar complexidade');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-warning/15 text-warning dark:bg-warning/15 dark:text-warning">
              <Gauge className="h-4 w-4" />
            </div>
            Nível de Complexidade
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Defina o nível de complexidade para concluir a validação deste projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label className="text-xs font-medium">
            Complexidade <span className="text-destructive">*</span>
          </Label>
          <Select value={level} onValueChange={(v) => setLevel(v as 'baixa' | 'media' | 'alta')}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecionar complexidade..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!level || saving}>
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
            ) : (
              'Salvar e Continuar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
