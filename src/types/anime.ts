export interface EpisodeMirror {
  name: string;
  url: string;
  kind: 'embed' | 'hls' | 'mp4';
}

export interface Episode {
  id: string;
  animeId: string;
  episodeNumber: number;
  title: string;
  synopsis: string;
  thumbnailUrl: string;
  duration: string;
  durationSeconds: number;
  videoUrl: string;
  /** Mirrors resolved for this episode (populated on play, not stored). */
  mirrors?: EpisodeMirror[];
  introStart?: number;
  introEnd?: number;
  subtitles?: {
    lang: string;
    label: string;
    cues?: { start: number; end: number; text: string }[];
  }[];
}

export interface Review {
  id: string;
  animeId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  comment: string;
  date: string;
}

export interface Anime {
  id: string;
  title: string;
  japaneseTitle?: string;
  description: string;
  posterUrl: string;
  bannerUrl: string;
  trailerUrl?: string;
  genres: string[];
  rating: number;
  scoreCount: number;
  year: number;
  season: string;
  studio: string;
  status: 'Ongoing' | 'Tamat';
  episodesCount: number;
  episodes: Episode[];
  ageRating: '13+' | '16+' | '18+' | 'Semua Umur';
  quality: '4K Ultra HD' | '1080p Full HD' | '720p HD';
  audioLanguages: string[];
  subtitleLanguages: string[];
  rankTop10?: number;
  featured?: boolean;
  matchPercentage?: number;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  isKids?: boolean;
}

export interface WatchHistoryItem {
  animeId: string;
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
  progressSeconds: number;
  durationSeconds: number;
  lastWatchedAt: number;
}

export interface DownloadItem {
  id: string;
  animeId: string;
  animeTitle: string;
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
  thumbnailUrl: string;
  fileSizeMb: number;
  status: 'downloading' | 'completed';
  progress: number;
  downloadedAt: number;
}
