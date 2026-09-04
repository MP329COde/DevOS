import assert from 'node:assert/strict';
import test from 'node:test';

import { handleDevTemplateRequest, type DevTemplateHttpService } from './dev-template-http.js';

function makeService(overrides: Partial<DevTemplateHttpService> = {}): DevTemplateHttpService {
  return {
    list: async () => [],
    get: async () => null,
    create: async (input) => ({ id: 'new', ...input }),
    update: async (id, input) => ({ id, ...input }),
    createNewVersion: async (id, nextVersion, changes) => ({ id: 'new', previousVersionId: id, version: nextVersion, ...changes }),
    setActive: async (id, active) => ({ id, active }),
    setDefault: async (id) => ({ id, isDefault: true }),
    delete: async () => undefined,
    ...overrides,
  };
}

test('POST /api/dev/templates requires name and type', async () => {
  const response = await handleDevTemplateRequest('POST', '/api/dev/templates', { name: '' }, makeService());
  assert.equal(response.status, 400);
});

test('POST /api/dev/templates creates a template', async () => {
  const response = await handleDevTemplateRequest('POST', '/api/dev/templates', { name: 'API', type: 'api', dependencies: [{ name: 'express', version: '4.x' }] }, makeService());
  assert.equal(response.status, 201);
  assert.equal((response.body as { name: string }).name, 'API');
});

test('GET /api/dev/templates/:id returns 404 when missing', async () => {
  const response = await handleDevTemplateRequest('GET', '/api/dev/templates/missing', undefined, makeService());
  assert.equal(response.status, 404);
});

test('PATCH /api/dev/templates/:id/active toggles active flag', async () => {
  const response = await handleDevTemplateRequest('PATCH', '/api/dev/templates/tpl-1/active', { active: false }, makeService());
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { id: 'tpl-1', active: false });
});

test('PATCH /api/dev/templates/:id/active rejects a missing active flag', async () => {
  const response = await handleDevTemplateRequest('PATCH', '/api/dev/templates/tpl-1/active', {}, makeService());
  assert.equal(response.status, 400);
});

test('POST /api/dev/templates/:id/default marks the template default', async () => {
  const response = await handleDevTemplateRequest('POST', '/api/dev/templates/tpl-1/default', {}, makeService());
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { id: 'tpl-1', isDefault: true });
});

test('POST /api/dev/templates/:id/versions requires a version string', async () => {
  const response = await handleDevTemplateRequest('POST', '/api/dev/templates/tpl-1/versions', {}, makeService());
  assert.equal(response.status, 400);
});

test('POST /api/dev/templates/:id/versions creates a new version referencing the source template', async () => {
  const response = await handleDevTemplateRequest('POST', '/api/dev/templates/tpl-1/versions', { version: '2.0.0' }, makeService());
  assert.equal(response.status, 201);
  assert.equal((response.body as { previousVersionId: string }).previousVersionId, 'tpl-1');
});

test('DELETE /api/dev/templates/:id deletes the template', async () => {
  const response = await handleDevTemplateRequest('DELETE', '/api/dev/templates/tpl-1', undefined, makeService());
  assert.equal(response.status, 204);
});
