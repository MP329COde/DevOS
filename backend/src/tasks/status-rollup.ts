export type RollupStatus = 'backlog' | 'in_progress' | 'done' | 'blocked';

export function rollupStatus(childStatuses: readonly RollupStatus[]): RollupStatus {
  if (childStatuses.length === 0) return 'backlog';
  if (childStatuses.some((status) => status === 'blocked')) return 'blocked';
  if (childStatuses.every((status) => status === 'done')) return 'done';
  return 'in_progress';
}