import { ItemType, PrismaClient, type Item } from '@prisma/client';

import { parseLabel } from './labels.js';

export interface CreateItemInput {
  type: ItemType;
  title: string;
  description?: string;
  content?: string;
  parentId?: string;
  labels?: string[];
  dueAt?: string;
}

export interface UpdateItemInput {
  title?: string;
  description?: string;
  content?: string;
  status?: string;
  parentId?: string | null;
  mergeRequestState?: string | null;
  pipelineStatus?: string | null;
  required?: boolean;
  releaseId?: string | null;
}

export class ItemService {
  public constructor(private readonly database: PrismaClient) {}

  public list(): Promise<Item[]> {
    return this.database.item.findMany({
      where: { triage: { not: 'pending' } },
      include: { labels: { include: { label: true } }, gitlabLinks: true },
      orderBy: { createdAt: 'desc' },
    }) as Promise<Item[]>;
  }

  public async create(input: CreateItemInput): Promise<Item> {
    const title = validTitle(input.title);
    const labels = (input.labels ?? []).map(parseLabel);
    return this.database.item.create({
      data: {
        type: input.type,
        title,
        description: input.description,
        content: input.content,
        parentId: input.parentId,
        taskLevel: input.type === ItemType.task ? 'task' : null,
        labels: {
          create: labels.map((label) => ({ label: { connectOrCreate: { where: { prefix_value: label }, create: label } } })),
        },
        ...(input.dueAt ? { dueAt: validDate(input.dueAt) } : {}),
      },
    });
  }

  public update(id: string, input: UpdateItemInput): Promise<Item> {
    return this.database.item.update({
      where: { id },
      data: {
        ...(input.title === undefined ? {} : { title: validTitle(input.title) }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.content === undefined ? {} : { content: input.content }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
        ...(input.mergeRequestState === undefined ? {} : { mergeRequestState: input.mergeRequestState }),
        ...(input.pipelineStatus === undefined ? {} : { pipelineStatus: input.pipelineStatus }),
        ...(input.required === undefined ? {} : { required: input.required }),
        ...(input.releaseId === undefined ? {} : { releaseId: input.releaseId }),
      },
    });
  }

  public delete(id: string): Promise<Item> {
    return this.database.item.delete({ where: { id } });
  }
}

function validDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Item due date must be a valid ISO date');
  return date;
}

function validTitle(title: string): string {
  const normalized = title.trim();
  if (!normalized || normalized.length > 300) {
    throw new Error('Item title must contain between 1 and 300 characters');
  }
  return normalized;
}