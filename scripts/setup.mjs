#!/usr/bin/env node
// Interactive installer for DevOS. Asks the questions needed to produce a working `.env`
// file at the repo root, instead of requiring a human to hand-edit one.
//
// Pure Node.js, no external dependencies: node:readline/promises for prompting,
// node:fs for reading/writing files, node:crypto for generating a default webhook secret.

import { createInterface } from 'node:readline/promises';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..');
const ENV_PATH = join(REPO_ROOT, '.env');

/**
 * Definition of every optional integration: its display name, and the list of env vars
 * it needs. Each var has a key, a human prompt, and an optional default value.
 * These were extracted from backend/src/server.ts (build*FromEnv functions and the
 * require.main === module bootstrap) plus backend/src/infrastructure/keycloak.ts.
 */
const OPTIONAL_INTEGRATIONS = [
  {
    name: 'GitHub',
    vars: [
      { key: 'GITHUB_TOKEN', prompt: 'Token GitHub (PAT)' },
      { key: 'GITHUB_BASE_URL', prompt: 'URL de base API GitHub', default: 'https://api.github.com' },
    ],
  },
  {
    name: 'GitLab (catalogue, docs, scan, dashboard, releases)',
    vars: [
      { key: 'GITLAB_BASE_URL', prompt: 'URL de base API GitLab (ex: https://gitlab.example.com/api/v4)' },
      { key: 'GITLAB_TOKEN', prompt: 'Token GitLab' },
      { key: 'GITLAB_PROJECT_ID', prompt: 'ID du projet GitLab' },
      { key: 'DOCS_PATH', prompt: 'Chemin des docs dans le dépôt (optionnel)' },
    ],
  },
  {
    name: 'HAProxy',
    vars: [
      { key: 'HAPROXY_DATA_PLANE_URL', prompt: 'URL du Data Plane API HAProxy' },
      { key: 'HAPROXY_USERNAME', prompt: "Nom d'utilisateur HAProxy" },
      { key: 'HAPROXY_PASSWORD', prompt: 'Mot de passe HAProxy' },
    ],
  },
  {
    name: 'Coder',
    vars: [
      { key: 'CODER_BASE_URL', prompt: 'URL de base Coder' },
      { key: 'CODER_TOKEN', prompt: 'Token Coder' },
      { key: 'CODER_ORGANIZATION_ID', prompt: "ID de l'organisation Coder" },
      { key: 'CODER_OWNER', prompt: 'Propriétaire (owner) Coder' },
      { key: 'CODER_DEFAULT_TEMPLATE_ID', prompt: 'ID du template Coder par défaut (optionnel)' },
    ],
  },
  {
    name: 'Kubernetes',
    vars: [
      { key: 'K8S_API_SERVER', prompt: "URL du serveur API Kubernetes" },
      { key: 'K8S_TOKEN', prompt: 'Token Kubernetes' },
    ],
  },
  {
    name: 'ArgoCD',
    vars: [
      { key: 'ARGOCD_BASE_URL', prompt: 'URL de base ArgoCD' },
      { key: 'ARGOCD_TOKEN', prompt: 'Token ArgoCD' },
    ],
  },
  {
    name: 'Harbor (registre + Trivy)',
    vars: [
      { key: 'HARBOR_BASE_URL', prompt: 'URL de base Harbor' },
      { key: 'HARBOR_USERNAME', prompt: "Nom d'utilisateur Harbor" },
      { key: 'HARBOR_PASSWORD', prompt: 'Mot de passe Harbor' },
    ],
  },
  {
    name: 'Proxmox',
    vars: [
      { key: 'PROXMOX_BASE_URL', prompt: 'URL de base Proxmox' },
      { key: 'PROXMOX_API_TOKEN', prompt: 'Token API Proxmox' },
    ],
  },
  {
    name: 'Wazuh',
    vars: [
      { key: 'WAZUH_BASE_URL', prompt: 'URL de base Wazuh' },
      { key: 'WAZUH_TOKEN', prompt: 'Token Wazuh' },
    ],
  },
  {
    name: 'Grafana',
    vars: [
      { key: 'GRAFANA_BASE_URL', prompt: 'URL de base Grafana' },
      { key: 'GRAFANA_API_KEY', prompt: 'Clé API Grafana' },
    ],
  },
  {
    name: 'MinIO',
    vars: [
      { key: 'MINIO_BASE_URL', prompt: 'URL de base MinIO' },
      { key: 'MINIO_ACCESS_KEY', prompt: "Clé d'accès MinIO" },
      { key: 'MINIO_SECRET_KEY', prompt: 'Clé secrète MinIO' },
    ],
  },
  {
    name: 'RabbitMQ',
    vars: [
      { key: 'RABBITMQ_BASE_URL', prompt: 'URL de base RabbitMQ (API de management)' },
      { key: 'RABBITMQ_USERNAME', prompt: "Nom d'utilisateur RabbitMQ" },
      { key: 'RABBITMQ_PASSWORD', prompt: 'Mot de passe RabbitMQ' },
    ],
  },
  {
    name: 'PowerDNS',
    vars: [
      { key: 'POWERDNS_BASE_URL', prompt: 'URL de base PowerDNS' },
      { key: 'POWERDNS_API_KEY', prompt: 'Clé API PowerDNS' },
      { key: 'POWERDNS_SERVER_ID', prompt: 'ID du serveur PowerDNS (optionnel)' },
    ],
  },
  {
    name: 'Woodpecker CI',
    vars: [
      { key: 'WOODPECKER_BASE_URL', prompt: 'URL de base Woodpecker' },
      { key: 'WOODPECKER_TOKEN', prompt: 'Token Woodpecker' },
    ],
  },
  {
    name: 'Ollama',
    vars: [
      { key: 'OLLAMA_BASE_URL', prompt: 'URL de base Ollama' },
    ],
  },
  {
    name: 'Verdaccio',
    vars: [
      { key: 'VERDACCIO_BASE_URL', prompt: 'URL de base Verdaccio' },
      { key: 'VERDACCIO_TOKEN', prompt: 'Token Verdaccio (optionnel)' },
    ],
  },
  {
    name: 'Nexus',
    vars: [
      { key: 'NEXUS_BASE_URL', prompt: 'URL de base Nexus' },
      { key: 'NEXUS_USERNAME', prompt: "Nom d'utilisateur Nexus" },
      { key: 'NEXUS_PASSWORD', prompt: 'Mot de passe Nexus' },
    ],
  },
  {
    name: 'Meilisearch',
    vars: [
      { key: 'MEILISEARCH_BASE_URL', prompt: 'URL de base Meilisearch' },
      { key: 'MEILISEARCH_API_KEY', prompt: 'Clé API Meilisearch' },
    ],
  },
  {
    name: 'Redpanda',
    vars: [
      { key: 'REDPANDA_BASE_URL', prompt: 'URL de base Redpanda' },
      { key: 'REDPANDA_TOKEN', prompt: 'Token Redpanda (optionnel)' },
    ],
  },
  {
    name: 'Alertmanager',
    vars: [
      { key: 'ALERTMANAGER_BASE_URL', prompt: 'URL de base Alertmanager' },
    ],
  },
];

