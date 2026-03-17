import { memo } from 'react';

export interface BarEntry {
  label: string;
  value: number;
}

interface Props {
  data: BarEntry[];
  colorFn?: (v: number, i: number) => string;
}

const PosVendaHorizontalBars = memo(function PosVendaHorizontalBars({ data, colorFn }: Props) {
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-24 truncate text-right">{d.label}</span>
          <div className="flex-1 h-5 bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min((d.value / Math.max(...data.map(x => x.value), 1)) * 100, 100)}%`,
                backgroundColor: colorFn ? colorFn(d.value, i) : 'hsl(220,79%,48%)',
              }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums w-8 text-right">{d.value}</span>
        </div>
      ))}
      {data.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>}
    </div>
  );
});

export default PosVendaHorizontalBars;
