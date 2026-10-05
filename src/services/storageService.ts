import { Anime, DownloadItem, Review, UserProfile, WatchHistoryItem } from '../types/anime';
import { INITIAL_ANIMES, INITIAL_REVIEWS, PROFILES } from '../data/animeData';
import { mergeHistory, removeHistoryItem } from './history';

const STORAGE_KEYS = {
  ANIMES: 'nekoflix_animes_v1',
  ACTIVE_PROFILE: 'nekoflix_active_profile_v1',
  WATCHLIST: 'nekoflix_watchlist_v1',
  FAVORITES: 'nekoflix_favorites_v1',
  HISTORY: 'nekoflix_history_v1',
  DOWNLOADS: 'nekoflix_downloads_v1',
  REVIEWS: 'nekoflix_reviews_v1',
  THEME: 'nekoflix_theme_v1',
  MUTED: 'nekoflix_sound_muted_v1',
};

export const storageService = {
  // Theme
  getTheme(): 'dark' | 'light' {
    return (localStorage.getItem(STORAGE_KEYS.THEME) as 'dark' | 'light') || 'dark';
  },
  setTheme(theme: 'dark' | 'light') {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  },

  // Sound preference
  getSoundMuted(): boolean {
    const val = localStorage.getItem(STORAGE_KEYS.MUTED);
    return val !== null ? val === 'true' : true;
  },
  setSoundMuted(muted: boolean) {
    localStorage.setItem(STORAGE_KEYS.MUTED, String(muted));
  },

  // Anime Library
  getAnimes(): Anime[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ANIMES);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse cached animes', e);
    }
    return INITIAL_ANIMES;
  },
  saveAnimes(animes: Anime[]) {
    localStorage.setItem(STORAGE_KEYS.ANIMES, JSON.stringify(animes));
  },
  addCustomAnime(newAnime: Anime): Anime[] {
    const current = this.getAnimes();
    const updated = [newAnime, ...current];
    this.saveAnimes(updated);
    return updated;
  },

  // Profiles
  getProfiles(): UserProfile[] {
    return PROFILES;
  },
  getActiveProfile(): UserProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE);
      if (data) return JSON.parse(data);
    } catch {}
    return PROFILES[0];
  },
  setActiveProfile(profile: UserProfile) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, JSON.stringify(profile));
  },

  // Watchlist
  getWatchlist(profileId: string): string[] {
    try {
      const data = localStorage.getItem(`${STORAGE_KEYS.WATCHLIST}_${profileId}`);
      if (data) return JSON.parse(data);
    } catch {}
    return ['solo-leveling-shadow-arise', 'frieren-beyond-journeys-end'];
  },
  toggleWatchlist(profileId: string, animeId: string): string[] {
    const list = this.getWatchlist(profileId);
    let updated: string[];
    if (list.includes(animeId)) {
      updated = list.filter((id) => id !== animeId);
    } else {
      updated = [animeId, ...list];
    }
    localStorage.setItem(`${STORAGE_KEYS.WATCHLIST}_${profileId}`, JSON.stringify(updated));
    return updated;
  },

  // Favorites
  getFavorites(profileId: string): string[] {
    try {
      const data = localStorage.getItem(`${STORAGE_KEYS.FAVORITES}_${profileId}`);
      if (data) return JSON.parse(data);
    } catch {}
    return ['solo-leveling-shadow-arise', 'attack-on-titan-final'];
  },
  toggleFavorite(profileId: string, animeId: string): string[] {
    const list = this.getFavorites(profileId);
    let updated: string[];
    if (list.includes(animeId)) {
      updated = list.filter((id) => id !== animeId);
    } else {
      updated = [animeId, ...list];
    }
    localStorage.setItem(`${STORAGE_KEYS.FAVORITES}_${profileId}`, JSON.stringify(updated));
    return updated;
  },

  // Watch History
  getWatchHistory(profileId: string): WatchHistoryItem[] {
    try {
      const data = localStorage.getItem(`${STORAGE_KEYS.HISTORY}_${profileId}`);
      if (data) return JSON.parse(data);
    } catch {}
    return [
      {
        animeId: 'solo-leveling-shadow-arise',
        episodeId: 'sl-ep-1',
        episodeNumber: 1,
        episodeTitle: "I'm Used to It",
        progressSeconds: 420,
        durationSeconds: 1440,
        lastWatchedAt: Date.now() - 3600000,
      },
      {
        animeId: 'frieren-beyond-journeys-end',
        episodeId: 'fri-ep-1',
        episodeNumber: 1,
        episodeTitle: 'Akhir dari Petualangan',
        progressSeconds: 840,
        durationSeconds: 1500,
        lastWatchedAt: Date.now() - 86400000,
      },
    ];
  },
  saveWatchProgress(profileId: string, item: WatchHistoryItem): WatchHistoryItem[] {
    const updated = mergeHistory(this.getWatchHistory(profileId), item);
    localStorage.setItem(`${STORAGE_KEYS.HISTORY}_${profileId}`, JSON.stringify(updated));
    return updated;
  },

  removeWatchHistoryItem(profileId: string, animeId: string, episodeId: string): WatchHistoryItem[] {
    const updated = removeHistoryItem(this.getWatchHistory(profileId), animeId, episodeId);
    localStorage.setItem(`${STORAGE_KEYS.HISTORY}_${profileId}`, JSON.stringify(updated));
    return updated;
  },

  clearWatchHistory(profileId: string): WatchHistoryItem[] {
    localStorage.setItem(`${STORAGE_KEYS.HISTORY}_${profileId}`, JSON.stringify([]));
    return [];
  },

  // Downloads
  getDownloads(profileId: string): DownloadItem[] {
    try {
      const data = localStorage.getItem(`${STORAGE_KEYS.DOWNLOADS}_${profileId}`);
      if (data) return JSON.parse(data);
    } catch {}
    return [];
  },
  saveDownloads(profileId: string, downloads: DownloadItem[]) {
    localStorage.setItem(`${STORAGE_KEYS.DOWNLOADS}_${profileId}`, JSON.stringify(downloads));
  },
  startDownload(profileId: string, anime: Anime, episode: { id: string; episodeNumber: number; title: string; thumbnailUrl: string }): DownloadItem[] {
    const current = this.getDownloads(profileId);
    if (current.some((d) => d.episodeId === episode.id)) {
      return current;
    }
    const newItem: DownloadItem = {
      id: `dl-${Date.now()}`,
      animeId: anime.id,
      animeTitle: anime.title,
      episodeId: episode.id,
      episodeNumber: episode.episodeNumber,
      episodeTitle: episode.title,
      thumbnailUrl: episode.thumbnailUrl || anime.posterUrl,
      fileSizeMb: 245,
      status: 'downloading',
      progress: 15,
      downloadedAt: Date.now(),
    };
    const updated = [newItem, ...current];
    this.saveDownloads(profileId, updated);
    return updated;
  },
  removeDownload(profileId: string, downloadId: string): DownloadItem[] {
    const current = this.getDownloads(profileId);
    const updated = current.filter((d) => d.id !== downloadId);
    this.saveDownloads(profileId, updated);
    return updated;
  },

  // Reviews
  getReviews(): Record<string, Review[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.REVIEWS);
      if (data) return JSON.parse(data);
    } catch {}
    return INITIAL_REVIEWS;
  },
  addReview(animeId: string, review: Review): Record<string, Review[]> {
    const reviews = this.getReviews();
    const currentForAnime = reviews[animeId] || [];
    const updated = {
      ...reviews,
      [animeId]: [review, ...currentForAnime],
    };
    localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(updated));
    return updated;
  },
};
