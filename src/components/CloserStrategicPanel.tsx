import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lead } from '@/types/lead';
import { CloserOpportunity, CloserStage } from '@/services/closerService';
import { useCloserStages } from '@/hooks/useCloserStages';
import { useEvolutionStages } from '@/hooks/useEvolutionStages';
import { createLeadNote } from '@/services/leadService';
import { supabase } from '@/integrations/supabase/client';
import { ActivityLogSection } from './ActivityLogSection';
import { cn } from '@/lib/utils';
import { Building2, GitBranch, ChevronDown, PhoneCall, Mail, Clock, Check, Pencil, Flame } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ScheduleReturnDialog, ScheduleReturnData } from './ScheduleReturnDialog';
import { ProjectChecklist } from './projects/ProjectChecklist';

import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

const AUTO_SCHEDULE_HOURS: Record<string, number> = {
  'Ocupado': 1,
};

interface SectionBlockProps {
  title: string;
  icon: React.ReactNode;
  badge?: string | number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const SectionBlock = ({ title, icon, badge, defaultOpen = true, children }: SectionBlockProps) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full min-w-0 overflow-hidden">
      <div className="rounded-lg border bg-card overflow-hidden w-full min-w-0">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2 flex-1 basis-0 min-w-0">
              <span className="flex items-center justify-center h-5 w-5 rounded bg-primary/10 text-primary shrink-0">
                {icon}
              </span>
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

const ActionIcon = ({ href, target, title, className, children }: { href: string; target?: string; title: string; className?: string; children: React.ReactNode }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <a
        href={href}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        className={cn("flex items-center justify-center h-5 w-5 rounded hover:bg-muted text-muted-foreground transition-colors", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </a>
    </TooltipTrigger>
    <TooltipContent side="top" className="text-[10px]">{title}</TooltipContent>
  </Tooltip>
);

const dialPhone = (phone: string) => {
  const clean = phone.replace(/\D/g, '');
  return clean.startsWith('55') ? clean.slice(2) : clean;
};

const waPhone = (phone: string) => {
  const clean = phone.replace(/\D/g, '');
  return clean.startsWith('55') ? clean : `55${clean}`;
};

const EditableTextRow = ({ label, value, onSave }: { label: string; value?: string | null; onSave?: (v: string) => void }) => {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocal(value || ''); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    const trimmed = local.trim();
    if (trimmed !== (value || '') && onSave) onSave(trimmed);
    else setLocal(value || '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 text-[10px]">
        <span className="font-medium text-muted-foreground min-w-[80px] shrink-0">{label}</span>
        <input
          ref={inputRef}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setLocal(value || ''); setEditing(false); } }}
          className="flex-1 bg-transparent border-b border-primary/50 outline-none text-foreground text-[10px] py-0.5"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[10px] group/row">
      <span className="font-medium text-muted-foreground min-w-[80px] shrink-0">{label}</span>
      <span className="text-foreground flex-1 truncate">{value || <span className="text-muted-foreground italic">(Nenhum valor)</span>}</span>
      {onSave && (
        <button type="button" onClick={() => setEditing(true)} className="opacity-0 group-hover/row:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground">
          <Pencil className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
};

const ContactRow = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex items-start gap-2 text-[10px]">
    <span className="font-medium text-muted-foreground min-w-[80px] shrink-0">{label}</span>
    <span className="text-foreground">{value || '—'}</span>
  </div>
);

const EditablePhoneRow = ({ phone, onSave }: { phone?: string | null; onSave?: (v: string) => void }) => {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(phone || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocal(phone || ''); }, [phone]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (!phone && !editing) return null;

  const commit = () => {
    const trimmed = local.trim();
    if (trimmed !== (phone || '') && onSave) onSave(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 text-[10px]">
        <span className="font-medium text-muted-foreground min-w-[80px] shrink-0">Telefone</span>
        <input
          ref={inputRef}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setLocal(phone || ''); setEditing(false); } }}
          className="flex-1 bg-transparent border-b border-primary/50 outline-none text-foreground text-[10px] py-0.5"
          placeholder="(00) 00000-0000"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[10px] group/row">
      <span className="font-medium text-muted-foreground min-w-[80px] shrink-0">Telefone</span>
      <span className="text-foreground flex-1">{phone}</span>
      <div className="flex items-center gap-0.5">
        {onSave && (
          <button type="button" onClick={() => setEditing(true)} className="opacity-0 group-hover/row:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground">
            <Pencil className="h-2.5 w-2.5" />
          </button>
        )}
        <ActionIcon href={`tel:${dialPhone(phone)}`} title="Ligar">
          <PhoneCall className="h-3 w-3" />
        </ActionIcon>
        <ActionIcon href={`https://web.whatsapp.com/send?phone=${waPhone(phone)}`} target="_blank" title="WhatsApp" className="hover:text-green-600">
          <WhatsAppIcon size={12} />
        </ActionIcon>
      </div>
    </div>
  );
};

