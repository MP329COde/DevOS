import type { HAProxyAcl, HAProxyBackend, HAProxyFrontend, HAProxyServer } from '../integrations/haproxy.js';

export interface DomainHAProxyLink {
  frontend?: HAProxyFrontend;
  acl?: HAProxyAcl;
  backend?: HAProxyBackend;
  servers: HAProxyServer[];
}

/**
 * ACL criteria HAProxy commonly uses to route on a Host header. A domain "matches" an ACL when
 * the ACL's criterion looks like a host match and its value equals the domain name
 * (case-insensitive) — this is a best-effort read of the live config, not a stored mapping.
 */
const HOST_CRITERIA = new Set(['hdr(host)', 'req.hdr(host)', 'base', 'req.ssl_sni']);

/**
 * Resolves the live HAProxy path (frontend → ACL → backend → servers) serving a domain, purely
 * from data already read from the HAProxy Data Plane API — no relational storage of the
 * topology. `Domain.haproxyFrontend` (if set) narrows the frontend searched; otherwise every
 * frontend's ACLs are scanned for a host match.
 */
export function resolveDomainHAProxyLink(
  domainName: string,
  input: {
    frontends: readonly HAProxyFrontend[];
    backends: readonly HAProxyBackend[];
    aclsByFrontend: ReadonlyMap<string, readonly HAProxyAcl[]>;
    serversByBackend: ReadonlyMap<string, readonly HAProxyServer[]>;
    preferredFrontend?: string;
  },
): DomainHAProxyLink {
  const normalizedDomain = domainName.toLowerCase();
  const candidateFrontends = input.preferredFrontend
    ? input.frontends.filter((frontend) => frontend.name === input.preferredFrontend)
    : input.frontends;

  for (const frontend of candidateFrontends) {
    const acls = input.aclsByFrontend.get(frontend.name) ?? [];
    const acl = acls.find((candidate) => HOST_CRITERIA.has(candidate.criterion) && candidate.value.toLowerCase() === normalizedDomain);
    if (!acl) continue;

    const backendName = findUseBackendTarget(acl.aclName);
    const backend = backendName ? input.backends.find((candidate) => candidate.name === backendName) : undefined;
    const servers = backend ? Array.from(input.serversByBackend.get(backend.name) ?? []) : [];
    return { frontend, acl, backend, servers };
  }

  return { servers: [] };
}

/**
 * HAProxy's Data Plane API models `use_backend <backend> if <acl>` as a separate config object
 * from the ACL itself; this codebase's `HAProxyAcl` list doesn't currently carry that link, so
 * this falls back to naming convention (an ACL named `is_<backend>` or `host_<backend>`) when no
 * explicit target is available. Returns undefined when nothing matches — the caller then reports
 * the frontend/ACL without a backend rather than guessing.
 */
function findUseBackendTarget(aclName: string): string | undefined {
  const match = aclName.match(/^(?:is_|host_)(.+)$/);
  return match?.[1];
}
