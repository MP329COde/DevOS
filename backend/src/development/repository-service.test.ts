import assert from 'node:assert/strict';
import test from 'node:test';

import { RepositoryService } from './repository-service.js';

function makeDatabase(overrides: { cicd?: Record<string, unknown>; project?: Record<string, unknown> } = {}) {
  const calls: Record<string, unknown[]> = {};
  const record = (name: string, args: unknown) => { (calls[name] ??= []).push(args); };
  const database = {
    devProject: {
      findUnique: async () => ({ id: 'p1' }),
      ...overrides.project,
    },
    devProjectCiCdConfig: {
      findMany: async (args: unknown) => { record('findMany', args); return []; },
      create: async (args: unknown) => { record('create', args); return { id: 'c1', ...((args as { data: object }).data) }; },
      findUnique: async (args: unknown) => { record('findUnique', args); return { id: 'c1', devProjectId: 'p1' }; },
      delete: async (args: unknown) => { record('delete', args); return {}; },
      ...overrides.cicd,
    },
  };
  return { database: database as never, calls };
}

test('listRepositories lists all repos for a project', async () => {
  const { database, calls } = makeDatabase();
  const service = new RepositoryService(database);
  await service.listRepositories('p1');
  assert.deepEqual(calls.findMany[0], { where: { devProjectId: 'p1' }, orderBy: { createdAt: 'asc' } });
});

test('linkExistingRepo requires repoIdentifier, role and vaultSecretName', async () => {
  const { database } = makeDatabase();
  const service = new RepositoryService(database);
  await assert.rejects(() => service.linkExistingRepo('p1', { provider: 'gitlab', repoIdentifier: '', role: 'backend', vaultSecretName: 's' }));
  await assert.rejects(() => service.linkExistingRepo('p1', { provider: 'gitlab', repoIdentifier: 'g/r', role: '', vaultSecretName: 's' }));
  await assert.rejects(() => service.linkExistingRepo('p1', { provider: 'gitlab', repoIdentifier: 'g/r', role: 'backend', vaultSecretName: '' }));
});

test('linkExistingRepo fails when the project does not exist', async () => {
  const { database } = makeDatabase({ project: { findUnique: async () => null } });
  const service = new RepositoryService(database);
  await assert.rejects(() => service.linkExistingRepo('missing', { provider: 'gitlab', repoIdentifier: 'g/r', role: 'backend', vaultSecretName: 's' }));
});

test('linkExistingRepo creates the config and records a timeline event', async () => {
  const { database, calls } = makeDatabase();
  let recorded: unknown;
  const timelineEvents = { record: async (input: unknown) => { recorded = input; return {} as never; } };
  const service = new RepositoryService(database, {}, timelineEvents as never);
  await service.linkExistingRepo('p1', { provider: 'gitlab', repoIdentifier: 'group/repo', role: 'backend', vaultSecretName: 'p1-backend' }, 'me@example.com');
  const created = calls.create[0] as { data: { devProjectId: string; role: string; repoIdentifier: string } };
  assert.equal(created.data.devProjectId, 'p1');
  assert.equal(created.data.role, 'backend');
  assert.equal(created.data.repoIdentifier, 'group/repo');
  assert.equal((recorded as { type: string }).type, 'repository.linked');
});

test('unlinkRepo rejects a config that belongs to another project', async () => {
  const { database } = makeDatabase({ cicd: { findUnique: async () => ({ id: 'c1', devProjectId: 'other' }) } });
  const service = new RepositoryService(database);
  await assert.rejects(() => service.unlinkRepo('p1', 'c1'));
});

test('unlinkRepo deletes the config', async () => {
  const { database, calls } = makeDatabase();
  const service = new RepositoryService(database);
  await service.unlinkRepo('p1', 'c1');
  assert.deepEqual(calls.delete[0], { where: { id: 'c1' } });
});

test('createRepoAndLink rejects when the provider client is not configured', async () => {
  const { database } = makeDatabase();
  const service = new RepositoryService(database, {});
  await assert.rejects(() => service.createRepoAndLink('p1', { provider: 'gitlab', name: 'repo', role: 'backend', vaultSecretName: 's' }));
  await assert.rejects(() => service.createRepoAndLink('p1', { provider: 'github', name: 'repo', role: 'backend', vaultSecretName: 's' }));
});

test('createRepoAndLink creates a repo via GitHub and links it', async () => {
  const { database, calls } = makeDatabase();
  const github = { createRepo: async (name: string) => ({ full_name: `org/${name}`, html_url: 'https://github.com/org/repo', default_branch: 'main' }) };
  const service = new RepositoryService(database, { github: github as never });
  await service.createRepoAndLink('p1', { provider: 'github', name: 'repo', role: 'frontend', vaultSecretName: 's' });
  const created = calls.create[0] as { data: { repoIdentifier: string; webUrl: string; defaultBranch: string } };
  assert.equal(created.data.repoIdentifier, 'org/repo');
  assert.equal(created.data.webUrl, 'https://github.com/org/repo');
  assert.equal(created.data.defaultBranch, 'main');
});
