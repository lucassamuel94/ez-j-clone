import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Icon element displayed before the title */
  icon?: React.ReactNode;
  /** Page title (required) */
  title: string;
  /** Subtitle below the title */
  subtitle?: string;
  /** Count badge next to the title */
  count?: number;
  /** Extra badges (e.g. overdue, coming soon) */
  badges?: React.ReactNode;
  /** Right-side actions (buttons, toggles, etc.) */
  actions?: React.ReactNode;
  /** Second row: search, filters, dropdowns — fully flexible */
  toolbar?: React.ReactNode;
  /** Stick to the top of the scroll container */
  sticky?: boolean;
  className?: string;
}

export const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(function PageHeader({
  icon,
  title,
  subtitle,
  count,
  badges,
  actions,
  toolbar,
  sticky = false,
  className,
}, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "w-full pb-4",
        sticky &&
          "sticky top-0 z-20 backdrop-blur-xl bg-background/70 border-b border-border/30",
        className,
      )}
    >
      {/* ═══ Line 1: Identity + Actions ═══ */}
      <div className="flex items-center gap-3 flex-wrap">
        {icon && (
          <span className="text-primary/80 shrink-0">
            {icon}
          </span>
        )}

        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="text-lg font-semibold text-foreground tracking-tight truncate font-display">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground/60 hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>

        {count !== undefined && (
          <span className="text-xs font-medium text-muted-foreground/50 tabular-nums">
            {count}
          </span>
        )}

        {badges && <div className="flex items-center gap-1.5">{badges}</div>}

        {actions && (
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* ═══ Line 2: Toolbar (optional) ═══ */}
      {toolbar && <div className="mt-3">{toolbar}</div>}
    </div>
  );
});
