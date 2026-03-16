import { format, isToday, isBefore } from 'date-fns';
import { Video, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { CalendarEventItem } from './types';

interface CalendarUpcomingBarProps {
  events: CalendarEventItem[];
  onEventClick: (event: CalendarEventItem) => void;
  isMobile?: boolean;
}

export function CalendarUpcomingBar({ events, onEventClick, isMobile = false }: CalendarUpcomingBarProps) {
  const now = new Date();
  const todayEvents = events
    .filter((ev) => isToday(new Date(ev.start)))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  if (todayEvents.length === 0) return null;

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Section label */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/20">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Agenda de Hoje
        </span>
        <Badge variant="secondary" className="text-[11px] h-4 px-1.5 ml-auto">
          {todayEvents.length} evento{todayEvents.length > 1 ? 's' : ''}
        </Badge>
      </div>

      {isMobile ? (
        /* Mobile: vertical stack */
        <div className="flex flex-col divide-y divide-border">
          {todayEvents.map((ev) => {
            const start = new Date(ev.start);
            const end = new Date(ev.end);
            const isPast = isBefore(end, now);
            const isNow = isBefore(start, now) && isBefore(now, end);

            return (
              <button
                key={ev.id}
                onClick={() => onEventClick(ev)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 transition-all duration-200 text-left min-h-[48px]',
                  isPast && 'opacity-50',
                  isNow && 'bg-primary/[0.04]',
                  !isPast && 'hover:bg-muted/40 active:bg-muted/60',
                )}
                aria-label={`${ev.title}, ${format(start, 'HH:mm')} às ${format(end, 'HH:mm')}`}
              >
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  isNow ? 'bg-chart-3 animate-pulse' : isPast ? 'bg-muted-foreground/30' : 'bg-primary/60'
                )} />
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className={cn(
                    'text-[10px] font-medium tabular-nums',
                    isPast ? 'text-muted-foreground/60 line-through' : 'text-muted-foreground'
                  )}>
                    {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
                  </span>
                  <p className={cn(
                    'text-sm font-semibold truncate',
                    isPast ? 'text-muted-foreground/60' : 'text-foreground'
                  )}>
                    {ev.title}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isPast && <CheckCircle2 className="h-3 w-3 text-muted-foreground/40" />}
                  {isNow && (
                    <Badge className="text-[11px] h-5 px-1.5 bg-chart-3/10 text-chart-3 border-chart-3/20 animate-pulse">
                      Agora
                    </Badge>
                  )}
                  {ev.meetLink && !isPast && (
                    <a
                      href={ev.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline bg-primary/5 px-2 py-1 rounded-md hover:bg-primary/10 transition-colors min-h-[32px]"
                    >
                      <Video className="h-3 w-3" />
                      Entrar
                    </a>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        /* Desktop: horizontal scroll */
        <ScrollArea className="w-full">
          <div className="flex">
            {todayEvents.map((ev, index) => {
              const start = new Date(ev.start);
              const end = new Date(ev.end);
              const isPast = isBefore(end, now);
              const isNow = isBefore(start, now) && isBefore(now, end);
              const isNext = !isPast && !isNow && index === todayEvents.findIndex(e => !isBefore(new Date(e.end), now));

              return (
                <button
                  key={ev.id}
                  onClick={() => onEventClick(ev)}
                  className={cn(
                    'flex items-center gap-3 min-w-[220px] px-4 py-2.5 transition-all duration-200 text-left shrink-0 border-r border-border last:border-r-0',
                    isPast && 'opacity-50',
                    isNow && 'bg-primary/[0.04]',
                    isNext && 'bg-accent/30',
                    !isPast && 'hover:bg-muted/40 hover:-translate-y-[1px]',
                  )}
                  aria-label={`${ev.title}, ${format(start, 'HH:mm')} às ${format(end, 'HH:mm')}`}
                >
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    isNow ? 'bg-chart-3 animate-pulse' : isPast ? 'bg-muted-foreground/30' : 'bg-primary/60'
                  )} />
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className={cn(
                      'text-[10px] font-medium tabular-nums',
                      isPast ? 'text-muted-foreground/60 line-through' : 'text-muted-foreground'
                    )}>
                      {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
                    </span>
                    <p className={cn(
                      'text-sm font-semibold truncate',
                      isPast ? 'text-muted-foreground/60' : 'text-foreground'
                    )}>
                      {ev.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isPast && <CheckCircle2 className="h-3 w-3 text-muted-foreground/40" />}
                    {isNow && (
                      <Badge className="text-[11px] h-4 px-1.5 bg-chart-3/10 text-chart-3 border-chart-3/20 animate-pulse">
                        Agora
                      </Badge>
                    )}
                    {ev.meetLink && !isPast && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={ev.meetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline bg-primary/5 px-2 py-0.5 rounded-md hover:bg-primary/10 transition-colors"
                          >
                            <Video className="h-3 w-3" />
                            Entrar
                          </a>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Entrar na reunião</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}
