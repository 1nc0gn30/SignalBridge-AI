import { AlertTriangle, Check, Copy, Download, Plus, Shield, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  exportConfigJson,
  exportDockerCompose,
  exportEnvExample,
  exportSignalCliSetup,
} from '../core/exporters.ts';
import { validateBridgeConfig } from '../core/router.ts';
import type { AdapterKind, AgentRoute, BridgeConfig } from '../core/types.ts';

interface ConfigBuilderPanelProps {
  config: BridgeConfig;
  onChange: (next: BridgeConfig) => void;
}

type ExportFormat = 'json' | 'env' | 'docker' | 'cli';

export function ConfigBuilderPanel({ config, onChange }: ConfigBuilderPanelProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [copied, setCopied] = useState(false);

  const validation = useMemo(() => validateBridgeConfig(config), [config]);

  const exportedText = useMemo(() => {
    switch (exportFormat) {
      case 'json':
        return exportConfigJson(config);
      case 'env':
        return exportEnvExample(config);
      case 'docker':
        return exportDockerCompose(config);
      case 'cli':
        return exportSignalCliSetup(config);
    }
  }, [config, exportFormat]);

  const exportFileName =
    exportFormat === 'json'
      ? 'signalbridge.config.json'
      : exportFormat === 'env'
        ? '.env.example'
        : exportFormat === 'docker'
          ? 'docker-compose.yml'
          : 'setup-signal-cli.sh';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(exportedText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const blob = new Blob([exportedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateRoute = (index: number, patch: Partial<AgentRoute>) => {
    const nextRoutes = config.routes.map((route, idx) =>
      idx === index ? { ...route, ...patch } : route,
    );
    onChange({ ...config, routes: nextRoutes });
  };

  const removeRoute = (index: number) => {
    onChange({
      ...config,
      routes: config.routes.filter((_, idx) => idx !== index),
    });
  };

  const addRoute = () => {
    const num = config.routes.length + 1;
    const newRoute: AgentRoute = {
      id: `custom-agent-${num}`,
      name: `Custom Agent ${num}`,
      prefix: `/agent${num}`,
      adapter: 'ollama',
      endpoint: 'http://127.0.0.1:11434',
      model: 'llama3.2',
      timeoutMs: 30_000,
      enabled: true,
    };
    onChange({ ...config, routes: [...config.routes, newRoute] });
  };

  return (
    <div className="grid lg:grid-cols-12 gap-6 min-w-0">
      {/* Left column: Policy & Routes editor */}
      <div className="lg:col-span-7 space-y-5 min-w-0">
        {/* Security Posture Bar */}
        <div className="panel-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-signal-blue" aria-hidden="true" />
              <h3 className="font-display font-semibold text-base text-white">
                Security Policy & Allowlist
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Audit Score</span>
              <span
                className={`px-2.5 py-1 rounded font-mono text-xs font-bold ${
                  validation.securityScore >= 85
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : validation.securityScore >= 60
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'bg-red-500/15 text-red-300 border border-red-500/30'
                }`}
              >
                {validation.securityScore}/100
              </span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="cfg-account" className="block text-xs font-mono text-slate-300">
                Signal Bridge Account (E.164)
              </label>
              <input
                id="cfg-account"
                type="text"
                value={config.signalAccount}
                onChange={(e) => onChange({ ...config, signalAccount: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700/90 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-signal-blue min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cfg-cli-url" className="block text-xs font-mono text-slate-300">
                signal-cli JSON-RPC URL
              </label>
              <input
                id="cfg-cli-url"
                type="text"
                value={config.signalCliUrl}
                onChange={(e) => onChange({ ...config, signalCliUrl: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700/90 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-signal-blue min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cfg-phones" className="block text-xs font-mono text-slate-300">
                Allowed Phones (comma-separated)
              </label>
              <input
                id="cfg-phones"
                type="text"
                value={config.allowlist.phoneNumbers.join(', ')}
                onChange={(e) =>
                  onChange({
                    ...config,
                    allowlist: {
                      ...config.allowlist,
                      phoneNumbers: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                  })
                }
                className="w-full bg-slate-950 border border-slate-700/90 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-signal-blue min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cfg-groups" className="block text-xs font-mono text-slate-300">
                Allowed Group IDs (comma-separated)
              </label>
              <input
                id="cfg-groups"
                type="text"
                value={config.allowlist.groupIds.join(', ')}
                onChange={(e) =>
                  onChange({
                    ...config,
                    allowlist: {
                      ...config.allowlist,
                      groupIds: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                  })
                }
                className="w-full bg-slate-950 border border-slate-700/90 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-signal-blue min-h-[44px]"
              />
            </div>
          </div>

          {/* Toggles + Rate limit */}
          <div className="grid sm:grid-cols-3 gap-3 pt-1">
            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-200 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={config.security.localOnly}
                onChange={(e) =>
                  onChange({
                    ...config,
                    security: { ...config.security, localOnly: e.target.checked },
                  })
                }
                className="accent-signal-blue w-4 h-4"
              />
              <span>Enforce localOnly SSRF</span>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-200 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={config.security.blockShellMetacharacters}
                onChange={(e) =>
                  onChange({
                    ...config,
                    security: {
                      ...config.security,
                      blockShellMetacharacters: e.target.checked,
                    },
                  })
                }
                className="accent-signal-blue w-4 h-4"
              />
              <span>Block Shell Metachars</span>
            </label>

            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800 min-h-[44px]">
              <label htmlFor="cfg-rate" className="text-xs font-mono text-slate-300">
                Req/min
              </label>
              <input
                id="cfg-rate"
                type="number"
                min={1}
                max={120}
                value={config.rateLimit.maxRequests}
                onChange={(e) =>
                  onChange({
                    ...config,
                    rateLimit: {
                      ...config.rateLimit,
                      maxRequests: Math.max(1, Number(e.target.value) || 1),
                    },
                  })
                }
                className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white text-right"
              />
            </div>
          </div>

          {/* Live Findings */}
          {validation.findings.length > 0 && (
            <div className="space-y-1.5 pt-2">
              {validation.findings.map((f, idx) => (
                <div
                  key={`${f.code}-${idx}`}
                  className={`flex items-start gap-2 p-2.5 rounded-lg text-xs border ${
                    f.severity === 'error'
                      ? 'bg-red-500/10 border-red-500/30 text-red-200'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <span className="font-mono font-semibold mr-1.5">{f.field}:</span>
                    <span>{f.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent Routes List */}
        <div className="panel-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display font-semibold text-base text-white">
              Agent Routes ({config.routes.length})
            </h3>
            <button
              type="button"
              onClick={addRoute}
              className="inline-flex items-center gap-1.5 text-xs font-mono bg-signal-blue/15 hover:bg-signal-blue/25 text-sky-200 border border-signal-blue/40 px-3 py-2 rounded-lg transition-colors min-h-[40px]"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Add Route
            </button>
          </div>

          <div className="space-y-3">
            {config.routes.map((route, idx) => (
              <div
                key={route.id}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Enable ${route.name}`}
                      checked={route.enabled}
                      onChange={(e) => updateRoute(idx, { enabled: e.target.checked })}
                      className="accent-signal-blue w-4 h-4"
                    />
                    <span className="font-mono text-xs font-semibold text-white">
                      {route.prefix}
                    </span>
                    <span className="text-xs text-slate-400">{route.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRoute(idx)}
                    aria-label={`Remove route ${route.id}`}
                    className="text-slate-500 hover:text-red-400 p-1.5 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="grid sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    aria-label={`${route.id} prefix`}
                    value={route.prefix}
                    onChange={(e) => updateRoute(idx, { prefix: e.target.value })}
                    placeholder="/ollama"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white min-h-[40px]"
                  />
                  <select
                    aria-label={`${route.id} adapter`}
                    value={route.adapter}
                    onChange={(e) =>
                      updateRoute(idx, { adapter: e.target.value as AdapterKind })
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white min-h-[40px]"
                  >
                    <option value="ollama">ollama</option>
                    <option value="openai-compatible">openai-compatible</option>
                    <option value="hermes">hermes</option>
                    <option value="webhook">webhook</option>
                  </select>
                  <input
                    type="text"
                    aria-label={`${route.id} model or secret env`}
                    value={
                      route.adapter === 'webhook'
                        ? route.signingSecretEnv || ''
                        : route.model || ''
                    }
                    onChange={(e) =>
                      route.adapter === 'webhook'
                        ? updateRoute(idx, { signingSecretEnv: e.target.value })
                        : updateRoute(idx, { model: e.target.value })
                    }
                    placeholder={
                      route.adapter === 'webhook' ? 'SIGNING_SECRET_ENV' : 'llama3.2'
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white min-h-[40px]"
                  />
                </div>

                <input
                  type="text"
                  aria-label={`${route.id} endpoint URL`}
                  value={route.endpoint}
                  onChange={(e) => updateRoute(idx, { endpoint: e.target.value })}
                  placeholder="http://127.0.0.1:11434"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-sky-200 min-h-[40px]"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right column: Instant Export */}
      <div className="lg:col-span-5 panel-card p-5 flex flex-col space-y-4 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-800 pb-3">
          <h3 className="font-display font-semibold text-base text-white">
            Export Local Artifacts
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg min-h-[38px]"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              ) : (
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 text-xs font-mono bg-signal-blue hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg min-h-[38px]"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Save
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
          {(
            [
              ['json', 'config.json'],
              ['env', '.env'],
              ['docker', 'docker-compose'],
              ['cli', 'signal-cli.sh'],
            ] as Array<[ExportFormat, string]>
          ).map(([fmt, label]) => (
            <button
              key={fmt}
              type="button"
              onClick={() => setExportFormat(fmt)}
              className={`px-3 py-2 rounded-lg text-xs font-mono border transition-colors min-h-[40px] ${
                exportFormat === fmt
                  ? 'bg-signal-blue/20 border-signal-blue text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <pre className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3.5 text-xs font-mono text-slate-200 overflow-x-auto max-h-[540px] overflow-y-auto max-w-full">
          {exportedText}
        </pre>
      </div>
    </div>
  );
}
