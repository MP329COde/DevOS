import assert from 'node:assert/strict';
import test from 'node:test';

import { MinioClient } from './minio.js';

function client(fetchImpl: typeof fetch) {
  return new MinioClient({ baseUrl: 'https://minio.test', accessKey: 'AKIA123', secretKey: 's3cr3t', fetchImpl });
}

test('lists buckets from the admin API', async () => {
  let requestedUrl = '';
  const buckets = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify([{ name: 'backups', size: 1024, objectCount: 3 }]), { status: 200 });
  }).listBuckets();
  assert.equal(requestedUrl, 'https://minio.test/minio/admin/v3/list-buckets');
  assert.deepEqual(buckets, [{ name: 'backups', size: 1024, objectCount: 3 }]);
});

test('sends the access/secret key pair as a bearer token', async () => {
  let receivedAuth: string | null = null;
  await client(async (_input, init) => { receivedAuth = new Headers(init?.headers).get('authorization'); return new Response('[]', { status: 200 }); }).listBuckets();
  assert.equal(receivedAuth, 'Bearer AKIA123:s3cr3t');
});

test('returns an empty array when no buckets exist', async () => {
  const buckets = await client(async () => new Response('[]', { status: 200 })).listBuckets();
  assert.deepEqual(buckets, []);
});

test('rejects failed MinIO admin API responses', async () => {
  await assert.rejects(() => client(async () => new Response('{}', { status: 403 })).listBuckets(), /failed \(403\)/);
});

test('returns multiple buckets with usage details', async () => {
  const body = [
    { name: 'photos', size: 500, objectCount: 10 },
    { name: 'documents', size: 200, objectCount: 4 },
  ];
  const buckets = await client(async () => new Response(JSON.stringify(body), { status: 200 })).listBuckets();
  assert.equal(buckets.length, 2);
  assert.equal(buckets[1]?.name, 'documents');
});
