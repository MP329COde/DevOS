import type { AcmeAccount, Certificate, Domain, DnsProviderAccount, DnsProviderKind, DomainState, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { createAccountKey, issueCertificate } from '../integrations/acme.js';
import { createDnsProviderClient } from '../integrations/dns-providers.js';
import type { HAProxyAcl, HAProxyClient } from '../integrations/haproxy.js';
import type { VaultClient } from '../infrastructure/vault.js';
import { resolveDomainHAProxyLink, type DomainHAProxyLink } from '../catalog/domain-haproxy-link.js';

const DOMAIN_SECRETS_MOUNT = 'devos-domains';
const CERTIFICATE_EXPIRING_THRESHOLD_DAYS = 30;

export interface CreateDomainInput {
  name: string;
  target?: string;
  dnsProviderId?: string;
  haproxyFrontend?: string;
  siteItemId?: string;
}

export interface UpdateDomainInput {
  target?: string;
  state?: DomainState;
  dnsProviderId?: string | null;
  haproxyFrontend?: string | null;
  siteItemId?: string | null;
}

export interface CreateDnsProviderAccountInput {
  name: string;
  kind: DnsProviderKind;
  token: string;
  config?: Record<string, unknown>;
}

export interface CreateAcmeAccountInput {
  name: string;
  directoryUrl: string;
  contactEmail: string;
}

/**
 * Stores DNS-provider and ACME secrets in Vault under a mount dedicated to the Domains module,
 * following the exact pattern of `SecretsService` (`backend/src/tasks/secrets-service.ts`):
 * only a name is ever kept in Postgres, the value never leaves Vault except when explicitly
 * needed to call a provider or the ACME directory.
 */
export class DomainSecretsService {
  public constructor(private readonly vault: VaultClient) {}

  public async set(name: string, value: string): Promise<void> {
    await this.vault.writeKv2(`${DOMAIN_SECRETS_MOUNT}/${name}`, { value });
  }

  public async reveal(name: string): Promise<string> {
    const secret = await this.vault.readKv2<{ value: string }>(`${DOMAIN_SECRETS_MOUNT}/${name}`);
    return secret.value;
  }

  public async delete(name: string): Promise<void> {
    await this.vault.deleteKv2(`${DOMAIN_SECRETS_MOUNT}/${name}`);
  }
}

/**
 * Business logic for the Domains module: domains, their DNS-provider/ACME accounts, and the
 * certificates issued for them. The HAProxy frontend → ACL → backend → server path is always
 * resolved live from `HAProxyClient` (`haproxy` may be undefined when HAProxy isn't configured —
 * callers then get an empty link rather than an error, matching a domain that simply isn't
 * behind HAProxy yet).
 */
export class DomainService {
  public constructor(
    private readonly database: PrismaClient,
    private readonly secrets: DomainSecretsService,
    private readonly haproxy: HAProxyClient | undefined,
  ) {}

  public listDomains(): Promise<Domain[]> {
    return this.database.domain.findMany({ orderBy: { name: 'asc' } });
  }

  public getDomain(id: string): Promise<Domain | null> {
    return this.database.domain.findUnique({ where: { id } });
  }

  public createDomain(input: CreateDomainInput): Promise<Domain> {
    return this.database.domain.create({
      data: {
        name: input.name,
        target: input.target,
        dnsProviderId: input.dnsProviderId,
        haproxyFrontend: input.haproxyFrontend,
        siteItemId: input.siteItemId,
      },
    });
  }

  public updateDomain(id: string, input: UpdateDomainInput): Promise<Domain> {
    return this.database.domain.update({
      where: { id },
      data: {
        target: input.target,
        state: input.state,
        dnsProviderId: input.dnsProviderId,
        haproxyFrontend: input.haproxyFrontend,
        siteItemId: input.siteItemId,
      },
    });
  }

  public async deleteDomain(id: string): Promise<void> {
    await this.database.domain.delete({ where: { id } });
  }

  /**
   * Resolves DNS + updates state. If the domain's provider account supports pushing records
   * (`updateRecord`) and the domain has a `target` IP, the record is (re)published first so a
   * newly created domain becomes resolvable before being checked.
   */
  public async checkDomain(id: string): Promise<Domain> {
    const domain = await this.requireDomain(id);
    let state: DomainState = domain.state;
    let lastError: string | null = null;

    try {
      if (domain.dnsProviderId && domain.target) {
        const provider = await this.buildProviderClient(domain.dnsProviderId);
        await provider.client.updateRecord(subdomainOf(domain.name, provider.account), domain.target);
        const { resolvedIp } = await provider.client.verify(subdomainOf(domain.name, provider.account));
        state = resolvedIp && resolvedIp === domain.target ? 'active' : 'pending';
      } else {
        state = domain.target ? 'active' : 'pending';
      }
    } catch (error) {
      state = 'error';
      lastError = error instanceof Error ? error.message : 'Domain check failed';
    }

    return this.database.domain.update({
      where: { id },
      data: { state, lastError, lastCheckedAt: new Date() },
    });
  }

  public async getHaproxyLink(id: string): Promise<DomainHAProxyLink> {
    const domain = await this.requireDomain(id);
    if (!this.haproxy) return { servers: [] };

    const [frontends, backends] = await Promise.all([this.haproxy.listFrontends(), this.haproxy.listBackends()]);
    const relevantFrontends = domain.haproxyFrontend ? frontends.filter((frontend) => frontend.name === domain.haproxyFrontend) : frontends;

    const aclsByFrontend = new Map<string, HAProxyAcl[]>();
    for (const frontend of relevantFrontends) {
      aclsByFrontend.set(frontend.name, await this.haproxy.listAcls('frontend', frontend.name));
    }

    const link = resolveDomainHAProxyLink(domain.name, {
      frontends,
      backends,
      aclsByFrontend,
      serversByBackend: new Map(),
      preferredFrontend: domain.haproxyFrontend ?? undefined,
    });

    if (!link.backend) return link;
    const servers = await this.haproxy.listServers(link.backend.name);
    return { ...link, servers };
  }

  public listDnsProviderAccounts(): Promise<DnsProviderAccount[]> {
    return this.database.dnsProviderAccount.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] });
  }

  public async createDnsProviderAccount(input: CreateDnsProviderAccountInput): Promise<DnsProviderAccount> {
    const vaultSecretName = `dns-provider/${input.kind}/${randomUUID()}`;
    await this.secrets.set(vaultSecretName, input.token);
    return this.database.dnsProviderAccount.create({
      data: { name: input.name, kind: input.kind, vaultSecretName, config: input.config as never },
    });
  }

  public async deleteDnsProviderAccount(id: string): Promise<void> {
    const account = await this.database.dnsProviderAccount.findUniqueOrThrow({ where: { id } });
    await this.database.dnsProviderAccount.delete({ where: { id } });
    await this.secrets.delete(account.vaultSecretName);
  }

  public listAcmeAccounts(): Promise<AcmeAccount[]> {
    return this.database.acmeAccount.findMany({ orderBy: { name: 'asc' } });
  }

  public async createAcmeAccount(input: CreateAcmeAccountInput): Promise<AcmeAccount> {
    const vaultSecretName = `acme-account/${randomUUID()}`;
    await this.secrets.set(vaultSecretName, await createAccountKey());
    return this.database.acmeAccount.create({
      data: { name: input.name, directoryUrl: input.directoryUrl, contactEmail: input.contactEmail, vaultSecretName },
    });
  }

  public async deleteAcmeAccount(id: string): Promise<void> {
    const account = await this.database.acmeAccount.findUniqueOrThrow({ where: { id } });
    await this.database.acmeAccount.delete({ where: { id } });
    await this.secrets.delete(account.vaultSecretName);
  }

  public listCertificates(domainId: string): Promise<Certificate[]> {
    return this.database.certificate.findMany({ where: { domainId }, orderBy: { createdAt: 'desc' } });
  }

  /**
   * Issues a certificate via ACME DNS-01, using the domain's own DNS-provider account to
   * publish/clear the challenge TXT record. Fails fast with a clear error when that account
   * doesn't support DNS-01 (e.g. DuckDNS) rather than silently falling back to anything else.
   */
  public async issueCertificateFor(domainId: string, acmeAccountId: string): Promise<Certificate> {
    const domain = await this.requireDomain(domainId);
    if (!domain.dnsProviderId) throw new Error('Domain has no DNS provider account configured');

    const acmeAccount = await this.database.acmeAccount.findUniqueOrThrow({ where: { id: acmeAccountId } });
    const provider = await this.buildProviderClient(domain.dnsProviderId);
    if (!provider.client.supportsDns01 || !provider.client.setTxtRecord || !provider.client.clearTxtRecord) {
      throw new Error(`DNS provider account "${provider.account.name}" (${provider.account.kind}) does not support ACME DNS-01 challenges`);
    }

    const accountKeyPem = await this.secrets.reveal(acmeAccount.vaultSecretName);
    const record = await this.database.certificate.create({
      data: { domainId, acmeAccountId, state: 'pending', vaultSecretName: `certificate/${randomUUID()}` },
    });

    try {
      const result = await issueCertificate({
        domain: domain.name,
        accountKeyPem,
        contactEmail: acmeAccount.contactEmail,
        directoryUrl: acmeAccount.directoryUrl,
        dns01Challenge: (recordName, value) => provider.client.setTxtRecord!(recordName, value),
        cleanupChallenge: (recordName) => provider.client.clearTxtRecord!(recordName),
      });
      await this.secrets.set(record.vaultSecretName, JSON.stringify({ certificatePem: result.certificatePem, privateKeyPem: result.privateKeyPem }));
      return this.database.certificate.update({
        where: { id: record.id },
        data: { state: 'valid', issuedAt: new Date(), expiresAt: result.expiresAt, lastError: null },
      });
    } catch (error) {
      return this.database.certificate.update({
        where: { id: record.id },
        data: { state: 'error', lastError: error instanceof Error ? error.message : 'Certificate issuance failed' },
      });
    }
  }

  /** Certificates within `CERTIFICATE_EXPIRING_THRESHOLD_DAYS` are re-issued; called by a periodic job or an external cron hitting the renew-check route. */
  public async renewExpiringCertificates(): Promise<void> {
    const threshold = new Date(Date.now() + CERTIFICATE_EXPIRING_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
    const expiring = await this.database.certificate.findMany({ where: { state: 'valid', expiresAt: { lt: threshold } } });
    for (const certificate of expiring) {
      await this.issueCertificateFor(certificate.domainId, certificate.acmeAccountId);
    }
  }

  private async requireDomain(id: string): Promise<Domain> {
    return this.database.domain.findUniqueOrThrow({ where: { id } });
  }

  private async buildProviderClient(dnsProviderId: string) {
    const account = await this.database.dnsProviderAccount.findUniqueOrThrow({ where: { id: dnsProviderId } });
    const token = await this.secrets.reveal(account.vaultSecretName);
    const client = createDnsProviderClient(account.kind, { token, config: (account.config as Record<string, unknown>) ?? undefined });
    return { account, client };
  }
}

function subdomainOf(domainName: string, account: DnsProviderAccount): string {
  const suffix = (account.config as Record<string, unknown> | null)?.domainSuffix;
  if (typeof suffix === 'string' && domainName.endsWith(`.${suffix}`)) return domainName.slice(0, -(suffix.length + 1));
  return domainName;
}
