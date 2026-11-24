import { computeHmacSha256Hex, validateBackendUrl } from './security.ts';
import type {
  AdapterKind,
  AdapterRequest,
  AgentRoute,
  SanitizedMessage,
  SecurityPolicy,
} from './types.ts';

export interface BuildRequestContext {
  sender: string;
  groupId?: string;
  timestamp: number;
  env?: Record<string, string | undefined>;
}

function joinEndpointPath(baseUrl: string, suffix: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, '');
  if (clean.endsWith(suffix)) return clean;
  return `${clean}${suffix}`;
}

export async function buildAdapterRequest(
  route: AgentRoute,
  message: SanitizedMessage,
  context: BuildRequestContext,
): Promise<AdapterRequest> {
  const env = context.env ?? {};
  const userContent = message.prompt || message.cleaned;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'SignalBridge-AI/1.0',
  };
  const redactedHeaders: Record<string, string> = { ...headers };

  if (route.apiKeyEnv) {
    const resolvedKey = env[route.apiKeyEnv];
    if (resolvedKey) {
      headers.Authorization = `Bearer ${resolvedKey}`;
      redactedHeaders.Authorization = `Bearer [REDACTED:${route.apiKeyEnv}]`;
    } else {
      redactedHeaders.Authorization = `Bearer [UNSET:${route.apiKeyEnv}]`;
    }
  }

  let url = route.endpoint.trim().replace(/\/+$/, '');
  let body: Record<string, unknown>;

  switch (route.adapter) {
    case 'ollama': {
      url = joinEndpointPath(url, '/api/chat');
      const messages: Array<{ role: string; content: string }> = [];
      if (route.systemPrompt) {
        messages.push({ role: 'system', content: route.systemPrompt });
      }
      messages.push({ role: 'user', content: userContent });
      body = {
        model: route.model || 'llama3.2',
        stream: false,
        messages,
        options: {
          temperature: route.temperature ?? 0.3,
          num_predict: route.maxTokens ?? 1024,
        },
      };
      break;
    }

    case 'openai-compatible': {
      url = url.includes('/v1/chat/completions')
        ? url
        : joinEndpointPath(url, '/v1/chat/completions');
      const messages: Array<{ role: string; content: string }> = [];
      if (route.systemPrompt) {
        messages.push({ role: 'system', content: route.systemPrompt });
      }
      messages.push({ role: 'user', content: userContent });
      body = {
        model: route.model || 'local-model',
        temperature: route.temperature ?? 0.3,
        max_tokens: route.maxTokens ?? 1024,
        messages,
      };
      break;
    }

    case 'hermes': {
      url =
        url.includes('/v1/chat/completions') || url.includes('/api/')
          ? url
          : joinEndpointPath(url, '/v1/chat/completions');
      headers['X-Hermes-Channel'] = 'signal';
      headers['X-Hermes-Sender'] = context.sender;
      redactedHeaders['X-Hermes-Channel'] = 'signal';
      redactedHeaders['X-Hermes-Sender'] = context.sender;

      const messages: Array<{ role: string; content: string }> = [];
      if (route.systemPrompt) {
        messages.push({ role: 'system', content: route.systemPrompt });
      }
      messages.push({ role: 'user', content: userContent });
      body = {
        model: route.model || 'hermes-local',
        temperature: route.temperature ?? 0.2,
        max_tokens: route.maxTokens ?? 1024,
        messages,
        metadata: {
          source: 'signalbridge-ai',
          sender: context.sender,
          groupId: context.groupId ?? null,
          routeId: route.id,
        },
      };
      break;
    }

    case 'webhook': {
      body = {
        event: 'signal.message',
        routeId: route.id,
        sender: context.sender,
        groupId: context.groupId ?? null,
        command: message.command,
        text: userContent,
        timestamp: context.timestamp,
      };
      break;
    }
  }

  const bodyText = JSON.stringify(body);

  if (route.adapter === 'webhook' && route.signingSecretEnv) {
    const secret = env[route.signingSecretEnv] || `dry-run-preview:${route.signingSecretEnv}`;
    const sig = await computeHmacSha256Hex(secret, bodyText);
    headers['X-SignalBridge-Signature'] = `sha256=${sig}`;
    redactedHeaders['X-SignalBridge-Signature'] = env[route.signingSecretEnv]
      ? `sha256=${sig}`
      : `sha256=${sig.slice(0, 16)}... [PREVIEW:${route.signingSecretEnv}]`;
  }

  return {
    adapter: route.adapter,
    url,
    method: 'POST',
    headers,
    redactedHeaders,
    body,
    bodyText,
  };
}

export function parseAdapterResponse(adapter: AdapterKind, payload: unknown): string {
  if (typeof payload === 'string') {
    return payload.trim();
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Invalid ${adapter} response: expected JSON object`);
  }
  const data = payload as Record<string, unknown>;

  if (adapter === 'ollama') {
    const msg = data.message as Record<string, unknown> | undefined;
    if (msg && typeof msg.content === 'string') return msg.content.trim();
    if (typeof data.response === 'string') return data.response.trim();
  }

  if (adapter === 'openai-compatible' || adapter === 'hermes') {
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    const first = choices?.[0];
    const msg = first?.message as Record<string, unknown> | undefined;
    if (msg && typeof msg.content === 'string') return msg.content.trim();
    if (typeof first?.text === 'string') return first.text.trim();
    if (typeof data.reply === 'string') return data.reply.trim();
    if (typeof data.output === 'string') return data.output.trim();
  }

  if (adapter === 'webhook') {
    if (typeof data.reply === 'string') return data.reply.trim();
    if (typeof data.message === 'string') return data.message.trim();
    if (typeof data.text === 'string') return data.text.trim();
    if (typeof data.output === 'string') return data.output.trim();
  }

  throw new Error(`Unable to extract reply text from ${adapter} backend response`);
}

export async function dispatchAdapterRequest(
  route: AgentRoute,
  request: AdapterRequest,
  security: Pick<SecurityPolicy, 'localOnly' | 'allowPrivateLan'>,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ status: number; replyText: string; rawPayload: unknown }> {
  const urlCheck = validateBackendUrl(request.url, {
    localOnly: security.localOnly,
    allowPrivateLan: security.allowPrivateLan,
  });
  if (!urlCheck.valid) {
    throw new Error(urlCheck.reason || 'Backend URL blocked by SSRF guard');
  }

  const timeoutMs = Math.max(1000, Math.min(route.timeoutMs ?? 30000, 120000));
  const response = await fetchImpl(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.bodyText,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const contentType = response.headers.get('content-type') || '';
  const rawPayload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail =
      typeof rawPayload === 'string'
        ? rawPayload.slice(0, 240)
        : JSON.stringify(rawPayload).slice(0, 240);
    throw new Error(`Backend ${route.id} returned HTTP ${response.status}: ${detail}`);
  }

  const replyText = parseAdapterResponse(route.adapter, rawPayload);
  return {
    status: response.status,
    replyText,
    rawPayload,
  };
}
