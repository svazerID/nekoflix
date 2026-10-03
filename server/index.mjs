// NekoFlix scrape backend — parses s13.nontonanimeid.boats (WordPress theme) + kotakanimeid.link player chain.
import express from 'express';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import { parseOdSearch, parseOdHome, parseOdSeries, parseOdEpisode, parseOdSeriesFromEpisode, OD_BASE } from './otakudesu.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://s13.nontonanimeid.boats';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const PORT = process.env.PORT || 8787;
// Cloudflare clearance cookies harvested by ~/workspace/nekoflix-cf/cf-solve.py
// (cf-solve.py refreshes this file; backend picks up changes without restart).
const CLEARANCE_FILE = process.env.NEKOFLIX_CLEARANCE || '/home/hatch/.nekoflix-clearance.json';
let clearanceDomains = {};
let clearanceMtime = 0;
// Optional egress proxy for hosts that block direct access (403/503).
// NEKOFLIX_PROXY=http://user:pass@host:port or socks5://user:pass@host:port
let PROXY_AGENT = null;
{
  const p = process.env.NEKOFLIX_PROXY;
  if (p) {
    try {
      const { ProxyAgent } = await import('undici');
      PROXY_AGENT = new ProxyAgent(p);
      console.log(`[nekoflix] proxy enabled: ${p.replace(/\/\/[^@]*@/, '//***@')}`);
    } catch (e) {
      console.error('[nekoflix] undici not available, proxy disabled:', e.message);
    }
  }
}
function clearanceFor(host) {
  try {
    const st = fs.statSync(CLEARANCE_FILE);
    if (st.mtimeMs !== clearanceMtime) {
      clearanceMtime = st.mtimeMs;
      clearanceDomains = JSON.parse(fs.readFileSync(CLEARANCE_FILE, 'utf8')).domains || {};
    }
  } catch {}
  return clearanceDomains[host] || '';
}

