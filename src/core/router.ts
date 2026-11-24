import { buildAdapterRequest, dispatchAdapterRequest } from './adapters.ts';
import { SlidingWindowRateLimiter } from './rateLimiter.ts';
import {
  detectInlineSecret,
  isSafeEnvVarName,
  isValidE164,
  isValidGroupId,
  sanitizeIncomingMessage,
  validateAllowlist,
  validateBackendUrl,
} from './security.ts';
import type {
  AgentRoute,
  BridgeConfig,
  ConfigValidationResult,
  IncomingSignalEnvelope,
  PipelineStep,
  RouteDecision,
  SecurityAuditFinding,
} from './types.ts';

export const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  version: '1.0',
  signalAccount: '+17575550199',
  signalCliUrl: 'http://127.0.0.1:8080/api/v1/rpc',
  dryRun: true,
  allowlist: {
    phoneNumbers: ['+17575550100', '+17575550101'],
    groupIds: ['ops-local-alerts-group-01'],
    allowAllInDryRun: false,
  },
  rateLimit: {
    maxRequests: 5,
    windowMs: 60_000,
  },
  security: {
    localOnly: true,
    allowPrivateLan: false,
    maxMessageLength: 4000,
    maxReplyChunkLength: 1800,
    blockShellMetacharacters: true,
  },
  routes: [
    {
      id: 'ollama-default',
      name: 'Local Ollama (Llama 3.2)',
      prefix: '/ollama',
      adapter: 'ollama',
      endpoint: 'http://127.0.0.1:11434',
      model: 'llama3.2',
      systemPrompt:
        'You are a concise private assistant reached via Signal. Reply in plain text without unnecessary filler.',
      timeoutMs: 30_000,
      maxTokens: 1024,
      temperature: 0.3,
      enabled: true,
      isDefault: true,
    },
    {
      id: 'hermes-agent',
      name: 'Hermes Local Agent',
      prefix: '/hermes',
      adapter: 'hermes',
      endpoint: 'http://127.0.0.1:8642/v1/chat/completions',
      model: 'hermes-local',
      apiKeyEnv: 'HERMES_API_KEY',
      systemPrompt: 'Execute local operational queries safely and return structured status.',
      timeoutMs: 45_000,
      maxTokens: 1536,
      temperature: 0.2,
      enabled: true,
    },
    {
      id: 'openai-compat',
      name: 'OpenAI-Compatible (LM Studio / vLLM)',
      prefix: '/code',
      adapter: 'openai-compatible',
      endpoint: 'http://127.0.0.1:1234',
      model: 'qwen2.5-coder-7b-instruct',
      apiKeyEnv: 'LOCAL_OPENAI_API_KEY',
      systemPrompt: 'Answer software engineering questions with concise, accurate code.',
      timeoutMs: 30_000,
      maxTokens: 1536,
      temperature: 0.2,
      enabled: true,
    },
    {
      id: 'local-webhook',
      name: 'Signed Local Webhook',
      prefix: '/webhook',
      adapter: 'webhook',
      endpoint: 'http://127.0.0.1:9001/hooks/signal',
      signingSecretEnv: 'SIGNALBRIDGE_WEBHOOK_SECRET',
      timeoutMs: 15_000,
      enabled: true,
    },
  ],
};