/**
 * Pure function: builds the textual content of the `.env` file from a flat map of
 * already-collected answers. No I/O, no readline — safe to unit test directly.
 *
 * Only keys with a non-empty, defined value are written. Values are wrapped in double
 * quotes and escaped so that values containing `#`, spaces, `"` or newlines round-trip
 * safely through a standard dotenv-style parser.
 *
 * @param {Record<string, string>} answers
 * @returns {string}
 */
export function buildEnvFileContent(answers) {
  const lines = [
    '# Generated by scripts/setup.mjs — DevOS environment configuration',
    `# ${new Date().toISOString()}`,
    '',
  ];

  for (const [key, value] of Object.entries(answers)) {
    if (value === undefined || value === null) continue;
    const stringValue = String(value);
    if (stringValue === '') continue;
    lines.push(`${key}=${formatEnvValue(stringValue)}`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Formats a single env value for safe inclusion in a `.env` file. Always double-quotes
 * the value so that `#`, spaces, and other shell-special characters are treated as
 * literal content rather than comments or word breaks.
 *
 * @param {string} value
 * @returns {string}
 */
function formatEnvValue(value) {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
  return `"${escaped}"`;
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answers = {};

  try {
    console.log('=== Installation de DevOS ===');
    console.log("Ce script pose quelques questions puis génère le fichier .env à la racine du dépôt.\n");

    console.log('-- Configuration de base (obligatoire) --');

    answers.DATABASE_URL = await ask(
      rl,
      'URL de connexion PostgreSQL',
      'postgresql://devos:devos-local-only@localhost:5432/devos?schema=public',
    );

    answers.REDIS_URL = await ask(rl, 'URL Redis', 'redis://localhost:6379');

    answers.KEYCLOAK_ISSUER_URL = await ask(
      rl,
      'Issuer Keycloak OIDC',
      'http://localhost:8081/realms/devos',
    );

    answers.KEYCLOAK_CLIENT_ID = await ask(rl, 'Client ID Keycloak', 'devos');

    answers.KEYCLOAK_CLIENT_SECRET_VAULT_PATH = await ask(
      rl,
      'Chemin Vault du secret client Keycloak (doit commencer par "secret/")',
      'secret/devos/keycloak-client',
    );

    answers.KEYCLOAK_REDIRECT_URI = await ask(
      rl,
      'URI de redirection OIDC',
      'http://localhost:5173/auth/callback',
    );

    const defaultWebhookSecret = randomBytes(24).toString('hex');
    answers.GITLAB_WEBHOOK_SECRET = await ask(
      rl,
      'Secret du webhook GitLab (laisser vide pour en générer un aléatoirement)',
      defaultWebhookSecret,
    );

    const frontendOrigin = await ask(
      rl,
      "Origine autorisée pour le frontend (CORS, optionnel)",
      'http://localhost:5173',
    );
    if (frontendOrigin) answers.FRONTEND_ORIGIN = frontendOrigin;

    console.log('\n-- Intégrations optionnelles --');
    console.log(`${OPTIONAL_INTEGRATIONS.length} intégrations disponibles. Répondez "o" pour en configurer une, ou appuyez sur Entrée pour la passer.\n`);

    let configuredCount = 0;
    for (const integration of OPTIONAL_INTEGRATIONS) {
      const wants = await askYesNo(rl, `Configurer ${integration.name} ?`);
      if (!wants) continue;

      configuredCount += 1;
      for (const variable of integration.vars) {
        const value = await ask(rl, variable.prompt, variable.default);
        if (value) answers[variable.key] = value;
      }
    }

    console.log('');

    if (existsSync(ENV_PATH)) {
      const overwrite = await askYesNo(
        rl,
        `Un fichier .env existe déjà (${ENV_PATH}). L'écraser ?`,
      );
      if (!overwrite) {
        console.log('Installation annulée : le fichier .env existant a été conservé.');
        return;
      }
      const backupPath = `${ENV_PATH}.bak`;
      copyFileSync(ENV_PATH, backupPath);
      console.log(`Sauvegarde créée : ${backupPath}`);
    }

    const content = buildEnvFileContent(answers);
    writeFileSync(ENV_PATH, content, 'utf8');

    console.log('\n=== Terminé ===');
    console.log(`Fichier écrit : ${ENV_PATH}`);
    console.log(`Intégrations optionnelles configurées : ${configuredCount} / ${OPTIONAL_INTEGRATIONS.length}`);
    console.log('\nProchaines étapes suggérées :');
    console.log('  1. npm install');
    console.log('  2. docker-compose up -d postgres redis');
    console.log('  3. npm run db:migrate');
    console.log('  4. npm run build');
    console.log('  5. docker-compose up -d');
  } finally {
    rl.close();
  }
}

/**
 * Prompts for a value, showing a default (used when the user presses Enter without typing).
 * @param {import('node:readline/promises').Interface} rl
 * @param {string} label
 * @param {string} [defaultValue]
 * @returns {Promise<string>}
 */
async function ask(rl, label, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const answer = (await rl.question(`${label}${suffix} : `)).trim();
  return answer === '' ? (defaultValue ?? '') : answer;
}

/**
 * Prompts a yes/no question, defaulting to "no" on empty input.
 * @param {import('node:readline/promises').Interface} rl
 * @param {string} label
 * @returns {Promise<boolean>}
 */
async function askYesNo(rl, label) {
  const answer = (await rl.question(`${label} (o/N) : `)).trim().toLowerCase();
  return answer === 'o' || answer === 'oui' || answer === 'y' || answer === 'yes';
}

const isMainModule = process.argv[1] === __filename;
if (isMainModule) {
  main().catch((error) => {
    console.error('Erreur pendant l\'installation :', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
