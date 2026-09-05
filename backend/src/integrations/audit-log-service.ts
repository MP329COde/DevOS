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

  /**
   * Generic event log for entities outside the item-conflict flow (e.g. platform updates).
   * Reuses the same `audit_logs` table/columns as `record()`: `decision`/`local`+`remoteUpdatedAt`
   * carry no real meaning here, they are set to a neutral "now" so the existing schema (built for
   * GitLab conflict resolution) doesn't need a migration for this unrelated use.
   */
  public async recordEvent(entityType: string, entityId: string, action: string): Promise<void> {
    const now = new Date();
    await this.database.auditLog.create({
      data: { entityType, entityId, action, decision: 'local', localUpdatedAt: now, remoteUpdatedAt: now },
    });
  }
}
