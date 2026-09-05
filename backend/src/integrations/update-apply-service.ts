export type UpdateMechanism = 'argocd' | 'fallback' | 'none';

export interface ArgoCDUpdateTarget {
  appName: string;
  getCurrentRevision(): Promise<string | null>;
  sync(revision?: string): Promise<void>;
}

export interface FallbackUpdateTarget {
  /** Triggers the deploy webhook or command configured via server-side environment variables. */
  trigger(): Promise<void>;
}

export interface UpdateApplyDeps {
  checkHealth(): Promise<{ healthy: boolean; error?: string }>;
  argocd?: ArgoCDUpdateTarget;
  fallback?: FallbackUpdateTarget;
  getLastKnownRevision(): Promise<string | null>;
  setLastKnownRevision(revision: string | null): Promise<void>;
  recordAudit(action: 'update_applied' | 'update_rolled_back', mechanism: UpdateMechanism): Promise<void>;
}

export interface UpdateApplyResult {
  mechanism: UpdateMechanism;
  triggered: boolean;
}

export function resolveUpdateMechanism(deps: Pick<UpdateApplyDeps, 'argocd' | 'fallback'>): UpdateMechanism {
  if (deps.argocd) return 'argocd';
  if (deps.fallback) return 'fallback';
  return 'none';
}

/**
 * Applies a platform update through whichever mechanism is configured, gated by a health check:
 * refuses to trigger anything if the system is already degraded (see platform-health.ts). For the
 * ArgoCD path, the revision ArgoCD is synced to *before* triggering is persisted so a later
 * rollback can re-sync to it. Every trigger (successful or refused) is journaled via the audit log.
 */
export async function applyUpdate(deps: UpdateApplyDeps): Promise<UpdateApplyResult> {
  const mechanism = resolveUpdateMechanism(deps);
  if (mechanism === 'none') {
    return { mechanism, triggered: false };
  }

  const health = await deps.checkHealth();
  if (!health.healthy) {
    throw new Error(`Refusing to apply update: platform is not healthy (${health.error ?? 'unknown reason'})`);
  }

  if (mechanism === 'argocd' && deps.argocd) {
    const currentRevision = await deps.argocd.getCurrentRevision();
    await deps.setLastKnownRevision(currentRevision);
    await deps.argocd.sync();
    await deps.recordAudit('update_applied', mechanism);
    return { mechanism, triggered: true };
  }

  if (mechanism === 'fallback' && deps.fallback) {
    await deps.fallback.trigger();
    await deps.recordAudit('update_applied', mechanism);
    return { mechanism, triggered: true };
  }

  return { mechanism, triggered: false };
}

/**
 * Rolls back to the revision recorded just before the last `applyUpdate` call. Only supported for
 * the ArgoCD path (the fallback path has no notion of a previous state DevOS can address).
 */
export async function rollbackUpdate(deps: UpdateApplyDeps): Promise<UpdateApplyResult> {
  const mechanism = resolveUpdateMechanism(deps);
  if (mechanism !== 'argocd' || !deps.argocd) {
    throw new Error('Rollback is only available for the ArgoCD update mechanism');
  }

  const health = await deps.checkHealth();
  if (!health.healthy) {
    throw new Error(`Refusing to roll back: platform is not healthy (${health.error ?? 'unknown reason'})`);
  }

  const lastRevision = await deps.getLastKnownRevision();
  if (!lastRevision) {
    throw new Error('No previous revision recorded to roll back to');
  }

  await deps.argocd.sync(lastRevision);
  await deps.setLastKnownRevision(null);
  await deps.recordAudit('update_rolled_back', mechanism);
  return { mechanism, triggered: true };
}
