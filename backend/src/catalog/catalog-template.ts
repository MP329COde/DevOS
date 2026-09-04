import type { CatalogEntity } from './catalog-parser.js';

export interface CreateProjectFromTemplateInput {
  name: string;
  owner?: string;
  description?: string;
}

export interface CreateProjectFromTemplateResult {
  entity: CatalogEntity;
  /** The generated catalog-info.yaml document as text, for review before it is saved or copied into a repository. */
  yaml: string;
}

/**
 * Builds a new catalog-info.yaml document from an existing template entity, without contacting
 * GitLab: the caller decides separately, with an explicit confirmation step, whether/how the
 * result gets persisted or pushed anywhere.
 */
export function createProjectFromTemplate(template: CatalogEntity, input: CreateProjectFromTemplateInput): CreateProjectFromTemplateResult {
  const name = input.name.trim();
  if (!name) throw new Error('Le nom du nouveau projet est requis');

  const entity: CatalogEntity = {
    apiVersion: template.apiVersion,
    kind: template.kind,
    metadata: {
      name,
      description: input.description?.trim() || template.metadata.description,
      annotations: { ...template.metadata.annotations },
      links: [...template.metadata.links],
    },
    spec: {
      type: template.spec.type,
      lifecycle: template.spec.lifecycle,
      owner: input.owner?.trim() || template.spec.owner,
      system: template.spec.system,
      dependsOn: [...template.spec.dependsOn],
      providesApis: [...template.spec.providesApis],
    },
  };

  return { entity, yaml: toYaml(entity) };
}

function toYaml(entity: CatalogEntity): string {
  const lines = [`apiVersion: ${entity.apiVersion}`, `kind: ${entity.kind}`, 'metadata:', `  name: ${entity.metadata.name}`];
  if (entity.metadata.description) lines.push(`  description: ${entity.metadata.description}`);
  if (Object.keys(entity.metadata.annotations).length > 0) {
    lines.push('  annotations:');
    for (const [key, value] of Object.entries(entity.metadata.annotations)) lines.push(`    ${key}: ${value}`);
  }
  lines.push('spec:', `  type: ${entity.spec.type}`, `  lifecycle: ${entity.spec.lifecycle}`, `  owner: ${entity.spec.owner}`);
  if (entity.spec.system) lines.push(`  system: ${entity.spec.system}`);
  if (entity.spec.dependsOn.length > 0) lines.push('  dependsOn:', ...entity.spec.dependsOn.map((dep) => `    - ${dep}`));
  if (entity.spec.providesApis.length > 0) lines.push('  providesApis:', ...entity.spec.providesApis.map((api) => `    - ${api}`));
  return `${lines.join('\n')}\n`;
}
