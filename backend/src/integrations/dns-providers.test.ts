import assert from 'node:assert/strict';
import test from 'node:test';

import { createDnsProviderClient, DuckDnsClient, type DnsProviderClient } from './dns-providers.js';

function fakeFetch(response: { ok: boolean; text: string }): typeof fetch {
  return (async () => ({ ok: response.ok, text: async () => response.text }) as Response) as typeof fetch;
}

test('DuckDnsClient.updateRecord resolves on "OK"', async () => {
  const client = new DuckDnsClient({ token: 'tok' }, fakeFetch({ ok: true, text: 'OK' }));
  await assert.doesNotReject(() => client.updateRecord('mysite', '1.2.3.4'));
});

test('DuckDnsClient.updateRecord throws on a non-OK body', async () => {
  const client = new DuckDnsClient({ token: 'tok' }, fakeFetch({ ok: true, text: 'KO' }));
  await assert.rejects(() => client.updateRecord('mysite', '1.2.3.4'), /DuckDNS update failed/);
});

test('DuckDnsClient does not support DNS-01 challenges', () => {
  const client: DnsProviderClient = new DuckDnsClient({ token: 'tok' });
  assert.equal(client.supportsDns01, false);
  assert.equal(client.setTxtRecord, undefined);
});

test('createDnsProviderClient builds a DuckDnsClient for kind "duckdns"', () => {
  const client = createDnsProviderClient('duckdns', { token: 'tok' });
  assert.equal(client.kind, 'duckdns');
});

test('createDnsProviderClient rejects unimplemented providers at call time', async () => {
  const client = createDnsProviderClient('cloudflare', { token: 'tok' });
  assert.equal(client.supportsDns01, false);
  await assert.rejects(() => client.updateRecord('sub', '1.2.3.4'), /not implemented/);
});
