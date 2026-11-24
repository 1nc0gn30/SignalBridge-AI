import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chunkSignalReply,
  DEFAULT_BRIDGE_CONFIG,
  SignalBridgeRouter,
  validateBridgeConfig,
} from '../src/core/router.ts';

test('Default config passes validation with 100 security score', () => {
  const result = validateBridgeConfig(DEFAULT_BRIDGE_CONFIG);
  assert.equal(result.valid, true);
  assert.equal(result.securityScore, 100);
  assert.equal(result.findings.length, 0);
});

test('Config validation rejects inline secrets and cloud metadata endpoints', () => {
  const badConfig = structuredClone(DEFAULT_BRIDGE_CONFIG);
  badConfig.routes[0].endpoint = 'http://169.254.169.254/latest/meta-data';
  badConfig.routes[1].apiKeyEnv = ['sk', '-live-secret1234567890abcdef'].join('');

  const result = validateBridgeConfig(badConfig);
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((f) => f.code === 'BLOCKED_METADATA_HOST'));
  assert.ok(result.findings.some((f) => f.code === 'INLINE_SECRET_DETECTED'));
  assert.ok(result.securityScore <= 50);
});

test('Router handles allowlist rejection, slash commands, built-ins, and default fallback', async () => {
  const router = new SignalBridgeRouter(structuredClone(DEFAULT_BRIDGE_CONFIG));

  const denied = await router.handleEnvelope({
    sender: '+19995550199',
    text: '/ollama hello',
  });
  assert.equal(denied.accepted, false);
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.action, 'dropped');

  const help = await router.handleEnvelope({
    sender: '+17575550100',
    text: '/help',
  });
  assert.equal(help.accepted, true);
  assert.equal(help.action, 'builtin');
  assert.match(help.replyText || '', /\/ollama/);

  const status = await router.handleEnvelope({
    sender: '+17575550100',
    text: '/status',
  });
  assert.equal(status.accepted, true);
  assert.equal(status.action, 'builtin');
  assert.match(status.replyText || '', /localOnly=true/);

  const hermes = await router.handleEnvelope({
    sender: '+17575550100',
    text: '/hermes list active services',
  });
  assert.equal(hermes.accepted, true);
  assert.equal(hermes.action, 'dry_run');
  assert.equal(hermes.matchedRoute?.id, 'hermes-agent');

  const fallback = await router.handleEnvelope({
    sender: '+17575550100',
    text: 'Plain message with no slash prefix',
  });
  assert.equal(fallback.accepted, true);
  assert.equal(fallback.matchedRoute?.id, 'ollama-default');
});

test('Router blocks shell injection when blockShellMetacharacters is enabled', async () => {
  const router = new SignalBridgeRouter(structuredClone(DEFAULT_BRIDGE_CONFIG));
  const decision = await router.handleEnvelope({
    sender: '+17575550100',
    text: '/hermes run $(whoami) && rm -rf /tmp/x',
  });
  assert.equal(decision.accepted, false);
  assert.equal(decision.statusCode, 400);
  assert.match(decision.reason, /command sanitizer/i);
});

test('Router enforces sliding-window rate limits and resets after window expires', async () => {
  const cfg = structuredClone(DEFAULT_BRIDGE_CONFIG);
  cfg.rateLimit = { maxRequests: 2, windowMs: 10_000 };
  const router = new SignalBridgeRouter(cfg);

  const t0 = 1_700_000_000_000;
  const r1 = await router.handleEnvelope({ sender: '+17575550100', text: 'msg 1' }, { now: t0 });
  const r2 = await router.handleEnvelope({ sender: '+17575550100', text: 'msg 2' }, { now: t0 + 1000 });
  const r3 = await router.handleEnvelope({ sender: '+17575550100', text: 'msg 3' }, { now: t0 + 2000 });

  assert.equal(r1.accepted, true);
  assert.equal(r2.accepted, true);
  assert.equal(r3.accepted, false);
  assert.equal(r3.statusCode, 429);
  assert.equal(r3.action, 'rate_limited');
  assert.ok((r3.rateLimit?.retryAfterMs ?? 0) > 0);

  // Different sender has independent bucket
  const other = await router.handleEnvelope({ sender: '+17575550101', text: 'msg 1' }, { now: t0 + 2500 });
  assert.equal(other.accepted, true);

  // Original sender succeeds again once sliding window advances
  const r4 = await router.handleEnvelope({ sender: '+17575550100', text: 'msg 4' }, { now: t0 + 10_500 });
  assert.equal(r4.accepted, true);
});

test('Reply chunker splits long text cleanly with part prefixes', () => {
  const shortChunks = chunkSignalReply('Short reply', 120);
  assert.deepEqual(shortChunks, ['Short reply']);

  const longText = Array.from({ length: 12 }, (_, i) => `Paragraph ${i + 1}: ` + 'signal '.repeat(8)).join('\n\n');
  const chunks = chunkSignalReply(longText, 180);
  assert.ok(chunks.length >= 3);
  assert.ok(chunks[0].startsWith('[1/'));
  assert.ok(chunks[chunks.length - 1].startsWith(`[${chunks.length}/${chunks.length}]`));
});
