import type { PrismaClient, Release, ReleaseState } from '@prisma/client';

export interface ReleaseInput {
  devProjectId: string;
  version: string;
  name?: string | null;
  description?: string | null;
  state?: ReleaseState;
  plannedAt?: string | null;
}

export type ReleaseUpdateInput = Partial<Omit<ReleaseInput, 'devProjectId'>>;

/**
 * Versions/releases d'un projet (section AM.6). `publish` est le seul chemin qui fait passer
 * une release à l'état `released` : il génère le changelog automatiquement à partir des `Item`
 * associés (figé en texte, pas recalculé après coup) et refuse de publier une release déjà
 * publiée ou sans aucun élément associé (validation avant publication demandée par le TODO).
 */
export class ReleaseService {
  public constructor(private readonly database: PrismaClient) {}

  public list(devProjectId?: string): Promise<Release[]> {
    return this.database.release.findMany({
      where: devProjectId ? { devProjectId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  public get(id: string): Promise<Release | null> {
    return this.database.release.findUnique({ where: { id } });
  }

  public async create(input: ReleaseInput): Promise<Release> {
    const version = input.version?.trim();
    if (!version) throw new Error('"version" is required');
    if (!input.devProjectId) throw new Error('"devProjectId" is required');
    return this.database.release.create({
      data: {
        devProjectId: input.devProjectId,
        version,
        name: input.name ?? null,
        description: input.description ?? null,
        state: input.state ?? 'draft',
        plannedAt: input.plannedAt ? new Date(input.plannedAt) : null,
      },
    });
  }

  public async update(id: string, input: ReleaseUpdateInput): Promise<Release> {
    const data: Record<string, unknown> = {};
    if (input.version !== undefined) {
      if (!input.version.trim()) throw new Error('"version" cannot be empty');
      data.version = input.version.trim();
    }
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.state !== undefined) data.state = input.state;
    if (input.plannedAt !== undefined) data.plannedAt = input.plannedAt ? new Date(input.plannedAt) : null;
    return this.database.release.update({ where: { id }, data });
  }

  public async delete(id: string): Promise<void> {
    await this.database.release.delete({ where: { id } });
  }

  /** Éléments (tâches/bugs) actuellement associés à une release, via `Item.releaseId`. */
  public associatedItems(releaseId: string) {
    return this.database.item.findMany({ where: { releaseId }, orderBy: { updatedAt: 'desc' } });
  }

  public async publish(id: string): Promise<Release> {
    const release = await this.database.release.findUnique({ where: { id } });
    if (!release) throw new Error('Release introuvable');
    if (release.state === 'released') throw new Error('Cette release est déjà publiée');
    const items = await this.database.item.findMany({ where: { releaseId: id }, orderBy: { createdAt: 'asc' } });
    if (items.length === 0) throw new Error('Impossible de publier une release sans élément associé');

    const changelog = items.map((item) => `- ${item.title} (${item.type}${item.status ? `, ${item.status}` : ''})`).join('\n');
    return this.database.release.update({
      where: { id },
      data: { state: 'released', releasedAt: new Date(), changelog },
    });
  }
}
