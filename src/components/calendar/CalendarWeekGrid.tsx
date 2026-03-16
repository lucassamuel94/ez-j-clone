import { useMemo, useRef, useEffect, useState } from 'react';
import { format, startOfWeek, addDays, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CalendarEventBlock } from './CalendarEventBlock';
import type { CalendarEventItem } from './types';
import { Plus } from 'lucide-react';

interface CalendarWeekGridProps {
  currentDate: Date;
  events: CalendarEventItem[];
  view: 'week' | 'day';
  onEventClick: (event: CalendarEventItem) => void;
  onSlotClick?: (day: Date, hour: number) => void;
  isMobile?: boolean;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7AM - 8PM
const HOUR_HEIGHT_DESKTOP = 64;
const HOUR_HEIGHT_MOBILE = 72;

function getEventPosition(event: CalendarEventItem, hourHeight: number) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const startMinutes = (start.getHours() - 7) * 60 + start.getMinutes();
  const endMinutes = (end.getHours() - 7) * 60 + end.getMinutes();
  const top = (startMinutes / 60) * hourHeight;
  const height = Math.max(((endMinutes - startMinutes) / 60) * hourHeight, 28);
  return { top, height };
}

// Detect overlapping events and assign columns
function layoutEvents(events: CalendarEventItem[]) {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const columns: { end: number; event: CalendarEventItem }[][] = [];

  sorted.forEach((event) => {
    const startMs = new Date(event.start).getTime();
    let placed = false;
    for (const col of columns) {
      const lastInCol = col[col.length - 1];
      if (new Date(lastInCol.event.end).getTime() <= startMs) {
        col.push({ end: new Date(event.end).getTime(), event });
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([{ end: new Date(event.end).getTime(), event }]);
    }
  });

  const result: { event: CalendarEventItem; col: number; totalCols: number }[] = [];
  columns.forEach((col, colIndex) => {
    col.forEach(({ event }) => {
      result.push({ event, col: colIndex, totalCols: columns.length });
    });
  });

  return result;
}

export function CalendarWeekGrid({ currentDate, events, view, onEventClick, onSlotClick, isMobile = false }: CalendarWeekGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const [, setTick] = useState(0);
  const HOUR_HEIGHT = isMobile ? HOUR_HEIGHT_MOBILE : HOUR_HEIGHT_DESKTOP;

  const days = useMemo(() => {
    if (view === 'day') return [currentDate];
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [currentDate, view, weekStart]);

  // Scroll to ~8AM on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 1 * HOUR_HEIGHT;
    }
  }, [HOUR_HEIGHT]);

  // Update current time indicator every minute
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Current time indicator
  const now = new Date();
  const nowMinutes = (now.getHours() - 7) * 60 + now.getMinutes();
  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT;
  const nowTimeLabel = format(now, 'HH:mm');

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    days.forEach((d) => {
      const key = format(d, 'yyyy-MM-dd');
      map.set(key, []);
    });
    events.forEach((ev) => {
      const evDate = new Date(ev.start);
      const key = format(evDate, 'yyyy-MM-dd');
      if (map.has(key)) {
        map.get(key)!.push(ev);
      }
    });
    return map;
  }, [events, days]);

  const handleSlotClick = (day: Date, hour: number) => {
    onSlotClick?.(day, hour);
  };

  return (
    <div className="flex-1 border border-border rounded-lg bg-card overflow-hidden flex flex-col" role="grid" aria-label="Grade do calendário">
      {/* Day headers */}
      <div className="flex border-b border-border sticky top-0 bg-card z-10" role="row">
        <div className="w-[52px] shrink-0 border-r border-border" role="columnheader" />
        {days.map((day) => {
          const today = isToday(day);
          const dayLabel = format(day, "EEEE, dd 'de' MMMM", { locale: ptBR });
          return (
            <div
              key={day.toISOString()}
              role="columnheader"
              aria-label={dayLabel}
              aria-current={today ? 'date' : undefined}
              className={cn(
                'flex-1 text-center py-2.5 border-r border-border last:border-r-0 transition-colors',
                today && 'bg-primary/[0.03]',
              )}
            >
              <p className={cn(
                'text-[11px] font-bold uppercase tracking-widest',
                today ? 'text-primary' : 'text-muted-foreground'
              )}>
                {format(day, 'EEE', { locale: ptBR })}
              </p>
              <div className="flex items-center justify-center mt-0.5">
                <span
                  className={cn(
                    'text-sm font-medium inline-flex items-center justify-center',
                    today
                      ? 'bg-primary text-primary-foreground rounded-full w-7 h-7 font-bold'
                      : 'text-foreground',
                  )}
                >
                  {format(day, 'dd')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-auto relative">
        <div className="flex" style={{ minHeight: HOURS.length * HOUR_HEIGHT }}>
          {/* Time gutter */}
          <div className="w-[52px] shrink-0 border-r border-border relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute w-full text-right pr-2"
                style={{ top: (hour - 7) * HOUR_HEIGHT - 6 }}
              >
                <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
            ))}

            {/* Current time in gutter */}
            {nowMinutes >= 0 && nowMinutes < HOURS.length * 60 && (
              <div
                className="absolute w-full text-right pr-2 z-30"
                style={{ top: nowTop - 6 }}
              >
                <span className="text-[10px] font-bold text-destructive tabular-nums bg-card px-0.5">
                  {nowTimeLabel}
                </span>
              </div>
            )}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDay.get(key) || [];
            const today = isToday(day);
            const laidOut = layoutEvents(dayEvents);

            return (
              <div
                key={key}
                role="gridcell"
                aria-label={`Eventos de ${format(day, "dd 'de' MMMM", { locale: ptBR })}, ${dayEvents.length} evento${dayEvents.length !== 1 ? 's' : ''}`}
                className={cn(
                  'flex-1 relative border-r border-border last:border-r-0',
                  today && 'bg-primary/[0.02]',
                )}
              >
                {/* Hour lines with click-to-create */}
                {HOURS.map((hour) => (
                  <div key={hour}>
                    <div
                      className={cn(
                        'absolute w-full border-t border-border/50 cursor-pointer group/slot',
                        onSlotClick && 'hover:bg-primary/[0.03]'
                      )}
                      style={{ top: (hour - 7) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                      onClick={() => handleSlotClick(day, hour)}
                      role="button"
                      aria-label={`Criar evento às ${String(hour).padStart(2, '0')}:00`}
                      tabIndex={-1}
                    >
                      {onSlotClick && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity pointer-events-none">
                          <Plus className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    {/* Half-hour line */}
                    <div
                      className="absolute w-full border-t border-border/20 border-dashed pointer-events-none"
                      style={{ top: (hour - 7) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                    />
                  </div>
                ))}

                {/* Current time indicator */}
                {today && nowMinutes >= 0 && nowMinutes < HOURS.length * 60 && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{ top: nowTop }}
                  >
                    <div className="flex items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-destructive -ml-[5px] shadow-sm" />
                      <div className="flex-1 h-[1.5px] bg-destructive/80" />
                    </div>
                  </div>
                )}

                {/* Events with overlap support */}
                {laidOut.map(({ event: ev, col, totalCols }) => {
                  const pos = getEventPosition(ev, HOUR_HEIGHT);
                  const widthPercent = 100 / totalCols;
                  const leftPercent = col * widthPercent;

                  return (
                    <CalendarEventBlock
                      key={ev.id}
                      event={ev}
                      top={pos.top}
                      height={pos.height}
                      onClick={() => onEventClick(ev)}
                      style={{
                        left: `calc(${leftPercent}% + 2px)`,
                        width: `calc(${widthPercent}% - 4px)`,
                        position: 'absolute',
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