// ---------- tiny HTTP + cache ----------
const cache = new Map(); // url -> { t, data }
const TTL = 5 * 60 * 1000;
async function fetchText(url, opts = {}) {
  const key = url + (opts.method === 'POST' ? String(opts.body || '') : '');
  const hit = !opts.skipCache && cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.data;
  const headers = { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8', ...opts.headers };
  try {
    const host = new URL(url).hostname;
    const jar = clearanceFor(host);
    if (jar && !headers.Cookie) headers.Cookie = jar;
  } catch {}
  if (opts.body && !opts.headers?.['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
  // The origin intermittently serves 503 "temporarily busy" pages; a short retry clears it.
  let res;
  let last;
  for (let i = 1; ; i++) {
    last = await fetch(url, { method: opts.method || 'GET', headers, body: opts.body, redirect: 'manual' });
    if (last.status !== 503 || i >= 3) break;
    await new Promise((r) => setTimeout(r, 1200 * i));
  }
  // direct path blocked (403/503 after retries) -> fall back to the configured proxy
  if ((last.status === 403 || last.status === 503) && PROXY_AGENT) {
    try {
      last = await fetch(url, {
        method: opts.method || 'GET', headers, body: opts.body, redirect: 'manual',
        dispatcher: PROXY_AGENT,
      });
    } catch {}
  }
  const text = await last.text();
  const out = { status: last.status, text, headers: Object.fromEntries(last.headers) };
  if (!opts.skipCache && last.status < 400) cache.set(key, { t: Date.now(), data: out });
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

// ---------- download mirror resolver (ported from the Go scraper's token flow) ----------
// Resolves /out/ download gates via window.DL -> get-token.php -> get-download.php.
// Token/challenge are single-use, so caching is skipped for these calls.
async function resolveDownloadMirror(outUrl, referer) {
  const none = { directUrl: '', quality: '' };
  try {
    const r = await fetchText(outUrl, { headers: setHeaders({ Referer: referer }) });
    if (r.status >= 400) return none;
    const dlM = r.text.match(/window\.DL\s*=\s*\{([^}]+)\};/);
    if (!dlM) return none;
    const block = '{' + dlM[1] + '}';
    const isBlogger = block.includes('isBlogger: true');
    const enc = match1(block, /encrypted:\s*["']([^"']+)["']/);
    if (!enc) return none;
    const title = match1(block, /title:\s*["']([^"']+)["']/);
    const gate = match1(block, /gate:\s*([0-9]+)/);
    const sig = match1(block, /sig:\s*["']([^"']+)["']/);
    const u = new URL(outUrl);
    const origin = `${u.protocol}//${u.host}`;
    const targetRequestURL = isBlogger
      ? `${origin}/video/get-download.php?mode=lokal&vid=${encodeURIComponent(enc)}&title=${encodeURIComponent(title)}&dl=yes&json=true`
      : enc;
    const t = await fetchText(`${origin}/video/get-token.php`, {
      method: 'POST', skipCache: true,
      body: JSON.stringify({ url: targetRequestURL }),
      headers: setHeaders({ Referer: outUrl, 'Content-Type': 'application/json', 'X-Fingerprint': 'dummy-fingerprint', 'X-DL-Gate': gate, 'X-DL-Sig': sig }),
    });
    let token, timestamp, challenge;
    try {
      const j = JSON.parse(t.text);
      ({ token, timestamp, challenge } = j);
    } catch { return none; }
    if (!token) return none;
    const dlEndpoint = isBlogger ? targetRequestURL : `${origin}/video/get-download.php`;
    const d = await fetchText(dlEndpoint, {
      method: 'POST', skipCache: true,
      body: JSON.stringify({ url: targetRequestURL, challenge }),
      headers: setHeaders({ Referer: outUrl, 'Content-Type': 'application/json', 'X-Security-Token': token, 'X-Timestamp': timestamp, 'X-Fingerprint': 'dummy-fingerprint', 'X-Challenge': challenge }),
    });
    let resolvedPath = '', quality = '';
    try {
      const j = JSON.parse(d.text);
      if (isBlogger) {
        for (const q of ['1080p', 'HD', '720p', '480p', '360p']) {
          const arr = j.links?.[q];
          if (arr?.length) { resolvedPath = arr[0].url; quality = q; break; }
        }
      } else {
        const arr = j.links?.download;
        if (arr?.length) resolvedPath = arr[0].url;
      }
    } catch { return none; }
    if (!resolvedPath) return none;
    let finalUrl = resolvedPath.startsWith('/') ? origin + resolvedPath : resolvedPath;
    try {
      const hr = await fetch(finalUrl, { method: 'GET', headers: { 'User-Agent': UA, Referer: outUrl }, redirect: 'manual' });
      const loc = hr.headers.get('location');
      if (loc) finalUrl = new URL(loc, finalUrl).toString();
      if (hr.body?.cancel) await hr.body.cancel();
    } catch {}
    return { directUrl: finalUrl, quality };
  } catch { return none; }
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
  const dlJobs = [];
  for (const m of html.matchAll(/<a href="([^"]*\/out\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const outUrl = m[1];
    const label = stripTags(m[2]) || 'Download';
    dlJobs.push(
      resolveDownloadMirror(outUrl, pageUrl)
        .catch(() => ({ directUrl: '', quality: '' }))
        .then(({ directUrl, quality }) => ({ serverName: label, outUrl, directUrl, quality }))
    );
  }
  for (const d of await Promise.all(dlJobs)) downloads.push(d);
  return {
    seriesId: track.seriesId, seriesTitle: track.seriesTitle, seriesUrl: track.seriesUrl,
    episodeNumber: track.episodeNumber, thumbnail: track.poster || match1(html, /property="og:image" content="([^"]+)"/),
    prevUrl, nextUrl, streams, downloads,
  };
}

// ---------- stream proxy (Referer-gated CDN + m3u8 rewrite) ----------
const ALLOWED_HOSTS = /^(s\d+\.kotakanimeid\.link|cdn\d*\.kotakanimeid\.link|s13\.nontonanimeid\.boats|i0\.wp\.com|cdn\.odcloud\.net|desustream\.net)$/;

export function buildApp({ serveStatic = true } = {}) {
  const app = express();
  app.use(express.json());

  // ---------- Kitsu (MyAnimeList-like) metadata: posters + synopsis ----------
// The site's own WP media endpoints 401 for guests, so posters come from Kitsu's
// free public API instead. Results are cached in-memory + on disk.
const POSTER_CACHE_FILE = '/home/hatch/workspace/nekoflix-cf/poster-cache.json';
const kitsuMem = new Map();
let kitsuDisk = null;
function kitsuDiskLoad() {
  if (kitsuDisk) return kitsuDisk;
  try { kitsuDisk = JSON.parse(fs.readFileSync(POSTER_CACHE_FILE, 'utf8')); }
  catch { kitsuDisk = {}; }
  return kitsuDisk;
}
function kitsuDiskSave() {
  try { fs.writeFileSync(POSTER_CACHE_FILE, JSON.stringify(kitsuDisk)); } catch {}
}
const kitsuNorm = (t) => (t || '')
  .replace(/\s*episode\s*\d+.*$/i, '')
  .replace(/\s*-\s*episode.*$/i, '')
  .replace(/\s+/g, ' ').trim();
async function kitsuFor(title) {
  const key = kitsuNorm(title).toLowerCase();
  if (!key) return null;
  if (kitsuMem.has(key)) return kitsuMem.get(key);
  const disk = kitsuDiskLoad();
  if (disk[key]) { kitsuMem.set(key, disk[key]); return disk[key]; }
  let out = null;
  try {
    const u = `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(kitsuNorm(title))}&page[limit]=1&fields[anime]=canonicalTitle,synopsis,posterImage`;
    const r = await fetch(u, { headers: { 'User-Agent': 'NekoFlix/1.0', Accept: 'application/vnd.api+json' } });
    const a = (await r.json()).data?.[0]?.attributes;
    if (a?.posterImage) {
      out = {
        poster: a.posterImage.medium || a.posterImage.small || '',
        synopsis: (a.synopsis || '').trim(),
        canonicalTitle: a.canonicalTitle || '',
      };
    }
  } catch {}
  kitsuMem.set(key, out);
  disk[key] = out;
  kitsuDiskSave();
  return out;
}
// run fn over items with limited parallelism
async function pmap(items, n, fn) {
  const res = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      try { res[k] = await fn(items[k], k); } catch { res[k] = items[k]; }
    }
  }));
  return res;
}

