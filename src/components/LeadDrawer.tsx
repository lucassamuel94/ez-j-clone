import { useState, useRef } from 'react';
import { Lead } from '@/types/lead';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription 
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeadTypeBadge, LeadStatusBadge } from './LeadBadge';
import { NoteDisplay } from './NoteDisplay';
import { LostReasonDialog } from './LostReasonDialog';
import { MeetingConfirmationDialog } from './MeetingConfirmationDialog';
import { MeetingConfirmedDialog } from './MeetingConfirmedDialog';
import { ObservationDialog } from './ObservationDialog';
import { ScheduleReturnDialog } from './ScheduleReturnDialog';
import { CompanyInfoSection, isCompanyInfoComplete, getMissingQualificationFields } from './CompanyInfoSection';
import { SQOValidationSection } from './SQOValidationSection';
import { CompanyDataSection, getMissingCompanyDataFields } from './CompanyDataSection';

import { DeleteLeadDialog } from './DeleteLeadDialog';
import { ActivityLogSection } from './ActivityLogSection';
import { ContactCompanySection } from './ContactCompanySection';
import { LeadActivityTimeline } from './LeadActivityTimeline';
import { useLeadInteractions } from '@/hooks/useLeads';
import { ScrollIndicator } from './ScrollIndicator';
import { SaveIndicator } from './SaveIndicator';
import { 
  isLeadOverdue, 
  getInboundSLA, 
  formatTimeAgo 
} from '@/utils/priorityCalculator';
import { useCadenceStep } from '@/hooks/useLeads';
import { toast } from 'sonner';
import { 
  User, 
  Building2, 
  Mail, 
  Phone, 
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  RotateCcw,
  FileText,
  Target,
  Calendar,
  Send,
  MessageSquare,
  CalendarClock,
  Trash2,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeadStatus, InteractionOutcome } from '@/types/lead';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { SendToCloserDialog } from './SendToCloserDialog';
import { useLeadActions } from '@/hooks/useLeadActions';

interface LeadDrawerProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onUpdateLead: (lead: Lead) => void;
}

