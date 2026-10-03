import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Anime, WatchHistoryItem } from '../types/anime';
import { AnimeCard } from './AnimeCard';

interface AnimeRowProps {
  title: string;
  subtitle?: string;
  animes: Anime[];
  isTop10?: boolean;
  historyItems?: WatchHistoryItem[];
  onPlay: (anime: Anime, episodeNumber?: number) => void;
  onOpenDetails: (anime: Anime) => void;
  watchlist: string[];
  onToggleWatchlist: (animeId: string) => void;
  favorites: string[];
  onToggleFavorite: (animeId: string) => void;
}

export const AnimeRow: React.FC<AnimeRowProps> = ({
  title,
  subtitle,
  animes,
  isTop10 = false,
  historyItems,
  onPlay,
  onOpenDetails,
  watchlist,
  onToggleWatchlist,
  favorites,
  onToggleFavorite,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (rowRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  const handleScroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { clientWidth } = rowRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
      rowRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(checkScroll, 350);
    }
  };

  if (!animes || animes.length === 0) return null;

  return (
    <section className="relative px-4 sm:px-6 lg:px-8 py-4 sm:py-6 group/row">
      {/* Row Header */}
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white hover:text-red-400 transition-colors cursor-pointer">
            {title}
          </h3>
          {subtitle && (
            <span className="text-xs text-neutral-400 font-normal hidden sm:inline">
              {subtitle}
            </span>
          )}
        </div>
        <span className="text-xs text-neutral-500 font-mono tabular-nums">
          {animes.length} Judul
        </span>
      </div>

      {/* Row Scroll Container */}
      <div className="relative">
        {/* Left Arrow Button */}
        {canScrollLeft && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-0 top-0 bottom-8 z-30 w-10 sm:w-12 bg-neutral-950/80 hover:bg-neutral-950/95 flex items-center justify-center text-white border-r border-neutral-800 transition-all opacity-0 group-hover/row:opacity-100 backdrop-blur-sm"
            aria-label="Gulir ke kiri"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Anime Cards Container */}
        <div
          ref={rowRef}
          onScroll={checkScroll}
          className="flex items-start gap-3 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1"
        >
          {animes.map((anime, index) => {
            const historyItem = historyItems?.find((h) => h.animeId === anime.id);
            return (
              <AnimeCard
                key={`${anime.id}-${index}`}
                anime={anime}
                rank={isTop10 ? index + 1 : undefined}
                historyItem={historyItem}
                onPlay={onPlay}
                onOpenDetails={onOpenDetails}
                isInWatchlist={watchlist.includes(anime.id)}
                onToggleWatchlist={onToggleWatchlist}
                isFavorite={favorites.includes(anime.id)}
                onToggleFavorite={onToggleFavorite}
              />
            );
          })}
        </div>

        {/* Right Arrow Button */}
        {canScrollRight && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-0 top-0 bottom-8 z-30 w-10 sm:w-12 bg-neutral-950/80 hover:bg-neutral-950/95 flex items-center justify-center text-white border-l border-neutral-800 transition-all opacity-0 group-hover/row:opacity-100 backdrop-blur-sm"
            aria-label="Gulir ke kanan"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>
    </section>
  );
};
