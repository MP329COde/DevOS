import { ItemType, PrismaClient, type BugSeverity, type Item } from '@prisma/client';

import { parseLabel } from './labels.js';

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];

export interface CreateItemInput {
  type: ItemType;
  title: string;
  description?: string;
  content?: string;
  parentId?: string;
  labels?: string[];
  dueAt?: string;
  devProjectId?: string;
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
  devProjectId?: string | null;
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
}

export interface ListItemsFilter {
  type?: string;
  devProjectId?: string;
}

export class ItemService {
  public constructor(private readonly database: PrismaClient) {}

  public list(filter?: ListItemsFilter): Promise<Item[]> {
    return this.database.item.findMany({
      where: {
        triage: { not: 'pending' },
        ...(filter?.type ? { type: filter.type as ItemType } : {}),
        ...(filter?.devProjectId ? { devProjectId: filter.devProjectId } : {}),
      },
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
        devProjectId: input.devProjectId,
        taskLevel: input.type === ItemType.task ? 'task' : null,
        labels: {
          create: labels.map((label) => ({ label: { connectOrCreate: { where: { prefix_value: label }, create: label } } })),
        },
        ...(input.dueAt ? { dueAt: validDate(input.dueAt) } : {}),
        ...(input.type === ItemType.bug ? { severity: validSeverity(input.severity) } : {}),
        ...(input.environment === undefined ? {} : { environment: input.environment }),
        ...(input.versionAffected === undefined ? {} : { versionAffected: input.versionAffected }),
        ...(input.expectedBehavior === undefined ? {} : { expectedBehavior: input.expectedBehavior }),
        ...(input.observedBehavior === undefined ? {} : { observedBehavior: input.observedBehavior }),
        ...(input.reproSteps === undefined ? {} : { reproSteps: input.reproSteps }),
        ...(input.logs === undefined ? {} : { logs: input.logs }),
        ...(input.screenshots === undefined ? {} : { screenshots: input.screenshots }),
        ...(input.releaseRef === undefined ? {} : { releaseRef: input.releaseRef }),
        ...(input.commitRef === undefined ? {} : { commitRef: input.commitRef }),
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
        ...(input.devProjectId === undefined ? {} : { devProjectId: input.devProjectId }),
        ...(input.severity === undefined ? {} : { severity: validSeverity(input.severity) }),
        ...(input.environment === undefined ? {} : { environment: input.environment }),
        ...(input.versionAffected === undefined ? {} : { versionAffected: input.versionAffected }),
        ...(input.expectedBehavior === undefined ? {} : { expectedBehavior: input.expectedBehavior }),
        ...(input.observedBehavior === undefined ? {} : { observedBehavior: input.observedBehavior }),
        ...(input.reproSteps === undefined ? {} : { reproSteps: input.reproSteps }),
        ...(input.logs === undefined ? {} : { logs: input.logs }),
        ...(input.screenshots === undefined ? {} : { screenshots: input.screenshots }),
        ...(input.releaseRef === undefined ? {} : { releaseRef: input.releaseRef }),
        ...(input.commitRef === undefined ? {} : { commitRef: input.commitRef }),
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

function validSeverity(severity: string | undefined): BugSeverity {
  if (severity === undefined) return 'medium' as BugSeverity;
  if (!VALID_SEVERITIES.includes(severity)) throw new Error('Bug severity must be one of low/medium/high/critical');
  return severity as BugSeverity;
}