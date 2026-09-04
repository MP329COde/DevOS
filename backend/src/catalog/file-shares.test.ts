import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeFileShareMetrics } from './file-shares.js';

test('reads active SMB connection count when present', () => {
  const metrics = new Map([['samba_smb2_connect{}', 12]]);
  const summary = summarizeFileShareMetrics(metrics);
  assert.equal(summary.activeConnections, 12);
});

test('defaults active connections to 0 when metric is absent', () => {
  const summary = summarizeFileShareMetrics(new Map());
  assert.equal(summary.activeConnections, 0);
});

test('computes free space percent from matching labeled free/size metrics', () => {
  const metrics = new Map([
    ['node_filesystem_free_bytes{mountpoint="/srv/share"}', 25],
    ['node_filesystem_size_bytes{mountpoint="/srv/share"}', 100],
  ]);
  const summary = summarizeFileShareMetrics(metrics);
  assert.equal(summary.freeSpacePercent, 25);
});

test('returns null free space percent when size metric is missing', () => {
  const metrics = new Map([['node_filesystem_free_bytes{mountpoint="/srv/share"}', 25]]);
  const summary = summarizeFileShareMetrics(metrics);
  assert.equal(summary.freeSpacePercent, null);
});

test('returns null free space percent when metrics map is empty', () => {
  const summary = summarizeFileShareMetrics(new Map());
  assert.equal(summary.freeSpacePercent, null);
});

test('does not match free/size metrics with different labels', () => {
  const metrics = new Map([
    ['node_filesystem_free_bytes{mountpoint="/srv/share"}', 25],
    ['node_filesystem_size_bytes{mountpoint="/other"}', 100],
  ]);
  const summary = summarizeFileShareMetrics(metrics);
  assert.equal(summary.freeSpacePercent, null);
});

test('combines active connections and free space percent when both present', () => {
  const metrics = new Map([
    ['samba_smb2_connect{}', 3],
    ['node_filesystem_free_bytes{mountpoint="/srv/share"}', 50],
    ['node_filesystem_size_bytes{mountpoint="/srv/share"}', 200],
  ]);
  const summary = summarizeFileShareMetrics(metrics);
  assert.deepEqual(summary, { activeConnections: 3, freeSpacePercent: 25 });
});
