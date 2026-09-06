import type {
  AiStubResponse,
  ArchitectureGraph,
  DevIntegrationStatus,
  LifecycleView,
  PersonalDashboard,
  SearchResult,
  TimelineEntry,
} from './dev-activity-service.js';
import { assertCan, type Role } from '../auth/permissions.js';
import type { TimelineEventInput } from './timeline-event-service.js';

export interface DevActivityHttpService {
  timeline(filter: {
    devProjectId?: string;
    itemId?: string;
    releaseId?: string;
    environmentId?: string;
    type?: TimelineEntry['type'];
    from?: string;
    to?: string;
  }): Promise<TimelineEntry[]>;
  recordEvent(input: TimelineEventInput): Promise<unknown>;
  projectDocs(devProjectId: string): Promise<unknown>;
  createProjectDoc(devProjectId: string, title: string, content: string): Promise<unknown>;
  architecture(devProjectId: string): Promise<ArchitectureGraph>;
  members(devProjectId: string): Promise<unknown>;
  integrationsStatus(): DevIntegrationStatus[];
  search(query: string): Promise<SearchResult[]>;
  assistantQuery(prompt: string, devProjectId?: string): AiStubResponse;
  agentAction(action: string, devProjectId?: string): AiStubResponse;
  lifecycle(itemId: string): Promise<LifecycleView | null>;
  personalDashboard(member: string): Promise<PersonalDashboard>;
}

export interface DevActivityHttpResponse {
  status: number;
  body: unknown;
}

/** Routes REST du module Développement — section AM.8. Préfixe `/api/dev-activity`. */
export async function handleDevActivityRequest(method: string, url: string, body: unknown, service: DevActivityHttpService, role?: Role): Promise<DevActivityHttpResponse> {
  try {
    const [path, query] = url.split('?');
    const params = new URLSearchParams(query ?? '');

    if (method === 'GET' && path === '/api/dev-activity/timeline') {
      const type = params.get('type') as TimelineEntry['type'] | null;
      return {
        status: 200,
        body: await service.timeline({
          devProjectId: params.get('devProjectId') ?? undefined,
          itemId: params.get('itemId') ?? undefined,
          releaseId: params.get('releaseId') ?? undefined,
          environmentId: params.get('environmentId') ?? undefined,
          type: type ?? undefined,
          from: params.get('from') ?? undefined,
          to: params.get('to') ?? undefined,
        }),
      };
    }

    if (method === 'POST' && path === '/api/dev-activity/events') {
      if (!role) throw new Error('Authentication is required to record a timeline event');
      assertCan(role, 'create');
      return { status: 201, body: await service.recordEvent(parseTimelineEvent(body)) };
    }

    const docs = path.match(/^\/api\/dev-activity\/projects\/([^/]+)\/docs$/);
    if (docs && method === 'GET') return { status: 200, body: await service.projectDocs(decodeURIComponent(docs[1])) };
    if (docs && method === 'POST') {
      const { title, content } = parseDoc(body);
      return { status: 201, body: await service.createProjectDoc(decodeURIComponent(docs[1]), title, content) };
    }

    const architecture = path.match(/^\/api\/dev-activity\/projects\/([^/]+)\/architecture$/);
    if (method === 'GET' && architecture) return { status: 200, body: await service.architecture(decodeURIComponent(architecture[1])) };

    const members = path.match(/^\/api\/dev-activity\/projects\/([^/]+)\/members$/);
    if (method === 'GET' && members) return { status: 200, body: await service.members(decodeURIComponent(members[1])) };

    if (method === 'GET' && path === '/api/dev-activity/integrations') return { status: 200, body: service.integrationsStatus() };

    if (method === 'GET' && path === '/api/dev-activity/search') {
      return { status: 200, body: await service.search(params.get('q') ?? '') };
    }

    if (method === 'POST' && path === '/api/dev-activity/assistant') {
      const { prompt, devProjectId } = parsePrompt(body);
      return { status: 200, body: service.assistantQuery(prompt, devProjectId) };
    }

    if (method === 'POST' && path === '/api/dev-activity/agent') {
      const { action, devProjectId } = parseAgentAction(body);
      return { status: 200, body: service.agentAction(action, devProjectId) };
    }

    const lifecycle = path.match(/^\/api\/dev-activity\/items\/([^/]+)\/lifecycle$/);
    if (method === 'GET' && lifecycle) {
      const found = await service.lifecycle(decodeURIComponent(lifecycle[1]));
      return found ? { status: 200, body: found } : { status: 404, body: { error: 'Not found' } };
    }

    if (method === 'GET' && path === '/api/dev-activity/dashboard') {
      const member = params.get('member');
      if (!member) throw new Error('"member" query param is required');
      return { status: 200, body: await service.personalDashboard(member) };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid dev activity request' } };
  }
}

function parseDoc(body: unknown): { title: string; content: string } {
  if (!body || typeof body !== 'object') throw new Error('Missing doc payload');
  const b = body as Record<string, unknown>;
  if (typeof b.title !== 'string' || !b.title.trim()) throw new Error('"title" is required');
  if (typeof b.content !== 'string' || !b.content.trim()) throw new Error('"content" is required');
  return { title: b.title, content: b.content };
}

function parsePrompt(body: unknown): { prompt: string; devProjectId?: string } {
  if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).prompt !== 'string') throw new Error('"prompt" is required');
  const b = body as Record<string, unknown>;
  return { prompt: b.prompt as string, devProjectId: typeof b.devProjectId === 'string' ? b.devProjectId : undefined };
}

function parseTimelineEvent(body: unknown): TimelineEventInput {
  if (!body || typeof body !== 'object') throw new Error('Missing timeline event payload');
  const b = body as Record<string, unknown>;
  if (typeof b.type !== 'string' || !b.type.trim()) throw new Error('"type" is required');
  if (typeof b.summary !== 'string' || !b.summary.trim()) throw new Error('"summary" is required');
  const optionalString = (key: string): string | undefined => (typeof b[key] === 'string' ? (b[key] as string) : undefined);
  return {
    type: b.type,
    summary: b.summary,
    status: optionalString('status'),
    actorEmail: optionalString('actorEmail'),
    actorName: optionalString('actorName'),
    devProjectId: optionalString('devProjectId'),
    itemId: optionalString('itemId'),
    releaseId: optionalString('releaseId'),
    environmentId: optionalString('environmentId'),
    commitRef: optionalString('commitRef'),
    pipelineRef: optionalString('pipelineRef'),
    version: optionalString('version'),
    metadata: b.metadata && typeof b.metadata === 'object' ? (b.metadata as Record<string, unknown>) : undefined,
  };
}

function parseAgentAction(body: unknown): { action: string; devProjectId?: string } {
  if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).action !== 'string') throw new Error('"action" is required');
  const b = body as Record<string, unknown>;
  return { action: b.action as string, devProjectId: typeof b.devProjectId === 'string' ? b.devProjectId : undefined };
}