export function validateBridgeConfig(config: BridgeConfig): ConfigValidationResult {
  const findings: SecurityAuditFinding[] = [];
  let score = 100;

  if (!isValidE164(config.signalAccount)) {
    findings.push({
      severity: 'error',
      code: 'INVALID_SIGNAL_ACCOUNT',
      field: 'signalAccount',
      message: `Signal account "${config.signalAccount}" must be a valid E.164 phone number (e.g. +17575550199).`,
    });
    score -= 15;
  }

  const cliCheck = validateBackendUrl(config.signalCliUrl, {
    localOnly: config.security.localOnly,
    allowPrivateLan: config.security.allowPrivateLan,
  });
  if (!cliCheck.valid) {
    findings.push({
      severity: 'error',
      code: 'INVALID_SIGNAL_CLI_URL',
      field: 'signalCliUrl',
      message: cliCheck.reason || 'Invalid signal-cli JSON-RPC URL.',
    });
    score -= 20;
  }

  if (config.allowlist.phoneNumbers.length === 0 && config.allowlist.groupIds.length === 0) {
    findings.push({
      severity: 'warning',
      code: 'EMPTY_ALLOWLIST',
      field: 'allowlist',
      message: 'Allowlist is empty; bridge will default-deny all live Signal messages.',
    });
    score -= 10;
  }

  for (const phone of config.allowlist.phoneNumbers) {
    if (!isValidE164(phone)) {
      findings.push({
        severity: 'error',
        code: 'INVALID_ALLOWLIST_PHONE',
        field: 'allowlist.phoneNumbers',
        message: `Allowlist phone "${phone}" is not valid E.164.`,
      });
      score -= 10;
    }
  }

  for (const groupId of config.allowlist.groupIds) {
    if (!isValidGroupId(groupId)) {
      findings.push({
        severity: 'error',
        code: 'INVALID_ALLOWLIST_GROUP',
        field: 'allowlist.groupIds',
        message: `Allowlist group "${groupId}" has invalid characters or length (must be 8-128 chars).`,
      });
      score -= 8;
    }
  }

  if (!config.security.localOnly) {
    findings.push({
      severity: 'warning',
      code: 'REMOTE_EGRESS_ENABLED',
      field: 'security.localOnly',
      message: 'localOnly is disabled; outbound messages may leave your machine to remote endpoints.',
    });
    score -= 12;
  }

  if (config.rateLimit.maxRequests > 60) {
    findings.push({
      severity: 'warning',
      code: 'HIGH_RATE_LIMIT',
      field: 'rateLimit.maxRequests',
      message: `Rate limit (${config.rateLimit.maxRequests} req/window) is permissive; consider <= 20 per minute.`,
    });
    score -= 5;
  }

  if (!config.routes.some((r) => r.enabled)) {
    findings.push({
      severity: 'error',
      code: 'NO_ENABLED_ROUTES',
      field: 'routes',
      message: 'At least one enabled agent route is required.',
    });
    score -= 20;
  }

  const seenIds = new Set<string>();
  const seenPrefixes = new Set<string>();

  for (const route of config.routes) {
    if (seenIds.has(route.id)) {
      findings.push({
        severity: 'error',
        code: 'DUPLICATE_ROUTE_ID',
        field: `routes.${route.id}`,
        message: `Duplicate route id "${route.id}".`,
      });
      score -= 10;
    }
    seenIds.add(route.id);

    const normalizedPrefix = route.prefix.trim().toLowerCase();
    if (!/^\/[a-z0-9_-]{1,32}$/.test(normalizedPrefix)) {
      findings.push({
        severity: 'error',
        code: 'INVALID_ROUTE_PREFIX',
        field: `routes.${route.id}.prefix`,
        message: `Route "${route.id}" prefix "${route.prefix}" must start with "/" and use [a-z0-9_-].`,
      });
      score -= 10;
    } else if (seenPrefixes.has(normalizedPrefix)) {
      findings.push({
        severity: 'error',
        code: 'DUPLICATE_ROUTE_PREFIX',
        field: `routes.${route.id}.prefix`,
        message: `Duplicate command prefix "${normalizedPrefix}".`,
      });
      score -= 10;
    }
    seenPrefixes.add(normalizedPrefix);

    const urlCheck = validateBackendUrl(route.endpoint, {
      localOnly: config.security.localOnly,
      allowPrivateLan: config.security.allowPrivateLan,
    });
    if (!urlCheck.valid) {
      findings.push({
        severity: 'error',
        code: urlCheck.code || 'INVALID_ROUTE_URL',
        field: `routes.${route.id}.endpoint`,
        message: `Route "${route.id}": ${urlCheck.reason}`,
      });
      score -= 20;
    }

    const leakedInKey = detectInlineSecret(route.apiKeyEnv);
    if (leakedInKey) {
      findings.push({
        severity: 'error',
        code: 'INLINE_SECRET_DETECTED',
        field: `routes.${route.id}.apiKeyEnv`,
        message: `Route "${route.id}" contains an inline ${leakedInKey}. Put an environment variable name (e.g. LOCAL_API_KEY) instead.`,
      });
      score -= 30;
    } else if (route.apiKeyEnv && !isSafeEnvVarName(route.apiKeyEnv)) {
      findings.push({
        severity: 'warning',
        code: 'INVALID_ENV_VAR_NAME',
        field: `routes.${route.id}.apiKeyEnv`,
        message: `Route "${route.id}" apiKeyEnv "${route.apiKeyEnv}" should be UPPER_SNAKE_CASE.`,
      });
      score -= 5;
    }

    const leakedInSigning = detectInlineSecret(route.signingSecretEnv);
    if (leakedInSigning) {
      findings.push({
        severity: 'error',
        code: 'INLINE_SECRET_DETECTED',
        field: `routes.${route.id}.signingSecretEnv`,
        message: `Route "${route.id}" signingSecretEnv contains a raw secret instead of an env var name.`,
      });
      score -= 30;
    }
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  const hasError = findings.some((f) => f.severity === 'error');
  return {
    valid: !hasError,
    securityScore: boundedScore,
    findings,
  };
}

export function chunkSignalReply(text: string, maxChunkLength = 1800): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const limit = Math.max(80, maxChunkLength);
  if (trimmed.length <= limit) return [trimmed];

  const rawChunks: string[] = [];
  let remaining = trimmed;

  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);
    let splitIdx = window.lastIndexOf('\n\n');
    if (splitIdx < limit * 0.4) splitIdx = window.lastIndexOf('\n');
    if (splitIdx < limit * 0.4) splitIdx = window.lastIndexOf(' ');
    if (splitIdx < limit * 0.3) splitIdx = limit;

    rawChunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }
  if (remaining) {
    rawChunks.push(remaining);
  }

  if (rawChunks.length === 1) return rawChunks;
  return rawChunks.map((chunk, idx) => `[${idx + 1}/${rawChunks.length}] ${chunk}`);
}

