// Live catalog from the NekoFlix scrape backend (server/index.mjs). sessionStorage cache per session.
import { Anime, Episode } from '../types/anime';

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
    title: `Episode ${ep.number}`,
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
    genres: (raw.genres || []).map((g: string) => KNOWN_GENRE_MAP[g] || g),
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
    const pages = await Promise.all([1, 2, 3].map((p) => apiGet<{ cards: any[] }>(`/home?page=${p}`).catch(() => ({ cards: [] }))));
    const slugs = [...new Set(pages.flatMap((p) => p.cards).map((c) => c.slug))].slice(0, 24);
    const details = await Promise.all(
      slugs.map((slug) => apiGet<any>(`/anime/${slug}`).catch(() => null))
    );
    const animes = dedupe(details.filter(Boolean).map(mapSeries));
    if (!animes.length) throw new Error('katalog kosong');
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(animes)); } catch {}
    return animes;
  },

  async resolveEpisode(anime: Anime, episodeNumber: number): Promise<{ videoUrl: string; streams: any[] }> {
    const ep = anime.episodes.find((e) => e.episodeNumber === episodeNumber) || anime.episodes[0];
    if (ep.videoUrl) return { videoUrl: ep.videoUrl, streams: [] };
    const raw = await apiGet<any>(`/watch/${anime.slug}?url=${encodeURIComponent(ep.id)}`);
    const streams = raw.streams || [];
    // only m3u8 direct streams are playable; /go/dl/ links are download-gates (403 outside their token flow)
    const playable = streams.filter((s: any) => s.directStream?.includes('.m3u8'));
    const videoUrl = playable.length
      ? `/api/proxy?url=${encodeURIComponent(playable[0].directStream)}`
      : '';
    return { videoUrl, streams };
  },
};
