import * as acme from 'acme-client';

export interface AcmeIssueRequest {
  domain: string;
  /** PEM-encoded ACME account private key, sourced from Vault by the caller. */
  accountKeyPem: string;
  contactEmail: string;
  directoryUrl: string;
  /** Publishes the DNS-01 challenge TXT record (`_acme-challenge.<domain>`) via the domain's DnsProviderClient. */
  dns01Challenge: (recordName: string, recordValue: string) => Promise<void>;
  /** Removes the TXT record once the challenge has been validated (or failed). */
  cleanupChallenge: (recordName: string) => Promise<void>;
}

export interface AcmeIssueResult {
  certificatePem: string;
  privateKeyPem: string;
  expiresAt: Date;
}

/**
 * Issues a certificate via ACME DNS-01. Requires the domain's DNS provider account to support
 * DNS-01 (`DnsProviderClient.supportsDns01`) — the caller is responsible for checking this and
 * surfacing a clear error otherwise (e.g. DuckDNS accounts, see `dns-providers.ts`).
 */
export async function issueCertificate(request: AcmeIssueRequest): Promise<AcmeIssueResult> {
  const client = new acme.Client({ directoryUrl: request.directoryUrl, accountKey: request.accountKeyPem });
  const [privateKeyPem, csrPem] = await acme.crypto.createCsr({ commonName: request.domain });

  const certificatePem = await client.auto({
    csr: csrPem,
    email: request.contactEmail,
    termsOfServiceAgreed: true,
    challengePriority: ['dns-01'],
    challengeCreateFn: async (_authz, challenge, keyAuthorization) => {
      if (challenge.type !== 'dns-01') throw new Error(`Unsupported ACME challenge type: ${challenge.type}`);
      await request.dns01Challenge(`_acme-challenge.${request.domain}`, keyAuthorization);
    },
    challengeRemoveFn: async (_authz, challenge) => {
      if (challenge.type !== 'dns-01') return;
      await request.cleanupChallenge(`_acme-challenge.${request.domain}`);
    },
  });

  const info = acme.crypto.readCertificateInfo(certificatePem);
  return { certificatePem, privateKeyPem: privateKeyPem.toString(), expiresAt: info.notAfter };
}

export async function createAccountKey(): Promise<string> {
  const key = await acme.crypto.createPrivateKey();
  return key.toString();
}
