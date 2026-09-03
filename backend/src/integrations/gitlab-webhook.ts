import { timingSafeEqual } from 'node:crypto';

export const supportedGitLabEvents = ['Issue Hook', 'Merge Request Hook', 'Pipeline Hook', 'Note Hook'] as const;
export type GitLabEvent = (typeof supportedGitLabEvents)[number];

export interface WebhookSecretProvider {
  getSecret(): Promise<string>;
}

export interface WebhookEvent {
  type: GitLabEvent;
  payload: unknown;
}

export async function verifyAndParseWebhook(
  token: string | undefined,
  eventName: string | undefined,
  rawBody: string,
  secrets: WebhookSecretProvider,
): Promise<WebhookEvent> {
  const expected = await secrets.getSecret();
  if (!token || !constantTimeEqual(token, expected)) throw new Error('Invalid GitLab webhook token');
  if (!supportedGitLabEvents.includes(eventName as GitLabEvent)) throw new Error('Unsupported GitLab webhook event');
  return { type: eventName as GitLabEvent, payload: JSON.parse(rawBody) as unknown };
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}