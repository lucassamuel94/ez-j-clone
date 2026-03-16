import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface DashboardChartWrapperProps {
  title: string;
  icon?: ReactNode;
  ariaLabel: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyText?: string;
  className?: string;
  children: ReactNode;
}

export function DashboardChartWrapper({
  title, icon, ariaLabel, isLoading, isEmpty, emptyText = 'Sem dados disponíveis',
  className, children,
}: DashboardChartWrapperProps) {
  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {icon}
            {title}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          role="img"
          aria-label={ariaLabel}
          className={cn('w-full', className)}
        >
          {isLoading ? (
            <Skeleton className="w-full h-[200px] rounded-lg" />
          ) : isEmpty ? (
            <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            children
          )}
        </div>
      </CardContent>
    </Card>
  );
}
