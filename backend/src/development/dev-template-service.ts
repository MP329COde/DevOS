import type { DevTemplate, PrismaClient } from '@prisma/client';

export interface DevTemplateDependency {
  name: string;
  version: string;
}

export interface CreateDevTemplateInput {
  name: string;
  type: string;
  description?: string;
  technologies?: string[];
  dependencies?: DevTemplateDependency[];
  version?: string;
  environments?: string[];
  integrableTools?: string[];
  generatedItems?: string[];
  isDefault?: boolean;
  /** "custom" (créé dans DevOS, défaut) ou "community" (importé d'un registre/dépôt public). */
  source?: string;
  /** Registre du gabarit communautaire, ex. "npm", "github". */
  registry?: string;
  /** Identifiant à référencer côté projet créé : nom de paquet npm ou "org/repo" GitHub. */
  packageName?: string;
  /** URL du dépôt source du gabarit communautaire. */
  repositoryUrl?: string;
}

export type UpdateDevTemplateInput = Partial<CreateDevTemplateInput> & { active?: boolean };

export interface ListDevTemplatesOptions {
  includeInactive?: boolean;
  /** Filtre par type (ex. "api", "web-app"). */
  type?: string;
  /** Filtre par source ("custom" | "community"). */
  source?: string;
  /** Filtre : le template doit inclure cette technologie (ex. "node", "npm"). */
  technology?: string;
  /** Recherche texte libre sur le nom/description. */
  search?: string;
  sortBy?: 'name' | 'updatedAt' | 'version';
  sortDirection?: 'asc' | 'desc';
}

/**
 * Catalogue de templates du module Développement (section AM.3). Sert de base à l'assistant de
 * création de projet (AM.2) : chaque template décrit un gabarit réutilisable (technologies,
 * dépendances, environnements compatibles, outils intégrables, éléments générés) plutôt qu'un
 * service déjà déployé (voir `CatalogService`/`CatalogEntity` pour ça).
 */
export class DevTemplateService {
  public constructor(private readonly database: PrismaClient) {}

  /**
   * Liste filtrable/triable pour le catalogue (panel de gestion et sélecteur du wizard de
   * création de projet) : filtres par type, source (custom/community) et technologie, tri par
   * nom/version/dernière mise à jour. Sans options, conserve le comportement historique (tout,
   * trié par défaut puis nom).
   */
  public list(options: ListDevTemplatesOptions = {}): Promise<DevTemplate[]> {
    const { includeInactive = true, type, source, technology, search, sortBy, sortDirection = 'asc' } = options;
    return this.database.devTemplate.findMany({
      where: {
        ...(includeInactive ? {} : { active: true }),
        ...(type ? { type } : {}),
        ...(source ? { source } : {}),
        ...(technology ? { technologies: { has: technology } } : {}),
        ...(search
          ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] }
          : {}),
      },
      orderBy: sortBy
        ? [{ [sortBy]: sortDirection }]
        : [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  public get(id: string): Promise<DevTemplate | null> {
    return this.database.devTemplate.findUnique({ where: { id } });
  }

  public async create(input: CreateDevTemplateInput): Promise<DevTemplate> {
    const name = input.name.trim();
    if (!name) throw new Error('"name" est requis');
    const type = input.type.trim();
    if (!type) throw new Error('"type" est requis');

    if (input.isDefault) await this.clearDefault();

    return this.database.devTemplate.create({
      data: {
        name,
        type,
        description: input.description?.trim() || null,
        technologies: input.technologies ?? [],
        dependencies: (input.dependencies ?? []) as unknown as object,
        version: input.version?.trim() || '1.0.0',
        environments: input.environments ?? [],
        integrableTools: input.integrableTools ?? [],
        generatedItems: input.generatedItems ?? [],
        isDefault: Boolean(input.isDefault),
        active: true,
        source: input.source?.trim() || 'custom',
        registry: input.registry?.trim() || null,
        packageName: input.packageName?.trim() || null,
        repositoryUrl: input.repositoryUrl?.trim() || null,
      },
    });
  }

  /** Édition en place : ne change pas la version, contrairement à `createNewVersion`. */
  public async update(id: string, input: UpdateDevTemplateInput): Promise<DevTemplate> {
    if (input.isDefault) await this.clearDefault();

    return this.database.devTemplate.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.type !== undefined ? { type: input.type.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
        ...(input.technologies !== undefined ? { technologies: input.technologies } : {}),
        ...(input.dependencies !== undefined ? { dependencies: input.dependencies as unknown as object } : {}),
        ...(input.version !== undefined ? { version: input.version.trim() } : {}),
        ...(input.environments !== undefined ? { environments: input.environments } : {}),
        ...(input.integrableTools !== undefined ? { integrableTools: input.integrableTools } : {}),
        ...(input.generatedItems !== undefined ? { generatedItems: input.generatedItems } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.source !== undefined ? { source: input.source.trim() || 'custom' } : {}),
        ...(input.registry !== undefined ? { registry: input.registry.trim() || null } : {}),
        ...(input.packageName !== undefined ? { packageName: input.packageName.trim() || null } : {}),
        ...(input.repositoryUrl !== undefined ? { repositoryUrl: input.repositoryUrl.trim() || null } : {}),
      },
    });
  }

