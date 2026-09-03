export type TriageStatus = 'none' | 'pending' | 'accepted' | 'rejected';

export function createWebhookTriage<T extends { triage: TriageStatus }>(item: T): T {
  return { ...item, triage: 'pending' };
}

export function transitionTriage<T extends { triage: TriageStatus }>(item: T, next: 'accepted' | 'rejected'): T {
  if (item.triage !== 'pending') throw new Error('Only pending items can leave triage');
  return { ...item, triage: next };
}