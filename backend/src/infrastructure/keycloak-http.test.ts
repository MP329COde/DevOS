import assert from 'node:assert/strict';
import test from 'node:test';

import { handleAuthCallback } from './keycloak-http.js';

test('turns a valid callback into an HttpOnly opaque session cookie', async () => {
  const response = await handleAuthCallback(
    { code: 'code', codeVerifier: 'verifier' },
    { async completeLogin(code, verifier) {
      assert.equal(code, 'code');
      assert.equal(verifier, 'verifier');
      return 'opaque-session';
    } },
  );

  assert.equal(response.status, 204);
  assert.match(response.headers['set-cookie'], /HttpOnly/);
  assert.match(response.headers['set-cookie'], /Secure/);
  assert.match(response.headers['set-cookie'], /opaque-session/);
});

test('rejects malformed callback payloads before calling Keycloak', async () => {
  let called = false;
  const response = await handleAuthCallback({}, { async completeLogin() { called = true; return 'unused'; } });

  assert.equal(response.status, 400);
  assert.equal(called, false);
});