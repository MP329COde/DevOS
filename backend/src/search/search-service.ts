import type { PrismaClient } from '@prisma/client';

/**
 * Recherche globale (barre de recherche du header) : agrège les items (tâches/bugs/notes/docs)
 * et les projets de développement dont le titre/nom contient la requête. Reste volontairement
 * simple (ILIKE via `contains`/`mode: insensitive`) — pas de moteur d'indexation dédié, le volume
 * de données ne le justifie pas encore.
 */
export interface SearchResultItem {
  kind: 'item' | 'project';
  id: string;
  title: string;
  subtitle?: string;
}

export class SearchService {
  public constructor(private readonly database: PrismaClient) {}

  public async search(query: string, limit = 6): Promise<SearchResultItem[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const [items, projects] = await Promise.all([
      this.database.item.findMany({
        where: { title: { contains: trimmed, mode: 'insensitive' } },
        select: { id: true, title: true, type: true, status: true },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.database.devProject.findMany({
        where: { name: { contains: trimmed, mode: 'insensitive' } },
        select: { id: true, name: true, status: true },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return [
      ...items.map((item): SearchResultItem => ({ kind: 'item', id: item.id, title: item.title, subtitle: `${item.type} · ${item.status}` })),
      ...projects.map((project): SearchResultItem => ({ kind: 'project', id: project.id, title: project.name, subtitle: project.status })),
    ];
  }
}
