import React from 'react';

interface FooterProps {
  onNavigateTab: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateTab }) => {
  return (
    <footer className="bg-neutral-950 border-t border-neutral-900 text-neutral-400 text-xs py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Navigation Mirror */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <h5 className="font-bold text-neutral-200 mb-3 text-xs tracking-wider uppercase">Jelajah</h5>
            <ul className="space-y-2">
              <li>
                <button onClick={() => onNavigateTab('home')} className="hover:text-white transition-colors">
                  Beranda
                </button>
              </li>
              <li>
                <button onClick={() => onNavigateTab('series')} className="hover:text-white transition-colors">
                  Serial Anime TV
                </button>
              </li>
              <li>
                <button onClick={() => onNavigateTab('movies')} className="hover:text-white transition-colors">
                  Film Anime
                </button>
              </li>
              <li>
                <button onClick={() => onNavigateTab('popular')} className="hover:text-white transition-colors">
                  Sedang Tren
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-neutral-200 mb-3 text-xs tracking-wider uppercase">Koleksi</h5>
            <ul className="space-y-2">
              <li>
                <button onClick={() => onNavigateTab('watchlist')} className="hover:text-white transition-colors">
                  Daftar Saya
                </button>
              </li>
              <li>
                <button onClick={() => onNavigateTab('watchlist')} className="hover:text-white transition-colors">
                  Lanjutkan Menonton
                </button>
              </li>
              <li>
                <button onClick={() => onNavigateTab('jadwal')} className="hover:text-white transition-colors">
                  Jadwal Rilis
                </button>
              </li>
              <li>
                <button onClick={() => onNavigateTab('browse')} className="hover:text-white transition-colors">
                  Semua Genre
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-neutral-200 mb-3 text-xs tracking-wider uppercase">Legalitas & Audio</h5>
            <ul className="space-y-2 text-neutral-500">
              <li>Audio Asli Jepang & Subtitle Indonesia</li>
              <li>Format Video 4K Ultra HD & 1080p</li>
              <li>Hak Cipta © 2026 NekoFlix. Hak cipta anime dipegang oleh pembuat dan studio masing-masing.</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="text-red-600 font-display text-lg tracking-wider">NEKOFLIX</span>
            <span>— Platform Streaming Anime Bergaya UI Netflix</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
