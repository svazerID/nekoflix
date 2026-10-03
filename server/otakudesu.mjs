// OtakuDesu (otakudesu.blog) source adapter — mirrors the nontonanimeid parsing style.
// Chain (root-to-leaf reverse-engineered from the live site):
//   search/home  -> <ul class="chivsrc"> / <div class="animposx"> cards
//   series page  -> .infozingle fields + .episodelist (block titled "Episode List")
//   episode page -> .mirrorstream a[data-content] (base64 {id,i,q})
//                  -> POST admin-ajax action=aa1208d27f29ca340c92c66d1926f13f  -> nonce
//                  -> POST admin-ajax action=2a3505c93b0035d3f455df82bf976b84 {id,i,q,nonce}
//                  -> {data: base64(<iframe src="https://desustream.net/...">)}
//                  -> GET embed page -> `const videoURL = "https://cdn.odcloud.net/....mp4"`

export const OD_BASE = 'https://otakudesu.blog';

// mirrored from index.mjs UA via injectFetch
const abs = (u) => (!u ? '' : u.startsWith('http') ? u : OD_BASE + (u.startsWith('/') ? u : '/' + u));
const match1 = (s, re) => { const m = s.match(re); return m ? m[1] : ''; };
const stripTags = (s) => (s || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

// ---------- catalog / search ----------
export function parseOdSearch(html) {
  const cards = [];
  const ul = match1(html, /<ul class="chivsrc">([\s\S]*?)<\/ul>/);
  for (const chunk of ul.split('<li')) {
    const url = match1(chunk, /href="(https:\/\/otakudesu\.blog\/anime\/[^"]+)"/);
    if (!url) continue;
    const slug = url.match(/\/anime\/([^/]+)\/?/)?.[1] || '';
    cards.push({
      id: slug, slug,
      title: stripTags(match1(chunk, /<h2><a[^>]*>([^<]+)<\/a>/)),
      url,
      poster: match1(chunk, /<img[^>]+src="([^"]+)"/),
      episodeBadge: '', totalEpisodes: '',
    });
  }
  // "naruto"-style searches return episode entries only; an episode page links
  // its series via the "See All Episodes" anchor — map episode hits to series cards
  if (!cards.length) {
    for (const m of ul.split('<li')) {
      const epUrl = match1(m, /href="(https:\/\/otakudesu\.blog\/episode\/[^"]+)"/);
      if (!epUrl) continue;
      cards.push({
        id: epUrl, slug: '', // resolved to a series by /api/od/episode-series
        title: stripTags(match1(m, /<h2><a[^>]*>([^<]+)<\/a>/)).replace(/\s*Episode\s+\d+.*$/, ''),
        url: epUrl, poster: '', episodeBadge: '', totalEpisodes: '',
        isEpisodeHit: true,
      });
    }
  }
  return cards;
}

export function parseOdHome(html) {
  const cards = [];
  for (const block of html.matchAll(/<div class="thumb">([\s\S]*?)<\/div><\/div>/g)) {
    const url = match1(block[1], /href="(https:\/\/otakudesu\.blog\/anime\/[^"]+)"/);
    if (!url) continue;
    const slug = url.match(/\/anime\/([^/]+)\/?/)?.[1] || '';
    if (cards.some((c) => c.slug === slug)) continue;
    cards.push({
      id: slug, slug,
      title: stripTags(match1(block[1], /<h2 class="jdlflm">([\s\S]*?)<\/h2>/)) || match1(block[1], /alt="([^"]+)"/),
      url,
      poster: match1(block[1], /<img[^>]+src="([^"]+)"/),
      episodeBadge: stripTags(match1(block[1], /<div class='epz'>[\s\S]*?Episode (\d+)/)),
      totalEpisodes: match1(block[1], /Episode (\d+)/),
    });
  }
  return cards;
}

