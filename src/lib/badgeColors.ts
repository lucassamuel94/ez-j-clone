/**
 * Centralized semantic badge color classes.
 * Uses design system tokens — automatically adapts to light/dark mode.
 *
 * Usage:
 *   import { BADGE } from '@/lib/badgeColors';
 *   <Badge className={BADGE.success}>Ativo</Badge>
 */

/** Semantic badge background + text + border classes */
export const BADGE = {
  success:     'bg-success/10 text-success border-success/30',
  warning:     'bg-warning/10 text-warning border-warning/30',
  destructive: 'bg-destructive/10 text-destructive border-destructive/30',
  info:        'bg-info/10 text-info border-info/30',
  neutral:     'bg-muted text-muted-foreground border-border',
  primary:     'bg-primary/10 text-primary border-primary/30',
} as const;

/** Semantic icon-only color classes (no background) */
export const ICON_COLOR = {
  success:     'text-success',
  warning:     'text-warning',
  destructive: 'text-destructive',
  info:        'text-info',
  neutral:     'text-muted-foreground',
  primary:     'text-primary',
} as const;

/** Semantic dot / indicator colors */
export const DOT_COLOR = {
  success:     'bg-success',
  warning:     'bg-warning',
  destructive: 'bg-destructive',
  info:        'bg-info',
  neutral:     'bg-muted-foreground/30',
  primary:     'bg-primary',
} as const;

/** Inline text semantic colors (for contextual colored text) */
export const TEXT_COLOR = {
  success:     'text-success',
  warning:     'text-warning',
  destructive: 'text-destructive',
  info:        'text-info',
  neutral:     'text-muted-foreground',
  primary:     'text-primary',
} as const;

export type BadgeSemantic = keyof typeof BADGE;
