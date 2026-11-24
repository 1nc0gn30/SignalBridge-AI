import type { BridgeConfig } from './types.ts';

export function exportConfigJson(config: BridgeConfig): string {
  return JSON.stringify(config, null, 2);
}

export function exportEnvExample(config: BridgeConfig): string {
  const envVars = new Set<string>();
  for (const route of config.routes) {
    if (route.apiKeyEnv) envVars.add(route.apiKeyEnv);
    if (route.signingSecretEnv) envVars.add(route.signingSecretEnv);
  }

  const lines = [
    '# SignalBridge AI — Local Orchestrator Environment',
    '# Never commit a populated .env file. Keep real keys local.',
    '',
    'SIGNAL_BRIDGE_PORT=8787',
    'SIGNAL_BRIDGE_HOST=127.0.0.1',
    `SIGNAL_BRIDGE_DRY_RUN=${config.dryRun ? 'true' : 'false'}`,
    'SIGNAL_BRIDGE_CONFIG=./signalbridge.config.json',
    `SIGNAL_ACCOUNT=${config.signalAccount}`,
    `SIGNAL_CLI_URL=${config.signalCliUrl}`,
    `SIGNAL_ALLOWLIST_PHONES=${config.allowlist.phoneNumbers.join(',')}`,
    `SIGNAL_ALLOWLIST_GROUPS=${config.allowlist.groupIds.join(',')}`,
    `SIGNAL_LOCAL_ONLY=${config.security.localOnly ? 'true' : 'false'}`,
    '',
    '# Optional shared secret to authenticate incoming POST /webhook/signal calls',
    'SIGNAL_BRIDGE_INGEST_TOKEN=replace-with-32-byte-random-hex',
  ];

  if (envVars.size > 0) {
    lines.push('', '# Route backend credentials (referenced by name in signalbridge.config.json)');
    for (const v of envVars) {
      lines.push(`${v}=`);
    }
  }

  return lines.join('\n') + '\n';
}

export function exportDockerCompose(config: BridgeConfig): string {
  return `services:
  signal-cli:
    image: bbernhard/signal-cli-rest-api:latest
    container_name: signalbridge-signal-cli
    restart: unless-stopped
    environment:
      - MODE=json-rpc
    ports:
      - "127.0.0.1:8080:8080"
    volumes:
      - ./signal-cli-data:/home/.local/share/signal-cli

  signalbridge:
    build: .
    container_name: signalbridge-orchestrator
    restart: unless-stopped
    depends_on:
      - signal-cli
    env_file:
      - .env
    environment:
      - SIGNAL_BRIDGE_HOST=0.0.0.0
      - SIGNAL_BRIDGE_PORT=8787
      - SIGNAL_CLI_URL=http://signal-cli:8080/api/v1/rpc
      - SIGNAL_LOCAL_ONLY=${config.security.localOnly ? 'true' : 'false'}
    ports:
      - "127.0.0.1:8787:8787"
    volumes:
      - ./signalbridge.config.json:/app/signalbridge.config.json:ro
`;
}

export function exportSignalCliSetup(config: BridgeConfig): string {
  return `# 1. Link your Signal device (scans QR code in Signal mobile app -> Linked Devices)
signal-cli link -n "SignalBridge-Local"

# 2. Start signal-cli in local-only JSON-RPC HTTP daemon mode
signal-cli -a "${config.signalAccount}" daemon --http 127.0.0.1:8080 --no-receive-stdout

# 3. Validate routing locally in dry-run simulator mode (no live sends)
npm run bridge:sim -- --sender "${config.allowlist.phoneNumbers[0] || '+17575550100'}" --text "/ollama summarize system health"

# 4. Run the local SignalBridge daemon (loopback only on 127.0.0.1:8787)
SIGNAL_BRIDGE_DRY_RUN=false npm run bridge`;
}
