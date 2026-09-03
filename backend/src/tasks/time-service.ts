import type { PrismaClient } from '@prisma/client';

export class PrismaTimeService {
  public constructor(private readonly database: PrismaClient) {}

  public history(itemId: string) {
    return this.database.timeEntry.findMany({ where: { itemId }, orderBy: { startedAt: 'desc' } });
  }

  public async start(itemId: string) {
    const active = await this.database.timeEntry.findFirst({ where: { itemId, endedAt: null } });
    if (active) throw new Error('Item already has an active timer');
    return this.database.timeEntry.create({ data: { itemId } });
  }

  public stop(id: string) {
    return this.database.timeEntry.update({ where: { id, endedAt: null }, data: { endedAt: new Date() } });
  }
}