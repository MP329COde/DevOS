import { PrismaClient } from '@prisma/client';

const KNOWN_INTEGRATION_KEYS: readonly string[] = [
  'GITHUB_TOKEN',
  'GITHUB_BASE_URL',
  'GRAFANA_BASE_URL',
  'GRAFANA_API_KEY',
  'HARBOR_BASE_URL',
  'HARBOR_USERNAME',
  'HARBOR_PASSWORD',
  'PROXMOX_BASE_URL',
  'PROXMOX_API_TOKEN',
  'WAZUH_BASE_URL',
  'WAZUH_TOKEN',
  'PROMETHEUS_EXPORTERS',
  'MINIO_BASE_URL',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'RABBITMQ_BASE_URL',
  'RABBITMQ_USERNAME',
  'RABBITMQ_PASSWORD',
  'POWERDNS_BASE_URL',
  'POWERDNS_API_KEY',
  'POWERDNS_SERVER_ID',
  'WOODPECKER_BASE_URL',
  'WOODPECKER_TOKEN',
  'OLLAMA_BASE_URL',
  'TERRAFORM_STATE_PATH',
  'SAMBA_EXPORTER_BASE_URL',
  'WIREGUARD_EXPORTER_BASE_URL',
  'SURICATA_BASE_URL',
  'NATS_MONITOR_BASE_URL',
  'N8N_BASE_URL',
  'N8N_API_KEY',
  'VERDACCIO_BASE_URL',
  'VERDACCIO_TOKEN',
  'NEXUS_BASE_URL',
  'NEXUS_USERNAME',
  'NEXUS_PASSWORD',
  'MEILISEARCH_BASE_URL',
  'MEILISEARCH_API_KEY',
  'REDPANDA_BASE_URL',
  'REDPANDA_TOKEN',
  'GITLAB_BASE_URL',
  'GITLAB_TOKEN',
  'GITLAB_PROJECT_ID',
  'ALERTMANAGER_BASE_URL',
  'DOCS_PATH',
  'K8S_API_SERVER',
  'K8S_TOKEN',
  'ARGOCD_BASE_URL',
  'ARGOCD_TOKEN',
  'DEPLOYMENT_CENTRAL_REPO_URL',
  'HAPROXY_DATA_PLANE_URL',
  'HAPROXY_USERNAME',
  'HAPROXY_PASSWORD',
  'CODER_BASE_URL',
  'CODER_TOKEN',
  'CODER_ORGANIZATION_ID',
  'CODER_OWNER',
  'CODER_DEFAULT_TEMPLATE_ID',
  'CALENDAR_PERSONAL_ICS_URL',
  'CALENDAR_PROFESSIONAL_ICS_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'NOTIFICATIONS_EMAIL_FROM',
  'NOTIFICATIONS_EMAIL_TO',
  'NOTIFICATIONS_WEBHOOK_URL',
  'GITHUB_PLATFORM_USERNAME',
  'GITHUB_PLATFORM_EMAIL',
  'GITHUB_PLATFORM_TOKEN',
  'GITLAB_PLATFORM_USERNAME',
  'GITLAB_PLATFORM_EMAIL',
  'GITLAB_PLATFORM_TOKEN',
];

export class SettingsService {
  public constructor(private readonly database: PrismaClient) {}

  public async get(key: string): Promise<string | null> {
    const row = await this.database.systemSetting.findUnique({ where: { key } });
    return row ? row.value : null;
  }

  public async set(key: string, value: string): Promise<void> {
    await this.database.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  public async delete(key: string): Promise<void> {
    await this.database.systemSetting.deleteMany({ where: { key } });
  }

  public async list(): Promise<Record<string, string>> {
    const rows = await this.database.systemSetting.findMany();
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  }

  public listKnownIntegrationKeys(): string[] {
    return [...KNOWN_INTEGRATION_KEYS];
  }
}
