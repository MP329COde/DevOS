import type { PrismaClient } from '@prisma/client';

export class PrismaCycleService {
  public constructor(private readonly database: PrismaClient) {}

  public list() {
    return this.database.cycle.findMany({ orderBy: { startsAt: 'desc' } });
  }

  public create(input: { name: string; startsAt: string; endsAt: string }) {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (!input.name.trim() || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
      throw new Error('Cycle requires a name and an increasing date range');
    }
    return this.database.cycle.create({ data: { name: input.name.trim(), startsAt, endsAt } });
  }

  public close(id: string) {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.cycle.findUnique({ where: { id } });
      if (!current || current.closedAt) throw new Error('Cycle is missing or already closed');
      const next = await transaction.cycle.findFirst({ where: { startsAt: { gt: current.startsAt } }, orderBy: { startsAt: 'asc' } });
      if (!next) throw new Error('A next cycle is required before closing this cycle');
      await transaction.item.updateMany({ where: { cycleId: id, status: { not: 'done' } }, data: { cycleId: next.id } });
      return transaction.cycle.update({ where: { id }, data: { closedAt: new Date() } });
    });
  }
}