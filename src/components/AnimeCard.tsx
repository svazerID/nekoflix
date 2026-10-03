import React, { useState } from 'react';
import { Play, Plus, Check, ChevronDown, ThumbsUp, Star } from 'lucide-react';
import { Anime, WatchHistoryItem } from '../types/anime';

interface AnimeCardProps {
  anime: Anime;
  rank?: number;
  historyItem?: WatchHistoryItem;
  onPlay: (anime: Anime, episodeNumber?: number) => void;
  onOpenDetails: (anime: Anime) => void;
  isInWatchlist: boolean;
  onToggleWatchlist: (animeId: string) => void;
  isFavorite: boolean;
  onToggleFavorite: (animeId: string) => void;
}

export const AnimeCard: React.FC<AnimeCardProps> = ({
  anime,
  rank,
  historyItem,
  onPlay,
  onOpenDetails,
  isInWatchlist,
  onToggleWatchlist,
  isFavorite,
  onToggleFavorite,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const displayImage = historyItem ? (anime.bannerUrl || anime.posterUrl) : anime.posterUrl;
  const progressPercent = historyItem && historyItem.durationSeconds > 0
    ? Math.min(100, Math.round((historyItem.progressSeconds / historyItem.durationSeconds) * 100))
    : 0;

  return (
    <div
      className={`relative group shrink-0 transition-all duration-300 ${
        rank
          ? 'w-[200px] sm:w-[240px]'
          : historyItem
          ? 'w-[240px] sm:w-[280px]'
          : 'w-[150px] sm:w-[190px] md:w-[210px]'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center">
        {/* Giant Netflix-style Top 10 Number */}
        {rank !== undefined && (
          <div className="shrink-0 -mr-4 z-10 select-none">
            <span
              className="text-7xl sm:text-8xl font-display font-extrabold tracking-tighter"
              style={{
                WebkitTextStroke: '2px #737373',
                color: '#0a0a0a',
                textShadow: '0 4px 12px rgba(0,0,0,0.8)',
              }}
            >
              {rank}
            </span>
          </div>
        )}

        {/* Card Container */}
        <div
          onClick={() => onOpenDetails(anime)}
          className={`relative w-full cursor-pointer rounded-md overflow-hidden bg-neutral-900 border border-neutral-800/80 shadow-md transition-transform duration-300 group-hover:scale-[1.03] group-hover:border-neutral-600 ${
            historyItem ? 'aspect-video' : 'aspect-[2/3]'
          }`}
        >
          {!imageError ? (
            <img
              src={displayImage}
              alt={anime.title}
              onError={() => setImageError(true)}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center filter group-hover:brightness-110 transition-all duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col justify-end p-3 bg-gradient-to-br from-neutral-800 to-neutral-950 text-left">
              <span className="text-xs font-bold text-red-500 mb-1">{anime.studio}</span>
              <span className="text-sm font-semibold text-white line-clamp-2">{anime.title}</span>
            </div>
          )}

          {/* Scrim Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

          {/* Rating Badge */}
          <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-950/80 border border-neutral-700 text-[10px] font-bold text-amber-400">
            <Star className="w-2.5 h-2.5 fill-current" />
            <span className="tabular-nums">{anime.rating.toFixed(1)}</span>
          </div>

          {/* Continue Watching Progress Bar */}
          {historyItem && (
            <div className="absolute bottom-0 left-0 right-0 bg-neutral-950/90 p-2 border-t border-neutral-800">
              <div className="flex items-center justify-between text-[11px] text-neutral-300 mb-1">
                <span className="truncate font-medium">Ep {historyItem.episodeNumber}: {historyItem.episodeTitle}</span>
                <span className="text-neutral-400 shrink-0 font-mono text-[10px]">{progressPercent}%</span>
              </div>
              <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Title & Quick Metadata Underneath for Clean Scannability */}
      <div className="mt-2 text-left">
        <h4 className="text-xs sm:text-sm font-semibold text-neutral-200 truncate group-hover:text-white transition-colors">
          {anime.title}
        </h4>
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-medium mt-0.5">
          <span className="text-emerald-400 tabular-nums">{anime.matchPercentage || 95}% Cocok</span>
          <span aria-hidden="true">·</span>
          <span>{anime.year}</span>
          <span aria-hidden="true">·</span>
          <span>{anime.episodesCount} Ep</span>
        </div>
      </div>

      {/* Quick Action Floating Overlay on Card Hover (Desktop) */}
      {isHovered && (
        <div className="hidden sm:flex absolute bottom-8 left-2 right-2 z-20 items-center justify-between bg-neutral-950/95 border border-neutral-700/80 rounded-lg p-2 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay(anime, historyItem?.episodeNumber || 1);
              }}
              className="p-1.5 rounded-full bg-white text-black hover:bg-neutral-200 transition-colors shadow"
              title="Putar Sekarang"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleWatchlist(anime.id);
              }}
              className={`p-1.5 rounded-full border transition-colors ${
                isInWatchlist
                  ? 'bg-neutral-800 text-red-500 border-red-500'
                  : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:text-white'
              }`}
              title={isInWatchlist ? 'Hapus dari Watchlist' : 'Tambah ke Watchlist'}
            >
              {isInWatchlist ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(anime.id);
              }}
              className={`p-1.5 rounded-full border transition-colors ${
                isFavorite
                  ? 'bg-neutral-800 text-red-500 border-red-500'
                  : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:text-white'
              }`}
              title={isFavorite ? 'Disukai' : 'Suka'}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails(anime);
            }}
            className="p-1.5 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-700 hover:text-white transition-colors"
            title="Detail Selengkapnya"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
