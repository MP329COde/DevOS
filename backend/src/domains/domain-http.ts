import { assertCan, type Role } from '../auth/permissions.js';
import type { DomainHAProxyLink } from '../catalog/domain-haproxy-link.js';
import type { AcmeAccount, Certificate, Domain, DnsProviderAccount, DnsProviderKind, DomainState } from '@prisma/client';
import type { CreateAcmeAccountInput, CreateDnsProviderAccountInput, CreateDomainInput, UpdateDomainInput } from './domain-service.js';

export interface DomainHttpService {
  listDomains(): Promise<Domain[]>;
  getDomain(id: string): Promise<Domain | null>;
  createDomain(input: CreateDomainInput): Promise<Domain>;
  updateDomain(id: string, input: UpdateDomainInput): Promise<Domain>;
  deleteDomain(id: string): Promise<void>;
  checkDomain(id: string): Promise<Domain>;
  getHaproxyLink(id: string): Promise<DomainHAProxyLink>;
  listDnsProviderAccounts(): Promise<DnsProviderAccount[]>;
  createDnsProviderAccount(input: CreateDnsProviderAccountInput): Promise<DnsProviderAccount>;
  deleteDnsProviderAccount(id: string): Promise<void>;
  listAcmeAccounts(): Promise<AcmeAccount[]>;
  createAcmeAccount(input: CreateAcmeAccountInput): Promise<AcmeAccount>;
  deleteAcmeAccount(id: string): Promise<void>;
  listCertificates(domainId: string): Promise<Certificate[]>;
  issueCertificate(domainId: string, acmeAccountId: string): Promise<Certificate>;
}

export interface DomainHttpResponse {
  status: number;
  body: unknown;
}

