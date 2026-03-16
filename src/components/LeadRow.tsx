import { useState, memo } from 'react';
import { Lead, LeadTemperature } from '@/types/lead';
import { LeadStatusBadge, PriorityIndicator, LeadTypeBadge } from './LeadBadge';
import { QuickActions } from './QuickActions';
import { SDRSelector } from './SDRSelector';
import { isLeadOverdue, isDueToday, formatTimeAgo, formatNextAction } from '@/utils/priorityCalculator';
import { calculateBehavioralScore } from '@/utils/behavioralScore';
import { Building2, User, CalendarClock, CalendarCheck, CheckCircle2, XCircle, RotateCcw, PhoneOff, Clock, PhoneMissed, MessageCircle, ArrowRightCircle, MailX, Flame, TrendingUp, TrendingDown, Phone, Mail, MoreHorizontal, Trash2, Send } from 'lucide-react';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface LeadRowProps {
  lead: Lead;
  onClick: (lead: Lead) => void;
  href?: string;
  isSelected?: boolean;
  isChecked?: boolean;
  onCheckChange?: (leadId: string, checked: boolean) => void;
  showCheckbox?: boolean;
  canEditSdr?: boolean;
  selfAssignOnly?: boolean;
  sdrOnly?: boolean;
  onScheduleReturn?: (lead: Lead) => void;
  onScheduleMeeting?: (lead: Lead) => void;
  onConfirmMeeting?: (lead: Lead) => void;
  onMarkLost?: (lead: Lead) => void;
  onRescheduleMeeting?: (lead: Lead) => void;
  onTemperatureChange?: (lead: Lead, temperature: LeadTemperature) => void;
  onStatusChange?: (lead: Lead, status: string) => void;
  onDelete?: (lead: Lead) => void;
  onSendToCloser?: (lead: Lead) => void;
}

const ScoreBar = ({ level }: { level: 'frio' | 'morno' | 'quente' }) => {
  const bars = level === 'quente' ? 3 : level === 'morno' ? 2 : 1;
  const labels: Record<string, string> = { frio: 'Baixo', morno: 'Médio', quente: 'Alto' };
  const colors: Record<string, string> = {
    frio: 'bg-destructive',
    morno: 'bg-[hsl(var(--chart-2))]',
    quente: 'bg-[hsl(var(--chart-3))]',
  };
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "h-3 w-1.5 rounded-sm transition-colors",
              i < bars ? colors[level] : "bg-muted"
            )}
          />
        ))}
      </div>
      <span className={cn("text-xs font-medium", 
        level === 'quente' ? 'text-[hsl(var(--chart-3))]' : level === 'morno' ? 'text-[hsl(var(--chart-2))]' : 'text-destructive'
      )}>
        {labels[level]}
      </span>
    </div>
  );
};

// Compact score display for mobile
const ScoreDot = ({ level }: { level: 'frio' | 'morno' | 'quente' }) => {
  const colors: Record<string, string> = {
    frio: 'bg-destructive',
    morno: 'bg-[hsl(var(--chart-2))]',
    quente: 'bg-[hsl(var(--chart-3))]',
  };
  return <div className={cn("w-2 h-2 rounded-full flex-shrink-0", colors[level])} />;
};

// Status label helper
const getStatusLabel = (status: string) => {
  switch (status) {
    case 'Descartado': return 'Perdido';
    case 'Em contato': return 'Follow-up';
    case 'Interesse/Agendar Retorno': return 'Agendado';
    case 'Oportunidade criada': return 'Realizada';
    case 'Devolvido pelo Closer': return 'Devolvido';
    default: return status;
  }
};

