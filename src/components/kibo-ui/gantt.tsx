'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { format, differenceInDays, eachDayOfInterval, eachWeekOfInterval, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ---------- Types ----------

export interface GanttItem {
  id: string;
  label: string;
  start: Date;
  end: Date;
  color?: string;
  progress?: number;
  group?: string;
}

interface GanttProps {
  items: GanttItem[];
  startDate: Date;
  endDate: Date;
  className?: string;
  onItemClick?: (item: GanttItem) => void;
}

// ---------- Component ----------

export function Gantt({ items, startDate, endDate, className, onItemClick }: GanttProps) {
  const totalDays = differenceInDays(endDate, startDate) + 1;
  const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 });

  const getBarStyle = (item: GanttItem) => {
    const itemStart = Math.max(0, differenceInDays(item.start, startDate));
    const itemEnd = Math.min(totalDays, differenceInDays(item.end, startDate) + 1);
    const width = ((itemEnd - itemStart) / totalDays) * 100;
    const left = (itemStart / totalDays) * 100;
    return { left: `${left}%`, width: `${Math.max(width, 1)}%` };
  };

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border/40 bg-card', className)}>
      {/* Header with weeks */}
      <div className="flex border-b border-border/30 bg-muted/30">
        <div className="w-48 min-w-[12rem] flex-shrink-0 p-2 text-xs font-bold uppercase tracking-widest text-muted-foreground border-r border-border/30">
          Item
        </div>
        <div className="flex-1 relative">
          <div className="flex">
            {weeks.map((weekStart) => {
              const wEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
              const days = eachDayOfInterval({
                start: weekStart < startDate ? startDate : weekStart,
                end: wEnd > endDate ? endDate : wEnd,
              });
              return (
                <div key={weekStart.toISOString()} className="flex-1 min-w-0 border-r border-border/20 last:border-r-0">
                  <div className="text-[10px] text-muted-foreground/70 text-center py-1 border-b border-border/20">
                    {format(weekStart, 'dd MMM', { locale: ptBR })}
                  </div>
                  <div className="flex">
                    {days.map((day) => (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          'flex-1 h-5 border-r border-border/10 last:border-r-0',
                          isToday(day) && 'bg-primary/10'
                        )}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rows */}
      {items.map((item) => (
        <div key={item.id} className="flex border-b border-border/20 last:border-b-0 hover:bg-muted/20 transition-colors">
          <div className="w-48 min-w-[12rem] flex-shrink-0 p-2 text-sm text-foreground truncate border-r border-border/30">
            {item.label}
          </div>
          <div className="flex-1 relative h-10 flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'absolute h-6 rounded-md cursor-pointer transition-all hover:brightness-110',
                    !item.color && 'bg-primary/80'
                  )}
                  style={{
                    ...getBarStyle(item),
                    backgroundColor: item.color || undefined,
                  }}
                  onClick={() => onItemClick?.(item)}
                >
                  {item.progress !== undefined && (
                    <div
                      className="h-full rounded-md bg-foreground/15"
                      style={{ width: `${item.progress}%` }}
                    />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                <p className="font-medium">{item.label}</p>
                <p className="text-muted-foreground">
                  {format(item.start, 'dd/MM')} — {format(item.end, 'dd/MM')}
                </p>
                {item.progress !== undefined && <p>{item.progress}% concluído</p>}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
}
