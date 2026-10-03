import React from 'react';
import { Play, Info, Plus, Check, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { Anime } from '../types/anime';

interface HeroBannerProps {
  anime: Anime;
  onPlay: (anime: Anime) => void;
  onOpenDetails: (anime: Anime) => void;
  isInWatchlist: boolean;
  onToggleWatchlist: (animeId: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  anime,
  onPlay,
  onOpenDetails,
  isInWatchlist,
  onToggleWatchlist,
  isMuted,
  onToggleMute,
}) => {
  return (
    <section className="relative w-full h-[75vh] min-h-[520px] max-h-[780px] overflow-hidden select-none">
      {/* Background Banner Image with Resilient Scrim */}
      <div className="absolute inset-0">
        <img
          src={anime.bannerUrl}
          alt={anime.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center filter brightness-95 contrast-105"
        />
        {/* Measured Horizontal & Vertical Scrim Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/95 via-neutral-950/60 to-transparent w-full md:w-3/4" />
      </div>

      {/* Hero Content Container */}
      <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-16 sm:pb-24 pt-32">
        <div className="max-w-2xl space-y-4">
          {/* Top Kicker: Top 10 Ranking */}
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
            <span className="text-red-600 font-display text-lg tracking-wider">TOP 10</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              #Populer
            </span>
          </div>

          {/* Marquee Title */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white drop-shadow-md text-balance">
            {anime.title}
          </h1>

          {/* Clean Unboxed Metadata with Typographic Separators */}
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-neutral-300 font-medium">
            <span className="text-emerald-400 font-bold tabular-nums">{anime.rating.toFixed(1)} ★</span>
            <span aria-hidden="true" className="text-neutral-500">·</span>
            <span className="text-neutral-200">{anime.year}</span>
            <span aria-hidden="true" className="text-neutral-500">·</span>
            <span className="text-neutral-200 border border-neutral-600 px-1 py-0.5 rounded text-[11px] leading-none">
              {anime.ageRating}
            </span>
            <span aria-hidden="true" className="text-neutral-500">·</span>
            <span className="text-neutral-200">{anime.episodesCount} Episode</span>
            <span aria-hidden="true" className="text-neutral-500">·</span>
            <span className="text-neutral-300 border border-neutral-700 px-1 py-0.5 rounded text-[11px] leading-none">
              {anime.quality}
            </span>
            <span aria-hidden="true" className="text-neutral-500">·</span>
            <span className="text-neutral-400">{anime.studio}</span>
          </div>

          {/* Synopsis Excerpt */}
          <p className="text-sm sm:text-base text-neutral-300 line-clamp-3 leading-relaxed max-w-xl">
            {anime.description}
          </p>

          {/* Interactive CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onPlay(anime)}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-neutral-950 font-bold rounded-md hover:bg-neutral-200 transition-all transform active:scale-95 shadow-lg whitespace-nowrap text-sm"
              aria-label={`Putar ${anime.title}`}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Putar Episode 1</span>
            </button>

            <button
              onClick={() => onOpenDetails(anime)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-800/80 hover:bg-neutral-700/80 text-white font-semibold rounded-md backdrop-blur-sm transition-all whitespace-nowrap text-sm border border-neutral-700/60"
              aria-label={`Info selengkapnya tentang ${anime.title}`}
            >
              <Info className="w-5 h-5 text-neutral-300" />
              <span>Info Selengkapnya</span>
            </button>

            <button
              onClick={() => onToggleWatchlist(anime.id)}
              className={`p-2.5 rounded-full border transition-all text-sm ${
                isInWatchlist
                  ? 'bg-neutral-800 text-red-500 border-red-500/60'
                  : 'bg-neutral-900/60 hover:bg-neutral-800 text-white border-neutral-700'
              }`}
              title={isInWatchlist ? 'Hapus dari Daftar Saya' : 'Tambah ke Daftar Saya'}
              aria-label="Toggle Watchlist"
            >
              {isInWatchlist ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Ambient Sound Toggle & Age Rating Pill on Right */}
        <div className="absolute right-4 sm:right-8 bottom-16 sm:bottom-24 flex items-center gap-3">
          <button
            onClick={onToggleMute}
            className="p-2.5 rounded-full bg-neutral-900/70 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 transition-colors"
            title={isMuted ? 'Nyalakan Audio Pratinjau' : 'Matikan Audio Pratinjau'}
            aria-label="Toggle Sound"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="hidden sm:block border-l-2 border-neutral-400 pl-3 py-0.5 text-xs font-semibold text-neutral-300 bg-neutral-900/40 pr-3">
            {anime.ageRating}
          </div>
        </div>
      </div>
    </section>
  );
};
