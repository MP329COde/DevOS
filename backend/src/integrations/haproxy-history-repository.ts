import type { PrismaClient } from '@prisma/client';

import type { HAProxyChangeAction, HAProxyChangeRecord, HAProxyHistoryRepository } from './haproxy-history.js';
import type { HAProxyServer } from './haproxy.js';

export class PrismaHAProxyHistoryRepository implements HAProxyHistoryRepository {
  public constructor(private readonly database: PrismaClient) {}

  public async record(entry: { action: HAProxyChangeAction; backend: string; server: HAProxyServer }): Promise<HAProxyChangeRecord> {
    const created = await this.database.hAProxyChangeLog.create({
      data: { action: entry.action, backend: entry.backend, server: entry.server as never },
    });
    return toRecord(created);
  }

  public async list(): Promise<HAProxyChangeRecord[]> {
    const rows = await this.database.hAProxyChangeLog.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toRecord);
  }

  public async get(id: string): Promise<HAProxyChangeRecord | null> {
    const row = await this.database.hAProxyChangeLog.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  public async markReverted(id: string): Promise<void> {
    await this.database.hAProxyChangeLog.update({ where: { id }, data: { revertedAt: new Date() } });
  }
}

function toRecord(row: { id: string; action: string; backend: string; server: unknown; createdAt: Date; revertedAt: Date | null }): HAProxyChangeRecord {
  return { id: row.id, action: row.action as HAProxyChangeAction, backend: row.backend, server: row.server as HAProxyServer, createdAt: row.createdAt, revertedAt: row.revertedAt };
}
