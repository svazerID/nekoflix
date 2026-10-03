import React, { useState } from 'react';
import { X, Cloud, Terminal, Check, Copy, ExternalLink, Zap, Shield, Globe } from 'lucide-react';

interface CloudflareDeployModalProps {
  onClose: () => void;
}

export const CloudflareDeployModal: React.FC<CloudflareDeployModalProps> = ({ onClose }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard?.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const steps = [
    {
      title: '1. Kompilasi & Build Berkas Statis',
      desc: 'Bangun aset produksi React SPA ke dalam direktori dist/',
      cmd: 'npm run build',
    },
    {
      title: '2. Deploy ke Cloudflare Pages via Wrangler',
      desc: 'Unggah dist/ langsung ke 300+ lokasi Edge Data Center Cloudflare di seluruh dunia',
      cmd: 'npx wrangler pages deploy dist --project-name=nekoflix-anime-streaming',
    },
    {
      title: '3. Jalankan Pengujian Lokal (Opsional)',
      desc: 'Pratinjau build Cloudflare Pages di server lokal',
      cmd: 'npx wrangler pages dev dist',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-10 text-neutral-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800 bg-neutral-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Panduan Deploy Cloudflare Pages</h3>
              <p className="text-xs text-neutral-400">Hosting statis global via Wrangler CLI & CDN Edge</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar text-xs">
          {/* Highlights */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
              <Zap className="w-4 h-4 text-amber-400" />
              <div className="font-bold text-white text-xs">Performa Instan</div>
              <div className="text-[11px] text-neutral-400">Pemuatan aset &lt;2 detik di CDN global Cloudflare</div>
            </div>
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
              <Shield className="w-4 h-4 text-emerald-400" />
              <div className="font-bold text-white text-xs">SSL Otomatis</div>
              <div className="text-[11px] text-neutral-400">Sertifikat HTTPS gratis & proteksi DDoS bawaan</div>
            </div>
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
              <Globe className="w-4 h-4 text-cyan-400" />
              <div className="font-bold text-white text-xs">Domain Kustom</div>
              <div className="text-[11px] text-neutral-400">Dukungan domain kustom & sub-domain .pages.dev</div>
            </div>
          </div>

          {/* Config file snippet */}
          <div>
            <div className="font-semibold text-neutral-300 mb-1.5 flex items-center justify-between">
              <span>Berkas Konfigurasi: wrangler.toml</span>
              <span className="text-[10px] text-emerald-400 font-mono">Tersedia di Root Direktori</span>
            </div>
            <pre className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg font-mono text-[11px] text-neutral-300 overflow-x-auto">
{`name = "nekoflix-anime-streaming"
compatibility_date = "2024-09-23"
pages_build_output_dir = "dist"`}
            </pre>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <div className="font-semibold text-neutral-300">Langkah-langkah Eksekusi Wrangler:</div>
            {steps.map((step, idx) => (
              <div key={idx} className="p-3.5 rounded-lg bg-neutral-950/70 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">{step.title}</span>
                  <span className="text-[11px] text-neutral-500">{step.desc}</span>
                </div>
                <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 font-mono text-[11px] text-amber-300">
                  <span className="truncate mr-2">$ {step.cmd}</span>
                  <button
                    onClick={() => copyToClipboard(step.cmd, idx)}
                    className="p-1 hover:text-white text-neutral-400 shrink-0 transition-colors"
                    title="Salin Perintah"
                  >
                    {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
