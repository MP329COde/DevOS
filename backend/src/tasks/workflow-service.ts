import type { PrismaClient, WorkflowStatus } from '@prisma/client';

export interface CreateWorkflowStatusInput {
  scope?: string | null;
  key: string;
  label: string;
  color?: string;
  order?: number;
  isDefault?: boolean;
  isFinal?: boolean;
}

export interface UpdateWorkflowStatusInput {
  label?: string;
  color?: string;
  order?: number;
  isDefault?: boolean;
  isFinal?: boolean;
}

/**
 * Workflow de statuts configurable par projet (AM.5). `scope` porte l'id d'un `DevProject` (texte
 * libre, pas de FK stricte : reste utilisable avant qu'un projet existe, ou pour un workflow
 * global). `scope = null`/absent définit le workflow par défaut appliqué faute de configuration
 * spécifique au projet — `resolve` retombe dessus automatiquement.
 */
export class WorkflowService {
  public constructor(private readonly database: PrismaClient) {}

  public list(scope?: string | null): Promise<WorkflowStatus[]> {
    return this.database.workflowStatus.findMany({
      where: { scope: scope ?? null },
      orderBy: { order: 'asc' },
    });
  }

  /** Renvoie le workflow du projet s'il en a un configuré, sinon le workflow global par défaut. */
  public async resolve(scope: string | null | undefined): Promise<WorkflowStatus[]> {
    if (scope) {
      const scoped = await this.list(scope);
      if (scoped.length > 0) return scoped;
    }
    return this.list(null);
  }

  public create(input: CreateWorkflowStatusInput): Promise<WorkflowStatus> {
    const key = validKey(input.key);
    const label = validLabel(input.label);
    return this.database.workflowStatus.create({
      data: {
        scope: input.scope ?? null,
        key,
        label,
        color: input.color,
        order: input.order ?? 0,
        isDefault: input.isDefault ?? false,
        isFinal: input.isFinal ?? false,
      },
    });
  }

  public update(id: string, input: UpdateWorkflowStatusInput): Promise<WorkflowStatus> {
    return this.database.workflowStatus.update({
      where: { id },
      data: {
        ...(input.label === undefined ? {} : { label: validLabel(input.label) }),
        ...(input.color === undefined ? {} : { color: input.color }),
        ...(input.order === undefined ? {} : { order: input.order }),
        ...(input.isDefault === undefined ? {} : { isDefault: input.isDefault }),
        ...(input.isFinal === undefined ? {} : { isFinal: input.isFinal }),
      },
    });
  }

  public delete(id: string): Promise<WorkflowStatus> {
    return this.database.workflowStatus.delete({ where: { id } });
  }
}

function validKey(key: string): string {
  const normalized = key.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,50}$/.test(normalized)) {
    throw new Error('Workflow status key must be 1-50 lowercase alphanumeric/underscore/dash characters');
  }
  return normalized;
}

function validLabel(label: string): string {
  const normalized = label.trim();
  if (!normalized || normalized.length > 100) throw new Error('Workflow status label must contain between 1 and 100 characters');
  return normalized;
}
