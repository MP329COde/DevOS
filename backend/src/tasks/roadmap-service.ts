import type { PrismaClient } from '@prisma/client';

import { rollupStatus, type RollupStatus } from './status-rollup.js';

/**
 * Roadmap (section AM.6) : construite à partir des fondations déjà en place plutôt qu'un
 * nouveau modèle — les objectifs/epics/features/tâches sont des `Item` (`taskLevel` +
 * hiérarchie `parentId`/`ItemLink`), et les jalons réutilisent `Cycle` (date cible = `endsAt`,
 * avancement calculé depuis les items qui lui sont rattachés).
 */

export interface RoadmapItem {
  id: string;
  title: string;
  status: string;
  taskLevel: string | null;
  parentId: string | null;
  dueAt: string | null;
  createdAt: string;
}

export interface RoadmapMilestone {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  closedAt: string | null;
  itemCount: number;
  doneCount: number;
  progress: number;
  isLate: boolean;
  isBlocked: boolean;
  rollupStatus: RollupStatus;
}

export interface RoadmapData {
  items: RoadmapItem[];
  milestones: RoadmapMilestone[];
}

const OPEN_ITEM_TYPES = ['task', 'goal'] as const;

export class RoadmapService {
  public constructor(private readonly database: PrismaClient) {}

  public async get(reference: Date = new Date()): Promise<RoadmapData> {
    const [items, cycles] = await Promise.all([
      this.database.item.findMany({
        where: { type: { in: [...OPEN_ITEM_TYPES] }, triage: { not: 'pending' } },
        select: { id: true, title: true, status: true, taskLevel: true, parentId: true, dueAt: true, createdAt: true, cycleId: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.database.cycle.findMany({ orderBy: { endsAt: 'asc' } }),
    ]);

    const roadmapItems: RoadmapItem[] = items.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      taskLevel: item.taskLevel,
      parentId: item.parentId,
      dueAt: item.dueAt ? item.dueAt.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
    }));

    const milestones: RoadmapMilestone[] = cycles.map((cycle) => {
      const cycleItems = items.filter((item) => item.cycleId === cycle.id);
      const statuses = cycleItems.map(toRollupStatus);
      const doneCount = statuses.filter((status) => status === 'done').length;
      const isBlocked = statuses.some((status) => status === 'blocked');
      const isLate = !cycle.closedAt && cycle.endsAt.getTime() < reference.getTime() && doneCount < cycleItems.length;
      return {
        id: cycle.id,
        name: cycle.name,
        startsAt: cycle.startsAt.toISOString(),
        endsAt: cycle.endsAt.toISOString(),
        closedAt: cycle.closedAt ? cycle.closedAt.toISOString() : null,
        itemCount: cycleItems.length,
        doneCount,
        progress: cycleItems.length === 0 ? 0 : Math.round((doneCount / cycleItems.length) * 100),
        isLate,
        isBlocked,
        rollupStatus: rollupStatus(statuses),
      };
    });

    return { items: roadmapItems, milestones };
  }
}

function toRollupStatus(item: { status: string }): RollupStatus {
  if (item.status === 'blocked') return 'blocked';
  if (item.status === 'done') return 'done';
  if (item.status === 'backlog') return 'backlog';
  return 'in_progress';
}
