export interface PlatformHealthCheck {
  pingDatabase(): Promise<void>;
  pingRedis?(): Promise<void>;
}

export interface PlatformHealthResult {
  healthy: boolean;
  database: 'ok' | 'error';
  redis: 'ok' | 'error' | 'skipped';
  error?: string;
}

/**
 * Minimal readiness check used as a safety gate before applying a platform update: refuses to
 * trigger an update while the database (or Redis, when configured) is already unreachable, since
 * an update applied on top of a degraded system is much harder to diagnose or roll back cleanly.
 */
export async function checkPlatformHealth(check: PlatformHealthCheck): Promise<PlatformHealthResult> {
  try {
    await check.pingDatabase();
  } catch (error) {
    return { healthy: false, database: 'error', redis: 'skipped', error: error instanceof Error ? error.message : 'database unreachable' };
  }

  if (!check.pingRedis) {
    return { healthy: true, database: 'ok', redis: 'skipped' };
  }

  try {
    await check.pingRedis();
  } catch (error) {
    return { healthy: false, database: 'ok', redis: 'error', error: error instanceof Error ? error.message : 'redis unreachable' };
  }

  return { healthy: true, database: 'ok', redis: 'ok' };
}