export interface HandleMessageOptions {
  dryRun?: boolean;
  now?: number;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

export class SignalBridgeRouter {
  private config: BridgeConfig;
  private readonly rateLimiter: SlidingWindowRateLimiter;

  constructor(config: BridgeConfig = DEFAULT_BRIDGE_CONFIG) {
    this.config = config;
    this.rateLimiter = new SlidingWindowRateLimiter(config.rateLimit);
  }

  getConfig(): BridgeConfig {
    return this.config;
  }

  updateConfig(config: BridgeConfig): void {
    this.config = config;
    this.rateLimiter.updateConfig(config.rateLimit);
  }

  resetRateLimits(sender?: string): void {
    this.rateLimiter.reset(sender);
  }

  matchRoute(command: string | null): AgentRoute | null {
    const enabledRoutes = this.config.routes.filter((r) => r.enabled);
    if (command) {
      const exact = enabledRoutes.find((r) => r.prefix.toLowerCase() === command.toLowerCase());
      if (exact) return exact;
    }
    return enabledRoutes.find((r) => r.isDefault) ?? enabledRoutes[0] ?? null;
  }

  async handleEnvelope(
    envelope: IncomingSignalEnvelope,
    options: HandleMessageOptions = {},
  ): Promise<RouteDecision> {
    const dryRun = options.dryRun ?? this.config.dryRun;
    const now = options.now ?? Date.now();
    const steps: PipelineStep[] = [];

    // Stage 1: Allowlist gate
    const allowCheck = validateAllowlist(
      envelope.sender,
      envelope.groupId,
      this.config.allowlist,
      dryRun,
    );
    steps.push({
      stage: 'allowlist',
      status: allowCheck.allowed ? 'pass' : 'fail',
      detail: allowCheck.reason,
    });

    if (!allowCheck.allowed) {
      return {
        accepted: false,
        statusCode: 403,
        action: 'dropped',
        reason: allowCheck.reason,
        senderNormalized: allowCheck.normalizedSender,
        steps,
      };
    }

    // Stage 2: Sliding-window rate limit
    const rateResult = this.rateLimiter.check(allowCheck.normalizedSender, now);
    steps.push({
      stage: 'rate_limit',
      status: rateResult.allowed ? 'pass' : 'fail',
      detail: rateResult.allowed
        ? `Allowed (${rateResult.remaining}/${rateResult.limit} remaining in window)`
        : `Rate limit exceeded (${rateResult.limit} req/window). Retry in ${Math.ceil(rateResult.retryAfterMs / 1000)}s.`,
    });

    if (!rateResult.allowed) {
      return {
        accepted: false,
        statusCode: 429,
        action: 'rate_limited',
        reason: `Sender ${allowCheck.normalizedSender} exceeded rate limit (${rateResult.limit} requests/${Math.round(this.config.rateLimit.windowMs / 1000)}s)`,
        senderNormalized: allowCheck.normalizedSender,
        rateLimit: rateResult,
        steps,
      };
    }

    // Stage 3: Sanitize & parse command
    const sanitized = sanitizeIncomingMessage(envelope.text, {
      maxLength: this.config.security.maxMessageLength,
    });

    if (!sanitized.cleaned) {
      steps.push({
        stage: 'sanitize',
        status: 'fail',
        detail: 'Message body empty after control-character stripping',
      });
      return {
        accepted: false,
        statusCode: 400,
        action: 'dropped',
        reason: 'Empty message after sanitization',
        senderNormalized: allowCheck.normalizedSender,
        sanitized,
        rateLimit: rateResult,
        steps,
      };
    }

    if (
      this.config.security.blockShellMetacharacters &&
      sanitized.shellMetacharactersDetected.length > 0
    ) {
      steps.push({
        stage: 'sanitize',
        status: 'fail',
        detail: `Blocked suspicious shell pattern(s): ${sanitized.shellMetacharactersDetected.join(', ')}`,
      });
      return {
        accepted: false,
        statusCode: 400,
        action: 'dropped',
        reason: `Blocked by command sanitizer: ${sanitized.shellMetacharactersDetected.join(', ')}`,
        senderNormalized: allowCheck.normalizedSender,
        sanitized,
        rateLimit: rateResult,
        steps,
      };
    }

    steps.push({
      stage: 'sanitize',
      status: sanitized.strippedControlChars > 0 || sanitized.truncated ? 'warn' : 'pass',
      detail: `Parsed ${sanitized.command ? `command "${sanitized.command}"` : 'default route'} (${sanitized.cleaned.length} chars${sanitized.strippedControlChars ? `, stripped ${sanitized.strippedControlChars} control chars` : ''}${sanitized.truncated ? ', truncated' : ''})`,
    });

    // Built-in local diagnostics commands (/help, /status, /routes)
    if (sanitized.command === '/help' || sanitized.command === '/routes') {
      const routeList = this.config.routes
        .filter((r) => r.enabled)
        .map((r) => `${r.prefix} -> ${r.name} (${r.adapter}${r.isDefault ? ', default' : ''})`)
        .join('\n');
      const replyText = `SignalBridge AI v${this.config.version} (${dryRun ? 'dry-run' : 'live'})\nCommands:\n${routeList}\n/status -> Bridge posture & rate-limit quota\n/help -> List active routes`;
      steps.push({
        stage: 'route_match',
        status: 'pass',
        detail: `Handled built-in command "${sanitized.command}" locally without backend egress`,
      });
      return {
        accepted: true,
        statusCode: 200,
        action: 'builtin',
        reason: `Executed built-in command ${sanitized.command}`,
        senderNormalized: allowCheck.normalizedSender,
        sanitized,
        rateLimit: rateResult,
        replyText,
        replyChunks: chunkSignalReply(replyText, this.config.security.maxReplyChunkLength),
        steps,
      };
    }

    if (sanitized.command === '/status') {
      const enabledCount = this.config.routes.filter((r) => r.enabled).length;
      const replyText = `SignalBridge Status: OK | mode=${dryRun ? 'dry-run' : 'live'} | localOnly=${this.config.security.localOnly} | routes=${enabledCount} | quota=${rateResult.remaining}/${rateResult.limit}`;
      steps.push({
        stage: 'route_match',
        status: 'pass',
        detail: 'Handled built-in /status command locally',
      });
      return {
        accepted: true,
        statusCode: 200,
        action: 'builtin',
        reason: 'Executed built-in /status',
        senderNormalized: allowCheck.normalizedSender,
        sanitized,
        rateLimit: rateResult,
        replyText,
        replyChunks: chunkSignalReply(replyText, this.config.security.maxReplyChunkLength),
        steps,
      };
    }

    // Stage 4: Match agent route
    const matchedRoute = this.matchRoute(sanitized.command);
    if (!matchedRoute) {
      steps.push({
        stage: 'route_match',
        status: 'fail',
        detail: 'No enabled agent route configured',
      });
      return {
        accepted: false,
        statusCode: 404,
        action: 'error',
        reason: 'No enabled agent route matched',
        senderNormalized: allowCheck.normalizedSender,
        sanitized,
        rateLimit: rateResult,
        steps,
      };
    }

    steps.push({
      stage: 'route_match',
      status: 'pass',
      detail: `Matched route "${matchedRoute.id}" (${matchedRoute.adapter}) via ${sanitized.command === matchedRoute.prefix ? `prefix ${matchedRoute.prefix}` : 'default fallback'}`,
    });

    // Stage 5: SSRF & egress validation
    const urlCheck = validateBackendUrl(matchedRoute.endpoint, {
      localOnly: this.config.security.localOnly,
      allowPrivateLan: this.config.security.allowPrivateLan,
    });
    steps.push({
      stage: 'ssrf_guard',
      status: urlCheck.valid ? 'pass' : 'fail',
      detail: urlCheck.reason || 'Endpoint URL check failed',
    });

    if (!urlCheck.valid) {
      return {
        accepted: false,
        statusCode: 403,
        action: 'dropped',
        reason: urlCheck.reason || 'Blocked by SSRF guard',
        senderNormalized: allowCheck.normalizedSender,
        sanitized,
        rateLimit: rateResult,
        matchedRoute,
        urlCheck,
        steps,
      };
    }

    // Stage 6: Build backend adapter HTTP request
    const adapterRequest = await buildAdapterRequest(matchedRoute, sanitized, {
      sender: allowCheck.normalizedSender,
      groupId: envelope.groupId,
      timestamp: envelope.timestamp ?? now,
      env: options.env,
    });
    steps.push({
      stage: 'adapter_build',
      status: 'pass',
      detail: `Formatted ${adapterRequest.adapter} POST ${adapterRequest.url} (${adapterRequest.bodyText.length} bytes)`,
    });

    // Stage 7: Dry-run preview vs live dispatch
    if (dryRun) {
      const replyText = `[DRY-RUN -> ${matchedRoute.id} (${matchedRoute.adapter})]\nEndpoint: ${adapterRequest.url}\nModel: ${matchedRoute.model || 'n/a'}\nPrompt: "${sanitized.prompt || sanitized.cleaned}"\nStatus: Validated allowlist, rate limit (${rateResult.remaining}/${rateResult.limit}), sanitizer, and SSRF guard. No live network call sent.`;
      steps.push({
        stage: 'dispatch',
        status: 'skipped',
        detail: 'Dry-run mode active: request verified and previewed without outbound HTTP call',
      });
      return {
        accepted: true,
        statusCode: 200,
        action: 'dry_run',
        reason: `Dry-run validated for route ${matchedRoute.id}`,
        senderNormalized: allowCheck.normalizedSender,
        sanitized,
        rateLimit: rateResult,
        matchedRoute,
        urlCheck,
        adapterRequest,
        replyText,
        replyChunks: chunkSignalReply(replyText, this.config.security.maxReplyChunkLength),
        steps,
      };
    }

    try {
      const dispatched = await dispatchAdapterRequest(
        matchedRoute,
        adapterRequest,
        this.config.security,
        options.fetchImpl,
      );
      steps.push({
        stage: 'dispatch',
        status: 'pass',
        detail: `Dispatched to ${matchedRoute.id} (HTTP ${dispatched.status}, ${dispatched.replyText.length} chars)`,
      });
      return {
        accepted: true,
        statusCode: 200,
        action: 'dispatch',
        reason: `Dispatched successfully to ${matchedRoute.id}`,
        senderNormalized: allowCheck.normalizedSender,
        sanitized,
        rateLimit: rateResult,
        matchedRoute,
        urlCheck,
        adapterRequest,
        replyText: dispatched.replyText,
        replyChunks: chunkSignalReply(
          dispatched.replyText,
          this.config.security.maxReplyChunkLength,
        ),
        steps,
      };
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      steps.push({
        stage: 'dispatch',
        status: 'fail',
        detail: errMessage,
      });
      return {
        accepted: false,
        statusCode: 502,
        action: 'error',
        reason: errMessage,
        senderNormalized: allowCheck.normalizedSender,
        sanitized,
        rateLimit: rateResult,
        matchedRoute,
        urlCheck,
        adapterRequest,
        steps,
      };
    }
  }
}
