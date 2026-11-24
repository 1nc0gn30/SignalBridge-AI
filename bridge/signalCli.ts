import { validateBackendUrl } from '../src/core/security.ts';
import type { BridgeConfig, IncomingSignalEnvelope } from '../src/core/types.ts';

/**
 * Normalize either a native signal-cli JSON-RPC envelope or a flat webhook body
 * into an IncomingSignalEnvelope.
 */
export function parseSignalWebhookPayload(payload: unknown): IncomingSignalEnvelope | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;

  // Native signal-cli JSON-RPC envelope format:
  // { envelope: { sourceNumber, source, timestamp, dataMessage: { message, groupInfo: { groupId } } } }
  if (obj.envelope && typeof obj.envelope === 'object') {
    const env = obj.envelope as Record<string, unknown>;
    const dataMsg = (env.dataMessage ?? {}) as Record<string, unknown>;
    const groupInfo = (dataMsg.groupInfo ?? {}) as Record<string, unknown>;
    const sender =
      typeof env.sourceNumber === 'string'
        ? env.sourceNumber
        : typeof env.source === 'string'
          ? env.source
          : '';
    const text = typeof dataMsg.message === 'string' ? dataMsg.message : '';
    const groupId = typeof groupInfo.groupId === 'string' ? groupInfo.groupId : undefined;
    const timestamp = typeof env.timestamp === 'number' ? env.timestamp : Date.now();
    if (!sender && !text) return null;
    return { sender, groupId, text, timestamp };
  }

  // Flat webhook format: { sender, text, groupId?, timestamp?, messageId? }
  const sender = typeof obj.sender === 'string' ? obj.sender : '';
  const text = typeof obj.text === 'string' ? obj.text : '';
  const groupId = typeof obj.groupId === 'string' ? obj.groupId : undefined;
  const timestamp = typeof obj.timestamp === 'number' ? obj.timestamp : Date.now();
  const messageId = typeof obj.messageId === 'string' ? obj.messageId : undefined;

  if (!sender && !text) return null;
  return { sender, groupId, text, timestamp, messageId };
}

export interface SendSignalOptions {
  recipient: string;
  groupId?: string;
  chunks: string[];
  config: BridgeConfig;
  fetchImpl?: typeof fetch;
}

export async function sendSignalReplies(
  options: SendSignalOptions,
): Promise<{ sentChunks: number; rpcIds: string[] }> {
  const { recipient, groupId, chunks, config, fetchImpl = globalThis.fetch } = options;
  const urlCheck = validateBackendUrl(config.signalCliUrl, {
    localOnly: config.security.localOnly,
    allowPrivateLan: config.security.allowPrivateLan,
  });
  if (!urlCheck.valid) {
    throw new Error(urlCheck.reason || 'signal-cli URL failed SSRF validation');
  }

  const rpcIds: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const rpcId = `sb-${Date.now()}-${i + 1}`;
    const params: Record<string, unknown> = {
      account: config.signalAccount,
      message: chunks[i],
    };
    if (groupId) {
      params.groupId = groupId;
    } else {
      params.recipient = [recipient];
    }

    const res = await fetchImpl(config.signalCliUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SignalBridge-AI/1.0',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: rpcId,
        method: 'send',
        params,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      throw new Error(`signal-cli RPC returned HTTP ${res.status}: ${detail}`);
    }
    rpcIds.push(rpcId);
  }

  return { sentChunks: rpcIds.length, rpcIds };
}
