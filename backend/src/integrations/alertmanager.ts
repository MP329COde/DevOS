export interface AlertmanagerClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export interface AlertmanagerAlert {
  fingerprint: string;
  labels: Record<string, string>;
  status: { state: string };
  startsAt: string;
}

/**
 * Thin read-only client for the Alertmanager v2 HTTP API. Alertmanager is typically
 * unauthenticated on the internal homelab network, so no credentials are handled here.
 */
export class AlertmanagerClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: AlertmanagerClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async listActiveAlerts(): Promise<AlertmanagerAlert[]> {
    const response = await this.fetchImpl(`${this.options.baseUrl}/api/v2/alerts?active=true`);
    if (!response.ok) throw new Error(`Alertmanager API request failed (${response.status})`);
    const body = (await response.json()) as Array<{
      fingerprint: string;
      labels?: Record<string, string>;
      status?: { state: string };
      startsAt: string;
    }>;
    return body.map((alert) => ({
      fingerprint: alert.fingerprint,
      labels: alert.labels ?? {},
      status: { state: alert.status?.state ?? 'active' },
      startsAt: alert.startsAt,
    }));
  }
}
