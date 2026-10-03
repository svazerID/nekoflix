// Browse & search — server-side genre + search (no local sort/filter; data is as-is from source)
import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Anime } from '../types/anime';
import { nekoflixApi } from '../services/nekoflixApi';
import { AnimeCard } from './AnimeCard';

interface SearchAndBrowseProps {
  animes: Anime[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onPlay: (anime: Anime, episodeNumber?: number) => void;
  onOpenDetails: (anime: Anime) => void;
  watchlist: string[];
  onToggleWatchlist: (id: string) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}

// Genre OtakuDesu (otakudesu.blog/genre-list) — key = slug Inggris, value = label ID
export const GENRE_MAP: Record<string, string> = {
  action: 'Aksi', adventure: 'Petualangan', comedy: 'Komedi', drama: 'Drama',
  fantasy: 'Fantasi', mystery: 'Misteri', romance: 'Romansa', 'slice-of-life': 'Slice of Life',
  supernatural: 'Supernatural', horror: 'Horor', 'sci-fi': 'Sci-Fi', sports: 'Olahraga',
  ecchi: 'Ecchi', game: 'Game', harem: 'Harem', historical: 'Historis', josei: 'Josei',
  magic: 'Sihir', 'martial-arts': 'Beladiri', mecha: 'Mecha', military: 'Militer',
  music: 'Musik', parody: 'Parodi', police: 'Polisi', psychological: 'Psikologis',
  samurai: 'Samurai', school: 'Sekolah', seinen: 'Seinen', shoujo: 'Shoujo',
  'shoujo-ai': 'Shoujo Ai', shounen: 'Shounen', space: 'Luar Angkasa',
  demons: 'Iblis', 'super-power': 'Super Power', thriller: 'Thriller', vampire: 'Vampir',
};

const GENRES = ['Semua', ...Object.values(GENRE_MAP)];

// worker route: /api/od/genre/:genreSlug — server-side genre filter, page by page
async function fetchGenre(genreSlug: string, page: number): Promise<{ animes: Anime[]; hasNext: boolean }> {
  const cards = await nekoflixApi.genreCards(genreSlug, page);
  const details = await Promise.all(
    cards.map((c: any) => nekoflixApi.getAnime(c.slug).catch(() => null))
  );
  return {
    animes: details.filter(Boolean) as Anime[],
    hasNext: cards.length >= 15, // full page = likely more pages at the source
  };
}

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
  // server-side search for titles outside the loaded catalog (katalog = 24 terbaru saja)
  const [remoteAnimes, setRemoteAnimes] = useState<Anime[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [genreAnimes, setGenreAnimes] = useState<Anime[]>([]);
  const [genreLoading, setGenreLoading] = useState(false);
  const [genrePage, setGenrePage] = useState(1);
  const [genreHasNext, setGenreHasNext] = useState(false);

  const query = searchQuery.trim();
  useEffect(() => {
    if (query.length < 3) { setRemoteAnimes([]); setRemoteLoading(false); return; }
    const localHit = animes.some((a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      (a.japaneseTitle && a.japaneseTitle.toLowerCase().includes(query.toLowerCase()))
    );
    if (localHit) { setRemoteAnimes([]); setRemoteLoading(false); return; }
    let cancelled = false;
    setRemoteLoading(true);
    const t = window.setTimeout(() => {
      nekoflixApi.searchRemote(query)
        .then((res) => { if (!cancelled) { setRemoteAnimes(res); setRemoteLoading(false); } })
        .catch(() => { if (!cancelled) { setRemoteAnimes([]); setRemoteLoading(false); } });
    }, 500); // debounce
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [query, animes]);

  // genre = server-side fetch (katalog lokal cuma 24 judul terbaru, tidak mewakili genre penuh)
  useEffect(() => {
    if (selectedGenre === 'Semua') { setGenreAnimes([]); setGenreLoading(false); setGenrePage(1); setGenreHasNext(false); return; }
    const slug = Object.keys(GENRE_MAP).find((k) => GENRE_MAP[k] === selectedGenre) || selectedGenre;
    let cancelled = false;
    setGenreLoading(true);
    setGenreAnimes([]);
    setGenrePage(1);
    fetchGenre(slug, 1)
      .then((res) => { if (!cancelled) { setGenreAnimes(res.animes); setGenreHasNext(res.hasNext); setGenreLoading(false); } })
      .catch(() => { if (!cancelled) { setGenreAnimes([]); setGenreLoading(false); } });
    return () => { cancelled = true; };
  }, [selectedGenre]);

  const loadMoreGenre = () => {
    const slug = Object.keys(GENRE_MAP).find((k) => GENRE_MAP[k] === selectedGenre) || selectedGenre;
    const next = genrePage + 1;
    setGenrePage(next);
    setGenreLoading(true);
    fetchGenre(slug, next)
      .then((res) => {
        setGenreAnimes((prev) => {
          const seen = new Set(prev.map((a) => a.id));
          return [...prev, ...res.animes.filter((a) => !seen.has(a.id))];
        });
        setGenreHasNext(res.hasNext);
        setGenreLoading(false);
      })
      .catch(() => setGenreLoading(false));
  };

  const visible = useMemo(() => {
    // genre aktif = hasil server murni (tanpa sort/filter lokal)
    if (selectedGenre !== 'Semua') return genreAnimes;
    // pencarian: gabung katalog + hasil server, urutan asli
    if (query.length >= 3) {
      const seen = new Set<string>();
      return [...animes, ...remoteAnimes].filter((a) => !seen.has(a.id) && seen.add(a.id));
    }
    return animes;
  }, [selectedGenre, genreAnimes, query, animes, remoteAnimes]);

  const loading = selectedGenre !== 'Semua' ? genreLoading : remoteLoading;

  return (
    <div className="min-h-screen pt-28 sm:pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Title */}
      <div className="border-b border-neutral-800 pb-4">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Jelajahi & Cari Anime
        </h2>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
          Telusuri berdasarkan genre atau cari judul — data langsung dari sumber
        </p>
      </div>

      {/* Genre tabs */}
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

      {/* Reset */}
      {(searchQuery || selectedGenre !== 'Semua') && (
        <div className="flex justify-end">
          <button
            onClick={() => { setSearchQuery(''); setSelectedGenre('Semua'); }}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      )}

      {/* Results Count Banner */}
      <div className="text-xs text-neutral-400 font-mono tabular-nums flex items-center gap-2">
        Menampilkan {visible.length} tayangan
        {searchQuery ? ` untuk "${searchQuery}"` : ''}
        {selectedGenre !== 'Semua' ? ` · genre ${selectedGenre}` : ''}
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />}
      </div>

      {/* Grid of Results */}
      {visible.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {visible.map((anime) => (
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
          {selectedGenre !== 'Semua' && genreHasNext && (
            <div className="flex justify-center">
              <button
                onClick={loadMoreGenre}
                disabled={genreLoading}
                className="px-6 py-2.5 bg-neutral-900 border border-neutral-700 hover:border-neutral-500 disabled:opacity-50 text-sm font-bold text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {genreLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Muat Lagi
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="py-20 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-neutral-900 flex items-center justify-center text-neutral-500">
            <Search className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-white">
            {loading ? 'Memuat dari server…' : 'Tidak ada anime yang cocok'}
          </h4>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            {loading
              ? 'Hasil dari server akan muncul di sini.'
              : 'Coba kata kunci lain atau pilih genre yang berbeda.'}
          </p>
        </div>
      )}
    </div>
  );
};
