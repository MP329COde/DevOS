import nodemailer from 'nodemailer';

export interface NotificationPayload {
  title: string;
  message: string;
}

export interface EmailChannelConfig {
  host: string;
  port: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from: string;
  to: string;
}

export interface WebhookChannelConfig {
  url: string;
}

interface MinimalTransport {
  sendMail(mail: { from: string; to: string; subject: string; text: string }): Promise<unknown>;
}

type TransportFactory = (config: EmailChannelConfig) => MinimalTransport;

const defaultTransportFactory: TransportFactory = (config) =>
  nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure ?? false,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });

export async function sendEmailNotification(
  config: EmailChannelConfig,
  payload: NotificationPayload,
  transportFactory: TransportFactory = defaultTransportFactory,
): Promise<void> {
  const transport = transportFactory(config);
  await transport.sendMail({ from: config.from, to: config.to, subject: payload.title, text: payload.message });
}

export async function sendWebhookNotification(
  config: WebhookChannelConfig,
  payload: NotificationPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(config.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Webhook notification failed (${response.status})`);
}
