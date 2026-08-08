import React, { useState, useEffect } from 'react';
import { CreditCard, Sparkles, Power } from 'lucide-react';

export default function Screensaver({ mode, onWakeUp }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const jamFormatted = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const tanggalFormatted = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Jika mode Blackout (5 Menit tidak ada aktivitas) -> Layar Hitam Total
  if (mode === 'blackout') {
    return (
      <div 
        onClick={onWakeUp}
        onTouchStart={onWakeUp}
        className="fixed inset-0 z-50 bg-black cursor-pointer flex flex-col justify-end p-6 select-none"
      >
        <div className="opacity-10 hover:opacity-100 transition-opacity duration-500 text-[10px] text-slate-700 flex items-center gap-2">
          <Power className="w-3 h-3 text-emerald-500" />
          Penghemat Monitor Aktif (Sentuh Layar / Scan Kartu untuk Bangun)
        </div>
      </div>
    );
  }

  // Jika mode Clock Screensaver (1 Menit tidak ada aktivitas) -> Jam Digital Raksasa
  return (
    <div 
      onClick={onWakeUp}
      onTouchStart={onWakeUp}
      className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col justify-between p-8 select-none cursor-pointer overflow-hidden animate-in fade-in duration-500"
    >
      {/* Background Subtle Neon Gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 sm:w-[600px] sm:h-[600px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Top Header School Identity */}
      <div className="flex justify-between items-center relative z-10 border-b border-slate-900 pb-4">
        <div className="flex items-center gap-3">
          <img 
            src="/logo.png" 
            alt="Logo Sekolah" 
            className="w-10 h-10 object-contain"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div>
            <h2 className="text-sm font-bold text-white">SDIT Qurratu A'yun Al-Islami</h2>
            <p className="text-[10px] text-slate-400">Kabupaten Maros &bull; NPSN: 69728677</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-cyan-400">
          <CreditCard className="w-3.5 h-3.5" /> Ready Scan Kartu RFID
        </div>
      </div>

      {/* Center Giant Digital Clock */}
      <div className="my-auto text-center relative z-10 py-8">
        
        <p className="text-xs uppercase font-mono tracking-widest text-slate-400 mb-2 flex items-center justify-center gap-1.5">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          {tanggalFormatted}
        </p>

        {/* Jam Raksasa */}
        <h1 className="text-7xl sm:text-9xl font-black font-mono tracking-widest bg-gradient-to-r from-cyan-400 via-blue-300 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_0_50px_rgba(6,182,212,0.3)] my-2">
          {jamFormatted}
        </h1>

        <p className="text-xs sm:text-sm text-slate-400 mt-4 max-w-md mx-auto">
          Tempelkan kartu RFID Anda pada scanner untuk melakukan presensi instan
        </p>

      </div>

      {/* Bottom Running Text Marquee */}
      <div className="relative z-10 border-t border-slate-900 pt-4 overflow-hidden">
        <div className="whitespace-nowrap text-xs text-slate-400 animate-marquee flex gap-8">
          <span>&bull; Selamat Datang di SDIT Qurratu A me-Rabbani &bull;</span>
          <span>Menumbuhkan Generasi Rabbani Berakhlak Mulia & Berprestasi</span>
          <span>&bull; Jam Operasional Absen Masuk: 05:00 - 11:59 WIB</span>
          <span>&bull; Jam Operasional Absen Pulang: 12:00 - 17:00 WIB</span>
        </div>
        <p className="text-[10px] text-slate-600 text-center mt-2">
          Sentuh layar atau gerakkan mouse untuk kembali ke tampilan utama
        </p>
      </div>

    </div>
  );
}