const PhoneRow = ({ phone }: { phone?: string | null }) => {
  if (!phone) return null;
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="font-medium text-muted-foreground min-w-[80px] shrink-0">Telefone</span>
      <span className="text-foreground flex-1">{phone}</span>
      <div className="flex items-center gap-0.5">
        <ActionIcon href={`tel:${dialPhone(phone)}`} title="Ligar">
          <PhoneCall className="h-3 w-3" />
        </ActionIcon>
        <ActionIcon href={`https://web.whatsapp.com/send?phone=${waPhone(phone)}`} target="_blank" title="WhatsApp" className="hover:text-green-600">
          <WhatsAppIcon size={12} />
        </ActionIcon>
      </div>
    </div>
  );
};

const EmailRow = ({ email, onSendEmail }: { email?: string | null; onSendEmail?: () => void }) => {
  if (!email) return null;
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="font-medium text-muted-foreground min-w-[80px] shrink-0">E-mail</span>
      <span className="text-foreground break-all flex-1">{email}</span>
      {onSendEmail ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSendEmail(); }}
              className={cn("flex items-center justify-center h-5 w-5 rounded hover:bg-muted text-muted-foreground transition-colors")}
            >
              <Mail className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px]">Enviar e-mail</TooltipContent>
        </Tooltip>
      ) : (
        <ActionIcon href={`mailto:${email}`} title="Enviar e-mail">
          <Mail className="h-3 w-3" />
        </ActionIcon>
      )}
    </div>
  );
};

interface CloserStrategicPanelProps {
  lead: Lead;
  opportunity: CloserOpportunity;
  onCloserStageChange?: (stage: CloserStage) => Promise<void>;
  onReturnToSdr?: () => void;
  onUpdateLead: (lead: Lead) => void;
  onOpportunityFieldChange?: () => void;
  onSendEmail?: () => void;
  onNavigateToHistory?: () => void;
  pipelineKey?: 'closer' | 'evolution';
}

