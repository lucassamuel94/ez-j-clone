import { memo } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PosVendaKpiCardProps {
  title: string;
  value: number | string;
  suffix?: string;
  variation?: number;
  color?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  subtitle?: string;
}

const COLOR_MAP = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
  info: 'text-primary',
  neutral: 'text-foreground',
} as const;

const PosVendaKpiCard = memo(function PosVendaKpiCard({ title, value, suffix, variation, color = 'neutral', subtitle }: PosVendaKpiCardProps) {
  const hasVariation = variation !== undefined && variation !== null;
  const isPositive = (variation ?? 0) > 0;
  const isNegative = (variation ?? 0) < 0;

  return (
    <div className="bg-muted/50 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
      <div className="flex items-end gap-2">
        <span className={cn('text-2xl font-bold tabular-nums', COLOR_MAP[color])}>
          {value}
          {suffix && <span className="text-sm font-medium ml-0.5">{suffix}</span>}
        </span>
        {hasVariation && (
          <span className={cn(
            'flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full mb-0.5',
            isPositive && 'text-success bg-success/10',
            isNegative && 'text-destructive bg-destructive/10',
            !isPositive && !isNegative && 'text-muted-foreground bg-muted',
          )}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : isNegative ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {Math.abs(variation ?? 0)}
          </span>
        )}
      </div>
      {subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
    </div>
  );
});

export default PosVendaKpiCard;
