/**
 * Centralized date formatting utilities
 * All dates are displayed in America/Sao_Paulo (GMT-3) timezone
 */

export const TIMEZONE = 'America/Sao_Paulo';

/** Format options with timezone pre-set */
export const formatDateBR = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', { timeZone: TIMEZONE, ...options });
};

export const formatTimeBR = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('pt-BR', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', ...options });
};

export const formatDateTimeBR = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', { timeZone: TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
