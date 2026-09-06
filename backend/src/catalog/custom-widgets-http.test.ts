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

const baseWidget: CustomWidget = {
  id: 'w1', title: 'Mon widget', sourcePath: '/api/extras/grafana/dashboards', dataKey: 'title', label: 'Titre',
  icon: 'gear', refreshSeconds: 60, size: 'medium', metric: 'list', visible: true,
};

test('lists custom widgets', async () => {
  const widgets: CustomWidget[] = [baseWidget];
  const result = await handleCustomWidgetsRequest('GET', '/api/custom-widgets', undefined, undefined, service({ widgets }));
  assert.deepEqual(result, { status: 200, body: widgets });
});

test('saves a custom widget with a valid source', async () => {
  const svc = service();
  const result = await handleCustomWidgetsRequest('POST', '/api/custom-widgets', {
    title: 'Mon widget', sourcePath: '/api/extras/grafana/dashboards', dataKey: 'title', label: 'Titre',
  }, 'Admin', svc);
  assert.equal(result.status, 201);
  assert.equal((await svc.list()).length, 1);
});

test('rejects saving a custom widget without a session', async () => {
  const result = await handleCustomWidgetsRequest('POST', '/api/custom-widgets', {
    title: 'Mon widget', sourcePath: '/api/extras/grafana/dashboards', dataKey: 'title', label: 'Titre',
  }, undefined, service());
  assert.equal(result.status, 400);
});

test('rejects a source outside the allowed /api/extras/* list', async () => {
  const result = await handleCustomWidgetsRequest('POST', '/api/custom-widgets', {
    title: 'Mon widget', sourcePath: '/api/settings', dataKey: 'title', label: 'Titre',
  }, 'Admin', service());
  assert.equal(result.status, 400);
});

test('rejects a payload missing a title', async () => {
  const result = await handleCustomWidgetsRequest('POST', '/api/custom-widgets', {
    sourcePath: '/api/extras/grafana/dashboards', dataKey: 'title', label: 'Titre',
  }, 'Admin', service());
  assert.equal(result.status, 400);
});

test('removes a custom widget by id', async () => {
  const widgets: CustomWidget[] = [baseWidget];
  const svc = service({ widgets });
  const result = await handleCustomWidgetsRequest('DELETE', '/api/custom-widgets/w1', undefined, 'Admin', svc);
  assert.equal(result.status, 204);
  assert.equal((await svc.list()).length, 0);
});

test('updates a custom widget (title, size, metric, visibility)', async () => {
  const widgets: CustomWidget[] = [baseWidget];
  const svc = service({ widgets });
  const result = await handleCustomWidgetsRequest('PUT', '/api/custom-widgets/w1', {
    title: 'Widget renommé', size: 'large', metric: 'count', visible: false,
  }, 'Admin', svc);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    ...baseWidget, title: 'Widget renommé', size: 'large', metric: 'count', visible: false,
  });
});

test('rejects updating an unknown widget', async () => {
  const result = await handleCustomWidgetsRequest('PUT', '/api/custom-widgets/unknown', { title: 'x' }, 'Admin', service());
  assert.equal(result.status, 400);
});

test('returns 404 for unknown routes', async () => {
  const result = await handleCustomWidgetsRequest('PATCH', '/api/custom-widgets', undefined, undefined, service());
  assert.equal(result.status, 404);
});
