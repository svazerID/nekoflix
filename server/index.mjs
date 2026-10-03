// NekoFlix scrape backend — parses s13.nontonanimeid.boats (WordPress theme) + kotakanimeid.link player chain.
import express from 'express';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://s13.nontonanimeid.boats';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const PORT = process.env.PORT || 8787;

// ---------- tiny HTTP + cache ----------
const cache = new Map(); // url -> { t, data }
const TTL = 5 * 60 * 1000;
async function fetchText(url, opts = {}) {
  const key = url + (opts.method === 'POST' ? String(opts.body || '') : '');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.data;
  const headers = { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8', ...opts.headers };
  if (opts.body && !opts.headers?.['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
  const res = await fetch(url, { method: opts.method || 'GET', headers, body: opts.body, redirect: 'manual' });
  const text = await res.text();
  const out = { status: res.status, text, headers: Object.fromEntries(res.headers) };
  if (res.status < 400) cache.set(key, { t: Date.now(), data: out });
  return out;
}
const setHeaders = (extra = {}) => ({
  'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'same-origin',
  'Upgrade-Insecure-Requests': '1', ...extra,
});

// ---------- HTML helpers (regex only — no DOM lib needed) ----------
const stripTags = (s) => (s || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const match1 = (s, re) => { const m = s.match(re); return m ? m[1] : ''; };
const abs = (u) => (!u ? '' : u.startsWith('http') ? u : BASE + (u.startsWith('/') ? u : '/' + u));

export function base64Scripts(html) {
  const out = {};
  for (const m of html.matchAll(/data:text\/javascript;base64,([A-Za-z0-9+/=]+)/g)) {
    try {
      const text = atob(m[1]);
      if (text.includes('kotakajax')) out.kotakajax = text;
      if (text.includes('episodeToTrack')) out.episodeToTrack = text;
    } catch {}
  }
  return out;
}
const jsonVar = (text, name) => {
  if (!text) return null;
  const i = text.indexOf(`var ${name}=`);
  if (i === -1) return null;
  try { return JSON.parse(text.slice(i + name.length + 5).split(';')[0].trim()); } catch { return null; }
};
export { jsonVar };

// ---------- catalog / search ----------
export function parseCards(html) {
  const cards = [];
  // home/catalog: <article class="animeseries post-ID"><div class="sera"><a href=...>...<span class="types episodes">N - Tamat</span>...<img src> <h3 class="title ..."><span data-title-default="T">
  for (const m of html.matchAll(/<article class="animeseries[^"]*">([\s\S]*?)<\/article>/g)) {
    const block = m[1];
    const url = match1(block, /<a href="([^"]+\/anime\/[^"]+)"/);
    if (!url) continue;
    const title = stripTags(match1(block, /<h3[^>]*>[\s\S]*?<\/h3>/)) || stripTags(match1(block, /alt="([^"]+)"/));
    const slug = url.match(/\/anime\/([^/]+)\//)?.[1] || '';
    const badge = match1(block, /<span class="types episodes">([\s\S]*?)<\/span>/);
    cards.push({
      id: slug, slug, title, url,
      poster: match1(block, /<img[^>]+src="([^"]+)"/),
      episodeBadge: stripTags(badge).replace(/^\d+/, '').trim(),
      totalEpisodes: match1(badge, /(\d+)/),
    });
  }
  // search page: <a href=... class="as-anime-card" ...><img src> <h3 class="as-anime-title" data-title-default="T">
  for (const m of html.matchAll(/<a href="([^"]+\/anime\/[^"]+)" class="as-anime-card"[\s\S]*?<\/a>/g)) {
    const block = m[0];
    const slug = m[1].match(/\/anime\/([^/]+)\//)?.[1] || '';
    if (cards.some((c) => c.slug === slug)) continue;
    cards.push({
      id: slug, slug, title: stripTags(match1(block, /<h3[^>]*>[\s\S]*?<\/h3>/)) || match1(block, /alt="([^"]+)"/),
      url: m[1], poster: match1(block, /<img[^>]+src="([^"]+)"/), episodeBadge: '', totalEpisodes: '',
    });
  }
  return cards;
}

// ---------- series detail ----------
export function parseSeries(html, slug) {
  const h1 = match1(html, /<h1[^>]*>([\s\S]*?)<\/h1>/);
  const title = match1(h1, /data-title-default="([^"]*)"/) || stripTags(h1);
  const jp = match1(h1, /data-title-jp="([^"]*)"/);
  const info = match1(html, /<div class="anime-card__quick-info[^"]*">([\s\S]*?)<\/div>/);
  const status = /Finished Airing|status-finish/.test(info) ? 'Tamat' : /Ongoing|status-ongoing/.test(info) ? 'Ongoing' : '';
  const totalEpisodes = match1(info, /(\d+)\s*Episodes/i) || match1(html, /Types? episodes">\s*<span[^>]*><\/span>\s*(\d+)/);
  const duration = match1(info, /(\d+)\s*min per ep/i) ? `${match1(info, /(\d+)\s*min per ep/i)} min` : '';
  const season = stripTags(match1(info, /<span class="info-item season">([\s\S]*?)<\/span>/)) || match1(info, /📅\s*<\/span>\s*([^<\n]+)/);
  const q = match1(html, /<div class="as-quick-info">([\s\S]*?)<\/div>/);
  const rating = match1(q, /as-rating">.*?([\d.]+)\s*</);
  const type = match1(q, /as-type">.*?<\/span>\s*([^<\n]+)/);
  const synopsis = stripTags(match1(html, /<p class="as-synopsis">([\s\S]*?)<\/p>/)) || stripTags(match1(html, /entry-content[^>]*>([\s\S]*?)<\/div>/));
  const genres = [...html.matchAll(/rel="tag"[^>]*>([^<]{2,40})</g)].map((g) => stripTags(g[1])).filter((g) => g && !/^\d{4}$/.test(g));
  const poster = match1(html, /property="og:image" content="([^"]+)"/);

  // episode list (newest first in DOM) — reverse to chronological
  const seen = new Set();
  const episodes = [];
  for (const m of html.matchAll(/href="([^"]*-episode-\d+\/?)"/g)) {
    const url = abs(m[1]);
    const num = parseInt(url.match(/-episode-(\d+)/)?.[1] || '0', 10);
    if (seen.has(num) || !num) continue;
    seen.add(num);
    episodes.push({ number: num, url });
  }
  episodes.sort((a, b) => a.number - b.number);
  return { id: slug, slug, title, japaneseTitle: jp || undefined, poster, genres: [...new Set(genres)], rating, type, status, totalEpisodes, duration, season, synopsis, episodes };
}

// ---------- episode page → streams ----------
async function resolveStream(embedUrl, referer) {
  const r = await fetchText(embedUrl, { headers: setHeaders({ Referer: referer }) });
  if (r.status >= 400) return '';
  const html = r.text;
  const prefix = ["_w['at'+'ob'](", '_w["at"+"ob"]('].map((p) => [p, html.indexOf(p)]).find(([, i]) => i !== -1);
  if (!prefix) return '';
  const payloadStart = prefix[1] + prefix[0].length;
  const q = html[payloadStart];
  if (q !== "'" && q !== '"') return '';
  // string literal possibly concatenated: 'b64' + 'b64'
  let rest = html.slice(payloadStart + 1);
  const parts = [];
  for (;;) {
    const end = rest.indexOf(q);
    if (end === -1) return '';
    parts.push(rest.slice(0, end));
    rest = rest.slice(end + 1);
    const concat = rest.match(/^\s*\+\s*['"]/);
    if (!concat) break;
    rest = rest.slice(concat[0].length);
  }
  const cleanB64 = parts.join('').replace(/[^A-Za-z0-9+/=]/g, '');
  const sM = html.match(/var s=['"]([0-9,]+)['"]/);
  const cM = html.match(/parseInt\(s\[j\],10\)\s*-\s*(\d+)\s*\*\s*\(j\s*\+\s*(\d+)\)/);
  if (!sM || !cM) return '';
  const mult = parseInt(cM[1], 10), off = parseInt(cM[2], 10);
  const tokens = sM[1].split(',');
  const key = tokens.map((t, j) => (parseInt(t, 10) - mult * (j + off)) & 255);
  let dec;
  try {
    const cipher = Uint8Array.from(atob(cleanB64), (c) => c.charCodeAt(0));
    dec = Array.from(cipher, (b, i) => String.fromCharCode(b ^ key[i % key.length])).join('');
  } catch { return ''; }
  const file = dec.match(/"file"\s*:\s*"(https:\/\/[^"]+)"/)?.[1] || dec.match(/https:\/\/[^"'\s\\]+\.m3u8/)?.[0];
  return file && !file.includes('blank.mp4') ? file.replaceAll('\\/', '/') : '';
}

async function parseEpisode(pageUrl, html) {
  const js = base64Scripts(html);
  const track = jsonVar(js.episodeToTrack, 'episodeToTrack') || {};
  const ajax = jsonVar(js.kotakajax, 'kotakajax') || {};
  const prevUrl = abs(match1(html, /rel="prev" href="([^"]+)"/)) || abs(match1(html, /<a[^>]+title="[^"]*[Pp]rev[^"]*"[^>]+href="([^"]+)"/));
  const nextUrl = abs(match1(html, /rel="next" href="([^"]+)"/)) || abs(match1(html, /<a[^>]+title="[^"]*[Nn]ext[^"]*"[^>]+href="([^"]+)"/));

  const nonce = ajax.nonce || '';
  const ajaxUrl = ajax.url || `${BASE}/wp-admin/admin-ajax.php`;
  const streams = [];
  for (const m of html.matchAll(/<(?:div|li)[^>]*class="[^"]*kotak_player_option[^"]*"[^>]*>/g)) {
    const tag = m[0];
    const post = match1(tag, /data-post="([^"]+)"/);
    const nume = match1(tag, /data-nume="([^"]+)"/);
    const type = match1(tag, /data-type="([^"]+)"/);
    if (!post || !nume) continue;
    let embed = '';
    let direct = '';
    if (nonce) {
      const body = new URLSearchParams({ action: 'player_ajax', post, nume, serverName: type, nonce, did: `k_${Date.now().toString(16)}` });
      const r = await fetchText(ajaxUrl, {
        method: 'POST', body,
        headers: setHeaders({ Referer: pageUrl, 'X-Requested-With': 'XMLHttpRequest', Origin: BASE }),
      });
      embed = match1(r.text, /src=["']([^"']+)["']/);
      if (embed.includes('kotakanimeid.link')) direct = await resolveStream(embed, pageUrl);
    }
    streams.push({ serverName: type || `Server ${nume}`, nume, embedUrl: embed, directStream: direct });
  }

  const downloads = [];
  for (const m of html.matchAll(/<a href="([^"]*\/out\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
    downloads.push({ serverName: stripTags(m[2]) || 'Download', outUrl: m[1] });
  }
  return {
    seriesId: track.seriesId, seriesTitle: track.seriesTitle, seriesUrl: track.seriesUrl,
    episodeNumber: track.episodeNumber, thumbnail: track.poster || match1(html, /property="og:image" content="([^"]+)"/),
    prevUrl, nextUrl, streams, downloads,
  };
}

// ---------- stream proxy (Referer-gated CDN + m3u8 rewrite) ----------
const ALLOWED_HOSTS = /^(s\d+\.kotakanimeid\.link|cdn\d*\.kotakanimeid\.link|s13\.nontonanimeid\.boats|i0\.wp\.com)$/;

export function buildApp({ serveStatic = true } = {}) {
  const app = express();
  app.use(express.json());

  app.get('/api/home', async (req, res) => {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const r = await fetchText(page > 1 ? `${BASE}/page/${page}/` : `${BASE}/`, { headers: setHeaders() });
      if (r.status >= 400) throw new Error(`upstream ${r.status}`);
      const cards = parseCards(r.text);
      if (!cards.length) throw new Error('empty catalog');
      res.json({ cards, page, hasNext: /\/page\/\d+\//.test(r.text) });
    } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
  });

  app.get('/api/search', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) return res.json({ cards: [] });
      const r = await fetchText(`${BASE}/?s=${encodeURIComponent(q)}`, { headers: setHeaders() });
      res.json({ cards: parseCards(r.text) });
    } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
  });

  app.get('/api/anime/:slug', async (req, res) => {
    try {
      const r = await fetchText(`${BASE}/anime/${req.params.slug}/`, { headers: setHeaders() });
      if (r.status >= 400) throw new Error(`upstream ${r.status}`);
      const series = parseSeries(r.text, req.params.slug);
      if (!series.title || !series.episodes.length) throw new Error('parse failed');
      res.json(series);
    } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
  });

  app.get('/api/watch/:slug', async (req, res) => {
    try {
      const url = req.query.url ? String(req.query.url) : `${BASE}/${req.params.slug}/`;
      const r = await fetchText(url, { headers: setHeaders() });
      if (r.status >= 400) throw new Error(`upstream ${r.status}`);
      const data = await parseEpisode(url, r.text);
      if (!data.streams.length && !data.downloads.length) throw new Error('no streams');
      res.json(data);
    } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
  });

  // Media proxy: CDN 403s foreign Origin/Referer; playlists rewritten to stay on our origin.
  app.get('/api/proxy', async (req, res) => {
    const target = String(req.query.url || '');
    let u;
    try { u = new URL(target); } catch { return res.status(400).send('bad url'); }
    if (!/^https?:$/.test(u.protocol) || !ALLOWED_HOSTS.test(u.hostname)) return res.status(403).send('host not allowed');
    try {
      // ponytail: no Referer on purpose — kotakanimeid CDN 403s self/foreign Referers, none = 200
      const headers = { 'User-Agent': UA, Accept: '*/*' };
      if (req.headers.range) headers.Range = req.headers.range;
      // ponytail: upstream CF edge intermittently drops fresh connects; 3 tries covers it, dispatcher/keepalive if it gets worse
      let upstream;
      for (let i = 1; ; i++) {
        try { upstream = await fetch(target, { headers, redirect: 'follow' }); break; }
        catch (e) {
          if (i >= 3) throw e;
          await new Promise((r) => setTimeout(r, 800 * i));
        }
      }
      const ct = upstream.headers.get('content-type') || '';
      const passthrough = { 'content-type': ct, 'accept-ranges': upstream.headers.get('accept-ranges') || 'bytes', 'cache-control': upstream.headers.get('cache-control') || 'no-store' };
      if (upstream.headers.get('content-range')) passthrough['content-range'] = upstream.headers.get('content-range');
      if (upstream.headers.get('content-length')) passthrough['content-length'] = upstream.headers.get('content-length');

      if (/mpegurl|m3u8/i.test(ct)) {
        const base = new URL(target, u);
        const body = (await upstream.text())
          .split('\n')
          .map((line) => {
            const t = line.trim();
            if (!t || t.startsWith('#EXT-X-KEY')) return t ? line.replace(/URI="(.*?)"/, (_s, uri) => `URI="${proxyUrl(uri, base)}"`) : line;
            if (t.startsWith('#')) return line;
            return proxyUrl(t, base);
          })
          .join('\n');
        res.set({ ...passthrough, 'Access-Control-Allow-Origin': '*' });
        return res.status(upstream.status).send(body);
      }
      res.set({ ...passthrough, 'Access-Control-Allow-Origin': '*' });
      res.status(upstream.status);
      Readable.fromWeb(upstream.body).pipe(res);
    } catch (e) { console.error('[proxy]', target.slice(0, 80), e.message, '|', e.cause?.message || ''); res.status(502).send('proxy failed'); }
  });

  if (serveStatic) {
    const dist = path.join(__dirname, '..', 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  return app;
}

function proxyUrl(u, base) {
  const abs2 = new URL(u, base).toString();
  return `/api/proxy?url=${encodeURIComponent(abs2)}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildApp().listen(PORT, () => console.log(`NekoFlix backend on http://localhost:${PORT}`));
}
