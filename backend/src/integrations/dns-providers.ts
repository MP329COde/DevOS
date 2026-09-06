export type DnsProviderKind = 'duckdns' | 'cloudflare' | 'ovh' | 'manual';

export interface DnsProviderCredentials {
  /** API token/key for the account. Always sourced from Vault by the caller, never hardcoded. */
  token: string;
  /** Extra non-secret config (e.g. zone id for Cloudflare) — mirrors `DnsProviderAccount.config`. */
  config?: Record<string, unknown>;
}

/**
 * Generic dynamic-DNS provider abstraction. Each `DnsProviderAccount` gets its own client
 * instance built with its own credentials, so multiple accounts of the same `kind` (e.g. two
 * DuckDNS accounts) never share state and cannot interfere with each other's domains.
 */
export interface DnsProviderClient {
  readonly kind: DnsProviderKind;
  /** Whether this provider can serve an ACME DNS-01 challenge (TXT record) for its domains. */
  readonly supportsDns01: boolean;
  updateRecord(subdomain: string, ip: string): Promise<void>;
  verify(subdomain: string): Promise<{ resolvedIp: string | null }>;
  setTxtRecord?(recordName: string, value: string): Promise<void>;
  clearTxtRecord?(recordName: string): Promise<void>;
}

/**
 * DuckDNS only exposes a single "update" endpoint (IP address, no TXT records), so it cannot
 * serve an ACME DNS-01 challenge — `supportsDns01` stays false. See `acme.ts` for the fallback
 * this implies.
 */
export class DuckDnsClient implements DnsProviderClient {
  public readonly kind = 'duckdns' as const;
  public readonly supportsDns01 = false;
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly credentials: DnsProviderCredentials, fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  public async updateRecord(subdomain: string, ip: string): Promise<void> {
    const url = `https://www.duckdns.org/update?domains=${encodeURIComponent(subdomain)}&token=${encodeURIComponent(this.credentials.token)}&ip=${encodeURIComponent(ip)}`;
    const response = await this.fetchImpl(url);
    const text = (await response.text()).trim();
    if (!response.ok || !text.startsWith('OK')) throw new Error(`DuckDNS update failed for ${subdomain} (${text || response.status})`);
  }

  public async verify(subdomain: string): Promise<{ resolvedIp: string | null }> {
    const dns = await import('node:dns/promises');
    try {
      const addresses = await dns.resolve4(subdomain);
      return { resolvedIp: addresses[0] ?? null };
    } catch {
      return { resolvedIp: null };
    }
  }
}

/** Not implemented in this batch — the abstraction and account model already support it. */
class UnsupportedDnsProviderClient implements DnsProviderClient {
  public readonly supportsDns01 = false;
  public constructor(public readonly kind: DnsProviderKind) {}

  public async updateRecord(): Promise<void> {
    throw new Error(`DNS provider "${this.kind}" is not implemented yet`);
  }

  public async verify(): Promise<{ resolvedIp: string | null }> {
    throw new Error(`DNS provider "${this.kind}" is not implemented yet`);
  }
}

export function createDnsProviderClient(kind: DnsProviderKind, credentials: DnsProviderCredentials, fetchImpl?: typeof fetch): DnsProviderClient {
  if (kind === 'duckdns') return new DuckDnsClient(credentials, fetchImpl);
  if (kind === 'manual') return new UnsupportedDnsProviderClient('manual');
  return new UnsupportedDnsProviderClient(kind);
}
