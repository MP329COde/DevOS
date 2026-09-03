import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateRules, type Rule } from './engine.js';

const rules: Rule[] = [
  { id: 'notify-done', enabled: true, trigger: 'item.updated', condition: { field: 'status', operator: 'equals', value: 'done' }, action: { type: 'notify', payload: { channel: 'dashboard' } } },
  { id: 'disabled', enabled: false, trigger: 'item.updated', action: { type: 'set_status', payload: { status: 'ignored' } } },
  { id: 'danger', enabled: true, trigger: 'item.updated', action: { type: 'execute_infrastructure', payload: { operation: 'stop' } } },
];

test('returns matching declarative actions without executing them', () => {
  assert.deepEqual(evaluateRules(rules, { trigger: 'item.updated', data: { status: 'done' } }), [rules[0].action, rules[2].action]);
});

test('ignores disabled and non-matching rules', () => {
  assert.deepEqual(evaluateRules(rules, { trigger: 'item.created', data: { status: 'done' } }), []);
});