import { useMemo, useState } from 'react';
import { Package, User, ChevronDown, Bot, Puzzle, Cpu } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useMonthlyDeliveries, type TeamDeliveryGroup, type MonthlyDeliveryItem } from '@/hooks/useMonthlyDeliveries';

interface DashboardDeliveriesSectionProps {
  month: number;
  year: number;
}

const TEAM_CONFIG = [
  { key: 'ux' as const, label: 'UX/PO', color: 'hsl(var(--chart-1))' },
  { key: 'dev' as const, label: 'Dev Chatbot', color: 'hsl(var(--chart-2))' },
  { key: 'treinamento' as const, label: 'Treinamento', color: 'hsl(var(--chart-3))' },
] as const;

function DeliveryItemRow({ item }: { item: MonthlyDeliveryItem }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-medium text-foreground truncate">
          {item.company_name || 'Sem nome'}
        </span>
        {item.project_type_label && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
            {item.project_type_label}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {item.uses_gpt && (
          <Bot className="h-3 w-3 text-primary" aria-label="Usa IA" />
        )}
        {item.has_integration && (
          <Puzzle className="h-3 w-3 text-muted-foreground" aria-label="Tem integração" />
        )}
        {item.complexity_level && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
            {item.complexity_level}
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {format(new Date(item.delivered_at), 'dd/MM', { locale: ptBR })}
        </span>
      </div>
    </div>
  );
}

function TeamColumn({ label, color, groups, total }: {
  label: string;
  color: string;
  groups: TeamDeliveryGroup[];
  total: number;
}) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        </div>
        <span className="text-lg font-bold text-foreground tabular-nums">{total}</span>
      </div>

      {/* Per-person breakdown */}
      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma entrega</p>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <PersonGroup key={group.responsible} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonGroup({ group }: { group: TeamDeliveryGroup }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 rounded-md hover:bg-muted/30 transition-colors group">
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">{group.responsible}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 tabular-nums">
            {group.count}
          </Badge>
          <ChevronDown className={cn(
            'h-3 w-3 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mt-1 border-l border-border/50 pl-2 space-y-0.5">
          {group.items.map((item) => (
            <DeliveryItemRow key={item.id} item={item} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DashboardDeliveriesSection({ month, year }: DashboardDeliveriesSectionProps) {
  const { data, isLoading } = useMonthlyDeliveries(month, year);

  const monthLabel = useMemo(() => {
    const d = new Date(year, month - 1, 1);
    return format(d, 'MMMM yyyy', { locale: ptBR });
  }, [month, year]);

  const grandTotal = data ? data.totalUx + data.totalDev + data.totalTreinamento : 0;

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <span className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" strokeWidth={1.5} />
              Entregas do Mês — {monthLabel}
            </span>
            {!isLoading && (
              <Badge variant="outline" className="text-[10px] font-bold tabular-nums">
                {grandTotal} total
              </Badge>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-6 w-full rounded" />
                <Skeleton className="h-20 w-full rounded" />
              </div>
            ))}
          </div>
        ) : !data || grandTotal === 0 ? (
          <div className="flex items-center justify-center h-[120px] text-sm text-muted-foreground">
            Nenhuma entrega registrada neste mês
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {TEAM_CONFIG.map((team) => (
              <TeamColumn
                key={team.key}
                label={team.label}
                color={team.color}
                groups={data[team.key]}
                total={team.key === 'ux' ? data.totalUx : team.key === 'dev' ? data.totalDev : data.totalTreinamento}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
