import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import {
  buildAdapterRequest,
  dispatchAdapterRequest,
  parseAdapterResponse,
} from '../src/core/adapters.ts';
import { DEFAULT_BRIDGE_CONFIG } from '../src/core/router.ts';
import { computeHmacSha256Hex, sanitizeIncomingMessage } from '../src/core/security.ts';

test('Builds Ollama, OpenAI-compatible, Hermes, and HMAC-signed Webhook adapter payloads', async () => {
  const msg = sanitizeIncomingMessage('/ollama explain double ratchet');
  const ollamaRoute = DEFAULT_BRIDGE_CONFIG.routes[0];
  const ollamaReq = await buildAdapterRequest(ollamaRoute, msg, {
    sender: '+17575550100',
    timestamp: 1700000000000,
  });
  assert.equal(ollamaReq.url, 'http://127.0.0.1:11434/api/chat');
  assert.equal(ollamaReq.body.model, 'llama3.2');
  assert.equal(ollamaReq.body.stream, false);

  const hermesRoute = DEFAULT_BRIDGE_CONFIG.routes[1];
  const hermesReq = await buildAdapterRequest(
    hermesRoute,
    sanitizeIncomingMessage('/hermes check disk'),
    {
      sender: '+17575550100',
      timestamp: 1700000000000,
      env: { HERMES_API_KEY: 'local-hermes-token-value' },
    },
  );
  assert.equal(hermesReq.headers.Authorization, 'Bearer local-hermes-token-value');
  assert.equal(hermesReq.redactedHeaders.Authorization, 'Bearer [REDACTED:HERMES_API_KEY]');
  assert.equal(hermesReq.headers['X-Hermes-Channel'], 'signal');

  const openaiRoute = DEFAULT_BRIDGE_CONFIG.routes[2];
  const openaiReq = await buildAdapterRequest(
    openaiRoute,
    sanitizeIncomingMessage('/code hello world'),
    {
      sender: '+17575550100',
      timestamp: 1700000000000,
    },
  );
  assert.equal(openaiReq.url, 'http://127.0.0.1:1234/v1/chat/completions');

  const webhookRoute = DEFAULT_BRIDGE_CONFIG.routes[3];
  const webhookReq = await buildAdapterRequest(
    webhookRoute,
    sanitizeIncomingMessage('/webhook deploy-check'),
    {
      sender: '+17575550100',
      groupId: 'ops-local-alerts-group-01',
      timestamp: 1700000000000,
      env: { SIGNALBRIDGE_WEBHOOK_SECRET: 'super-local-hmac-secret' },
    },
  );
  const expectedSig = `sha256=${await computeHmacSha256Hex('super-local-hmac-secret', webhookReq.bodyText)}`;
  assert.equal(webhookReq.headers['X-SignalBridge-Signature'], expectedSig);
});

test('Parses responses across all 4 adapter formats', () => {
  assert.equal(
    parseAdapterResponse('ollama', { message: { role: 'assistant', content: '  Ollama OK  ' } }),
    'Ollama OK',
  );
  assert.equal(
    parseAdapterResponse('openai-compatible', {
      choices: [{ message: { content: 'OpenAI OK' } }],
    }),
    'OpenAI OK',
  );
  assert.equal(parseAdapterResponse('hermes', { output: 'Hermes OK' }), 'Hermes OK');
  assert.equal(parseAdapterResponse('webhook', { reply: 'Webhook OK' }), 'Webhook OK');
  assert.throws(() => parseAdapterResponse('webhook', { unexpected: true }));
});

test('Dispatches live loopback request to local mock Ollama server', async (t) => {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      const parsed = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          message: {
            role: 'assistant',
            content: `Echo from ${parsed.model}: ${parsed.messages.at(-1).content}`,
          },
        }),
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');

  const route = {
    ...DEFAULT_BRIDGE_CONFIG.routes[0],
    endpoint: `http://127.0.0.1:${addr.port}`,
  };
  const msg = sanitizeIncomingMessage('/ollama ping local server');
  const req = await buildAdapterRequest(route, msg, {
    sender: '+17575550100',
    timestamp: Date.now(),
  });
  const result = await dispatchAdapterRequest(route, req, {
    localOnly: true,
    allowPrivateLan: false,
  });

  assert.equal(result.status, 200);
  assert.equal(result.replyText, 'Echo from llama3.2: ping local server');
});
