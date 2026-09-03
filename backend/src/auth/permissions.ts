export const roles = ['Admin', 'Contributeur', 'Lecteur'] as const;
export type Role = (typeof roles)[number];

export const actions = [
  'read',
  'create',
  'update',
  'delete',
  'comment',
  'manage_users',
  'manage_integrations',
  'execute_infrastructure',
] as const;
export type Action = (typeof actions)[number];

const permissions: Record<Role, ReadonlySet<Action>> = {
  Lecteur: new Set(['read']),
  Contributeur: new Set(['read', 'create', 'update', 'comment']),
  Admin: new Set(actions),
};

export function can(role: Role, action: Action): boolean {
  return permissions[role].has(action);
}

export function assertCan(role: Role, action: Action): void {
  if (!can(role, action)) {
    throw new Error(`Role ${role} cannot perform ${action}`);
  }
}