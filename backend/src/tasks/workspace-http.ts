import type { CoderTemplate } from '../integrations/coder.js';
import type { OpenedWorkspace } from './workspace-service.js';

export interface WorkspaceHttpService {
  listTemplates(): Promise<CoderTemplate[]>;
  openEnvironment(itemId: string): Promise<OpenedWorkspace>;
}

export interface WorkspaceHttpResponse {
  status: number;
  body: unknown;
}

export async function handleWorkspaceRequest(method: string, path: string, service: WorkspaceHttpService): Promise<WorkspaceHttpResponse> {
  try {
    if (method === 'GET' && path === '/api/coder/templates') return { status: 200, body: await service.listTemplates() };

    const open = path.match(/^\/api\/items\/([^/]+)\/workspace$/);
    if (method === 'POST' && open) return { status: 201, body: await service.openEnvironment(decodeURIComponent(open[1])) };

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid workspace request' } };
  }
}
