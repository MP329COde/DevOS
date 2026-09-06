import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

import { KeycloakAdminClient, type CreateAdminUserInput } from '../infrastructure/keycloak-admin.js';
import { createRedisClients } from '../infrastructure/redis.js';
import type { ProfileService } from '../profiles/profile-service.js';
import type { SettingsService } from '../settings/settings-service.js';
import {
  checkArgoCD,
  checkGitLab,
  checkHAProxy,
  checkPostgres,
  checkRedis,
  checkVault,
  type IntegrationCheckResult,
} from './onboarding-checks.js';

/**
 * Onboarding serveur du premier lancement (remplace le simple verrou frontend basé sur
 * `platform.initialized`). L'état complet — étapes, données saisies, résultats des vérifications
 * d'intégrations — est persisté côté serveur via `SettingsService` (table `system_settings`), pour
 * que la progression survive à un rechargement de page ou à un redémarrage du navigateur, et pour
 * que `server.ts` puisse bloquer les routes d'administration tant que l'installation n'est pas
 * terminée (voir le garde dans `handleRequest`).
 */

export const ONBOARDING_STEP_IDS = ['welcome', 'identity', 'admin', 'integrations', 'core', 'summary'] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export type OnboardingStepStatus = 'pending' | 'in_progress' | 'done' | 'error';

export interface OnboardingStepState {
  id: OnboardingStepId;
  status: OnboardingStepStatus;
  data: Record<string, unknown>;
  error?: string;
  updatedAt?: string;
}

export const CORE_CHECK_NAMES = ['gitlab', 'argocd', 'haproxy', 'postgres', 'redis', 'vault'] as const;
export type CoreCheckName = (typeof CORE_CHECK_NAMES)[number];

export interface OnboardingState {
  installationComplete: boolean;
  steps: Record<OnboardingStepId, OnboardingStepState>;
  checks: Partial<Record<CoreCheckName, IntegrationCheckResult>>;
}

const INSTALLATION_COMPLETE_KEY = 'onboarding.installation_complete';
/** Clé historique lue par le frontend existant : maintenue en miroir pour compatibilité. */
const LEGACY_INITIALIZED_KEY = 'platform.initialized';

function stepDataKey(id: OnboardingStepId): string {
  return `onboarding.step.${id}`;
}

function checkKey(name: CoreCheckName): string {
  return `onboarding.check.${name}`;
}

const INTEGRATION_STEP_FIELDS = [
  'GITLAB_BASE_URL',
  'GITLAB_TOKEN',
  'GITLAB_PROJECT_ID',
  'ARGOCD_BASE_URL',
  'ARGOCD_TOKEN',
  'ARGOCD_APP_NAME',
  'HAPROXY_DATA_PLANE_URL',
  'HAPROXY_USERNAME',
  'HAPROXY_PASSWORD',
] as const;

export interface OnboardingDependencies {
  database: PrismaClient;
  settings: SettingsService;
  profiles: ProfileService;
  keycloakAdmin?: KeycloakAdminClient;
  keycloakRealmAdminRole?: string;
}

export class OnboardingService {
  private readonly database: PrismaClient;
  private readonly settings: SettingsService;
  private readonly profiles: ProfileService;
  private readonly keycloakAdmin?: KeycloakAdminClient;
  private readonly keycloakRealmAdminRole: string;

  public constructor(deps: OnboardingDependencies) {
    this.database = deps.database;
    this.settings = deps.settings;
    this.profiles = deps.profiles;
    this.keycloakAdmin = deps.keycloakAdmin;
    this.keycloakRealmAdminRole = deps.keycloakRealmAdminRole ?? 'devos-admin';
  }

  public async isInstallationComplete(): Promise<boolean> {
    const value = await this.settings.get(INSTALLATION_COMPLETE_KEY);
    return value === 'true';
  }

  private async readStep(id: OnboardingStepId): Promise<OnboardingStepState> {
    const raw = await this.settings.get(stepDataKey(id));
    if (!raw) return { id, status: 'pending', data: {} };
    try {
      const parsed = JSON.parse(raw) as Omit<OnboardingStepState, 'id'>;
      return { id, status: parsed.status ?? 'pending', data: parsed.data ?? {}, error: parsed.error, updatedAt: parsed.updatedAt };
    } catch {
      return { id, status: 'pending', data: {} };
    }
  }

  private async writeStep(step: OnboardingStepState): Promise<void> {
    await this.settings.set(
      stepDataKey(step.id),
      JSON.stringify({ status: step.status, data: step.data, error: step.error, updatedAt: new Date().toISOString() }),
    );
  }

