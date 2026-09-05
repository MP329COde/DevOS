import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { checkForUpdate, compareVersions, readCurrentVersion, type UpdateCheckClient } from './update-checker.js';

function withPackageJson(content: unknown): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'devos-update-checker-'));
  const path = join(dir, 'package.json');
  writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content), 'utf8');
  return { path, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('readCurrentVersion reads the version field', () => {
  const { path, cleanup } = withPackageJson({ name: 'devos', version: '1.4.2' });
  try {
    assert.equal(readCurrentVersion(path), '1.4.2');
  } finally {
    cleanup();
  }
});

test('readCurrentVersion throws a clear error when the file does not exist', () => {
  assert.throws(() => readCurrentVersion('/nonexistent/path/package.json'), /unable to read/);
});

test('readCurrentVersion throws a clear error on invalid JSON', () => {
  const { path, cleanup } = withPackageJson('{ not valid json');
  try {
    assert.throws(() => readCurrentVersion(path), /not valid JSON/);
  } finally {
    cleanup();
  }
});

test('readCurrentVersion throws a clear error when version is missing', () => {
  const { path, cleanup } = withPackageJson({ name: 'devos' });
  try {
    assert.throws(() => readCurrentVersion(path), /missing a version field/);
  } finally {
    cleanup();
  }
});

test('compareVersions reports up-to-date when equal', () => {
  assert.equal(compareVersions('1.4.2', '1.4.2'), 'up-to-date');
});

test('compareVersions reports update-available and strips a leading v', () => {
  assert.equal(compareVersions('1.4.2', 'v1.5.0'), 'update-available');
});

test('compareVersions reports ahead when current is newer', () => {
  assert.equal(compareVersions('2.0.0', '1.9.9'), 'ahead');
});

test('compareVersions compares patch versions correctly', () => {
  assert.equal(compareVersions('1.4.2', '1.4.10'), 'update-available');
});

test('checkForUpdate returns update-available with a mocked client', async () => {
  const { path, cleanup } = withPackageJson({ version: '1.0.0' });
  try {
    const client: UpdateCheckClient = { getLatestReleaseTag: async () => 'v1.1.0' };
    const result = await checkForUpdate(path, client);
    assert.deepEqual(result, { current: '1.0.0', latest: 'v1.1.0', status: 'update-available' });
  } finally {
    cleanup();
  }
});

test('checkForUpdate includes the changelog entry when the client provides one', async () => {
  const { path, cleanup } = withPackageJson({ version: '1.0.0' });
  try {
    const client: UpdateCheckClient = {
      getLatestReleaseTag: async () => 'v1.1.0',
      getLatestReleaseInfo: async () => ({ tag: 'v1.1.0', title: 'Release 1.1.0', releasedAt: '2026-09-01T00:00:00Z' }),
    };
    const result = await checkForUpdate(path, client);
    assert.deepEqual(result, {
      current: '1.0.0',
      latest: 'v1.1.0',
      status: 'update-available',
      changelog: { tag: 'v1.1.0', title: 'Release 1.1.0', releasedAt: '2026-09-01T00:00:00Z' },
    });
  } finally {
    cleanup();
  }
});

test('checkForUpdate returns unknown when the client has no release tag', async () => {
  const { path, cleanup } = withPackageJson({ version: '1.0.0' });
  try {
    const client: UpdateCheckClient = { getLatestReleaseTag: async () => null };
    const result = await checkForUpdate(path, client);
    assert.deepEqual(result, { current: '1.0.0', latest: null, status: 'unknown' });
  } finally {
    cleanup();
  }
});
