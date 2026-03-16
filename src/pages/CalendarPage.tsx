import { useState, useEffect, useCallback, useRef } from 'react';
import { addWeeks, subWeeks, addDays, subDays, addMonths, subMonths, startOfWeek, endOfWeek, startOfDay, endOfDay, startOfMonth, endOfMonth, format } from 'date-fns';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { CalendarWeekGrid } from '@/components/calendar/CalendarWeekGrid';
import { CalendarMonthGrid } from '@/components/calendar/CalendarMonthGrid';
import { CalendarUpcomingBar } from '@/components/calendar/CalendarUpcomingBar';
import { CalendarEventDialog } from '@/components/calendar/CalendarEventDialog';
import { CalendarSkeleton } from '@/components/calendar/CalendarSkeleton';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useIsMobile } from '@/hooks/use-mobile';
import type { CalendarEventItem } from '@/components/calendar/types';
import { Calendar as CalendarIcon, WifiOff, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CalendarPage() {
  const {
    isConnected,
    isLoading: isAuthLoading,
    isConnecting,
    connectionStatus,
    connect,
    listEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  } = useGoogleCalendar();

  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'day' | 'month'>('week');
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'view'>('create');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Force day view on mobile
  useEffect(() => {
    if (isMobile) setView('day');
  }, [isMobile]);

  // Deduplicate fetch calls to avoid rate limiting
  const fetchingRef = useRef(false);
  const lastFetchKeyRef = useRef('');

  const fetchEvents = useCallback(async (force = false) => {
    if (!isConnected) return;

    const rangeStart = view === 'month'
      ? startOfMonth(currentDate)
      : view === 'week'
        ? startOfWeek(currentDate, { weekStartsOn: 1 })
        : startOfDay(currentDate);
    const rangeEnd = view === 'month'
      ? endOfMonth(currentDate)
      : view === 'week'
        ? endOfWeek(currentDate, { weekStartsOn: 1 })
        : endOfDay(currentDate);

    const fetchKey = `${rangeStart.toISOString()}-${rangeEnd.toISOString()}`;

    if (fetchingRef.current) return;
    if (!force && fetchKey === lastFetchKeyRef.current && events.length > 0) return;

    fetchingRef.current = true;
    setIsLoadingEvents(true);

    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await listEvents(rangeStart.toISOString(), rangeEnd.toISOString(), 100);
        const rawItems = result?.items || result?.events || [];
        const items: CalendarEventItem[] = rawItems
          .filter((ev: any) => ev.eventType !== 'workingLocation')
          .map((ev: any) => ({
          id: ev.id,
          title: ev.summary || 'Sem título',
          description: ev.description,
          start: ev.start?.dateTime || ev.start?.date,
          end: ev.end?.dateTime || ev.end?.date,
          meetLink: ev.hangoutLink || ev.conferenceData?.entryPoints?.[0]?.uri,
          attendees: ev.attendees?.map((a: any) => ({
            email: a.email,
            responseStatus: a.responseStatus,
          })) || [],
          recurrence: ev.recurrence?.[0] || undefined,
          recurringEventId: ev.recurringEventId || undefined,
        }));
        setEvents(items);
        lastFetchKeyRef.current = fetchKey;
        break;
      } catch (err: any) {
        const isRateLimit = err.message?.includes('rateLimitExceeded') || err.message?.includes('RATE_LIMIT');
        if (isRateLimit && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 3000 + 2000));
          continue;
        }
        console.error('Failed to load events:', err);
        if (err.message !== 'not_connected' && err.message !== 'TOKEN_REVOKED' && !isRateLimit) {
          toast.error('Erro ao carregar eventos');
        }
        break;
      }
    }

    fetchingRef.current = false;
    setIsLoadingEvents(false);
  }, [isConnected, currentDate, view, listEvents, events.length]);

  useEffect(() => {
    fetchEvents();
  }, [isConnected, currentDate, view]);

  // Refresh every 5 min
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => fetchEvents(true), 300000);
    return () => clearInterval(interval);
  }, [isConnected, fetchEvents]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); if (!isMobile) setView('week'); }
      if (e.altKey && e.key.toLowerCase() === 'd') { e.preventDefault(); setView('day'); }
      if (e.altKey && e.key.toLowerCase() === 'm') { e.preventDefault(); if (!isMobile) setView('month'); }
      if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setCurrentDate(new Date());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMobile]);

  const handlePrev = () => {
    setCurrentDate((d) =>
      view === 'month' ? subMonths(d, 1) : view === 'week' ? subWeeks(d, 1) : subDays(d, 1)
    );
  };
  const handleNext = () => {
    setCurrentDate((d) =>
      view === 'month' ? addMonths(d, 1) : view === 'week' ? addWeeks(d, 1) : addDays(d, 1)
    );
  };
  const handleToday = () => setCurrentDate(new Date());

  const handleNewEvent = (prefilledDate?: string, prefilledTime?: string) => {
    setSelectedEvent(null);
    setDialogMode('create');
    setDialogOpen(true);
  };

  const handleEventClick = (event: CalendarEventItem) => {
    setSelectedEvent(event);
    setDialogMode('view');
    setDialogOpen(true);
  };

  const handleSlotClick = (day: Date, hour: number) => {
    setSelectedEvent(null);
    setDialogMode('create');
    setDialogOpen(true);
  };

  const handleCreate = async (data: {
    title: string;
    description: string;
    startDate: string;
    startTime: string;
    endTime: string;
    attendees: string;
  }) => {
    setIsSubmitting(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const startISO = `${data.startDate}T${data.startTime}:00`;
      const endISO = `${data.startDate}T${data.endTime}:00`;
      const attendeesList = data.attendees
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
        .map((email) => ({ email }));

      await createEvent({
        summary: data.title,
        description: data.description || undefined,
        start: { dateTime: new Date(startISO).toISOString(), timeZone: tz },
        end: { dateTime: new Date(endISO).toISOString(), timeZone: tz },
        attendees: attendeesList.length > 0 ? attendeesList : undefined,
      });

      toast.success('Evento criado com sucesso!');
      setDialogOpen(false);
      fetchEvents(true);
    } catch {
      toast.error('Erro ao criar evento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (eventId: string, data: {
    title: string;
    description: string;
    startDate: string;
    startTime: string;
    endTime: string;
    attendees: string;
  }) => {
    setIsSubmitting(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const startISO = `${data.startDate}T${data.startTime}:00`;
      const endISO = `${data.startDate}T${data.endTime}:00`;
      const attendeesList = data.attendees
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
        .map((email) => ({ email }));

      await updateEvent(eventId, {
        summary: data.title,
        description: data.description || undefined,
        start: { dateTime: new Date(startISO).toISOString(), timeZone: tz },
        end: { dateTime: new Date(endISO).toISOString(), timeZone: tz },
        attendees: attendeesList.length > 0 ? attendeesList : undefined,
      });

      toast.success('Evento atualizado!');
      setDialogOpen(false);
      fetchEvents(true);
    } catch {
      toast.error('Erro ao atualizar evento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    setIsSubmitting(true);
    try {
      await deleteEvent(eventId);
      toast.success('Evento excluído');
      setDialogOpen(false);
      fetchEvents(true);
    } catch {
      toast.error('Erro ao excluir evento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showSkeleton = isAuthLoading || (isConnected && isLoadingEvents && events.length === 0);
  const showEmptyState = isConnected && !isLoadingEvents && events.length === 0 && !isAuthLoading;

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <main className="p-4 md:p-6 space-y-3 flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
          <CalendarHeader
            currentDate={currentDate}
            view={view}
            isConnected={isConnected}
            isConnecting={isConnecting}
            connectionStatus={connectionStatus}
            isMobile={isMobile}
            onPrev={handlePrev}
            onNext={handleNext}
            onToday={handleToday}
            onViewChange={(v) => { if (!isMobile || v === 'day') setView(v as any); }}
            onConnect={connect}
            onNewEvent={() => handleNewEvent()}
            onRefresh={() => fetchEvents(true)}
            isRefreshing={isLoadingEvents}
          />

          {isConnected && events.length > 0 && (
            <CalendarUpcomingBar events={events} onEventClick={handleEventClick} isMobile={isMobile} />
          )}

          {showSkeleton ? (
            <CalendarSkeleton view={view} />
          ) : !isConnected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 border border-border rounded-lg bg-card p-6">
              <WifiOff className="h-12 w-12 text-muted-foreground/20" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Conecte seu Google Calendar
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Visualize reuniões, eventos e compromissos em tempo real
                </p>
              </div>
              <Button size="sm" onClick={connect} disabled={isConnecting} className="gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                {isConnecting ? 'Conectando...' : 'Conectar Google Calendar'}
              </Button>
            </div>
          ) : showEmptyState ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 border border-border rounded-lg bg-card p-6">
              <CalendarIcon className="h-10 w-10 text-muted-foreground/20" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Nenhum evento neste período
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Crie seu primeiro evento para começar
                </p>
              </div>
              <Button size="sm" onClick={() => handleNewEvent()} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Criar Evento
              </Button>
            </div>
          ) : view === 'month' ? (
              <CalendarMonthGrid
                currentDate={currentDate}
                events={events}
                onEventClick={handleEventClick}
                onDayClick={(day) => {
                  setCurrentDate(day);
                  setView('day');
                }}
                isMobile={isMobile}
              />
          ) : (
              <CalendarWeekGrid
                currentDate={currentDate}
                events={events}
                view={view}
                onEventClick={handleEventClick}
                onSlotClick={handleSlotClick}
                isMobile={isMobile}
              />
          )}
        </main>

        {/* Mobile FAB for new event */}
        {isMobile && isConnected && (
          <button
            onClick={() => handleNewEvent()}
            className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
            aria-label="Criar novo evento"
          >
            <Plus className="h-6 w-6" />
          </button>
        )}
      </div>

      <CalendarEventDialog
        open={dialogOpen}
        event={selectedEvent}
        mode={dialogMode}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        isSubmitting={isSubmitting}
        isMobile={isMobile}
      />
    </AppLayout>
  );
}
