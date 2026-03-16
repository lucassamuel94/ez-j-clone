// Semantic color palette using CSS tokens - no hardcoded colors
export const SEMANTIC_COLORS = {
  primary: 'hsl(var(--primary))',
  success: 'hsl(var(--chart-3))',
  warning: 'hsl(var(--chart-2))',
  error: 'hsl(var(--chart-5))',
  info: 'hsl(var(--chart-4))',
  neutral: 'hsl(var(--muted-foreground))',
};

// Desaturated chart palette using design tokens
export const CHART_PALETTE = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-4))',
  'hsl(var(--primary))',
];

export const STATUS_COLORS_MAP: Record<string, string> = {
  ativo: 'hsl(var(--chart-3))',
  em_pausa: 'hsl(var(--chart-2))',
  concluido: 'hsl(var(--chart-4))',
  cancelado: 'hsl(var(--chart-5))',
  entregue: 'hsl(var(--chart-1))',
};

export const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo',
  em_pausa: 'Em Pausa',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  entregue: 'Entregue',
};
