import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Wifi,
  WifiOff,
  Loader2,
  Calendar as CalendarIcon,
  LayoutGrid,
  RefreshCw,
  MoreVertical,
} from 'lucide-react';
import type { OAuthConnectionStatus } from '@/hooks/useGoogleCalendar';
import { format, startOfWeek, endOfWeek, isToday as checkIsToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CalendarHeaderProps {
  currentDate: Date;
  view: 'week' | 'day' | 'month';
  isConnected: boolean;
  isConnecting: boolean;
  connectionStatus?: OAuthConnectionStatus;
  isMobile: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: 'week' | 'day' | 'month') => void;
  onConnect: () => void;
  onNewEvent: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function CalendarHeader({
  currentDate,
  view,
  isConnected,
  isConnecting,
  connectionStatus = isConnected ? 'connected' : 'disconnected',
  isMobile,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onConnect,
  onNewEvent,
  onRefresh,
  isRefreshing,
}: CalendarHeaderProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const monthYear = format(currentDate, "MMMM yyyy", { locale: ptBR });
  const dateRange =
    view === 'month'
      ? format(currentDate, "MMMM yyyy", { locale: ptBR })
      : view === 'week'
        ? `${format(weekStart, 'dd.MM')} · ${format(weekEnd, 'dd.MM')}`
        : format(currentDate, "dd 'de' MMMM", { locale: ptBR });

  const isTodayVisible = checkIsToday(currentDate);

  // Mobile: compact layout
  if (isMobile) {
    return (
      <div className="flex flex-col gap-2">
        {/* Row 1: Title + actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <h1 className="text-lg font-bold text-foreground tracking-tight">Calendário</h1>
          </div>
          <div className="flex items-center gap-1">
            {connectionStatus === 'connected' ? (
              <Badge
                variant="outline"
                className="gap-1 text-[11px] h-6 bg-success/10 text-success border-success/20"
              >
                <Wifi className="h-3 w-3" />
              </Badge>
            ) : connectionStatus === 'reconnecting' ? (
              <Badge
                variant="outline"
                className="gap-1 text-[11px] h-6 bg-warning/10 text-warning border-warning/20"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs h-8"
                onClick={onConnect}
                disabled={isConnecting}
              >
                <WifiOff className="h-3.5 w-3.5 text-destructive" />
                Conectar
              </Button>
            )}

            {isConnected && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onRefresh && (
                    <DropdownMenuItem onClick={onRefresh} disabled={isRefreshing}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                      Atualizar eventos
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Row 2: Navigation */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground capitalize">{monthYear}</h2>
          <div className="flex items-center gap-1">
            <Button
              variant={isTodayVisible ? 'ghost' : 'outline'}
              size="sm"
              onClick={onToday}
              className="text-xs h-9 px-3"
            >
              Hoje
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onPrev} aria-label={view === 'month' ? 'Mês anterior' : view === 'week' ? 'Semana anterior' : 'Dia anterior'}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground font-medium min-w-[80px] text-center tabular-nums">
              {dateRange}
            </span>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onNext} aria-label={view === 'month' ? 'Próximo mês' : view === 'week' ? 'Próxima semana' : 'Próximo dia'}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: full layout
  return (
    <PageHeader
      icon={<CalendarIcon className="h-5 w-5" strokeWidth={1.5} />}
      title="Calendário"
      badges={
        <div className="shrink-0">
          {/* View tabs - pill segmented control */}
          <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5 bg-muted/40">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                view === 'month'
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              onClick={() => onViewChange('month')}
              aria-pressed={view === 'month'}
              title="Visualizar mês (Alt+M)"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Mês
            </button>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                view === 'week'
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              onClick={() => onViewChange('week')}
              aria-pressed={view === 'week'}
              title="Visualizar semana (Alt+S)"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Semana
            </button>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                view === 'day'
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              onClick={() => onViewChange('day')}
              aria-pressed={view === 'day'}
              title="Visualizar dia (Alt+D)"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Dia
            </button>
          </div>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          {connectionStatus === 'disconnected' ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={onConnect}
              disabled={isConnecting}
            >
              <WifiOff className="h-3.5 w-3.5 text-destructive" />
              {isConnecting ? 'Conectando...' : 'Conectar Google'}
            </Button>
          ) : connectionStatus === 'reconnecting' ? (
            <Badge
              variant="outline"
              className="gap-1 text-[11px] h-6 bg-warning/10 text-warning border-warning/20"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              Reconectando
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 text-[11px] h-6 bg-success/10 text-success border-success/20"
            >
              <Wifi className="h-3 w-3" />
              Conectado
            </Badge>
          )}

          {isConnected && onRefresh && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Atualizar eventos</TooltipContent>
            </Tooltip>
          )}

          <Button size="sm" className="gap-1.5 text-xs h-8" onClick={onNewEvent} disabled={!isConnected}>
            <Plus className="h-3.5 w-3.5" />
            Novo Evento
          </Button>
        </div>
      }
      toolbar={
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-foreground capitalize min-w-[140px] leading-none">
            {monthYear}
          </h2>

          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isTodayVisible ? 'ghost' : 'outline'}
                  size="sm"
                  onClick={onToday}
                  className={`text-xs h-7 px-3 transition-all duration-200 ${
                    isTodayVisible
                      ? 'text-muted-foreground'
                      : 'text-primary border-primary/30 hover:bg-primary/5'
                  }`}
                >
                  Hoje
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Ir para hoje (T)</TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-0.5 ml-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-muted" onClick={onPrev}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{view === 'month' ? 'Mês anterior' : view === 'week' ? 'Semana anterior' : 'Dia anterior'}</TooltipContent>
              </Tooltip>

              <span className="text-xs text-muted-foreground font-medium min-w-[95px] text-center tabular-nums leading-none">
                {dateRange}
              </span>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-muted" onClick={onNext}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{view === 'month' ? 'Próximo mês' : view === 'week' ? 'Próxima semana' : 'Próximo dia'}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      }
    />
  );
}
