import type { PrismaClient, TimelineEvent } from '@prisma/client';

/**
 * Types d'évènements connus de la timeline unifiée. Reste une simple liste de constantes (le champ
 * `type` en base est du texte libre) plutôt qu'un enum Prisma, pour pouvoir brancher un nouvel outil
 * CI/CD sans migration — voir le commentaire sur `TimelineEvent` dans schema.prisma.
 */
export const TIMELINE_EVENT_TYPES = [
  'commit',
  'pipeline_started',
  'pipeline_finished',
  'tests',
  'image_published',
  'security_scan',
  'manifest_updated',
  'argocd_sync',
  'deployment_healthy',
  'release_published',
  'platform_update',
  'item_created',
  'item_updated',
  'comment',
  'repository.linked',
  'repository.created',
] as const;
export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number] | (string & {});

export interface TimelineEventInput {
  type: TimelineEventType;
  summary: string;
  status?: string;
  actorEmail?: string;
  actorName?: string;
  devProjectId?: string;
  itemId?: string;
  releaseId?: string;
  environmentId?: string;
  commitRef?: string;
  pipelineRef?: string;
  version?: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineEventFilter {
  devProjectId?: string;
  itemId?: string;
  releaseId?: string;
  environmentId?: string;
  type?: string;
  from?: string;
  to?: string;
}

/**
 * Persiste et interroge les évènements de la timeline unifiée (voir `TimelineEvent` dans
 * schema.prisma). Chaque évènement est relié aux entités qu'il concerne (projet, tâche, release,
 * environnement) et porte les identifiants texte libre qui n'ont pas de table dédiée (commit,
 * pipeline, version) : c'est ce qui permet de reconstituer la chaîne "commit -> pipeline -> image
 * -> scan -> manifest -> sync -> déploiement" a posteriori.
 */
export class TimelineEventService {
  public constructor(private readonly database: PrismaClient) {}

  public record(input: TimelineEventInput): Promise<TimelineEvent> {
    const summary = input.summary.trim();
    if (!summary) throw new Error('"summary" is required');
    if (!input.type || !String(input.type).trim()) throw new Error('"type" is required');
    return this.database.timelineEvent.create({
      data: {
        type: input.type,
        summary,
        status: input.status,
        actorEmail: input.actorEmail,
        actorName: input.actorName,
        devProjectId: input.devProjectId,
        itemId: input.itemId,
        releaseId: input.releaseId,
        environmentId: input.environmentId,
        commitRef: input.commitRef,
        pipelineRef: input.pipelineRef,
        version: input.version,
        metadata: input.metadata as never,
      },
    });
  }

  public query(filter: TimelineEventFilter = {}): Promise<TimelineEvent[]> {
    const from = filter.from ? new Date(filter.from) : undefined;
    const to = filter.to ? new Date(filter.to) : undefined;
    return this.database.timelineEvent.findMany({
      where: {
        devProjectId: filter.devProjectId,
        itemId: filter.itemId,
        releaseId: filter.releaseId,
        environmentId: filter.environmentId,
        type: filter.type,
        createdAt: from || to ? { gte: from, lte: to } : undefined,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
