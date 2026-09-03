import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyAndParseWebhook } from './gitlab-webhook.js';

const secrets = { async getSecret() { return 'vault-webhook-secret'; } };

test('verifies and parses supported GitLab webhook events', async () => {
  const event = await verifyAndParseWebhook('vault-webhook-secret', 'Issue Hook', '{"object_attributes":{"iid":4}}', secrets);
  assert.equal(event.type, 'Issue Hook');
  assert.deepEqual(event.payload, { object_attributes: { iid: 4 } });
});

test('rejects invalid tokens and unsupported events', async () => {
  await assert.rejects(() => verifyAndParseWebhook('wrong', 'Issue Hook', '{}', secrets), /Invalid/);
  await assert.rejects(() => verifyAndParseWebhook('vault-webhook-secret', 'Push Hook', '{}', secrets), /Unsupported/);
});