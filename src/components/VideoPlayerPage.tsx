import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  FastForward,
  Settings,
  Subtitles,
  ListVideo,
  ArrowLeft,
  Download,
  Check,
} from 'lucide-react';
import { Anime, Episode } from '../types/anime';
import { storageService } from '../services/storageService';
import { nekoflixApi } from '../services/nekoflixApi';

interface VideoPlayerPageProps {
  anime: Anime;
  episodeNumber: number;
  onBack: () => void;
  onSelectEpisode: (epNum: number) => void;
  activeProfileId: string;
}

export const VideoPlayerPage: React.FC<VideoPlayerPageProps> = ({
  anime,
  episodeNumber,
  onBack,
  onSelectEpisode,
  activeProfileId,
}) => {
  const currentEpisodeIndex = Math.max(
    0,
    anime.episodes.findIndex((e) => e.episodeNumber === episodeNumber)
  );

  const episode: Episode = anime.episodes[currentEpisodeIndex] || anime.episodes[0];

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [quality, setQuality] = useState('1080p');
  const [activeSubtitle, setActiveSubtitle] = useState<string>('id');
  const [currentSubtitleText, setCurrentSubtitleText] = useState<string>('');

  // Menus
  const [showEpisodesDrawer, setShowEpisodesDrawer] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showSubtitleDrawer, setShowSubtitleDrawer] = useState(false);
  const [activeVideoSrc, setActiveVideoSrc] = useState(episode.videoUrl);
  const [sources, setSources] = useState<{ url: string; label: string; kind: 'hls' | 'mp4' }[]>([]);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [sourceIndex, setSourceIndex] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const controlsTimeoutRef = useRef<number | null>(null);

  const applySource = useCallback((idx: number, list: { url: string; label: string; kind: 'hls' | 'mp4' }[]) => {
    if (idx >= list.length) return;
    setSourceIndex(idx);
    setResolveError(null);
    setActiveVideoSrc(list[idx].url);
  }, []);

  useEffect(() => {
    setActiveVideoSrc(episode.videoUrl);
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      if (episode.videoUrl) videoRef.current.play().catch(() => setIsPlaying(false));
    }
  }, [episode]);

  // Resolve live stream URL from scrape backend when the episode has no direct source yet
  useEffect(() => {
    if (episode.videoUrl) {
      setSources([{ url: episode.videoUrl, label: 'Default', kind: 'mp4' }]);
      setSourceIndex(0);
      return;
    }
    let cancelled = false;
    setResolving(true);
    setResolveError(null);
    setSources([]);
    setDownloadUrl('');
    nekoflixApi.resolveEpisode(anime, episodeNumber)
      .then(({ sources: list, downloadUrl: dUrl, error }) => {
        if (cancelled) return;
        setResolving(false);
        setDownloadUrl(dUrl || '');
        if (error || !list.length) {
          setResolveError(error || 'Tidak ada sumber video.');
          return;
        }
        setSources(list);
        applySource(0, list);
      })
      .catch(() => {
        if (cancelled) return;
        setResolving(false);
        setResolveError('Gagal memuat video. Periksa koneksi lalu coba lagi.');
      });
    return () => { cancelled = true; };
  }, [anime, episodeNumber, episode.videoUrl, applySource]);

  const tryNextSource = useCallback(() => {
    const next = sourceIndex + 1;
    if (next < sources.length) {
      applySource(next, sources);
    } else {
      setResolveError(sources.length > 1
        ? 'Semua server gagal. Coba lagi nanti.'
        : 'Video gagal dimuat dari server ini.');
    }
  }, [sourceIndex, sources, applySource]);

  const retryResolve = useCallback(() => {
    setResolveError(null);
    setResolving(true);
    nekoflixApi.resolveEpisode(anime, episodeNumber)
      .then(({ sources: list, downloadUrl: dUrl, error }) => {
        setResolving(false);
        setDownloadUrl(dUrl || '');
        if (error || !list.length) { setResolveError(error || 'Tidak ada sumber video.'); return; }
        setSources(list);
        applySource(0, list);
      })
      .catch(() => { setResolving(false); setResolveError('Gagal memuat video. Coba lagi.'); });
  }, [anime, episodeNumber, applySource]);

  // first /out/ download link for this episode (opens the file-host page)
  const episodeDownloadUrl = useMemo(() => {
    return downloadUrl || '';
  }, [downloadUrl]);

  // Attach source — HLS via hls.js when the browser can't play m3u8 natively
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeVideoSrc) return;
    if (activeVideoSrc.includes('.m3u8') && !video.canPlayType('application/vnd.apple.mpegurl')) {
      let hls: { destroy: () => void } | null = null;
      let cancelled = false;
      import('hls.js').then(({ default: Hls }) => {
        if (cancelled || !Hls.isSupported()) return;
        const instance = new Hls();
        instance.loadSource(activeVideoSrc);
        instance.attachMedia(video);
        instance.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => setIsPlaying(false)));
        hls = instance;
      });
      return () => { cancelled = true; hls?.destroy(); };
    }
    video.src = activeVideoSrc;
    video.play().catch(() => setIsPlaying(false));
  }, [activeVideoSrc]);

  // Autoplay retries: browsers block programmatic play before user gesture; also retry on stalls
  const [stallRetries, setStallRetries] = useState(0);
  useEffect(() => { setStallRetries(0); }, [activeVideoSrc]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeVideoSrc || resolving || resolveError) return;
    const t = window.setTimeout(() => {
      video.load(); // restart the fetch — stalled pipelines recover
      video.play().catch(() => setIsPlaying(false));
    }, 9000);
    return () => window.clearTimeout(t);
  }, [activeVideoSrc, stallRetries, resolving, resolveError]);
  const onStalled = useCallback(() => {
    const video = videoRef.current;
    if (!video || resolving || resolveError) return;
    if (stallRetries >= 2) { setResolveError('Koneksi ke server video lambat. Coba server lain atau lagi nanti.'); return; }
    setStallRetries((n) => n + 1);
    video.load();
    video.play().catch(() => setIsPlaying(false));
  }, [stallRetries, resolving, resolveError]);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowEpisodesDrawer(false);
        setShowSettingsDrawer(false);
        setShowSubtitleDrawer(false);
      }
    }, 3200);
  }, [isPlaying]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const seek = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(time, duration));
    setCurrentTime(videoRef.current.currentTime);
  };

  const skipIntro = () => {
    const target = episode.introEnd || 90;
    seek(target);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'j':
          e.preventDefault();
          seek(currentTime - 10);
          break;
        case 'ArrowRight':
        case 'l':
          e.preventDefault();
          seek(currentTime + 10);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          setIsMuted((prev) => !prev);
          break;
        case 'Escape':
          if (!isFullscreen) {
            onBack();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, duration, isFullscreen, isPlaying]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    if (currentTime > 5 && duration > 0) {
      storageService.saveWatchProgress(activeProfileId, {
        animeId: anime.id,
        episodeId: episode.id,
        episodeNumber: episode.episodeNumber,
        episodeTitle: episode.title,
        progressSeconds: Math.floor(currentTime),
        durationSeconds: Math.floor(duration),
        lastWatchedAt: Date.now(),
      });
    }
  }, [currentTime, duration, activeProfileId, anime.id, episode]);

  useEffect(() => {
    if (!activeSubtitle || activeSubtitle === 'off') {
      setCurrentSubtitleText('');
      return;
    }

    const subTrack = episode.subtitles?.find((s) => s.lang === activeSubtitle);
    if (subTrack && subTrack.cues) {
      const activeCue = subTrack.cues.find(
        (c) => currentTime >= c.start && currentTime <= c.end
      );
      setCurrentSubtitleText(activeCue ? activeCue.text : '');
    } else {
      if (currentTime > 5 && currentTime < 12) {
        setCurrentSubtitleText(activeSubtitle === 'id' ? '[ Musik Pembuka Anime Mengalun ]' : '[ Anime Opening Music Plays ]');
      } else {
        setCurrentSubtitleText('');
      }
    }
  }, [currentTime, activeSubtitle, episode]);

  const handleNextEpisode = () => {
    if (currentEpisodeIndex < anime.episodes.length - 1) {
      onSelectEpisode(anime.episodes[currentEpisodeIndex + 1].episodeNumber);
    }
  };

  const isIntroActive =
    (episode.introStart !== undefined &&
      episode.introEnd !== undefined &&
      currentTime >= episode.introStart &&
      currentTime <= episode.introEnd) ||
    (currentTime >= 5 && currentTime <= 85);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between select-none overflow-hidden"
    >
      {/* Background Video Element */}
      <video
        ref={videoRef}
        src={activeVideoSrc}
        className="absolute inset-0 w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        onTimeUpdate={() => {
          if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            videoRef.current.volume = isMuted ? 0 : volume;
            videoRef.current.playbackRate = playbackSpeed;
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onStalled={onStalled}
        onWaiting={() => { /* buffer underrun — onStalled covers hard cases */ }}
        onError={() => {
          // current source failed -> try next available source automatically
          if (sources.length > 1 && sourceIndex < sources.length - 1) {
            tryNextSource();
          } else if (!resolving) {
            setResolveError('Video gagal diputar dari server ini.');
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          handleNextEpisode();
        }}
        playsInline
        autoPlay
      />

      {/* Loading overlay */}
      {resolving && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 gap-3">
          <div className="w-10 h-10 border-4 border-neutral-700 border-t-red-600 rounded-full animate-spin" />
          <p className="text-sm text-neutral-300 font-medium">Memuat video…</p>
        </div>
      )}

      {/* Error overlay */}
      {!resolving && resolveError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 gap-3 px-8 text-center">
          <p className="text-white font-semibold">Video tidak bisa diputar</p>
          <p className="text-sm text-neutral-400 max-w-sm">{resolveError}</p>
          <div className="flex gap-2 mt-1">
            <button
              onClick={retryResolve}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors"
            >
              Coba Lagi
            </button>
            {sources.length > 1 && sourceIndex < sources.length - 1 && (
              <button
                onClick={tryNextSource}
                className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-bold rounded-lg transition-colors"
              >
                Server Lain
              </button>
            )}
          </div>
        </div>
      )}

      {/* Subtitles Overlay */}
      {currentSubtitleText && (
        <div className="absolute bottom-24 left-0 right-0 z-20 flex justify-center px-4 pointer-events-none">
          <div className="bg-black/75 backdrop-blur-xs px-4 py-2 rounded-lg text-white text-base sm:text-xl font-medium tracking-wide text-center max-w-3xl drop-shadow-md border border-white/10">
            {currentSubtitleText}
          </div>
        </div>
      )}

      {/* Skip Intro Floating Button */}
      {isIntroActive && (
        <button
          onClick={skipIntro}
          className="absolute bottom-24 right-8 z-30 flex items-center gap-2 px-5 py-2.5 bg-neutral-900/90 hover:bg-neutral-800 text-white font-bold text-sm rounded-lg border border-neutral-600 shadow-2xl transition-transform active:scale-95 animate-in fade-in slide-in-from-bottom-2"
        >
          <FastForward className="w-4 h-4 fill-current text-white" />
          <span>Lewati Intro</span>
        </button>
      )}

      {/* Top Bar Overlay */}
      <div
        className={`relative z-30 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-full hover:bg-white/20 transition-colors text-white"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
              {anime.title}
            </h3>
            <p className="text-xs text-neutral-300 font-medium">
              Episode {episode.episodeNumber}: {episode.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Download episode link (if any) */}
          {episodeDownloadUrl && (
            <a
              href={episodeDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-800/80 hover:bg-neutral-700 rounded-lg border border-neutral-700 transition-colors text-white"
              title="Halaman unduhan episode"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Unduh Episode</span>
            </a>
          )}
        </div>
      </div>

      {/* Bottom Bar Controls Overlay */}
      <div
        className={`relative z-30 p-4 sm:p-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 space-y-3 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress Seekbar */}
        <div className="relative group/seeker flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full h-1.5 bg-neutral-700 hover:h-2.5 rounded-lg appearance-none cursor-pointer accent-red-600 transition-all"
          />
        </div>

        {/* Control Buttons Row */}
        <div className="flex items-center justify-between">
          {/* Left Controls */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={togglePlay}
              className="p-1.5 hover:text-red-500 transition-colors"
              aria-label={isPlaying ? 'Jeda' : 'Putar'}
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
            </button>

            <button
              onClick={() => seek(currentTime - 10)}
              className="p-1.5 hover:text-white text-neutral-300 transition-colors"
              title="Mundur 10 detik"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={() => seek(currentTime + 10)}
              className="p-1.5 hover:text-white text-neutral-300 transition-colors"
              title="Maju 10 detik"
            >
              <RotateCw className="w-5 h-5" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2 group/vol">
              <button
                onClick={() => {
                  if (videoRef.current) {
                    const newMuted = !isMuted;
                    setIsMuted(newMuted);
                    videoRef.current.volume = newMuted ? 0 : volume;
                  }
                }}
                className="p-1.5 hover:text-white text-neutral-300 transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setVolume(val);
                  setIsMuted(false);
                  if (videoRef.current) {
                    videoRef.current.volume = val;
                  }
                }}
                className="w-16 sm:w-20 h-1 bg-neutral-700 accent-white rounded appearance-none cursor-pointer"
              />
            </div>

            {/* Time Stamp */}
            <div className="text-xs font-mono tabular-nums text-neutral-300">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Next Episode Button */}
            {currentEpisodeIndex < anime.episodes.length - 1 && (
              <button
                onClick={handleNextEpisode}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-800/80 hover:bg-neutral-700 rounded-lg transition-colors text-white"
                title="Episode Berikutnya"
              >
                <FastForward className="w-4 h-4" />
                <span>Ep Berikutnya</span>
              </button>
            )}

            {/* Episode List Drawer Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowEpisodesDrawer(!showEpisodesDrawer);
                  setShowSubtitleDrawer(false);
                  setShowSettingsDrawer(false);
                }}
                className="p-2 hover:text-white text-neutral-300 rounded transition-colors"
                title="Daftar Episode"
              >
                <ListVideo className="w-5 h-5" />
              </button>

              {showEpisodesDrawer && (
                <div className="absolute bottom-12 right-0 w-72 max-h-80 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl p-3 overflow-y-auto custom-scrollbar z-50 text-xs">
                  <div className="font-bold text-white mb-2 pb-1 border-b border-neutral-800">
                    Pilih Episode ({anime.episodes.length})
                  </div>
                  <div className="space-y-1.5">
                    {anime.episodes.map((ep) => (
                      <button
                        key={ep.id}
                        onClick={() => {
                          onSelectEpisode(ep.episodeNumber);
                          setShowEpisodesDrawer(false);
                        }}
                        className={`w-full text-left p-2 rounded flex items-center justify-between transition-colors ${
                          ep.episodeNumber === episode.episodeNumber
                            ? 'bg-red-600 text-white font-bold'
                            : 'hover:bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        <span className="truncate">
                          Ep {ep.episodeNumber}: {ep.title}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono ml-2">
                          {ep.duration}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Subtitle Selector */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSubtitleDrawer(!showSubtitleDrawer);
                  setShowEpisodesDrawer(false);
                  setShowSettingsDrawer(false);
                }}
                className={`p-2 rounded transition-colors ${
                  activeSubtitle !== 'off' ? 'text-red-500' : 'text-neutral-300 hover:text-white'
                }`}
                title="Subtitle & Bahasa"
              >
                <Subtitles className="w-5 h-5" />
              </button>

              {showSubtitleDrawer && (
                <div className="absolute bottom-12 right-0 w-52 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl p-3 z-50 text-xs space-y-1">
                  <div className="font-bold text-white mb-1.5 pb-1 border-b border-neutral-800">
                    Subtitle Teks
                  </div>
                  {[
                    { id: 'id', label: 'Bahasa Indonesia' },
                    { id: 'en', label: 'English' },
                    { id: 'off', label: 'Nonaktifkan Subtitle' },
                  ].map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => {
                        setActiveSubtitle(sub.id);
                        setShowSubtitleDrawer(false);
                      }}
                      className="w-full flex items-center justify-between p-1.5 rounded hover:bg-neutral-800 text-neutral-200"
                    >
                      <span>{sub.label}</span>
                      {activeSubtitle === sub.id && <Check className="w-3.5 h-3.5 text-red-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Settings (Speed & Quality) */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSettingsDrawer(!showSettingsDrawer);
                  setShowEpisodesDrawer(false);
                  setShowSubtitleDrawer(false);
                }}
                className="p-2 hover:text-white text-neutral-300 rounded transition-colors"
                title="Pengaturan Pemutaran"
              >
                <Settings className="w-5 h-5" />
              </button>

              {showSettingsDrawer && (
                <div className="absolute bottom-12 right-0 w-56 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl p-3 z-50 text-xs space-y-3">
                  <div>
                    <div className="font-bold text-white mb-1.5">Kecepatan Putar</div>
                    <div className="grid grid-cols-4 gap-1">
                      {[0.75, 1, 1.25, 1.5].map((spd) => (
                        <button
                          key={spd}
                          onClick={() => {
                            setPlaybackSpeed(spd);
                            if (videoRef.current) videoRef.current.playbackRate = spd;
                          }}
                          className={`py-1 rounded font-mono ${
                            playbackSpeed === spd
                              ? 'bg-red-600 text-white font-bold'
                              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-neutral-800 pt-2">
                    <div className="font-bold text-white mb-1.5">Server Video</div>
                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                      {sources.length === 0 && (
                        <p className="text-neutral-500 text-xs">Belum ada server.</p>
                      )}
                      {sources.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            applySource(i, sources);
                            setShowSettingsDrawer(false);
                          }}
                          className="w-full flex items-center justify-between p-1.5 rounded hover:bg-neutral-800 text-neutral-200"
                        >
                          <span className="truncate text-left">{s.label}</span>
                          {sourceIndex === i && <Check className="w-3.5 h-3.5 text-red-500 shrink-0 ml-2" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:text-white text-neutral-300 rounded transition-colors"
              title={isFullscreen ? 'Keluar Layar Penuh (F)' : 'Layar Penuh (F)'}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
