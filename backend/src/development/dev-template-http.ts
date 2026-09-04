import type { CreateDevTemplateInput, DevTemplateDependency, UpdateDevTemplateInput } from './dev-template-service.js';

export interface DevTemplateHttpService {
  list(): Promise<unknown>;
  get(id: string): Promise<unknown>;
  create(input: CreateDevTemplateInput): Promise<unknown>;
  update(id: string, input: UpdateDevTemplateInput): Promise<unknown>;
  createNewVersion(id: string, nextVersion: string, changes: Partial<CreateDevTemplateInput>): Promise<unknown>;
  setActive(id: string, active: boolean): Promise<unknown>;
  setDefault(id: string): Promise<unknown>;
  delete(id: string): Promise<unknown>;
}

export interface DevTemplateHttpResponse {
  status: number;
  body: unknown;
}

export async function handleDevTemplateRequest(method: string, path: string, body: unknown, service: DevTemplateHttpService): Promise<DevTemplateHttpResponse> {
  try {
    if (method === 'GET' && path === '/api/dev/templates') return { status: 200, body: await service.list() };
    if (method === 'POST' && path === '/api/dev/templates') return { status: 201, body: await service.create(parseCreateInput(body)) };

    const item = path.match(/^\/api\/dev\/templates\/([^/]+)$/);
    if (item) {
      const id = decodeURIComponent(item[1]);
      if (method === 'GET') {
        const found = await service.get(id);
        return found ? { status: 200, body: found } : { status: 404, body: { error: 'Not found' } };
      }
      if (method === 'PATCH') return { status: 200, body: await service.update(id, parseUpdateInput(body)) };
      if (method === 'DELETE') { await service.delete(id); return { status: 204, body: null }; }
    }

    const version = path.match(/^\/api\/dev\/templates\/([^/]+)\/versions$/);
    if (method === 'POST' && version) {
      const { nextVersion, changes } = parseVersionInput(body);
      return { status: 201, body: await service.createNewVersion(decodeURIComponent(version[1]), nextVersion, changes) };
    }

    const active = path.match(/^\/api\/dev\/templates\/([^/]+)\/active$/);
    if (method === 'PATCH' && active) {
      return { status: 200, body: await service.setActive(decodeURIComponent(active[1]), parseActiveFlag(body)) };
    }

    const setDefault = path.match(/^\/api\/dev\/templates\/([^/]+)\/default$/);
    if (method === 'POST' && setDefault) {
      return { status: 200, body: await service.setDefault(decodeURIComponent(setDefault[1])) };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid dev template request' } };
  }
}

function parseCreateInput(body: unknown): CreateDevTemplateInput {
  if (!body || typeof body !== 'object') throw new Error('Corps de requête manquant');
  const b = body as Record<string, unknown>;
  if (typeof b.name !== 'string' || !b.name.trim()) throw new Error('"name" est requis');
  if (typeof b.type !== 'string' || !b.type.trim()) throw new Error('"type" est requis');
  return {
    name: b.name,
    type: b.type,
    description: typeof b.description === 'string' ? b.description : undefined,
    technologies: parseStringArray(b.technologies),
    dependencies: parseDependencies(b.dependencies),
    version: typeof b.version === 'string' ? b.version : undefined,
    environments: parseStringArray(b.environments),
    integrableTools: parseStringArray(b.integrableTools),
    generatedItems: parseStringArray(b.generatedItems),
    isDefault: typeof b.isDefault === 'boolean' ? b.isDefault : undefined,
  };
}

function parseUpdateInput(body: unknown): UpdateDevTemplateInput {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  return {
    name: typeof b.name === 'string' ? b.name : undefined,
    type: typeof b.type === 'string' ? b.type : undefined,
    description: typeof b.description === 'string' ? b.description : undefined,
    technologies: parseStringArray(b.technologies),
    dependencies: parseDependencies(b.dependencies),
    version: typeof b.version === 'string' ? b.version : undefined,
    environments: parseStringArray(b.environments),
    integrableTools: parseStringArray(b.integrableTools),
    generatedItems: parseStringArray(b.generatedItems),
    isDefault: typeof b.isDefault === 'boolean' ? b.isDefault : undefined,
    active: typeof b.active === 'boolean' ? b.active : undefined,
  };
}

function parseVersionInput(body: unknown): { nextVersion: string; changes: Partial<CreateDevTemplateInput> } {
  if (!body || typeof body !== 'object') throw new Error('Corps de requête manquant');
  const b = body as Record<string, unknown>;
  if (typeof b.version !== 'string' || !b.version.trim()) throw new Error('"version" est requise');
  return {
    nextVersion: b.version,
    changes: {
      name: typeof b.name === 'string' ? b.name : undefined,
      type: typeof b.type === 'string' ? b.type : undefined,
      description: typeof b.description === 'string' ? b.description : undefined,
      technologies: parseStringArray(b.technologies),
      dependencies: parseDependencies(b.dependencies),
      environments: parseStringArray(b.environments),
      integrableTools: parseStringArray(b.integrableTools),
      generatedItems: parseStringArray(b.generatedItems),
      isDefault: typeof b.isDefault === 'boolean' ? b.isDefault : undefined,
    },
  };
}

function parseActiveFlag(body: unknown): boolean {
  if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).active !== 'boolean') throw new Error('"active" (boolean) est requis');
  return (body as Record<string, boolean>).active;
}

function parseStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('Un tableau de chaînes est attendu');
  return value.map((entry) => String(entry));
}

function parseDependencies(value: unknown): DevTemplateDependency[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('"dependencies" doit être un tableau');
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new Error('Chaque dépendance doit être un objet {name, version}');
    const e = entry as Record<string, unknown>;
    if (typeof e.name !== 'string' || !e.name.trim()) throw new Error('Chaque dépendance nécessite un "name"');
    return { name: e.name, version: typeof e.version === 'string' ? e.version : '' };
  });
}
