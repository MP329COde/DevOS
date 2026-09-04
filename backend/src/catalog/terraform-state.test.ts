import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTerraformState } from './terraform-state.js';

test('parses resources with their instance count', () => {
  const raw = JSON.stringify({
    version: 4,
    terraform_version: '1.7.0',
    resources: [
      {
        type: 'docker_container',
        name: 'devos_backend',
        provider: 'provider["registry.terraform.io/kreuzwerker/docker"]',
        instances: [{ attributes: { id: 'abc123' } }],
      },
      {
        type: 'docker_network',
        name: 'devos_net',
        provider: 'provider["registry.terraform.io/kreuzwerker/docker"]',
        instances: [{ attributes: {} }, { attributes: {} }],
      },
    ],
  });

  const summaries = parseTerraformState(raw);
  assert.equal(summaries.length, 2);
  assert.deepEqual(summaries[0], {
    type: 'docker_container',
    name: 'devos_backend',
    provider: 'provider["registry.terraform.io/kreuzwerker/docker"]',
    instanceCount: 1,
  });
  assert.equal(summaries[1].instanceCount, 2);
});

test('returns an empty array when resources is absent', () => {
  const raw = JSON.stringify({ version: 4, terraform_version: '1.7.0' });
  assert.deepEqual(parseTerraformState(raw), []);
});

test('returns an empty array when resources is not an array', () => {
  const raw = JSON.stringify({ resources: 'oops' });
  assert.deepEqual(parseTerraformState(raw), []);
});

test('skips a malformed entry in the middle of resources without throwing', () => {
  const raw = JSON.stringify({
    resources: [
      { type: 'docker_container', name: 'a', provider: 'p', instances: [{}] },
      { type: 'docker_container' },
      { type: 'docker_container', name: 'b', provider: 'p', instances: [] },
    ],
  });

  const summaries = parseTerraformState(raw);
  assert.equal(summaries.length, 2);
  assert.deepEqual(summaries.map((s) => s.name), ['a', 'b']);
  assert.equal(summaries[1].instanceCount, 0);
});

test('treats a missing instances field as zero instances', () => {
  const raw = JSON.stringify({
    resources: [{ type: 'docker_container', name: 'a', provider: 'p' }],
  });
  assert.equal(parseTerraformState(raw)[0].instanceCount, 0);
});

test('skips a non-object entry in resources', () => {
  const raw = JSON.stringify({ resources: [null, 'not-an-object', 42] });
  assert.deepEqual(parseTerraformState(raw), []);
});

test('throws a clear error on invalid JSON', () => {
  assert.throws(() => parseTerraformState('{ not valid json'), /not valid JSON/);
});

test('returns an empty array for an empty resources array', () => {
  assert.deepEqual(parseTerraformState(JSON.stringify({ resources: [] })), []);
});
