import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CloserStage, createOpportunityFromMeeting } from '@/services/closerService';
import { useCloserStages } from '@/hooks/useCloserStages';
import { usePermissions } from '@/hooks/usePermissions';
import { createActivityLog } from '@/services/activityLogService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface SendToCloserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  onSuccess: () => void;
}

export const SendToCloserDialog = ({
  open,
  onOpenChange,
  leadId,
  leadName,
  onSuccess,
}: SendToCloserDialogProps) => {
  const [selectedCloserId, setSelectedCloserId] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<CloserStage>('Demonstração');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { hasPermission } = usePermissions();
  const isAdminTransfer = hasPermission('access_admin');

  // Fetch users with closer role
  const { data: closers = [], isLoading: isLoadingClosers } = useQuery({
    queryKey: ['closer-users'],
    queryFn: async () => {
      const { data: roleRows, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'closer');
      if (roleError) throw roleError;

      const closerIds = roleRows?.map((r) => r.user_id) || [];
      if (closerIds.length === 0) return [];

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', closerIds)
        .eq('active', true)
        .order('name');
      if (profileError) throw profileError;

      return profiles || [];
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Filter stages — exclude terminal ones from initial selection
  const { activeStages } = useCloserStages();
  const availableStages = activeStages;

  const handleSubmit = async () => {
    if (!selectedCloserId) {
      toast.error('Selecione o Closer responsável');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Usuário não autenticado');

      // Admin transfer: sdr_user_id = null (no SDR credit) + skip SQO
      const sdrUserId = isAdminTransfer ? null : session.user.id;

      await createOpportunityFromMeeting(
        leadId,
        sdrUserId,
        selectedCloserId,
        new Date().toISOString(),
        selectedStage,
        true, // skipSqoValidation — SQO é validado pelo Closer ao sair de Demonstração
      );

      // Update lead status
      await supabase
        .from('leads')
        .update({ status: 'Oportunidade criada' as never })
        .eq('id', leadId);

      // Activity log
      const closerName = closers.find(c => c.id === selectedCloserId)?.name || 'Closer';
      const description = isAdminTransfer
        ? `[Admin] transferiu lead diretamente ao Closer ${closerName}, dispensando SDR`
        : `enviou lead diretamente ao Closer (sem qualificação SDR)`;

      await createActivityLog({
        lead_id: leadId,
        action_type: 'opportunity_created',
        field_name: 'closer_stage',
        new_value: selectedStage,
        description,
      }).catch(console.error);

      toast.success('Lead enviado ao Closer com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao enviar para Closer: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Enviar para Closer
          </DialogTitle>
          <DialogDescription>
            Enviar <span className="font-medium">{leadName}</span> diretamente ao
            pipeline do Closer, sem necessidade de qualificação SDR.
          </DialogDescription>
        </DialogHeader>

        {isAdminTransfer && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning dark:text-warning">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>
              <strong>Transferência administrativa</strong> — validação SQO dispensada, SDR não receberá crédito de produtividade.
            </span>
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Closer responsável *</Label>
            <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingClosers ? 'Carregando…' : 'Selecione o Closer'} />
              </SelectTrigger>
              <SelectContent>
                {closers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Estágio inicial</Label>
            <Select value={selectedStage} onValueChange={(v) => setSelectedStage(v as CloserStage)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableStages.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !selectedCloserId}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enviando…
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Confirmar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
