import type { PrismaClient, ProjectResource } from '@prisma/client';

export interface ProjectResourceInput {
  name: string;
  type: string;
  host?: string | null;
  note?: string | null;
}

/**
 * Ressources externes rattachées à un `DevProject` à titre indicatif (base de données, cache,
 * bucket...) — pas de connexion réelle, un simple aide-mémoire pour l'équipe (voir le commentaire
 * sur `ProjectResource` dans schema.prisma).
 */
export class ProjectResourceService {
  public constructor(private readonly database: PrismaClient) {}

  public listResources(devProjectId: string): Promise<ProjectResource[]> {
    return this.database.projectResource.findMany({ where: { devProjectId }, orderBy: { createdAt: 'asc' } });
  }

  public async createResource(devProjectId: string, input: ProjectResourceInput): Promise<ProjectResource> {
    const name = input.name?.trim();
    const type = input.type?.trim();
    if (!name) throw new Error('"name" is required');
    if (!type) throw new Error('"type" is required');

    const project = await this.database.devProject.findUnique({ where: { id: devProjectId } });
    if (!project) throw new Error('Projet de développement introuvable');

    return this.database.projectResource.create({
      data: { devProjectId, name, type, host: input.host ?? null, note: input.note ?? null },
    });
  }

  public async deleteResource(devProjectId: string, resourceId: string): Promise<void> {
    const resource = await this.database.projectResource.findUnique({ where: { id: resourceId } });
    if (!resource || resource.devProjectId !== devProjectId) throw new Error('Ressource introuvable pour ce projet');
    await this.database.projectResource.delete({ where: { id: resourceId } });
  }
}
