import type { AllowlistConfig, SanitizedMessage, UrlValidationResult } from './types.ts';

const E164_REGEX = /^\+[1-9]\d{6,14}$/;
const GROUP_ID_REGEX = /^[A-Za-z0-9+/=_-]{8,128}$/;

const BLOCKED_METADATA_HOSTS = new Set([
  '169.254.169.254',
  '169.254.170.2',
  '100.100.100.200',
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
  'fd00:ec2::254',
  '0.0.0.0',
  '::',
]);

const INLINE_SECRET_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'OpenAI / Anthropic style API key', regex: /\bsk-[A-Za-z0-9_-]{16,}\b/ },
  { label: 'GitHub personal access token', regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { label: 'AWS access key ID', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: 'Google API key', regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { label: 'Slack token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { label: 'Raw Bearer token', regex: /^Bearer\s+[A-Za-z0-9._-]{16,}$/i },
];

const SHELL_METACHAR_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'command substitution $()', regex: /\$\([^)]*\)/ },
  { label: 'backtick execution', regex: /`[^`]+`/ },
  { label: 'chained shell operator', regex: /(?:&&|\|\||;\s*(?:rm|curl|wget|bash|sh|nc|python|node)\b)/i },
  { label: 'pipe to shell', regex: /\|\s*(?:sh|bash|zsh|dash)\b/i },
];

/**
 * Normalize a phone number string to E.164 format (stripping spaces, dashes, parens).
 */
export function normalizeE164(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return hasPlus ? `+${digits}` : `+${digits}`;
}

export function isValidE164(raw: string): boolean {
  const normalized = normalizeE164(raw);
  return E164_REGEX.test(normalized);
}

export function isValidGroupId(raw: string): boolean {
  return GROUP_ID_REGEX.test(raw.trim());
}

export interface AllowlistCheckResult {
  allowed: boolean;
  normalizedSender: string;
  matchedBy?: 'phone' | 'group' | 'dry_run_override';
  reason: string;
}

export function validateAllowlist(
  sender: string,
  groupId: string | undefined,
  allowlist: AllowlistConfig,
  dryRun = false,
): AllowlistCheckResult {
  const normalizedSender = normalizeE164(sender);

  if (!isValidE164(normalizedSender)) {
    return {
      allowed: false,
      normalizedSender,
      reason: `Invalid E.164 sender format: "${sender || '(empty)'}"`,
    };
  }

  const allowedPhones = new Set(
    allowlist.phoneNumbers.map((p) => normalizeE164(p)).filter((p) => isValidE164(p)),
  );
  const allowedGroups = new Set(
    allowlist.groupIds.map((g) => g.trim()).filter((g) => isValidGroupId(g)),
  );

  if (allowedPhones.has(normalizedSender)) {
    return {
      allowed: true,
      normalizedSender,
      matchedBy: 'phone',
      reason: `Sender ${normalizedSender} matched phone allowlist`,
    };
  }

  if (groupId && allowedGroups.has(groupId.trim())) {
    return {
      allowed: true,
      normalizedSender,
      matchedBy: 'group',
      reason: `Group ${groupId.trim()} matched group allowlist`,
    };
  }

  if (dryRun && allowlist.allowAllInDryRun) {
    return {
      allowed: true,
      normalizedSender,
      matchedBy: 'dry_run_override',
      reason: 'Allowed via explicit allowAllInDryRun simulator flag',
    };
  }

  if (allowedPhones.size === 0 && allowedGroups.size === 0) {
    return {
      allowed: false,
      normalizedSender,
      reason: 'Default-deny: allowlist has no valid phone numbers or group IDs configured',
    };
  }

  return {
    allowed: false,
    normalizedSender,
    reason: `Unauthorized sender ${normalizedSender}${groupId ? ` in group ${groupId}` : ''}`,
  };
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

function parseIpv4(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const nums: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    nums.push(n);
  }
  return nums;
}

export function isLoopbackHost(hostname: string): boolean {
  const h = stripIpv6Brackets(hostname).toLowerCase();
  if (h === 'localhost' || h === '::1' || h === '0:0:0:0:0:0:0:1') return true;
  if (h.endsWith('.localhost')) return true;
  const ipv4 = parseIpv4(h);
  if (ipv4 && ipv4[0] === 127) return true;
  if (h.startsWith('::ffff:127.')) return true;
  return false;
}

export function isPrivateLanHost(hostname: string): boolean {
  const h = stripIpv6Brackets(hostname).toLowerCase();
  const mappedIpv4 = h.startsWith('::ffff:') ? h.slice(7) : h;
  const ipv4 = parseIpv4(mappedIpv4);
  if (ipv4) {
    const [a, b] = ipv4;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  if (h.endsWith('.local') || h.endsWith('.internal')) {
    return !BLOCKED_METADATA_HOSTS.has(h);
  }
  return false;
}

function isLinkLocalMetadataIp(hostname: string): boolean {
  const h = stripIpv6Brackets(hostname).toLowerCase();
  if (BLOCKED_METADATA_HOSTS.has(h)) return true;
  const mappedIpv4 = h.startsWith('::ffff:') ? h.slice(7) : h;
  if (BLOCKED_METADATA_HOSTS.has(mappedIpv4)) return true;
  // Also handle hex/integer IPv4-mapped IPv6 like ::ffff:a9fe:a9fe (169.254.169.254)
  if (h.includes('a9fe:a9fe') || h.includes('a9fe:aa02')) return true;
  const ipv4 = parseIpv4(mappedIpv4);
  if (ipv4 && ipv4[0] === 169 && ipv4[1] === 254) return true;
  return false;
}

export function validateBackendUrl(
  rawUrl: string,
  options: { localOnly?: boolean; allowPrivateLan?: boolean } = {},
): UrlValidationResult {
  const { localOnly = true, allowPrivateLan = false } = options;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return {
      valid: false,
      code: 'INVALID_URL',
      reason: `Malformed backend URL: "${rawUrl}"`,
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      code: 'UNSUPPORTED_PROTOCOL',
      reason: `Unsupported URL protocol "${parsed.protocol}" (only http: and https: are permitted)`,
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      code: 'CREDENTIALS_IN_URL',
      reason: 'Embedded credentials in backend URLs are forbidden; use apiKeyEnv instead',
    };
  }

  const host = stripIpv6Brackets(parsed.hostname).toLowerCase();
  if (isLinkLocalMetadataIp(host)) {
    return {
      valid: false,
      hostname: host,
      code: 'BLOCKED_METADATA_HOST',
      reason: `SSRF guard blocked link-local/cloud metadata host "${host}"`,
    };
  }

  if (localOnly) {
    const allowedLocal = isLoopbackHost(host) || (allowPrivateLan && isPrivateLanHost(host));
    if (!allowedLocal) {
      return {
        valid: false,
        hostname: host,
        code: 'NON_LOCAL_HOST',
        reason: `localOnly policy rejected remote host "${host}" (disable localOnly or allowPrivateLan if intentional)`,
      };
    }
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString().replace(/\/$/, ''),
    hostname: host,
    code: 'OK',
    reason: `Verified ${isLoopbackHost(host) ? 'loopback' : isPrivateLanHost(host) ? 'private-LAN' : 'remote'} endpoint ${parsed.origin}`,
  };
}

export function detectInlineSecret(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  for (const pattern of INLINE_SECRET_PATTERNS) {
    if (pattern.regex.test(trimmed)) {
      return pattern.label;
    }
  }
  return null;
}

export function isSafeEnvVarName(name: string | undefined): boolean {
  if (!name) return true;
  return /^[A-Z][A-Z0-9_]{1,63}$/.test(name.trim());
}

export function sanitizeIncomingMessage(
  rawText: string,
  options: { maxLength?: number } = {},
): SanitizedMessage {
  const maxLength = options.maxLength ?? 4000;
  let strippedControlChars = 0;

  // Strip null bytes and ASCII control characters except \t (0x09) and \n (0x0a)
  let cleaned = '';
  for (let i = 0; i < rawText.length; i++) {
    const code = rawText.charCodeAt(i);
    if ((code < 32 && code !== 9 && code !== 10) || code === 127) {
      strippedControlChars += 1;
      continue;
    }
    cleaned += rawText[i];
  }

  cleaned = cleaned.replace(/\r/g, '').trim();
  let truncated = false;
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength);
    truncated = true;
  }

  const shellMetacharactersDetected: string[] = [];
  for (const item of SHELL_METACHAR_PATTERNS) {
    if (item.regex.test(cleaned)) {
      shellMetacharactersDetected.push(item.label);
    }
  }

  let command: string | null = null;
  let prompt = cleaned;
  const match = cleaned.match(/^(\/[a-zA-Z0-9_-]{1,32})(?:\s+([\s\S]*))?$/);
  if (match) {
    command = match[1].toLowerCase();
    prompt = (match[2] ?? '').trim();
  }

  return {
    raw: rawText,
    cleaned,
    command,
    prompt,
    truncated,
    strippedControlChars,
    shellMetacharactersDetected,
  };
}

/**
 * Isomorphic HMAC-SHA256 hex digest using Web Crypto (works in Node 20+ and browsers).
 */
export async function computeHmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuffer = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const bytes = new Uint8Array(sigBuffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Constant-time string comparison for HMAC hex signatures.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
