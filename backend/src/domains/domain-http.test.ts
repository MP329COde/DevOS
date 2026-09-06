import assert from 'node:assert/strict';
import test from 'node:test';

import { handleDomainRequest, type DomainHttpService } from './domain-http.js';

const domain = { id: 'd1', name: 'app.example.com', target: '1.2.3.4', state: 'active', dnsProviderId: null, haproxyFrontend: null, siteItemId: null, lastCheckedAt: null, lastError: null, createdAt: new Date(), updatedAt: new Date() };

function service(overrides: Partial<DomainHttpService> = {}): DomainHttpService {
  return {
    listDomains: overrides.listDomains ?? (async () => [domain as never]),
    getDomain: overrides.getDomain ?? (async () => domain as never),
    createDomain: overrides.createDomain ?? (async () => domain as never),
    updateDomain: overrides.updateDomain ?? (async () => domain as never),
    deleteDomain: overrides.deleteDomain ?? (async () => undefined),
    checkDomain: overrides.checkDomain ?? (async () => domain as never),
    getHaproxyLink: overrides.getHaproxyLink ?? (async () => ({ servers: [] })),
    listDnsProviderAccounts: overrides.listDnsProviderAccounts ?? (async () => []),
    createDnsProviderAccount: overrides.createDnsProviderAccount ?? (async () => ({}) as never),
    deleteDnsProviderAccount: overrides.deleteDnsProviderAccount ?? (async () => undefined),
    listAcmeAccounts: overrides.listAcmeAccounts ?? (async () => []),
    createAcmeAccount: overrides.createAcmeAccount ?? (async () => ({}) as never),
    deleteAcmeAccount: overrides.deleteAcmeAccount ?? (async () => undefined),
    listCertificates: overrides.listCertificates ?? (async () => []),
    issueCertificate: overrides.issueCertificate ?? (async () => ({}) as never),
  };
}

test('lists domains', async () => {
  const result = await handleDomainRequest('GET', '/api/domains', undefined, 'Lecteur', service());
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, [domain]);
});

test('rejects creating a domain without a role', async () => {
  const result = await handleDomainRequest('POST', '/api/domains', { name: 'app.example.com' }, undefined, service());
  assert.equal(result.status, 400);
});

test('rejects creating a domain without execute_infrastructure', async () => {
  const result = await handleDomainRequest('POST', '/api/domains', { name: 'app.example.com' }, 'Contributeur', service());
  assert.equal(result.status, 400);
});

test('creates a domain with a valid payload', async () => {
  let received: unknown;
  const result = await handleDomainRequest('POST', '/api/domains', { name: 'app.example.com' }, 'Admin', service({ createDomain: async (input) => { received = input; return domain as never; } }));
  assert.equal(result.status, 201);
  assert.deepEqual(received, { name: 'app.example.com', target: undefined, dnsProviderId: undefined, haproxyFrontend: undefined, siteItemId: undefined });
});

test('rejects creating a domain without a name', async () => {
  const result = await handleDomainRequest('POST', '/api/domains', {}, 'Admin', service());
  assert.equal(result.status, 400);
});

test('404s for an unknown domain', async () => {
  const result = await handleDomainRequest('GET', '/api/domains/missing', undefined, 'Lecteur', service({ getDomain: async () => null }));
  assert.equal(result.status, 404);
});

test('returns the HAProxy link for a domain', async () => {
  const link = { frontend: { name: 'fe_main' }, servers: [] };
  const result = await handleDomainRequest('GET', '/api/domains/d1/haproxy-link', undefined, 'Lecteur', service({ getHaproxyLink: async () => link }));
  assert.deepEqual(result, { status: 200, body: link });
});

test('rejects an invalid DNS provider kind', async () => {
  const result = await handleDomainRequest('POST', '/api/domains/dns-provider-accounts', { name: 'acct', kind: 'nope', token: 'tok' }, 'Admin', service());
  assert.equal(result.status, 400);
});

test('creates a DNS provider account with a valid payload', async () => {
  const result = await handleDomainRequest('POST', '/api/domains/dns-provider-accounts', { name: 'acct', kind: 'duckdns', token: 'tok' }, 'Admin', service());
  assert.equal(result.status, 201);
});

test('rejects issuing a certificate without an acmeAccountId', async () => {
  const result = await handleDomainRequest('POST', '/api/domains/d1/certificates/issue', {}, 'Admin', service());
  assert.equal(result.status, 400);
});

test('issues a certificate with a valid payload', async () => {
  let received: [string, string] | undefined;
  const result = await handleDomainRequest('POST', '/api/domains/d1/certificates/issue', { acmeAccountId: 'a1' }, 'Admin', service({ issueCertificate: async (domainId, acmeAccountId) => { received = [domainId, acmeAccountId]; return {} as never; } }));
  assert.equal(result.status, 201);
  assert.deepEqual(received, ['d1', 'a1']);
});

test('deletes a domain', async () => {
  const result = await handleDomainRequest('DELETE', '/api/domains/d1', undefined, 'Admin', service());
  assert.deepEqual(result, { status: 204, body: null });
});

test('404s for an unmatched route', async () => {
  const result = await handleDomainRequest('GET', '/api/domains/d1/unknown-route', undefined, 'Lecteur', service());
  assert.equal(result.status, 404);
});
