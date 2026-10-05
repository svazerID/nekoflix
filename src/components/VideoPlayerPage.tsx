import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, Download, ExternalLink, Flame, Info,
  Layers, Loader2, Play, Server, Sparkles,
} from 'lucide-react';
import { Anime, Episode, EpisodeMirror } from '../types/anime';
import { storageService } from '../services/storageService';
import { nekoflixApi } from '../services/nekoflixApi';

interface VideoPlayerPageProps {
  anime: Anime;
  episodeNumber: number;
  onBack: () => void;
  onSelectEpisode: (epNum: number) => void;
  activeProfileId: string;
  /** Other series shown in the "Rekomendasi" rail. */
  recommended?: Anime[];
  onOpenAnime?: (anime: Anime) => void;
}

const kindBadge = (kind: EpisodeMirror['kind']) =>
  kind === 'embed' ? 'Embed' : kind === 'hls' ? 'HLS' : 'Direct';

const fmt = (secs: number) => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
           : `${m}:${String(ss).padStart(2, '0')}`;
};

// Full-screen watch view, ZerDonghua-style: player → server rail → prev/next →
// related → recommendations → footer, all scrollable on one page.
export const VideoPlayerPage: React.FC<VideoPlayerPageProps> = ({
  anime,
  episodeNumber,
  onBack,
  onSelectEpisode,
  activeProfileId,
  recommended = [],
  onOpenAnime,
}) => {
  const index = Math.max(0, anime.episodes.findIndex((e) => e.episodeNumber === episodeNumber));
  const episode: Episode = anime.episodes[index] || anime.episodes[0];
  const prevEp = anime.episodes[index - 1];
  const nextEp = anime.episodes[index + 1];

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedRef = useRef(0);
  const [mirrors, setMirrors] = useState<EpisodeMirror[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');

  const current = mirrors[selected];
  const isEmbed = current?.kind === 'embed';

  // Resolve mirrors for the episode (scrubbed cache first, then live scrape).
  useEffect(() => {
    let cancelled = false;
    const apply = (list: EpisodeMirror[], dl: string) => {
      if (cancelled) return;
      setMirrors(list);
      setSelected(Math.max(0, list.findIndex((s) => s.kind !== 'embed')));
      setDownloadUrl(dl);
      setLoading(false);
    };
    setLoading(true);
    setError(null);
    setMirrors([]);
    setSelected(0);
    setDownloadUrl('');

    if (episode.videoUrl) {
      apply([{ name: 'Default', url: episode.videoUrl, kind: 'mp4' }], '');
      return;
    }
    nekoflixApi
      .resolveEpisode(anime, episodeNumber)
      .then(({ sources, downloadUrl: dl, error: err }) => {
        if (cancelled) return;
        if (err || !sources.length) {
          setLoading(false);
          setError(err || 'Tidak ada sumber video untuk episode ini.');
          setDownloadUrl(dl || '');
          return;
        }
        apply(sources, dl || '');
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        setError('Gagal memuat video. Periksa koneksi lalu coba lagi.');
      });
    return () => { cancelled = true; };
  }, [anime, episodeNumber, episode.videoUrl]);

  // Attach the selected mirror. Embed mirrors leave the <video> cleared so it
  // can't keep playing behind the iframe.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!current || current.kind === 'embed') {
      video.pause();
      video.removeAttribute('src');
      video.load();
      return;
    }
    const src = current.url;
    if (lastSavedRef.current) resumeAt.current = lastSavedRef.current;
    if (src.includes('.m3u8') && !video.canPlayType('application/vnd.apple.mpegurl')) {
      let hls: { destroy: () => void } | null = null;
      let cancelled = false;
      import('hls.js').then(({ default: Hls }) => {
        if (cancelled || !Hls.isSupported()) return;
        const instance = new Hls();
        instance.loadSource(src);
        instance.attachMedia(video);
        instance.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
        hls = instance;
      });
      return () => { cancelled = true; hls?.destroy(); };
    }
    video.src = src;
    video.play().catch(() => {});
  }, [current?.url, current?.kind]);

  const persistProgress = useCallback((force = false) => {
    const v = videoRef.current;
    if (!v || !v.currentTime || !v.duration) return;
    if (!force && Math.abs(v.currentTime - lastSavedRef.current) < 2) return;
    lastSavedRef.current = v.currentTime;
    storageService.saveWatchProgress(activeProfileId, {
      animeId: anime.id,
      episodeId: episode.id,
      episodeNumber: episode.episodeNumber,
      episodeTitle: episode.title,
      progressSeconds: Math.floor(v.currentTime),
      durationSeconds: Math.floor(v.duration),
      lastWatchedAt: Date.now(),
      animeTitle: anime.title,
      posterUrl: anime.posterUrl,
    });
  }, [activeProfileId, anime.id, anime.title, anime.posterUrl, episode.id, episode.episodeNumber, episode.title]);

  // Resume where the last session stopped (only if there was meaningful progress).
  const resumeAt = useRef<number | null>(null);
  const [resumed, setResumed] = useState(false);
  const [resumeFrom, setResumeFrom] = useState(0);
  useEffect(() => {
    const h = storageService.getWatchHistory(activeProfileId)
      .find((x) => x.animeId === anime.id && x.episodeNumber === episode.episodeNumber);
    const t = h && h.progressSeconds > 30 && h.progressSeconds < (h.durationSeconds || Infinity) * 0.95
      ? h.progressSeconds : 0;
    resumeAt.current = t || null;
    setResumeFrom(t);
    setResumed(t > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anime.id, episode.episodeNumber, activeProfileId]);

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (v && resumeAt.current && !v.currentTime) v.currentTime = resumeAt.current;
  };

  // Save when leaving, and when the tab closes.
  useEffect(() => {
    const flush = () => persistProgress(true);
    window.addEventListener('beforeunload', flush);
    return () => { window.removeEventListener('beforeunload', flush); flush(); };
  }, [persistProgress]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    nekoflixApi
      .resolveEpisode(anime, episodeNumber)
      .then(({ sources, downloadUrl: dl, error: err }) => {
        setLoading(false);
        setDownloadUrl(dl || '');
        if (err || !sources.length) { setError(err || 'Tidak ada sumber video.'); return; }
        setMirrors(sources);
        setSelected(Math.max(0, sources.findIndex((s) => s.kind !== 'embed')));
      })
      .catch(() => { setLoading(false); setError('Gagal memuat video. Coba lagi.'); });
  }, [anime, episodeNumber]);

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || v.currentTime <= 5) return;
    persistProgress();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col bg-neutral-950 sm:border-x sm:border-neutral-800">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur px-3 py-3 sm:px-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-2 rounded-xl hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer shrink-0"
              aria-label="Kembali"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                {anime.title}
              </h2>
              <p className="text-xs text-neutral-400 truncate">
                Episode {episode.episodeNumber}
                {episode.title ? `: ${episode.title}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isEmbed && current && (
              <a
                href={current.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition-colors"
                title="Buka mirror ini di tab baru kalau frame diblokir"
              >
                Tab Baru
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {downloadUrl && (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-semibold text-white transition-colors"
                title="Halaman unduhan episode"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Unduh</span>
              </a>
            )}
          </div>
        </header>

        {/* Player */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          {loading ? (
            <div className="text-center space-y-3">
              <Loader2 className="w-9 h-9 animate-spin text-red-500 mx-auto" />
              <p className="text-xs text-neutral-400 font-medium">Menghubungkan ke server stream…</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center space-y-3">
              <p className="text-sm text-red-500 font-semibold">{error}</p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={retry}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Coba Lagi
                </button>
                {mirrors.length > 1 && (
                  <button
                    onClick={() => setSelected((s) => (s + 1) % mirrors.length)}
                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Server Lain
                  </button>
                )}
              </div>
            </div>
          ) : isEmbed ? (
            <iframe
              key={`${current.url}-${selected}`}
              src={current.url}
              title={episode.title || 'Mirror'}
              className="absolute inset-0 w-full h-full border-0 bg-black"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer"
            />
          ) : (
            <video
              key={`${current?.url}`}
              ref={videoRef}
              src={current?.url || undefined}
              className="absolute inset-0 w-full h-full object-contain bg-black"
              controls
              autoPlay
              playsInline
              onTimeUpdate={onTimeUpdate}
              onLoadedMetadata={onLoadedMetadata}
              onEnded={() => persistProgress(true)}
            />
          )}
        </div>

        {/* Resume notice */}
        {resumed && !loading && !error && !isEmbed && (
          <div className="flex items-center justify-between gap-3 border-t border-neutral-800 bg-neutral-900 px-3 py-2 text-[11px] sm:text-xs">
            <span className="text-neutral-300">
              Dilanjutkan dari <span className="font-mono text-white">{fmt(resumeFrom)}</span>
            </span>
            <button
              onClick={() => {
                const v = videoRef.current;
                if (v) { v.currentTime = 0; v.play().catch(() => {}); }
                setResumed(false);
              }}
              className="font-semibold text-red-400 hover:text-white transition-colors cursor-pointer"
            >
              Mulai dari awal
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 space-y-6 border-t border-neutral-800 bg-neutral-950 px-3 py-4 sm:px-5 sm:py-6 pb-12">
          {/* Server rail */}
          {mirrors.length > 0 && (
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  <Server className="w-3.5 h-3.5 text-red-500" />
                  Pilih Server ({mirrors.length})
                </span>
                {isEmbed && current && (
                  <a
                    href={current.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sm:hidden text-xs text-red-400 hover:text-white flex items-center gap-1 font-semibold"
                  >
                    Tab Baru <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {mirrors.map((m, i) => (
                  <button
                    key={`${m.name}-${i}`}
                    onClick={() => setSelected(i)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold border transition-all cursor-pointer active:scale-95 ${
                      selected === i
                        ? 'bg-red-600 border-red-500 text-white shadow-sm'
                        : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white'
                    }`}
                  >
                    <Play className="w-3 h-3" />
                    <span className="max-w-[9rem] truncate">{m.name}</span>
                    <span className={`text-[9px] px-1 rounded ${selected === i ? 'bg-black/30' : 'bg-neutral-800 text-neutral-400'}`}>
                      {kindBadge(m.kind)}
                    </span>
                    {selected === i && <Check className="w-3 h-3" />}
                  </button>
                ))}
              </div>
              <p className="text-[10px] sm:text-[11px] text-neutral-500 flex items-start gap-1.5 leading-relaxed">
                <Info className="w-3 h-3 mt-0.5 shrink-0 text-red-500" />
                <span>
                  Kalau video error atau tidak bisa diputar, ganti server di atas.
                  {isEmbed ? ' Mirror embed kadang memblokir tampilan dalam frame — pakai "Tab Baru".' : ''}
                </span>
              </p>
            </section>
          )}

          {/* Prev / Next */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 pt-4">
            {prevEp ? (
              <button
                onClick={() => onSelectEpisode(prevEp.episodeNumber)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Ep {prevEp.episodeNumber}</span>
              </button>
            ) : <div />}

            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer active:scale-95"
            >
              <Layers className="w-4 h-4" />
              Semua Episode
            </button>

            {nextEp ? (
              <button
                onClick={() => onSelectEpisode(nextEp.episodeNumber)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] sm:text-xs font-semibold shadow-sm transition-colors cursor-pointer active:scale-95"
              >
                <span>Ep {nextEp.episodeNumber}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : <div />}
          </div>

          {/* Related episodes */}
          {anime.episodes.length > 1 && (
            <section className="space-y-2 border-t border-neutral-800 pt-4">
              <span className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5 text-red-500" />
                Episode Lain ({anime.episodes.length})
              </span>
              <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
                {anime.episodes.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => onSelectEpisode(ep.episodeNumber)}
                    className={`flex items-center gap-3 rounded-xl border p-2 text-left transition-colors cursor-pointer active:scale-[0.99] ${
                      ep.episodeNumber === episode.episodeNumber
                        ? 'bg-red-600/15 border-red-500/40'
                        : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800'
                    }`}
                  >
                    <div className="relative w-14 h-20 sm:w-16 sm:h-22 shrink-0 rounded-lg overflow-hidden bg-neutral-800">
                      {ep.thumbnailUrl && (
                        <img src={ep.thumbnailUrl} alt={ep.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      )}
                      <span className="absolute top-1 left-1 text-[9px] font-bold bg-black/70 text-white px-1.5 py-0.5 rounded">
                        EP {ep.episodeNumber}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-[11px] sm:text-xs font-semibold line-clamp-2 block ${ep.episodeNumber === episode.episodeNumber ? 'text-white' : 'text-neutral-300'}`}>
                        {ep.title || `Episode ${ep.episodeNumber}`}
                      </span>
                      <span className="text-[10px] text-neutral-500 mt-0.5 block">{ep.duration}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Recommendations */}
          {recommended.length > 0 && (
            <section className="space-y-2 border-t border-neutral-800 pt-4">
              <span className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5 text-red-500" />
                Rekomendasi
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar">
                {recommended.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onOpenAnime?.(r)}
                    className="min-w-[104px] w-[104px] sm:min-w-[116px] sm:w-[116px] shrink-0 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-red-500/40 transition-colors text-left cursor-pointer active:scale-95"
                  >
                    <div className="relative aspect-[3/4] w-full bg-neutral-800">
                      {r.posterUrl && (
                        <img src={r.posterUrl} alt={r.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="p-1.5">
                      <span className="text-[10px] sm:text-xs font-semibold text-neutral-300 line-clamp-2">{r.title}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Genre */}
          {anime.genres.length > 0 && (
            <section className="space-y-2 border-t border-neutral-800 pt-4">
              <span className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-red-500" />
                Genre
              </span>
              <div className="flex flex-wrap gap-1.5">
                {anime.genres.map((g) => (
                  <span key={g} className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-[10px] font-semibold text-neutral-400">
                    {g}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className="mt-6 border-t border-neutral-800 pt-6 text-neutral-500">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
                <Play className="w-3.5 h-3.5 fill-current" />
              </div>
              <span className="text-sm font-bold text-white">NekoFlix</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-2 max-w-md leading-relaxed">
              Streaming anime subtitle Indonesia. Sumber katalog & mirror dari penyedia pihak ketiga.
            </p>
            <p className="text-[11px] text-neutral-600 mt-4">© {new Date().getFullYear()} NekoFlix Streaming.</p>
          </footer>
        </div>
      </div>
    </div>
  );
};