  private async readCheck(name: CoreCheckName): Promise<IntegrationCheckResult | undefined> {
    const raw = await this.settings.get(checkKey(name));
    return raw ? (JSON.parse(raw) as IntegrationCheckResult) : undefined;
  }

  public async getState(): Promise<OnboardingState> {
    const steps = Object.fromEntries(
      await Promise.all(ONBOARDING_STEP_IDS.map(async (id) => [id, await this.readStep(id)] as const)),
    ) as Record<OnboardingStepId, OnboardingStepState>;

    const checkEntries = await Promise.all(CORE_CHECK_NAMES.map(async (name) => [name, await this.readCheck(name)] as const));
    const checks = Object.fromEntries(checkEntries.filter(([, value]) => value !== undefined)) as OnboardingState['checks'];

    return { installationComplete: await this.isInstallationComplete(), steps, checks };
  }

  /**
   * Permet de revenir sur une étape déjà validée pour la corriger, sans toucher aux autres : ne
   * fait que repasser son statut à "in_progress" (les données saisies sont conservées jusqu'à ce
   * que l'utilisateur les modifie explicitement via `saveStep`).
   */
  public async reopenStep(id: OnboardingStepId): Promise<OnboardingStepState> {
    if (await this.isInstallationComplete()) {
      throw new Error("L'installation est déjà terminée ; utilisez les Paramètres pour modifier la configuration.");
    }
    const step = await this.readStep(id);
    step.status = 'in_progress';
    step.error = undefined;
    await this.writeStep(step);
    return step;
  }

  public async saveStep(id: OnboardingStepId, data: Record<string, unknown>): Promise<OnboardingStepState> {
    if (await this.isInstallationComplete()) {
      throw new Error("L'installation est déjà terminée ; utilisez les Paramètres pour modifier la configuration.");
    }

    if (id === 'identity') {
      if (typeof data.name === 'string') await this.settings.set('platform.name', data.name);
      if (typeof data.logo === 'string') await this.settings.set('platform.logo', data.logo);
    }

    if (id === 'integrations') {
      for (const field of INTEGRATION_STEP_FIELDS) {
        const value = data[field];
        if (typeof value === 'string' && value.length > 0) await this.settings.set(field, value);
      }
    }

    const step: OnboardingStepState = { id, status: 'done', data };
    await this.writeStep(step);
    return step;
  }

  private async currentIntegrationSettings(): Promise<Record<string, string>> {
    const entries = await Promise.all(INTEGRATION_STEP_FIELDS.map(async (key) => [key, await this.settings.get(key)] as const));
    return Object.fromEntries(entries.filter(([, value]) => value !== null)) as Record<string, string>;
  }

  /**
   * Lance une vérification de connectivité réelle pour l'intégration nommée, avec les identifiants
   * effectivement enregistrés (settings pour GitLab/ArgoCD/HAProxy, variables d'environnement pour
   * les briques d'infrastructure cœur), et persiste le résultat pour que le wizard l'affiche
   * (connecté / erreur / version / endpoint).
   */
  public async runCheck(name: CoreCheckName): Promise<IntegrationCheckResult> {
    const result = await this.executeCheck(name);
    await this.settings.set(checkKey(name), JSON.stringify(result));
    return result;
  }

