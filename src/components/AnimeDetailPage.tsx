import React, { useState } from 'react';
import { ArrowLeft, Play, Plus, Check, ThumbsUp, Share2, Download, Star, MessageSquare, Film, Sparkles } from 'lucide-react';
import { Anime, Episode, Review } from '../types/anime';
import { storageService } from '../services/storageService';

interface AnimeDetailPageProps {
  anime: Anime;
  onBack: () => void;
  onPlay: (anime: Anime, episodeNumber?: number) => void;
  isInWatchlist: boolean;
  onToggleWatchlist: (animeId: string) => void;
  isFavorite: boolean;
  onToggleFavorite: (animeId: string) => void;
  onStartDownload: (anime: Anime, episode: Episode) => void;
  allAnimes: Anime[];
  onSelectAnime: (anime: Anime) => void;
  activeProfileName: string;
}

export const AnimeDetailPage: React.FC<AnimeDetailPageProps> = ({
  anime,
  onBack,
  onPlay,
  isInWatchlist,
  onToggleWatchlist,
  isFavorite,
  onToggleFavorite,
  onStartDownload,
  allAnimes,
  onSelectAnime,
  activeProfileName,
}) => {
  const [activeTab, setActiveTab] = useState<'episodes' | 'similar' | 'reviews' | 'about'>('episodes');
  const [selectedSeason, setSelectedSeason] = useState('Season 1');
  const [copiedShare, setCopiedShare] = useState(false);

  // Review Form state
  const [userRating, setUserRating] = useState(5);
  const [userComment, setUserComment] = useState('');
  const [reviews, setReviews] = useState<Review[]>(() => {
    const all = storageService.getReviews();
    return all[anime.id] || [];
  });

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userComment.trim()) return;
    const newRev: Review = {
      id: `rev-${Date.now()}`,
      animeId: anime.id,
      userName: activeProfileName,
      userAvatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${activeProfileName}`,
      rating: userRating,
      comment: userComment.trim(),
      date: 'Baru saja',
    };
    const updatedAll = storageService.addReview(anime.id, newRev);
    setReviews(updatedAll[anime.id] || []);
    setUserComment('');
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const similarAnimes = allAnimes
    .filter((a) => a.id !== anime.id && a.genres.some((g) => anime.genres.includes(g)))
    .slice(0, 6);

  return (
    <div className="min-h-screen pt-28 sm:pt-32 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-in fade-in duration-300">
      {/* Back button & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-neutral-800/60">
        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg border border-neutral-700 hover:border-neutral-500 shadow-md transition-all text-xs font-semibold cursor-pointer active:scale-95"
            title="Kembali ke Halaman Beranda"
          >
            <ArrowLeft className="w-4 h-4 text-red-500" />
            <span>Kembali ke Beranda</span>
          </button>
          <span className="hidden sm:inline text-neutral-600">/</span>
          <span className="hidden sm:inline text-neutral-400">Anime</span>
          <span className="hidden sm:inline text-neutral-600">/</span>
          <span className="text-neutral-200 font-semibold truncate max-w-xs">{anime.title}</span>
        </div>
      </div>

      {/* Hero Banner Section (Standalone Page Header) */}
      <div className="relative w-full aspect-[21/9] min-h-[380px] max-h-[520px] rounded-2xl overflow-hidden shadow-2xl border border-neutral-800 bg-neutral-950">
        <img
          src={anime.bannerUrl || anime.posterUrl}
          alt={anime.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center filter brightness-95"
        />
        {/* Scrim Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/90 via-neutral-950/40 to-transparent w-full md:w-3/4" />

        {/* Content Overlay */}
        <div className="absolute bottom-6 left-6 right-6 sm:bottom-10 sm:left-10 sm:right-10 flex flex-col justify-end space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
            <span className="text-red-500 font-display text-lg tracking-wider">NEKOFLIX ORIGINAL</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-400 font-medium">{anime.studio}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight drop-shadow-md">
            {anime.title}
          </h1>

          {anime.japaneseTitle && (
            <p className="text-sm text-neutral-300 font-medium">
              {anime.japaneseTitle}
            </p>
          )}

          {/* Clean Unboxed Metadata */}
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-neutral-300 font-medium pt-1">
            <span className="text-emerald-400 font-bold tabular-nums">{anime.matchPercentage || 98}% Cocok</span>
            <span aria-hidden="true" className="text-neutral-500">·</span>
            <span>{anime.year}</span>
            <span aria-hidden="true" className="text-neutral-500">·</span>
            <span className="border border-neutral-700 px-1.5 py-0.5 rounded text-[11px]">{anime.ageRating}</span>
            <span aria-hidden="true" className="text-neutral-500">·</span>
            <span>{anime.episodesCount} Episode</span>
            <span aria-hidden="true" className="text-neutral-500">·</span>
            <span className="border border-neutral-700 px-1.5 py-0.5 rounded text-[11px]">{anime.quality}</span>
            <span aria-hidden="true" className="text-neutral-500">·</span>
            <span className="text-amber-400 font-bold tabular-nums">★ {anime.rating.toFixed(1)}</span>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onPlay(anime, 1)}
              className="flex items-center gap-2 px-6 py-2.5 bg-white text-neutral-950 font-bold rounded-lg hover:bg-neutral-200 transition-all active:scale-95 shadow-lg text-sm"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Putar Episode 1</span>
            </button>

            <button
              onClick={() => onToggleWatchlist(anime.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                isInWatchlist
                  ? 'bg-neutral-800 text-red-500 border-red-500'
                  : 'bg-neutral-900/80 text-white border-neutral-700 hover:bg-neutral-800'
              }`}
            >
              {isInWatchlist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{isInWatchlist ? 'Tersimpan di Daftar' : 'Tambah ke Daftar'}</span>
            </button>

            <button
              onClick={() => onToggleFavorite(anime.id)}
              className={`p-2.5 rounded-lg border transition-all ${
                isFavorite
                  ? 'bg-neutral-800 text-red-500 border-red-500'
                  : 'bg-neutral-900/80 text-white border-neutral-700 hover:bg-neutral-800'
              }`}
              title={isFavorite ? 'Disukai' : 'Suka'}
            >
              <ThumbsUp className="w-4 h-4" />
            </button>

            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-neutral-900/80 text-neutral-300 hover:text-white border border-neutral-700 hover:bg-neutral-800 transition-colors text-sm"
              title="Salin tautan anime ini"
            >
              <Share2 className="w-4 h-4" />
              <span>{copiedShare ? 'Tautan Disalin!' : 'Bagikan'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overview & Metadata Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 bg-neutral-900/40 border border-neutral-800/80 rounded-2xl p-6 sm:p-8">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-base font-bold text-white">Sinopsis</h3>
          <p className="text-sm text-neutral-300 leading-relaxed">
            {anime.description}
          </p>
        </div>

        <div className="text-xs space-y-2.5 text-neutral-400 border-t lg:border-t-0 lg:border-l border-neutral-800 pt-6 lg:pt-0 lg:pl-8">
          <div>
            <span className="text-neutral-500 block mb-0.5">Studio Produksi</span>
            <span className="text-neutral-200 font-semibold text-sm">{anime.studio}</span>
          </div>
          <div>
            <span className="text-neutral-500 block mb-0.5">Genre</span>
            <span className="text-neutral-200 font-medium">{anime.genres.join(', ')}</span>
          </div>
          <div>
            <span className="text-neutral-500 block mb-0.5">Musim & Tahun</span>
            <span className="text-neutral-200">{anime.season} ({anime.year})</span>
          </div>
          <div>
            <span className="text-neutral-500 block mb-0.5">Audio & Sulih Suara</span>
            <span className="text-neutral-200">{anime.audioLanguages.join(', ')}</span>
          </div>
          <div>
            <span className="text-neutral-500 block mb-0.5">Teks Subtitle</span>
            <span className="text-neutral-200">{anime.subtitleLanguages.join(', ')}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-800">
        <div className="flex items-center gap-8 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('episodes')}
            className={`pb-3 transition-colors ${
              activeTab === 'episodes'
                ? 'text-white border-b-2 border-red-600'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Episode ({anime.episodes.length})
          </button>
          <button
            onClick={() => setActiveTab('similar')}
            className={`pb-3 transition-colors ${
              activeTab === 'similar'
                ? 'text-white border-b-2 border-red-600'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Anime Serupa
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`pb-3 transition-colors ${
              activeTab === 'reviews'
                ? 'text-white border-b-2 border-red-600'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Ulasan Komunitas ({reviews.length})
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`pb-3 transition-colors ${
              activeTab === 'about'
                ? 'text-white border-b-2 border-red-600'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Detail Produksi
          </button>
        </div>
      </div>

      {/* Tab 1: Episode List */}
      {activeTab === 'episodes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-bold text-white">Semua Episode</h4>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 text-xs text-neutral-200 rounded px-3 py-1.5 focus:outline-none"
            >
              <option value="Season 1">Season 1 ({anime.episodesCount} Ep)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {anime.episodes.map((ep) => (
              <div
                key={ep.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-neutral-900/50 hover:bg-neutral-800/60 border border-neutral-800/80 rounded-xl transition-all group"
              >
                <div className="flex items-start gap-4 flex-1">
                  <span className="text-xl font-bold text-neutral-400 group-hover:text-white tabular-nums w-8 shrink-0 pt-2">
                    {ep.episodeNumber}
                  </span>

                  {/* Thumbnail with direct Play trigger */}
                  <div
                    onClick={() => onPlay(anime, ep.episodeNumber)}
                    className="relative w-36 sm:w-48 aspect-video bg-neutral-800 rounded-lg overflow-hidden shrink-0 cursor-pointer shadow-md group-hover:ring-1 group-hover:ring-red-500 transition-all"
                  >
                    <img
                      src={ep.thumbnailUrl || anime.posterUrl}
                      alt={ep.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-8 h-8 text-white fill-current" />
                    </div>
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-neutral-950/80 text-[10px] font-mono text-neutral-300 rounded">
                      {ep.duration}
                    </span>
                  </div>

                  {/* Title & Synopsis */}
                  <div className="space-y-1.5">
                    <h5
                      onClick={() => onPlay(anime, ep.episodeNumber)}
                      className="text-sm sm:text-base font-bold text-neutral-200 hover:text-red-400 cursor-pointer transition-colors"
                    >
                      {ep.title}
                    </h5>
                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                      {ep.synopsis}
                    </p>
                  </div>
                </div>

                {/* Direct Actions: Play & Download */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => onPlay(anime, ep.episodeNumber)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-neutral-200 rounded-lg text-xs font-bold transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Tonton</span>
                  </button>
                  <button
                    onClick={() => onStartDownload(anime, ep)}
                    className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-700/60 transition-colors"
                    title="Unduh untuk Ditonton Offline"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Similar Anime */}
      {activeTab === 'similar' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {similarAnimes.map((sim) => (
            <div
              key={sim.id}
              onClick={() => onSelectAnime(sim)}
              className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden cursor-pointer hover:border-neutral-600 transition-all p-2 group"
            >
              <div className="aspect-[2/3] rounded-lg overflow-hidden relative">
                <img
                  src={sim.posterUrl}
                  alt={sim.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-amber-400">
                  {sim.rating.toFixed(1)} ★
                </span>
              </div>
              <div className="mt-2 space-y-1">
                <h5 className="text-xs font-bold text-neutral-200 truncate group-hover:text-red-400 transition-colors">
                  {sim.title}
                </h5>
                <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                  <span>{sim.year}</span>
                  <span>·</span>
                  <span>{sim.episodesCount} Ep</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Reviews */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddReview}
            className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3"
          >
            <h5 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-red-500" />
              Tulis Ulasan sebagai {activeProfileName}
            </h5>

            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">Beri Rating:</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setUserRating(star)}
                    className="p-1 text-amber-400 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        star <= userRating ? 'fill-current' : 'text-neutral-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={3}
              value={userComment}
              onChange={(e) => setUserComment(e.target.value)}
              placeholder="Bagikan pendapat kamu tentang animasi, sound design, karakter, atau alur cerita anime ini..."
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-3 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-red-500"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!userComment.trim()}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors"
              >
                Kirim Ulasan
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={rev.userAvatar}
                      alt={rev.userName}
                      className="w-7 h-7 rounded-full bg-neutral-700"
                    />
                    <span className="text-xs font-bold text-neutral-200">{rev.userName}</span>
                  </div>
                  <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{rev.rating}/5</span>
                    <span className="text-neutral-500 text-[10px] ml-2">{rev.date}</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed pl-9">
                  {rev.comment}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Detail Produksi */}
      {activeTab === 'about' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4 text-xs text-neutral-300">
          <h5 className="font-bold text-white text-sm">Informasi Lisensi & Format Penyiaran</h5>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-2">
            <div>
              <span className="text-neutral-500 block mb-1">Studio Animasi</span>
              <span className="font-semibold text-neutral-100 text-sm">{anime.studio}</span>
            </div>
            <div>
              <span className="text-neutral-500 block mb-1">Kualitas Streaming</span>
              <span className="font-semibold text-neutral-100 text-sm">{anime.quality}</span>
            </div>
            <div>
              <span className="text-neutral-500 block mb-1">Status Lisensi</span>
              <span className="font-semibold text-neutral-100 text-sm">Simulcast Resmi Indonesia</span>
            </div>
            <div>
              <span className="text-neutral-500 block mb-1">Klasifikasi Usia</span>
              <span className="font-semibold text-neutral-100 text-sm">{anime.ageRating}</span>
            </div>
            <div>
              <span className="text-neutral-500 block mb-1">Audio Master</span>
              <span className="font-semibold text-neutral-100 text-sm">Stereo & 5.1 Surround</span>
            </div>
            <div>
              <span className="text-neutral-500 block mb-1">Status Penayangan</span>
              <span className="font-semibold text-neutral-100 text-sm">{anime.status}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
