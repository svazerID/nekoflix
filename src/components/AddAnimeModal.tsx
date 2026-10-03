import React, { useState } from 'react';
import { X, Plus, Film, Check, AlertCircle } from 'lucide-react';
import { Anime, Episode } from '../types/anime';

interface AddAnimeModalProps {
  onClose: () => void;
  onAddAnime: (anime: Anime) => void;
}

export const AddAnimeModal: React.FC<AddAnimeModalProps> = ({ onClose, onAddAnime }) => {
  const [title, setTitle] = useState('');
  const [japaneseTitle, setJapaneseTitle] = useState('');
  const [description, setDescription] = useState('');
  const [studio, setStudio] = useState('MAPPA');
  const [year, setYear] = useState(2026);
  const [genres, setGenres] = useState('Aksi, Fantasi, Shounen');
  const [rating, setRating] = useState(9.0);
  const [posterUrl, setPosterUrl] = useState('https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80');
  const [bannerUrl, setBannerUrl] = useState('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1400&auto=format&fit=crop&q=80');
  const [videoUrl, setVideoUrl] = useState('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const genreList = genres.split(',').map((g) => g.trim()).filter(Boolean);
    const newId = `custom-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;

    const defaultEpisode: Episode = {
      id: `${newId}-ep-1`,
      animeId: newId,
      episodeNumber: 1,
      title: `Episode 1: Permulaan ${title}`,
      synopsis: `Episode pembuka spektakuler dari ${title}.`,
      thumbnailUrl: bannerUrl || posterUrl,
      duration: '24m',
      durationSeconds: 1440,
      videoUrl: videoUrl.trim() || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      introStart: 60,
      introEnd: 150,
      subtitles: [
        {
          lang: 'id',
          label: 'Bahasa Indonesia',
          cues: [
            { start: 3, end: 8, text: `Selamat datang di ${title}!` },
            { start: 10, end: 18, text: 'Petualangan baru telah dimulai.' },
          ],
        },
        {
          lang: 'en',
          label: 'English',
          cues: [
            { start: 3, end: 8, text: `Welcome to ${title}!` },
          ],
        },
      ],
    };

    const newAnime: Anime = {
      id: newId,
      title: title.trim(),
      japaneseTitle: japaneseTitle.trim() || undefined,
      description: description.trim(),
      studio: studio.trim(),
      year: Number(year) || 2026,
      season: 'Fall 2026',
      genres: genreList.length > 0 ? genreList : ['Aksi', 'Petualangan'],
      rating: Number(rating) || 8.8,
      scoreCount: 15000,
      posterUrl: posterUrl.trim(),
      bannerUrl: bannerUrl.trim(),
      status: 'Ongoing',
      episodesCount: 1,
      ageRating: '16+',
      quality: '4K Ultra HD',
      audioLanguages: ['Jepang (Asli)', 'Indonesia'],
      subtitleLanguages: ['Bahasa Indonesia', 'English'],
      episodes: [defaultEpisode],
      matchPercentage: 97,
    };

    onAddAnime(newAnime);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-10 text-neutral-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800 bg-neutral-950/50">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-red-500" />
            <h3 className="text-base font-bold text-white">Kelola & Tambah Konten Anime (CMS)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar text-xs">
          <div>
            <label className="block text-neutral-300 font-semibold mb-1">Judul Anime (Indonesia/Inggris)</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: DanDaDan / Wind Breaker"
              className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">Judul Jepang (Kanji/Romaji)</label>
            <input
              type="text"
              value={japaneseTitle}
              onChange={(e) => setJapaneseTitle(e.target.value)}
              placeholder="Contoh: ダンダダン"
              className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">Sinopsis</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi cerita anime..."
              className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Studio Animasi</label>
              <input
                type="text"
                value={studio}
                onChange={(e) => setStudio(e.target.value)}
                placeholder="ufotable, MAPPA, Wit Studio"
                className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Tahun Rilis</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-white focus:outline-none focus:border-red-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Genre (Pisahkan dengan koma)</label>
              <input
                type="text"
                value={genres}
                onChange={(e) => setGenres(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Rating Skor (0-10)</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="10"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-white focus:outline-none focus:border-red-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">URL Banner / Backdrop (16:9)</label>
            <input
              type="url"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-white font-mono text-[11px] focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">URL Video Episode 1 (MP4 / WebM)</label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-white font-mono text-[11px] focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded font-medium transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded transition-colors"
            >
              Simpan & Tambah ke Katalog
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
