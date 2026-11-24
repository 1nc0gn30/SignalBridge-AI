import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeHmacSha256Hex,
  detectInlineSecret,
  isValidE164,
  isValidGroupId,
  normalizeE164,
  sanitizeIncomingMessage,
  timingSafeEqualHex,
  validateAllowlist,
  validateBackendUrl,
} from '../src/core/security.ts';

test('E.164 normalization and validation', () => {
  assert.equal(normalizeE164('+1 (757) 555-0100'), '+17575550100');
  assert.equal(isValidE164('+17575550100'), true);
  assert.equal(isValidE164('+0123456'), false);
  assert.equal(isValidE164('not-a-phone'), false);
  assert.equal(isValidGroupId('ops-local-alerts-group-01'), true);
  assert.equal(isValidGroupId('short'), false);
  assert.equal(isValidGroupId('bad group with spaces!'), false);
});

test('Allowlist enforces default-deny and matches phone or group', () => {
  const emptyCheck = validateAllowlist('+17575550100', undefined, {
    phoneNumbers: [],
    groupIds: [],
  });
  assert.equal(emptyCheck.allowed, false);
  assert.match(emptyCheck.reason, /Default-deny/i);

  const phoneMatch = validateAllowlist('+1 (757) 555-0100', undefined, {
    phoneNumbers: ['+17575550100'],
    groupIds: [],
  });
  assert.equal(phoneMatch.allowed, true);
  assert.equal(phoneMatch.matchedBy, 'phone');

  const groupMatch = validateAllowlist('+19995550199', 'ops-local-alerts-group-01', {
    phoneNumbers: ['+17575550100'],
    groupIds: ['ops-local-alerts-group-01'],
  });
  assert.equal(groupMatch.allowed, true);
  assert.equal(groupMatch.matchedBy, 'group');

  const dryRunOverride = validateAllowlist(
    '+19995550199',
    undefined,
    { phoneNumbers: [], groupIds: [], allowAllInDryRun: true },
    true,
  );
  assert.equal(dryRunOverride.allowed, true);
  assert.equal(dryRunOverride.matchedBy, 'dry_run_override');

  // allowAllInDryRun must never bypass live mode
  const liveNoBypass = validateAllowlist(
    '+19995550199',
    undefined,
    { phoneNumbers: [], groupIds: [], allowAllInDryRun: true },
    false,
  );
  assert.equal(liveNoBypass.allowed, false);
});

test('SSRF URL guard blocks cloud metadata, non-HTTP schemes, credentials, and remote hosts in localOnly mode', () => {
  assert.equal(validateBackendUrl('http://127.0.0.1:11434', { localOnly: true }).valid, true);
  assert.equal(validateBackendUrl('http://localhost:8642/v1/chat/completions', { localOnly: true }).valid, true);
  assert.equal(validateBackendUrl('http://[::1]:1234', { localOnly: true }).valid, true);

  const awsMeta = validateBackendUrl('http://169.254.169.254/latest/meta-data/', { localOnly: false });
  assert.equal(awsMeta.valid, false);
  assert.equal(awsMeta.code, 'BLOCKED_METADATA_HOST');

  const gcpMeta = validateBackendUrl('http://metadata.google.internal/computeMetadata/v1/', { localOnly: false });
  assert.equal(gcpMeta.valid, false);
  assert.equal(gcpMeta.code, 'BLOCKED_METADATA_HOST');

  const mappedIpv6Meta = validateBackendUrl('http://[::ffff:169.254.169.254]/latest', { localOnly: false });
  assert.equal(mappedIpv6Meta.valid, false);
  assert.equal(mappedIpv6Meta.code, 'BLOCKED_METADATA_HOST');

  const fileScheme = validateBackendUrl('file:///etc/passwd', { localOnly: false });
  assert.equal(fileScheme.valid, false);
  assert.equal(fileScheme.code, 'UNSUPPORTED_PROTOCOL');

  const credsInUrl = validateBackendUrl('http://admin:secret@127.0.0.1:11434', { localOnly: true });
  assert.equal(credsInUrl.valid, false);
  assert.equal(credsInUrl.code, 'CREDENTIALS_IN_URL');

  const remoteBlocked = validateBackendUrl('https://api.example.com/v1/chat', { localOnly: true });
  assert.equal(remoteBlocked.valid, false);
  assert.equal(remoteBlocked.code, 'NON_LOCAL_HOST');

  const remoteAllowed = validateBackendUrl('https://api.example.com/v1/chat', { localOnly: false });
  assert.equal(remoteAllowed.valid, true);

  const lanBlocked = validateBackendUrl('http://192.168.1.50:11434', {
    localOnly: true,
    allowPrivateLan: false,
  });
  assert.equal(lanBlocked.valid, false);

  const lanAllowed = validateBackendUrl('http://192.168.1.50:11434', {
    localOnly: true,
    allowPrivateLan: true,
  });
  assert.equal(lanAllowed.valid, true);
});

test('Input sanitizer strips control chars, enforces length, parses commands, and detects shell metacharacters', () => {
  const sanitized = sanitizeIncomingMessage('/Ollama \x00hello\x07 world\nline2', { maxLength: 50 });
  assert.equal(sanitized.strippedControlChars, 2);
  assert.equal(sanitized.command, '/ollama');
  assert.equal(sanitized.prompt, 'hello world\nline2');
  assert.equal(sanitized.shellMetacharactersDetected.length, 0);

  const longMsg = sanitizeIncomingMessage('a'.repeat(120), { maxLength: 64 });
  assert.equal(longMsg.truncated, true);
  assert.equal(longMsg.cleaned.length, 64);

  const injection = sanitizeIncomingMessage('/hermes check $(cat /etc/shadow) && curl http://evil.test');
  assert.ok(injection.shellMetacharactersDetected.length >= 2);
});

test('Inline secret detector catches raw keys but permits env var names', () => {
  assert.equal(detectInlineSecret('LOCAL_OPENAI_API_KEY'), null);
  assert.ok(detectInlineSecret(['sk', '-proj-1234567890abcdef123456'].join('')));
  assert.ok(detectInlineSecret(['ghp', '_1234567890abcdefghij1234567890'].join('')));
  assert.ok(detectInlineSecret(['AKIA', 'IOSFODNN7EXAMPLE'].join('')));
});

test('HMAC-SHA256 signing and constant-time hex compare', async () => {
  const sig1 = await computeHmacSha256Hex('test-secret', '{"hello":"world"}');
  const sig2 = await computeHmacSha256Hex('test-secret', '{"hello":"world"}');
  const sig3 = await computeHmacSha256Hex('wrong-secret', '{"hello":"world"}');
  assert.equal(sig1.length, 64);
  assert.equal(timingSafeEqualHex(sig1, sig2), true);
  assert.equal(timingSafeEqualHex(sig1, sig3), false);
});
