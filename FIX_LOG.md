# FIX_LOG — Cloudflare deploy

## Gejala
Build CF sukses (`vite build` → `dist/`), deploy command selalu gagal.

## Akar masalah (berurutan, tiap error menyembunyikan yang berikutnya)
1. `npx wrangler deploy` + `pages_build_output_dir` di wrangler.toml
   → "Missing entry-point to Worker script or to assets directory".
   wrangler membaca config sebagai Pages, bukan assets Worker.
2. `npx wrangler pages deploy dist --yes` → `Unknown argument: yes`
   (flag `--yes` tidak ada di `pages deploy`, hanya di `deploy`).
3. `npx wrangler pages deploy dist` → `10000 Authentication error`
   Token tidak punya permission **Cloudflare Pages**. Dikonfirmasi dengan token
   lokal di account yang sama: `GET /accounts/$ID/workers/scripts` → `success: true`,
   `GET /accounts/$ID/pages/projects` → `10000 Authentication error`.
4. Setelah permission ditambah → `The Pages project "nekoflix" does not exist`.
   Artinya project ini **Worker**, bukan Pages: UI-nya punya field "Deploy command"
   dan log-nya `Executing user deploy command:` (Pages build tidak punya itu).

## Fix
`wrangler.toml`: buang `pages_build_output_dir`, pakai assets Worker + SPA fallback.

```toml
name = "nekoflix"
compatibility_date = "2024-09-23"

[assets]
directory = "./dist"
not_found_handling = "single-page-application"
```

`package.json`: `"deploy": "wrangler deploy"`.
Dashboard CF: Deploy command = `npx wrangler deploy`.

## Verifikasi
- `npm run build` → exit 0, `dist/index.html` ada.
- `npx wrangler deploy --dry-run` → `Read 6 files from the assets directory
  /home/container/nekoflix/dist`, bundle sukses, tidak error config.
- Deploy live: token lokal read-only (`No access to the specified service`),
  jadi hanya build CF yang bisa memverifikasi.
