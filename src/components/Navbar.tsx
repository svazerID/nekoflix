import React, { useState, useEffect } from 'react';
import { Search, Sun, Moon, ChevronDown, Bookmark, PlusCircle } from 'lucide-react';
import { UserProfile } from '../types/anime';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeProfile: UserProfile;
  setActiveProfile: (profile: UserProfile) => void;
  isDark: boolean;
  toggleTheme: () => void;
  onOpenDeployModal?: () => void;
  onOpenAddAnimeModal: () => void;
  watchlistCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  activeProfile,
  setActiveProfile,
  isDark,
  toggleTheme,
  onOpenAddAnimeModal,
  watchlistCount,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { id: 'home', label: 'Beranda' },
    { id: 'series', label: 'Serial Anime' },
    { id: 'movies', label: 'Film & Spesial' },
    { id: 'popular', label: 'Populer & Baru' },
    { id: 'watchlist', label: `Daftar Saya ${watchlistCount > 0 ? `(${watchlistCount})` : ''}` },
    { id: 'jadwal', label: 'Jadwal Rilis' },
    { id: 'browse', label: 'Jelajahi Genre' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled
          ? 'bg-neutral-950/95 dark:bg-neutral-950/95 backdrop-blur-md shadow-xl border-b border-neutral-800/40 py-3'
          : 'bg-gradient-to-b from-neutral-950/90 via-neutral-950/40 to-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          {/* Zone 1: Brand title, one line */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => setActiveTab('home')}
              className="text-2xl sm:text-3xl font-display font-extrabold tracking-wider text-red-600 hover:text-red-500 transition-colors whitespace-nowrap focus:outline-none"
              aria-label="NekoFlix Beranda"
            >
              NEKOFLIX
            </button>

            {/* Zone 2: 4-6 clean text navigation links */}
            <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => {
                    setActiveTab(link.id);
                    if (searchOpen && link.id !== 'browse') {
                      setSearchOpen(false);
                    }
                  }}
                  className={`transition-colors whitespace-nowrap py-1 ${
                    activeTab === link.id
                      ? 'text-white font-semibold border-b-2 border-red-600'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Zone 3: 1-2 primary actions */}
          <div className="flex items-center gap-3">
            {/* Search Input Box */}
            <div className="relative flex items-center">
              {searchOpen ? (
                <div className="flex items-center bg-neutral-900/90 border border-neutral-700/80 rounded-full px-3 py-1.5 transition-all w-52 sm:w-64">
                  <Search className="w-4 h-4 text-neutral-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (activeTab !== 'browse') {
                        setActiveTab('browse');
                      }
                    }}
                    placeholder="Judul, genre, studio..."
                    className="w-full bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-xs text-neutral-400 hover:text-white ml-1 px-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => {
                    setSearchOpen(true);
                    if (activeTab !== 'browse') setActiveTab('browse');
                  }}
                  className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800/60 rounded-full transition-colors"
                  aria-label="Cari anime"
                  title="Pencarian Anime"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800/60 rounded-full transition-colors cursor-pointer"
              aria-label="Ganti tema"
              title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-300" />}
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-1.5 p-1 rounded-lg hover:ring-1 hover:ring-neutral-700 transition-all focus:outline-none cursor-pointer"
                aria-expanded={profileMenuOpen}
                title="Menu Profil Pengguna"
              >
                <img
                  src={activeProfile.avatar}
                  alt=""
                  aria-hidden="true"
                  className="w-8 h-8 rounded-md object-cover border border-neutral-700"
                />
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </button>

              {profileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl py-1.5 z-50 text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-150">
                    <button
                      onClick={() => {
                        setActiveTab('watchlist');
                        setProfileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-neutral-800/80 transition-colors text-left cursor-pointer text-neutral-200"
                    >
                      <Bookmark className="w-4 h-4 text-neutral-400" />
                      <span>Daftar Saya & Favorit</span>
                    </button>

                    <button
                      onClick={() => {
                        onOpenAddAnimeModal();
                        setProfileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-neutral-800/80 transition-colors text-left text-amber-300 hover:text-amber-200 cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4 text-amber-400" />
                      <span>Kelola / Tambah Anime CMS</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex lg:hidden items-center gap-4 overflow-x-auto no-scrollbar pt-2 text-xs font-medium border-t border-neutral-800/40 mt-2">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => setActiveTab(link.id)}
              className={`whitespace-nowrap pb-1.5 transition-colors ${
                activeTab === link.id
                  ? 'text-red-500 font-semibold border-b-2 border-red-600'
                  : 'text-neutral-400'
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
