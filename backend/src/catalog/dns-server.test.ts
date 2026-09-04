import assert from 'node:assert/strict';
import test from 'node:test';

import { PowerDNSClient } from './dns-server.js';

function client(fetchImpl: typeof fetch, serverId?: string) {
  return new PowerDNSClient({ baseUrl: 'https://powerdns.test', apiKey: 'secret-key', serverId, fetchImpl });
}

test('sends the X-API-Key header', async () => {
  let receivedKey: string | null = null;
  await client(async (_input, init) => {
    receivedKey = new Headers(init?.headers).get('X-API-Key');
    return new Response('[]', { status: 200 });
  }).listZones();
  assert.equal(receivedKey, 'secret-key');
});

test('lists zones using the default localhost server id', async () => {
  let requestedUrl = '';
  const zones = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify([{ id: 'example.com.', name: 'example.com.', kind: 'Native', serial: 2026090301 }]),
      { status: 200 },
    );
  }).listZones();
  assert.equal(requestedUrl, 'https://powerdns.test/api/v1/servers/localhost/zones');
  assert.deepEqual(zones, [{ id: 'example.com.', name: 'example.com.', kind: 'Native', serial: 2026090301 }]);
});

test('lists zones using a custom server id', async () => {
  let requestedUrl = '';
  await client(async (input) => {
    requestedUrl = String(input);
    return new Response('[]', { status: 200 });
  }, 'primary').listZones();
  assert.equal(requestedUrl, 'https://powerdns.test/api/v1/servers/primary/zones');
});

test('gets zone records, mapping rrsets and record content', async () => {
  let requestedUrl = '';
  const records = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        rrsets: [
          {
            name: 'www.example.com.',
            type: 'A',
            ttl: 3600,
            records: [{ content: '10.0.0.1', disabled: false }, { content: '10.0.0.2', disabled: false }],
          },
        ],
      }),
      { status: 200 },
    );
  }).getZoneRecords('example.com.');
  assert.equal(requestedUrl, 'https://powerdns.test/api/v1/servers/localhost/zones/example.com.');
  assert.deepEqual(records, [{ name: 'www.example.com.', type: 'A', ttl: 3600, records: ['10.0.0.1', '10.0.0.2'] }]);
});

test('rejects failed PowerDNS API responses', async () => {
  await assert.rejects(() => client(async () => new Response('{}', { status: 403 })).listZones(), /failed \(403\)/);
});
