import { ItemType, PrismaClient, type Item } from '@prisma/client';

export interface CreateItemInput {
  type: ItemType;
  title: string;
  description?: string;
  parentId?: string;
}

export interface UpdateItemInput {
  title?: string;
  description?: string;
  status?: string;
  parentId?: string | null;
}

export class ItemService {
  public constructor(private readonly database: PrismaClient) {}

  public list(): Promise<Item[]> {
    return this.database.item.findMany({ orderBy: { createdAt: 'desc' } });
  }

  public async create(input: CreateItemInput): Promise<Item> {
    const title = validTitle(input.title);
    return this.database.item.create({
      data: {
        type: input.type,
        title,
        description: input.description,
        parentId: input.parentId,
        taskLevel: input.type === ItemType.task ? 'task' : null,
      },
    });
  }

  public update(id: string, input: UpdateItemInput): Promise<Item> {
    return this.database.item.update({
      where: { id },
      data: {
        ...(input.title === undefined ? {} : { title: validTitle(input.title) }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
      },
    });
  }

  public delete(id: string): Promise<Item> {
    return this.database.item.delete({ where: { id } });
  }
}

function validTitle(title: string): string {
  const normalized = title.trim();
  if (!normalized || normalized.length > 300) {
    throw new Error('Item title must contain between 1 and 300 characters');
  }
  return normalized;
}