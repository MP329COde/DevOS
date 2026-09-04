import type { Bug, BugSeverity, PrismaClient } from '@prisma/client';

export interface CreateBugInput {
  title: string;
  description?: string;
  severity?: BugSeverity;
  environment?: string;
  versionAffected?: string;
  expectedBehavior?: string;
  observedBehavior?: string;
  reproSteps?: string;
  logs?: string;
  screenshots?: string[];
  releaseRef?: string;
  commitRef?: string;
  itemId?: string;
  devProjectId?: string;
}

export interface UpdateBugInput {
  title?: string;
  description?: string;
  severity?: BugSeverity;
  status?: string;
  environment?: string;
  versionAffected?: string;
  expectedBehavior?: string;
  observedBehavior?: string;
  reproSteps?: string;
  logs?: string;
  screenshots?: string[];
  releaseRef?: string;
  commitRef?: string;
  itemId?: string | null;
  devProjectId?: string | null;
}

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];

/**
 * Gère le modèle `Bug` distinct des `Item` (AM.5) : gravité, environnement, version affectée,
 * comportement attendu/observé, étapes de reproduction, logs/captures, lien release/commit.
 * `status` reste un texte libre (pas d'enum) pour rester compatible avec un workflow configurable
 * par projet (`WorkflowStatus`), comme sur `Item`.
 */
export class BugService {
  public constructor(private readonly database: PrismaClient) {}

  public list(filter?: { devProjectId?: string; status?: string }): Promise<Bug[]> {
    return this.database.bug.findMany({
      where: {
        ...(filter?.devProjectId ? { devProjectId: filter.devProjectId } : {}),
        ...(filter?.status ? { status: filter.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public get(id: string): Promise<Bug | null> {
    return this.database.bug.findUnique({ where: { id } });
  }

  public create(input: CreateBugInput): Promise<Bug> {
    const title = validTitle(input.title);
    const severity = validSeverity(input.severity);
    return this.database.bug.create({
      data: {
        title,
        severity,
        description: input.description,
        environment: input.environment,
        versionAffected: input.versionAffected,
        expectedBehavior: input.expectedBehavior,
        observedBehavior: input.observedBehavior,
        reproSteps: input.reproSteps,
        logs: input.logs,
        screenshots: input.screenshots ?? [],
        releaseRef: input.releaseRef,
        commitRef: input.commitRef,
        itemId: input.itemId,
        devProjectId: input.devProjectId,
      },
    });
  }

  public update(id: string, input: UpdateBugInput): Promise<Bug> {
    return this.database.bug.update({
      where: { id },
      data: {
        ...(input.title === undefined ? {} : { title: validTitle(input.title) }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.severity === undefined ? {} : { severity: validSeverity(input.severity) }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.environment === undefined ? {} : { environment: input.environment }),
        ...(input.versionAffected === undefined ? {} : { versionAffected: input.versionAffected }),
        ...(input.expectedBehavior === undefined ? {} : { expectedBehavior: input.expectedBehavior }),
        ...(input.observedBehavior === undefined ? {} : { observedBehavior: input.observedBehavior }),
        ...(input.reproSteps === undefined ? {} : { reproSteps: input.reproSteps }),
        ...(input.logs === undefined ? {} : { logs: input.logs }),
        ...(input.screenshots === undefined ? {} : { screenshots: input.screenshots }),
        ...(input.releaseRef === undefined ? {} : { releaseRef: input.releaseRef }),
        ...(input.commitRef === undefined ? {} : { commitRef: input.commitRef }),
        ...(input.itemId === undefined ? {} : { itemId: input.itemId }),
        ...(input.devProjectId === undefined ? {} : { devProjectId: input.devProjectId }),
      },
    });
  }

  public delete(id: string): Promise<Bug> {
    return this.database.bug.delete({ where: { id } });
  }
}

function validTitle(title: string): string {
  const normalized = title.trim();
  if (!normalized || normalized.length > 300) {
    throw new Error('Bug title must contain between 1 and 300 characters');
  }
  return normalized;
}

function validSeverity(severity: string | undefined): BugSeverity {
  if (severity === undefined) return 'medium' as BugSeverity;
  if (!VALID_SEVERITIES.includes(severity)) throw new Error('Bug severity must be one of low/medium/high/critical');
  return severity as BugSeverity;
}
