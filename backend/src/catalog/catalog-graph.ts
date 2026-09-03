import type { CatalogEntity } from './catalog-parser.js';

export interface CatalogGraphNode {
  id: string;
  kind: string;
  name: string;
  known: boolean;
}

export interface CatalogGraphEdge {
  from: string;
  to: string;
}

export interface CatalogGraph {
  nodes: CatalogGraphNode[];
  edges: CatalogGraphEdge[];
}

/**
 * Builds a dependsOn/providesApis graph from catalog entities. References follow the
 * Backstage entity-ref shape `kind:namespace/name` (namespace defaults to "default");
 * a `providesApis` entry is a bare API entity name, resolved as `api:default/<name>`.
 * A referenced entity that was never scanned still appears as a node (known: false)
 * so the graph stays complete even when a dependency lives outside the catalog.
 */
export function buildDependencyGraph(entities: readonly CatalogEntity[]): CatalogGraph {
  const nodes = new Map<string, CatalogGraphNode>();
  const edges: CatalogGraphEdge[] = [];

  const ensureNode = (ref: string, known: boolean): string => {
    const id = normalizeRef(ref);
    const existing = nodes.get(id);
    if (existing) {
      if (known) existing.known = true;
      return id;
    }
    const [kind, rest] = id.split(':');
    const name = rest.split('/').pop() ?? rest;
    nodes.set(id, { id, kind, name, known });
    return id;
  };

  for (const entity of entities) {
    const sourceId = ensureNode(`${entity.kind.toLowerCase()}:default/${entity.metadata.name}`, true);
    for (const dependency of entity.spec.dependsOn) {
      const targetId = ensureNode(dependency, false);
      edges.push({ from: sourceId, to: targetId });
    }
    for (const api of entity.spec.providesApis) {
      const targetId = ensureNode(`api:default/${api}`, false);
      edges.push({ from: sourceId, to: targetId });
    }
  }

  return { nodes: [...nodes.values()], edges };
}

function normalizeRef(ref: string): string {
  if (ref.includes(':')) return ref;
  return `component:default/${ref}`;
}
