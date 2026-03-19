/**
 * Add business days (Mon–Fri) to a date.
 * Does not account for holidays.
 */
export const addBusinessDays = (startDate: Date, days: number): Date => {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
};

/**
 * Count business days between two dates (exclusive of start, inclusive of end).
 */
export const countBusinessDays = (start: Date, end: Date): number => {
  let count = 0;
  const current = new Date(start);
  while (current < end) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }
  return count;
};
