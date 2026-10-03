import React, { useState, useMemo } from 'react';
import { Search, Filter, SlidersHorizontal, ArrowUpDown, X } from 'lucide-react';
import { Anime } from '../types/anime';
import { AnimeCard } from './AnimeCard';

interface SearchAndBrowseProps {
  animes: Anime[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onPlay: (anime: Anime, ep?: number) => void;
  onOpenDetails: (anime: Anime) => void;
  watchlist: string[];
  onToggleWatchlist: (id: string) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}

const GENRES = [
  'Semua',
  'Aksi',
  'Fantasi',
  'Supernatural',
  'Sci-Fi',
  'Komedi',
  'Drama',
  'Petualangan',
  'Slice of Life',
  'Misteri',
];

export const SearchAndBrowse: React.FC<SearchAndBrowseProps> = ({
  animes,
  searchQuery,
  setSearchQuery,
  onPlay,
  onOpenDetails,
  watchlist,
  onToggleWatchlist,
  favorites,
  onToggleFavorite,
}) => {
  const [selectedGenre, setSelectedGenre] = useState('Semua');
  const [selectedStatus, setSelectedStatus] = useState<'All' | 'Ongoing' | 'Tamat'>('All');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'newest' | 'title'>('popular');

  const filteredAnimes = useMemo(() => {
    return animes
      .filter((anime) => {
        // Query match
        const matchesQuery =
          !searchQuery.trim() ||
          anime.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          anime.studio.toLowerCase().includes(searchQuery.toLowerCase()) ||
          anime.genres.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (anime.japaneseTitle && anime.japaneseTitle.toLowerCase().includes(searchQuery.toLowerCase()));

        // Genre match
        const matchesGenre =
          selectedGenre === 'Semua' || anime.genres.includes(selectedGenre);

        // Status match
        const matchesStatus =
          selectedStatus === 'All' || anime.status === selectedStatus;

        return matchesQuery && matchesGenre && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'rating') return b.rating - a.rating;
        if (sortBy === 'newest') return b.year - a.year;
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        return b.scoreCount - a.scoreCount; // Popular
      });
  }, [animes, searchQuery, selectedGenre, selectedStatus, sortBy]);

  return (
    <div className="min-h-screen pt-28 sm:pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Jelajahi & Cari Anime
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Temukan lebih dari {animes.length} serial & film anime terpopuler
          </p>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <ArrowUpDown className="w-4 h-4 text-neutral-400" />
          <span className="text-xs text-neutral-400">Urutkan:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-neutral-900 border border-neutral-700 text-xs text-neutral-200 rounded px-3 py-1.5 focus:outline-none focus:border-red-500"
          >
            <option value="popular">Paling Populer</option>
            <option value="rating">Rating Tertinggi</option>
            <option value="newest">Rilis Terbaru</option>
            <option value="title">Judul (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="space-y-4">
        {/* Interactive Genre Segmented Tabs (Compliant with frontend-design constitution) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {GENRES.map((genre) => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                selectedGenre === genre
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-neutral-800'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>

        {/* Secondary Filters: Status & Clear */}
        <div className="flex items-center justify-between flex-wrap gap-3 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span>Status:</span>
            {(['All', 'Ongoing', 'Tamat'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  selectedStatus === st
                    ? 'bg-neutral-800 text-white font-bold border border-neutral-700'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {st === 'All' ? 'Semua' : st}
              </button>
            ))}
          </div>

          {(searchQuery || selectedGenre !== 'Semua' || selectedStatus !== 'All') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedGenre('Semua');
                setSelectedStatus('All');
              }}
              className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      </div>

      {/* Results Count Banner */}
      <div className="text-xs text-neutral-400 font-mono tabular-nums">
        Menampilkan {filteredAnimes.length} tayangan {searchQuery ? `untuk "${searchQuery}"` : ''}
      </div>

      {/* Grid of Results */}
      {filteredAnimes.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredAnimes.map((anime) => (
            <AnimeCard
              key={anime.id}
              anime={anime}
              onPlay={onPlay}
              onOpenDetails={onOpenDetails}
              isInWatchlist={watchlist.includes(anime.id)}
              onToggleWatchlist={onToggleWatchlist}
              isFavorite={favorites.includes(anime.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-neutral-900 flex items-center justify-center text-neutral-500">
            <Search className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-white">Tidak ada anime yang cocok</h4>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Coba gunakan kata kunci yang lebih umum atau atur ulang filter genre di atas.
          </p>
        </div>
      )}
    </div>
  );
};
