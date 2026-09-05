import type { NotificationDispatchResult, StoredNotification } from './notifications-service.js';

export interface NotificationsHttpService {
  trigger(payload: { title: string; message: string; category?: string }): Promise<NotificationDispatchResult[]>;
  list(): Promise<StoredNotification[]>;
  markAsRead(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface NotificationsHttpResponse {
  status: number;
  body: unknown;
}

/**
 * The browser notification channel is entirely client-side (Web Notifications API) and never
 * reaches this endpoint. `trigger` fans out to server-side channels (email, webhook) and persists
 * the notification for the in-app center; it always responds 200 even with zero channels
 * configured, since the browser channel working independently must not be blocked by the absence
 * of server-side configuration. `DELETE` only hides the entry from the center (soft-delete) — the
 * row is kept for the 60-day retention window, purged separately.
 */
export async function handleNotificationsRequest(method: string, path: string, body: unknown, service: NotificationsHttpService): Promise<NotificationsHttpResponse> {
  try {
    if (method === 'POST' && path === '/api/notifications/trigger') {
      return { status: 200, body: { results: await service.trigger(parsePayload(body)) } };
    }
    if (method === 'GET' && path === '/api/notifications') {
      return { status: 200, body: { notifications: await service.list() } };
    }
    const readMatch = method === 'PATCH' && path.match(/^\/api\/notifications\/([^/]+)\/read$/);
    if (readMatch) {
      await service.markAsRead(readMatch[1]);
      return { status: 204, body: undefined };
    }
    const deleteMatch = method === 'DELETE' && path.match(/^\/api\/notifications\/([^/]+)$/);
    if (deleteMatch) {
      await service.delete(deleteMatch[1]);
      return { status: 204, body: undefined };
    }
    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid notification request' } };
  }
}

function parsePayload(body: unknown): { title: string; message: string; category?: string } {
  if (!body || typeof body !== 'object') throw new Error('Missing notification payload');
  const b = body as Record<string, unknown>;
  if (typeof b.title !== 'string' || !b.title.trim()) throw new Error('"title" is required');
  if (typeof b.message !== 'string' || !b.message.trim()) throw new Error('"message" is required');
  if (b.category !== undefined && typeof b.category !== 'string') throw new Error('"category" must be a string');
  return { title: b.title, message: b.message, category: b.category };
}
