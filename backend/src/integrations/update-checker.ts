import { readFileSync } from 'node:fs';

export interface UpdateCheckClient {
  getLatestReleaseTag(): Promise<string | null>;
}

export type UpdateStatus = 'up-to-date' | 'update-available' | 'ahead';

export interface UpdateCheckResult {
  current: string;
  latest: string | null;
  status: UpdateStatus | 'unknown';
}

/**
 * Reads the `version` field from a package.json file.
 */
export function readCurrentVersion(packageJsonPath: string): string {
  let raw: string;
  try {
    raw = readFileSync(packageJsonPath, 'utf8');
  } catch (error) {
    throw new Error(`unable to read ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${packageJsonPath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const version = (parsed as Record<string, unknown> | null)?.version;
  if (typeof version !== 'string' || version.trim() === '') {
    throw new Error(`${packageJsonPath} is missing a version field`);
  }
  return version;
}

/**
 * Compares two semantic versions (major.minor.patch, an optional leading
 * `v` on `latest` is stripped). Pre-release/build metadata is ignored.
 */
export function compareVersions(current: string, latest: string): UpdateStatus {
  const currentParts = parseVersion(current);
  const latestParts = parseVersion(latest);

  for (let i = 0; i < 3; i++) {
    if (currentParts[i] < latestParts[i]) return 'update-available';
    if (currentParts[i] > latestParts[i]) return 'ahead';
  }
  return 'up-to-date';
}

function parseVersion(version: string): [number, number, number] {
  const normalized = version.trim().replace(/^v/i, '');
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`not a valid semantic version: ${version}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Orchestrates reading the current DevOS version and comparing it against
 * the latest release known to `client`.
 */
export async function checkForUpdate(packageJsonPath: string, client: UpdateCheckClient): Promise<UpdateCheckResult> {
  const current = readCurrentVersion(packageJsonPath);
  const latest = await client.getLatestReleaseTag();

  if (latest === null) {
    return { current, latest: null, status: 'unknown' };
  }

  return { current, latest, status: compareVersions(current, latest) };
}
