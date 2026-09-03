import assert from 'node:assert/strict';
import test from 'node:test';

import { assertCan, can } from './permissions.js';

test('keeps the reader role read-only', () => {
  assert.equal(can('Lecteur', 'read'), true);
  assert.equal(can('Lecteur', 'update'), false);
  assert.equal(can('Lecteur', 'execute_infrastructure'), false);
});

test('allows contributors to collaborate without administration rights', () => {
  assert.equal(can('Contributeur', 'create'), true);
  assert.equal(can('Contributeur', 'comment'), true);
  assert.equal(can('Contributeur', 'manage_users'), false);
  assert.equal(can('Contributeur', 'manage_integrations'), false);
});

test('allows admins to perform every declared action', () => {
  assert.doesNotThrow(() => assertCan('Admin', 'execute_infrastructure'));
  assert.doesNotThrow(() => assertCan('Admin', 'manage_users'));
});

test('assertCan rejects unauthorized actions', () => {
  assert.throws(() => assertCan('Lecteur', 'delete'), /cannot perform delete/);
});