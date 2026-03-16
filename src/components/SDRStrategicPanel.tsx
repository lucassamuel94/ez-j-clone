import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Lead, LeadStatus } from '@/types/lead';
import { FUNNEL_STEPS, STATUS_TO_STEP } from './FunnelStepper';
import { useSDRStages } from '@/hooks/useSDRStages';
import { createLeadNote } from '@/services/leadService';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, Target, Clock, Paperclip, FileText, FileSpreadsheet, ImageIcon, Eye, Download, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const AUTO_SCHEDULE_HOURS: Record<string, number> = {
  'Ocupado': 1,
  'Sem retorno': 4,
};

const SectionBlock = ({ title, icon, badge, defaultOpen = true, children }: {
  title: string; icon: React.ReactNode; badge?: string | number; defaultOpen?: boolean; children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full min-w-0 overflow-hidden">
      <div className="rounded-lg border bg-card overflow-hidden w-full min-w-0">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2 flex-1 basis-0 min-w-0">
              <span className="flex items-center justify-center h-5 w-5 rounded bg-primary/10 text-primary shrink-0">{icon}</span>
              <span className="text-xs font-medium truncate">{title}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {badge !== undefined && (
                <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">{badge}</span>
              )}
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="w-full min-w-0 overflow-hidden">
          <div className="border-t px-3 py-3 overflow-hidden">
            <div className="w-full min-w-0 overflow-hidden">{children}</div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// These constants are now used only as inline fallbacks;
// the component prefers dynamic values from useSDRStages.

interface SDRStrategicPanelProps {
  lead: Lead;
  interactions: unknown[];
  notes: unknown[];
  onStepClick: (stepKey: string) => void;
  onSubstatusChange: (status: LeadStatus) => void;
  onRegisterOutcome: () => void;
  onUpdateLead: (lead: Lead) => void;
  onSendEmail?: () => void;
  onOpenScheduleReturn?: () => void;
  /** Override funnel steps (e.g. API Oficial pipeline) */
  overrideFunnelSteps?: { key: string; label: string }[];
  /** Override status→step mapping */
  overrideStatusToStep?: Record<string, string>;
  /** Override linear (progression) steps */
  overrideLinearSteps?: string[];
  /** Override short labels */
  overrideStepShortLabels?: Record<string, string>;
  /** Override current status string (e.g. from api_oficial_deals.stage) */
  overrideCurrentStatus?: string;
  /** Override quick-action buttons */
  overrideQuickActions?: string[];
}

export const SDRStrategicPanel = ({
  lead,
  interactions,
  notes,
  onStepClick,
  onSubstatusChange,
  onRegisterOutcome,
  onUpdateLead,
  onSendEmail,
  onOpenScheduleReturn,
  overrideFunnelSteps,
  overrideStatusToStep,
  overrideLinearSteps,
  overrideStepShortLabels,
  overrideCurrentStatus,
  overrideQuickActions,
}: SDRStrategicPanelProps) => {
  const queryClient = useQueryClient();
  const [confirmStep, setConfirmStep] = useState<string | null>(null);
  const {
    funnelSteps: dynamicFunnelSteps,
    statusToStep: dynamicStatusToStep,
    linearSteps: dynamicLinearSteps,
    stepShortLabels: dynamicStepShort,
  } = useSDRStages();

  const effectiveFunnelSteps = overrideFunnelSteps ?? (dynamicFunnelSteps.length > 0 ? dynamicFunnelSteps : FUNNEL_STEPS);
  const effectiveStatusToStep = overrideStatusToStep ?? (Object.keys(dynamicStatusToStep).length > 0 ? dynamicStatusToStep : STATUS_TO_STEP);
  const effectiveLinearSteps = overrideLinearSteps ?? dynamicLinearSteps;
  const effectiveStepShort = overrideStepShortLabels ?? dynamicStepShort;

  const STEP_LABELS = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of effectiveFunnelSteps) {
      map[s.key] = s.label;
    }
    return map;
  }, [effectiveFunnelSteps]);

  const currentStatus = overrideCurrentStatus ?? lead.status;
  const activeStep = effectiveStatusToStep[currentStatus] || effectiveFunnelSteps[0]?.key || 'novo';
  const activeLinearIndex = effectiveLinearSteps.indexOf(activeStep);
  const isCurrentLinear = activeLinearIndex >= 0;

  const handleStageClick = useCallback((stepKey: string) => {
    setConfirmStep(stepKey);
  }, []);

  const handleConfirmStep = useCallback(() => {
    if (confirmStep) {
      onStepClick(confirmStep);
      setConfirmStep(null);
    }
  }, [confirmStep, onStepClick]);

  const handleAutoScheduleStatus = useCallback(async (status: string) => {
    const hours = AUTO_SCHEDULE_HOURS[status];
    const nextAction = new Date();
    nextAction.setHours(nextAction.getHours() + hours);
    const timeStr = nextAction.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = nextAction.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    onUpdateLead({ ...lead, status: status as LeadStatus, last_contact_at: new Date(), next_action_at: nextAction });
    toast.success(`Status atualizado para "${status}"`, { description: `Retorno agendado para ${dateStr} às ${timeStr}` });
    await createLeadNote({ lead_id: lead.id, note: `[${status}] Retorno automático agendado para ${dateStr} às ${timeStr}` });
  }, [lead, onUpdateLead]);

  const handleStatusClick = useCallback((status: string) => {
    if (status === 'Em contato' || status === 'Agendar retorno') {
      onOpenScheduleReturn?.();
      return;
    }
    if (AUTO_SCHEDULE_HOURS[status]) {
      handleAutoScheduleStatus(status);
      return;
    }
    onSubstatusChange(status as LeadStatus);
  }, [onOpenScheduleReturn, handleAutoScheduleStatus, onSubstatusChange]);

  // Attachments from notes
  const allAttachments = useMemo(() => {
    if (!notes || (notes as unknown[]).length === 0) return [];
    const files: { name: string; path: string; size: number; type: string; date: Date }[] = [];
    for (const note of notes as Record<string, unknown>[]) {
      if (note.attachments && Array.isArray(note.attachments)) {
        for (const att of note.attachments as Record<string, unknown>[]) {
          const rawName = att?.name;
          const name = typeof rawName === 'string' && rawName.trim() !== '' ? rawName.trim() : 'Arquivo';
          files.push({
            name,
            path: (att.path as string) || '',
            size: (att.size as number) || 0,
            type: (att.type as string) || '',
            date: note.created_at instanceof Date ? note.created_at : new Date(note.created_at as string),
          });
        }
      }
    }
    return files;
  }, [notes]);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="h-3.5 w-3.5" />;
    if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return <FileSpreadsheet className="h-3.5 w-3.5" />;
    return <FileText className="h-3.5 w-3.5" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDateTimeBR = (date: Date) =>
    date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' +
    date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const MAX_FILE_NAME = 45;
  const truncName = (n: string) => {
    const s = typeof n === 'string' ? n : 'Arquivo';
    return s.length <= MAX_FILE_NAME ? s : s.slice(0, MAX_FILE_NAME - 3).trim() + '...';
  };

  const handleViewAttachment = async (path: string) => {
    try {
      const { data } = await supabase.storage.from('lead-attachments').createSignedUrl(path, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch { toast.error('Erro ao abrir arquivo'); }
  };

  const handleDownloadAttachment = async (path: string, name: string) => {
    try {
      const { data } = await supabase.storage.from('lead-attachments').createSignedUrl(path, 3600, { download: name });
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch { toast.error('Erro ao baixar arquivo'); }
  };

  const handleDeleteAttachment = async (path: string) => {
    try {
      const { error } = await supabase.storage.from('lead-attachments').remove([path]);
      if (error) throw error;
      toast.success('Arquivo removido');
    } catch { toast.error('Erro ao remover arquivo'); }
  };

  // Sub-status buttons
  const SUB_STATUSES = overrideQuickActions ?? ['Ocupado', 'Agendar retorno', 'Sem retorno'];

  return (
    <div className="space-y-3 p-4 overflow-hidden w-full min-w-0">
      {/* Stage Progression */}
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">Estágio</p>

      <div className="relative overflow-visible">
        <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border/60 z-0" />
        {effectiveFunnelSteps.map((step, i) => {
          const isActive = step.key === activeStep;
          const linearIdx = effectiveLinearSteps.indexOf(step.key);
          const isPast = isCurrentLinear && linearIdx >= 0 && linearIdx < activeLinearIndex;
          const isLost = step.key === 'perdido';

          return (
            <button
              key={step.key}
              onClick={() => handleStageClick(step.key)}
              className={cn(
                "relative flex items-center gap-3 w-full py-1.5 px-2 rounded-lg text-left z-10",
                "transition-all duration-150 hover:scale-[1.02] hover:bg-muted/50 active:scale-[0.98] cursor-pointer",
                isActive && "bg-primary/10",
              )}
            >
              <div className={cn(
                "h-[22px] w-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 transition-all",
                isPast && "bg-primary border-primary",
                isActive && "bg-card border-primary",
                !isPast && !isActive && "bg-card border-border",
              )}>
                {isPast
                  ? <Check className="h-3 w-3 text-primary-foreground" />
                  : <span className={cn("text-[9px] font-bold", isActive ? "text-primary" : "text-muted-foreground")}>{i + 1}</span>
                }
              </div>
              <span className={cn(
                "text-[12px] transition-colors truncate",
                isPast && "text-foreground font-medium",
                isActive && "text-primary font-semibold",
                !isPast && !isActive && "text-muted-foreground font-normal",
              )}>
                {effectiveStepShort[step.key] || step.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub-status quick actions */}
      <SectionBlock title="Ações rápidas" icon={<Clock className="h-3 w-3" />} defaultOpen={true}>
        <div className="flex flex-col gap-1.5">
          {SUB_STATUSES.map(status => (
            <button
              key={status}
              onClick={() => handleStatusClick(status)}
              className="text-left text-[11px] px-2.5 py-1.5 rounded-md bg-muted/40 hover:bg-muted/70 text-foreground transition-colors"
            >
              {status}
            </button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={onRegisterOutcome}
            className="w-full mt-1 text-[11px] h-7"
          >
            <Target className="h-3 w-3 mr-1.5" />
            Registrar resultado
          </Button>
        </div>
      </SectionBlock>

      {/* Attachments */}
      {allAttachments.length > 0 && (
        <SectionBlock title="Anexos" icon={<Paperclip className="h-3 w-3" />} badge={allAttachments.length} defaultOpen={false}>
          <div className="flex flex-col gap-1.5 w-full min-w-0">
            {allAttachments.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 w-full min-w-0 overflow-hidden rounded-md px-2 py-1.5 bg-muted/30">
                <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                  <span className="flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary shrink-0">
                    {getFileIcon(file.type)}
                  </span>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-[10px] font-medium truncate" title={file.name}>{truncName(file.name)}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{formatFileSize(file.size)} · {formatDateTimeBR(file.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => handleViewAttachment(file.path)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground" title="Visualizar">
                    <Eye className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => handleDownloadAttachment(file.path, file.name)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground" title="Baixar">
                    <Download className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => handleDeleteAttachment(file.path)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-destructive" title="Remover">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionBlock>
      )}

      {/* Confirm dialog */}
      <AlertDialog open={!!confirmStep} onOpenChange={(open) => !open && setConfirmStep(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar mudança de estágio</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja alterar o estágio do funil para <span className="font-semibold text-foreground">{confirmStep ? STEP_LABELS[confirmStep] : ''}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStep}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
