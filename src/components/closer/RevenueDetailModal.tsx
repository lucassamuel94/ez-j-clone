import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { CloserOpportunity } from '@/services/closerService';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

export interface RevenueDetailItem {
  id: string;
  name: string;
  closerName?: string;
  setup: number;
  mrr: number;
  stage?: string;
}

interface RevenueDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: RevenueDetailItem[];
  onItemClick?: (id: string) => void;
}

export const RevenueDetailModal = ({ open, onOpenChange, title, items, onItemClick }: RevenueDetailModalProps) => {
  const totals = useMemo(() => ({
    setup: items.reduce((s, i) => s + i.setup, 0),
    mrr: items.reduce((s, i) => s + i.mrr, 0),
  }), [items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold uppercase tracking-widest">{title}</DialogTitle>
        </DialogHeader>

        {/* Header */}
        <div className="grid grid-cols-[1fr_100px_80px] gap-x-4 items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 pb-1 border-b">
          <span>Cliente</span>
          <span className="text-right">Setup</span>
          <span className="text-right">MRR</span>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 divide-y divide-border/50">
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhum registro encontrado</p>
          )}
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => onItemClick?.(item.id)}
              className="grid grid-cols-[1fr_100px_80px] gap-x-4 items-center w-full text-left px-3 py-2.5 hover:bg-accent transition-colors min-h-[44px]"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                {item.closerName && (
                  <p className="text-[10px] text-muted-foreground truncate">{item.closerName}</p>
                )}
                {item.stage && (
                  <p className="text-[10px] text-muted-foreground">{item.stage}</p>
                )}
              </div>
              <span className="text-xs font-semibold tabular-nums text-foreground text-right">{formatCurrency(item.setup)}</span>
              <span className="text-xs font-medium tabular-nums text-muted-foreground text-right">{formatCurrency(item.mrr)}</span>
            </button>
          ))}
        </div>

        {/* Totals */}
        {items.length > 0 && (
          <div className="grid grid-cols-[1fr_100px_80px] gap-x-4 items-center px-3 py-2 border-t bg-[#f1f1f8] dark:bg-muted/30 rounded-b-lg">
            <span className="text-xs font-bold text-foreground">Total ({items.length})</span>
            <span className="text-xs font-bold tabular-nums text-foreground text-right">{formatCurrency(totals.setup)}</span>
            <span className="text-xs font-bold tabular-nums text-muted-foreground text-right">{formatCurrency(totals.mrr)}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
