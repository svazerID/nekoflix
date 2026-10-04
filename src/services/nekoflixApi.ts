// Live catalog from the NekoFlix scrape backend (server/index.mjs). sessionStorage cache per session.
import { Anime, Episode } from '../types/anime';
import { GENRE_MAP } from '../components/SearchAndBrowse';

const API = '/api';
const CACHE_KEY = 'nekoflix_live_animes_v1';

const KNOWN_GENRE_MAP: Record<string, string> = {
  Action: 'Aksi', Adventure: 'Petualangan', Comedy: 'Komedi', Drama: 'Drama',
  Fantasy: 'Fantasi', Mystery: 'Misteri', Romance: 'Romansa', 'Slice of Life': 'Slice of Life',
  Supernatural: 'Supernatural', Horror: 'Horor', 'Sci-Fi': 'Sci-Fi', Sports: 'Olahraga',
};

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  return res.json();
}

function mapSeries(raw: any): Anime {
  const episodes: Episode[] = (raw.episodes || []).map((ep: any) => ({
    id: ep.url,
    animeId: raw.slug,
    episodeNumber: ep.number,
    // source title is "<Series> Episode N Subtitle Indonesia" — keep the distinguishing tail only
    title: ep.title?.replace(/^.*\s+Episode\s+\d+\s*/, '') || `Episode ${ep.number}`,
    synopsis: '',
    thumbnailUrl: raw.poster || '',
    duration: raw.duration || '24m',
    durationSeconds: 1440,
    videoUrl: '',
  }));
  const year = parseInt(raw.season?.match(/(\d{4})/)?.[1] || '2024', 10);
  return {
    id: raw.slug,
    title: raw.title,
    japaneseTitle: raw.japaneseTitle,
    description: raw.synopsis || 'Sinopsis belum tersedia.',
    posterUrl: raw.poster || '',
    bannerUrl: raw.poster || '',
    genres: (raw.genres || []).map((g: string) => {
      const slug = g.toLowerCase().replace(/\s+/g, '-');
      return GENRE_MAP[slug] || KNOWN_GENRE_MAP[g] || g;
    }),
    rating: parseFloat(raw.rating) || 7.5,
    scoreCount: 1200,
    year,
    season: raw.season || '',
    studio: raw.studio || 'N/A',
    status: raw.status === 'Tamat' ? 'Tamat' : 'Ongoing',
    episodesCount: episodes.length || parseInt(raw.totalEpisodes, 10) || 1,
    episodes: episodes.length ? episodes : [1].map((n) => ({
      id: `${raw.slug}-${n}`, animeId: raw.slug, episodeNumber: n, title: `Episode ${n}`, synopsis: '',
      thumbnailUrl: raw.poster || '', duration: raw.duration || '24m', durationSeconds: 1440, videoUrl: '',
    })),
    ageRating: '13+',
    quality: '720p HD',
    audioLanguages: ['Japanese'],
    subtitleLanguages: ['Indonesia', 'English'],
  };
}

function dedupe(animes: Anime[]): Anime[] {
  const seen = new Set<string>();
  return animes.filter((a) => !seen.has(a.id) && seen.add(a.id));
}

