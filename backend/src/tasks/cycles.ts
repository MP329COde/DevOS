export interface CycleItem {
  id: string;
  status: string;
  cycleId: string | null;
}

export function carryIncompleteItems(items: readonly CycleItem[], currentCycleId: string, nextCycleId: string): CycleItem[] {
  return items.map((item) => item.cycleId === currentCycleId && item.status !== 'done' ? { ...item, cycleId: nextCycleId } : item);
}

export function closeCycle<T extends { closedAt: Date | null }>(cycle: T, now = new Date()): T {
  return { ...cycle, closedAt: now };
}