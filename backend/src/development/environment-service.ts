import type { Environment, EnvironmentKind, EnvironmentStatus, PrismaClient } from '@prisma/client';

export interface EnvironmentInput {
  devProjectId: string;
  name: string;
  kind?: EnvironmentKind;
  url?: string | null;
  expectedVersion?: string | null;
  requiresApproval?: boolean;
}

export interface EnvironmentUpdateInput {
  name?: string;
  kind?: EnvironmentKind;
  url?: string | null;
  status?: EnvironmentStatus;
  currentVersion?: string | null;
  expectedVersion?: string | null;
  pipelineStatus?: string | null;
  lastError?: string | null;
  requiresApproval?: boolean;
}

export interface DeployInput {
  version: string;
}

/**
 * Environnements de déploiement par projet (section AM.6) : dev/staging/prod/autre, avec statut,
 * version actuelle vs attendue (pour repérer un écart), pipeline et dernière erreur. `deploy` est
 * le seul chemin qui change `currentVersion` — la confirmation explicite pour les environnements
 * `prod` (ou marqués `requiresApproval`) est appliquée côté HTTP (voir environment-http.ts),
 * même pattern que les actions Proxmox sensibles (section Q).
 */
export class EnvironmentService {
  public constructor(private readonly database: PrismaClient) {}

  public list(devProjectId?: string): Promise<Environment[]> {
    return this.database.environment.findMany({
      where: devProjectId ? { devProjectId } : undefined,
      orderBy: [{ devProjectId: 'asc' }, { kind: 'asc' }],
    });
  }

  public get(id: string): Promise<Environment | null> {
    return this.database.environment.findUnique({ where: { id } });
  }

  public async create(input: EnvironmentInput): Promise<Environment> {
    const name = input.name?.trim();
    if (!name) throw new Error('"name" is required');
    if (!input.devProjectId) throw new Error('"devProjectId" is required');
    return this.database.environment.create({
      data: {
        devProjectId: input.devProjectId,
        name,
        kind: input.kind ?? 'other',
        url: input.url ?? null,
        expectedVersion: input.expectedVersion ?? null,
        requiresApproval: input.requiresApproval ?? (input.kind === 'prod'),
      },
    });
  }

  public async update(id: string, input: EnvironmentUpdateInput): Promise<Environment> {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) {
      if (!input.name.trim()) throw new Error('"name" cannot be empty');
      data.name = input.name.trim();
    }
    if (input.kind !== undefined) data.kind = input.kind;
    if (input.url !== undefined) data.url = input.url;
    if (input.status !== undefined) data.status = input.status;
    if (input.currentVersion !== undefined) data.currentVersion = input.currentVersion;
    if (input.expectedVersion !== undefined) data.expectedVersion = input.expectedVersion;
    if (input.pipelineStatus !== undefined) data.pipelineStatus = input.pipelineStatus;
    if (input.lastError !== undefined) data.lastError = input.lastError;
    if (input.requiresApproval !== undefined) data.requiresApproval = input.requiresApproval;
    return this.database.environment.update({ where: { id }, data });
  }

  public async delete(id: string): Promise<void> {
    await this.database.environment.delete({ where: { id } });
  }

  /** Applique un déploiement : met à jour la version courante et efface la dernière erreur. */
  public async deploy(id: string, input: DeployInput): Promise<Environment> {
    const version = input.version?.trim();
    if (!version) throw new Error('"version" is required to deploy');
    return this.database.environment.update({
      where: { id },
      data: { currentVersion: version, status: 'up', lastDeployedAt: new Date(), lastError: null },
    });
  }
}

/** Vrai quand la version déployée diffère de la version attendue (écart signalé côté AM.6). */
export function hasVersionDrift(environment: Pick<Environment, 'currentVersion' | 'expectedVersion'>): boolean {
  if (!environment.expectedVersion) return false;
  return environment.currentVersion !== environment.expectedVersion;
}
