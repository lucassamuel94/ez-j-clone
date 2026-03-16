export interface TaskCompletionLike {
  status?: string | null;
  completed_at?: string | null;
}

export function normalizeTaskStatus(status: string | null | undefined): string {
  return (status ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function isTaskCompleted(task: TaskCompletionLike): boolean {
  const normalizedStatus = normalizeTaskStatus(task.status);
  return normalizedStatus === 'concluida' || normalizedStatus === 'concluido' || Boolean(task.completed_at);
}