export const CloserStrategicPanel = ({
  lead,
  opportunity,
  onCloserStageChange,
  onReturnToSdr,
  onUpdateLead,
  onOpportunityFieldChange,
  onSendEmail,
  onNavigateToHistory,
  pipelineKey: pipelineKeyProp,
}: CloserStrategicPanelProps) => {
  const queryClient = useQueryClient();
  // Auto-detect pipeline from opportunity_type, or use explicit prop
  const resolvedPipelineKey = pipelineKeyProp ?? (opportunity?.opportunity_type === 'evolution' ? 'evolution' : 'closer');
  const closerStagesData = useCloserStages();
  const evolutionStagesData = useEvolutionStages();
  const { stagesDisplay: ALL_STAGES, linearStages: LINEAR_STAGES } = resolvedPipelineKey === 'evolution' ? evolutionStagesData : closerStagesData;
  const [optimisticStage, setOptimisticStage] = useState<string | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [pendingFutureOpportunity, setPendingFutureOpportunity] = useState(false);
  const [confirmStage, setConfirmStage] = useState<string | null>(null);

  // Fetch only the last 4 notes + total count directly via DB query (avoid fetching all notes)
  const { data: notesData } = useQuery({
    queryKey: ['lead-last-notes', lead.id],
    queryFn: async () => {
      const [{ data: notes }, { count }] = await Promise.all([
        supabase
          .from('lead_notes')
          .select('id, note, created_at, user_id')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('lead_notes')
          .select('id', { count: 'exact', head: true })
          .eq('lead_id', lead.id),
      ]);
      return {
        notes: (notes || []).map(n => ({ ...n, created_at: new Date(n.created_at) })),
        total: count || 0,
      };
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    setOptimisticStage(null);
  }, [opportunity?.stage]);

  const handleAutoScheduleStatus = useCallback(async (status: string) => {
    const nextAction = new Date();

    if (status === 'Sem retorno') {
      nextAction.setDate(nextAction.getDate() + 7);
    } else {
      const hours = AUTO_SCHEDULE_HOURS[status];
      nextAction.setHours(nextAction.getHours() + hours);
    }

    const timeStr = nextAction.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = nextAction.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    onUpdateLead({
      ...lead,
      status: status as any,
      last_contact_at: new Date().toISOString(),
      next_action_at: nextAction.toISOString(),
    });

    const delayLabel = status === 'Sem retorno' ? '1 semana' : `${AUTO_SCHEDULE_HOURS[status]}h`;
    toast.success(`Status atualizado para "${status}"`, {
      description: `Retorno agendado para ${dateStr} às ${timeStr} (${delayLabel})`,
    });

    await createLeadNote({
      lead_id: lead.id,
      note: `[${status}] Retorno automático agendado para ${dateStr} às ${timeStr} (${delayLabel})`,
    });

    queryClient.invalidateQueries({ queryKey: ['lead-last-notes', lead.id] });
  }, [lead, onUpdateLead, queryClient]);

  const handleStageClick = useCallback((stage: string) => {
    if (stage === 'Devolver ao SDR') {
      onReturnToSdr?.();
      return;
    }

    if (stage === 'Ganho') {
      setChecklistOpen(true);
      return;
    }

    if (stage === 'Oportunidade Futura') {
      setPendingFutureOpportunity(true);
      setScheduleDialogOpen(true);
      return;
    }

    setConfirmStage(stage);
  }, [onReturnToSdr]);

  const handleConfirmStageChange = useCallback(() => {
    if (!confirmStage) return;
    setOptimisticStage(confirmStage);
    onCloserStageChange?.(confirmStage as CloserStage);

    toast.success(`Estágio atualizado para "${confirmStage}"`);
    setConfirmStage(null);
  }, [confirmStage, onCloserStageChange]);

  if (!opportunity) {
    return null;
  }

  const currentStage = optimisticStage || opportunity.stage;

  const activeLinearIndex = LINEAR_STAGES.indexOf(currentStage);
  const isCurrentLinear = activeLinearIndex >= 0;

  return (
    <div className="space-y-3 p-4 overflow-hidden w-full min-w-0">
      {/* Stage Progression — flat, no SectionBlock */}
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">Estágio</p>

      {/* Unified stepper */}
      <div className="relative overflow-visible">
        <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border/60 z-0" />
        {ALL_STAGES.map((stage, i) => {
          const isActive = currentStage === stage;
          const linearIdx = LINEAR_STAGES.indexOf(stage);
          const isPast = isCurrentLinear && linearIdx >= 0 && linearIdx < activeLinearIndex;
          const isLost = stage === 'Perdido';
          const isReturn = stage === 'Devolver ao SDR';
          return (
            <button
              key={stage}
              onClick={() => handleStageClick(stage)}
              className={cn(
                "relative flex items-center gap-2.5 w-full py-1.5 px-2 rounded-lg transition-all text-left z-10 group",
                isActive && "bg-primary/10",
                !isActive && "hover:bg-muted/50",
                "active:scale-[0.98] hover:scale-[1.01] transition-transform duration-150 cursor-pointer",
              )}
            >
              <div className={cn(
                "h-[22px] w-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all z-10",
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
                {stage}
              </span>
            </button>
          );
        })}
      </div>





      <ScheduleReturnDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        onConfirm={async (data: ScheduleReturnData) => {
          const nextActionDate = new Date(data.date);
          const [hours, minutes] = data.time.split(':').map(Number);
          nextActionDate.setHours(hours, minutes, 0, 0);
          const dateStr = nextActionDate.toLocaleDateString('pt-BR');
          const timeStr = nextActionDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

          onUpdateLead({
            ...lead,
            last_contact_at: new Date().toISOString(),
            next_action_at: nextActionDate.toISOString(),
          });

          if (pendingFutureOpportunity) {
            setOptimisticStage('Oportunidade Futura');
            await onCloserStageChange?.('Oportunidade Futura' as CloserStage);

            await createLeadNote({
              lead_id: lead.id,
              note: `[Oportunidade Futura] Retorno agendado para ${dateStr} às ${timeStr}`,
            });
            queryClient.invalidateQueries({ queryKey: ['lead-last-notes', lead.id] });

            toast.success('Estágio atualizado para "Oportunidade Futura"', {
              description: `Retorno agendado para ${dateStr} às ${timeStr}`,
            });
            setPendingFutureOpportunity(false);
          } else {
            onUpdateLead({
              ...lead,
              status: 'Em contato' as any,
              last_contact_at: new Date().toISOString(),
              next_action_at: nextActionDate.toISOString(),
            });
            toast.success('Retorno agendado', {
              description: `Agendado para ${dateStr} às ${timeStr}`,
            });
          }

          setScheduleDialogOpen(false);
        }}
      />
      <ProjectChecklist
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
        opportunity={opportunity}
        onSuccess={() => {
          setOptimisticStage('Ganho');
          onCloserStageChange?.('Ganho' as CloserStage);
          queryClient.invalidateQueries({ queryKey: ['closer-opportunities'] });
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          toast.success('Negociação marcada como Ganha! 🎉', {
            description: 'Projeto criado com sucesso no pós-venda.',
          });
        }}
      />
      <AlertDialog open={!!confirmStage} onOpenChange={(open) => !open && setConfirmStage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar mudança de estágio</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja alterar o estágio de <span className="font-semibold text-foreground">{currentStage}</span> para <span className="font-semibold text-foreground">{confirmStage}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStageChange}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};