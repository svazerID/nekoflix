# NekoFlix

Anime streaming web app: React 19 + Vite + Tailwind 4 frontend scraping Indonesian anime sites (OtakuDesu primary) for catalog/streams. Two backends share the same `/api/od/*` + `/api/proxy` API: an Express server (`server/index.mjs`) for dev/VPS, and a Cloudflare Workers port (`worker.mjs`) for deploy. `FIX_LOG.md` documents the deployment history — read it before touching deploy config.

## Commands

- `npm run dev` — Vite dev server on port 3000 with the Express backend attached as middleware (proxies `/api` to itself; no separate server needed).
- `npm run lint` — typecheck only (`tsc --noEmit`); there is no ESLint.
- `npm run build` — Vite build to `dist/`.
- `npm run deploy` — `wrangler deploy` (assets Worker, NOT Cloudflare Pages — see Pitfalls).
- `node server/index.mjs --selftest` — offline scrape-parser self-check (no network).
- `node server/worker-selftest.mjs` — runs `worker.mjs` against real upstreams from Node (needs network; full catalog→watch→proxy cycle).
- `node server/popular-selftest.mjs`, `node server/crunchy-new-selftest.mjs` — targeted upstream checks.

## Architecture

- `src/` — React app. `src/services/nekoflixApi.ts` is the only API client (`/api` paths); `src/data/animeData.ts` is legacy fallback data.
- `server/otakudesu.mjs` — pure HTML-parsing functions (no fetch), shared by both backends. Keep parsing logic here so Express and Workers stay in sync.
- `worker.mjs` — Workers-native backend (routes + proxy + its own duplicate fetch/cache logic). Changes to routes must be mirrored between `server/index.mjs` and `worker.mjs`.
- `wrangler.toml` — assets Worker: `main = "worker.mjs"` + `binding = "ASSETS"`, SPA fallback. Worker handles `/api/*`, `dist/` serves everything else.
- `anime.go` — orphaned Go scraper prototype, referenced by nothing.

## Conventions

- Frontend: `@` alias resolves to project root (`tsconfig` paths `@/*`).
- Backend `server/index.mjs` exports `buildApp()` so Vite can mount it as middleware; entrypoint guard is `process.argv[1] === fileURLToPath(import.meta.url)`.
- Responses are JSON with permissive CORS (`Access-Control-Allow-Origin: *`); scrape cache TTL is 5 min, in-memory per instance.

## Pitfalls

- **Deploy is a Workers assets project, not Pages.** Never add `pages_build_output_dir` to `wrangler.toml` or use `wrangler pages deploy` — both broke deploys before (see FIX_LOG.md).
- **Proxy allowlists are per-backend.** `ALLOWED_HOSTS` regex in `server/index.mjs` (~line 324) and the hardcoded host list in `worker.mjs` `mediaProxy()` are separate; a new CDN host must be added to both.
- Scraper targets are real sites behind Cloudflare and change without notice: player chain is documented in FIX_LOG.md (`server/otakudesu.mjs` + admin-ajax nonce steps). 503s retry 3x; `NEKOFLIX_PROXY` env var exists but direct access is usually more reliable.
- `npm run dev` occupies port 3000 and expects `localhost:8787` semantics — it self-hosts the API, so don't also run `node server/index.mjs` on the same port.
- `dist/` and `server.js` are build outputs (`npm run clean`); `worker.mjs` is hand-written, not built.
