import type { Item, PrismaClient } from '@prisma/client';

export function startOfDay(reference: Date): Date {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function endOfDay(reference: Date): Date {
  const end = new Date(reference);
  end.setHours(23, 59, 59, 999);
  return end;
}

export class DashboardService {
  public constructor(private readonly database: PrismaClient) {}

  public today(reference: Date = new Date()): Promise<Item[]> {
    return this.database.item.findMany({
      where: { dueAt: { gte: startOfDay(reference), lte: endOfDay(reference) } },
      include: { gitlabLinks: true },
      orderBy: { dueAt: 'asc' },
    }) as Promise<Item[]>;
  }

  public tomorrow(reference: Date = new Date()): Promise<Item[]> {
    const nextDay = new Date(reference);
    nextDay.setDate(nextDay.getDate() + 1);
    return this.today(nextDay);
  }
}
