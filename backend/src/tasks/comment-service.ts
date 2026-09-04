import type { ItemComment, PrismaClient } from '@prisma/client';

/** Minimal shape needed to propagate a comment to GitLab — keeps this service decoupled from the full GitLabClient. */
export interface CommentGitLabClient {
  addNote(projectId: string, issueIid: number, body: string): Promise<void>;
}

/**
 * CRUD minimal sur les commentaires d'un item, backé par Postgres. Quand l'item est lié à une
 * issue GitLab (table `GitLabIssueLink`), chaque nouveau commentaire est aussi propagé vers
 * GitLab via `addNote` (note sur l'issue) — best-effort : si la propagation échoue, le
 * commentaire local est quand même conservé et l'erreur remonte à l'appelant.
 */
export class CommentService {
  public constructor(
    private readonly database: PrismaClient,
    private readonly gitlab?: CommentGitLabClient,
  ) {}

  public list(itemId: string): Promise<ItemComment[]> {
    return this.database.itemComment.findMany({ where: { itemId }, orderBy: { createdAt: 'asc' } });
  }

  public async create(itemId: string, body: string, author?: string): Promise<ItemComment> {
    const text = validBody(body);
    const link = await this.database.gitLabIssueLink.findFirst({ where: { itemId } });
    let propagatedToGitlab = false;
    if (link && this.gitlab) {
      await this.gitlab.addNote(link.gitlabProjectId, link.issueIid, text);
      propagatedToGitlab = true;
    }
    return this.database.itemComment.create({
      data: { itemId, body: text, author, propagatedToGitlab },
    });
  }
}

function validBody(body: string): string {
  const normalized = body.trim();
  if (!normalized || normalized.length > 10_000) {
    throw new Error('Comment body must contain between 1 and 10000 characters');
  }
  return normalized;
}
