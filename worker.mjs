// Cloudflare Worker backend — same API surface as server/index.mjs (Express) but Workers-native.
// Serves the OtakuDesu source routes + media proxy; static assets (dist/) via [assets] binding.
// Reuses the pure parsers from otakudesu.mjs (no Node APIs — atob/URLSearchParams are Workers globals).

import { parseOdSearch, parseOdHome, parseOdSeries, parseOdEpisode, parseOdSeriesFromEpisode, parseOdGenre, OD_BASE } from './server/otakudesu.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const ALLOWED_HOSTS = /^(s\d+\.kotakanimeid\.link|cdn\d*\.kotakanimeid\.link|s13\.nontonanimeid\.boats|i0\.wp\.com|cdn\.odcloud\.net|desustream\.net|upbolt\.[a-z.]+|filedon\.co|edge\d*\.[a-z0-9.-]+)$/;

// ---------- tiny fetch + cache (per-isolate) ----------
const cache = new Map();
const TTL = 5 * 60 * 1000;
const POPULAR_SEARCHES = [
  ['Sousou no Frieren'], ['Golden Kamuy'], ['Enen no Shouboutai'], ['Fate/strange Fake'],
  ['One Piece'], ['MF Ghost'], ['Jujutsu Kaisen'], ['Boku no Hero Academia', 'My Hero Academia'],
  ['Shingeki no Kyojin', 'Attack on Titan'],
];
async function fetchText(url, opts = {}) {
  const key = url + (opts.method === 'POST' ? String(opts.body || '') : '');
  const hit = !opts.skipCache && cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.data;
  const headers = { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8', ...opts.headers };
  if (opts.body && !opts.headers?.['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
  // ponytail: 3 tries on 503, no proxy (Workers egress IPs are CF's own — proxy pointless here)
  let res;
  for (let i = 1; ; i++) {
    res = await fetch(url, { method: opts.method || 'GET', headers, body: opts.body, redirect: 'manual' });
    if (res.status !== 503 || i >= 3) break;
    await new Promise((r) => setTimeout(r, 800 * i));
  }
  const text = await res.text();
  const out = { status: res.status, text, headers: Object.fromEntries(res.headers) };
  if (!opts.skipCache && res.status < 400) cache.set(key, { t: Date.now(), data: out });
  return out;
}

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
const match1 = (s, re) => { const m = s.match(re); return m ? m[1] : ''; };

// ---------- otakudesu routes ----------
const odHeaders = () => ({ Referer: `${OD_BASE}/`, 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate' });
async function odGet(url) {
  const r = await fetchText(url, { headers: odHeaders() });
  if (r.status >= 400) throw new Error(`otakudesu ${r.status} for ${url}`);
  return r.text;
}

async function odHome(url) {
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const html = await odGet(page > 1 ? `${OD_BASE}/ongoing-anime/page/${page}/` : `${OD_BASE}/`);
  const cards = parseOdHome(html);
  if (!cards.length) throw new Error('empty catalog');
  return json({ cards, page, hasNext: cards.length >= 12 });
}

async function odSearch(url) {
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return json({ cards: [] });
  const html = await odGet(`${OD_BASE}/?s=${encodeURIComponent(q)}`);
  const cards = parseOdSearch(html);
  // episode-only results: resolve the first hit to its series card
  if (cards.length && cards[0].isEpisodeHit) {
    const epHtml = await odGet(cards[0].url);
    const seriesUrl = parseOdSeriesFromEpisode(epHtml);
    if (seriesUrl) {
      const slug = seriesUrl.match(/\/anime\/([^/]+)\/?/)?.[1] || '';
      const s = parseOdSeries(await odGet(seriesUrl), slug);
      return json({ cards: [{ id: slug, slug, title: s.title, url: seriesUrl, poster: s.poster, episodeBadge: '', totalEpisodes: s.totalEpisodes }] });
    }
    return json({ cards: [] });
  }
  return json({ cards });
}

async function odTrending() {
  const html = await fetchText('https://www.crunchyroll.com/id/videos/new', {
    headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8' },
  }).then((r) => {
    if (r.status >= 400) throw new Error(`Crunchyroll ${r.status}`);
    return r.text;
  });
  const titles = [...new Set([...html.matchAll(/(?:data-title|"title"|title)=?["']([^"']{2,100})["']/gi)].map((m) => m[1].replace(/\\u0026/g, '&').trim()).filter(Boolean))].slice(0, 20);
  const results = await Promise.all(titles.map(async (title) => {
    const cards = parseOdSearch(await odGet(`${OD_BASE}/?s=${encodeURIComponent(title)}`));
    const card = cards.find((item) => !item.isEpisodeHit);
    return card ? { ...card, title } : null;
  }));
  return json({ cards: results.filter(Boolean) });
}

async function odPopular() {
  const html = await fetchText('https://www.crunchyroll.com/id/videos/popular', { headers: { Accept: 'text/html,application/xhtml+xml' } }).then((r) => { if (r.status >= 400) throw new Error(`Crunchyroll ${r.status}`); return r.text; });
  const titles = [...new Set([...html.matchAll(/(?:data-title|"title"|title)=?["']([^"']{2,100})["']/gi)].map((m) => m[1].replace(/\\u0026/g, '&').trim()).filter(Boolean))].slice(0, 20);
  const results = await Promise.all(titles.map(async (title) => {
    const cards = parseOdSearch(await odGet(`${OD_BASE}/?s=${encodeURIComponent(title)}`));
    const card = cards.find((item) => !item.isEpisodeHit);
    return card ? { ...card, title } : null;
  }));
  return json({ cards: results.filter(Boolean) });
}

async function odAnime(slug) {
  const html = await odGet(`${OD_BASE}/anime/${encodeURIComponent(slug)}/`);
  const series = parseOdSeries(html, slug);
  if (!series.title || !series.episodes.length) throw new Error('parse failed');
  return json(series);
}

async function odWatch(slug, url) {
  const epUrl = url.searchParams.get('url') || '';
  if (!/^https:\/\/otakudesu\.blog\/episode\//.test(epUrl)) return json({ error: 'bad episode url' }, 400);
  const html = await odGet(epUrl);
  const data = await parseOdEpisode(fetchText, epUrl, html);
  if (!data.streams.length && !data.downloads.length) return json({ error: 'no streams', code: 'no_streams', url: epUrl }, 502);
  return json(data);
}

// weekly release schedule (jadwal-rilis page: per-day <ul> of ongoing anime)
async function odSchedule() {
  const html = await odGet(`${OD_BASE}/jadwal-rilis/`);
  const days = [];
  for (const m of html.matchAll(/<h2>(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu|Random)<\/h2>\s*<ul>([\s\S]*?)<\/ul>/g)) {
    const items = [];
    for (const a of m[2].matchAll(/href="(https:\/\/otakudesu\.blog\/anime\/[^"]+)"[^>]*>([^<]+)<\/a>/g)) {
      const slug = a[1].match(/\/anime\/([^/]+)\/?/)?.[1] || '';
      items.push({ slug, title: a[2].trim(), url: a[1] });
    }
    days.push({ day: m[1], items });
  }
  if (!days.length) throw new Error('parse failed');
  return json({ days });
}

// genre listing: /genres/:slug/ — page param optional (source order, no sorting)
async function odGenre(slug, url) {
  if (!/^[a-z0-9-]+$/.test(slug)) return json({ error: 'bad genre slug' }, 400);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const base = page > 1 ? `${OD_BASE}/genres/${encodeURIComponent(slug)}/page/${page}/` : `${OD_BASE}/genres/${encodeURIComponent(slug)}/`;
  const html = await odGet(base);
  const cards = parseOdGenre(html);
  if (!cards.length) throw new Error('empty genre');
  return json({ cards, genre: slug, page, hasNext: /\/page\/\d+\/?"|page\/\d+\/\//.test(html) && cards.length >= 15 });
}

// ---------- media proxy ----------
function proxyUrl(u, base) {
  return `/api/proxy?url=${encodeURIComponent(new URL(u, base).toString())}`;
}

async function mediaProxy(req, url) {
  const target = url.searchParams.get('url') || '';
  let u;
  try { u = new URL(target); } catch { return new Response('bad url', { status: 400 }); }
  if (!/^https?:$/.test(u.protocol) || !ALLOWED_HOSTS.test(u.hostname)) return new Response('host not allowed', { status: 403 });
  const headers = { 'User-Agent': UA, Accept: '*/*' };
  // forward the browser's Range — <video> seeks depend on 206 + Content-Range
  const range = req.headers.get('range');
  if (range) headers.Range = range;
  if (/^s\d+\.kotakanimeid\.link$/.test(u.hostname)) headers.Referer = 'https://s13.nontonanimeid.boats/';
  // odcloud's WAF requires the otakudesu Referer (403/error 1010 without it)
  if (/odcloud\.net$/.test(u.hostname)) headers.Referer = `${OD_BASE}/`;
  // upbolt/filedon edge CDNs require their own site as Referer
  if (/upbolt\.[a-z.]+$/.test(u.hostname) || /filedon\.co$/.test(u.hostname)) headers.Referer = `https://${u.hostname.replace(/^edge\d*\./, '')}/`;
  let upstream;
  for (let i = 1; ; i++) {
    try {
      upstream = await fetch(target, { headers, redirect: 'follow' });
      // edge hosts (upbolt/filedon) intermittently 403 fresh CF egress connections — retry clears it
      if (upstream.status !== 403 || i >= 4) break;
      await new Promise((r) => setTimeout(r, 700 * i));
      continue;
    } catch (e) {
      if (i >= 3) return new Response('proxy failed', { status: 502 });
      await new Promise((r) => setTimeout(r, 800 * i));
    }
  }
  const ct = upstream.headers.get('content-type') || '';
  const passthrough = { 'Content-Type': ct, 'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes', 'Cache-Control': upstream.headers.get('cache-control') || 'no-store', 'Access-Control-Allow-Origin': '*' };
  if (upstream.headers.get('content-range')) passthrough['Content-Range'] = upstream.headers.get('content-range');
  if (upstream.headers.get('content-length')) passthrough['Content-Length'] = upstream.headers.get('content-length');

  if (/mpegurl|m3u8/i.test(ct)) {
    const body = (await upstream.text())
      .split('\n')
      .map((line) => {
        const t = line.trim();
        if (!t || t.startsWith('#EXT-X-KEY')) return t ? line.replace(/URI="(.*?)"/, (_s, uri) => `URI="${proxyUrl(uri, u)}"`) : line;
        if (t.startsWith('#')) return line;
        return proxyUrl(t, u);
      })
      .join('\n');
    return new Response(body, { status: upstream.status, headers: passthrough });
  }
  return new Response(upstream.body, { status: upstream.status, headers: passthrough });
}

// ---------- router ----------
async function handleApi(req, url) {
  const path = url.pathname;
  try {
    if (path === '/api/od/home') return await odHome(url);
    if (path === '/api/od/search') return await odSearch(url);
    if (path === '/api/od/popular') return await odPopular();
    if (path === '/api/od/trending') return await odTrending();
    if (path === '/api/od/schedule') return await odSchedule();
    const odGenreM = path.match(/^\/api\/od\/genre\/([^/]+)$/);
    if (odGenreM) return await odGenre(decodeURIComponent(odGenreM[1]), url);
    const odAnimeM = path.match(/^\/api\/od\/anime\/([^/]+)$/);
    if (odAnimeM) return await odAnime(decodeURIComponent(odAnimeM[1]));
    const odWatchM = path.match(/^\/api\/od\/watch\/([^/]+)$/);
    if (odWatchM) return await odWatch(odWatchM[1], url);
    if (path === '/api/proxy') return await mediaProxy(req, url);
    return json({ error: `unknown api route: ${path}` }, 404);
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return handleApi(req, url);
    return env.ASSETS.fetch(req);
  },
};
