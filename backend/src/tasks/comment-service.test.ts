import assert from 'node:assert/strict';
import test from 'node:test';

import { CommentService } from './comment-service.js';

test('creates a purely local comment when the item has no GitLab link', async () => {
  let createdData: unknown;
  const database = {
    gitLabIssueLink: { findFirst: async () => null },
    itemComment: {
      create: async ({ data }: { data: unknown }) => { createdData = data; return { id: 'c1', ...(data as object) }; },
    },
  } as never;

  const service = new CommentService(database);
  const result = await service.create('item-1', '  Looks good  ');
  assert.deepEqual(createdData, { itemId: 'item-1', body: 'Looks good', author: undefined, propagatedToGitlab: false });
  assert.equal((result as { propagatedToGitlab: boolean }).propagatedToGitlab, false);
});

test('propagates the comment to GitLab when the item is linked to an issue', async () => {
  let notedProject = '';
  let notedIssue = 0;
  let notedBody = '';
  const database = {
    gitLabIssueLink: { findFirst: async () => ({ gitlabProjectId: 'group/project', issueIid: 42 }) },
    itemComment: {
      create: async ({ data }: { data: { propagatedToGitlab: boolean } }) => ({ id: 'c2', ...data }),
    },
  } as never;
  const gitlab = {
    async addNote(projectId: string, issueIid: number, body: string) {
      notedProject = projectId;
      notedIssue = issueIid;
      notedBody = body;
    },
  };

  const service = new CommentService(database, gitlab);
  const result = await service.create('item-1', 'Fixed in the last commit');
  assert.equal(notedProject, 'group/project');
  assert.equal(notedIssue, 42);
  assert.equal(notedBody, 'Fixed in the last commit');
  assert.equal((result as { propagatedToGitlab: boolean }).propagatedToGitlab, true);
});

test('rejects an empty comment body', async () => {
  const database = {} as never;
  await assert.rejects(new CommentService(database).create('item-1', '   '));
});

test('lists comments for an item ordered by creation date', async () => {
  let receivedWhere: unknown;
  let receivedOrderBy: unknown;
  const database = {
    itemComment: {
      findMany: async ({ where, orderBy }: { where: unknown; orderBy: unknown }) => { receivedWhere = where; receivedOrderBy = orderBy; return []; },
    },
  } as never;

  await new CommentService(database).list('item-1');
  assert.deepEqual(receivedWhere, { itemId: 'item-1' });
  assert.deepEqual(receivedOrderBy, { createdAt: 'asc' });
});
