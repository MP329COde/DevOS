import assert from 'node:assert/strict';
import test from 'node:test';

import { createWebhookTriage, transitionTriage } from './triage.js';

test('routes webhook-created items to pending triage', () => {
  assert.equal(createWebhookTriage({ triage: 'none' }).triage, 'pending');
});

test('accepts or rejects only pending items', () => {
  assert.equal(transitionTriage({ triage: 'pending' }, 'accepted').triage, 'accepted');
  assert.throws(() => transitionTriage({ triage: 'none' }, 'rejected'), /pending/);
});