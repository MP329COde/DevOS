import type { AvailabilityStatus, Prisma, PrismaClient, Role, UserProfile } from '@prisma/client';

/**
 * Section AC (TODO-refonte-2.md) : profils utilisateur, rôles configurables et permissions par
 * projet. Le rôle global (`UserProfile.role`) et les permissions par projet (`ProjectPermission`)
 * sont désormais résolus par identité réelle : `auth/session-role.ts` retrouve le `UserProfile`
 * via l'email porté par la session Keycloak authentifiée (cookie `devos_session`), plus aucun
 * header client ne peut déclarer un rôle (voir server.ts).
 */

const SYSTEM_ROLE_NAMES = ['Admin', 'Contributeur', 'Lecteur'] as const;

export interface UserProfileInput {
  email: string;
  displayName: string;
  avatarEmoji?: string | null;
  avatarColor?: string | null;
  avatarImageUrl?: string | null;
  statusEmoji?: string | null;
  statusMessage?: string | null;
  availability?: AvailabilityStatus;
  availabilityFrom?: string | null;
  availabilityUntil?: string | null;
  shortName?: string | null;
  availabilityScheduleStart?: string | null;
  availabilityScheduleEnd?: string | null;
  themeMode?: string | null;
  themeColors?: Record<string, string> | null;
  profileBackground?: string | null;
  notificationPreferences?: Record<string, unknown> | null;
  roleId?: string | null;
}

export interface RoleInput {
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  permissions?: string[];
}

export interface ProjectPermissionInput {
  devProjectId: string;
  userProfileId: string;
  roleId: string;
}

export class ProfileService {
  public constructor(private readonly database: PrismaClient) {}

  // --- Rôles ---------------------------------------------------------------------------------

  /** Garantit l'existence des trois rôles historiques (Admin/Contributeur/Lecteur) comme lignes
   * `Role` marquées `isSystem`, pour que l'UI de gestion des rôles parte d'un socle cohérent avec
   * `auth/permissions.ts` sans dupliquer sa logique de vérification. */
  public async ensureSystemRoles(): Promise<void> {
    const defaults: Record<(typeof SYSTEM_ROLE_NAMES)[number], string[]> = {
      Lecteur: ['read'],
      Contributeur: ['read', 'create', 'update', 'comment'],
      Admin: ['read', 'create', 'update', 'delete', 'comment', 'manage_users', 'manage_integrations', 'execute_infrastructure'],
    };
    for (const name of SYSTEM_ROLE_NAMES) {
      await this.database.role.upsert({
        where: { name },
        update: {},
        create: { name, permissions: defaults[name], isSystem: true },
      });
    }
  }

  public listRoles(): Promise<Role[]> {
    return this.database.role.findMany({ orderBy: [{ isSystem: 'desc' }, { name: 'asc' }] });
  }

  public async createRole(input: RoleInput): Promise<Role> {
    const name = input.name?.trim();
    if (!name) throw new Error('"name" is required');
    return this.database.role.create({
      data: { name, description: input.description ?? null, color: input.color ?? null, icon: input.icon ?? null, permissions: input.permissions ?? [] },
    });
  }

