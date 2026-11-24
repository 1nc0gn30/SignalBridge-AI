export type AdapterKind = 'ollama' | 'openai-compatible' | 'hermes' | 'webhook';

export interface AgentRoute {
  id: string;
  name: string;
  prefix: string;
  adapter: AdapterKind;
  endpoint: string;
  model?: string;
  systemPrompt?: string;
  apiKeyEnv?: string;
  signingSecretEnv?: string;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
  enabled: boolean;
  isDefault?: boolean;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface AllowlistConfig {
  phoneNumbers: string[];
  groupIds: string[];
  allowAllInDryRun?: boolean;
}

export interface SecurityPolicy {
  localOnly: boolean;
  allowPrivateLan: boolean;
  maxMessageLength: number;
  maxReplyChunkLength: number;
  blockShellMetacharacters: boolean;
}

export interface BridgeConfig {
  version: string;
  signalAccount: string;
  signalCliUrl: string;
  dryRun: boolean;
  allowlist: AllowlistConfig;
  rateLimit: RateLimitConfig;
  security: SecurityPolicy;
  routes: AgentRoute[];
}

export interface IncomingSignalEnvelope {
  sender: string;
  groupId?: string;
  text: string;
  timestamp?: number;
  messageId?: string;
}

export interface SanitizedMessage {
  raw: string;
  cleaned: string;
  command: string | null;
  prompt: string;
  truncated: boolean;
  strippedControlChars: number;
  shellMetacharactersDetected: string[];
}

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  hostname?: string;
  reason?: string;
  code?:
    | 'INVALID_URL'
    | 'UNSUPPORTED_PROTOCOL'
    | 'CREDENTIALS_IN_URL'
    | 'BLOCKED_METADATA_HOST'
    | 'NON_LOCAL_HOST'
    | 'OK';
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
  retryAfterMs: number;
}

export interface AdapterRequest {
  adapter: AdapterKind;
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  redactedHeaders: Record<string, string>;
  body: Record<string, unknown>;
  bodyText: string;
}

export interface PipelineStep {
  stage:
    | 'allowlist'
    | 'rate_limit'
    | 'sanitize'
    | 'route_match'
    | 'ssrf_guard'
    | 'adapter_build'
    | 'dispatch';
  status: 'pass' | 'warn' | 'fail' | 'skipped';
  detail: string;
}

export interface RouteDecision {
  accepted: boolean;
  statusCode: number;
  action: 'dispatch' | 'dry_run' | 'builtin' | 'dropped' | 'rate_limited' | 'error';
  reason: string;
  senderNormalized: string;
  sanitized?: SanitizedMessage;
  rateLimit?: RateLimitResult;
  matchedRoute?: AgentRoute;
  urlCheck?: UrlValidationResult;
  adapterRequest?: AdapterRequest;
  replyText?: string;
  replyChunks?: string[];
  steps: PipelineStep[];
}

export interface SecurityAuditFinding {
  severity: 'error' | 'warning' | 'info';
  code: string;
  field: string;
  message: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  securityScore: number;
  findings: SecurityAuditFinding[];
}
