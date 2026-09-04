import assert from 'node:assert/strict';
import test from 'node:test';

import { parsePrometheusText, PrometheusExporterClient } from './prometheus-metrics.js';

function client(fetchImpl: typeof fetch) {
  return new PrometheusExporterClient({ baseUrl: 'https://exporter.test', fetchImpl });
}

test('requests the /metrics endpoint on the configured base URL', async () => {
  let requestedUrl = '';
  await client(async (input) => { requestedUrl = String(input); return new Response('', { status: 200 }); }).getMetrics();
  assert.equal(requestedUrl, 'https://exporter.test/metrics');
});

test('parses basic metric lines without labels', async () => {
  const body = 'pg_up 1\npg_stat_database_numbackends 5\n';
  const metrics = await client(async () => new Response(body, { status: 200 })).getMetrics();
  assert.equal(metrics.get('pg_up'), 1);
  assert.equal(metrics.get('pg_stat_database_numbackends'), 5);
});

test('ignores comment, HELP and TYPE lines', async () => {
  const body = [
    '# HELP pg_up Whether the last scrape succeeded',
    '# TYPE pg_up gauge',
    'pg_up 1',
    '',
  ].join('\n');
  const metrics = await client(async () => new Response(body, { status: 200 })).getMetrics();
  assert.equal(metrics.size, 1);
  assert.equal(metrics.get('pg_up'), 1);
});

test('parses metrics with labels, keying by the full metric{labels} text', async () => {
  const body = 'pg_stat_database_tup_fetched{datname="app"} 42\n';
  const metrics = await client(async () => new Response(body, { status: 200 })).getMetrics();
  assert.equal(metrics.get('pg_stat_database_tup_fetched{datname="app"}'), 42);
});

test('parses floating point and scientific notation values', () => {
  const metrics = parsePrometheusText('process_cpu_seconds_total 1.5e+03\nprocess_resident_memory_bytes 12345.678\n');
  assert.equal(metrics.get('process_cpu_seconds_total'), 1500);
  assert.equal(metrics.get('process_resident_memory_bytes'), 12345.678);
});

test('rejects a failed exporter HTTP response', async () => {
  await assert.rejects(() => client(async () => new Response('', { status: 503 })).getMetrics(), /failed \(503\)/);
});
