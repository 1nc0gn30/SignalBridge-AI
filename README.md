# SignalBridge AI

Local-first open-source orchestrator connecting **Signal** (via `signal-cli` JSON-RPC) to local AI agents and backends (**Ollama**, **Hermes**, **OpenAI-compatible** servers like LM Studio / vLLM, and **HMAC-SHA256 signed webhooks**).

Includes:
- **Local Node/Express Bridge Daemon & CLI** (`bridge/cli.ts`, `bridge/server.ts`) with `--dry-run` simulator mode so you can verify routing without installing `signal-cli` first.
- **Isomorphic Core Engine** (`src/core/`) handling E.164/group allowlists, sliding-window rate limiting, input/shell sanitization, loopback SSRF enforcement, multi-backend adapter formatting, and Signal reply chunking.
- **Interactive Browser Workbench** (`src/App.tsx`) running the exact same routing and security engine client-side for live dry-run testing and config/Docker/env export.

---

## Architecture

```text
Signal App (X3DH / Double Ratchet)
        │
        ▼
signal-cli JSON-RPC Daemon (127.0.0.1:8080/api/v1/rpc)
        │
        ▼
SignalBridge Daemon (127.0.0.1:8787)
  1. Ingest token check (optional constant-time HMAC compare on X-SignalBridge-Token)
  2. Default-deny E.164 phone & Signal group allowlist
  3. Per-sender sliding-window rate limiter
  4. Input control-char stripper, slash-command parser & shell-metacharacter guard
  5. Loopback-first SSRF URL validator (blocks 169.254.169.254, metadata hosts, URL creds)
  6. Backend adapter formatter (Ollama / OpenAI-compatible / Hermes / HMAC Webhook)
  7. Signal-friendly multi-part reply chunker -> signal-cli JSON-RPC send
```

---

## Quick Start

**Prerequisites:** Node.js 20+ (tested on Node 22 / 26).

```bash
git clone https://github.com/1nc0gn30/SignalBridge-AI.git
cd SignalBridge-AI
npm install
cp .env.example .env
```

### 1. Test Without `signal-cli` (Dry-Run Simulator)

```bash
# Validate config & security posture
npm run bridge:validate

# Simulate a single Signal message through the full security & routing pipeline
npm run bridge:sim -- --sender "+17575550100" --text "/ollama explain X3DH in 3 bullets"

# Test unauthorized sender rejection (exits with status 2 / HTTP 403)
npm run bridge:sim -- --sender "+19995550199" --text "/ollama hello"

# Start the local bridge daemon in dry-run mode on http://127.0.0.1:8787
npm run bridge:dry-run
```

### 2. Connect to a Live `signal-cli` Daemon

1. Link your Signal device with `signal-cli`:
   ```bash
   signal-cli link -n "SignalBridge-Local"
   ```
2. Start `signal-cli` in local-only JSON-RPC HTTP daemon mode:
   ```bash
   signal-cli -a "+17575550199" daemon --http 127.0.0.1:8080 --no-receive-stdout
   ```
3. Copy `signalbridge.config.example.json` to `signalbridge.config.json`, update `signalAccount`, `allowlist.phoneNumbers`, and your local backend endpoints.
4. Set `SIGNAL_BRIDGE_DRY_RUN=false` in `.env` and start the bridge:
   ```bash
   npm run bridge
   ```

Or run both services with Docker Compose:

```bash
docker compose up --build
```

### 3. Run the Interactive Browser Workbench

```bash
npm run dev      # http://127.0.0.1:3000
npm run build    # Production bundle in dist/
```

---

## Environment Variables

See [.env.example](./.env.example):

