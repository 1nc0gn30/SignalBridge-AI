import {
  Check,
  Coffee,
  Copy,
  Github,
  Layers,
  MessageSquare,
  Play,
  Settings2,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ArchitecturePanel } from './components/ArchitecturePanel.tsx';
import { ConfigBuilderPanel } from './components/ConfigBuilderPanel.tsx';
import { SimulatorPanel } from './components/SimulatorPanel.tsx';
import { DEFAULT_BRIDGE_CONFIG, SignalBridgeRouter } from './core/router.ts';
import type { BridgeConfig, RouteDecision } from './core/types.ts';

type WorkbenchTab = 'simulator' | 'config' | 'architecture';

const STRIPE_COFFEE_URL = 'https://buy.stripe.com/3cIfZg27PdKo2D64Ocfw40X';
const SOLANA_TIP_ADDRESS = 'GG2eQbVh8ut1BK6j1A2tz7pSySdLpD38BgyEhGcxdXoK';
const GITHUB_REPO_URL = 'https://github.com/1nc0gn30/SignalBridge-AI';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('simulator');
  const [config, setConfig] = useState<BridgeConfig>(() => structuredClone(DEFAULT_BRIDGE_CONFIG));
  const routerRef = useRef<SignalBridgeRouter>(new SignalBridgeRouter(DEFAULT_BRIDGE_CONFIG));
  const [decision, setDecision] = useState<RouteDecision | null>(null);
  const [history, setHistory] = useState<
    Array<{ id: number; sender: string; text: string; decision: RouteDecision }>
  >([]);
  const [copiedSol, setCopiedSol] = useState(false);

  const handleConfigChange = (next: BridgeConfig) => {
    setConfig(next);
    routerRef.current.updateConfig(next);
  };

  const runSimulation = async (sender: string, groupId: string, text: string) => {
    const result = await routerRef.current.handleEnvelope(
      {
        sender,
        groupId: groupId.trim() || undefined,
        text,
        timestamp: Date.now(),
      },
      { dryRun: true },
    );
    setDecision(result);
    setHistory((prev) => [
      { id: Date.now() + Math.random(), sender, text, decision: result },
      ...prev.slice(0, 14),
    ]);
  };

  const runBurstTest = async (sender: string, groupId: string, text: string) => {
    for (let i = 0; i < 6; i++) {
      await runSimulation(sender, groupId, text);
    }
  };

  const resetQuota = () => {
    routerRef.current.resetRateLimits();
  };

  useEffect(() => {
    // Run an initial deterministic dry-run preview on mount so the workbench opens live
    void runSimulation(
      DEFAULT_BRIDGE_CONFIG.allowlist.phoneNumbers[0],
      '',
      '/ollama Summarize our local backup status in 3 bullets',
    );
  }, []);

  const copySolanaAddress = async () => {
    await navigator.clipboard.writeText(SOLANA_TIP_ADDRESS);
    setCopiedSol(true);
    window.setTimeout(() => setCopiedSol(false), 1800);
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-100 selection:bg-signal-blue selection:text-white">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/90 bg-[#060a14]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-signal-blue flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <span className="font-display font-bold text-base sm:text-lg tracking-tight text-white whitespace-nowrap">
              SignalBridge AI
            </span>
            <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono text-sky-300 bg-signal-blue/15 border border-signal-blue/30 whitespace-nowrap">
              v1.0 · MIT
            </span>
          </div>

          <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-1">
            {(
              [
                ['simulator', 'Simulator'],
                ['config', 'Config Builder'],
                ['architecture', 'CLI & Architecture'],
              ] as Array<[WorkbenchTab, string]>
            ).map(([tabId, label]) => (
              <button
                key={tabId}
                type="button"
                onClick={() => setActiveTab(tabId)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tabId
                    ? 'text-white bg-slate-800/90'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View SignalBridge AI on GitHub"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-slate-200 bg-slate-900 border border-slate-700/80 hover:border-slate-500 transition-colors min-h-[44px] sm:min-h-[40px] whitespace-nowrap"
            >
              <Github className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <a
              href={STRIPE_COFFEE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Support SignalBridge AI via Buy Us a Coffee"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold text-amber-200 bg-amber-500/15 border border-amber-500/35 hover:bg-amber-500/25 transition-colors min-h-[44px] sm:min-h-[40px] whitespace-nowrap"
            >
              <Coffee className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Buy Us a Coffee</span>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* Compact Hero Header */}
        <section className="space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800/80">
            <div className="space-y-3 max-w-2xl">
              <p className="text-xs font-mono uppercase tracking-[0.2em] text-signal-blue">
                Local-First Signal &rarr; AI Agent Orchestrator
              </p>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.12]">
                Route Signal messages to local AI.
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
                Open-source TypeScript bridge connecting <code className="font-mono text-sky-300">signal-cli</code>{' '}
                to Ollama, Hermes, OpenAI-compatible servers, and HMAC-signed webhooks with
                default-deny allowlists and loopback SSRF enforcement.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs font-mono shrink-0">
              <div className="px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                <span>E.164 Allowlist</span>
              </div>
              <div className="px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                <span>SSRF Guard</span>
              </div>
              <div className="px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-signal-blue shrink-0" aria-hidden="true" />
                <span>Dry-Run CLI</span>
              </div>
              <div className="px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
                <span>4 Adapters</span>
              </div>
            </div>
          </div>

          {/* Workbench Mode Tabs */}
          <div
            role="tablist"
            aria-label="SignalBridge Workbench Views"
            className="grid grid-cols-3 sm:flex sm:items-center gap-2"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'simulator'}
              onClick={() => setActiveTab('simulator')}
              className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-colors whitespace-nowrap min-h-[44px] ${
                activeTab === 'simulator'
                  ? 'bg-signal-blue text-white border-signal-blue'
                  : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-600'
              }`}
            >
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">Simulator</span>
              <span className="hidden sm:inline">Route Simulator</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'config'}
              onClick={() => setActiveTab('config')}
              className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-colors whitespace-nowrap min-h-[44px] ${
                activeTab === 'config'
                  ? 'bg-signal-blue text-white border-signal-blue'
                  : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-600'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">Config</span>
              <span className="hidden sm:inline">Config & Export</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'architecture'}
              onClick={() => setActiveTab('architecture')}
              className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-colors whitespace-nowrap min-h-[44px] ${
                activeTab === 'architecture'
                  ? 'bg-signal-blue text-white border-signal-blue'
                  : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-600'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">CLI & Docs</span>
              <span className="hidden sm:inline">CLI & Architecture</span>
            </button>
          </div>
        </section>

        {/* Active Workbench View */}
        <section aria-live="polite" className="min-w-0">
          {activeTab === 'simulator' && (
            <SimulatorPanel
              config={config}
              decision={decision}
              history={history}
              onSimulate={runSimulation}
              onBurstTest={runBurstTest}
              onResetQuota={resetQuota}
            />
          )}
          {activeTab === 'config' && (
            <ConfigBuilderPanel config={config} onChange={handleConfigChange} />
          )}
          {activeTab === 'architecture' && <ArchitecturePanel />}
        </section>
      </main>

      {/* Clean Open-Source Footer with Optional Coffee Support */}
      <footer className="mt-12 border-t border-slate-800/90 bg-[#050811]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-slate-300 font-medium">
                Engineered by Neal Frazier Tech (
                <a
                  href="https://github.com/1nc0gn30"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline"
                >
                  @1nc0gn30
                </a>
                ) •{' '}
                <a
                  href="https://nullai.tech"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline"
                >
                  NullAI Platform
                </a>
              </p>
              <p className="text-xs text-slate-500">
                100% open-access MIT developer tool. All simulation and config generation runs
                client-side; no Signal messages or keys leave your machine.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono text-slate-300 bg-slate-900 border border-slate-800 hover:border-slate-600 min-h-[40px]"
              >
                <Github className="w-3.5 h-3.5" aria-hidden="true" />
                1nc0gn30/SignalBridge-AI
              </a>
              <a
                href={STRIPE_COFFEE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono text-amber-200 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 min-h-[40px]"
              >
                <Coffee className="w-3.5 h-3.5" aria-hidden="true" />
                Buy Us a Coffee
              </a>
              <button
                type="button"
                onClick={copySolanaAddress}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono text-slate-300 bg-slate-900 border border-slate-800 hover:border-slate-600 min-h-[40px]"
                title={`Copy Solana tip address: ${SOLANA_TIP_ADDRESS}`}
              >
                {copiedSol ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                ) : (
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                {copiedSol ? 'SOL Address Copied' : 'SOL Tip: GG2e...XoK'}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
