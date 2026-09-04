import type { NotificationDispatchResult } from './notifications-service.js';

export interface NotificationsHttpService {
  trigger(payload: { title: string; message: string }): Promise<NotificationDispatchResult[]>;
}

export interface NotificationsHttpResponse {
  status: number;
  body: unknown;
}

/**
 * The browser notification channel is entirely client-side (Web Notifications API) and never
 * reaches this endpoint. This only fans out to server-side channels (email, webhook) — it
 * always responds 200 even with zero channels configured, since the browser channel working
 * independently must not be blocked by the absence of server-side configuration.
 */
export async function handleNotificationsRequest(method: string, path: string, body: unknown, service: NotificationsHttpService): Promise<NotificationsHttpResponse> {
  try {
    if (method === 'POST' && path === '/api/notifications/trigger') {
      return { status: 200, body: { results: await service.trigger(parsePayload(body)) } };
    }
    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid notification request' } };
  }
}

function parsePayload(body: unknown): { title: string; message: string } {
  if (!body || typeof body !== 'object') throw new Error('Missing notification payload');
  const b = body as Record<string, unknown>;
  if (typeof b.title !== 'string' || !b.title.trim()) throw new Error('"title" is required');
  if (typeof b.message !== 'string' || !b.message.trim()) throw new Error('"message" is required');
  return { title: b.title, message: b.message };
}