  public async updateRole(id: string, input: Partial<RoleInput>): Promise<Role> {
    const existing = await this.database.role.findUnique({ where: { id } });
    if (!existing) throw new Error('Role not found');
    if (existing.isSystem && input.name !== undefined && input.name.trim() !== existing.name) {
      throw new Error('Impossible de renommer un rôle système');
    }
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.description !== undefined) data.description = input.description;
    if (input.color !== undefined) data.color = input.color;
    if (input.icon !== undefined) data.icon = input.icon;
    if (input.permissions !== undefined) data.permissions = input.permissions;
    return this.database.role.update({ where: { id }, data });
  }

  public async deleteRole(id: string): Promise<void> {
    const existing = await this.database.role.findUnique({ where: { id } });
    if (!existing) return;
    if (existing.isSystem) throw new Error('Impossible de supprimer un rôle système');
    await this.database.role.delete({ where: { id } });
  }

  // --- Profils ---------------------------------------------------------------------------------

  public listProfiles(): Promise<UserProfile[]> {
    return this.database.userProfile.findMany({ orderBy: { displayName: 'asc' }, include: { role: true } });
  }

  public getProfile(id: string): Promise<UserProfile | null> {
    return this.database.userProfile.findUnique({ where: { id }, include: { role: true } });
  }

  public getProfileByEmail(email: string): Promise<UserProfile | null> {
    return this.database.userProfile.findUnique({ where: { email }, include: { role: true } });
  }

  public async createProfile(input: UserProfileInput): Promise<UserProfile> {
    const email = input.email?.trim();
    const displayName = input.displayName?.trim();
    if (!email) throw new Error('"email" is required');
    if (!displayName) throw new Error('"displayName" is required');
    return this.database.userProfile.create({
      data: {
        email,
        displayName,
        avatarEmoji: input.avatarEmoji ?? null,
        avatarColor: input.avatarColor ?? null,
        avatarImageUrl: input.avatarImageUrl ?? null,
        statusEmoji: input.statusEmoji ?? null,
        statusMessage: input.statusMessage ?? null,
        availability: input.availability ?? 'available',
        availabilityFrom: input.availabilityFrom ? new Date(input.availabilityFrom) : null,
        availabilityUntil: input.availabilityUntil ? new Date(input.availabilityUntil) : null,
        shortName: input.shortName ?? null,
        availabilityScheduleStart: input.availabilityScheduleStart ?? null,
        availabilityScheduleEnd: input.availabilityScheduleEnd ?? null,
        themeMode: input.themeMode ?? null,
        themeColors: input.themeColors ?? undefined,
        profileBackground: input.profileBackground ?? null,
        notificationPreferences: (input.notificationPreferences ?? undefined) as Prisma.InputJsonValue | undefined,
        roleId: input.roleId ?? null,
      },
    });
  }

  public async updateProfile(id: string, input: Partial<UserProfileInput>): Promise<UserProfile> {
    const data: Record<string, unknown> = {};
    if (input.displayName !== undefined) {
      if (!input.displayName.trim()) throw new Error('"displayName" cannot be empty');
      data.displayName = input.displayName.trim();
    }
    if (input.avatarEmoji !== undefined) data.avatarEmoji = input.avatarEmoji;
    if (input.avatarColor !== undefined) data.avatarColor = input.avatarColor;
    if (input.avatarImageUrl !== undefined) data.avatarImageUrl = input.avatarImageUrl;
    if (input.statusEmoji !== undefined) data.statusEmoji = input.statusEmoji;
    if (input.statusMessage !== undefined) data.statusMessage = input.statusMessage;
    if (input.availability !== undefined) data.availability = input.availability;
    if (input.availabilityFrom !== undefined) data.availabilityFrom = input.availabilityFrom ? new Date(input.availabilityFrom) : null;
    if (input.availabilityUntil !== undefined) data.availabilityUntil = input.availabilityUntil ? new Date(input.availabilityUntil) : null;
    if (input.shortName !== undefined) data.shortName = input.shortName;
    if (input.availabilityScheduleStart !== undefined) data.availabilityScheduleStart = input.availabilityScheduleStart;
    if (input.availabilityScheduleEnd !== undefined) data.availabilityScheduleEnd = input.availabilityScheduleEnd;
    if (input.themeMode !== undefined) data.themeMode = input.themeMode;
    if (input.themeColors !== undefined) data.themeColors = input.themeColors ?? undefined;
    if (input.profileBackground !== undefined) data.profileBackground = input.profileBackground;
    if (input.notificationPreferences !== undefined) data.notificationPreferences = (input.notificationPreferences ?? undefined) as Prisma.InputJsonValue | undefined;
    if (input.roleId !== undefined) data.roleId = input.roleId;
    return this.database.userProfile.update({ where: { id }, data, include: { role: true } });
  }

  public async deleteProfile(id: string): Promise<void> {
    await this.database.userProfile.delete({ where: { id } });
  }

  // --- Permissions par projet ------------------------------------------------------------------

  public listProjectPermissions(devProjectId: string) {
    return this.database.projectPermission.findMany({
      where: { devProjectId },
      include: { userProfile: true, role: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  public async setProjectPermission(input: ProjectPermissionInput) {
    return this.database.projectPermission.upsert({
      where: { devProjectId_userProfileId: { devProjectId: input.devProjectId, userProfileId: input.userProfileId } },
      update: { roleId: input.roleId },
      create: input,
      include: { userProfile: true, role: true },
    });
  }

  public async removeProjectPermission(devProjectId: string, userProfileId: string): Promise<void> {
    await this.database.projectPermission.deleteMany({ where: { devProjectId, userProfileId } });
  }
}