export async function handleDomainRequest(method: string, path: string, body: unknown, role: Role | undefined, service: DomainHttpService): Promise<DomainHttpResponse> {
  try {
    if (method === 'GET' && path === '/api/domains') return { status: 200, body: await service.listDomains() };
    if (method === 'POST' && path === '/api/domains') {
      requireRole(role);
      const domain = await service.createDomain(parseCreateDomain(body));
      return { status: 201, body: domain };
    }

    if (method === 'GET' && path === '/api/domains/dns-provider-accounts') return { status: 200, body: await service.listDnsProviderAccounts() };
    if (method === 'POST' && path === '/api/domains/dns-provider-accounts') {
      requireRole(role);
      return { status: 201, body: await service.createDnsProviderAccount(parseCreateDnsProviderAccount(body)) };
    }
    const dnsAccount = path.match(/^\/api\/domains\/dns-provider-accounts\/([^/]+)$/);
    if (method === 'DELETE' && dnsAccount) {
      requireRole(role);
      await service.deleteDnsProviderAccount(decodeURIComponent(dnsAccount[1]));
      return { status: 204, body: null };
    }

    if (method === 'GET' && path === '/api/domains/acme-accounts') return { status: 200, body: await service.listAcmeAccounts() };
    if (method === 'POST' && path === '/api/domains/acme-accounts') {
      requireRole(role);
      return { status: 201, body: await service.createAcmeAccount(parseCreateAcmeAccount(body)) };
    }
    const acmeAccount = path.match(/^\/api\/domains\/acme-accounts\/([^/]+)$/);
    if (method === 'DELETE' && acmeAccount) {
      requireRole(role);
      await service.deleteAcmeAccount(decodeURIComponent(acmeAccount[1]));
      return { status: 204, body: null };
    }

    const check = path.match(/^\/api\/domains\/([^/]+)\/check$/);
    if (method === 'POST' && check) {
      requireRole(role);
      return { status: 200, body: await service.checkDomain(decodeURIComponent(check[1])) };
    }

    const haproxyLink = path.match(/^\/api\/domains\/([^/]+)\/haproxy-link$/);
    if (method === 'GET' && haproxyLink) return { status: 200, body: await service.getHaproxyLink(decodeURIComponent(haproxyLink[1])) };

    const certificates = path.match(/^\/api\/domains\/([^/]+)\/certificates$/);
    if (method === 'GET' && certificates) return { status: 200, body: await service.listCertificates(decodeURIComponent(certificates[1])) };

    const issue = path.match(/^\/api\/domains\/([^/]+)\/certificates\/issue$/);
    if (method === 'POST' && issue) {
      requireRole(role);
      const acmeAccountId = parseAcmeAccountId(body);
      return { status: 201, body: await service.issueCertificate(decodeURIComponent(issue[1]), acmeAccountId) };
    }

    const domain = path.match(/^\/api\/domains\/([^/]+)$/);
    if (method === 'GET' && domain) {
      const found = await service.getDomain(decodeURIComponent(domain[1]));
      if (!found) return { status: 404, body: { error: 'Domain not found' } };
      return { status: 200, body: found };
    }
    if (method === 'PUT' && domain) {
      requireRole(role);
      return { status: 200, body: await service.updateDomain(decodeURIComponent(domain[1]), parseUpdateDomain(body)) };
    }
    if (method === 'DELETE' && domain) {
      requireRole(role);
      await service.deleteDomain(decodeURIComponent(domain[1]));
      return { status: 204, body: null };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid domains request' } };
  }
}

function requireRole(role: Role | undefined): Role {
  if (!role) throw new Error('Authentication is required to manage domains');
  assertCan(role, 'execute_infrastructure');
  return role;
}

function parseCreateDomain(body: unknown): CreateDomainInput {
  if (!body || typeof body !== 'object') throw new Error('Invalid domain payload');
  const input = body as Record<string, unknown>;
  if (typeof input.name !== 'string' || !input.name.trim()) throw new Error('Domain name is required');
  return {
    name: input.name,
    target: typeof input.target === 'string' ? input.target : undefined,
    dnsProviderId: typeof input.dnsProviderId === 'string' ? input.dnsProviderId : undefined,
    haproxyFrontend: typeof input.haproxyFrontend === 'string' ? input.haproxyFrontend : undefined,
    siteItemId: typeof input.siteItemId === 'string' ? input.siteItemId : undefined,
  };
}

const DOMAIN_STATES: readonly DomainState[] = ['active', 'pending', 'error', 'expired', 'disabled'];

function parseUpdateDomain(body: unknown): UpdateDomainInput {
  if (!body || typeof body !== 'object') throw new Error('Invalid domain payload');
  const input = body as Record<string, unknown>;
  if (input.state !== undefined && !DOMAIN_STATES.includes(input.state as DomainState)) throw new Error('Invalid domain state');
  return {
    target: typeof input.target === 'string' ? input.target : undefined,
    state: input.state as DomainState | undefined,
    dnsProviderId: input.dnsProviderId === null ? null : typeof input.dnsProviderId === 'string' ? input.dnsProviderId : undefined,
    haproxyFrontend: input.haproxyFrontend === null ? null : typeof input.haproxyFrontend === 'string' ? input.haproxyFrontend : undefined,
    siteItemId: input.siteItemId === null ? null : typeof input.siteItemId === 'string' ? input.siteItemId : undefined,
  };
}

const DNS_PROVIDER_KINDS: readonly DnsProviderKind[] = ['duckdns', 'cloudflare', 'ovh', 'manual'];

function parseCreateDnsProviderAccount(body: unknown): CreateDnsProviderAccountInput {
  if (!body || typeof body !== 'object') throw new Error('Invalid DNS provider account payload');
  const input = body as Record<string, unknown>;
  if (typeof input.name !== 'string' || !input.name.trim()) throw new Error('DNS provider account name is required');
  if (typeof input.kind !== 'string' || !DNS_PROVIDER_KINDS.includes(input.kind as DnsProviderKind)) throw new Error('Invalid DNS provider kind');
  if (typeof input.token !== 'string' || !input.token) throw new Error('DNS provider account token is required');
  return {
    name: input.name,
    kind: input.kind as DnsProviderKind,
    token: input.token,
    config: typeof input.config === 'object' && input.config !== null ? (input.config as Record<string, unknown>) : undefined,
  };
}

function parseCreateAcmeAccount(body: unknown): CreateAcmeAccountInput {
  if (!body || typeof body !== 'object') throw new Error('Invalid ACME account payload');
  const input = body as Record<string, unknown>;
  if (typeof input.name !== 'string' || !input.name.trim()) throw new Error('ACME account name is required');
  if (typeof input.directoryUrl !== 'string' || !input.directoryUrl) throw new Error('ACME directory URL is required');
  if (typeof input.contactEmail !== 'string' || !input.contactEmail) throw new Error('ACME contact email is required');
  return { name: input.name, directoryUrl: input.directoryUrl, contactEmail: input.contactEmail };
}

function parseAcmeAccountId(body: unknown): string {
  if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).acmeAccountId !== 'string') {
    throw new Error('acmeAccountId is required to issue a certificate');
  }
  return (body as Record<string, unknown>).acmeAccountId as string;
}
