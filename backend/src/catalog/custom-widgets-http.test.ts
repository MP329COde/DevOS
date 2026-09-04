import assert from 'node:assert/strict';
import test from 'node:test';

import { handleCustomWidgetsRequest, type CustomWidget } from './custom-widgets-http.js';

function service(overrides: Partial<{ widgets: CustomWidget[] }> = {}) {
  const widgets = overrides.widgets ?? [];
  return {
    async list() { return widgets; },
    async save(widget: CustomWidget) { widgets.push(widget); },
    async remove(id: string) {
      const index = widgets.findIndex((w) => w.id === id);
      if (index >= 0) widgets.splice(index, 1);
    },
  };
}

test('lists custom widgets', async () => {
  const widgets: CustomWidget[] = [{ id: 'w1', title: 'Mon widget', sourcePath: '/api/extras/grafana/dashboards', dataKey: 'title', label: 'Titre' }];
  const result = await handleCustomWidgetsRequest('GET', '/api/custom-widgets', undefined, service({ widgets }));
  assert.deepEqual(result, { status: 200, body: widgets });
});

test('saves a custom widget with a valid source', async () => {
  const svc = service();
  const result = await handleCustomWidgetsRequest('POST', '/api/custom-widgets', {
    title: 'Mon widget', sourcePath: '/api/extras/grafana/dashboards', dataKey: 'title', label: 'Titre',
  }, svc);
  assert.equal(result.status, 201);
  assert.equal((await svc.list()).length, 1);
});

test('rejects a source outside the allowed /api/extras/* list', async () => {
  const result = await handleCustomWidgetsRequest('POST', '/api/custom-widgets', {
    title: 'Mon widget', sourcePath: '/api/settings', dataKey: 'title', label: 'Titre',
  }, service());
  assert.equal(result.status, 400);
});

test('rejects a payload missing a title', async () => {
  const result = await handleCustomWidgetsRequest('POST', '/api/custom-widgets', {
    sourcePath: '/api/extras/grafana/dashboards', dataKey: 'title', label: 'Titre',
  }, service());
  assert.equal(result.status, 400);
});

test('removes a custom widget by id', async () => {
  const widgets: CustomWidget[] = [{ id: 'w1', title: 'Mon widget', sourcePath: '/api/extras/grafana/dashboards', dataKey: 'title', label: 'Titre' }];
  const svc = service({ widgets });
  const result = await handleCustomWidgetsRequest('DELETE', '/api/custom-widgets/w1', undefined, svc);
  assert.equal(result.status, 204);
  assert.equal((await svc.list()).length, 0);
});

test('returns 404 for unknown routes', async () => {
  const result = await handleCustomWidgetsRequest('PUT', '/api/custom-widgets', undefined, service());
  assert.equal(result.status, 404);
});