| Variable | Default | Purpose |
| --- | --- | --- |
| `SIGNAL_BRIDGE_HOST` | `127.0.0.1` | Bind host for the local Express bridge daemon |
| `SIGNAL_BRIDGE_PORT` | `8787` | Bind port for HTTP endpoints (`/health`, `/api/simulate`, `/webhook/signal`) |
| `SIGNAL_BRIDGE_DRY_RUN` | `true` | Validates and logs formatted payloads without dispatching outbound HTTP calls |
| `SIGNAL_BRIDGE_CONFIG` | `./signalbridge.config.example.json` | Path to JSON route & policy config |
| `SIGNAL_ACCOUNT` | `+17575550199` | E.164 phone number registered/linked in `signal-cli` |
| `SIGNAL_CLI_URL` | `http://127.0.0.1:8080/api/v1/rpc` | Local `signal-cli` JSON-RPC endpoint |
| `SIGNAL_ALLOWLIST_PHONES` | — | Comma-separated E.164 sender allowlist override |
| `SIGNAL_ALLOWLIST_GROUPS` | — | Comma-separated Signal group ID allowlist override |
| `SIGNAL_LOCAL_ONLY` | `true` | Restricts backend endpoints to loopback hosts (`127.0.0.1`, `localhost`, `::1`) |
| `SIGNAL_BRIDGE_INGEST_TOKEN` | — | Optional shared secret checked on `X-SignalBridge-Token` for `/webhook/signal` |
| `HERMES_API_KEY` / `LOCAL_OPENAI_API_KEY` / `SIGNALBRIDGE_WEBHOOK_SECRET` | — | Optional credentials referenced by env var name inside `signalbridge.config.json` |

---

## HTTP Endpoints (`bridge/server.ts`)

- `GET /health` — Service health, `dryRun` flag, `localOnly` status, enabled route count, and config `securityScore`.
- `GET /api/routes` — Redacted route metadata (never exposes resolved env values).
- `POST /api/config/validate` — Validates a `BridgeConfig` JSON payload and returns findings + `securityScore`.
- `POST /api/simulate` — Executes the full routing/security pipeline in dry-run mode and returns the 7-stage trace.
- `POST /webhook/signal` — Accepts native `signal-cli` JSON-RPC envelopes or `{ sender, text, groupId? }`, routes to the matched backend adapter, and sends chunked replies back via `signal-cli` when live.

---

## Security Model

- **Default-deny allowlist**: Empty allowlists reject all live envelopes with HTTP `403`. Phone numbers are normalized and validated as strict E.164 (`+[1-9]dddddd+`).
- **SSRF protection**: All backend and `signal-cli` URLs reject non-HTTP(S) schemes, embedded `user:pass@` credentials, cloud metadata IPs (`169.254.169.254`, `169.254.170.2`, `metadata.google.internal`, IPv4-mapped IPv6 equivalents), and non-loopback hosts while `localOnly: true`.
- **Zero hardcoded secrets**: Config validation flags raw API tokens (`sk-...`, `ghp_...`, `AKIA...`) if accidentally pasted into config files; credentials are referenced strictly by environment variable name and redacted in responses/logs.
- **Per-sender sliding-window rate limiting**: Protects local GPU/CPU inference loops from accidental message storms (`429 RATE_LIMITED`).
- **Webhook integrity**: Custom webhook routes sign request bodies with `X-SignalBridge-Signature: sha256=<hmac>`.

---

## Tests & Verification

```bash
npm run lint   # TypeScript strict check (tsc --noEmit)
npm test       # Unit & integration tests (security, router, adapters, HTTP server)
npm run build  # Vite production build for the browser workbench
```

---

## License & Attribution

MIT License.  
Engineered by **Neal Frazier Tech** ([@1nc0gn30](https://github.com/1nc0gn30)) • [NullAI Platform](https://nullai.tech)

If SignalBridge AI saves you time, you can optionally support maintenance via [Buy Us a Coffee (Stripe)](https://buy.stripe.com/3cIfZg27PdKo2D64Ocfw40X) or Solana (`GG2eQbVh8ut1BK6j1A2tz7pSySdLpD38BgyEhGcxdXoK`).