// Shared status dropdown items to avoid duplication
function StatusDropdownItems({ lead, onStatusChange, onScheduleReturn, onScheduleMeeting, onConfirmMeeting, onMarkLost }: {
  lead: Lead;
  onStatusChange?: (lead: Lead, status: string) => void;
  onScheduleReturn?: (lead: Lead) => void;
  onScheduleMeeting?: (lead: Lead) => void;
  onConfirmMeeting?: (lead: Lead) => void;
  onMarkLost?: (lead: Lead) => void;
}) {
  return (
    <>
      <DropdownMenuItem onClick={() => onStatusChange?.(lead, 'Novo')} className="gap-2">
        <ArrowRightCircle className="h-4 w-4" />
        Novo/Sem contato
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onStatusChange?.(lead, 'Devolvido pelo Closer' as any)} className="gap-2">
        <RotateCcw className="h-4 w-4" />
        Devolvido pelo Closer
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onStatusChange?.(lead, 'Ocupado')} className="gap-2">
        <PhoneOff className="h-4 w-4" />
        Ocupado
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onScheduleReturn?.(lead)} className="gap-2">
        <CalendarClock className="h-4 w-4" />
        Agendar retorno
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onStatusChange?.(lead, 'Em contato')} className="gap-2">
        <MessageCircle className="h-4 w-4" />
        Follow-up em andamento
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onScheduleMeeting?.(lead)} className="gap-2">
        <CalendarCheck className="h-4 w-4" />
        Reunião Agendada
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onConfirmMeeting?.(lead)} className="gap-2">
        <CheckCircle2 className="h-4 w-4" />
        Reunião Realizada
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onStatusChange?.(lead, 'Reciclagem')} className="gap-2">
        <RotateCcw className="h-4 w-4" />
        Reciclagem
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onMarkLost?.(lead)} className="gap-2 text-destructive">
        <XCircle className="h-4 w-4" />
        Perdido
      </DropdownMenuItem>
    </>
  );
}

