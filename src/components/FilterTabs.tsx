import { FilterType } from '@/types/lead';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Calendar, 
  AlertCircle, 
  Sparkles, 
  CalendarCheck,
  CheckCircle2,
  LayoutList,
  Trash2,
  MessageCircle,
  Clock,
  PhoneOff,
  PhoneMissed,
  CalendarClock,
  Ban,
  RotateCcw
} from 'lucide-react';

interface FilterTabsProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  stats: {
    total: number;
    overdue: number;
    today: number;
    inContactReturn: number;
    new: number;
    devolvidoCloser: number;
    ocupado: number;
    naoAtendeu: number;
    semRetorno: number;
    agendarRetorno: number;
    scheduled: number;
    confirmed: number;
    futureOpportunity: number;
    discarded: number;
  };
}

interface FilterOption {
  value: FilterType;
  label: string;
  shortLabel?: string;
  icon: React.ReactNode;
  count: number;
  variant?: 'default' | 'destructive' | 'warning' | 'success' | 'new' | 'scheduled' | 'confirmed' | 'inContact' | 'futureOpportunity';
  compact?: boolean;
}

export const FilterTabs = ({ activeFilter, onFilterChange, stats }: FilterTabsProps) => {
  const filters: FilterOption[] = [
    {
      value: 'all',
      label: 'Todos',
      icon: <LayoutList className="h-3.5 w-3.5" />,
      count: stats.total,
    },
    {
      value: 'today',
      label: 'Hoje',
      icon: <Calendar className="h-3.5 w-3.5" />,
      count: stats.today + stats.overdue,
    },
    {
      value: 'new',
      label: 'Novos',
      icon: <Sparkles className="h-3.5 w-3.5" />,
      count: stats.new,
      variant: 'new',
    },
    {
      value: 'devolvido_closer',
      label: 'Devolvido pelo Closer',
      shortLabel: 'Devolvido',
      icon: <RotateCcw className="h-3.5 w-3.5" />,
      count: stats.devolvidoCloser,
    },
    {
      value: 'agendar_retorno',
      label: 'Agendar retorno',
      shortLabel: 'Ag. retorno',
      icon: <CalendarClock className="h-3.5 w-3.5" />,
      count: stats.agendarRetorno,
    },
    {
      value: 'in_contact_return',
      label: 'Follow-up',
      shortLabel: 'Follow-up',
      icon: <MessageCircle className="h-3.5 w-3.5" />,
      count: stats.inContactReturn,
      variant: 'inContact',
    },
    {
      value: 'scheduled',
      label: 'Reunião Agendada',
      shortLabel: 'Agendada',
      icon: <CalendarCheck className="h-3.5 w-3.5" />,
      count: stats.scheduled,
      variant: 'scheduled',
    },
    {
      value: 'confirmed',
      label: 'Reunião Realizada',
      shortLabel: 'Realizada',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      count: stats.confirmed,
      variant: 'confirmed',
    },
    {
      value: 'discarded',
      label: 'Perdidos',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      count: stats.discarded,
      variant: 'destructive',
    },
  ];

  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onFilterChange(filter.value)}
          className={cn(
            'flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0',
            activeFilter === filter.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          <span className="shrink-0">{filter.icon}</span>
          <span className="hidden sm:inline">{filter.shortLabel || filter.label}</span>
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] min-w-[18px] h-4 px-1 flex items-center justify-center border-0 font-semibold shrink-0 rounded-full',
              activeFilter === filter.value
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : filter.variant === 'destructive' && filter.count > 0
                  ? 'bg-destructive/20 text-destructive'
                  : filter.variant === 'new' && filter.count > 0
                    ? 'bg-[hsl(45,100%,90%)] text-[hsl(45,100%,30%)] dark:bg-[hsl(45,80%,25%)] dark:text-[hsl(45,100%,85%)]'
                    : filter.variant === 'inContact' && filter.count > 0
                      ? 'bg-[hsl(270,60%,92%)] text-[hsl(270,60%,40%)] dark:bg-[hsl(270,50%,25%)] dark:text-[hsl(270,60%,80%)]'
                      : filter.variant === 'scheduled' && filter.count > 0
                        ? 'bg-[hsl(210,100%,92%)] text-[hsl(210,100%,40%)] dark:bg-[hsl(210,80%,25%)] dark:text-[hsl(210,100%,80%)]'
                        : filter.variant === 'confirmed' && filter.count > 0
                          ? 'bg-[hsl(160,84%,90%)] text-[hsl(160,84%,30%)] dark:bg-[hsl(160,60%,20%)] dark:text-[hsl(160,84%,80%)]'
                          : filter.variant === 'futureOpportunity' && filter.count > 0
                            ? 'bg-[hsl(30,90%,90%)] text-[hsl(30,90%,35%)] dark:bg-[hsl(30,70%,22%)] dark:text-[hsl(30,90%,80%)]'
                            : 'bg-muted text-muted-foreground'
            )}
          >
            {filter.count}
          </Badge>
        </button>
      ))}
    </div>
  );
};
