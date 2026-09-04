/**
 * Widgets custom du Dashboard — section R de TODO-refonte-ux.md.
 *
 * Par sécurité, un widget custom ne fait jamais exécuter de code arbitraire côté serveur : il se
 * limite à choisir une source de données existante parmi les endpoints `/api/extras/*` déjà
 * exposés (voir `extras-http.ts`) et à afficher un champ précis de la réponse (liste JSON).
 */

/** Sources de données autorisées pour un widget custom : uniquement des endpoints /api/extras/* renvoyant un tableau. */
export const ALLOWED_CUSTOM_WIDGET_SOURCES: ReadonlyArray<{ path: string; label: string }> = [
  { path: '/api/extras/mcp/tools', label: 'Outils MCP' },
  { path: '/api/extras/grafana/dashboards', label: 'Tableaux de bord Grafana' },
  { path: '/api/extras/harbor/projects', label: 'Projets Harbor' },
  { path: '/api/extras/proxmox/nodes', label: 'Nœuds Proxmox' },
  { path: '/api/extras/minio/buckets', label: 'Buckets MinIO' },
  { path: '/api/extras/rabbitmq/queues', label: 'Files RabbitMQ' },
  { path: '/api/extras/rabbitmq/nodes', label: 'Nœuds RabbitMQ' },
  { path: '/api/extras/dns/zones', label: 'Zones DNS' },
  { path: '/api/extras/woodpecker/repos', label: 'Dépôts Woodpecker' },
  { path: '/api/extras/ollama/models', label: 'Modèles Ollama' },
  { path: '/api/extras/n8n/workflows', label: 'Workflows n8n' },
  { path: '/api/extras/nexus/repositories', label: 'Dépôts Nexus' },
  { path: '/api/extras/meilisearch/indexes', label: 'Index Meilisearch' },
  { path: '/api/extras/redpanda/brokers', label: 'Brokers Redpanda' },
  { path: '/api/extras/redpanda/topics', label: 'Topics Redpanda' },
];

export interface CustomWidget {
  id: string;
  title: string;
  sourcePath: string;
  dataKey: string;
  label: string;
}

export interface CustomWidgetsHttpService {
  list(): Promise<CustomWidget[]>;
  save(widget: CustomWidget): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface CustomWidgetsHttpResponse {
  status: number;
  body: unknown;
}

export async function handleCustomWidgetsRequest(
  method: string,
  path: string,
  body: unknown,
  service: CustomWidgetsHttpService,
): Promise<CustomWidgetsHttpResponse> {
  try {
    if (method === 'GET' && path === '/api/custom-widgets') {
      return { status: 200, body: await service.list() };
    }

    if (method === 'POST' && path === '/api/custom-widgets') {
      const widget = parseCustomWidget(body);
      await service.save(widget);
      return { status: 201, body: widget };
    }

    if (method === 'DELETE' && path.startsWith('/api/custom-widgets/')) {
      const id = decodeURIComponent(path.slice('/api/custom-widgets/'.length));
      if (!id) throw new Error('Missing widget id');
      await service.remove(id);
      return { status: 204, body: undefined };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid custom widget request' } };
  }
}

function parseCustomWidget(body: unknown): CustomWidget {
  if (!body || typeof body !== 'object') throw new Error('Missing custom widget payload');
  const b = body as Record<string, unknown>;
  if (typeof b.title !== 'string' || !b.title.trim()) throw new Error('"title" is required');
  if (typeof b.sourcePath !== 'string' || !ALLOWED_CUSTOM_WIDGET_SOURCES.some((source) => source.path === b.sourcePath)) {
    throw new Error('"sourcePath" must be one of the allowed /api/extras/* sources');
  }
  if (typeof b.dataKey !== 'string' || !b.dataKey.trim()) throw new Error('"dataKey" is required');
  if (typeof b.label !== 'string' || !b.label.trim()) throw new Error('"label" is required');
  const id = typeof b.id === 'string' && b.id.trim() ? b.id : `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, title: b.title, sourcePath: b.sourcePath, dataKey: b.dataKey, label: b.label };
}
