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
    OUTBOUND: 'bg-badge-outbound-bg text-badge-outbound-text hover:bg-badge-outbound-bg/85',
    INDICACAO: 'bg-source-indicacao-bg text-source-indicacao-text hover:bg-source-indicacao-bg/85',
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
        return 'bg-badge-outbound-bg text-badge-outbound-text border-0 hover:bg-badge-outbound-bg/85';
      case 'indicação':
        return 'bg-source-indicacao-bg text-source-indicacao-text border-0 hover:bg-source-indicacao-bg/85';
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
        return 'bg-status-ocupado-bg text-status-ocupado-text border-0 hover:bg-status-ocupado-bg/85';
      case 'Agendar retorno':
        return 'bg-status-return-bg text-status-return-text border-0 hover:bg-status-return-bg/85';
      case 'Sem retorno':
        return 'bg-status-no-return-bg text-status-no-return-text border-0 hover:bg-status-no-return-bg/85';
      case 'Interesse/Agendar Retorno':
        return 'bg-chart-4/15 text-chart-4 border-0 hover:bg-chart-4/20';
      case 'Oportunidade criada':
        return 'bg-status-created-solid/15 text-status-created-solid border-0 hover:bg-status-created-solid/20';
      case 'Descartado':
        return 'bg-destructive/10 text-destructive border-0 hover:bg-destructive/15';
      case 'Reciclagem' as any:
        return 'bg-status-reciclagem-solid/15 text-status-reciclagem-text border-0 hover:bg-status-reciclagem-solid/20';
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
