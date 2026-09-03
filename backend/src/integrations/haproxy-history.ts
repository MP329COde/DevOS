import type { HAProxyClient, HAProxyServer } from './haproxy.js';

export type HAProxyChangeAction = 'add_server' | 'delete_server';

export interface HAProxyChangeRecord {
  id: string;
  action: HAProxyChangeAction;
  backend: string;
  server: HAProxyServer;
  createdAt: Date;
  revertedAt: Date | null;
}

export interface HAProxyHistoryRepository {
  record(entry: { action: HAProxyChangeAction; backend: string; server: HAProxyServer }): Promise<HAProxyChangeRecord>;
  list(): Promise<HAProxyChangeRecord[]>;
  get(id: string): Promise<HAProxyChangeRecord | null>;
  markReverted(id: string): Promise<void>;
}

export async function addServerWithHistory(client: Pick<HAProxyClient, 'addServer'>, repository: HAProxyHistoryRepository, backend: string, server: HAProxyServer): Promise<void> {
  await client.addServer(backend, server);
  await repository.record({ action: 'add_server', backend, server });
}

export async function deleteServerWithHistory(client: Pick<HAProxyClient, 'listServers' | 'deleteServer'>, repository: HAProxyHistoryRepository, backend: string, name: string): Promise<void> {
  const servers = await client.listServers(backend);
  const server = servers.find((candidate) => candidate.name === name);
  if (!server) throw new Error(`Server ${name} was not found on backend ${backend}`);
  await client.deleteServer(backend, name);
  await repository.record({ action: 'delete_server', backend, server });
}

/** Reverses a recorded change by re-applying its inverse operation against HAProxy. */
export async function rollbackChange(id: string, repository: HAProxyHistoryRepository, client: Pick<HAProxyClient, 'addServer' | 'deleteServer'>): Promise<void> {
  const record = await repository.get(id);
  if (!record) throw new Error('Unknown HAProxy change');
  if (record.revertedAt) throw new Error('This change was already reverted');
  if (record.action === 'add_server') await client.deleteServer(record.backend, record.server.name);
  else await client.addServer(record.backend, record.server);
  await repository.markReverted(id);
}
