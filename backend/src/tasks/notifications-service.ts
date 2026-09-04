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

/**
 * Fans a notification out to whichever server-side channels are configured (email, webhook).
 * The browser channel is handled entirely client-side (Web Notifications API) and never goes
 * through this service. Each channel is best-effort: one failing does not affect the other.
 */
export interface NotificationsServiceDeps {
  sendEmail: typeof sendEmailNotification;
  sendWebhook: typeof sendWebhookNotification;
}

const defaultDeps: NotificationsServiceDeps = { sendEmail: sendEmailNotification, sendWebhook: sendWebhookNotification };

export class NotificationsService {
  public constructor(
    private readonly email?: EmailChannelConfig,
    private readonly webhook?: WebhookChannelConfig,
    private readonly deps: NotificationsServiceDeps = defaultDeps,
  ) {}

  public async trigger(payload: NotificationPayload): Promise<NotificationDispatchResult[]> {
    const results: NotificationDispatchResult[] = [];

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
}
