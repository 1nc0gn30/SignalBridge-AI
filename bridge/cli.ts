import 'dotenv/config';
import { SignalBridgeRouter } from '../src/core/router.ts';
import { loadBridgeConfig } from './config.ts';
import { createBridgeApp } from './server.ts';

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const command = args[0] && !args[0].startsWith('-') ? args[0] : 'serve';
  const flags: Record<string, string | boolean> = {};

  for (let i = command === args[0] ? 1 : 0; i < args.length; i++) {
    const token = args[i];
    if (token === '--help' || token === '-h') {
      flags.help = true;
    } else if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    }
  }
  return { command, flags };
}

function printHelp(): void {
  console.log(`SignalBridge AI CLI v1.0
Connect Signal to local AI agents (Ollama, OpenAI-compatible, Hermes, signed Webhooks).

Usage:
  npx tsx bridge/cli.ts serve [--dry-run] [--host 127.0.0.1] [--port 8787] [--config path]
  npx tsx bridge/cli.ts simulate --sender "+17575550100" --text "/ollama hello" [--group id] [--json]
  npx tsx bridge/cli.ts validate [--config path] [--json]

Examples:
  npm run bridge:dry-run
  npm run bridge:sim -- --sender "+17575550100" --text "/hermes check service health"
  npm run bridge:validate
`);
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv);

  if (flags.help || command === 'help') {
    printHelp();
    process.exit(0);
  }

  const configPath = typeof flags.config === 'string' ? flags.config : undefined;
  const dryRunFlag = flags['dry-run'] === true ? true : undefined;

  if (command === 'validate') {
    const { config, validation, source } = loadBridgeConfig({ configPath });
    if (flags.json) {
      console.log(JSON.stringify({ source, config, validation }, null, 2));
    } else {
      console.log(`Config source: ${source}`);
      console.log(`Valid: ${validation.valid} | Security score: ${validation.securityScore}/100`);
      for (const f of validation.findings) {
        console.log(`  [${f.severity.toUpperCase()}] ${f.field}: ${f.message}`);
      }
      if (validation.findings.length === 0) {
        console.log('  All security and routing invariants passed.');
      }
    }
    process.exit(validation.valid ? 0 : 1);
  }

  if (command === 'simulate') {
    const sender = typeof flags.sender === 'string' ? flags.sender : '+17575550100';
    const text = typeof flags.text === 'string' ? flags.text : '/help';
    const groupId = typeof flags.group === 'string' ? flags.group : undefined;
    const { config } = loadBridgeConfig({ configPath, dryRunOverride: true });
    const router = new SignalBridgeRouter(config);
    const decision = await router.handleEnvelope(
      { sender, groupId, text },
      { dryRun: true, env: process.env },
    );

    if (flags.json) {
      console.log(
        JSON.stringify(
          {
            ...decision,
            adapterRequest: decision.adapterRequest
              ? {
                  ...decision.adapterRequest,
                  headers: decision.adapterRequest.redactedHeaders,
                }
              : undefined,
          },
          null,
          2,
        ),
      );
    } else {
      console.log(`Action: ${decision.action} (HTTP ${decision.statusCode})`);
      console.log(`Reason: ${decision.reason}`);
      console.log('Pipeline:');
      for (const step of decision.steps) {
        console.log(`  [${step.status.toUpperCase()}] ${step.stage}: ${step.detail}`);
      }
      if (decision.adapterRequest) {
        console.log(`Adapter Request: ${decision.adapterRequest.method} ${decision.adapterRequest.url}`);
        console.log(`Headers: ${JSON.stringify(decision.adapterRequest.redactedHeaders)}`);
      }
      if (decision.replyText) {
        console.log(`\nReply preview:\n${decision.replyText}`);
      }
    }
    process.exit(decision.accepted ? 0 : 2);
  }

  if (command === 'serve') {
    const { config, validation, source } = loadBridgeConfig({
      configPath,
      dryRunOverride: dryRunFlag,
    });
    if (!validation.valid) {
      console.error(`Refusing to start with invalid config (${source}):`);
      for (const f of validation.findings) {
        console.error(`  [${f.severity.toUpperCase()}] ${f.field}: ${f.message}`);
      }
      process.exit(1);
    }

    const host =
      typeof flags.host === 'string'
        ? flags.host
        : process.env.SIGNAL_BRIDGE_HOST || '127.0.0.1';
    const port = Number(
      typeof flags.port === 'string' ? flags.port : process.env.SIGNAL_BRIDGE_PORT || 8787,
    );

    const { app } = createBridgeApp({ config, env: process.env });
    app.listen(port, host, () => {
      console.log(
        `[SignalBridge AI] listening on http://${host}:${port} | mode=${config.dryRun ? 'dry-run' : 'live'} | localOnly=${config.security.localOnly} | securityScore=${validation.securityScore}/100 | source=${source}`,
      );
    });
    return;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

main().catch((err) => {
  console.error('[SignalBridge AI] fatal error:', err);
  process.exit(1);
});
