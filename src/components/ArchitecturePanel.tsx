import { Check, Copy, Lock, Server, Shield, Terminal } from 'lucide-react';
import { useState } from 'react';

const CLI_SNIPPET = `# Clone and install
git clone https://github.com/1nc0gn30/SignalBridge-AI.git
cd SignalBridge-AI && npm install

# 1. Validate configuration & security posture (zero network calls)
npm run bridge:validate

# 2. Test message routing in dry-run simulator mode (no signal-cli required)
npm run bridge:sim -- --sender "+17575550100" --text "/ollama explain x3dh"

# 3. Start local bridge daemon in dry-run mode on 127.0.0.1:8787
npm run bridge:dry-run

# 4. Run full automated unit + integration test suite
npm test`;

const HMAC_SNIPPET = `// Verify X-SignalBridge-Signature on your custom webhook backend
import crypto from 'node:crypto';

export function verifySignature(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader || ''));
}`;

export function ArchitecturePanel() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyBlock = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* Architecture SVG diagram */}
      <div className="panel-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-display font-semibold text-base text-white">
            Local-First Signal-to-Agent Pipeline
          </h3>
          <span className="text-xs font-mono text-slate-400">
            Zero cloud relay · Loopback bound by default
          </span>
        </div>

        <div className="overflow-x-auto max-w-full">
          <svg
            viewBox="0 0 920 210"
            className="w-full min-w-[640px] h-auto"
            role="img"
            aria-label="SignalBridge AI local architecture diagram from Signal device through signal-cli JSON-RPC and security guardrails to local AI backends"
          >
            <title>SignalBridge AI Local Architecture</title>
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
              </marker>
            </defs>

            {/* Stage 1: Signal App */}
            <rect x="12" y="50" width="160" height="110" rx="12" fill="#0b1224" stroke="#2c6bed" strokeWidth="1.5" />
            <text x="92" y="88" textAnchor="middle" fill="#f8fafc" fontSize="14" fontWeight="700" fontFamily="sans-serif">
              Signal App
            </text>
            <text x="92" y="110" textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="monospace">
              X3DH + Double Ratchet
            </text>
            <text x="92" y="132" textAnchor="middle" fill="#38bdf8" fontSize="10" fontFamily="monospace">
              /ollama /hermes /code
            </text>

            <line x1="172" y1="105" x2="216" y2="105" stroke="#38bdf8" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* Stage 2: signal-cli */}
            <rect x="220" y="50" width="175" height="110" rx="12" fill="#0b1224" stroke="#334155" strokeWidth="1.5" />
            <text x="307" y="88" textAnchor="middle" fill="#f8fafc" fontSize="14" fontWeight="700" fontFamily="sans-serif">
              signal-cli daemon
            </text>
            <text x="307" y="110" textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="monospace">
              127.0.0.1:8080/rpc
            </text>
            <text x="307" y="132" textAnchor="middle" fill="#10b981" fontSize="10" fontFamily="monospace">
              Local decrypt &amp; send
            </text>

            <line x1="395" y1="105" x2="439" y2="105" stroke="#38bdf8" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* Stage 3: SignalBridge Guardrails */}
            <rect x="443" y="24" width="215" height="162" rx="12" fill="#0d1730" stroke="#2c6bed" strokeWidth="2" />
            <text x="550" y="52" textAnchor="middle" fill="#f8fafc" fontSize="14" fontWeight="700" fontFamily="sans-serif">
              SignalBridge :8787
            </text>
            <text x="550" y="76" textAnchor="middle" fill="#10b981" fontSize="11" fontFamily="monospace">
              1. E.164 / Group Allowlist
            </text>
            <text x="550" y="98" textAnchor="middle" fill="#10b981" fontSize="11" fontFamily="monospace">
              2. Sliding-Window Quota
            </text>
            <text x="550" y="120" textAnchor="middle" fill="#10b981" fontSize="11" fontFamily="monospace">
              3. Input &amp; Shell Sanitizer
            </text>
            <text x="550" y="142" textAnchor="middle" fill="#10b981" fontSize="11" fontFamily="monospace">
              4. Loopback SSRF Guard
            </text>
            <text x="550" y="164" textAnchor="middle" fill="#38bdf8" fontSize="11" fontFamily="monospace">
              5. Adapter + Reply Chunker
            </text>

            <line x1="658" y1="105" x2="702" y2="105" stroke="#38bdf8" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* Stage 4: Local Backends */}
            <rect x="706" y="18" width="202" height="38" rx="8" fill="#0b1224" stroke="#334155" />
            <text x="807" y="42" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontFamily="monospace">
              Ollama :11434/api/chat
            </text>

            <rect x="706" y="64" width="202" height="38" rx="8" fill="#0b1224" stroke="#334155" />
            <text x="807" y="88" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontFamily="monospace">
              Hermes :8642/v1/chat
            </text>

            <rect x="706" y="110" width="202" height="38" rx="8" fill="#0b1224" stroke="#334155" />
            <text x="807" y="134" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontFamily="monospace">
              OpenAI-Compat :1234/v1
            </text>

            <rect x="706" y="156" width="202" height="38" rx="8" fill="#0b1224" stroke="#334155" />
            <text x="807" y="180" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontFamily="monospace">
              Signed Webhook (HMAC)
            </text>
          </svg>
        </div>
      </div>

      {/* Security invariants grid */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="panel-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <Lock className="w-4 h-4" aria-hidden="true" />
            <h4 className="font-display font-semibold text-sm text-white">Default-Deny Allowlist</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every incoming envelope must match an explicit E.164 phone number or Signal group ID.
            Empty allowlists fail closed with HTTP 403.
          </p>
        </div>

        <div className="panel-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-signal-blue">
            <Shield className="w-4 h-4" aria-hidden="true" />
            <h4 className="font-display font-semibold text-sm text-white">SSRF & Secret Guard</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Blocks cloud metadata IPs (<code className="font-mono text-slate-300">169.254.169.254</code>),
            embedded URL credentials, and non-loopback hosts when <code className="font-mono text-slate-300">localOnly</code> is enabled.
          </p>
        </div>

        <div className="panel-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-sky-400">
            <Server className="w-4 h-4" aria-hidden="true" />
            <h4 className="font-display font-semibold text-sm text-white">Isomorphic Core</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            The browser workbench and local Express daemon execute the exact same TypeScript routing,
            rate-limiting, and WebCrypto HMAC modules in <code className="font-mono text-slate-300">src/core/</code>.
          </p>
        </div>
      </div>

      {/* CLI & HMAC snippets */}
      <div className="grid lg:grid-cols-2 gap-6 min-w-0">
        <div className="panel-card p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-signal-blue" aria-hidden="true" />
              Local CLI & Simulator Commands
            </span>
            <button
              type="button"
              onClick={() => copyBlock('cli', CLI_SNIPPET)}
              className="inline-flex items-center gap-1 text-xs font-mono text-slate-300 hover:text-white px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 min-h-[36px]"
            >
              {copiedId === 'cli' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedId === 'cli' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 text-xs font-mono text-slate-200 overflow-x-auto max-w-full">
            {CLI_SNIPPET}
          </pre>
        </div>

        <div className="panel-card p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              Webhook HMAC-SHA256 Verification
            </span>
            <button
              type="button"
              onClick={() => copyBlock('hmac', HMAC_SNIPPET)}
              className="inline-flex items-center gap-1 text-xs font-mono text-slate-300 hover:text-white px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 min-h-[36px]"
            >
              {copiedId === 'hmac' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedId === 'hmac' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 text-xs font-mono text-slate-200 overflow-x-auto max-w-full">
            {HMAC_SNIPPET}
          </pre>
        </div>
      </div>
    </div>
  );
}
