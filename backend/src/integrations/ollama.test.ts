import assert from 'node:assert/strict';
import test from 'node:test';

import { OllamaClient } from './ollama.js';

function client(fetchImpl: typeof fetch) {
  return new OllamaClient({ baseUrl: 'http://ollama.test:11434', fetchImpl });
}

test('lists models extracted from the models array', async () => {
  let requestedUrl = '';
  const models = await client(async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ models: [{ name: 'llama3', size: 123, modified_at: '2026-09-01T00:00:00Z' }] }), { status: 200 });
  }).listModels();
  assert.equal(requestedUrl, 'http://ollama.test:11434/api/tags');
  assert.deepEqual(models, [{ name: 'llama3', size: 123, modified_at: '2026-09-01T00:00:00Z' }]);
});

test('generates text and returns just the response field', async () => {
  let requestedUrl = '';
  let sentBody: unknown;
  const text = await client(async (input, init) => {
    requestedUrl = String(input);
    sentBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ response: 'hello there' }), { status: 200 });
  }).generate('llama3', 'say hi');
  assert.equal(requestedUrl, 'http://ollama.test:11434/api/generate');
  assert.deepEqual(sentBody, { model: 'llama3', prompt: 'say hi', stream: false });
  assert.equal(text, 'hello there');
});

test('sends no authorization header', async () => {
  let headers: Headers | undefined;
  await client(async (_input, init) => { headers = new Headers(init?.headers); return new Response(JSON.stringify({ models: [] }), { status: 200 }); }).listModels();
  assert.equal(headers?.get('authorization'), null);
});

test('rejects failed Ollama API responses', async () => {
  await assert.rejects(() => client(async () => new Response('{}', { status: 500 })).listModels(), /failed \(500\)/);
});
