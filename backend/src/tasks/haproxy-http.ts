import { assertCan, type Role } from '../auth/permissions.js';
import type { HAProxyBackend, HAProxyFrontend, HAProxyServer } from '../integrations/haproxy.js';
import type { HAProxyChangeRecord } from '../integrations/haproxy-history.js';

export interface HAProxyHttpService {
  listBackends(): Promise<HAProxyBackend[]>;
  listFrontends(): Promise<HAProxyFrontend[]>;
  listServers(backend: string): Promise<HAProxyServer[]>;
  addServer(backend: string, server: HAProxyServer, role: Role): Promise<void>;
  deleteServer(backend: string, name: string, role: Role): Promise<void>;
  reload(role: Role): Promise<void>;
  listHistory(): Promise<HAProxyChangeRecord[]>;
  rollback(id: string, role: Role): Promise<void>;
}

export interface HAProxyHttpResponse {
  status: number;
  body: unknown;
}

export async function handleHAProxyRequest(method: string, path: string, body: unknown, role: Role | undefined, service: HAProxyHttpService): Promise<HAProxyHttpResponse> {
  try {
    if (method === 'GET' && path === '/api/haproxy/backends') return { status: 200, body: await service.listBackends() };
    if (method === 'GET' && path === '/api/haproxy/frontends') return { status: 200, body: await service.listFrontends() };

    const servers = path.match(/^\/api\/haproxy\/backends\/([^/]+)\/servers$/);
    if (method === 'GET' && servers) return { status: 200, body: await service.listServers(decodeURIComponent(servers[1])) };
    if (method === 'POST' && servers) {
      await service.addServer(decodeURIComponent(servers[1]), parseServer(body), requireRole(role));
      return { status: 201, body: { accepted: true } };
    }

    const server = path.match(/^\/api\/haproxy\/backends\/([^/]+)\/servers\/([^/]+)$/);
    if (method === 'DELETE' && server) {
      await service.deleteServer(decodeURIComponent(server[1]), decodeURIComponent(server[2]), requireRole(role));
      return { status: 204, body: null };
    }

    if (method === 'POST' && path === '/api/haproxy/reload') {
      await service.reload(requireRole(role));
      return { status: 202, body: { accepted: true } };
    }

    if (method === 'GET' && path === '/api/haproxy/history') return { status: 200, body: await service.listHistory() };

    const rollback = path.match(/^\/api\/haproxy\/history\/([^/]+)\/rollback$/);
    if (method === 'POST' && rollback) {
      await service.rollback(decodeURIComponent(rollback[1]), requireRole(role));
      return { status: 200, body: { accepted: true } };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid HAProxy request' } };
  }
}

function requireRole(role: Role | undefined): Role {
  if (!role) throw new Error('Authentication is required to manage HAProxy');
  assertCan(role, 'execute_infrastructure');
  return role;
}

function parseServer(body: unknown): HAProxyServer {
  if (!body || typeof body !== 'object') throw new Error('Invalid server payload');
  const input = body as Record<string, unknown>;
  if (typeof input.name !== 'string' || typeof input.address !== 'string' || typeof input.port !== 'number') {
    throw new Error('Server name, address and port are required');
  }
  return { name: input.name, address: input.address, port: input.port };
}
