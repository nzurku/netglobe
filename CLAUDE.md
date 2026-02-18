# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (frontend only — API panels won't load)
npm run dev              # Full variant (geopolitical)
npm run dev:tech         # Tech variant (startups)

# Development (frontend + all 45+ edge functions)
vercel dev               # Requires: npm i -g vercel

# Type checking
npm run typecheck        # tsc --noEmit

# Production builds
npm run build:full       # worldmonitor.app
npm run build:tech       # startups.worldmonitor.app

# E2E tests (Playwright, requires Chromium)
npm run test:e2e                    # Full suite (runtime + full + tech)
npm run test:e2e:full               # Full variant only
npm run test:e2e:tech               # Tech variant only
npm run test:e2e:runtime            # Runtime fetch patch test only
npm run test:e2e:visual             # Golden screenshot comparisons
npm run test:e2e:visual:update      # Update golden screenshots

# Run a single e2e test by grep pattern
VITE_VARIANT=full npx playwright test -g "test name pattern"

# Unit tests (Node.js test runner)
npm run test:sidecar     # Sidecar + CORS + YouTube embed tests

# Desktop app (Tauri)
npm run desktop:dev                          # Dev mode
npm run desktop:build:full                   # Production build
npm run desktop:package:macos:full           # Package .app + .dmg
npm run desktop:package:macos:full:sign      # Signed package
```

## Architecture

**Stack**: TypeScript, Vite, MapLibre GL + deck.gl (WebGL), Vercel Edge Functions, Upstash Redis, Tauri (desktop)

**No framework** — vanilla TypeScript with imperative DOM manipulation. No React/Vue/Svelte.

### Entry Point & Initialization
- `src/main.ts` → initializes analytics, meta tags, desktop runtime fetch patch → creates `App`
- `src/App.ts` → main orchestrator class. Manages map, panels, news aggregation, all data fetching, signal detection, geo-convergence. Imports 70+ components/services.

### Variant System
Two site variants from one codebase, controlled by `VITE_VARIANT` env var:
- `full` (default): Geopolitical focus — conflicts, military tracking, CII, intel feeds
- `tech`: Tech/startup focus — AI labs, accelerators, VC insights, GitHub trending

Variant configs live in `src/config/variants/{base,full,tech}.ts`. Panel definitions in `src/config/panels.ts` differ by variant.

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/components/` | UI panels (NewsPanel, CIIPanel, MapContainer, etc.) — each is a `.ts` file |
| `src/services/` | Data fetching, analysis, signal processing (country-instability, clustering, flights, ais, etc.) |
| `src/config/` | Static data (feeds, military bases, pipelines, countries, geo hubs) and variant configs |
| `api/` | 45+ Vercel Edge Functions — RSS proxy, AI pipeline, data adapters, market analytics |
| `api/_*.js` | Shared edge function utilities (CORS, caching, rate limiting) — prefixed with underscore |
| `e2e/` | Playwright tests with golden screenshot snapshots per variant |
| `src-tauri/` | Rust Tauri backend + Node.js sidecar for desktop app |
| `scripts/` | AIS relay server, desktop packaging |

### Data Flow
1. RSS feeds → `api/rss-proxy.js` → client-side clustering (`services/clustering.ts`) → entity extraction → signal detection
2. Real-time data (flights, AIS vessels, protests, earthquakes, satellite fires) → geo-convergence → signal aggregator
3. Aggregated signals → AI summarization via `api/groq-summarize.js` (Groq → OpenRouter → browser T5 fallback)
4. Country instability scoring (`services/country-instability.ts`) → strategic risk and theater posture panels
5. All data visualized on MapLibre + deck.gl map with 25+ toggleable layers

### Dual Deployment
- **Vercel**: Static SPA + 45+ edge functions (RSS proxy, AI pipeline, market analytics, data adapters)
- **Railway**: WebSocket relay for AIS vessel streaming, OpenSky aircraft data (blocked from Vercel IPs), and RSS feeds from domains that block Vercel

### Edge Function Conventions
- Shared CORS handling in `api/_cors.js` — allowlist includes worldmonitor.app domains, Vercel previews, localhost, Tauri origins
- Shared Redis cache in `api/_upstash-cache.js` — cross-user deduplication
- Rate limiting in `api/_ip-rate-limit.js` — Redis-backed per-IP limits on AI endpoints
- All edge functions include circuit breaker logic and return stale cached data on upstream failure

### Desktop App (Tauri)
- `src-tauri/src/main.rs`: Keyring secret storage, cache file management, sidecar spawning
- `src-tauri/sidecar/local-api-server.mjs`: Local Node.js HTTP server (port 46123) that routes `/api/*` to edge functions
- `src/services/runtime-config.ts`: Runtime fetch patch redirects API calls to local sidecar when `VITE_DESKTOP_RUNTIME=1`

### Testing
- **E2E**: Playwright with Chromium + SwiftShader (headless GPU). Tests use `/map-harness.html` for map layer visual regression.
- **Unit**: Node.js native test runner for sidecar, CORS, and YouTube embed tests
- **No lint/prettier** configured in the project

## CRITICAL: Git Branch Rules

**NEVER merge or push to a different branch without explicit user permission.**
- If on `beta`, only push to `beta` — never merge to `main` without asking
- If on `main`, stay on `main` — never switch branches without asking
- Pushing to the CURRENT branch after commits is OK when continuing work

## Critical: RSS Proxy Allowlist

When adding new RSS feeds in `src/config/feeds.ts`, you **MUST** also add the feed domain to `ALLOWED_DOMAINS` in `api/rss-proxy.js`. Feeds from unlisted domains return HTTP 403.

Steps: add feed to `feeds.ts` → extract domain → add to `ALLOWED_DOMAINS` in `api/rss-proxy.js` → deploy.

Custom scrapers in `api/` (e.g., `api/fwdstart.js`) don't need allowlist entries since they're direct API endpoints.

## AI Summarization & Caching

Fallback chain: Groq (14.4K req/day) → OpenRouter (50/day) → Browser T5 (unlimited, slower).
All results cached in Redis (Upstash) with 24h TTL, keyed by headline hash for cross-user dedup.

Required env vars: `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

## Service Status Panel

Status page URLs in `api/service-status.js` must match actual endpoints:
- Statuspage.io: `https://status.example.com/api/v2/status.json`
- incident.io: Same endpoint format but returns HTML, handled by `incidentio` parser

## Allowed Bash Commands

Permitted without user approval:
- `Bash(ps aux:*)` — List running processes
- `Bash(grep:*)` — Search text patterns
- `Bash(ls:*)` — List directory contents

## Bash Guidelines

- DO NOT pipe through `head`, `tail`, `less`, or `more` — causes output buffering issues
- Use command-specific flags instead (e.g., `git log -n 10` not `git log | head -10`)
- Run commands directly without pipes when possible
