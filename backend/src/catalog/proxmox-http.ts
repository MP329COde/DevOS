import { assertCan, type Role } from '../auth/permissions.js';
import type { ProxmoxVMAction } from './proxmox.js';

export interface ProxmoxHttpService {
  controlVirtualMachine(node: string, vmid: number, action: ProxmoxVMAction, role: Role): Promise<void>;
}

export interface ProxmoxHttpResponse {
  status: number;
  body: unknown;
}

/**
 * VM power actions (start/shutdown/reboot) — a real, effectful infrastructure action, kept
 * behind both a role check (`execute_infrastructure`, same gate as HAProxy writes) and an
 * explicit `confirm: true` in the request body, so a client can never fire the action from a
 * single unconfirmed click (consistent with Design.md's "infra critique" identity: prominent
 * confirmation before anything destructive).
 */
export async function handleProxmoxRequest(method: string, path: string, body: unknown, role: Role | undefined, service: ProxmoxHttpService): Promise<ProxmoxHttpResponse> {
  try {
    const action = path.match(/^\/api\/proxmox\/nodes\/([^/]+)\/vms\/(\d+)\/(start|shutdown|reboot)$/);
    if (method === 'POST' && action) {
      if (!role) throw new Error('Authentication is required to control a VM');
      assertCan(role, 'execute_infrastructure');
      if (!isConfirmed(body)) {
        return { status: 409, body: { error: 'Confirmation explicite requise (confirm: true) avant toute action sur une VM' } };
      }
      const [, node, vmid, vmAction] = action;
      await service.controlVirtualMachine(decodeURIComponent(node), Number(vmid), vmAction as ProxmoxVMAction, role);
      return { status: 202, body: { accepted: true } };
    }
    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid Proxmox request' } };
  }
}

function isConfirmed(body: unknown): boolean {
  return !!body && typeof body === 'object' && (body as Record<string, unknown>).confirm === true;
}
