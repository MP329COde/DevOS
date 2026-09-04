import type { DocPage, PrismaClient } from '@prisma/client';

import type { ScannedDocPage } from './docs-scan.js';

export class DocsService {
  public constructor(private readonly database: PrismaClient) {}

  /** Upserts every scanned page by (sourceProject, path). */
  public async sync(pages: readonly ScannedDocPage[]): Promise<DocPage[]> {
    return Promise.all(pages.map((page) => this.database.docPage.upsert({
      where: { sourceProject_path: { sourceProject: page.sourceProject, path: page.path } },
      create: page,
      update: { title: page.title, content: page.content },
    })));
  }

  public list(): Promise<DocPage[]> {
    return this.database.docPage.findMany({ orderBy: { title: 'asc' } });
  }

  public get(id: string): Promise<DocPage | null> {
    return this.database.docPage.findUnique({ where: { id } });
  }

  public async link(docPageId: string, itemId: string): Promise<void> {
    await this.database.docLink.upsert({
      where: { docPageId_itemId: { docPageId, itemId } },
      create: { docPageId, itemId },
      update: {},
    });
  }

  public async unlink(docPageId: string, itemId: string): Promise<void> {
    await this.database.docLink.deleteMany({ where: { docPageId, itemId } });
  }

  public linkedItemIds(docPageId: string): Promise<string[]> {
    return this.database.docLink.findMany({ where: { docPageId }, select: { itemId: true } }).then((rows) => rows.map((row) => row.itemId));
  }
}
