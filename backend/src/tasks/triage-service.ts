import type { PrismaClient } from '@prisma/client';

export class PrismaTriageService {
  public constructor(private readonly database: PrismaClient) {}

  public listPending() {
    return this.database.item.findMany({ where: { triage: 'pending' }, orderBy: { createdAt: 'asc' } });
  }

  public transition(id: string, triage: 'accepted' | 'rejected') {
    return this.database.item.update({ where: { id, triage: 'pending' }, data: { triage } });
  }
}