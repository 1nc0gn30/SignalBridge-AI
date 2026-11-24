import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_BRIDGE_CONFIG, validateBridgeConfig } from '../src/core/router.ts';
import type { BridgeConfig, ConfigValidationResult } from '../src/core/types.ts';

function parseBoolEnv(val: string | undefined, fallback: boolean): boolean {
  if (val === undefined || val === '') return fallback;
  return val.toLowerCase() === 'true' || val === '1';
}

function parseListEnv(val: string | undefined): string[] | null {
  if (val === undefined) return null;
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadBridgeConfig(
  options: {
    configPath?: string;
    env?: Record<string, string | undefined>;
    dryRunOverride?: boolean;
  } = {},
): { config: BridgeConfig; validation: ConfigValidationResult; source: string } {
  const env = options.env ?? process.env;
  const resolvedPath = options.configPath || env.SIGNAL_BRIDGE_CONFIG;

  let base: BridgeConfig = structuredClone(DEFAULT_BRIDGE_CONFIG);
  let source = 'built-in defaults';

  if (resolvedPath && fs.existsSync(path.resolve(resolvedPath))) {
    const absPath = path.resolve(resolvedPath);
    const parsed = JSON.parse(fs.readFileSync(absPath, 'utf8')) as Partial<BridgeConfig>;
    base = {
      ...base,
      ...parsed,
      allowlist: {
        ...base.allowlist,
        ...(parsed.allowlist ?? {}),
      },
      rateLimit: {
        ...base.rateLimit,
        ...(parsed.rateLimit ?? {}),
      },
      security: {
        ...base.security,
        ...(parsed.security ?? {}),
      },
      routes: Array.isArray(parsed.routes) ? parsed.routes : base.routes,
    };
    source = absPath;
  }

  if (env.SIGNAL_ACCOUNT) {
    base.signalAccount = env.SIGNAL_ACCOUNT.trim();
  }
  if (env.SIGNAL_CLI_URL) {
    base.signalCliUrl = env.SIGNAL_CLI_URL.trim();
  }
  if (env.SIGNAL_BRIDGE_DRY_RUN !== undefined) {
    base.dryRun = parseBoolEnv(env.SIGNAL_BRIDGE_DRY_RUN, base.dryRun);
  }
  if (options.dryRunOverride !== undefined) {
    base.dryRun = options.dryRunOverride;
  }
  if (env.SIGNAL_LOCAL_ONLY !== undefined) {
    base.security.localOnly = parseBoolEnv(env.SIGNAL_LOCAL_ONLY, base.security.localOnly);
  }

  const envPhones = parseListEnv(env.SIGNAL_ALLOWLIST_PHONES);
  if (envPhones !== null) {
    base.allowlist.phoneNumbers = envPhones;
  }
  const envGroups = parseListEnv(env.SIGNAL_ALLOWLIST_GROUPS);
  if (envGroups !== null) {
    base.allowlist.groupIds = envGroups;
  }

  const validation = validateBridgeConfig(base);
  return { config: base, validation, source };
}
