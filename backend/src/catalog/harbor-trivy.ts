export interface HarborClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  fetchImpl?: typeof fetch;
}

export interface TrivyVulnerabilitySummary {
  scanStatus: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/**
 * Reads Trivy scan results surfaced through Harbor's artifact API. Returns `null` when the
 * artifact has no scan overview yet (e.g. Trivy has not run or is not deployed) rather than
 * throwing, so callers can render a "no scan available" stub per the Phase 4 requirement.
 */
export class HarborTrivyClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: HarborClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async getVulnerabilitySummary(project: string, repository: string, tag: string): Promise<TrivyVulnerabilitySummary | null> {
    const auth = Buffer.from(`${this.options.username}:${this.options.password}`).toString('base64');
    const response = await this.fetchImpl(
      `${this.options.baseUrl}/api/v2.0/projects/${encodeURIComponent(project)}/repositories/${encodeURIComponent(repository)}/artifacts/${encodeURIComponent(tag)}?with_scan_overview=true`,
      { headers: { authorization: `Basic ${auth}` } },
    );
    if (!response.ok) throw new Error(`Harbor API request failed (${response.status})`);
    const artifact = (await response.json()) as { scan_overview?: Record<string, { scan_status?: string; summary?: { critical?: number; high?: number; medium?: number; low?: number } }> };
    const overview = Object.values(artifact.scan_overview ?? {})[0];
    if (!overview) return null;
    return {
      scanStatus: overview.scan_status ?? 'Unknown',
      critical: overview.summary?.critical ?? 0,
      high: overview.summary?.high ?? 0,
      medium: overview.summary?.medium ?? 0,
      low: overview.summary?.low ?? 0,
    };
  }
}
