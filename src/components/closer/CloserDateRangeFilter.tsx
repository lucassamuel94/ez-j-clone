import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarDays, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface CloserDateRangeFilterProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  label?: string;
}

export const CloserDateRangeFilter = ({ dateRange, onDateRangeChange, label = 'Período' }: CloserDateRangeFilterProps) => {
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const hasFilter = dateRange.from || dateRange.to;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs font-medium text-muted-foreground">{label}:</span>

      {/* From date */}
      <Popover open={fromOpen} onOpenChange={setFromOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 px-2.5 text-xs font-medium gap-1.5",
              !dateRange.from && "text-muted-foreground"
            )}
          >
            <CalendarDays className="h-3 w-3" />
            {dateRange.from ? format(dateRange.from, 'dd/MM/yy', { locale: ptBR }) : 'De'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateRange.from}
            onSelect={(date) => {
              onDateRangeChange({ ...dateRange, from: date });
              setFromOpen(false);
            }}
            locale={ptBR}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* To date */}
      <Popover open={toOpen} onOpenChange={setToOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 px-2.5 text-xs font-medium gap-1.5",
              !dateRange.to && "text-muted-foreground"
            )}
          >
            <CalendarDays className="h-3 w-3" />
            {dateRange.to ? format(dateRange.to, 'dd/MM/yy', { locale: ptBR }) : 'Até'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateRange.to}
            onSelect={(date) => {
              onDateRangeChange({ ...dateRange, to: date });
              setToOpen(false);
            }}
            locale={ptBR}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* Clear */}
      {hasFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => onDateRangeChange({ from: undefined, to: undefined })}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};
