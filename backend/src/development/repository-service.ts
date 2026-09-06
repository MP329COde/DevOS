import type { CiCdProvider, DevProjectCiCdConfig, PrismaClient } from '@prisma/client';

import { createGitLabProject, type GitLabPipelinesClientOptions } from '../integrations/gitlab-pipelines.js';
import { GitHubClient } from '../integrations/github.js';
import type { TimelineEventService } from './timeline-event-service.js';

export interface LinkRepoInput {
  provider: CiCdProvider;
  repoIdentifier: string;
  role: string;
  name?: string | null;
  webUrl?: string | null;
  defaultBranch?: string | null;
  vaultSecretName: string;
  argoAppName?: string | null;
  harborProject?: string | null;
  harborRepo?: string | null;
}

export interface CreateRepoInput {
  provider: CiCdProvider;
  name: string;
  role: string;
  vaultSecretName: string;
}

/**
 * Clients CI/CD injectés au service pour la création réelle de dépôts distants (AM.7+). Repris
 * tels quels des intégrations existantes (`gitlab-pipelines.ts`, `github.ts`) — ce service ne
 * refait pas d'appel HTTP directement, il orchestre uniquement.
 */
export interface RepositoryProviderClients {
  gitlab?: GitLabPipelinesClientOptions;
  github?: GitHubClient;
}

/**
 * Gère les dépôts (potentiellement plusieurs) liés à un `DevProject` (AM.7+). Historiquement un
 * projet n'avait qu'un seul dépôt CI/CD (`DevProjectCiCdConfig` était `@unique` sur
 * `devProjectId`) ; ce service généralise à plusieurs dépôts par rôle (backend/frontend/infra...).
 */
export class RepositoryService {
  public constructor(
    private readonly database: PrismaClient,
    private readonly providers: RepositoryProviderClients = {},
    private readonly timelineEvents?: TimelineEventService,
  ) {}

  public listRepositories(devProjectId: string): Promise<DevProjectCiCdConfig[]> {
    return this.database.devProjectCiCdConfig.findMany({ where: { devProjectId }, orderBy: { createdAt: 'asc' } });
  }

  public async linkExistingRepo(devProjectId: string, input: LinkRepoInput, actorEmail?: string): Promise<DevProjectCiCdConfig> {
    const repoIdentifier = input.repoIdentifier?.trim();
    const role = input.role?.trim();
    const vaultSecretName = input.vaultSecretName?.trim();
    if (!repoIdentifier) throw new Error('"repoIdentifier" is required');
    if (!role) throw new Error('"role" is required');
    if (!vaultSecretName) throw new Error('"vaultSecretName" is required');
    if (!input.provider) throw new Error('"provider" is required');

    const project = await this.database.devProject.findUnique({ where: { id: devProjectId } });
    if (!project) throw new Error('Projet de développement introuvable');

    const config = await this.database.devProjectCiCdConfig.create({
      data: {
        devProjectId,
        provider: input.provider,
        repoIdentifier,
        role,
        name: input.name ?? null,
        webUrl: input.webUrl ?? null,
        defaultBranch: input.defaultBranch ?? null,
        vaultSecretName,
        argoAppName: input.argoAppName ?? null,
        harborProject: input.harborProject ?? null,
        harborRepo: input.harborRepo ?? null,
      },
    });

    await this.timelineEvents?.record({
      type: 'repository.linked',
      summary: `Dépôt ${repoIdentifier} (${role}) lié au projet`,
      actorEmail,
      devProjectId,
    });

    return config;
  }

  public async unlinkRepo(devProjectId: string, cicdConfigId: string): Promise<void> {
    const config = await this.database.devProjectCiCdConfig.findUnique({ where: { id: cicdConfigId } });
    if (!config || config.devProjectId !== devProjectId) throw new Error('Dépôt introuvable pour ce projet');
    await this.database.devProjectCiCdConfig.delete({ where: { id: cicdConfigId } });
  }

  /**
   * Crée un dépôt distant vide via l'API GitLab/GitHub puis le lie au projet. Refuse si le
   * client provider correspondant n'est pas configuré (pas de fallback silencieux).
   */
  public async createRepoAndLink(devProjectId: string, input: CreateRepoInput, actorEmail?: string): Promise<DevProjectCiCdConfig> {
    const name = input.name?.trim();
    const role = input.role?.trim();
    const vaultSecretName = input.vaultSecretName?.trim();
    if (!name) throw new Error('"name" is required');
    if (!role) throw new Error('"role" is required');
    if (!vaultSecretName) throw new Error('"vaultSecretName" is required');

    const project = await this.database.devProject.findUnique({ where: { id: devProjectId } });
    if (!project) throw new Error('Projet de développement introuvable');

    let repoIdentifier: string;
    let webUrl: string | null = null;
    let defaultBranch: string | null = null;

    if (input.provider === 'gitlab') {
      if (!this.providers.gitlab) throw new Error('GitLab n\'est pas configuré');
      const created = await createGitLabProject(this.providers.gitlab, name);
      repoIdentifier = created.path_with_namespace;
      webUrl = created.web_url;
      defaultBranch = created.default_branch;
    } else if (input.provider === 'github') {
      if (!this.providers.github) throw new Error('GitHub n\'est pas configuré');
      const created = await this.providers.github.createRepo(name);
      repoIdentifier = created.full_name;
      webUrl = created.html_url;
      defaultBranch = created.default_branch;
    } else {
      throw new Error('Fournisseur CI/CD inconnu');
    }

    const config = await this.database.devProjectCiCdConfig.create({
      data: {
        devProjectId,
        provider: input.provider,
        repoIdentifier,
        role,
        name,
        webUrl,
        defaultBranch,
        vaultSecretName,
      },
    });

    await this.timelineEvents?.record({
      type: 'repository.created',
      summary: `Dépôt ${repoIdentifier} (${role}) créé et lié au projet`,
      actorEmail,
      devProjectId,
    });

    return config;
  }
}
