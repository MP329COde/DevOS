import type { PrismaClient } from '@prisma/client';
import {
  sendEmailNotification,
  sendWebhookNotification,
  type EmailChannelConfig,
  type NotificationPayload,
  type WebhookChannelConfig,
} from '../integrations/notifications.js';

export interface NotificationDispatchResult {
  channel: 'email' | 'webhook';
  ok: boolean;
  error?: string;
}

export interface StoredNotification {
  id: string;
  title: string;
  message: string;
  category: string | null;
  readAt: Date | null;
  createdAt: Date;
}

const RETENTION_DAYS = 60;

/**
 * Fans a notification out to whichever server-side channels are configured (email, webhook) and
 * persists it for the in-app notification center. The browser channel is handled entirely
 * client-side (Web Notifications API) and never goes through this service. Each dispatch channel
 * is best-effort: one failing does not affect the other or the persistence.
 *
 * Deleting a notification from the center only sets `deletedAt` (hidden from `list`, kept for
 * audit) — rows are hard-deleted by `purgeExpired` once older than 60 days, regardless of read or
 * delete state, so retention is bounded even if purge runs late.
 */
export interface NotificationsServiceDeps {
  sendEmail: typeof sendEmailNotification;
  sendWebhook: typeof sendWebhookNotification;
}

const defaultDeps: NotificationsServiceDeps = { sendEmail: sendEmailNotification, sendWebhook: sendWebhookNotification };

export class NotificationsService {
  public constructor(
    private readonly database: PrismaClient,
    private readonly email?: EmailChannelConfig,
    private readonly webhook?: WebhookChannelConfig,
    private readonly deps: NotificationsServiceDeps = defaultDeps,
  ) {}

  public async trigger(payload: NotificationPayload & { category?: string }): Promise<NotificationDispatchResult[]> {
    const results: NotificationDispatchResult[] = [];

    await this.database.notification.create({
      data: { title: payload.title, message: payload.message, category: payload.category ?? null },
    });

    if (this.email) {
      try {
        await this.deps.sendEmail(this.email, payload);
        results.push({ channel: 'email', ok: true });
      } catch (error) {
        results.push({ channel: 'email', ok: false, error: error instanceof Error ? error.message : 'Email send failed' });
      }
    }

    if (this.webhook) {
      try {
        await this.deps.sendWebhook(this.webhook, payload);
        results.push({ channel: 'webhook', ok: true });
      } catch (error) {
        results.push({ channel: 'webhook', ok: false, error: error instanceof Error ? error.message : 'Webhook send failed' });
      }
    }

    return results;
  }

  public async list(): Promise<StoredNotification[]> {
    return this.database.notification.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, message: true, category: true, readAt: true, createdAt: true },
    });
  }

  public async markAsRead(id: string): Promise<void> {
    await this.database.notification.updateMany({ where: { id, readAt: null }, data: { readAt: new Date() } });
  }

  public async delete(id: string): Promise<void> {
    await this.database.notification.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  }

  /** Hard-deletes notifications older than the 60-day retention window, read/deleted or not. */
  public async purgeExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.database.notification.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return result.count;
  }
}
