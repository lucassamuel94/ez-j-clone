import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lead } from '@/types/lead';
import { supabase } from '@/integrations/supabase/client';
import { calculateQualificationScore, scoreToTemperature } from '@/utils/qualificationScore';
import { CloserStage, CloserOpportunity, removeOpportunityByLeadId } from '@/services/closerService';
import { useCloserStages } from '@/hooks/useCloserStages';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { isCompanyInfoComplete } from './CompanyInfoSection';
import { ActivityLogSection } from './ActivityLogSection';

import {
  Building2,
  Mail,
  Phone,
  Calendar,
  CalendarCheck,
  Clock,
  MapPin,
  Target,
  MessageSquare,
  Activity,
  Pencil,
  Check,
  X,
  CircleDot,
  Thermometer,
  Save,
  Loader2,
  RotateCcw,
  Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/utils/priorityCalculator';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { usePermissions } from '@/hooks/usePermissions';
import { SendToCloserDialog } from './SendToCloserDialog';

interface LeadModalPreviewProps {
  lead: Lead;
  interactions: any[];
  notes: any[];
  cadenceStep: any;
  isInbound: boolean;
  onUpdateLead: (lead: Lead) => void;
  onStatusChange?: (status: string) => void;
  onTemperatureChange?: (temp: 'frio' | 'morno' | 'quente') => void;
  onOpenMeetingDialog?: () => void;
  onOpenConfirmedDialog?: () => void;
  onOpenDiscardDialog?: () => void;
  onOpenObservationDialog?: () => void;
  onOpenScheduleReturnDialog?: () => void;
  onAddNote?: (note: string) => Promise<void>;
  isAddingNote?: boolean;
  mode?: 'sdr' | 'closer';
  opportunity?: CloserOpportunity | null;
  onCloserStageChange?: (stage: CloserStage) => Promise<void>;
  onReturnToSdr?: () => void;
  onUndoCloser?: () => void;
  onSendEmail?: () => void;
}

export const LeadModalPreview = ({ 
  lead, 
  interactions, 
  notes, 
  cadenceStep, 
  isInbound, 
  onUpdateLead, 
  onStatusChange, 
  onTemperatureChange,
  onOpenMeetingDialog,
  onOpenConfirmedDialog,
  onOpenDiscardDialog,
  onOpenObservationDialog,
  onOpenScheduleReturnDialog,
  onAddNote,
  isAddingNote,
  mode = 'sdr',
  opportunity,
  onCloserStageChange,
  onReturnToSdr,
  onUndoCloser,
  onSendEmail,
}: LeadModalPreviewProps) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [quickNote, setQuickNote] = useState('');
  const [editedName, setEditedName] = useState(lead.name);
  const [optimisticStage, setOptimisticStage] = useState<string | null>(null);
  const [sendToCloserOpen, setSendToCloserOpen] = useState(false);
  const { hasPermission } = usePermissions();
  const { stagesDisplay: closerStagesDisplay, linearStages: closerLinearStages } = useCloserStages();

  // Sync editedName when lead prop changes
  useEffect(() => {
    setEditedName(lead.name);
  }, [lead.name]);

  // Reset optimistic stage when opportunity prop updates
  useEffect(() => {
    setOptimisticStage(null);
  }, [opportunity?.stage]);

  // Fetch meeting info for scheduled/confirmed leads
  const isScheduledOrConfirmed = lead.status === 'Interesse/Agendar Retorno' || lead.status === 'Oportunidade criada';
  
  const { data: meetingInfo } = useQuery({
    queryKey: ['leadMeetingInfo', lead.id],
    queryFn: async () => {
      // Get the latest meeting for this lead
      const { data: meeting } = await supabase
        .from('meetings')
        .select('meeting_datetime, executive_name, user_id')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get the opportunity to find assigned closer and SDR
      const { data: opportunity } = await supabase
        .from('opportunities')
        .select('assigned_to_user_id, meeting_datetime, sdr_user_id')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let closerName = meeting?.executive_name || null;
      let meetingDatetime = meeting?.meeting_datetime || opportunity?.meeting_datetime || null;
      let sdrName: string | null = null;

      // If we have an assigned closer but no name from meeting, fetch from profiles
      if (!closerName && opportunity?.assigned_to_user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', opportunity.assigned_to_user_id)
          .maybeSingle();
        closerName = profile?.name || null;
      }

      // Fetch SDR name
      const sdrUserId = opportunity?.sdr_user_id || meeting?.user_id;
      if (sdrUserId) {
        const { data: sdrProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', sdrUserId)
          .maybeSingle();
        sdrName = sdrProfile?.name || null;
      }

      if (!closerName && !meetingDatetime) return null;

      return { closerName, meetingDatetime, sdrName };
    },
    enabled: isScheduledOrConfirmed,
  });

  // Memoize qualification score to avoid recalculating on every render
  const { qualScore, qualTemp } = useMemo(() => {
    const s = calculateQualificationScore(lead);
    return { qualScore: s, qualTemp: scoreToTemperature(s) };
  }, [lead.product_interest, lead.main_pain_point, lead.solution_urgency, lead.has_budget, lead.employee_count, lead.revenue_range, lead.company_segment]);

  // Calculate qualification progress
  const qualificationFields = [
    lead.product_interest,
    !!(lead.uses_platform),
    lead.daily_service_volume,
    lead.main_pain_point,
    lead.solution_urgency,
    lead.has_budget,
  ];
  const filledCount = qualificationFields.filter(Boolean).length;
  const qualificationProgress = (filledCount / 6) * 100;

  // Temperature config - using progress bars
  const tempConfig = {
    frio: { bars: 1, label: 'Baixo', color: 'bg-chart-1/10 text-chart-1 border-chart-1/20', barColor: 'bg-muted-foreground/40', textColor: 'text-muted-foreground' },
    morno: { bars: 2, label: 'Médio', color: 'bg-chart-4/10 text-chart-4 border-chart-4/20', barColor: 'bg-chart-4', textColor: 'text-chart-4' },
    quente: { bars: 3, label: 'Alto', color: 'bg-destructive/10 text-destructive border-destructive/20', barColor: 'bg-destructive', textColor: 'text-destructive' },
  };

  const temp = lead.temperature as keyof typeof tempConfig;

  // Display company name: prefer razao_social, then nome_fantasia, then company
  const displayCompanyName = lead.razao_social || lead.nome_fantasia || lead.company;

  const handleSaveName = () => {
    if (editedName.trim() && editedName !== lead.name) {
      onUpdateLead({ ...lead, name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setEditedName(lead.name);
    setIsEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div className="space-y-6">
      {/* Lead Summary */}
      <div className="text-center pb-4 border-b">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        
        {/* Editable Contact Name */}
        {isEditingName ? (
          <div className="flex items-center justify-center gap-2">
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="text-center font-semibold text-lg max-w-[200px] h-8"
              autoFocus
            />
            <button 
              onClick={handleSaveName}
              className="p-1 rounded hover:bg-primary/10 text-primary"
            >
              <Check className="h-4 w-4" />
            </button>
            <button 
              onClick={handleCancelEdit}
              className="p-1 rounded hover:bg-destructive/10 text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 group">
            <h3 className="font-semibold text-lg">{lead.name}</h3>
            <button 
              onClick={() => {
                setEditedName(lead.name);
                setIsEditingName(true);
              }}
              className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        )}
        
        <p className="text-sm text-muted-foreground">{displayCompanyName}</p>
        {lead.clickup_id && (
          <a
            href={`https://ez.clickup.com/t/${lead.clickup_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary hover:underline inline-flex items-center gap-1 justify-center mt-0.5"
          >
            ClickUp #{lead.clickup_id}
          </a>
        )}
        {lead.city && lead.state && (
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-1">
            <MapPin className="h-3 w-3" />
            {lead.city}, {lead.state}
          </p>
        )}

        {/* Quick Action Buttons */}
        <div className="flex items-center justify-center gap-2 mt-3">
          {lead.phone && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-[10px]"
              onClick={() => {
                const cleanPhone = lead.phone!.replace(/\D/g, '');
                const phoneWithoutPrefix = cleanPhone.startsWith('55') ? cleanPhone.slice(2) : cleanPhone;
                window.open(`tel:${phoneWithoutPrefix}`, '_self');
              }}
            >
              <Phone className="h-3.5 w-3.5" />
              Ligar
            </Button>
          )}
          {lead.phone && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-[10px] text-chart-3 border-chart-3/30 hover:bg-chart-3/10"
              onClick={() => {
                const phone = lead.phone?.replace(/\D/g, '') || '';
                window.open(`https://web.whatsapp.com/send?phone=55${phone}`, '_blank');
              }}
            >
              <WhatsAppIcon size={14} />
              WhatsApp
            </Button>
          )}
          {lead.email && onSendEmail && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-[10px]"
              onClick={onSendEmail}
            >
              <Mail className="h-3.5 w-3.5" />
              E-mail
            </Button>
          )}
        </div>
      </div>

      {/* Score de Qualificação (auto-calculado) - BEFORE Status */}
      {(() => {
        const score = qualScore;
        const calcTemp = qualTemp;
        const scoreConfig = {
          frio: { bars: 1, label: 'Baixo', barColor: 'bg-destructive', textColor: 'text-destructive' },
          morno: { bars: 2, label: 'Médio', barColor: 'bg-warning', textColor: 'text-warning' },
          quente: { bars: 3, label: 'Alto', barColor: 'bg-success', textColor: 'text-success' },
        };
        const c = scoreConfig[calcTemp];
        return (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
                <Thermometer className="h-3 w-3 text-primary" />
              </div>
              Score de Qualificação
            </h4>
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className={cn("text-sm font-medium flex items-center gap-2", c.textColor)}>
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className={cn("h-4 w-2 rounded-sm", i < c.bars ? c.barColor : "bg-muted")} />
                    ))}
                  </span>
                  {c.label}
                </span>
                <span className={cn("text-lg font-bold", c.textColor)}>{score}</span>
              </div>
              <div className="w-full bg-muted/50 rounded-full h-1.5">
                <div className={cn("h-1.5 rounded-full transition-all", c.barColor)} style={{ width: `${score}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground">Calculado automaticamente</p>
            </div>
          </div>
        );
      })()}

      {/* Status */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
            <CircleDot className="h-3 w-3 text-primary" />
          </div>
          Status
        </h4>
        
        {mode === 'closer' && opportunity ? (
          <div className="space-y-3">
            {/* Opportunity Stages */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Estágio da Oportunidade</p>
              {(() => {
                const currentStage = optimisticStage || opportunity.stage;
                const activeLinearIndex = closerLinearStages.indexOf(currentStage);
                const isCurrentLinear = activeLinearIndex >= 0;

                return (
                  <div className="grid grid-cols-2 gap-1.5">
                    {closerStagesDisplay.map((stage) => {
                      const isVirtualReturn = stage === 'Devolver ao SDR';
                      const isSelected = !isVirtualReturn && currentStage === stage;
                      const isLost = stage === 'Perdido';
                      const stageLinearIndex = closerLinearStages.indexOf(stage);
                      const isPast = isCurrentLinear && stageLinearIndex >= 0 && stageLinearIndex < activeLinearIndex;

                      return (
                        <button
                          key={stage}
                          onClick={() => {
                            if (isVirtualReturn) {
                              onReturnToSdr?.();
                              return;
                            }
                            setOptimisticStage(stage);
                            onCloserStageChange?.(stage as CloserStage);
                          }}
                          className={cn(
                            "flex items-center justify-center gap-1 text-[10px] py-2 px-3 rounded-md border transition-all font-medium",
                            isVirtualReturn
                              ? 'bg-card border-border hover:border-primary/50 hover:bg-muted/50 text-chart-4 transition-colors cursor-pointer'
                              : isSelected && !isLost
                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                : isSelected && isLost
                                  ? 'bg-destructive text-destructive-foreground border-destructive shadow-sm'
                                  : isPast
                                    ? 'bg-primary/10 text-primary border-primary/30'
                                    : !isLost
                                      ? 'bg-card border-border hover:border-primary/50 hover:bg-muted/50'
                                      : 'bg-card border-border hover:border-destructive/40 hover:bg-destructive/10'
                          )}
                        >
                          {isPast && <Check className="h-3 w-3 shrink-0" />}
                          <span className="truncate">{stage}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            {/* Lead Status */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Status do Lead</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(['Ocupado', 'Sem retorno', 'Agendar retorno', 'Em contato'] as const).map((status) => {
                  const isSelected = lead.status === status;
                  const statusLabels: Record<string, string> = {
                    'Ocupado': 'Ocupado',
                    'Sem retorno': 'Sem retorno',
                    'Agendar retorno': 'Agendar retorno',
                    'Em contato': 'Follow-up em andamento',
                  };
                  const statusTooltips: Record<string, string> = {
                    'Ocupado': 'Cliente atendeu, mas não pode falar no momento',
                    'Em contato': 'Tentativas estruturadas de retomada após contato ou reunião',
                    'Agendar retorno': 'Contato solicitou retorno em data ou período específico',
                    'Sem retorno': 'Cliente parou de responder após múltiplas tentativas',
                  };
                  const handleClick = () => {
                    if (status === 'Em contato') {
                      onOpenScheduleReturnDialog?.();
                    } else if (status === 'Ocupado' || status === 'Agendar retorno' || status === 'Sem retorno') {
                      onStatusChange?.(status);
                      onOpenScheduleReturnDialog?.();
                    } else {
                      onStatusChange?.(status);
                    }
                  };
                  return (
                    <button
                      key={status}
                      onClick={handleClick}
                      title={statusTooltips[status] || ''}
                      className={cn(
                        "text-[10px] py-2 px-3 rounded-md border transition-all font-medium",
                        status === 'Em contato' && 'col-span-2',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-card border-border hover:border-primary/50 hover:bg-muted/50'
                      )}
                    >
                      {statusLabels[status]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Estágio do Lead */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Estágio do Lead</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(['Novo', 'Devolvido pelo Closer', 'Interesse/Agendar Retorno', 'Oportunidade criada', 'Reciclagem', 'Descartado'] as const).map((status) => {
                  const isSelected = lead.status === status;
                  const stageLabels: Record<string, string> = {
                    'Novo': 'Novo/Sem contato',
                    'Devolvido pelo Closer': 'Devolvido pelo Closer',
                    'Interesse/Agendar Retorno': 'Reunião Agendada',
                    'Oportunidade criada': 'Reunião Realizada',
                    'Reciclagem': 'Reciclagem',
                    'Descartado': 'Perdido',
                  };
                  const stageTooltips: Record<string, string> = {
                    'Interesse/Agendar Retorno': 'Lead possui perfil mínimo e segue para próxima etapa (agenda ou demo). ICP validado, dor identificada, próximo passo claro',
                    'Oportunidade criada': 'Lead entrou na reunião com o Closer/Executivo',
                    'Reciclagem': 'Lead será reciclado para nova tentativa de abordagem futura',
                    'Descartado': 'Lead fora do ICP ou sem potencial de compra',
                  };
                  const handleClick = () => {
                    if (status === 'Interesse/Agendar Retorno') {
                      onOpenMeetingDialog?.();
                    } else if (status === 'Oportunidade criada') {
                      onOpenConfirmedDialog?.();
                    } else if (status === 'Descartado') {
                      onOpenDiscardDialog?.();
                    } else {
                      onStatusChange?.(status);
                    }
                  };
                  return (
                    <button
                      key={status}
                      onClick={handleClick}
                      title={stageTooltips[status] || ''}
                      className={cn(
                        "text-[10px] py-2 px-3 rounded-md border transition-all font-medium",
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-card border-border hover:border-primary/50 hover:bg-muted/50'
                      )}
                    >
                      {stageLabels[status]}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Status do Lead */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Status do Lead</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(['Ocupado', 'Sem retorno', 'Agendar retorno', 'Em contato'] as const).map((status) => {
                  const isSelected = lead.status === status;
                  const statusLabels: Record<string, string> = {
                    'Ocupado': 'Ocupado',
                    'Sem retorno': 'Sem retorno',
                    'Agendar retorno': 'Agendar retorno',
                    'Em contato': 'Follow-up em andamento',
                  };
                  const statusTooltips: Record<string, string> = {
                    'Ocupado': 'Cliente atendeu, mas não pode falar no momento',
                    'Em contato': 'Tentativas estruturadas de retomada após contato ou reunião',
                    'Agendar retorno': 'Contato solicitou retorno em data ou período específico',
                    'Sem retorno': 'Cliente parou de responder após múltiplas (+5 em turnos e dias diferentes) tentativas estruturadas',
                  };
                  const handleClick = () => {
                    if (status === 'Em contato') {
                      onOpenScheduleReturnDialog?.();
                    } else if (status === 'Ocupado' || status === 'Agendar retorno' || status === 'Sem retorno') {
                      onStatusChange?.(status);
                      onOpenScheduleReturnDialog?.();
                    } else {
                      onStatusChange?.(status);
                    }
                  };
                  return (
                    <button
                      key={status}
                      onClick={handleClick}
                      title={statusTooltips[status] || ''}
                      className={cn(
                        "text-[10px] py-2 px-3 rounded-md border transition-all font-medium",
                        status === 'Em contato' && 'col-span-2',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-card border-border hover:border-primary/50 hover:bg-muted/50'
                      )}
                    >
                      {statusLabels[status]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Undo send to Closer button */}
        {mode === 'sdr' && lead.status === 'Oportunidade criada' && onUndoCloser && (
          <Button
            variant="outline"
            size="sm"
            onClick={onUndoCloser}
            className="w-full mt-2 text-[10px] gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Desfazer envio ao Closer
          </Button>
        )}

        {/* Send directly to Closer (Admin/Manager only) */}
        {mode === 'sdr' && hasPermission('access_admin') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSendToCloserOpen(true)}
            className="w-full mt-2 text-[10px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
          >
            <Send className="h-3.5 w-3.5" />
            Enviar para Closer
          </Button>
        )}

        <SendToCloserDialog
          open={sendToCloserOpen}
          onOpenChange={setSendToCloserOpen}
          leadId={lead.id}
          leadName={lead.name}
          onSuccess={() => {
            onStatusChange?.('Oportunidade criada');
          }}
        />
      </div>

      {/* Histórico de atividades/logs */}
      <div className="mb-4">
        <ActivityLogSection leadId={lead.id} />
      </div>

      {/* Meeting Info (for Agendado/Confirmada) */}
      {mode !== 'closer' && isScheduledOrConfirmed && meetingInfo && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <div className="h-5 w-5 rounded bg-chart-3/10 flex items-center justify-center">
              <CalendarCheck className="h-3 w-3 text-chart-3" />
            </div>
            Reunião Agendada
          </h4>
          <div className="rounded-lg border bg-chart-3/5 border-chart-3/20 p-3 space-y-1.5">
            {meetingInfo.closerName && (
              <p className="text-sm flex items-center gap-2">
                <span className="text-muted-foreground text-[10px]">Executivo responsável:</span>
                <span className="font-medium">{meetingInfo.closerName}</span>
              </p>
            )}
            {meetingInfo.sdrName && (
              <p className="text-sm flex items-center gap-2">
                <span className="text-muted-foreground text-[10px]">SDR responsável:</span>
                <span className="font-medium">{meetingInfo.sdrName}</span>
              </p>
            )}
            {meetingInfo.meetingDatetime && (
              <>
                <p className="text-sm flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">
                    {new Date(meetingInfo.meetingDatetime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                </p>
                <p className="text-sm flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">
                    {new Date(meetingInfo.meetingDatetime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cadence Info (Outbound) */}
      {cadenceStep && !isInbound && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3 space-y-2">
            <h4 className="text-xs font-medium flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Cadência - Etapa {lead.current_cadence_step}
            </h4>
            <Badge variant="outline" className="text-[10px]">
              {cadenceStep.channel === 'whatsapp' && <WhatsAppIcon className="h-3 w-3 mr-1" size={12} />}
              {cadenceStep.channel === 'call' && <Phone className="h-3 w-3 mr-1" />}
              {cadenceStep.channel === 'email' && <Mail className="h-3 w-3 mr-1" />}
              {cadenceStep.channel}
            </Badge>
            <p className="text-[10px] text-muted-foreground">{cadenceStep.objective}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
