import assert from 'node:assert/strict';
import test from 'node:test';

import { BugService } from './bug-service.js';

test('creates a bug with default severity "medium" and stores repro fields', async () => {
  let created: unknown;
  const database = { bug: { create: async (args: { data: unknown }) => { created = args.data; return args.data; } } };
  const service = new BugService(database as never);
  await service.create({ title: 'Formulaire cassé', environment: 'prod', reproSteps: '1. ...' });
  assert.equal((created as { severity: string }).severity, 'medium');
  assert.equal((created as { environment: string }).environment, 'prod');
});

test('rejects an empty title and an invalid severity', () => {
  const service = new BugService({} as never);
  assert.throws(() => service.create({ title: '   ' }), /title/);
  assert.throws(() => service.create({ title: 'x', severity: 'huge' as never }), /severity/);
});
