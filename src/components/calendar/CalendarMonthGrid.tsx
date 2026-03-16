import { useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isToday,
  isSameDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { CalendarEventItem } from './types';

interface CalendarMonthGridProps {
  currentDate: Date;
  events: CalendarEventItem[];
  onEventClick: (event: CalendarEventItem) => void;
  onDayClick: (day: Date) => void;
  isMobile?: boolean;
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function CalendarMonthGrid({
  currentDate,
  events,
  onEventClick,
  onDayClick,
  isMobile = false,
}: CalendarMonthGridProps) {
  const weeks = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const rows: Date[][] = [];
    let day = calStart;
    while (day <= calEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(day);
        day = addDays(day, 1);
      }
      rows.push(week);
    }
    return rows;
  }, [currentDate]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    events.forEach((ev) => {
      const key = format(new Date(ev.start), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    return map;
  }, [events]);

  const maxVisible = isMobile ? 2 : 3;

  return (
    <div className="flex-1 border border-border rounded-lg bg-card overflow-hidden flex flex-col">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border bg-card sticky top-0 z-10">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="text-center py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-r border-border last:border-r-0"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0 min-h-[80px] md:min-h-[100px]">
            {week.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDay.get(key) || [];
              const inMonth = isSameMonth(day, currentDate);
              const today = isToday(day);

              return (
                <div
                  key={key}
                  className={cn(
                    'border-r border-border last:border-r-0 p-1 cursor-pointer transition-colors hover:bg-muted/50 flex flex-col',
                    !inMonth && 'opacity-40',
                    today && 'bg-primary/[0.04]',
                  )}
                  onClick={() => onDayClick(day)}
                >
                  {/* Day number */}
                  <div className="flex justify-end">
                    <span
                      className={cn(
                        'text-xs font-medium inline-flex items-center justify-center w-6 h-6',
                        today
                          ? 'bg-primary text-primary-foreground rounded-full font-bold'
                          : 'text-foreground',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Events */}
                  <div className="flex-1 space-y-0.5 mt-0.5 overflow-hidden">
                    {dayEvents.slice(0, maxVisible).map((ev) => (
                      <button
                        key={ev.id}
                        className="w-full text-left truncate text-[10px] md:text-[11px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors leading-tight"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(ev);
                        }}
                        title={ev.title}
                      >
                        {!isMobile && (
                          <span className="text-muted-foreground mr-1">
                            {format(new Date(ev.start), 'HH:mm')}
                          </span>
                        )}
                        {ev.title}
                      </button>
                    ))}
                    {dayEvents.length > maxVisible && (
                      <p className="text-[10px] text-muted-foreground font-medium px-1.5">
                        +{dayEvents.length - maxVisible} mais
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
