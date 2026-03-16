import { Skeleton } from '@/components/ui/skeleton';

interface CalendarSkeletonProps {
  view?: 'week' | 'day' | 'month';
}

export function CalendarSkeleton({ view = 'week' }: CalendarSkeletonProps) {
  const hours = Array.from({ length: 12 }, (_, i) => i + 7);
  const columns = view === 'day' ? 1 : 7;

  return (
    <div className="flex-1 border border-border rounded-lg bg-card overflow-hidden flex flex-col">
      {/* Day headers skeleton */}
      <div className="flex border-b border-border">
        <div className="w-[52px] shrink-0 border-r border-border" />
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center py-2.5 border-r border-border last:border-r-0 gap-1.5">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="flex-1 overflow-hidden">
        <div className="flex">
          {/* Time gutter */}
          <div className="w-[52px] shrink-0 border-r border-border">
            {hours.map((h) => (
              <div key={h} className="h-16 flex items-start justify-end pr-2 pt-0">
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>

          {/* Columns */}
          {Array.from({ length: columns }).map((_, col) => (
            <div key={col} className="flex-1 border-r border-border last:border-r-0 relative">
              {hours.map((h) => (
                <div key={h} className="h-16 border-t border-border/50" />
              ))}
              {/* Fake event blocks */}
              {(col === 0 || col === 1) && (
                <Skeleton className="absolute left-1 right-1 rounded-md" style={{ top: 32, height: 56 }} />
              )}
              {col === 3 && (
                <Skeleton className="absolute left-1 right-1 rounded-md" style={{ top: 96, height: 80 }} />
              )}
              {col === 4 && (
                <Skeleton className="absolute left-1 right-1 rounded-md" style={{ top: 160, height: 48 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
