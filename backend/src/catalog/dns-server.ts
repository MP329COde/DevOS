export interface PowerDNSClientOptions {
  baseUrl: string;
  apiKey: string;
  serverId?: string;
  fetchImpl?: typeof fetch;
}

export interface PowerDNSZone {
  id: string;
  name: string;
  kind: string;
  serial: number;
}

export interface PowerDNSRecordSet {
  name: string;
  type: string;
  ttl: number;
  records: string[];
}

interface RawRecordSet {
  name: string;
  type: string;
  ttl: number;
  records: Array<{ content: string; disabled?: boolean }>;
}

interface RawZoneDetail {
  rrsets: RawRecordSet[];
}

/** Read-only client for the PowerDNS HTTP API (zones, records), authenticated via the X-API-Key header. */
export class PowerDNSClient {
  private readonly fetchImpl: typeof fetch;
  private readonly serverId: string;

  public constructor(private readonly options: PowerDNSClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.serverId = options.serverId ?? 'localhost';
  }

  public async listZones(): Promise<PowerDNSZone[]> {
    return this.request<PowerDNSZone[]>(`/api/v1/servers/${encodeURIComponent(this.serverId)}/zones`);
  }

  public async getZoneRecords(zoneId: string): Promise<PowerDNSRecordSet[]> {
    const zone = await this.request<RawZoneDetail>(
      `/api/v1/servers/${encodeURIComponent(this.serverId)}/zones/${encodeURIComponent(zoneId)}`,
    );
    return zone.rrsets.map((rrset) => ({
      name: rrset.name,
      type: rrset.type,
      ttl: rrset.ttl,
      records: rrset.records.map((record) => record.content),
    }));
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
      headers: { 'X-API-Key': this.options.apiKey },
    });
    if (!response.ok) throw new Error(`PowerDNS API request failed (${response.status})`);
    return (await response.json()) as T;
  }
}