// ---------- WordPress REST API data source (bypasses the Cloudflare HTML challenge) ----------
  // The site's HTML pages sit behind a Cloudflare managed challenge, but /wp-json/* is open.
  // Series == WP category; episode == WP post in that category.
  const WPAPI = `${BASE}/wp-json/wp/v2`;
  async function wpGet(path) {
    const r = await fetchText(`${WPAPI}${path}`, { headers: { Accept: 'application/json' } });
    if (r.status >= 400) throw new Error(`wp api ${r.status} for ${path}`);
    return JSON.parse(r.text);
  }
  const epNum = (slug, title) =>
    parseInt(slug.match(/episode-(\d+)/i)?.[1] || String(title).match(/episode\s+(\d+)/i)?.[1] || '0', 10);
  async function wpCatsByIds(ids) {
    const uniq = [...new Set(ids)];
    if (!uniq.length) return new Map();
    const cats = await wpGet(`/categories?include=${uniq.join(',')}&per_page=100&_fields=id,slug,name,count`);
    return new Map(cats.map((c) => [c.id, c]));
  }
  async function wpHome(page = 1) {
    const posts = await wpGet(`/posts?per_page=20&page=${page}&orderby=date&order=desc&_fields=id,slug,title,link,date,categories`);
    const cats = await wpCatsByIds(posts.flatMap((p) => p.categories || []));
    const seen = new Set();
    const cards = [];
    for (const p of posts) {
      const cat = cats.get((p.categories || [])[0]);
      if (!cat || seen.has(cat.slug)) continue;
      seen.add(cat.slug);
      const n = epNum(p.slug, p.title?.rendered || '');
      cards.push({
        id: cat.slug, slug: cat.slug, title: cat.name,
        url: `${BASE}/anime/${cat.slug}/`, poster: '',
        episodeBadge: n ? `Episode ${n}` : '', totalEpisodes: String(cat.count || ''),
      });
    }
    await pmap(cards, 4, async (c) => { c.poster = (await kitsuFor(c.title))?.poster || ''; });
    return { cards, page, hasNext: posts.length === 20 };
  }
  async function wpSearch(q) {
    const cats = await wpGet(`/categories?search=${encodeURIComponent(q)}&per_page=20&_fields=id,slug,name,count`);
    const cards = cats.map((cat) => ({
      id: cat.slug, slug: cat.slug, title: cat.name,
      url: `${BASE}/anime/${cat.slug}/`, poster: '',
      episodeBadge: '', totalEpisodes: String(cat.count || ''),
    }));
    await pmap(cards, 4, async (c) => { c.poster = (await kitsuFor(c.title))?.poster || ''; });
    return { cards };
  }
  async function wpAnime(seriesSlug) {
    const cats = await wpGet(`/categories?slug=${encodeURIComponent(seriesSlug)}&_fields=id,slug,name,count,description`);
    if (!cats.length) throw new Error('series not found');
    const cat = cats[0];
    const posts = await wpGet(`/posts?categories=${cat.id}&per_page=100&orderby=date&order=asc&_fields=slug,title,link`);
    const episodes = posts
      .map((p) => ({ number: epNum(p.slug, p.title?.rendered || ''), url: p.link }))
      .filter((e) => e.number > 0)
      .sort((a, b) => a.number - b.number);
    const meta = await kitsuFor(cat.name);
    const poster = meta?.poster || '';
    for (const e of episodes) e.thumbnail = poster;
    return {
      id: cat.slug, slug: cat.slug, title: cat.name, japaneseTitle: '',
      poster, genres: [], rating: '', type: '', status: '',
      totalEpisodes: String(episodes.length || cat.count || ''), duration: '', season: '',
      synopsis: meta?.synopsis || stripTags(cat.description || ''), episodes,
    };
  }

  app.get('/api/home', async (req, res) => {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const data = await wpHome(page);
      if (!data.cards.length) throw new Error('empty catalog');
      res.json(data);
    } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
  });

  app.get('/api/search', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) return res.json({ cards: [] });
      res.json(await wpSearch(q));
    } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
  });

  app.get('/api/anime/:slug', async (req, res) => {
    try {
      const series = await wpAnime(req.params.slug);
      if (!series.title || !series.episodes.length) throw new Error('parse failed');
      res.json(series);
    } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
  });

  app.get('/api/watch/:slug', async (req, res) => {
    try {
      const url = req.query.url ? String(req.query.url) : `${BASE}/${req.params.slug}/`;
      const r = await fetchText(url, { headers: setHeaders() });
      if (r.status >= 400) {
        const blocked = r.status === 403 && /challenge|just a moment/i.test(r.text);
        return res.status(502).json({ error: `upstream ${r.status}`, code: blocked ? 'upstream_blocked' : 'upstream_error', url });
      }
      const data = await parseEpisode(url, r.text);
      if (!data.streams.length && !data.downloads.length) {
        return res.status(502).json({ error: 'no streams', code: 'no_streams', url });
      }
      res.json(data);
    } catch (e) { res.status(502).json({ error: String(e.message || e), code: 'fetch_failed' }); }
  });

  // Media proxy: CDN 403s foreign Origin/Referer; playlists rewritten to stay on our origin.
  app.get('/api/proxy', async (req, res) => {
    const target = String(req.query.url || '');
    let u;
    try { u = new URL(target); } catch { return res.status(400).send('bad url'); }
    if (!/^https?:$/.test(u.protocol) || !ALLOWED_HOSTS.test(u.hostname)) return res.status(403).send('host not allowed');
    try {
      // ponytail: no Referer on purpose — cdn*.kotakanimeid m3u8 hosts 403 any Referer, none = 200.
      // s\d+ gate hosts (/go/dl/) are the opposite: they 403 (K11) without the nontonanimeid Referer.
      const headers = { 'User-Agent': UA, Accept: '*/*' };
      if (/^s\d+\.kotakanimeid\.link$/.test(u.hostname)) headers.Referer = 'https://s13.nontonanimeid.boats/';
      const jar = clearanceFor(u.hostname);
      if (jar) headers.Cookie = jar;
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

  // ---------- OtakuDesu source (od_ prefix) ----------
  const odHeaders = () => setHeaders({ Referer: `${OD_BASE}/` });
  async function odGet(url) {
    const r = await fetchText(url, { headers: odHeaders() });
    if (r.status >= 400) throw new Error(`otakudesu ${r.status} for ${url}`);
    return r.text;
  }

  app.get('/api/od/home', async (req, res) => {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const html = await odGet(page > 1 ? `${OD_BASE}/ongoing-anime/page/${page}/` : `${OD_BASE}/`);
      const cards = parseOdHome(html);
      if (!cards.length) throw new Error('empty catalog');
      res.json({ cards, page, hasNext: cards.length >= 12 });
    } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
  });

  app.get('/api/od/search', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) return res.json({ cards: [] });
      const html = await odGet(`${OD_BASE}/?s=${encodeURIComponent(q)}`);
      const cards = parseOdSearch(html);
      // episode-only results: resolve the first hit to its series card
      if (cards.length && cards[0].isEpisodeHit) {
        const epHtml = await odGet(cards[0].url);
        const seriesUrl = parseOdSeriesFromEpisode(epHtml);
        if (seriesUrl) {
          const slug = seriesUrl.match(/\/anime\/([^/]+)\/?/)?.[1] || '';
          const sh = await odGet(seriesUrl);
          const s = parseOdSeries(sh, slug);
          return res.json({ cards: [{ id: slug, slug, title: s.title, url: seriesUrl, poster: s.poster, episodeBadge: '', totalEpisodes: s.totalEpisodes }] });
        }
        return res.json({ cards: [] });
      }
      res.json({ cards });
    } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
  });

  app.get('/api/od/popular', async (_req, res) => {
    try {
      const names = ['Sousou no Frieren', 'Golden Kamuy', 'Enen no Shouboutai', 'Fate/strange Fake', 'One Piece', 'MF Ghost', 'Jujutsu Kaisen', 'Boku no Hero Academia', 'Shingeki no Kyojin'];
      const results = await Promise.all(names.map(async (q) => {
        const cards = parseOdSearch(await odGet(`${OD_BASE}/?s=${encodeURIComponent(q)}`));
        return cards[0] || null;
      }));
      res.json({ cards: results.filter(Boolean) });
    } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
  });

  app.get('/api/od/schedule', async (_req, res) => {
    try {
      const html = await odGet(`${OD_BASE}/jadwal-rilis/`);
      const days = [];
      for (const m of html.matchAll(/<h2>(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu|Random)<\/h2>\s*<ul>([\s\S]*?)<\/ul>/g)) {
        const items = [...m[2].matchAll(/href="(https:\/\/otakudesu\.blog\/anime\/[^"]+)"[^>]*>([^<]+)<\/a>/g)].map((a) => ({ slug: a[1].match(/\/anime\/([^/]+)\/?/)?.[1] || '', title: a[2].trim(), url: a[1] }));
        days.push({ day: m[1], items });
      }
      res.json({ days });
    } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
  });

  app.get('/api/od/anime/:slug', async (req, res) => {
    try {
      const html = await odGet(`${OD_BASE}/anime/${encodeURIComponent(req.params.slug)}/`);
      const series = parseOdSeries(html, req.params.slug);
      if (!series.title || !series.episodes.length) throw new Error('parse failed');
      res.json(series);
    } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
  });

  app.get('/api/od/watch/:slug', async (req, res) => {
    try {
      const url = req.query.url ? String(req.query.url) : '';
      if (!/https:\/\/otakudesu\.blog\/episode\//.test(url)) return res.status(400).json({ error: 'bad episode url' });
      const html = await odGet(url);
      const data = await parseOdEpisode(fetchText, url, html);
      if (!data.streams.length && !data.downloads.length) {
        return res.status(502).json({ error: 'no streams', code: 'no_streams', url });
      }
      res.json(data);
    } catch (e) { res.status(502).json({ error: String(e.message || e), code: 'fetch_failed' }); }
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
