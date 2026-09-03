import { parseAllDocuments } from 'yaml';

export interface CatalogEntityRef {
  kind?: string;
  namespace?: string;
  name: string;
}

export interface CatalogEntity {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    description?: string;
    annotations: Record<string, string>;
    links: Array<{ url: string; title?: string }>;
  };
  spec: {
    type: string;
    lifecycle: string;
    owner: string;
    system?: string;
    dependsOn: string[];
    providesApis: string[];
  };
}

/**
 * Parses a catalog-info.yaml file (possibly containing several `---`-separated
 * documents) into validated CatalogEntity records. Follows the Backstage
 * Component/API entity contract documented in docs/catalog-info-format.md:
 * apiVersion, kind, metadata.name, spec.type, spec.lifecycle and spec.owner
 * are mandatory; unknown annotations are preserved as-is.
 */
export function parseCatalogInfo(raw: string): CatalogEntity[] {
  return parseAllDocuments(raw)
    .filter((document) => document.contents !== null)
    .map((document, index) => {
      if (document.errors.length > 0) throw new Error(`catalog-info.yaml document ${index + 1} is not valid YAML: ${document.errors[0]?.message}`);
      return toEntity(document.toJS(), index);
    });
}

function toEntity(value: unknown, index: number): CatalogEntity {
  if (!value || typeof value !== 'object') throw new Error(`catalog-info.yaml document ${index + 1} must be a mapping`);
  const document = value as Record<string, unknown>;

  const apiVersion = requireString(document.apiVersion, `document ${index + 1}: apiVersion`);
  const kind = requireString(document.kind, `document ${index + 1}: kind`);

  const metadata = (document.metadata ?? {}) as Record<string, unknown>;
  const name = requireString(metadata.name, `document ${index + 1}: metadata.name`);

  const spec = (document.spec ?? {}) as Record<string, unknown>;
  const type = requireString(spec.type, `document ${index + 1} (${name}): spec.type`);
  const lifecycle = requireString(spec.lifecycle, `document ${index + 1} (${name}): spec.lifecycle`);
  const owner = requireString(spec.owner, `document ${index + 1} (${name}): spec.owner`);

  return {
    apiVersion,
    kind,
    metadata: {
      name,
      description: typeof metadata.description === 'string' ? metadata.description : undefined,
      annotations: isStringRecord(metadata.annotations) ? metadata.annotations : {},
      links: Array.isArray(metadata.links) ? metadata.links.filter(isLink) : [],
    },
    spec: {
      type,
      lifecycle,
      owner,
      system: typeof spec.system === 'string' ? spec.system : undefined,
      dependsOn: Array.isArray(spec.dependsOn) ? spec.dependsOn.filter((entry): entry is string => typeof entry === 'string') : [],
      providesApis: Array.isArray(spec.providesApis) ? spec.providesApis.filter((entry): entry is string => typeof entry === 'string') : [],
    },
  };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`catalog-info.yaml is missing required field ${field}`);
  return value;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return !!value && typeof value === 'object' && Object.values(value).every((entry) => typeof entry === 'string');
}

function isLink(value: unknown): value is { url: string; title?: string } {
  return !!value && typeof value === 'object' && typeof (value as { url?: unknown }).url === 'string';
}
