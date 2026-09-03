export interface TimeEntry {
  id: string;
  itemId: string;
  startedAt: Date;
  endedAt: Date | null;
}

export function startTracking(entries: readonly TimeEntry[], itemId: string, now = new Date()): TimeEntry {
  if (entries.some((entry) => entry.itemId === itemId && entry.endedAt === null)) throw new Error('Item already has an active timer');
  return { id: crypto.randomUUID(), itemId, startedAt: now, endedAt: null };
}

export function stopTracking(entries: readonly TimeEntry[], entryId: string, now = new Date()): TimeEntry[] {
  let stopped = false;
  return entries.map((entry) => {
    if (entry.id !== entryId) return entry;
    if (entry.endedAt) throw new Error('Timer is already stopped');
    stopped = true;
    return { ...entry, endedAt: now };
  }).concat(stopped ? [] : (() => { throw new Error('Timer not found'); })());
}