import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyUpdate, rollbackUpdate, resolveUpdateMechanism, type UpdateApplyDeps } from './update-apply-service.js';

function baseDeps(overrides: Partial<UpdateApplyDeps> = {}): UpdateApplyDeps {
  const revisions: { current: string | null } = { current: null };
  return {
    async checkHealth() { return { healthy: true }; },
    getLastKnownRevision: async () => revisions.current,
    setLastKnownRevision: async (revision) => { revisions.current = revision; },
    recordAudit: async () => {},
    ...overrides,
  };
}

test('resolveUpdateMechanism prefers ArgoCD over the fallback', () => {
  assert.equal(resolveUpdateMechanism({ argocd: {} as never, fallback: {} as never }), 'argocd');
  assert.equal(resolveUpdateMechanism({ fallback: {} as never }), 'fallback');
  assert.equal(resolveUpdateMechanism({}), 'none');
});

test('applyUpdate returns not-triggered when no mechanism is configured', async () => {
  const result = await applyUpdate(baseDeps());
  assert.deepEqual(result, { mechanism: 'none', triggered: false });
});

test('applyUpdate refuses to trigger when the platform is unhealthy', async () => {
  const deps = baseDeps({
    checkHealth: async () => ({ healthy: false, error: 'database unreachable' }),
    fallback: { trigger: async () => { throw new Error('should not be called'); } },
  });
  await assert.rejects(() => applyUpdate(deps), /not healthy/);
});

test('applyUpdate via ArgoCD persists the pre-sync revision then syncs', async () => {
  const calls: string[] = [];
  const audits: Array<[string, string]> = [];
  const deps = baseDeps({
    argocd: {
      appName: 'devos',
      getCurrentRevision: async () => 'abc123',
      sync: async (revision) => { calls.push(revision ?? 'HEAD'); },
    },
    recordAudit: async (action, mechanism) => { audits.push([action, mechanism]); },
  });
  const result = await applyUpdate(deps);
  assert.deepEqual(result, { mechanism: 'argocd', triggered: true });
  assert.deepEqual(calls, ['HEAD']);
  assert.equal(await deps.getLastKnownRevision(), 'abc123');
  assert.deepEqual(audits, [['update_applied', 'argocd']]);
});

test('applyUpdate via fallback calls trigger() and never touches revision tracking', async () => {
  let triggered = false;
  const deps = baseDeps({ fallback: { trigger: async () => { triggered = true; } } });
  const result = await applyUpdate(deps);
  assert.deepEqual(result, { mechanism: 'fallback', triggered: true });
  assert.equal(triggered, true);
  assert.equal(await deps.getLastKnownRevision(), null);
});

test('rollbackUpdate rejects when the mechanism is not ArgoCD', async () => {
  const deps = baseDeps({ fallback: { trigger: async () => {} } });
  await assert.rejects(() => rollbackUpdate(deps), /only available for the ArgoCD/);
});

test('rollbackUpdate rejects when no previous revision was recorded', async () => {
  const deps = baseDeps({ argocd: { appName: 'devos', getCurrentRevision: async () => null, sync: async () => {} } });
  await assert.rejects(() => rollbackUpdate(deps), /No previous revision/);
});

test('rollbackUpdate re-syncs to the recorded revision and clears it', async () => {
  const calls: Array<string | undefined> = [];
  let stored: string | null = 'abc123';
  const deps = baseDeps({
    getLastKnownRevision: async () => stored,
    setLastKnownRevision: async (revision) => { stored = revision; },
    argocd: { appName: 'devos', getCurrentRevision: async () => 'def456', sync: async (revision) => { calls.push(revision); } },
  });
  const result = await rollbackUpdate(deps);
  assert.deepEqual(result, { mechanism: 'argocd', triggered: true });
  assert.deepEqual(calls, ['abc123']);
  assert.equal(stored, null);
});
