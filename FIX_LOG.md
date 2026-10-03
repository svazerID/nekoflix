# FIX_LOG — Cloudflare deploy

## Sumber data (Oktober 2026)

**OtakuDesu (otakudesu.blog) ditambahkan sebagai sumber utama** — `server/otakudesu.mjs`,
route `/api/od/home|search|anime|watch` di `server/index.mjs`. Rantai player
(reverse-engineered dari situs live):

1. Halaman episode: `.mirrorstream a[data-content]` = base64 `{id,i,q}` per mirror/kualitas.
2. POST `admin-ajax action=aa1208d27f29ca340c92c66d1926f13f` → nonce.
3. POST `admin-ajax action=2a3505c93b0035d3f455df82bf976b84` + `{id,i,q,nonce}` →
   `{data: base64(<iframe src="https://desustream.net/...">)}`.
4. GET halaman embed → `const videoURL = "https://cdn.odcloud.net/....mp4"`.
5. MP4 diputar via `/api/proxy` (host `cdn.odcloud.net` + `desustream.net` ditambahkan ke ALLOWED_HOSTS).

Search "naruto"-style mengembalikan entry episode saja → resolve episode pertama
ke halaman series via anchor "See All Episodes". Proxy fallback: set
`NEKOFLIX_PROXY=http://user:pass@host:port` (undici ProxyAgent, aktif kalau
direct request kena 403/503 setelah retry). Catatan: proxy datacenter
(proxy.maxwell.deals) justru di-block 403 oleh Cloudflare di kedua sumber situs —
direct access lebih ANDAL; proxy hanya untuk jaringan yang direct-nya diblokir.


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
