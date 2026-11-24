import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { createBridgeApp } from '../bridge/server.ts';
import { parseSignalWebhookPayload } from '../bridge/signalCli.ts';
import { DEFAULT_BRIDGE_CONFIG } from '../src/core/router.ts';

test('parseSignalWebhookPayload handles both signal-cli JSON-RPC and flat formats', () => {
  const native = parseSignalWebhookPayload({
    envelope: {
      sourceNumber: '+17575550100',
      timestamp: 1700000000000,
      dataMessage: {
        message: '/ollama hello',
        groupInfo: { groupId: 'ops-local-alerts-group-01' },
      },
    },
  });
  assert.deepEqual(native, {
    sender: '+17575550100',
    groupId: 'ops-local-alerts-group-01',
    text: '/ollama hello',
    timestamp: 1700000000000,
  });

  const flat = parseSignalWebhookPayload({
    sender: '+17575550100',
    text: '/status',
  });
  assert.equal(flat?.sender, '+17575550100');
  assert.equal(flat?.text, '/status');
});

test('Bridge HTTP server end-to-end integration: health, simulate, ingest auth, live Ollama + signal-cli RPC', async (t) => {
  const sentRpcCalls: Array<Record<string, unknown>> = [];

  // Mock local signal-cli JSON-RPC server
  const mockSignalCli = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      sentRpcCalls.push(JSON.parse(body));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', result: { timestamp: Date.now() } }));
    });
  });

  // Mock local Ollama backend
  const mockOllama = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          message: { role: 'assistant', content: `Local reply to: ${parsed.messages.at(-1).content}` },
        }),
      );
    });
  });

  await Promise.all([
    new Promise<void>((resolve) => mockSignalCli.listen(0, '127.0.0.1', resolve)),
    new Promise<void>((resolve) => mockOllama.listen(0, '127.0.0.1', resolve)),
  ]);
  t.after(() => {
    mockSignalCli.close();
    mockOllama.close();
  });

  const cliAddr = mockSignalCli.address() as { port: number };
  const ollamaAddr = mockOllama.address() as { port: number };

  const cfg = structuredClone(DEFAULT_BRIDGE_CONFIG);
  cfg.dryRun = false;
  cfg.signalCliUrl = `http://127.0.0.1:${cliAddr.port}/api/v1/rpc`;
  cfg.routes[0].endpoint = `http://127.0.0.1:${ollamaAddr.port}`;

  const { app } = createBridgeApp({
    config: cfg,
    ingestToken: 'local-ingest-secret-token',
  });

  const bridgeServer = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  t.after(() => bridgeServer.close());

  const bridgeAddr = bridgeServer.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${bridgeAddr.port}`;

  // 1. Health check
  const healthRes = await fetch(`${baseUrl}/health`);
  assert.equal(healthRes.status, 200);
  const healthJson = (await healthRes.json()) as Record<string, unknown>;
  assert.equal(healthJson.ok, true);
  assert.equal(healthJson.securityScore, 100);

  // 2. Dry-run simulate endpoint does not hit live Ollama or signal-cli
  const simRes = await fetch(`${baseUrl}/api/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: '+17575550100', text: '/ollama dry run check' }),
  });
  assert.equal(simRes.status, 200);
  const simJson = (await simRes.json()) as { decision: { action: string } };
  assert.equal(simJson.decision.action, 'dry_run');
  assert.equal(sentRpcCalls.length, 0);

  // 3. /webhook/signal rejects missing ingest token
  const unauthWebhook = await fetch(`${baseUrl}/webhook/signal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: '+17575550100', text: '/ollama test' }),
  });
  assert.equal(unauthWebhook.status, 401);

  // 4. /webhook/signal rejects unauthorized phone number with 403
  const forbiddenSender = await fetch(`${baseUrl}/webhook/signal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SignalBridge-Token': 'local-ingest-secret-token',
    },
    body: JSON.stringify({ sender: '+19995550999', text: '/ollama test' }),
  });
  assert.equal(forbiddenSender.status, 403);

  // 5. /webhook/signal live dispatch hits Ollama and sends reply back via signal-cli RPC
  const liveRes = await fetch(`${baseUrl}/webhook/signal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SignalBridge-Token': 'local-ingest-secret-token',
    },
    body: JSON.stringify({
      envelope: {
        sourceNumber: '+17575550100',
        dataMessage: { message: '/ollama verify live loop' },
      },
    }),
  });
  assert.equal(liveRes.status, 200);
  const liveJson = (await liveRes.json()) as {
    ok: boolean;
    delivery: { sentChunks: number };
    decision: { replyText: string };
  };
  assert.equal(liveJson.ok, true);
  assert.equal(liveJson.decision.replyText, 'Local reply to: verify live loop');
  assert.equal(liveJson.delivery.sentChunks, 1);
  assert.equal(sentRpcCalls.length, 1);
  assert.equal(sentRpcCalls[0].method, 'send');
});