// ---------- series detail ----------
export function parseOdSeries(html, slug) {
  const info = match1(html, /<div class="infozingle">([\s\S]*?)<\/div>/);
  const f = {};
  for (const m of info.matchAll(/<b>([^:]+)<\/b>:\s*(?:<a[^>]*>)?([^<]*)/g)) f[m[1].trim()] = stripTags(m[2]);
  const poster = match1(html, /class='fotoanime'[^>]*>\s*<img[^>]+src="([^"]+)"/)
    || match1(html, /property="og:image" content="([^"]+)"/);
  const synopsis = stripTags(match1(html, /<div class='sinopc'>([\s\S]*?)<\/div>/));
  const genres = f['Genre'] ? f['Genre'].split(',').map((g) => g.trim()).filter(Boolean) : [];

  // episodes: episodelist block titled "… Episode List", DOM is newest-first
  let episodes = [];
  for (const m of html.matchAll(/monktit">[^<]*Episode List[\s\S]*?<\/ul>/g)) {
    for (const e of m[0].matchAll(/<a href="(https:\/\/otakudesu\.blog\/episode\/[^"]+)"[^>]*>([^<]+)<\/a>/g)) {
      const num = parseInt(e[1].match(/episode-(\d+)/)?.[1] || '0', 10);
      if (num > 0) episodes.push({ number: num, url: e[1], title: stripTags(e[2]) });
    }
    break;
  }
  episodes.sort((a, b) => a.number - b.number);

  const title = f['Judul'] || stripTags(match1(html, /<h1[^>]*>([\s\S]*?)<\/h1>/)).replace(' Subtitle Indonesia', '');
  return {
    id: slug, slug, title,
    japaneseTitle: f['Japanese'] || '',
    poster,
    genres: [...new Set(genres)],
    rating: f['Skor'] || '',
    type: f['Tipe'] || '',
    status: f['Status'] || '',
    totalEpisodes: f['Total Episode'] || String(episodes.length),
    duration: f['Durasi'] || '',
    season: f['Tanggal Rilis'] || '',
    studio: f['Studio'] || '',
    synopsis,
    episodes,
  };
}

// ---------- episode page -> mirrors ----------
// decode .mirrorstream entries: <ul class="m480p"> <a data-content="base64({id,i,q})">name</a>
export function parseOdMirrors(html) {
  const mirrors = [];
  for (const ul of html.matchAll(/<ul class="m(\d+p)">([\s\S]*?)<\/ul>/g)) {
    const quality = ul[1];
    for (const a of ul[2].matchAll(/<a href="#" data-content="([^"]+)"[^>]*>([^<]+)<\/a>/g)) {
      try {
        const payload = JSON.parse(atob(a[1]));
        mirrors.push({ serverName: a[2].trim(), quality, ...payload });
      } catch {}
    }
  }
  return mirrors;
}

export function parseOdPrevNext(html) {
  const nav = match1(html, /<div class='flir'>([\s\S]*?)<\/div>/);
  return {
    prevUrl: match1(nav, /href="([^"]+)"[^>]*title="Episode Sebelumnya"/),
    nextUrl: '', // "Next" link only exists after the newest episode airs; nav block has none
  };
}

// episode page -> series page URL ("See All Episodes" anchor)
export function parseOdSeriesFromEpisode(html) {
  return match1(html, /href="(https:\/\/otakudesu\.blog\/anime\/[^"]+)"/);
}

