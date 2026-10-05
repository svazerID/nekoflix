import React, { useState } from 'react';
import { Bookmark, Heart, History, Download, Play, Trash2, ArrowRight, X } from 'lucide-react';
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
  onRemoveHistory: (animeId: string, episodeId: string) => void;
  onClearHistory: () => void;
  onResumeById: (animeId: string, episodeNumber: number) => void;
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
  onRemoveHistory,
  onClearHistory,
  onResumeById,
  onNavigateHome,
}) => {
  const [activeTab, setActiveTab] = useState<'watchlist' | 'favorites' | 'history' | 'downloads'>('watchlist');

  const watchlistAnimes = allAnimes.filter((a) => watchlistIds.includes(a.id));
  const favoriteAnimes = allAnimes.filter((a) => favoriteIds.includes(a.id));

  const relTime = (ts: number) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins} menit lalu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} jam lalu`;
    return `${Math.floor(hrs / 24)} hari lalu`;
  };

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
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-neutral-400">
                  {watchHistory.length} episode · tersimpan otomatis saat kamu menonton
                </p>
                <button
                  onClick={onClearHistory}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-red-500/60 text-neutral-300 hover:text-red-400 rounded text-xs font-semibold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Semua</span>
                </button>
              </div>
              <div className="divide-y divide-neutral-800">
                {watchHistory.map((item) => {
                  const anime = allAnimes.find((a) => a.id === item.animeId);
                  const title = anime?.title || item.animeTitle || 'Judul tidak dikenal';
                  const poster = anime?.bannerUrl || anime?.posterUrl || item.posterUrl || '';
                  const progressPercent = item.durationSeconds > 0
                    ? Math.min(100, Math.round((item.progressSeconds / item.durationSeconds) * 100))
                    : 0;
                  const playable = !!anime;

                  return (
                    <div
                      key={`${item.animeId}-${item.episodeId}`}
                      className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Thumbnail with progress */}
                        <div
                          onClick={() => playable && onPlay(anime!, item.episodeNumber)}
                          className={`relative w-36 sm:w-44 aspect-video rounded-md overflow-hidden bg-neutral-900 shrink-0 shadow group-hover:ring-1 group-hover:ring-red-500 transition-all ${playable ? 'cursor-pointer' : ''}`}
                        >
                          {poster ? (
                            <img
                              src={poster}
                              alt={title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-700">
                              <History className="w-6 h-6" />
                            </div>
                          )}
                          {playable && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="w-8 h-8 text-white fill-current" />
                            </div>
                          )}
                          {/* Progress bar on thumbnail */}
                          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-neutral-800">
                            <div
                              className="h-full bg-red-600"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Info */}
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4
                              onClick={() => playable && onPlay(anime!, item.episodeNumber)}
                              className={`text-sm sm:text-base font-bold text-white transition-colors truncate ${playable ? 'hover:text-red-400 cursor-pointer' : ''}`}
                            >
                              {title}
                            </h4>
                            {!playable && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500 shrink-0">
                                di luar katalog
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-neutral-400 truncate">
                            Episode {item.episodeNumber}
                            {item.episodeTitle ? `: ${item.episodeTitle}` : ''}
                          </div>
                          <div className="text-[11px] text-neutral-500 font-mono">
                            {item.durationSeconds > 0
                              ? `Tersisa ${Math.max(0, Math.floor((item.durationSeconds - item.progressSeconds) / 60))} menit lagi (${progressPercent}% selesai)`
                              : `${Math.floor(item.progressSeconds / 60)} menit ditonton`}
                          </div>
                          <div className="text-[10px] text-neutral-600">{relTime(item.lastWatchedAt)}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {playable ? (
                          <button
                            onClick={() => onPlay(anime!, item.episodeNumber)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs font-semibold transition-colors"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Lanjutkan</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onResumeById(item.animeId, item.episodeNumber)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs font-semibold transition-colors"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Buka</span>
                          </button>
                        )}
                        <button
                          onClick={() => onRemoveHistory(item.animeId, item.episodeId)}
                          className="p-2 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
                          title="Hapus dari riwayat"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
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
