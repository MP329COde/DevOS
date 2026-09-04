import type { CatalogEntity as PrismaCatalogEntity, PrismaClient } from '@prisma/client';

import { buildDependencyGraph, type CatalogGraph } from './catalog-graph.js';
import type { CatalogEntity } from './catalog-parser.js';
import { createProjectFromTemplate, type CreateProjectFromTemplateInput, type CreateProjectFromTemplateResult } from './catalog-template.js';

export class CatalogService {
  public constructor(private readonly database: PrismaClient) {}

  /** Replaces the persisted catalog with the given scan result (upsert by kind+name). */
  public async sync(entities: ReadonlyArray<CatalogEntity & { sourceProject: string }>): Promise<PrismaCatalogEntity[]> {
    return Promise.all(entities.map((entity) => this.database.catalogEntity.upsert({
      where: { kind_name: { kind: entity.kind, name: entity.metadata.name } },
      create: {
        kind: entity.kind,
        name: entity.metadata.name,
        sourceProject: entity.sourceProject,
        description: entity.metadata.description,
        type: entity.spec.type,
        lifecycle: entity.spec.lifecycle,
        owner: entity.spec.owner,
        system: entity.spec.system,
        dependsOn: entity.spec.dependsOn,
        providesApis: entity.spec.providesApis,
        annotations: entity.metadata.annotations,
        links: entity.metadata.links,
      },
      update: {
        sourceProject: entity.sourceProject,
        description: entity.metadata.description,
        type: entity.spec.type,
        lifecycle: entity.spec.lifecycle,
        owner: entity.spec.owner,
        system: entity.spec.system,
        dependsOn: entity.spec.dependsOn,
        providesApis: entity.spec.providesApis,
        annotations: entity.metadata.annotations,
        links: entity.metadata.links,
      },
    })));
  }

  public list(): Promise<PrismaCatalogEntity[]> {
    return this.database.catalogEntity.findMany({ orderBy: { name: 'asc' } });
  }

  public async graph(): Promise<CatalogGraph> {
    const rows = await this.list();
    return buildDependencyGraph(rows.map(toCatalogEntity));
  }

  /**
   * Generates a new catalog entity from an existing template entity and persists it as a draft
   * (sourceProject records it as not-yet-pushed). Never contacts GitLab — creating the project's
   * actual repository/catalog-info.yaml file remains a manual, explicitly-confirmed step.
   */
  public async createFromTemplate(templateKind: string, templateName: string, input: CreateProjectFromTemplateInput): Promise<CreateProjectFromTemplateResult> {
    const rows = await this.list();
    const templateRow = rows.find((row) => row.kind === templateKind && row.name === templateName);
    if (!templateRow) throw new Error(`Modèle inconnu : ${templateKind}/${templateName}`);

    const result = createProjectFromTemplate(toCatalogEntity(templateRow), input);

    await this.database.catalogEntity.create({
      data: {
        kind: result.entity.kind,
        name: result.entity.metadata.name,
        sourceProject: '(brouillon — non poussé vers GitLab)',
        description: result.entity.metadata.description,
        type: result.entity.spec.type,
        lifecycle: result.entity.spec.lifecycle,
        owner: result.entity.spec.owner,
        system: result.entity.spec.system,
        dependsOn: result.entity.spec.dependsOn,
        providesApis: result.entity.spec.providesApis,
        annotations: result.entity.metadata.annotations,
        links: result.entity.metadata.links,
      },
    });

    return result;
  }
}

function toCatalogEntity(row: PrismaCatalogEntity): CatalogEntity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: row.kind,
    metadata: {
      name: row.name,
      description: row.description ?? undefined,
      annotations: (row.annotations ?? {}) as Record<string, string>,
      links: (row.links ?? []) as Array<{ url: string; title?: string }>,
    },
    spec: {
      type: row.type,
      lifecycle: row.lifecycle,
      owner: row.owner,
      system: row.system ?? undefined,
      dependsOn: row.dependsOn,
      providesApis: row.providesApis,
    },
  };
}