// genre listing: /genres/:slug/ pages use .col-anime-con cards (with pagination)
export function parseOdGenre(html) {
  const cards = [];
  for (const m of html.matchAll(/<div class="col-md-4 col-anime-con[^"]*">([\s\S]*?)(?=<div class="col-md-4 col-anime-con|$)/g)) {
    const b = m[1];
    const url = match1(b, /href="(https:\/\/otakudesu\.blog\/anime\/[^"]+)"/);
    if (!url) continue;
    const slug = url.match(/\/anime\/([^/]+)\/?/)?.[1] || '';
    const eps = match1(b, /col-anime-eps">([^<]*)/);
    cards.push({
      id: slug, slug,
      title: stripTags(match1(b, /col-anime-title"><a[^>]*>([^<]+)<\/a>/)),
      url,
      poster: match1(b, /col-anime-cover"><img src="([^"]+)"/),
      episodeBadge: eps.trim(),
      totalEpisodes: match1(eps, /(\d+)/),
    });
  }
  return cards;
}

// nonce flow: two-step POST to admin-ajax (browser does the same via jQuery)
export async function resolveOdMirror(fetchText, mirror, referer) {
  const none = { embedUrl: '', directUrl: '' };
  try {
    const n = await fetchText(`${OD_BASE}/wp-admin/admin-ajax.php`, {
      method: 'POST', skipCache: true, body: 'action=aa1208d27f29ca340c92c66d1926f13f',
      headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: referer, Origin: OD_BASE },
    });
    const nonce = match1(n.text, /"data":"([a-f0-9]+)"/);
    if (!nonce || n.status >= 400) return none;
    const body = new URLSearchParams({ id: String(mirror.id), i: String(mirror.i ?? 0), q: mirror.q || mirror.quality || '', nonce, action: '2a3505c93b0035d3f455df82bf976b84' });
    const r = await fetchText(`${OD_BASE}/wp-admin/admin-ajax.php`, {
      method: 'POST', skipCache: true, body: body.toString(),
      headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: referer, Origin: OD_BASE },
    });
    if (r.status >= 400) return none;
    const iframeHtml = atob(match1(r.text, /"data":"([A-Za-z0-9+/=]+)"/));
    const embedUrl = match1(iframeHtml, /src="([^"]+)"/);
    if (!embedUrl) return none;
    const ref = `${OD_BASE}/`;

    // 1) desustream (odcdn/odstream): mp4 in `const videoURL = "..."`
    if (/desustream\.net/.test(embedUrl)) {
      const e = await fetchText(embedUrl, { headers: { Referer: ref } });
      const direct = match1(e.text, /const\s+videoURL\s*=\s*"([^"]+)"/)
        || match1(e.text, /"file"\s*:\s*"([^"]+)"/)
        || match1(e.text, /https:\/\/[^"'\s]+\.(?:mp4|m3u8)/);
      return { embedUrl, directUrl: direct || '' };
    }

    // 2) upbolt/filedon-style hosts: POST /dl (op=embed) -> jwplayer sources (HLS)
    const em = embedUrl.match(/^https:\/\/(upbolt\.[a-z]+|filedon\.co)\/e\/([a-z0-9]+)/i);
    if (em) {
      const host = em[1], code = em[2];
      const dl = await fetchText(`https://${host}/dl`, {
        method: 'POST', skipCache: true,
        body: new URLSearchParams({ op: 'embed', file_code: code, auto: '1', referer: '' }).toString(),
        headers: { Referer: embedUrl },
      });
      const direct = match1(dl.text, /sources:\s*\[\{file:"([^"]+)"/)
        || match1(dl.text, /"file"\s*:\s*"([^"]+)"/);
      return { embedUrl, directUrl: direct || '' };
    }

    // 3) anything else: try a plain GET for an mp4/m3u8 in the embed page
    try {
      const e = await fetchText(embedUrl, { headers: { Referer: ref } });
      const direct = match1(e.text, /https:\/\/[^"'\s]+\.(?:mp4|m3u8)/);
      return { embedUrl, directUrl: direct || '' };
    } catch { return { embedUrl, directUrl: '' }; }
  } catch { return none; }
}

// default iframe inside #pembed (odcdn 480p) — same chain without the mirror click
export function parseOdDefaultEmbed(html) {
  const frame = match1(html, /id="pembed"[\s\S]*?<iframe[^>]*src="([^"]+)"/);
  return frame;
}

export async function parseOdEpisode(fetchText, pageUrl, html) {
  const title = stripTags(match1(html, /<h1 class="posttl">([\s\S]*?)<\/h1>/));
  const { prevUrl, nextUrl } = parseOdPrevNext(html);
  const thumbnail = match1(html, /property="og:image" content="([^"]+)"/);

  const seen = new Set();
  const mirrors = parseOdMirrors(html).filter((m) => {
    const k = `${m.serverName}|${m.quality}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const defaultEmbed = parseOdDefaultEmbed(html);

  // resolve mirrors in parallel (they're independent POST chains)
  const jobs = mirrors.slice(0, 8).map(async (m) => {
    const { embedUrl, directUrl } = await resolveOdMirror(fetchText, m, pageUrl);
    return {
      serverName: `${m.serverName} ${m.quality}`.trim(),
      quality: m.quality,
      embedUrl, directStream: directUrl,
    };
  });
  let streams = [];
  try { streams = (await Promise.all(jobs)).filter((s) => s.embedUrl || s.directStream); } catch {}

  // default embed as guaranteed fallback (always present, odcdn)
  if (defaultEmbed && !streams.length) {
    try {
      const e = await fetchText(defaultEmbed, { headers: { Referer: `${OD_BASE}/` } });
      const direct = match1(e.text, /const\s+videoURL\s*=\s*"([^"]+)"/)
        || match1(e.text, /https:\/\/[^"'\s]+\.(?:mp4|m3u8)/);
      streams.push({ serverName: 'odcdn 480p', quality: '480p', embedUrl: defaultEmbed, directStream: direct });
    } catch {}
  }

  // download links (external file hosts; keep as outUrl links)
  const downloads = [];
  for (const li of html.matchAll(/<li><strong>([^<]+)<\/strong>([\s\S]*?)<\/li>/g)) {
    const quality = stripTags(li[1]);
    for (const a of li[2].matchAll(/<a href="(https:\/\/link\.desustream\.com\/[^"]+)"[^>]*>([^<]+)<\/a>/g)) {
      downloads.push({ serverName: stripTags(a[2]), quality, outUrl: a[1], directUrl: '' });
    }
  }

  return {
    seriesTitle: title.replace(/\s*Episode\s+\d+.*$/, ''),
    episodeTitle: title,
    thumbnail,
    prevUrl: abs(prevUrl), nextUrl: abs(nextUrl),
    streams, downloads,
    source: 'otakudesu',
  };
}
