export interface WazuhClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export interface WazuhAlert {
  id: string;
  ruleDescription: string;
  level: number;
  timestamp: string;
}

interface WazuhAlertsResponse {
  data: { affected_items: Array<{ id: string; rule: { description: string; level: number }; timestamp: string }> };
}

/** Thin read-only client for the Wazuh security API (alerts), authenticated via a pre-issued JWT token. */
export class WazuhClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: WazuhClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async listAlerts(limit?: number): Promise<WazuhAlert[]> {
    const path = limit === undefined ? '/security/alerts' : `/security/alerts?limit=${encodeURIComponent(String(limit))}`;
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, { headers: { authorization: `Bearer ${this.options.token}` } });
    if (!response.ok) throw new Error(`Wazuh API request failed (${response.status})`);
    const body = (await response.json()) as WazuhAlertsResponse;
    return body.data.affected_items.map((item) => ({ id: item.id, ruleDescription: item.rule.description, level: item.rule.level, timestamp: item.timestamp }));
  }
}
