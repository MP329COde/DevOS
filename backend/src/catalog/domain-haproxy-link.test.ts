import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDomainHAProxyLink } from './domain-haproxy-link.js';

test('resolves frontend, ACL, backend and servers for a matching Host header ACL', () => {
  const link = resolveDomainHAProxyLink('app.example.com', {
    frontends: [{ name: 'fe_main' }],
    backends: [{ name: 'be_app' }],
    aclsByFrontend: new Map([['fe_main', [{ index: 0, aclName: 'is_be_app', criterion: 'hdr(host)', value: 'app.example.com' }]]]),
    serversByBackend: new Map([['be_app', [{ name: 'srv1', address: '10.0.0.1', port: 8080 }]]]),
  });

  assert.equal(link.frontend?.name, 'fe_main');
  assert.equal(link.acl?.aclName, 'is_be_app');
  assert.equal(link.backend?.name, 'be_app');
  assert.deepEqual(link.servers, [{ name: 'srv1', address: '10.0.0.1', port: 8080 }]);
});

test('returns an empty link when no ACL matches the domain', () => {
  const link = resolveDomainHAProxyLink('missing.example.com', {
    frontends: [{ name: 'fe_main' }],
    backends: [],
    aclsByFrontend: new Map([['fe_main', [{ index: 0, aclName: 'is_be_app', criterion: 'hdr(host)', value: 'app.example.com' }]]]),
    serversByBackend: new Map(),
  });

  assert.deepEqual(link, { servers: [] });
});

test('is case-insensitive when matching the domain against the ACL value', () => {
  const link = resolveDomainHAProxyLink('APP.example.com', {
    frontends: [{ name: 'fe_main' }],
    backends: [{ name: 'be_app' }],
    aclsByFrontend: new Map([['fe_main', [{ index: 0, aclName: 'is_be_app', criterion: 'hdr(host)', value: 'app.example.com' }]]]),
    serversByBackend: new Map(),
  });

  assert.equal(link.acl?.value, 'app.example.com');
});

test('narrows the search to preferredFrontend when set', () => {
  const link = resolveDomainHAProxyLink('app.example.com', {
    frontends: [{ name: 'fe_main' }, { name: 'fe_other' }],
    backends: [],
    aclsByFrontend: new Map([
      ['fe_main', []],
      ['fe_other', [{ index: 0, aclName: 'is_be_app', criterion: 'hdr(host)', value: 'app.example.com' }]],
    ]),
    serversByBackend: new Map(),
    preferredFrontend: 'fe_main',
  });

  assert.deepEqual(link, { servers: [] });
});
