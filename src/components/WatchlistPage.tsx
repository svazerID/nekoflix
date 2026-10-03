import React, { useState } from 'react';
import { Bookmark, Heart, History, Download, Play, Trash2, ArrowRight } from 'lucide-react';
import { Anime, DownloadItem, WatchHistoryItem } from '../types/anime';
import { AnimeCard } from './AnimeCard';

interface WatchlistPageProps {
  allAnimes: Anime[];
  watchlistIds: string[];
  favoriteIds: string[];
  watchHistory: WatchHistoryItem[];
  downloads: DownloadItem[];
  onPlay: (anime: Anime, ep?: number) => void;
  onOpenDetails: (anime: Anime) => void;
  onToggleWatchlist: (animeId: string) => void;
  onToggleFavorite: (animeId: string) => void;
  onRemoveDownload: (id: string) => void;
  onNavigateHome: () => void;
}

export const WatchlistPage: React.FC<WatchlistPageProps> = ({
  allAnimes,
  watchlistIds,
  favoriteIds,
  watchHistory,
  downloads,
  onPlay,
  onOpenDetails,
  onToggleWatchlist,
  onToggleFavorite,
  onRemoveDownload,
  onNavigateHome,
}) => {
  const [activeTab, setActiveTab] = useState<'watchlist' | 'favorites' | 'history' | 'downloads'>('watchlist');

  const watchlistAnimes = allAnimes.filter((a) => watchlistIds.includes(a.id));
  const favoriteAnimes = allAnimes.filter((a) => favoriteIds.includes(a.id));

  return (
    <div className="min-h-screen pt-28 sm:pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Page Title */}
      <div className="border-b border-neutral-800 pb-4">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Koleksi & Riwayat Tontonan
        </h2>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
          Akses tayangan yang kamu simpan, favoritkan, dan lanjutkan menonton kapan saja
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-neutral-800/80 pb-2">
        <button
          onClick={() => setActiveTab('watchlist')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
            activeTab === 'watchlist'
              ? 'bg-red-600 text-white shadow'
              : 'bg-neutral-900 text-neutral-400 hover:text-white'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          <span>Daftar Saya ({watchlistAnimes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
            activeTab === 'favorites'
              ? 'bg-red-600 text-white shadow'
              : 'bg-neutral-900 text-neutral-400 hover:text-white'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>Favorit ({favoriteAnimes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
            activeTab === 'history'
              ? 'bg-red-600 text-white shadow'
              : 'bg-neutral-900 text-neutral-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Lanjutkan Menonton ({watchHistory.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('downloads')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
            activeTab === 'downloads'
              ? 'bg-red-600 text-white shadow'
              : 'bg-neutral-900 text-neutral-400 hover:text-white'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Unduhan Offline ({downloads.length})</span>
        </button>
      </div>

      {/* Tab 1: Watchlist */}
      {activeTab === 'watchlist' && (
        <div>
          {watchlistAnimes.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {watchlistAnimes.map((anime) => (
                <AnimeCard
                  key={anime.id}
                  anime={anime}
                  onPlay={onPlay}
                  onOpenDetails={onOpenDetails}
                  isInWatchlist={true}
                  onToggleWatchlist={onToggleWatchlist}
                  isFavorite={favoriteIds.includes(anime.id)}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center space-y-3">
              <Bookmark className="w-12 h-12 mx-auto text-neutral-600" />
              <h4 className="text-base font-bold text-white">Daftar Tontonan Masih Kosong</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Tambahkan anime favorit kamu dengan menekan ikon (+) pada kartu tayangan untuk menyimpannya di sini.
              </p>
              <button
                onClick={onNavigateHome}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors"
              >
                <span>Jelajahi Beranda</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Favorites */}
      {activeTab === 'favorites' && (
        <div>
          {favoriteAnimes.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {favoriteAnimes.map((anime) => (
                <AnimeCard
                  key={anime.id}
                  anime={anime}
                  onPlay={onPlay}
                  onOpenDetails={onOpenDetails}
                  isInWatchlist={watchlistIds.includes(anime.id)}
                  onToggleWatchlist={onToggleWatchlist}
                  isFavorite={true}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center space-y-3">
              <Heart className="w-12 h-12 mx-auto text-neutral-600" />
              <h4 className="text-base font-bold text-white">Belum Ada Anime Favorit</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Beri tanda suka pada anime yang paling kamu gemari agar mudah diakses kembali.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: History (Continue Watching) */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {watchHistory.length > 0 ? (
            <div className="divide-y divide-neutral-800">
              {watchHistory.map((item) => {
                const anime = allAnimes.find((a) => a.id === item.animeId);
                if (!anime) return null;
                const progressPercent = item.durationSeconds > 0
                  ? Math.min(100, Math.round((item.progressSeconds / item.durationSeconds) * 100))
                  : 0;

                return (
                  <div
                    key={`${item.animeId}-${item.episodeId}`}
                    className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* Thumbnail with progress */}
                      <div
                        onClick={() => onPlay(anime, item.episodeNumber)}
                        className="relative w-36 sm:w-44 aspect-video rounded-md overflow-hidden bg-neutral-900 shrink-0 cursor-pointer shadow group-hover:ring-1 group-hover:ring-red-500 transition-all"
                      >
                        <img
                          src={anime.bannerUrl || anime.posterUrl}
                          alt={anime.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-8 h-8 text-white fill-current" />
                        </div>
                        {/* Progress bar on thumbnail */}
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-neutral-800">
                          <div
                            className="h-full bg-red-600"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="space-y-1">
                        <h4
                          onClick={() => onPlay(anime, item.episodeNumber)}
                          className="text-sm sm:text-base font-bold text-white hover:text-red-400 cursor-pointer transition-colors"
                        >
                          {anime.title}
                        </h4>
                        <div className="text-xs text-neutral-400">
                          Episode {item.episodeNumber}: {item.episodeTitle}
                        </div>
                        <div className="text-[11px] text-neutral-500 font-mono">
                          Tersisa {Math.max(0, Math.floor((item.durationSeconds - item.progressSeconds) / 60))} menit lagi ({progressPercent}% selesai)
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onPlay(anime, item.episodeNumber)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs font-semibold transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Lanjutkan</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center space-y-3">
              <History className="w-12 h-12 mx-auto text-neutral-600" />
              <h4 className="text-base font-bold text-white">Belum Ada Riwayat Tontonan</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Mulai putar salah satu episode anime untuk melacak progres penontonanmu secara otomatis.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Downloads */}
      {activeTab === 'downloads' && (
        <div className="space-y-4">
          {downloads.length > 0 ? (
            <div className="divide-y divide-neutral-800">
              {downloads.map((dl) => {
                const anime = allAnimes.find((a) => a.id === dl.animeId);
                return (
                  <div
                    key={dl.id}
                    className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={dl.thumbnailUrl}
                        alt={dl.animeTitle}
                        referrerPolicy="no-referrer"
                        className="w-28 sm:w-32 aspect-video object-cover rounded bg-neutral-900"
                      />
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-white">{dl.animeTitle}</h4>
                        <div className="text-xs text-neutral-300">
                          Episode {dl.episodeNumber}: {dl.episodeTitle}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-medium">
                          Tersimpan Offline · {dl.fileSizeMb} MB · 1080p
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {anime && (
                        <button
                          onClick={() => onPlay(anime, dl.episodeNumber)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-neutral-200 rounded text-xs font-bold transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Tonton Offline</span>
                        </button>
                      )}
                      <button
                        onClick={() => onRemoveDownload(dl.id)}
                        className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
                        title="Hapus Unduhan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center space-y-3">
              <Download className="w-12 h-12 mx-auto text-neutral-600" />
              <h4 className="text-base font-bold text-white">Tidak Ada Episode yang Diunduh</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Kamu dapat mengunduh episode anime di halaman detail untuk ditonton tanpa kuota internet saat bepergian.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
