import React from 'react';
import { ArrowRight, ShieldCheck, MapPin, Building, Award } from 'lucide-react';

export default function SplashScreen({ onStart }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col justify-between p-6 sm:p-10 overflow-hidden select-none animate-in fade-in duration-500">
      
      {/* Background Glow Ornaments */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/2 -right-32 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Header Badge */}
      <div className="flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-4 py-1.5 rounded-full text-xs text-cyan-400 font-medium backdrop-blur-md">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Sistem Presensi Digital RFID Resmi
        </div>

        <div className="text-right text-xs text-slate-400 font-mono">
          V1.0 &bull; 2026 Edition
        </div>
      </div>

      {/* Main Center Content: Logo & School Identity */}
      <div className="flex flex-col items-center text-center my-auto relative z-10 max-w-3xl mx-auto py-6">
        
        {/* Logo 1:1 Display with Glow Ring */}
        <div className="relative mb-8 group">
          <div className="absolute -inset-1.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 rounded-3xl blur-lg opacity-70 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 bg-slate-900 border border-slate-700/80 rounded-3xl p-3 shadow-2xl flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="Logo SDIT Qurratu A'yun Al-Islami" 
              className="w-full h-full object-contain drop-shadow-xl"
              onError={(e) => {
                // Fallback icon jika file logo belum terbaca
                e.target.style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* School Name Heading */}
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-2 leading-tight">
          <span className="bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
            SDIT Qurratu A'yun Al-Islami
          </span>
        </h1>

        <p className="text-sm sm:text-lg text-cyan-300 font-semibold mb-4 tracking-wide uppercase">
          Kabupaten Maros
        </p>

        {/* Alamat Lengkap */}
        <p className="text-xs sm:text-sm text-slate-300 max-w-xl flex items-center justify-center gap-1.5 mb-6">
          <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          Jalan Poros Makassar - Maros Km. 26 Maccopa, Kabupaten Maros, Sulawesi Selatan.
        </p>

        {/* Identity Badges (NPSN & NSS) */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <div className="bg-slate-900/90 border border-slate-800 px-4 py-1.5 rounded-xl text-xs font-mono text-slate-300 flex items-center gap-2">
            <Award className="w-3.5 h-3.5 text-cyan-400" />
            <span>NPSN: <strong className="text-white">69728677</strong></span>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 px-4 py-1.5 rounded-xl text-xs font-mono text-slate-300 flex items-center gap-2">
            <Building className="w-3.5 h-3.5 text-cyan-400" />
            <span>NSS: <strong className="text-white">102190101020</strong></span>
          </div>
        </div>

        {/* Button to enter system */}
        <button
          onClick={onStart}
          className="px-8 py-4 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-slate-950 font-black rounded-2xl text-sm sm:text-base flex items-center gap-3 transition-all transform hover:scale-105 shadow-xl shadow-cyan-900/40 active:scale-95"
        >
          Masuk ke Aplikasi Presensi
          <ArrowRight className="w-5 h-5" />
        </button>

      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] text-slate-500 relative z-10 border-t border-slate-900 pt-3">
        SDIT Qurratu A'yun Al-Islami &bull; Menumbuhkan Generasi Rabbani Berakhlak Mulia & Berprestasi
      </div>

    </div>
  );
}
