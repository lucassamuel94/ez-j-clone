import { useMemo } from 'react';
import { Lead } from '@/types/lead';
import { LeadTypeBadge } from './LeadBadge';
import { SDRSelector } from './SDRSelector';
import { Badge } from '@/components/ui/badge';
import { Clock, CalendarClock, Flame, TrendingUp, TrendingDown, Hash, Zap, UserCheck, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/utils/priorityCalculator';
import { calculateQualificationScore, scoreToTemperature } from '@/utils/qualificationScore';
import { calculateBehavioralScore } from '@/utils/behavioralScore';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ContactChipPanel } from './ContactChipPanel';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface LeadModalHeaderProps {
  lead: Lead;
  ownerName?: string;
  onCall?: () => void;
  onWhatsApp?: () => void;
  onRegisterOutcome: () => void;
  onSendEmail?: () => void;
  leadId?: string;
  ownerUserId?: string | null;
  currentUserId?: string | null;
  isManager?: boolean;
  closerName?: string | null;
}

export const LeadModalHeader = ({ lead, leadId, ownerUserId, ownerName, currentUserId, isManager = false, closerName }: LeadModalHeaderProps) => {
  const canEditOwner = isManager || (!!currentUserId && ownerUserId === currentUserId);
  const queryClient = useQueryClient();
  const { score, temp, bScore, variation, isScorePending } = useMemo(() => {
    const s = calculateQualificationScore(lead);
    const t = scoreToTemperature(s);
    const b = lead.behavioral_score != null ? lead.behavioral_score : calculateBehavioralScore(lead).total;
    const pending = lead.behavioral_score === null || lead.behavioral_score === undefined;
    return { score: s, temp: t, bScore: b, variation: lead.score_variation_48h ?? 0, isScorePending: pending };
  }, [lead.behavioral_score, lead.score_variation_48h, lead.product_interest, lead.main_pain_point, lead.solution_urgency, lead.has_budget, lead.employee_count, lead.revenue_range, lead.company_segment]);

  const scoreConfig = {
    frio: { label: 'Baixo', color: 'bg-destructive/10 text-destructive border-destructive/20' },
    morno: { label: 'Médio', color: 'bg-[hsl(var(--chart-2))]/10 text-[hsl(var(--chart-2))] border-[hsl(var(--chart-2))]/20' },
    quente: { label: 'Alto', color: 'bg-[hsl(var(--chart-3))]/10 text-[hsl(var(--chart-3))] border-[hsl(var(--chart-3))]/20' },
  };

  const lastContactText = lead.last_contact_at
    ? formatTimeAgo(new Date(lead.last_contact_at))
    : 'Sem contato';

  const nextActionDate = new Date(lead.next_action_at);
  const isOverdue = nextActionDate < new Date();
  const nextActionText = nextActionDate.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="border-b px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0 space-y-3">

      {/* Row 1 — Identity */}
      <div className="flex flex-col gap-1 min-w-0 pr-16 sm:pr-24">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 shrink-0">
            <Building2 className="h-3.5 w-3.5 text-primary" />
          </span>
          <h2 className="text-xs sm:text-sm font-semibold text-foreground tracking-tight truncate">
            {lead.razao_social || lead.nome_fantasia || lead.company}
          </h2>
          <LeadTypeBadge type={lead.lead_type} />
          {lead.is_hot_lead && (
            <Badge variant="outline" className="text-[10px] h-5 bg-destructive/10 text-destructive border-destructive/20 animate-pulse gap-0.5 shrink-0">
              <Flame className="h-3 w-3" />
              Quente
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {lead.cnpj && (
            <span className="text-[10px] text-muted-foreground font-medium tracking-wide">
              CNPJ {lead.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
            </span>
          )}
          {lead.cnpj && <span className="text-[10px] text-muted-foreground">·</span>}
          <ContactChipPanel
            lead={lead}
            onSaveContact={async (index, values) => {
              const updates: Record<string, string | null> = index === 0
                ? { name: values.name, phone: values.phone, email: values.email || null }
                : { contact_name_2: values.name, phone_3: values.phone, email_2: values.email || null };
              const { error } = await supabase.from('leads').update(updates).eq('id', lead.id);
              if (error) throw error;
              queryClient.invalidateQueries({ queryKey: ['lead-by-id', lead.id] });
              queryClient.invalidateQueries({ queryKey: ['leads'] });
              queryClient.invalidateQueries({ queryKey: ['closer-pipeline'] });
            }}
            onAddContact={async (values) => {
              const updates = { contact_name_2: values.name, phone_3: values.phone, email_2: values.email || null };
              const { error } = await supabase.from('leads').update(updates).eq('id', lead.id);
              if (error) throw error;
              queryClient.invalidateQueries({ queryKey: ['lead-by-id', lead.id] });
              queryClient.invalidateQueries({ queryKey: ['leads'] });
              queryClient.invalidateQueries({ queryKey: ['closer-pipeline'] });
            }}
            onDeleteContact={async (index) => {
              if (index !== 1) return;
              const { error } = await supabase.from('leads')
                .update({ contact_name_2: null, phone_3: null, phone_4: null, email_2: null })
                .eq('id', lead.id);
              if (error) throw error;
              queryClient.invalidateQueries({ queryKey: ['lead-by-id', lead.id] });
              queryClient.invalidateQueries({ queryKey: ['leads'] });
              queryClient.invalidateQueries({ queryKey: ['closer-pipeline'] });
            }}
            onSetPrimary={async () => {
              // Swap contact 1 ↔ contact 2 fields
              const { error } = await supabase.from('leads').update({
                name: lead.contact_name_2 || null,
                phone: lead.phone_3 || null,
                email: lead.email_2 || null,
                contact_name_2: lead.name || null,
                phone_3: lead.phone || null,
                email_2: lead.email || null,
              }).eq('id', lead.id);
              if (error) throw error;
              queryClient.invalidateQueries({ queryKey: ['lead-by-id', lead.id] });
              queryClient.invalidateQueries({ queryKey: ['leads'] });
              queryClient.invalidateQueries({ queryKey: ['closer-pipeline'] });
            }}
          />
        </div>
      </div>

      {/* Row 2 — Metrics grid */}
      <div className={cn(
        "grid gap-px bg-border/40 rounded-xl overflow-hidden border border-border/40",
        closerName ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
      )}>

        {/* Score */}
        <div className="space-y-1 px-4 py-3 bg-[#f4f3f9] dark:bg-accent/20">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 whitespace-nowrap">
            <Zap className="h-3 w-3 shrink-0" /> Score
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-default">
                <Badge variant="outline" className={cn("text-[10px] h-5 rounded-md", isScorePending ? 'bg-muted text-muted-foreground border-border' : scoreConfig[temp].color)}>
                  {isScorePending ? 'Pendente' : `${bScore} • ${scoreConfig[temp].label}`}
                </Badge>
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
            <TooltipContent side="bottom" className="max-w-[220px]">
              <p className="text-[10px] font-medium">Score Comportamental: {bScore}/100</p>
              {variation !== 0 && (
                <p className="text-[10px] mt-0.5">
                  {variation > 0 ? '↑' : '↓'} {Math.abs(variation)} pts nas últimas 48h
                </p>
              )}
              {lead.score_variation_reason && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{lead.score_variation_reason}</p>
              )}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Attempts */}
        <div className="space-y-1 px-4 py-3 bg-[#f4f3f9] dark:bg-accent/20">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 whitespace-nowrap">
            <Hash className="h-3 w-3 shrink-0" /> Tentativas
          </p>
          <p className="text-sm font-semibold text-foreground">{lead.attempts_count}</p>
        </div>

        {/* Last Contact */}
        <div className="space-y-1 px-4 py-3 bg-[#f4f3f9] dark:bg-accent/20">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 whitespace-nowrap">
            <Clock className="h-3 w-3 shrink-0" /> Último contato
          </p>
          <p className="text-xs font-medium text-foreground whitespace-nowrap">{lastContactText}</p>
        </div>

        {/* Next Action */}
        <div className="space-y-1 px-4 py-3 bg-[#f4f3f9] dark:bg-accent/20">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 whitespace-nowrap">
            <CalendarClock className="h-3 w-3 shrink-0" /> Próxima ação
          </p>
          <div className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium whitespace-nowrap",
            isOverdue ? 'bg-destructive/10 text-destructive border-destructive/20 animate-pulse' : 'bg-primary/10 text-primary border-primary/20'
          )}>
            {nextActionText}
          </div>
        </div>

        {/* SDR */}
        {leadId && (
          <div className="space-y-1 px-4 py-3 bg-[#f4f3f9] dark:bg-accent/20">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 whitespace-nowrap">
              <UserCheck className="h-3 w-3 shrink-0" /> SDR
            </p>
            <div onClick={(e) => e.stopPropagation()}>
              <SDRSelector
                leadId={leadId}
                currentOwnerId={ownerUserId ?? null}
                currentOwnerName={ownerName ?? lead.owner_name ?? null}
                disabled={!canEditOwner}
                sdrOnly={!isManager}
              />
            </div>
          </div>
        )}

        {/* Closer */}
        {closerName && (
          <div className="space-y-1 px-4 py-3 bg-[#f4f3f9] dark:bg-accent/20">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 whitespace-nowrap">
              <UserCheck className="h-3 w-3 shrink-0" /> Closer
            </p>
            <span className="text-xs text-muted-foreground truncate">
              {closerName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
