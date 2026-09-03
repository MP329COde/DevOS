import assert from 'node:assert/strict';
import test from 'node:test';

import { RuleService } from './rule-service.js';

test('persists JSON rule configuration and evaluates stored rules', async () => {
  const stored = { id: 'r1', enabled: true, trigger: 'item.updated', condition: { field: 'status', operator: 'equals', value: 'done' }, action: { type: 'notify', payload: { channel: 'dashboard' } } };
  const database = { automationRule: { async findMany() { return [stored]; }, async create({ data }: { data: unknown }) { return data; } } } as never;
  const service = new RuleService(database);
  const actions = await service.actionsFor({ trigger: 'item.updated', data: { status: 'done' } });
  assert.deepEqual(actions, [stored.action]);
});