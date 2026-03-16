import { useState, useEffect, useCallback } from 'react';
import { useCtrlEnter } from '@/hooks/useCtrlEnter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User, Users, Shuffle, Loader2, UserCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';

type ReassignType = 'specific' | 'distribute' | 'distribute_selected';

interface Profile {
  id: string;
  name: string;
  role: string;
  active: boolean;
}

interface LeadReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeadIds: string[];
  onReassignComplete: () => void;
  mode?: 'sdr' | 'closer';
}

export const LeadReassignDialog = ({
  open,
  onOpenChange,
  selectedLeadIds,
  onReassignComplete,
  mode = 'sdr',
}: LeadReassignDialogProps) => {
  const [reassignType, setReassignType] = useState<ReassignType>('specific');
  const [selectedSdrId, setSelectedSdrId] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [sdrList, setSdrList] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [jobStatus, setJobStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');

  const canSubmit = !isLoading && jobStatus === 'idle' && (
    reassignType === 'distribute' ||
    (reassignType === 'specific' && !!selectedSdrId) ||
    (reassignType === 'distribute_selected' && selectedUserIds.length > 0)
  );
  useCtrlEnter(() => handleReassign(), open && canSubmit);

  useEffect(() => {
    const fetchSdrs = async () => {
      const roles = mode === 'closer'
        ? ['closer', 'admin', 'manager'] as const
        : ['sdr', 'admin', 'manager'] as const;
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', roles);
      
      if (!roleRows || roleRows.length === 0) {
        setSdrList([]);
        return;
      }
      
      const userIds = [...new Set(roleRows.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, role, active')
        .in('id', userIds)
        .eq('active', true)
        .order('name');
      
      if (profiles) {
        setSdrList(profiles);
      }
    };

    if (open) {
      fetchSdrs();
      setReassignType('specific');
      setSelectedSdrId('');
      setSelectedUserIds([]);
      setSearch('');
      setProgress(null);
      setJobStatus('idle');
    }
  }, [open]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const filteredUsers = sdrList.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  const roleLabel = mode === 'closer' ? 'Closer' : 'SDR';
  const entityLabel = mode === 'closer' ? 'oportunidade' : 'lead';

  const handleReassign = async () => {
    if (reassignType === 'specific' && !selectedSdrId) {
      toast.error(`Selecione um ${roleLabel} para alocar`);
      return;
    }

    if (reassignType === 'distribute' && sdrList.length === 0) {
      toast.error(`Não há ${roleLabel}s ativos para distribuição`);
      return;
    }

    if (reassignType === 'distribute_selected' && selectedUserIds.length === 0) {
      toast.error('Selecione pelo menos um usuário para distribuição');
      return;
    }

    setIsLoading(true);
    const total = selectedLeadIds.length;
    setProgress({ current: 0, total });

    try {
      // Map reassignType to distribution_mode
      const distributionMode = reassignType === 'specific' ? 'specific'
        : reassignType === 'distribute' ? 'auto_all' : 'auto_selected';

      const targetUserId = reassignType === 'specific' ? selectedSdrId : (sdrList[0]?.id || '');

      // Create the job in DB
      const { data: job, error: insertError } = await supabase
        .from('bulk_reassign_jobs' as any)
        .insert({
          module: mode,
          entity_ids: selectedLeadIds,
          target_user_id: targetUserId,
          distribution_mode: distributionMode,
          target_user_ids: reassignType === 'distribute_selected' ? selectedUserIds : [],
          total_count: total,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        } as any)
        .select()
        .single();

      if (insertError || !job) throw insertError || new Error('Falha ao criar job');

      const jobId = (job as any).id;
      setJobStatus('running');

      // Subscribe to realtime updates on this job
      const channel = supabase
        .channel(`reassign-job-${jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'bulk_reassign_jobs',
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            const updated = payload.new as any;
            setProgress({ current: updated.processed_count, total: updated.total_count });

            if (updated.status === 'completed') {
              setJobStatus('completed');
              setIsLoading(false);
              toast.success(`${updated.success_count} ${entityLabel}(s) redistribuídos com sucesso!`);
              if (updated.error_count > 0) {
                toast.warning(`${updated.error_count} ${entityLabel}(s) com erro`);
              }
              onReassignComplete();
              channel.unsubscribe();
              setTimeout(() => onOpenChange(false), 1200);
            } else if (updated.status === 'error') {
              setJobStatus('error');
              setIsLoading(false);
              toast.error(updated.error_message || 'Erro na redistribuição');
              channel.unsubscribe();
            }
          }
        )
        .subscribe();

      // Trigger the edge function (fire-and-forget — runs server-side)
      supabase.functions.invoke('bulk-reassign', {
        body: { job_id: jobId },
      }).catch((err) => {
        console.error('Edge function invocation error:', err);
        // The job may still complete if it was already started
      });

    } catch (error) {
      console.error('Error creating reassign job:', error);
      toast.error('Erro ao iniciar redistribuição');
      setIsLoading(false);
      setJobStatus('idle');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Redistribuir {mode === 'closer' ? 'Oportunidades' : 'Leads'}
          </DialogTitle>
          <DialogDescription>
            {selectedLeadIds.length} {entityLabel}(s) selecionado(s) para redistribuição
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup
            value={reassignType}
            onValueChange={(value) => setReassignType(value as ReassignType)}
            className="space-y-4"
            disabled={isLoading}
          >
            {/* Option 1: Specific SDR */}
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="specific" id="specific" className="mt-1" />
              <div className="flex-1 space-y-2">
                <Label htmlFor="specific" className="flex items-center gap-2 cursor-pointer font-normal">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Alocar a um {roleLabel} específico
                </Label>
                {reassignType === 'specific' && (
                  <Select value={selectedSdrId} onValueChange={setSelectedSdrId} disabled={isLoading}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={`Selecione um ${roleLabel}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {sdrList.map((sdr) => (
                        <SelectItem key={sdr.id} value={sdr.id}>
                          {sdr.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Option 2: Distribute all SDRs */}
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="distribute" id="distribute" />
              <Label htmlFor="distribute" className="flex items-center gap-2 cursor-pointer font-normal">
                <Shuffle className="h-4 w-4 text-muted-foreground" />
                Distribuir automaticamente entre {sdrList.length} {roleLabel}s ativos
              </Label>
            </div>

            {/* Option 3: Distribute among selected users */}
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="distribute_selected" id="distribute_selected" className="mt-1" />
              <div className="flex-1 space-y-2">
                <Label htmlFor="distribute_selected" className="flex items-center gap-2 cursor-pointer font-normal">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  Distribuir entre usuários selecionados
                  {selectedUserIds.length > 0 && (
                    <span className="text-xs text-primary font-medium">({selectedUserIds.length})</span>
                  )}
                </Label>
                {reassignType === 'distribute_selected' && (
                  <div className="border border-border rounded-md overflow-hidden">
                    <div className="p-2 border-b border-border">
                      <Input
                        placeholder="Buscar usuário..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-8 text-xs"
                        disabled={isLoading}
                      />
                    </div>
                    <ScrollArea className="h-40">
                      <div className="p-1 space-y-0.5">
                        {filteredUsers.map((user) => (
                          <label
                            key={user.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={selectedUserIds.includes(user.id)}
                              onCheckedChange={() => toggleUser(user.id)}
                              disabled={isLoading}
                            />
                            <span className="truncate">{user.name}</span>
                          </label>
                        ))}
                        {filteredUsers.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">Nenhum usuário encontrado</p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Progress indicator */}
        {progress && (jobStatus === 'running' || jobStatus === 'completed') && (
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground gap-2 min-w-0">
              <span className="flex items-center gap-1.5 truncate min-w-0">
                {jobStatus === 'running' && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                {jobStatus === 'completed' && <CheckCircle2 className="h-3 w-3 text-success shrink-0" />}
                <span className="truncate">{jobStatus === 'running' ? 'Redistribuindo no servidor...' : 'Concluído!'}</span>
              </span>
              <span className="shrink-0 tabular-nums">{progress.current.toLocaleString('pt-BR')}/{progress.total.toLocaleString('pt-BR')}</span>
            </div>
            <Progress value={(progress.current / progress.total) * 100} className="h-2" />
            {jobStatus === 'running' && (
              <p className="text-[11px] text-muted-foreground">
                Pode fechar esta janela — o processamento continua em background.
              </p>
            )}
          </div>
        )}

        {jobStatus === 'error' && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4" />
            Erro na redistribuição. Tente novamente.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading && jobStatus === 'running'}>
            {jobStatus === 'running' ? 'Fechar (continua em background)' : 'Cancelar'}
          </Button>
          <Button onClick={handleReassign} disabled={!canSubmit}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Users className="h-4 w-4 mr-2" />
                Redistribuir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
