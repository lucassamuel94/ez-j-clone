'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';

// ---------- List Root ----------

interface ListProps extends React.HTMLAttributes<HTMLDivElement> {}

export function List({ className, ...props }: ListProps) {
  return <div className={cn('space-y-1', className)} {...props} />;
}

// ---------- List Group ----------

interface ListGroupProps {
  label: string;
  count?: number;
  defaultOpen?: boolean;
  color?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export function ListGroup({
  label,
  count,
  defaultOpen = true,
  color,
  children,
  className,
  actions,
}: ListGroupProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className={cn('rounded-lg border border-border/40 bg-card', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors rounded-t-lg"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        {color && (
          <span
            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {count !== undefined && (
          <span className="ml-1 text-[10px] font-semibold tabular-nums text-muted-foreground/70">
            ({count})
          </span>
        )}
        {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
      </button>
      {open && <div className="px-1 pb-1">{children}</div>}
    </div>
  );
}

// ---------- List Item ----------

interface ListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
}

export function ListItem({ className, selected, ...props }: ListItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors cursor-pointer',
        'hover:bg-muted/50',
        selected && 'bg-primary/5 border border-primary/20',
        className
      )}
      {...props}
    />
  );
}

// ---------- List Item Field ----------

interface ListItemFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
}

export function ListItemField({ className, width, style, ...props }: ListItemFieldProps) {
  return (
    <div
      className={cn('truncate text-sm', className)}
      style={{ width, minWidth: width, maxWidth: width, ...style }}
      {...props}
    />
  );
}
