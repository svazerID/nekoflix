# NekoFlix

Streaming katalog & player anime (bahasa Indonesia) yang scrape sumber publik
[OtakuDesu](https://otakudesu.blog) untuk katalog, jadwal, dan link streaming.

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS 4
- **Backend:** dua implementasi API yang identik (`/api/od/*` + `/api/proxy`):
  - `server/index.mjs` — Express, untuk dev & VPS
  - `worker.mjs` — Cloudflare Workers, untuk deploy
- Pemangkasan HTML bersama di `server/otakudesu.mjs`

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:3000 — backend API ikut jalan (middleware Vite)
```

Tidak perlu menjalankan server terpisah saat dev.

## Build & Deploy

```bash
npm run lint       # typecheck (tsc --noEmit)
npm run build      # build ke dist/
npm run deploy     # wrangler deploy (Cloudflare Workers assets, bukan Pages)
```

## API

| Route | Fungsi |
|---|---|
| `GET /api/od/home` | Katalog ongoing (paginasi `?page=`) |
| `GET /api/od/search?q=` | Pencarian |
| `GET /api/od/anime/:slug` | Detail series + daftar episode |
| `GET /api/od/watch?url=` | Resolusi stream & link download per episode |
| `GET /api/od/schedule` | Jadwal rilis mingguan |
| `GET /api/od/genre/:slug` | Katalog per genre |
| `GET /api/od/popular`, `/api/od/trending` | Kurasi populer/trending |
| `GET /api/proxy?url=` | Proxy stream video (allowlist host) |

## Self-test

```bash
node server/index.mjs --selftest      # parser, tanpa network
node server/worker-selftest.mjs       # Worker end-to-end, perlu network
```

## Env (opsional)

| Var | Fungsi |
|---|---|
| `NEKOFLIX_PROXY` | Proxy egress `http://user:pass@host:port` jika direct di-block |
| `NEKOFLIX_CLEARANCE` | Path file cookie Cloudflare clearance (dev/VPS) |
| `DISABLE_HMR` | `true` untuk matikan HMR saat dev |

Lihat `FIX_LOG.md` untuk catatan deploy dan rantai scraping.