// Actions component matching Closer pattern exactly
const LeadRowActions = ({ lead, onDelete, onSendToCloser }: { lead: Lead; onDelete?: (lead: Lead) => void; onSendToCloser?: (lead: Lead) => void }) => {
  const [isPhonePopoverOpen, setIsPhonePopoverOpen] = useState(false);
  const [isWhatsAppPopoverOpen, setIsWhatsAppPopoverOpen] = useState(false);

  const phones = [lead.phone, lead.phone_2, lead.phone_3, lead.phone_4].filter(Boolean) as string[];
  const hasMultiplePhones = phones.length > 1;

  const dialNumber = (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const phoneWithoutPrefix = cleanPhone.startsWith('55') ? cleanPhone.slice(2) : cleanPhone;
    window.open(`tel:${phoneWithoutPrefix}`, '_self');
    setIsPhonePopoverOpen(false);
    toast.success('Chamada iniciada via softphone');
  };

  const openWhatsApp = (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    window.open(`https://web.whatsapp.com/send?phone=55${cleanPhone}`, '_blank');
    setIsWhatsAppPopoverOpen(false);
    toast.success('WhatsApp aberto');
  };

  const handleCall = () => {
    if (!lead.phone) { toast.error('Telefone não cadastrado'); return; }
    if (hasMultiplePhones) { setIsPhonePopoverOpen(true); } else { dialNumber(lead.phone); }
  };

  const handleWhatsApp = () => {
    if (!lead.phone) { toast.error('Telefone não cadastrado'); return; }
    if (hasMultiplePhones) { setIsWhatsAppPopoverOpen(true); } else { openWhatsApp(lead.whatsapp || lead.phone); }
  };

  const handleEmail = () => {
    if (!lead.email) { toast.error('E-mail não cadastrado'); return; }
    window.open(`mailto:${lead.email}`, '_self');
  };

  return (
    <div className="flex-shrink-0 w-28 hidden lg:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-0.5">
        {/* Email */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={handleEmail}>
              <Mail className="h-[16px] w-[16px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-popover text-popover-foreground border">
            <p>E-mail</p>
          </TooltipContent>
        </Tooltip>

        {/* WhatsApp */}
        <Popover open={isWhatsAppPopoverOpen} onOpenChange={setIsWhatsAppPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={handleWhatsApp}>
              <WhatsAppIcon size={14} />
            </Button>
          </PopoverTrigger>
          {hasMultiplePhones && (
            <PopoverContent className="w-auto p-2" align="center" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col gap-1">
                {phones.map((num, i) => (
                  <Button key={i} variant="ghost" size="sm" className="justify-start text-sm gap-2 bg-muted text-foreground hover:bg-muted/80" onClick={() => openWhatsApp(num)}>
                    <WhatsAppIcon size={12} />
                    {num}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          )}
        </Popover>

        {/* Phone */}
        <Popover open={isPhonePopoverOpen} onOpenChange={setIsPhonePopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={handleCall}>
              <Phone className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          {hasMultiplePhones && (
            <PopoverContent className="w-auto p-2" align="center" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col gap-1">
                {phones.map((num, i) => (
                  <Button key={i} variant="ghost" size="sm" className="justify-start text-sm gap-2 bg-muted text-foreground hover:bg-muted/80" onClick={() => dialNumber(num)}>
                    <Phone className="h-3 w-3" />
                    {num}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          )}
        </Popover>

        {/* More actions dropdown */}
        {(onDelete || onSendToCloser) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
              {onSendToCloser && (
                <DropdownMenuItem onClick={() => onSendToCloser(lead)} className="gap-2">
                  <Send className="h-4 w-4" />
                  Enviar para Closer
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem onClick={() => onDelete(lead)} className="gap-2 text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};

export const LeadRow = memo(({ lead, onClick, href, isSelected, isChecked, onCheckChange, showCheckbox, canEditSdr, selfAssignOnly, sdrOnly, onScheduleReturn, onScheduleMeeting, onConfirmMeeting, onMarkLost, onRescheduleMeeting, onTemperatureChange, onStatusChange, onDelete, onSendToCloser }: LeadRowProps) => {
  const overdue = isLeadOverdue(lead);
  const dueToday = isDueToday(lead);

  const handleCheckClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const isScorePending = lead.behavioral_score === null || lead.behavioral_score === undefined;
  const bScore = lead.behavioral_score != null ? lead.behavioral_score : calculateBehavioralScore(lead).total;
  const variation = lead.score_variation_48h ?? 0;
  const temp = isScorePending ? 'frio' as const : (bScore >= 70 ? 'quente' as const : bScore >= 40 ? 'morno' as const : 'frio' as const);

  const handleRowClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (href) window.open(href, '_blank');
      return;
    }
    onClick(lead);
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1 && href) {
      e.preventDefault();
      window.open(href, '_blank');
    }
  };

  return (
    <>
      {/* Desktop layout (sm+) */}
      <div
        onClick={handleRowClick}
        onAuxClick={handleAuxClick}
        className={cn(
          'group hidden sm:flex items-center gap-4 px-4 py-3 border-b cursor-pointer transition-all',
          'hover:bg-accent/50',
          isSelected && 'bg-accent/80 border-l-2 border-l-primary',
          overdue && 'bg-destructive/5',
          isChecked && 'bg-primary/5'
        )}
      >
        {/* Checkbox */}
        {showCheckbox && (
          <div
            className={cn(
              "flex-shrink-0 transition-opacity",
              isChecked ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
            onClick={handleCheckClick}
          >
            <Checkbox
              checked={isChecked}
              onCheckedChange={(checked) => onCheckChange?.(lead.id, checked as boolean)}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-sm text-foreground truncate">
              {lead.razao_social || lead.nome_fantasia || lead.company}
            </span>
            <LeadTypeBadge type={lead.lead_type} />
            {lead.is_hot_lead && (
              <Badge variant="outline" className="text-[10px] h-5 bg-destructive/10 text-destructive border-destructive/20 animate-pulse gap-0.5 shrink-0">
                <Flame className="h-3 w-3" />
                Quente
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{lead.name}</span>
          </div>
        </div>

        {/* Behavioral Score */}
        <div className="flex-shrink-0 hidden sm:block w-24 text-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center gap-1.5 cursor-default">
                <ScoreBar level={temp} />
                <span className="text-xs font-semibold text-foreground">{bScore}</span>
                {variation !== 0 && (
                  <span className={cn(
                    "text-[10px] font-medium flex items-center",
                    variation > 0 ? "text-[hsl(var(--chart-3))]" : "text-destructive"
                  )}>
                    {variation > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {variation > 0 ? '+' : ''}{variation}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <p className="text-xs font-medium">Score Comportamental: {bScore}/100</p>
              {variation !== 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {variation > 0 ? '↑' : '↓'} {Math.abs(variation)} pts nas últimas 48h
                </p>
              )}
              {lead.score_variation_reason && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{lead.score_variation_reason}</p>
              )}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Status - plain text */}
        <div className="flex-shrink-0 hidden sm:block w-32 text-center">
          <span className="text-xs text-muted-foreground">
            {getStatusLabel(lead.status)}
          </span>
        </div>

        {/* Last Contact */}
        <div className="flex-shrink-0 w-32 hidden md:block text-center">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {lead.last_contact_at ? formatTimeAgo(new Date(lead.last_contact_at)) : '—'}
          </span>
        </div>

        {/* Next Action - plain text, no duplicate dropdown */}
        <div className="flex-shrink-0 w-28 hidden lg:block text-center">
          <span
            className={cn(
              'text-xs',
              overdue ? 'text-destructive font-medium' : dueToday ? 'text-chart-1 font-medium' : 'text-muted-foreground'
            )}
          >
            {formatNextAction(new Date(lead.next_action_at), lead.status)}
          </span>
        </div>

        {/* Attempts */}
        <div className="flex-shrink-0 w-12 hidden xl:block text-center">
          <span className="text-xs text-muted-foreground">{lead.attempts_count}</span>
        </div>

        {/* SDR */}
        <div className="flex-shrink-0 w-28 hidden md:block text-center">
          <SDRSelector
            leadId={lead.id}
            currentOwnerId={lead.owner_user_id}
            currentOwnerName={lead.owner_name || null}
            disabled={!canEditSdr}
            selfAssignOnly={selfAssignOnly}
            sdrOnly={sdrOnly}
          />
        </div>

        {/* Ações — identical to Closer pattern */}
        <LeadRowActions lead={lead} onDelete={onDelete} onSendToCloser={onSendToCloser} />

      </div>

      {/* Mobile layout (< sm) — Card format */}
      <div
        onClick={handleRowClick}
        onAuxClick={handleAuxClick}
        className={cn(
          'flex sm:hidden flex-col gap-2 px-3 py-3 border-b cursor-pointer transition-all active:bg-accent/50',
          isSelected && 'bg-accent/80 border-l-2 border-l-primary',
          overdue && 'bg-destructive/5',
          isChecked && 'bg-primary/5'
        )}
      >
        {/* Top row: checkbox + company + score dot + quick actions */}
        <div className="flex items-center gap-2">
          {showCheckbox && (
            <div onClick={handleCheckClick} className="flex-shrink-0">
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) => onCheckChange?.(lead.id, checked as boolean)}
              />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-sm text-foreground truncate">
                {lead.razao_social || lead.nome_fantasia || lead.company}
              </span>
              {lead.is_hot_lead && (
                <Flame className="h-3.5 w-3.5 text-destructive flex-shrink-0 animate-pulse" />
              )}
            </div>
            <span className="text-xs text-muted-foreground truncate block">{lead.name}</span>
          </div>
          <ScoreDot level={temp} />
        </div>

        {/* Bottom row: status + next action + attempts */}
        <div className="flex items-center gap-2 text-[11px] ml-6">
          <span className="px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground font-medium">
            {getStatusLabel(lead.status)}
          </span>

          <span className="text-muted-foreground/50">·</span>

          <span className={cn(
            overdue ? 'text-destructive font-medium' : dueToday ? 'text-chart-1' : 'text-muted-foreground'
          )}>
            <Clock className="h-3 w-3 inline mr-0.5" />
            {formatNextAction(new Date(lead.next_action_at), lead.status)}
          </span>

          {lead.attempts_count > 0 && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground">{lead.attempts_count}x</span>
            </>
          )}

          {/* Mobile contact actions */}
          <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {lead.phone && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => {
                const cleanPhone = lead.phone!.replace(/\D/g, '');
                window.open(`https://web.whatsapp.com/send?phone=55${cleanPhone}`, '_blank');
              }}>
                <WhatsAppIcon size={12} />
              </Button>
            )}
            {lead.phone && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => {
                const cleanPhone = lead.phone!.replace(/\D/g, '');
                const phoneWithoutPrefix = cleanPhone.startsWith('55') ? cleanPhone.slice(2) : cleanPhone;
                window.open(`tel:${phoneWithoutPrefix}`, '_self');
              }}>
                <Phone className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
});
LeadRow.displayName = 'LeadRow';

// Header component for the lead table
interface LeadTableHeaderProps {
  showCheckbox?: boolean;
  allChecked?: boolean;
  onCheckAllChange?: (checked: boolean) => void;
}

export const LeadTableHeader = ({ showCheckbox, allChecked, onCheckAllChange }: LeadTableHeaderProps) => {
  return (
    <div className="group hidden sm:flex items-center gap-4 px-4 py-2 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
      {showCheckbox && (
        <div className={cn(
          "flex-shrink-0 transition-opacity",
          allChecked ? "opacity-100" : "sm:opacity-0 sm:group-hover:opacity-100"
        )}>
          <Checkbox
            checked={allChecked}
            onCheckedChange={(checked) => onCheckAllChange?.(checked as boolean)}
          />
        </div>
      )}
      <div className="flex-shrink-0 w-2" />
      <div className="flex-1">Lead</div>
      <div className="flex-shrink-0 hidden sm:block w-24 text-center">Score</div>
      <div className="flex-shrink-0 hidden sm:block w-32 text-center">Status</div>
      <div className="flex-shrink-0 w-32 hidden md:block text-center">Último Contato</div>
      <div className="flex-shrink-0 w-28 hidden lg:block text-center">Próxima Ação</div>
      <div className="flex-shrink-0 w-12 hidden xl:block text-center">Tent.</div>
      <div className="flex-shrink-0 w-28 hidden md:block text-center">SDR</div>
      <div className="flex-shrink-0 w-24 hidden lg:block text-center">Ações</div>
    </div>
  );
};
