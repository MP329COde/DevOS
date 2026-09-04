import type { DevProject, DevProjectStatus, PrismaClient } from '@prisma/client';

export interface DevProjectInput {
  name: string;
  description?: string | null;
  status?: DevProjectStatus;
  owner?: string | null;
  members?: string[];
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  deliveryGoal?: string | null;
}

/**
 * Placeholder shape returned for every "readiness" facet of a project dashboard that other
 * AM sub-waves will eventually populate for real (dernière version, pipeline, déploiement,
 * sécurité...). Until those modules exist, the dashboard must show "Non disponible" rather
 * than error or omit the section entirely (see AM.1 in TODO-refonte-2.md).
 */
export interface DevProjectDashboardSection {
  available: boolean;
  summary: string;
}

export interface DevProjectDashboard {
  project: DevProject;
  progress: { openTasks: number; totalTasks: number; percentDone: number | null };
  lastActivityAt: string | null;
  lastRelease: DevProjectDashboardSection;
  pipeline: DevProjectDashboardSection;
  deployment: DevProjectDashboardSection;
  openTasks: DevProjectDashboardSection;
  knownBugs: DevProjectDashboardSection;
  security: DevProjectDashboardSection;
}

const NOT_AVAILABLE: DevProjectDashboardSection = { available: false, summary: 'Non disponible' };

/**
 * CRUD + vue globale + dashboard pour l'entité "Projet de développement" (module Développement,
 * section AM). Les facettes dashboard qui dépendent de modules pas encore construits (versions,
 * pipeline, déploiement, sécurité — AM.6/AM.7) renvoient un placeholder explicite plutôt qu'une
 * erreur ou un champ manquant, pour que la page reste utilisable dès cette fondation.
 */
export class DevProjectService {
  public constructor(private readonly database: PrismaClient) {}

  public list(): Promise<DevProject[]> {
    return this.database.devProject.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  public get(id: string): Promise<DevProject | null> {
    return this.database.devProject.findUnique({ where: { id } });
  }

  public async create(input: DevProjectInput): Promise<DevProject> {
    const name = input.name?.trim();
    if (!name) throw new Error('"name" is required');
    return this.database.devProject.create({
      data: {
        name,
        description: input.description ?? null,
        status: input.status ?? 'planning',
        owner: input.owner ?? null,
        members: input.members ?? [],
        plannedStartAt: input.plannedStartAt ? new Date(input.plannedStartAt) : null,
        plannedEndAt: input.plannedEndAt ? new Date(input.plannedEndAt) : null,
        deliveryGoal: input.deliveryGoal ?? null,
      },
    });
  }

  public async update(id: string, input: Partial<DevProjectInput>): Promise<DevProject> {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) {
      if (!input.name.trim()) throw new Error('"name" cannot be empty');
      data.name = input.name.trim();
    }
    if (input.description !== undefined) data.description = input.description;
    if (input.status !== undefined) data.status = input.status;
    if (input.owner !== undefined) data.owner = input.owner;
    if (input.members !== undefined) data.members = input.members;
    if (input.plannedStartAt !== undefined) data.plannedStartAt = input.plannedStartAt ? new Date(input.plannedStartAt) : null;
    if (input.plannedEndAt !== undefined) data.plannedEndAt = input.plannedEndAt ? new Date(input.plannedEndAt) : null;
    if (input.deliveryGoal !== undefined) data.deliveryGoal = input.deliveryGoal;
    return this.database.devProject.update({ where: { id }, data });
  }

  public async delete(id: string): Promise<void> {
    await this.database.devProject.delete({ where: { id } });
  }

  /**
   * Résumé pour la vue globale (actifs / bloqués / en attente / terminés + recherche) :
   * un statut "blocked"/"waiting" n'existe pas encore comme tel sur DevProject (voir enum
   * DevProjectStatus), donc pour l'instant "development"+"maintenance" = actif, "planning" =
   * en attente, "done" = terminé, "archived" à part — cette vue reste extensible sans migration
   * si un vrai statut "bloqué" est ajouté plus tard (AM.5+).
   */
  public async overview(search?: string): Promise<{
    active: DevProject[];
    waiting: DevProject[];
    done: DevProject[];
    archived: DevProject[];
  }> {
    const all = await this.database.devProject.findMany({
      where: search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] }
        : undefined,
      orderBy: { updatedAt: 'desc' },
    });
    return {
      active: all.filter((p) => p.status === 'development' || p.status === 'maintenance'),
      waiting: all.filter((p) => p.status === 'planning'),
      done: all.filter((p) => p.status === 'done'),
      archived: all.filter((p) => p.status === 'archived'),
    };
  }

  public async dashboard(id: string): Promise<DevProjectDashboard | null> {
    const project = await this.database.devProject.findUnique({ where: { id } });
    if (!project) return null;

    const items = await this.database.item.findMany({ where: { devProjectId: id }, orderBy: { updatedAt: 'desc' } });
    const totalTasks = items.length;
    const openTasks = items.filter((item) => item.status !== 'done' && item.status !== 'cancelled').length;
    const percentDone = totalTasks > 0 ? Math.round(((totalTasks - openTasks) / totalTasks) * 100) : null;
    const lastActivityAt = items[0]?.updatedAt?.toISOString() ?? project.updatedAt.toISOString();

    return {
      project,
      progress: { openTasks, totalTasks, percentDone },
      lastActivityAt,
      lastRelease: NOT_AVAILABLE,
      pipeline: NOT_AVAILABLE,
      deployment: NOT_AVAILABLE,
      openTasks: totalTasks > 0 ? { available: true, summary: `${openTasks} tâche(s) ouverte(s) sur ${totalTasks}` } : NOT_AVAILABLE,
      knownBugs: NOT_AVAILABLE,
      security: NOT_AVAILABLE,
    };
  }
}
