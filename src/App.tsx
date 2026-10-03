import React, { useState, useEffect, useMemo } from 'react';
import { Anime, DownloadItem, Episode, UserProfile, WatchHistoryItem } from './types/anime';
import { storageService } from './services/storageService';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { AnimeRow } from './components/AnimeRow';
import { AnimeDetailPage } from './components/AnimeDetailPage';
import { VideoPlayerPage } from './components/VideoPlayerPage';
import { SearchAndBrowse } from './components/SearchAndBrowse';
import { SchedulePage } from './components/SchedulePage';
import { WatchlistPage } from './components/WatchlistPage';
import { Footer } from './components/Footer';
import { nekoflixApi } from './services/nekoflixApi';

export default function App() {
  // App state — starts from cached/sample data, replaced by live scrape once loaded
  const [animes, setAnimes] = useState<Anime[]>(() => storageService.getAnimes());
  const [liveLoaded, setLiveLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    nekoflixApi.getCatalog()
      .then((live) => {
        if (!cancelled && live.length) {
          setAnimes(live);
          storageService.saveAnimes(live);
          setLiveLoaded(true);
        }
      })
      .catch((e) => console.warn('Katalog live gagal, memakai data cache/sample:', e));
    return () => { cancelled = true; };
  }, []);
  const [activeProfile, setActiveProfile] = useState<UserProfile>(() => storageService.getActiveProfile());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDark, setIsDark] = useState<boolean>(() => storageService.getTheme() === 'dark');
  const [isMuted, setIsMuted] = useState<boolean>(() => storageService.getSoundMuted());

  // URL Hash Route State
  // Format:
  // - '#/'
  // - '#/series'
  // - '#/movies'
  // - '#/popular'
  // - '#/watchlist'
  // - '#/browse'
  // - '#/anime/:id'
  // - '#/watch/:id/:ep'
  const [currentHash, setCurrentHash] = useState<string>(() => window.location.hash || '#/');

  // Listen to hash changes (browser back/forward & direct links)
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || '#/');
      window.scrollTo({ top: 0, behavior: 'instant' });
    };

    window.addEventListener('hashchange', handleHashChange);
    if (!window.location.hash) {
      window.location.hash = '#/';
    }
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (hash: string) => {
    window.location.hash = hash;
  };

  // User list state for active profile
  const [watchlist, setWatchlist] = useState<string[]>(() => storageService.getWatchlist(activeProfile.id));
  const [favorites, setFavorites] = useState<string[]>(() => storageService.getFavorites(activeProfile.id));
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>(() => storageService.getWatchHistory(activeProfile.id));
  const [downloads, setDownloads] = useState<DownloadItem[]>(() => storageService.getDownloads(activeProfile.id));

  // Secondary modals
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync profile changes
  const handleProfileChange = (profile: UserProfile) => {
    setActiveProfile(profile);
    storageService.setActiveProfile(profile);
    setWatchlist(storageService.getWatchlist(profile.id));
    setFavorites(storageService.getFavorites(profile.id));
    setWatchHistory(storageService.getWatchHistory(profile.id));
    setDownloads(storageService.getDownloads(profile.id));
    showToast(`Beralih ke profil ${profile.name}`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    storageService.setTheme(next);
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    storageService.setSoundMuted(next);
  };

  const handleToggleWatchlist = (animeId: string) => {
    const updated = storageService.toggleWatchlist(activeProfile.id, animeId);
    setWatchlist(updated);
    const added = updated.includes(animeId);
    showToast(added ? 'Ditambahkan ke Daftar Tontonan' : 'Dihapus dari Daftar Tontonan');
  };

  const handleToggleFavorite = (animeId: string) => {
    const updated = storageService.toggleFavorite(activeProfile.id, animeId);
    setFavorites(updated);
    const added = updated.includes(animeId);
    showToast(added ? 'Ditambahkan ke Favorit' : 'Dihapus dari Favorit');
  };

  // Dedicated URL Navigation Handlers
  const handlePlayAnime = (anime: Anime, episodeNumber: number = 1) => {
    navigateTo(`#/watch/${anime.id}/${episodeNumber}`);
  };

  const handleOpenDetails = (anime: Anime) => {
    navigateTo(`#/anime/${anime.id}`);
  };

  const handleStartDownload = (anime: Anime, episode: Episode) => {
    const updated = storageService.startDownload(activeProfile.id, anime, episode);
    setDownloads(updated);
    showToast(`Mengunduh ${anime.title} Episode ${episode.episodeNumber} (${episode.duration})...`);

    setTimeout(() => {
      const finished = updated.map((d) =>
        d.episodeId === episode.id ? { ...d, status: 'completed' as const, progress: 100 } : d
      );
      storageService.saveDownloads(activeProfile.id, finished);
      setDownloads(finished);
      showToast(`Selesai mengunduh ${anime.title} Episode ${episode.episodeNumber}!`);
    }, 3500);
  };

  const handleRemoveDownload = (downloadId: string) => {
    const updated = storageService.removeDownload(activeProfile.id, downloadId);
    setDownloads(updated);
    showToast('Berkas unduhan dihapus');
  };

  // Parse Current Route
  const route = useMemo(() => {
    const hash = currentHash.replace(/^#\/?/, '');
    const parts = hash.split('/');

    if (parts[0] === 'watch' && parts[1]) {
      return {
        type: 'watch',
        animeId: parts[1],
        episodeNumber: parseInt(parts[2] || '1', 10),
      };
    }
    if (parts[0] === 'anime' && parts[1]) {
      return {
        type: 'anime',
        animeId: parts[1],
      };
    }
    if (parts[0] === 'series') return { type: 'series' };
    if (parts[0] === 'movies') return { type: 'movies' };
    if (parts[0] === 'popular') return { type: 'popular' };
    if (parts[0] === 'watchlist') return { type: 'watchlist' };
    if (parts[0] === 'browse') return { type: 'browse' };
    if (parts[0] === 'jadwal') return { type: 'jadwal' };
    return { type: 'home' };
  }, [currentHash]);

  // Find targeted anime if in detail or watch route
  const currentAnime = useMemo(() => {
    if (route.type === 'anime' || route.type === 'watch') {
      return animes.find((a) => a.id === route.animeId) || animes[0];
    }
    return null;
  }, [route, animes]);

  // Featured Marquee Anime (Solo Leveling) — falls back to first live item
  const featuredAnime = useMemo(() => {
    return liveLoaded
      ? animes.find((a) => a.featured) || animes[0]
      : animes.find((a) => a.featured) || animes.find((a) => a.rankTop10 === 1) || animes[0];
  }, [animes, liveLoaded]);

  // Rows Data
  const top10Animes = useMemo(() => {
    return [...animes].sort((a, b) => (a.rankTop10 || 99) - (b.rankTop10 || 99)).slice(0, 10);
  }, [animes]);

  const trendingAnimes = useMemo(() => {
    return [...animes].sort((a, b) => b.scoreCount - a.scoreCount);
  }, [animes]);

  const actionAnimes = useMemo(() => {
    return animes.filter((a) => a.genres.includes('Aksi'));
  }, [animes]);

  const fantasyAnimes = useMemo(() => {
    return animes.filter((a) => a.genres.includes('Fantasi') || a.genres.includes('Petualangan'));
  }, [animes]);

  const supernaturalAnimes = useMemo(() => {
    return animes.filter((a) => a.genres.includes('Supernatural') || a.genres.includes('Misteri'));
  }, [animes]);

  const comedyDramaAnimes = useMemo(() => {
    return animes.filter((a) => a.genres.includes('Komedi') || a.genres.includes('Slice of Life') || a.genres.includes('Drama'));
  }, [animes]);

  const continueWatchingAnimes = useMemo(() => {
    return watchHistory
      .map((h) => animes.find((a) => a.id === h.animeId))
      .filter((a): a is Anime => a !== undefined);
  }, [watchHistory, animes]);

  // Determine active tab name for top navigation
  const activeTabName = useMemo(() => {
    if (route.type === 'series') return 'series';
    if (route.type === 'movies') return 'movies';
    if (route.type === 'popular') return 'popular';
    if (route.type === 'watchlist') return 'watchlist';
    if (route.type === 'browse') return 'browse';
    if (route.type === 'jadwal') return 'jadwal';
    return 'home';
  }, [route.type]);

  // If in dedicated Video Player Route -> Render ONLY the Video Player Page on its own URL!
  if (route.type === 'watch' && currentAnime) {
    return (
      <div className="min-h-screen bg-black text-white">
        <VideoPlayerPage
          anime={currentAnime}
          episodeNumber={route.episodeNumber || 1}
          onBack={() => {
            // Return to anime details or home
            navigateTo(`#/anime/${currentAnime.id}`);
            setWatchHistory(storageService.getWatchHistory(activeProfile.id));
          }}
          onSelectEpisode={(epNum) => {
            navigateTo(`#/watch/${currentAnime.id}/${epNum}`);
          }}
          activeProfileId={activeProfile.id}
        />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${
        isDark ? 'dark bg-neutral-950 text-neutral-100' : 'bg-neutral-100 text-neutral-900'
      } transition-colors duration-200 flex flex-col justify-between`}
    >
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTabName}
        setActiveTab={(tab) => {
          if (tab === 'home') navigateTo('#/');
          else navigateTo(`#/${tab}`);
        }}
        searchQuery={searchQuery}
        setSearchQuery={(q) => {
          setSearchQuery(q);
          if (route.type !== 'browse') {
            navigateTo('#/browse');
          }
        }}
        activeProfile={activeProfile}
        setActiveProfile={handleProfileChange}
        isDark={isDark}
        toggleTheme={toggleTheme}
        watchlistCount={watchlist.length}
      />

      {/* Main Content Area based on Dedicated URL Route */}
      <main className="flex-1">
        {/* Dedicated Anime Detail Page Route (#/anime/:id) */}
        {route.type === 'anime' && currentAnime && (
          <AnimeDetailPage
            anime={currentAnime}
            onBack={() => navigateTo('#/')}
            onPlay={handlePlayAnime}
            isInWatchlist={watchlist.includes(currentAnime.id)}
            onToggleWatchlist={handleToggleWatchlist}
            isFavorite={favorites.includes(currentAnime.id)}
            onToggleFavorite={handleToggleFavorite}
            onStartDownload={handleStartDownload}
            allAnimes={animes}
            onSelectAnime={(a) => navigateTo(`#/anime/${a.id}`)}
            activeProfileName={activeProfile.name}
          />
        )}

        {/* Home Route (#/) */}
        {route.type === 'home' && (
          <div>
            {featuredAnime && (
              <HeroBanner
                anime={featuredAnime}
                onPlay={handlePlayAnime}
                onOpenDetails={handleOpenDetails}
                isInWatchlist={watchlist.includes(featuredAnime.id)}
                onToggleWatchlist={handleToggleWatchlist}
                isMuted={isMuted}
                onToggleMute={toggleMute}
              />
            )}

            <div className="relative -mt-16 sm:-mt-24 z-20 space-y-2 pb-16">
              {continueWatchingAnimes.length > 0 && (
                <AnimeRow
                  title={`Lanjutkan Menonton untuk ${activeProfile.name}`}
                  subtitle="Lanjutkan dari episode terakhir yang kamu tonton"
                  animes={continueWatchingAnimes}
                  historyItems={watchHistory}
                  onPlay={handlePlayAnime}
                  onOpenDetails={handleOpenDetails}
                  watchlist={watchlist}
                  onToggleWatchlist={handleToggleWatchlist}
                  favorites={favorites}
                  onToggleFavorite={handleToggleFavorite}
                />
              )}

              <AnimeRow
                title="Top 10 Anime di Indonesia Hari Ini"
                subtitle="Diperbarui setiap hari berdasarkan jumlah streaming penonton"
                animes={top10Animes}
                isTop10={true}
                onPlay={handlePlayAnime}
                onOpenDetails={handleOpenDetails}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
              />

              <AnimeRow
                title="Sedang Tren Sekarang"
                subtitle="Tayangan paling sering diperbincangkan minggu ini"
                animes={trendingAnimes}
                onPlay={handlePlayAnime}
                onOpenDetails={handleOpenDetails}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
              />

              <AnimeRow
                title="Aksi & Shounen Terhebat"
                subtitle="Pertarungan epik, koreografi memukau, dan animasi kelas dunia"
                animes={actionAnimes}
                onPlay={handlePlayAnime}
                onOpenDetails={handleOpenDetails}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
              />

              <AnimeRow
                title="Fantasi & Petualangan Epik"
                subtitle="Jelajahi dunia sihir dan takdir pahlawan legendaris"
                animes={fantasyAnimes}
                onPlay={handlePlayAnime}
                onOpenDetails={handleOpenDetails}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
              />

              <AnimeRow
                title="Supernatural & Misteri"
                subtitle="Kutukan kegelapan, rahasia masa lalu, dan fenomena misterius"
                animes={supernaturalAnimes}
                onPlay={handlePlayAnime}
                onOpenDetails={handleOpenDetails}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
              />

              <AnimeRow
                title="Komedi & Cerita Hangat"
                subtitle="Tawa, persahabatan, dan momen menghangatkan hati"
                animes={comedyDramaAnimes}
                onPlay={handlePlayAnime}
                onOpenDetails={handleOpenDetails}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
              />
            </div>
          </div>
        )}

        {/* Series Route (#/series) */}
        {route.type === 'series' && (
          <div className="pt-28 sm:pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
            <div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">Serial Anime TV</h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                Koleksi episode berseri lengkap dari studio animasi Jepang terkemuka
              </p>
            </div>
            <AnimeRow
              title="Serial Terpopuler"
              animes={trendingAnimes.filter((a) => a.episodesCount > 1)}
              onPlay={handlePlayAnime}
              onOpenDetails={handleOpenDetails}
              watchlist={watchlist}
              onToggleWatchlist={handleToggleWatchlist}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />
            <AnimeRow
              title="Aksi & Shounen Musim Ini"
              animes={actionAnimes}
              onPlay={handlePlayAnime}
              onOpenDetails={handleOpenDetails}
              watchlist={watchlist}
              onToggleWatchlist={handleToggleWatchlist}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>
        )}

        {/* Movies Route (#/movies) */}
        {route.type === 'movies' && (
          <div className="pt-28 sm:pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
            <div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">Film Anime & Episode Spesial</h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                Karya sinematik berdurasi panjang dengan visual standar teater
              </p>
            </div>
            <AnimeRow
              title="Film & Bagian Pamungkas"
              animes={animes.filter((a) => a.episodesCount <= 2 || a.title.includes('Chapters') || a.title.includes('Code White'))}
              onPlay={handlePlayAnime}
              onOpenDetails={handleOpenDetails}
              watchlist={watchlist}
              onToggleWatchlist={handleToggleWatchlist}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>
        )}

        {/* Popular Route (#/popular) */}
        {route.type === 'popular' && (
          <div className="pt-28 sm:pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
            <div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">Populer & Baru Ditambahkan</h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                Katalog anime dengan rating 8.5+ dan ulasan tertinggi dari penonton
              </p>
            </div>
            <AnimeRow
              title="Peringkat Tertinggi (Score 9.0+)"
              animes={[...animes].sort((a, b) => b.rating - a.rating)}
              onPlay={handlePlayAnime}
              onOpenDetails={handleOpenDetails}
              watchlist={watchlist}
              onToggleWatchlist={handleToggleWatchlist}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />
            <AnimeRow
              title="Top 10 Hari Ini"
              isTop10={true}
              animes={top10Animes}
              onPlay={handlePlayAnime}
              onOpenDetails={handleOpenDetails}
              watchlist={watchlist}
              onToggleWatchlist={handleToggleWatchlist}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>
        )}

        {/* Watchlist Route (#/watchlist) */}
        {route.type === 'watchlist' && (
          <WatchlistPage
            allAnimes={animes}
            watchlistIds={watchlist}
            favoriteIds={favorites}
            watchHistory={watchHistory}
            downloads={downloads}
            onPlay={handlePlayAnime}
            onOpenDetails={handleOpenDetails}
            onToggleWatchlist={handleToggleWatchlist}
            onToggleFavorite={handleToggleFavorite}
            onRemoveDownload={handleRemoveDownload}
            onNavigateHome={() => navigateTo('#/')}
          />
        )}

        {/* Browse & Search Route (#/browse) */}
        {route.type === 'browse' && (
          <SearchAndBrowse
            animes={animes}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onPlay={handlePlayAnime}
            onOpenDetails={handleOpenDetails}
            watchlist={watchlist}
            onToggleWatchlist={handleToggleWatchlist}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {/* Release Schedule Route (#/jadwal) */}
        {route.type === 'jadwal' && (
          <SchedulePage
            onPlay={handlePlayAnime}
            onOpenDetails={handleOpenDetails}
            watchlist={watchlist}
            onToggleWatchlist={handleToggleWatchlist}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
      </main>

      {/* Footer */}
      <Footer
        onNavigateTab={(tab) => {
          if (tab === 'home') navigateTo('#/');
          else navigateTo(`#/${tab}`);
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
