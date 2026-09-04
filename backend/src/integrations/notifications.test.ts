import assert from 'node:assert/strict';
import test from 'node:test';

import { sendEmailNotification, sendWebhookNotification, type EmailChannelConfig } from './notifications.js';

test('sends an email through the configured SMTP transport', async () => {
  let sentMail: unknown;
  const config: EmailChannelConfig = { host: 'smtp.test', port: 587, user: 'devos', pass: 'secret', from: 'devos@example.com', to: 'oncall@example.com' };
  await sendEmailNotification(config, { title: 'Échéance dépassée', message: 'Le rapport est en retard' }, () => ({
    sendMail: async (mail) => { sentMail = mail; },
  }));
  assert.deepEqual(sentMail, { from: 'devos@example.com', to: 'oncall@example.com', subject: 'Échéance dépassée', text: 'Le rapport est en retard' });
});

test('posts a JSON payload to the configured webhook URL', async () => {
  let receivedBody = '';
  let receivedUrl = '';
  await sendWebhookNotification({ url: 'https://hooks.test/notify' }, { title: 'Alerte critique', message: 'CPU 99%' }, async (input, init) => {
    receivedUrl = String(input);
    receivedBody = String(init?.body);
    return new Response(null, { status: 200 });
  });
  assert.equal(receivedUrl, 'https://hooks.test/notify');
  assert.deepEqual(JSON.parse(receivedBody), { title: 'Alerte critique', message: 'CPU 99%' });
});

test('throws when the webhook endpoint returns a non-2xx status', async () => {
  await assert.rejects(
    () => sendWebhookNotification({ url: 'https://hooks.test/notify' }, { title: 'x', message: 'y' }, async () => new Response(null, { status: 500 })),
    /500/,
  );
});
