'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
  addMonths,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ---------- Types ----------

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  color?: string;
  data?: unknown;
}

interface KiboCalendarProps {
  events?: CalendarEvent[];
  className?: string;
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  renderEvent?: (event: CalendarEvent) => React.ReactNode;
}

// ---------- Component ----------

export function KiboCalendar({
  events = [],
  className,
  onDateClick,
  onEventClick,
  renderEvent,
}: KiboCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const getEventsForDay = (date: Date) => events.filter((e) => isSameDay(e.date, date));

  return (
    <div className={cn('rounded-lg border border-border/40 bg-card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/30">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border/30">
        {weekDays.map((day) => (
          <div key={day} className="p-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = getEventsForDay(day);
          const inMonth = isSameMonth(day, currentMonth);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'min-h-[80px] border-b border-r border-border/20 p-1.5 cursor-pointer transition-colors hover:bg-muted/30',
                !inMonth && 'opacity-40'
              )}
              onClick={() => onDateClick?.(day)}
            >
              <span
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                  isToday(day) && 'bg-primary text-primary-foreground',
                  !isToday(day) && 'text-foreground'
                )}
              >
                {format(day, 'd')}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((event) =>
                  renderEvent ? (
                    <div key={event.id} onClick={(e) => { e.stopPropagation(); onEventClick?.(event); }}>
                      {renderEvent(event)}
                    </div>
                  ) : (
                    <div
                      key={event.id}
                      className="truncate rounded px-1 py-0.5 text-[10px] font-medium cursor-pointer hover:brightness-110"
                      style={{ backgroundColor: event.color || 'hsl(var(--primary) / 0.15)', color: event.color ? 'hsl(var(--primary-foreground))' : 'hsl(var(--primary))' }}
                      onClick={(e) => { e.stopPropagation(); onEventClick?.(event); }}
                    >
                      {event.title}
                    </div>
                  )
                )}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} mais</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