  /**
   * Publie une nouvelle version : crée une nouvelle ligne (nouvel id), reliée à l'ancienne via
   * `previousVersionId`, plutôt que d'écraser l'historique. Le template précédent est conservé
   * tel quel (toujours actif, sauf demande explicite de le désactiver côté appelant).
   */
  public async createNewVersion(id: string, nextVersion: string, changes: Partial<CreateDevTemplateInput> = {}): Promise<DevTemplate> {
    const previous = await this.database.devTemplate.findUnique({ where: { id } });
    if (!previous) throw new Error('Template introuvable');
    const version = nextVersion.trim();
    if (!version) throw new Error('"version" est requise pour la nouvelle version');

    if (changes.isDefault) await this.clearDefault();

    return this.database.devTemplate.create({
      data: {
        name: changes.name?.trim() || previous.name,
        type: changes.type?.trim() || previous.type,
        description: changes.description !== undefined ? (changes.description.trim() || null) : previous.description,
        technologies: changes.technologies ?? previous.technologies,
        dependencies: (changes.dependencies ?? (previous.dependencies as unknown as DevTemplateDependency[])) as unknown as object,
        version,
        environments: changes.environments ?? previous.environments,
        integrableTools: changes.integrableTools ?? previous.integrableTools,
        generatedItems: changes.generatedItems ?? previous.generatedItems,
        isDefault: Boolean(changes.isDefault),
        active: true,
        previousVersionId: previous.id,
        source: changes.source?.trim() || previous.source,
        registry: changes.registry !== undefined ? (changes.registry.trim() || null) : previous.registry,
        packageName: changes.packageName !== undefined ? (changes.packageName.trim() || null) : previous.packageName,
        repositoryUrl: changes.repositoryUrl !== undefined ? (changes.repositoryUrl.trim() || null) : previous.repositoryUrl,
      },
    });
  }

  /** Désactivation réversible : le template n'apparaît plus pour de nouveaux projets, sans suppression. */
  public setActive(id: string, active: boolean): Promise<DevTemplate> {
    return this.database.devTemplate.update({ where: { id }, data: { active } });
  }

  public async setDefault(id: string): Promise<DevTemplate> {
    await this.clearDefault();
    return this.database.devTemplate.update({ where: { id }, data: { isDefault: true } });
  }

  public delete(id: string): Promise<DevTemplate> {
    return this.database.devTemplate.delete({ where: { id } });
  }

  private async clearDefault(): Promise<void> {
    await this.database.devTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }
}
