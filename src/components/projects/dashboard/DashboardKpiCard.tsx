import { type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DashboardKpiCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  variant?: 'primary' | 'success' | 'warning' | 'info';
  onClick?: () => void;
}

const variantStyles: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-chart-3/15 text-[hsl(var(--chart-3))]',
  warning: 'bg-chart-2/15 text-[hsl(var(--chart-2))]',
  info: 'bg-chart-4/15 text-[hsl(var(--chart-4))]',
};

export function DashboardKpiCard({ label, value, icon: Icon, variant = 'primary', onClick }: DashboardKpiCardProps) {
  return (
    <Card
      className={cn(
        'bg-card border-border/50 transition-all min-h-[72px]',
        onClick && 'cursor-pointer hover:border-primary/30 hover:shadow-sm active:scale-[0.98]'
      )}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest truncate">{label}</p>
            <p className="text-2xl font-bold text-foreground tabular-nums mt-1 font-display">{value}</p>
          </div>
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', variantStyles[variant])}>
            <Icon className="h-4 w-4" strokeWidth={1.5} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
