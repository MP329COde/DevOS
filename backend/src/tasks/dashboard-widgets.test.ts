import assert from 'node:assert/strict';
import test from 'node:test';

import type { AlertmanagerAlert } from '../integrations/alertmanager.js';
import type { GitLabPipelineSummary } from '../integrations/gitlab-pipelines.js';
import { buildDashboardWidgets } from './dashboard-widgets.js';

function pipeline(overrides: Partial<GitLabPipelineSummary> = {}): GitLabPipelineSummary {
  return { id: 1, status: 'running', ref: 'main', web_url: 'https://gitlab.test/p/-/pipelines/1', ...overrides };
}

function alert(overrides: Partial<AlertmanagerAlert> = {}): AlertmanagerAlert {
  return { fingerprint: 'f1', labels: {}, status: { state: 'active' }, startsAt: '2026-09-03T10:00:00Z', ...overrides };
}

test('returns empty widget data for no pipelines and no alerts', () => {
  const widgets = buildDashboardWidgets([], []);
  assert.deepEqual(widgets, {
    pipelines: { running: 0, items: [] },
    alerts: { active: 0, critical: 0, items: [] },
  });
});

test('counts running pipelines and keeps the items', () => {
  const pipelines = [pipeline({ id: 1 }), pipeline({ id: 2 })];
  const widgets = buildDashboardWidgets(pipelines, []);
  assert.equal(widgets.pipelines.running, 2);
  assert.deepEqual(widgets.pipelines.items, pipelines);
});

test('counts active alerts and keeps the items', () => {
  const alerts = [alert({ fingerprint: 'a1' }), alert({ fingerprint: 'a2' })];
  const widgets = buildDashboardWidgets([], alerts);
  assert.equal(widgets.alerts.active, 2);
  assert.deepEqual(widgets.alerts.items, alerts);
});

test('counts only alerts with severity critical as critical', () => {
  const alerts = [
    alert({ fingerprint: 'a1', labels: { severity: 'critical' } }),
    alert({ fingerprint: 'a2', labels: { severity: 'warning' } }),
    alert({ fingerprint: 'a3', labels: { severity: 'critical' } }),
  ];
  const widgets = buildDashboardWidgets([], alerts);
  assert.equal(widgets.alerts.active, 3);
  assert.equal(widgets.alerts.critical, 2);
});

test('combines pipelines and alerts independently', () => {
  const pipelines = [pipeline()];
  const alerts = [alert({ labels: { severity: 'critical' } })];
  const widgets = buildDashboardWidgets(pipelines, alerts);
  assert.equal(widgets.pipelines.running, 1);
  assert.equal(widgets.alerts.active, 1);
  assert.equal(widgets.alerts.critical, 1);
});
