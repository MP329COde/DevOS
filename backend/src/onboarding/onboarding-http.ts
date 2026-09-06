import type { Role } from '../auth/permissions.js';
import { assertCan } from '../auth/permissions.js';
import { ONBOARDING_STEP_IDS, type CoreCheckName, type OnboardingStepId, type OnboardingState } from './onboarding-service.js';
import { CORE_CHECK_NAMES } from './onboarding-service.js';

export interface OnboardingHttpService {
  isInstallationComplete(): Promise<boolean>;
  getState(): Promise<OnboardingState>;
  saveStep(id: OnboardingStepId, data: Record<string, unknown>): Promise<unknown>;
  reopenStep(id: OnboardingStepId): Promise<unknown>;
  runCheck(name: CoreCheckName): Promise<unknown>;
  runAllChecks(): Promise<unknown>;
  createFirstAdmin(input: { username: string; email: string; displayName: string }): Promise<unknown>;
  complete(): Promise<void>;
}

export interface OnboardingHttpResponse {
  status: number;
  body: unknown;
}

const STEP_IDS = new Set<string>(ONBOARDING_STEP_IDS);
const CHECK_NAMES = new Set<string>(CORE_CHECK_NAMES);

/**
 * Une fois l'installation terminée, ces routes restent utiles pour ré-auditer la stack (bouton
 * "Revoir l'installation" dans Paramètres) mais doivent redevenir réservées aux administrateurs —
 * sans quoi n'importe quel visiteur pourrait relancer des tests de connectivité ou lire l'état
 * détaillé de l'installation.
 */
async function requireAdminIfInstalled(service: OnboardingHttpService, role: Role | undefined): Promise<void> {
  if (!(await service.isInstallationComplete())) return;
  assertCan(role ?? 'Lecteur', 'manage_integrations');
}

export async function handleOnboardingRequest(
  method: string,
  path: string,
  body: unknown,
  role: Role | undefined,
  service: OnboardingHttpService,
): Promise<OnboardingHttpResponse> {
  try {
    if (method === 'GET' && path === '/api/onboarding/status') {
      return { status: 200, body: await service.getState() };
    }

    const stepMatch = path.match(/^\/api\/onboarding\/steps\/([^/]+)$/);
    if (stepMatch) {
      const id = decodeURIComponent(stepMatch[1]);
      if (!STEP_IDS.has(id)) return { status: 404, body: { error: 'Unknown onboarding step' } };
      await requireAdminIfInstalled(service, role);

      if (method === 'PUT') {
        const data = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
        return { status: 200, body: await service.saveStep(id as OnboardingStepId, data) };
      }
      return { status: 404, body: { error: 'Not found' } };
    }

    const reopenMatch = path.match(/^\/api\/onboarding\/steps\/([^/]+)\/reopen$/);
    if (method === 'POST' && reopenMatch) {
      const id = decodeURIComponent(reopenMatch[1]);
      if (!STEP_IDS.has(id)) return { status: 404, body: { error: 'Unknown onboarding step' } };
      await requireAdminIfInstalled(service, role);
      return { status: 200, body: await service.reopenStep(id as OnboardingStepId) };
    }

    const checkMatch = path.match(/^\/api\/onboarding\/checks\/([^/]+)$/);
    if (method === 'POST' && checkMatch) {
      const name = decodeURIComponent(checkMatch[1]);
      if (!CHECK_NAMES.has(name)) return { status: 404, body: { error: 'Unknown integration check' } };
      await requireAdminIfInstalled(service, role);
      return { status: 200, body: await service.runCheck(name as CoreCheckName) };
    }

    if (method === 'POST' && path === '/api/onboarding/checks') {
      await requireAdminIfInstalled(service, role);
      return { status: 200, body: await service.runAllChecks() };
    }

    if (method === 'POST' && path === '/api/onboarding/admin') {
      await requireAdminIfInstalled(service, role);
      const input = body as { username?: string; email?: string; displayName?: string } | null;
      if (!input?.username || !input.email || !input.displayName) {
        return { status: 400, body: { error: '"username", "email" et "displayName" sont requis' } };
      }
      return { status: 201, body: await service.createFirstAdmin({ username: input.username, email: input.email, displayName: input.displayName }) };
    }

    if (method === 'POST' && path === '/api/onboarding/complete') {
      await requireAdminIfInstalled(service, role);
      await service.complete();
      return { status: 200, body: { installationComplete: true } };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return { status: 400, body: { error: message } };
  }
}
