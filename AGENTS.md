# AGENTS.md

## Repository Overview
`SignalBridge-AI` is an open-source TypeScript project containing:
- `src/core/` — Isomorphic routing, E.164/group allowlist, sliding-window rate limiter, SSRF URL guard, input sanitizer, multi-backend adapter formatters (Ollama, OpenAI-compatible, Hermes, HMAC Webhook), and config exporters.
- `bridge/` — Local Node/Express bridge daemon (`server.ts`), `signal-cli` JSON-RPC client (`signalCli.ts`), config loader (`config.ts`), and CLI (`cli.ts`).
- `src/` — Browser workbench UI (React 19 + Vite + Tailwind CSS v4) executing `src/core/` client-side.
- `tests/` — Automated Node test suites (`tsx --test tests/*.test.ts`).

## Verification Gates
Before committing changes, verify all of the following pass with exit code 0:
1. `npm run lint` (`tsc --noEmit`)
2. `npm test` (unit + integration tests)
3. `npm run bridge:validate`
4. `npm run build` (`vite build`)

## Security Invariants
- Never commit real API keys, `.env` files, or personal phone numbers.
- Keep `src/core/` free of Node-only imports so both the browser workbench and Node daemon share identical security logic.
- Maintain default-deny allowlists and loopback SSRF enforcement (`localOnly: true`) by default.
