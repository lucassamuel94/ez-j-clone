import { format, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';
import { Video } from 'lucide-react';
import type { CalendarEventItem } from './types';

interface CalendarEventBlockProps {
  event: CalendarEventItem;
  top: number;
  height: number;
  onClick: () => void;
  style?: React.CSSProperties;
}

const COLOR_PALETTE = [
  { bg: 'bg-emerald-100/90 dark:bg-emerald-500/20', border: 'border-l-emerald-500 dark:border-l-emerald-400', text: 'text-emerald-800 dark:text-emerald-200', time: 'text-emerald-600/70 dark:text-emerald-300/70' },
  { bg: 'bg-blue-100/90 dark:bg-blue-500/20', border: 'border-l-blue-500 dark:border-l-blue-400', text: 'text-blue-800 dark:text-blue-200', time: 'text-blue-600/70 dark:text-blue-300/70' },
  { bg: 'bg-violet-100/90 dark:bg-violet-500/20', border: 'border-l-violet-500 dark:border-l-violet-400', text: 'text-violet-800 dark:text-violet-200', time: 'text-violet-600/70 dark:text-violet-300/70' },
  { bg: 'bg-amber-100/90 dark:bg-amber-500/20', border: 'border-l-amber-500 dark:border-l-amber-400', text: 'text-amber-800 dark:text-amber-200', time: 'text-amber-600/70 dark:text-amber-300/70' },
  { bg: 'bg-rose-100/90 dark:bg-rose-500/20', border: 'border-l-rose-500 dark:border-l-rose-400', text: 'text-rose-800 dark:text-rose-200', time: 'text-rose-600/70 dark:text-rose-300/70' },
  { bg: 'bg-cyan-100/90 dark:bg-cyan-500/20', border: 'border-l-cyan-500 dark:border-l-cyan-400', text: 'text-cyan-800 dark:text-cyan-200', time: 'text-cyan-600/70 dark:text-cyan-300/70' },
  { bg: 'bg-orange-100/90 dark:bg-orange-500/20', border: 'border-l-orange-500 dark:border-l-orange-400', text: 'text-orange-800 dark:text-orange-200', time: 'text-orange-600/70 dark:text-orange-300/70' },
];

function hashColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

export function CalendarEventBlock({ event, top, height, onClick, style }: CalendarEventBlockProps) {
  const color = hashColor(event.id);
  const startTime = format(new Date(event.start), 'HH:mm');
  const endTime = format(new Date(event.end), 'HH:mm');
  const isShort = height < 40;
  const isPast = isBefore(new Date(event.end), new Date());
  const hasMeet = !!event.meetLink;

  const ariaLabel = `${event.title}, ${startTime} às ${endTime}${hasMeet ? ', com Google Meet' : ''}`;

  return (
    <button
      className={cn(
        'rounded-md border-l-[3px] px-2 py-1 text-left transition-all duration-150 cursor-pointer overflow-hidden z-10 group',
        'hover:shadow-md hover:brightness-95 hover:-translate-y-[1px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        color.bg,
        color.border,
        color.text,
        isPast && 'opacity-50',
      )}
      style={{ top, height: Math.max(height, 24), ...style }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={ariaLabel}
    >
      {isShort ? (
        <div className="flex items-center gap-1">
          <p className="text-[10px] font-semibold truncate leading-tight flex-1">
            {event.title}
          </p>
          <span className={cn('text-[10px] font-medium shrink-0', color.time)}>
            {startTime}
          </span>
          {hasMeet && <Video className="h-2.5 w-2.5 shrink-0 opacity-60" />}
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-1">
            <p className="text-[11px] font-bold truncate leading-tight flex-1">{event.title}</p>
            {hasMeet && (
              <Video className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-80 mt-0.5 transition-opacity" />
            )}
          </div>
          <p className={cn('text-[10px] mt-0.5 font-medium tabular-nums', color.time)}>
            {startTime} – {endTime}
          </p>
        </>
      )}
    </button>
  );
}