  private async executeCheck(name: CoreCheckName): Promise<IntegrationCheckResult> {
    switch (name) {
      case 'gitlab': {
        const config = await this.currentIntegrationSettings();
        if (!config.GITLAB_BASE_URL || !config.GITLAB_TOKEN) {
          return { connected: false, error: 'GitLab non configuré', testedAt: new Date().toISOString() };
        }
        return checkGitLab({ baseUrl: config.GITLAB_BASE_URL, token: config.GITLAB_TOKEN });
      }
      case 'argocd': {
        const config = await this.currentIntegrationSettings();
        if (!config.ARGOCD_BASE_URL || !config.ARGOCD_TOKEN) {
          return { connected: false, error: 'ArgoCD non configuré', testedAt: new Date().toISOString() };
        }
        return checkArgoCD({ baseUrl: config.ARGOCD_BASE_URL, token: config.ARGOCD_TOKEN });
      }
      case 'haproxy': {
        const config = await this.currentIntegrationSettings();
        if (!config.HAPROXY_DATA_PLANE_URL || !config.HAPROXY_USERNAME) {
          return { connected: false, error: 'HAProxy non configuré', testedAt: new Date().toISOString() };
        }
        return checkHAProxy({
          dataPlaneUrl: config.HAPROXY_DATA_PLANE_URL,
          username: config.HAPROXY_USERNAME,
          password: config.HAPROXY_PASSWORD ?? '',
        });
      }
      case 'postgres':
        return checkPostgres(this.database);
      case 'redis': {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) return { connected: false, error: 'REDIS_URL non configuré', testedAt: new Date().toISOString() };
        const client = createRedisClients(redisUrl).cache;
        return checkRedis(client, redisUrl);
      }
      case 'vault': {
        const address = process.env.VAULT_ADDR;
        if (!address) return { connected: false, error: 'VAULT_ADDR non configuré', testedAt: new Date().toISOString() };
        return checkVault({ address });
      }
    }
  }

  public async runAllChecks(): Promise<Partial<Record<CoreCheckName, IntegrationCheckResult>>> {
    const entries = await Promise.all(CORE_CHECK_NAMES.map(async (name) => [name, await this.runCheck(name)] as const));
    return Object.fromEntries(entries);
  }

  /**
   * Crée réellement le premier administrateur : compte Keycloak (mot de passe temporaire, à
   * changer à la première connexion) + rôle realm `devos-admin`, puis profil DevOS local lié au
   * rôle Admin — c'est ce profil que `KeycloakSessionRoleResolver` retrouvera au premier login.
   */
  public async createFirstAdmin(input: { username: string; email: string; displayName: string }): Promise<OnboardingStepState> {
    if (await this.isInstallationComplete()) {
      throw new Error("L'installation est déjà terminée ; utilisez la gestion des profils pour ajouter des administrateurs.");
    }
    if (!this.keycloakAdmin) {
      throw new Error("L'API Admin Keycloak n'est pas configurée (KEYCLOAK_ADMIN_* / secret Vault manquants)");
    }

    const temporaryPassword = randomUUID();
    const createUserInput: CreateAdminUserInput = {
      username: input.username,
      email: input.email,
      firstName: input.displayName,
      temporaryPassword,
    };

    let userId: string;
    try {
      userId = await this.keycloakAdmin.createUser(createUserInput);
      await this.keycloakAdmin.assignRealmRole(userId, this.keycloakRealmAdminRole);
    } catch (error) {
      const step: OnboardingStepState = {
        id: 'admin',
        status: 'error',
        data: { username: input.username, email: input.email },
        error: error instanceof Error ? error.message : 'Création de l\'administrateur Keycloak échouée',
      };
      await this.writeStep(step);
      throw error;
    }

    const adminRole = await this.database.role.findUnique({ where: { name: 'Admin' } });
    const existingProfile = await this.profiles.getProfileByEmail(input.email);
    if (existingProfile) {
      await this.profiles.updateProfile(existingProfile.id, { roleId: adminRole?.id ?? null });
    } else {
      await this.profiles.createProfile({ email: input.email, displayName: input.displayName, roleId: adminRole?.id ?? null });
    }

    await this.settings.set('platform.adminName', input.displayName);
    await this.settings.set('platform.adminEmail', input.email);

    const step: OnboardingStepState = { id: 'admin', status: 'done', data: { username: input.username, email: input.email, keycloakUserId: userId } };
    await this.writeStep(step);
    return step;
  }

  /**
   * Valide que les étapes requises sont bien terminées et que les intégrations cœur répondent,
   * puis marque l'installation comme terminée. Sans ce garde, "Terminer" pourrait basculer
   * `installationComplete` à true alors que l'admin ou une intégration critique n'est pas
   * opérationnelle — exactement le trou que comblait mal l'ancien wizard purement frontend.
   */
  public async complete(): Promise<void> {
    const state = await this.getState();
    const problems: string[] = [];

    if (state.steps.identity.status !== 'done') problems.push("L'identité de la plateforme n'est pas renseignée");
    if (state.steps.admin.status !== 'done') problems.push("Le premier administrateur n'a pas été créé");

    for (const name of ['gitlab', 'argocd', 'haproxy', 'postgres', 'redis', 'vault'] as const) {
      const check = state.checks[name];
      if (!check?.connected) problems.push(`Intégration "${name}" non connectée`);
    }

    if (problems.length > 0) {
      throw new Error(`Installation incomplète : ${problems.join(' ; ')}`);
    }

    await this.settings.set(INSTALLATION_COMPLETE_KEY, 'true');
    await this.settings.set(LEGACY_INITIALIZED_KEY, 'true');
    await this.writeStep({ id: 'summary', status: 'done', data: {} });
  }
}
