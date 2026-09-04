import assert from 'node:assert/strict';
import test from 'node:test';

import { WorkflowService } from './workflow-service.js';

test('resolve falls back to the global workflow when the project has none configured', async () => {
  const calls: (string | null)[] = [];
  const database = {
    workflowStatus: {
      findMany: async (args: { where: { scope: string | null } }) => {
        calls.push(args.where.scope);
        return args.where.scope === 'p1' ? [] : [{ key: 'backlog' }];
      },
    },
  };
  const service = new WorkflowService(database as never);
  const resolved = await service.resolve('p1');
  assert.deepEqual(resolved, [{ key: 'backlog' }]);
  assert.deepEqual(calls, ['p1', null]);
});

test('rejects an invalid status key', () => {
  const service = new WorkflowService({} as never);
  assert.throws(() => service.create({ key: 'not a valid key!', label: 'x' }), /key/);
});
