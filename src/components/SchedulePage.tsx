// Jadwal Rilis — weekly release schedule from /api/od/schedule (otakudesu.blog/jadwal-rilis)
import React, { useEffect, useState } from 'react';
import { CalendarDays, Loader2, RefreshCw } from 'lucide-react';
import { AnimeCard } from './AnimeCard';
import { Anime } from '../types/anime';
import { nekoflixApi } from '../services/nekoflixApi';

interface ScheduleDay {
  day: string;
  items: { slug: string; title: string; url: string }[];
}

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu', 'Random'];
// JS getDay(): 0=Minggu .. 6=Sabtu — map to the schedule's Indonesian day names
const TODAY_INDEX = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()];

export const SchedulePage: React.FC<{
  onPlay: (anime: Anime, epNum: number) => void;
  onOpenDetails: (anime: Anime) => void;
  watchlist: string[];
  onToggleWatchlist: (id: string) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}> = ({ onPlay, onOpenDetails, watchlist, onToggleWatchlist, favorites, onToggleFavorite }) => {
  const [days, setDays] = useState<ScheduleDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState(TODAY_INDEX);
  const [details, setDetails] = useState<Record<string, Anime>>({});

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/api/od/schedule')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => {
        setDays(d.days || []);
        setLoading(false);
        const today = (d.days || []).find((x: ScheduleDay) => x.day === TODAY_INDEX) || (d.days || [])[0];
        if (today) setActiveDay(today.day);
      })
      .catch((e) => { setError(String(e.message || e)); setLoading(false); });
  };

  useEffect(load, []);

  // lazy-load series details for the active day (posters + episode counts)
  useEffect(() => {
    const day = days.find((d) => d.day === activeDay);
    if (!day) return;
    let cancelled = false;
    day.items.forEach(async (item, i) => {
      if (details[item.slug]) return;
      try {
        // small stagger so we don't fire 10 requests at once
        await new Promise((r) => setTimeout(r, i * 150));
        const a = await nekoflixApi.getAnime(item.slug);
        if (!cancelled) setDetails((prev) => ({ ...prev, [item.slug]: a }));
      } catch { /* detail fail -> card still shows title */ }
    });
    return () => { cancelled = true; };
  }, [activeDay, days]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = days.find((d) => d.day === activeDay) || days[0];
  const handlePlay = (anime: Anime, epNum?: number) => onPlay(anime, epNum ?? 1);

  return (
    <div className="min-h-screen pt-28 sm:pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-red-500" /> Jadwal Rilis
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Anime ongoing beserta hari rilisnya (data langsung dari sumber)
          </p>
        </div>
        <button
          onClick={load}
          className="self-start sm:self-auto flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 border border-neutral-700 hover:border-neutral-500 text-neutral-200 rounded px-3 py-1.5 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Muat Ulang
        </button>
      </div>

      {/* Day tabs — highlight today */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        {DAYS.map((day) => {
          const exists = days.some((d) => d.day === day);
          if (!exists) return null;
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                activeDay === day
                  ? 'bg-red-600 text-white'
                  : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800 border border-neutral-800'
              }`}
            >
              {day}
              {day === TODAY_INDEX && <span className="ml-1.5 w-1.5 h-1.5 inline-block rounded-full bg-emerald-400 align-middle" />}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="py-24 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
          <p className="text-sm text-neutral-400">Memuat jadwal…</p>
        </div>
      )}

      {!loading && error && (
        <div className="py-24 text-center space-y-3">
          <p className="text-white font-semibold">Gagal memuat jadwal</p>
          <p className="text-xs text-neutral-400">{error}</p>
          <button onClick={load} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg">Coba Lagi</button>
        </div>
      )}

      {!loading && !error && active && (
        <div className="space-y-4">
          <p className="text-xs text-neutral-400 font-mono">
            {active.items.length} judul dirilis setiap {active.day.toLowerCase()}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {active.items.map((item) => {
              const anime = details[item.slug];
              if (!anime) {
                return (
                  <div key={item.slug} className="rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden animate-pulse">
                    <div className="aspect-[2/3] bg-neutral-800" />
                    <div className="p-2.5 space-y-1.5">
                      <div className="h-3 bg-neutral-800 rounded w-4/5" />
                      <div className="h-2.5 bg-neutral-800 rounded w-1/3" />
                    </div>
                  </div>
                );
              }
              return (
                <AnimeCard
                  key={item.slug}
                  anime={anime}
                  onPlay={handlePlay}
                  onOpenDetails={onOpenDetails}
                  isInWatchlist={watchlist.includes(anime.id)}
                  onToggleWatchlist={onToggleWatchlist}
                  isFavorite={favorites.includes(anime.id)}
                  onToggleFavorite={onToggleFavorite}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
