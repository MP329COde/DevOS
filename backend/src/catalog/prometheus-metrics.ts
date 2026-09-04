export interface PrometheusExporterClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

/**
 * Thin read-only client for a Prometheus exporter's `/metrics` endpoint (e.g. postgres_exporter,
 * mysqld_exporter, mongodb_exporter). Exporters are typically unauthenticated on the internal
 * homelab network, so no credentials are handled here.
 */
export class PrometheusExporterClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: PrometheusExporterClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async getMetrics(): Promise<Map<string, number>> {
    const response = await this.fetchImpl(`${this.options.baseUrl}/metrics`);
    if (!response.ok) throw new Error(`Prometheus exporter request failed (${response.status})`);
    const body = await response.text();
    return parsePrometheusText(body);
  }
}

/**
 * Parses the Prometheus text exposition format's simple (non-histogram) lines:
 * `metric_name value` or `metric_name{label="x"} value`. Comment/HELP/TYPE lines (starting
 * with `#`) and blank lines are ignored. For metrics with labels, the Map key is the full
 * `metric_name{labels}` text as it appeared on the line.
 */
export function parsePrometheusText(body: string): Map<string, number> {
  const metrics = new Map<string, number>();
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const lastSpace = line.lastIndexOf(' ');
    if (lastSpace === -1) continue;

    const key = line.slice(0, lastSpace).trim();
    const rawValue = line.slice(lastSpace + 1).trim();
    const value = Number(rawValue);
    if (!key || Number.isNaN(value)) continue;

    metrics.set(key, value);
  }
  return metrics;
}
