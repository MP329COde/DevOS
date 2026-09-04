export interface WireGuardSummary {
  peerCount: number;
}

/**
 * Summarizes WireGuard peer status from a `wireguard_exporter`-style Prometheus scrape
 * (fetched via `PrometheusExporterClient` from ./prometheus-metrics.js). Peer count is
 * the number of distinct `wireguard_peer_last_handshake_seconds{...}` series present.
 */
export function summarizeWireGuardMetrics(metrics: Map<string, number>): WireGuardSummary {
  let peerCount = 0;
  for (const key of metrics.keys()) {
    if (key.startsWith('wireguard_peer_last_handshake_seconds{')) peerCount += 1;
  }
  return { peerCount };
}

export interface SuricataClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

interface SuricataStatsResponse {
  alert?: { count?: number };
}

/** Thin read-only client for a Suricata EVE-over-HTTP stats endpoint (IDS/IPS alert counts). */
export class SuricataClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: SuricataClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async getAlertCount(): Promise<number> {
    const response = await this.fetchImpl(`${this.options.baseUrl}/stats`);
    if (!response.ok) throw new Error(`Suricata stats request failed (${response.status})`);
    const body = (await response.json()) as SuricataStatsResponse;
    return body.alert?.count ?? 0;
  }
}
