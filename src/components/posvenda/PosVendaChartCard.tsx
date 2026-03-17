import { memo, type ReactNode } from 'react';

interface PosVendaChartCardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

const PosVendaChartCard = memo(function PosVendaChartCard({ title, children, className }: PosVendaChartCardProps) {
  return (
    <div className={`bg-card border border-border rounded-xl p-5 ${className || ''}`}>
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
});

export default PosVendaChartCard;
