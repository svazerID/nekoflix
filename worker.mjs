import { parseOdSearch, parseOdHome, parseOdSeries, parseOdEpisode, parseOdSeriesFromEpisode, parseOdGenre, OD_BASE } from './server/otakudesu.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const cache = new Map();
const TTL = 5 * 60 * 1000;
function extractCrunchyTitles(html) {
  const titles = [...html.matchAll(/### \[([^\]]+)\]\(https:\/\/www\.crunchyroll\.com\/id\/series\//g)].map((m) => m[1].replace(/\\\\#/g, '#').trim());
  return [...new Set(titles)].slice(0, 20);
}
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
  let r = await fetchText('https://www.crunchyroll.com/id/videos/new', { headers: { Accept: 'text/html,application/xhtml+xml' } });
  if (r.status >= 400) {
    const alternate = await fetchText('https://r.jina.ai/https://www.crunchyroll.com/id/videos/new', { skipCache: true });
    if (alternate.status < 400) r = alternate;
  }
  if (r.status >= 400) throw new Error(`Crunchyroll ${r.status}`);
  const titles = extractCrunchyTitles(r.text);
  const results = await Promise.all(titles.map(async (title) => {
    const cards = parseOdSearch(await odGet(`${OD_BASE}/?s=${encodeURIComponent(title)}`));
    const card = cards.find((item) => !item.isEpisodeHit);
    return card ? { ...card, title } : null;
  }));
  return json({ cards: results.filter(Boolean) });
}
async function odPopular() {
  const r = await fetchText('https://www.crunchyroll.com/id/videos/popular', { headers: { Accept: 'text/html,application/xhtml+xml' } });
  if (r.status >= 400) throw new Error(`Crunchyroll ${r.status}`);
  const titles = extractCrunchyTitles(r.text);
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
async function odSchedule() {
  const html = await odGet(`${OD_BASE}/jadwal-rilis/`);
  const days = [];
  for (const m of html.matchAll(/<h2>(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu|Random)<\/h2>\s*<ul>([\s\S]*?)<\/ul>/g)) {
    const items = [];
    for (const li of m[2].matchAll(/<li[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/li>/g)) {
      const slug = li[1].match(/\/anime\/([^/]+)/)?.[1] || '';
      const title = li[2].replace(/<[^>]*>/g, '').trim();
      if (slug && title) items.push({ slug, title, url: li[1] });
    }
    days.push({ day: m[1], items });
  }
  if (!days.length) throw new Error('schedule parse failed');
  return json({ days });
}
async function odGenre(slug, url) {
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const html = await odGet(`${OD_BASE}/genre/${encodeURIComponent(slug)}/page/${page}/`);
  return json({ cards: parseOdGenre(html), page });
}
async function mediaProxy(req, url) {
  const target = url.searchParams.get('url') || '';
  let parsed;
  try { parsed = new URL(target); } catch { return new Response('bad url', { status: 400 }); }
  if (parsed.protocol !== 'https:' || !['odcdn.com', 'desustream.net', 'upbolt.com', 'filedon.com', 'blogger.com'].some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) return new Response('host not allowed', { status: 403 });
  const headers = new Headers({ 'User-Agent': UA, Referer: `${OD_BASE}/` });
  const range = req.headers.get('Range');
  if (range) headers.set('Range', range);
  const r = await fetch(target, { headers });
  const outHeaders = new Headers(r.headers);
  outHeaders.set('Access-Control-Allow-Origin', '*');
  outHeaders.set('Accept-Ranges', 'bytes');
  return new Response(r.body, { status: r.status, headers: outHeaders });
}
async function handleApi(req, url) {
  const path = url.pathname;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS', 'Access-Control-Allow-Headers': 'Range,Content-Type' } });
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