export const LeadDrawer = ({ lead, open, onClose, onUpdateLead }: LeadDrawerProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Unified business logic hook
  const actions = useLeadActions({
    lead,
    onUpdateLead,
    onClose,
    mode: 'sdr',
  });

  const { data: interactions = [] } = useLeadInteractions(lead?.id ?? null);

  if (!lead) return null;

  const isInbound = lead.lead_type === 'INBOUND';
  const isOverdue = isLeadOverdue(lead);
  const sla = isInbound ? getInboundSLA(lead) : null;
  const { data: cadenceStep } = useCadenceStep(
    !isInbound ? lead.cadence_id ?? null : null,
    !isInbound ? lead.current_cadence_step ?? null : null
  );

  const handleOpenConfirmedDialog = () => {
    actions.setConfirmedDialogOpen(true);
  };

  const handleQuickActionAttempt = () => {
    const now = new Date().toISOString();
    onUpdateLead({
      ...lead,
      attempts_count: lead.attempts_count + 1,
      last_contact_at: now
    });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg md:max-w-xl flex flex-col overflow-hidden bg-card">
        <SheetHeader className="space-y-1 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 flex-1">
                <div>
                  <div className="flex items-center gap-2">
                    <LeadTypeBadge type={lead.lead_type} />
                    {isOverdue && (
                      <Badge className="gap-1 bg-destructive/15 text-destructive border-0 hover:bg-destructive/20">
                        <AlertCircle className="h-3 w-3" />
                        Atrasado
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lead.status === 'Descartado' && (
                <Button
                  onClick={actions.handleRestoreLead}
                  variant="outline"
                  size="sm"
                  className="gap-1 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restaurar
                </Button>
              )}
              {actions.isAdmin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => actions.setDeleteDialogOpen(true)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Excluir lead permanentemente</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          <SheetTitle className="sr-only">Detalhes do Lead</SheetTitle>
        </SheetHeader>

        <div className="relative flex-1 min-h-0 mt-4">
          <ScrollArea ref={scrollAreaRef} className="h-full">
            <div className="pr-4">
              {/* OUTBOUND Specific Section */}
              {!isInbound && (
                <>
                  {cadenceStep && (
                    <div className="mb-6 bg-muted/30 rounded-lg p-4 border">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Cadência - Etapa {lead.current_cadence_step}
                        </h3>
                        <Badge variant="outline" className="gap-1">
                          {cadenceStep.channel === 'whatsapp' && <WhatsAppIcon className="h-3 w-3" size={12} />}
                          {cadenceStep.channel === 'call' && <Phone className="h-3 w-3" />}
                          {cadenceStep.channel === 'email' && <Mail className="h-3 w-3" />}
                          {cadenceStep.channel}
                        </Badge>
                      </div>
                      <div className="mb-3">
                        <p className="text-xs text-muted-foreground mb-1">Objetivo:</p>
                        <p className="text-sm font-medium">{cadenceStep.objective}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Script:</p>
                        <div className="bg-card rounded-md p-3 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto border">
                          {cadenceStep.script_template}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* History */}
              {interactions.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-3">Histórico de Interações</h3>
                  <div className="space-y-2">
                    {interactions.map((interaction) => (
                      <div key={interaction.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg text-sm">
                        <div className="flex-shrink-0 mt-0.5">
                          {interaction.channel === 'whatsapp' && <WhatsAppIcon className="h-4 w-4 text-chart-3" size={16} />}
                          {interaction.channel === 'call' && <Phone className="h-4 w-4 text-chart-1" />}
                          {interaction.channel === 'email' && <Mail className="h-4 w-4 text-chart-2" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground">{interaction.message_summary}</p>
                          <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(new Date(interaction.occurred_at))}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Company Data Section */}
              <CompanyDataSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} />

              <Separator className="my-4" />

              {/* Status Change */}
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
                    <Target className="h-3.5 w-3.5 text-primary" />
                  </div>
                  Status Atual
                </h3>
                {/* Status Buttons - First Row */}
                <div className="flex flex-wrap gap-1.5">
                  {(['Novo', 'Interesse/Agendar Retorno'] as const).map((status) => {
                    const isSelected = lead.status === status;
                    const tooltips: Record<string, string> = {
                      'Novo': 'Sem tentativa de contato.',
                      'Interesse/Agendar Retorno': 'Conversando com o cliente ou definir data/hora para retornar contato.',
                    };
                    const handleClick = () => {
                      if (status === 'Interesse/Agendar Retorno') {
                        actions.setScheduleReturnDialogOpen(true);
                      } else {
                        actions.handleStatusChange(status as LeadStatus);
                      }
                    };
                    return (
                      <Tooltip key={status}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline" size="sm" onClick={handleClick}
                            className={cn('transition-all h-7 px-2 text-xs',
                              isSelected ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground' : 'bg-muted/50 text-foreground border-border hover:bg-muted hover:text-foreground'
                            )}
                          >
                            {status}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-popover text-popover-foreground border max-w-[250px]"><p>{tooltips[status]}</p></TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>

                {/* Second Row */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => actions.setObservationDialogOpen(true)}
                        className={cn('transition-all h-7 px-2 text-xs',
                          lead.status === 'Em contato' ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground' : 'bg-muted/50 text-foreground border-border hover:bg-muted hover:text-foreground'
                        )}
                      >
                        Follow-up em andamento
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover text-popover-foreground border max-w-[250px]"><p>Tentativas estruturadas de retomada após contato ou reunião</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => actions.handleStatusChange('Reciclagem' as LeadStatus)}
                        className={cn('transition-all h-7 px-2 text-xs',
                          lead.status === ('Reciclagem' as string) ? 'bg-status-reciclagem-solid text-white border-status-reciclagem-solid hover:bg-status-reciclagem-solid/85 hover:text-white' : 'bg-muted/50 text-foreground border-border hover:bg-status-reciclagem-solid hover:text-white hover:border-status-reciclagem-solid'
                        )}
                      >
                        Reciclagem
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover text-popover-foreground border max-w-[250px]"><p>Lead marcado para recontato futuro. Pode ser reaproveitado em novas campanhas.</p></TooltipContent>
                  </Tooltip>
                </div>

                {/* Fourth Row */}
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => {
                          const missingQ = getMissingQualificationFields(lead);
                          const missingC = getMissingCompanyDataFields(lead);
                          if (missingQ.length > 0) { toast.error(`Qualificação incompleta. Campos faltantes: ${missingQ.join(', ')}`); return; }
                          if (missingC.length > 0) { toast.error(`Dados da Empresa incompletos. Campos faltantes: ${missingC.join(', ')}`); return; }
                          handleOpenConfirmedDialog();
                        }}
                        variant="outline" size="sm"
                        className={cn('transition-all h-7 px-2 text-xs w-full',
                          lead.status === 'Oportunidade criada' ? 'bg-status-created-solid text-white border-status-created-solid hover:bg-status-created-solid/85 hover:text-white' : 'bg-muted/50 text-foreground border-border hover:bg-status-created-solid hover:text-white hover:border-status-created-solid'
                        )}
                        disabled={lead.status === 'Oportunidade criada'}
                      >
                        Reunião Realizada
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover text-popover-foreground border max-w-[250px]">
                      <p>{(!isCompanyInfoComplete(lead) || getMissingCompanyDataFields(lead).length > 0) ? `Campos pendentes: ${[...getMissingQualificationFields(lead), ...getMissingCompanyDataFields(lead)].join(', ') || 'Nenhum'}` : 'Confirmar presença do cliente na reunião e enviar para executivo.'}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    onClick={() => actions.setDiscardDialogOpen(true)}
                    variant="outline" size="sm"
                    className={cn('transition-all h-7 px-2 text-xs w-full',
                      lead.status === 'Descartado' ? 'bg-status-discarded-solid text-white border-status-discarded-solid hover:bg-status-discarded-solid/85 hover:text-white' : 'bg-muted/50 text-foreground border-border hover:bg-status-discarded-solid hover:text-white hover:border-status-discarded-solid'
                    )}
                    disabled={lead.status === 'Descartado'}
                  >
                    Perdido
                  </Button>
                </div>
                {lead.status === 'Oportunidade criada' && (
                  <div className="flex gap-1.5 mt-1.5">
                    <Button
                      onClick={actions.handleUndoCloser}
                      variant="outline" size="sm"
                      className="transition-all h-7 px-2 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Desfazer envio ao Closer
                    </Button>
                  </div>
                )}

                {(actions.isAdmin || actions.isManager) && (
                  <Button
                    variant="outline" size="sm"
                    onClick={() => actions.setSendToCloserOpen(true)}
                    className="mt-1.5 h-7 px-2 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Send className="h-3 w-3" />
                    Enviar para Closer
                  </Button>
                )}

                <SendToCloserDialog
                  open={actions.sendToCloserOpen}
                  onOpenChange={actions.setSendToCloserOpen}
                  leadId={lead.id}
                  leadName={lead.name}
                  onSuccess={() => {
                    onUpdateLead({ ...lead, status: 'Oportunidade criada' as LeadStatus });
                    toast.success('Lead enviado ao Closer!');
                  }}
                />
              </div>

              {/* Temperature Section */}
              {(() => {
                const { calculateQualificationScore, scoreToTemperature } = require('@/utils/qualificationScore');
                const score = calculateQualificationScore(lead);
                const calcTemp = scoreToTemperature(score);
                const bars = calcTemp === 'quente' ? 3 : calcTemp === 'morno' ? 2 : 1;
                const labels: Record<string, string> = { frio: 'Baixo', morno: 'Médio', quente: 'Alto' };
                const barColors: Record<string, string> = { frio: 'bg-muted-foreground/40', morno: 'bg-chart-4', quente: 'bg-destructive' };
                const textColors: Record<string, string> = { frio: 'text-muted-foreground', morno: 'text-chart-4', quente: 'text-destructive' };
                return (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                      <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
                        <AlertCircle className="h-3.5 w-3.5 text-primary" />
                      </div>
                      Score de Qualificação
                    </h3>
                    <div className="rounded-lg border p-3 flex items-center justify-between bg-card">
                      <span className={cn("text-sm font-medium flex items-center gap-2", textColors[calcTemp])}>
                        <span className="flex gap-0.5">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className={cn("h-4 w-2 rounded-sm", i < bars ? barColors[calcTemp] : "bg-muted")} />
                          ))}
                        </span>
                        {labels[calcTemp]}
                      </span>
                      <span className={cn("text-lg font-bold", textColors[calcTemp])}>{score}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Calculado automaticamente</p>
                  </div>
                );
              })()}

              {/* Qualification Info Section */}
              <CompanyInfoSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} readOnly={!actions.isSdr} />

              {/* SQO Validation Section */}
              <SQOValidationSection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} readOnly={actions.isSdr} />

              {/* Activity Log Section */}
              <div className="mb-4">
                <div className="border rounded-lg overflow-hidden">
                  <ActivityLogSection leadId={lead.id} />
                </div>
              </div>

              {/* Company Contact Section */}
              <ContactCompanySection lead={lead} onUpdateLead={actions.handleLeadUpdateWithLogging} />

              {/* Unified Activity Timeline */}
              <div className="mb-4" style={{ height: '400px' }}>
                <LeadActivityTimeline
                  leadId={lead.id}
                  canEdit={lead.owner_user_id === actions.currentUserId || actions.isAdmin || actions.isManager}
                  leadData={{ email: lead.email, name: lead.name, company: lead.company, phone: lead.phone, razao_social: lead.razao_social, nome_fantasia: lead.nome_fantasia }}
                />
              </div>
            </div>
          </ScrollArea>
          <ScrollIndicator scrollContainerRef={scrollAreaRef} />
        </div>

        {/* Footer with Save Indicator */}
        <div className="flex-shrink-0 border-t pt-3 mt-2">
          <div className="flex items-center justify-center min-h-[24px]">
            <SaveIndicator isSaving={actions.isSaving} lastSavedAt={actions.lastSavedAt} />
          </div>
        </div>

        {/* Dialogs */}
        <LostReasonDialog open={actions.discardDialogOpen} onOpenChange={actions.setDiscardDialogOpen} onConfirm={actions.handleConfirmDiscard} />
        <MeetingConfirmationDialog open={actions.meetingDialogOpen} onOpenChange={actions.setMeetingDialogOpen} onConfirm={actions.handleConfirmMeeting} companyName={lead.razao_social || lead.nome_fantasia || lead.company} contactEmail={lead.email || undefined} />
        <MeetingConfirmedDialog open={actions.confirmedDialogOpen} onOpenChange={actions.setConfirmedDialogOpen} onConfirm={actions.handleConfirmPresence} companyName={lead.razao_social || lead.nome_fantasia || lead.company} />
        <ObservationDialog open={actions.observationDialogOpen} onOpenChange={actions.setObservationDialogOpen} onConfirm={actions.handleStatusChangeWithObservation} statusName="Em contato" />
        <ScheduleReturnDialog open={actions.scheduleReturnDialogOpen} onOpenChange={actions.setScheduleReturnDialogOpen} onConfirm={actions.handleScheduleReturn} />
        {actions.isAdmin && (
          <DeleteLeadDialog open={actions.deleteDialogOpen} onOpenChange={actions.setDeleteDialogOpen} leadCount={1} leadName={lead.name} onConfirm={actions.handleDeleteLead} isDeleting={actions.deleteLeadMutation.isPending} />
        )}
      </SheetContent>
    </Sheet>
  );
};
