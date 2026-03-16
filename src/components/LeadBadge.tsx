import { Badge } from '@/components/ui/badge';
import { LeadType, LeadStatus } from '@/types/lead';
import { cn } from '@/lib/utils';

interface LeadTypeBadgeProps {
  type: LeadType;
  className?: string;
}

export const LeadTypeBadge = ({ type, className }: LeadTypeBadgeProps) => {
  const styles = {
    INBOUND: 'bg-primary/10 text-primary hover:bg-primary/15',
    OUTBOUND: 'bg-[hsl(220,90%,90%)] text-[hsl(220,90%,30%)] hover:bg-[hsl(220,90%,85%)] dark:bg-[hsl(220,90%,30%)]/20 dark:text-[hsl(220,90%,70%)] dark:hover:bg-[hsl(220,90%,30%)]/30',
    INDICACAO: 'bg-[hsl(160,84%,90%)] text-[hsl(160,84%,25%)] hover:bg-[hsl(160,84%,85%)] dark:bg-[hsl(160,84%,30%)]/20 dark:text-[hsl(160,84%,70%)] dark:hover:bg-[hsl(160,84%,30%)]/30',
  };
  const labels = { INBOUND: 'Inbound', OUTBOUND: 'Outbound', INDICACAO: 'Indicação' };

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] h-5 font-medium border-0 shrink-0 rounded-full',
        styles[type] || 'bg-muted text-muted-foreground',
        className
      )}
    >
      {labels[type] || type}
    </Badge>
  );
};

interface SourceBadgeProps {
  source: string;
  className?: string;
}

export const SourceBadge = ({ source, className }: SourceBadgeProps) => {
  const getSourceStyles = () => {
    switch (source?.toLowerCase()) {
      case 'inbound':
        return 'bg-primary/10 text-primary border-0 hover:bg-primary/15';
      case 'outbound':
        return 'bg-[hsl(220,90%,90%)] text-[hsl(220,90%,30%)] border-0 hover:bg-[hsl(220,90%,85%)] dark:bg-[hsl(220,90%,30%)]/20 dark:text-[hsl(220,90%,70%)] dark:hover:bg-[hsl(220,90%,30%)]/30';
      case 'indicação':
        return 'bg-[hsl(160,84%,90%)] text-[hsl(160,84%,25%)] border-0 hover:bg-[hsl(160,84%,85%)] dark:bg-[hsl(160,84%,30%)]/20 dark:text-[hsl(160,84%,70%)] dark:hover:bg-[hsl(160,84%,30%)]/30';
      default:
        return 'bg-muted/20 text-muted-foreground border-0 hover:bg-muted/25';
    }
  };

  if (!source) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium',
        getSourceStyles(),
        className
      )}
    >
      {source}
    </Badge>
  );
};

interface LeadStatusBadgeProps {
  status: LeadStatus;
  className?: string;
}

export const LeadStatusBadge = ({ status, className }: LeadStatusBadgeProps) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'Novo':
        return 'bg-primary/10 text-primary border-0 hover:bg-primary/15';
      case 'Em contato':
        return 'bg-chart-1/15 text-chart-1 border-0 hover:bg-chart-1/20';
      case 'Ocupado':
        return 'bg-[hsl(45,100%,90%)] text-[hsl(45,100%,30%)] border-0 hover:bg-[hsl(45,100%,85%)] dark:bg-[hsl(45,100%,30%)]/20 dark:text-[hsl(45,100%,70%)] dark:hover:bg-[hsl(45,100%,30%)]/30';
      case 'Agendar retorno':
        return 'bg-[hsl(270,60%,92%)] text-[hsl(270,60%,40%)] border-0 hover:bg-[hsl(270,60%,87%)] dark:bg-[hsl(270,60%,40%)]/20 dark:text-[hsl(270,60%,70%)] dark:hover:bg-[hsl(270,60%,40%)]/30';
      case 'Sem retorno':
        return 'bg-[hsl(0,0%,92%)] text-[hsl(0,0%,40%)] border-0 hover:bg-[hsl(0,0%,87%)] dark:bg-[hsl(0,0%,40%)]/20 dark:text-[hsl(0,0%,70%)] dark:hover:bg-[hsl(0,0%,40%)]/30';
      case 'Interesse/Agendar Retorno':
        return 'bg-chart-4/15 text-chart-4 border-0 hover:bg-chart-4/20';
      case 'Oportunidade criada':
        return 'bg-[hsl(160,84%,39%)]/15 text-[hsl(160,84%,39%)] border-0 hover:bg-[hsl(160,84%,39%)]/20';
      case 'Descartado':
        return 'bg-destructive/10 text-destructive border-0 hover:bg-destructive/15';
      case 'Reciclagem' as any:
        return 'bg-[hsl(35,90%,50%)]/15 text-[hsl(35,90%,40%)] border-0 hover:bg-[hsl(35,90%,50%)]/20';
      default:
        return 'bg-muted text-muted-foreground border-0';
    }
  };

  const getDisplayLabel = () => {
    switch (status) {
      case 'Interesse/Agendar Retorno':
        return 'Agendado';
      case 'Oportunidade criada':
        return 'Realizada';
      case 'Descartado':
        return 'Perdido';
      case 'Em contato':
        return 'Follow-up';
      default:
        return status;
    }
  };

  return (
    <Badge
      className={cn(
        'text-[14px] font-medium',
        getStatusStyles(),
        className
      )}
    >
      {getDisplayLabel()}
    </Badge>
  );
};

interface PriorityIndicatorProps {
  isOverdue: boolean;
  isDueToday: boolean;
  className?: string;
}

export const PriorityIndicator = ({ isOverdue, isDueToday, className }: PriorityIndicatorProps) => {
  if (isOverdue) {
    return (
      <span className={cn(
        'inline-flex items-center justify-center w-2 h-2 rounded-full bg-destructive animate-pulse',
        className
      )} />
    );
  }
  
  if (isDueToday) {
    return (
      <span className={cn(
        'inline-flex items-center justify-center w-2 h-2 rounded-full bg-chart-1',
        className
      )} />
    );
  }
  
  return (
    <span className={cn(
      'inline-flex items-center justify-center w-2 h-2 rounded-full bg-muted',
      className
    )} />
  );
};