export const nekoflixApi = {
  async getCatalog(): Promise<Anime[]> {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    // primary: OtakuDesu backend; fallback: nontonanimeid backend
    let pages: { cards: any[] }[];
    try {
      pages = await Promise.all([1, 2, 3].map((p) => apiGet<{ cards: any[] }>(`/od/home?page=${p}`).catch(() => ({ cards: [] }))));
    } catch {
      pages = [{ cards: [] }];
    }
    if (!pages.some((p) => p.cards.length)) {
      pages = await Promise.all([1, 2, 3].map((p) => apiGet<{ cards: any[] }>(`/home?page=${p}`).catch(() => ({ cards: [] }))));
      const slugs = [...new Set(pages.flatMap((p) => p.cards).map((c) => c.slug))].slice(0, 24);
      const details = await Promise.all(slugs.map((slug) => apiGet<any>(`/anime/${slug}`).catch(() => null)));
      const animes = dedupe(details.filter(Boolean).map(mapSeries));
      if (!animes.length) throw new Error('katalog kosong');
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(animes)); } catch {}
      return animes;
    }
    const slugs = [...new Set(pages.flatMap((p) => p.cards).map((c) => c.slug))].slice(0, 24);
    const details = await Promise.all(slugs.map((slug) => apiGet<any>(`/od/anime/${slug}`).catch(() => null)));
    const animes = dedupe(details.filter(Boolean).map(mapSeries));
    if (!animes.length) throw new Error('katalog kosong');
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(animes)); } catch {}
    return animes;
  },

  async getAnime(slug: string): Promise<Anime> {
    const raw = await apiGet<any>(`/od/anime/${slug}`);
    return mapSeries(raw);
  },

  async getPopular(): Promise<Anime[]> {
    const { cards } = await apiGet<{ cards: any[] }>('/od/popular');
    const details = await Promise.all((cards || []).slice(0, 10).map((c: any) => apiGet<any>(`/od/anime/${c.slug}`).catch(() => null)));
    return dedupe(details.filter(Boolean).map(mapSeries));
  },

  async getTrending(): Promise<Anime[]> {
    const { cards } = await apiGet<{ cards: any[] }>('/od/trending');
    const details = await Promise.all((cards || []).slice(0, 10).map((c: any) => apiGet<any>(`/od/anime/${c.slug}`).catch(() => null)));
    return dedupe(details.filter(Boolean).map((a: any) => ({ ...mapSeries(a), title: cards.find((c: any) => c.slug === a.slug)?.title || a.title })));
  },

  async getAction(): Promise<Anime[]> {
    const cards = await this.genreCards('action').catch(() => []);
    const details = await Promise.all(cards.slice(0, 24).map((c: any) => apiGet<any>(`/od/anime/${c.slug}`).catch(() => null)));
    return dedupe(details.filter(Boolean).map(mapSeries));
  },

  async genreCards(genreSlug: string, page = 1): Promise<any[]> {
    const { cards } = await apiGet<{ cards: any[] }>(`/od/genre/${genreSlug}?page=${page}`);
    return cards || [];
  },

  async searchRemote(q: string): Promise<Anime[]> {
    const { cards } = await apiGet<{ cards: any[] }>(`/od/search?q=${encodeURIComponent(q)}`);
    // each card is a series slug -> fetch details
    const details = await Promise.all(
      (cards || []).slice(0, 12).map((c: any) => apiGet<any>(`/od/anime/${c.slug}`).catch(() => null))
    );
    return details.filter(Boolean).map(mapSeries);
  },

  async resolveEpisode(anime: Anime, episodeNumber: number): Promise<{
    videoUrl: string; sources: { url: string; label: string; kind: 'hls' | 'mp4' | 'embed' }[]; downloadUrl?: string; error?: string; errorCode?: string;
  }> {
    const ep = anime.episodes.find((e) => e.episodeNumber === episodeNumber) || anime.episodes[0];
    if (ep.videoUrl) return { videoUrl: ep.videoUrl, sources: [{ url: ep.videoUrl, label: 'Default', kind: 'mp4' }] };
    let raw: any;
    try {
      // primary: OtakuDesu chain (works even when the other origin is challenge-gated)
      if (ep.id.includes('otakudesu.blog/episode/')) {
        raw = await apiGet<any>(`/od/watch/${anime.id}?url=${encodeURIComponent(ep.id)}`);
      } else {
        try {
          raw = await apiGet<any>(`/watch/${anime.id}?url=${encodeURIComponent(ep.id)}`);
        } catch {
          raw = null;
        }
      }
    } catch (e) {
      return { videoUrl: '', sources: [], error: 'Tidak bisa menghubungi server video.', errorCode: 'fetch_failed' };
    }
    if (raw.code === 'upstream_blocked') {
      return { videoUrl: '', sources: [], error: 'Server video sedang sibuk (proteksi aktif). Coba lagi nanti.', errorCode: 'upstream_blocked' };
    }
    if (raw.error) {
      return { videoUrl: '', sources: [], error: 'Video belum tersedia untuk episode ini.', errorCode: raw.code || 'no_streams' };
    }
    const sources: { url: string; label: string; kind: 'hls' | 'mp4' | 'embed' }[] = [];
    for (const s of raw.streams || []) {
      const ds: string | undefined = s.directStream || s.direct_stream;
      if (ds) {
        const isHls = ds.includes('.m3u8');
        // edge CDNs (upbolt/filedon) serve CORS:* and block datacenter proxy IPs — play direct;
        // odcloud blocks browser Referer — must go through proxy. desustream needs no special care.
        const edge = /upbolt\.|filedon\.|edge\d*\./.test(new URL(ds).hostname);
        sources.push({
          url: edge ? ds : `/api/proxy?url=${encodeURIComponent(ds)}`,
          label: `${s.serverName || s.server_name || 'Server'}${isHls ? ' (HLS)' : ''}`,
          kind: isHls ? 'hls' : 'mp4',
        });
      } else if (s.embedUrl) {
        // embed-only mirror (vidhide/mega/filedon): no direct stream — player opens it in a new tab
        sources.push({ url: s.embedUrl, label: `${s.serverName || 'Server'} (Embed)`, kind: 'embed' });
      }
    }
    // download links are NOT stream servers — expose the first /out/ link separately
    const firstDl = (raw.downloads || []).find((d: any) => (d.outUrl || d.out_url));
    const downloadUrl = firstDl ? (firstDl.outUrl || firstDl.out_url) : '';
    if (!sources.length) {
      return { videoUrl: '', sources: [], downloadUrl, error: 'Tidak ada sumber video yang bisa diputar.', errorCode: 'no_playable' };
    }
    return { videoUrl: sources[0].url, sources, downloadUrl };
  },
};
