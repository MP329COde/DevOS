export interface FileShareSummary {
  activeConnections: number;
  freeSpacePercent: number | null;
}

/**
 * Summarizes Samba/NFS share status from a `samba_exporter`-style Prometheus scrape
 * (fetched via `PrometheusExporterClient` from ./prometheus-metrics.js). Active SMB
 * connections come from `samba_smb2_connect{}`; free space percentage is derived from
 * matching `node_filesystem_free_bytes{...}` / `node_filesystem_size_bytes{...}` pairs
 * (same label set), taking the first matching pair found.
 */
export function summarizeFileShareMetrics(metrics: Map<string, number>): FileShareSummary {
  const activeConnections = metrics.get('samba_smb2_connect{}') ?? 0;

  let freeSpacePercent: number | null = null;
  for (const [key, freeBytes] of metrics) {
    const match = /^node_filesystem_free_bytes(\{.*\})$/.exec(key);
    if (!match) continue;
    const sizeKey = `node_filesystem_size_bytes${match[1]}`;
    const sizeBytes = metrics.get(sizeKey);
    if (sizeBytes === undefined || sizeBytes === 0) continue;
    freeSpacePercent = (freeBytes / sizeBytes) * 100;
    break;
  }

  return { activeConnections, freeSpacePercent };
}
