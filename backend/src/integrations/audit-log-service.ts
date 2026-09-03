import type { AuditLog, PrismaClient } from '@prisma/client';

export class AuditLogService {
  public constructor(private readonly database: PrismaClient) {}

  public async record(entry: { entityId: string; action: string; decision: 'local' | 'remote'; localUpdatedAt: Date; remoteUpdatedAt: Date }): Promise<void> {
    await this.database.auditLog.create({
      data: {
        entityType: 'item',
        entityId: entry.entityId,
        action: entry.action,
        decision: entry.decision,
        localUpdatedAt: entry.localUpdatedAt,
        remoteUpdatedAt: entry.remoteUpdatedAt,
      },
    });
  }

  public list(entityId?: string): Promise<AuditLog[]> {
    return this.database.auditLog.findMany({
      where: entityId === undefined ? {} : { entityId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
