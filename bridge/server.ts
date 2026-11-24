import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { SignalBridgeRouter, validateBridgeConfig } from '../src/core/router.ts';
import { computeHmacSha256Hex, timingSafeEqualHex } from '../src/core/security.ts';
import type { BridgeConfig } from '../src/core/types.ts';
import { parseSignalWebhookPayload, sendSignalReplies } from './signalCli.ts';

export interface BridgeServerOptions {
  config: BridgeConfig;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  ingestToken?: string;
}

export function createBridgeApp(options: BridgeServerOptions): {
  app: Express;
  router: SignalBridgeRouter;
} {
  const router = new SignalBridgeRouter(options.config);
  const env = options.env ?? process.env;
  const ingestToken = options.ingestToken ?? env.SIGNAL_BRIDGE_INGEST_TOKEN;
  const startedAt = Date.now();

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  async function requireIngestToken(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!ingestToken) {
      next();
      return;
    }
    const headerToken =
      req.header('x-signalbridge-token') ||
      (req.header('authorization')?.startsWith('Bearer ')
        ? req.header('authorization')!.slice(7)
        : '');

    // Compare SHA-256 HMAC digests with fixed length to prevent timing leaks
    const [expectedHash, providedHash] = await Promise.all([
      computeHmacSha256Hex('signalbridge-ingest', ingestToken),
      computeHmacSha256Hex('signalbridge-ingest', headerToken),
    ]);

    if (!timingSafeEqualHex(expectedHash, providedHash)) {
      res.status(401).json({
        ok: false,
        error: 'Unauthorized: missing or invalid X-SignalBridge-Token',
      });
      return;
    }
    next();
  }

  app.get('/health', (_req: Request, res: Response) => {
    const cfg = router.getConfig();
    const validation = validateBridgeConfig(cfg);
    res.json({
      ok: true,
      service: 'signalbridge-ai',
      version: cfg.version,
      dryRun: cfg.dryRun,
      localOnly: cfg.security.localOnly,
      enabledRoutes: cfg.routes.filter((r) => r.enabled).length,
      securityScore: validation.securityScore,
      uptimeMs: Date.now() - startedAt,
    });
  });

  app.get('/api/routes', (_req: Request, res: Response) => {
    const cfg = router.getConfig();
    res.json({
      ok: true,
      routes: cfg.routes.map((r) => ({
        id: r.id,
        name: r.name,
        prefix: r.prefix,
        adapter: r.adapter,
        endpoint: r.endpoint,
        model: r.model,
        enabled: r.enabled,
        isDefault: Boolean(r.isDefault),
        usesApiKeyEnv: Boolean(r.apiKeyEnv),
        usesSigningSecretEnv: Boolean(r.signingSecretEnv),
      })),
    });
  });

  app.post('/api/config/validate', (req: Request, res: Response) => {
    const candidate = req.body as BridgeConfig;
    if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.routes)) {
      res.status(400).json({ ok: false, error: 'Invalid BridgeConfig JSON payload' });
      return;
    }
    const validation = validateBridgeConfig(candidate);
    res.json({ ok: true, validation });
  });

  app.post('/api/simulate', async (req: Request, res: Response) => {
    const envelope = parseSignalWebhookPayload(req.body);
    if (!envelope) {
      res.status(400).json({
        ok: false,
        error: 'Expected { sender, text, groupId? } or native signal-cli envelope',
      });
      return;
    }
    const decision = await router.handleEnvelope(envelope, {
      dryRun: true,
      env,
    });
    res.status(decision.statusCode).json({
      ok: decision.accepted,
      decision: {
        ...decision,
        adapterRequest: decision.adapterRequest
          ? {
              ...decision.adapterRequest,
              headers: decision.adapterRequest.redactedHeaders,
            }
          : undefined,
      },
    });
  });

  app.post('/webhook/signal', requireIngestToken, async (req: Request, res: Response) => {
    const envelope = parseSignalWebhookPayload(req.body);
    if (!envelope) {
      res.status(400).json({
        ok: false,
        error: 'Invalid Signal webhook payload',
      });
      return;
    }

    const decision = await router.handleEnvelope(envelope, {
      env,
      fetchImpl: options.fetchImpl,
    });

    let delivery: { sentChunks: number; rpcIds: string[] } | null = null;
    if (
      !router.getConfig().dryRun &&
      decision.accepted &&
      decision.replyChunks &&
      decision.replyChunks.length > 0
    ) {
      try {
        delivery = await sendSignalReplies({
          recipient: decision.senderNormalized,
          groupId: envelope.groupId,
          chunks: decision.replyChunks,
          config: router.getConfig(),
          fetchImpl: options.fetchImpl,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(502).json({
          ok: false,
          error: `Backend succeeded but signal-cli send failed: ${msg}`,
          decision: {
            ...decision,
            adapterRequest: decision.adapterRequest
              ? {
                  ...decision.adapterRequest,
                  headers: decision.adapterRequest.redactedHeaders,
                }
              : undefined,
          },
        });
        return;
      }
    }

    res.status(decision.statusCode).json({
      ok: decision.accepted,
      delivery,
      decision: {
        ...decision,
        adapterRequest: decision.adapterRequest
          ? {
              ...decision.adapterRequest,
              headers: decision.adapterRequest.redactedHeaders,
            }
          : undefined,
      },
    });
  });

  return { app, router };
}
