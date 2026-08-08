import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { audioPlayer } from './utils/audio';
import ModalLaporan from './components/ModalLaporan';
import ModalKelolaUser from './components/ModalKelolaUser';
import SplashScreen from './components/SplashScreen';
import Screensaver from './components/Screensaver';
import { 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldAlert, 
  User, 
  Volume2, 
  VolumeX, 
  KeyRound, 
  Sparkles, 
  LogOut, 
  LogIn,
  AlertTriangle,
  History,
  Database,
  FileSpreadsheet,
  GraduationCap,
  Briefcase,
  UserPlus,
  Sun,
  Moon,
  Home
} from 'lucide-react';

export default function AplikasiPresensi() {
  const [inputUID, setInputUID] = useState('');
  const [status, setStatus] = useState({ type: 'idle', pesan: 'Silakan tempelkan kartu RFID' });
  const [dataProfil, setDataProfil] = useState(null);
  
  // State Splash Screen (Tampil saat aplikasi pertama dibuka)
  const [showSplash, setShowSplash] = useState(true);

  // State Screensaver (1 Menit: 'clock', 5 Menit: 'blackout', Aktif: 'none')
  const [inactivityMode, setInactivityMode] = useState('none');
  const inactivityTimerRef = useRef(null);
  const blackoutTimerRef = useRef(null);

  // State Mode Izin Keluar Khusus Satpam/Guru
  const [modeIzinAktif, setModeIzinAktif] = useState(false); 
  
  // State Mode Tema (Gelap / Terang)
  const [themeMode, setThemeMode] = useState('dark');

  // State Modal & Riwayat
  const [isModalLaporanOpen, setIsModalLaporanOpen] = useState(false);
  const [isModalKelolaOpen, setIsModalKelolaOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [riwayatPresensi, setRiwayatPresensi] = useState([]);
  const [daftarPenggunaAktif, setDaftarPenggunaAktif] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const inputRef = useRef(null);

  // Clock Update setiap 1 detik
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Smart Inactivity Listener (1 Menit Screensaver Jam & 5 Menit Layar Hitam)
  useEffect(() => {
    const resetInactivityTimers = () => {
      // Sembunyikan Screensaver jika sedang tampil
      setInactivityMode('none');

      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (blackoutTimerRef.current) clearTimeout(blackoutTimerRef.current);

      // Timer 1: 60 detik (1 menit) -> Screensaver Jam Digital
      inactivityTimerRef.current = setTimeout(() => {
        setInactivityMode('clock');
      }, 60000);

      // Timer 2: 300 detik (5 menit) -> Layar Hitam Blackout
      blackoutTimerRef.current = setTimeout(() => {
        setInactivityMode('blackout');
      }, 300000);
    };

    // Mulai timer pertama kali
    resetInactivityTimers();

    const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    activityEvents.forEach(evt => window.addEventListener(evt, resetInactivityTimers));

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, resetInactivityTimers));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (blackoutTimerRef.current) clearTimeout(blackoutTimerRef.current);
    };
  }, []);

  // Memuat daftar pengguna untuk tombol simulasi dinamis
  useEffect(() => {
    muatPenggunaSimulasi();
  }, [isModalKelolaOpen]);

  const muatPenggunaSimulasi = async () => {
    try {
      const { data } = await supabase.from('pengguna').select('*');
      if (data) setDaftarPenggunaAktif(data);
    } catch (err) {
      console.error('Error loading users for simulation:', err);
    }
  };

  // 1. useEffect untuk Auto-Focus & Auto-Refocus Input RFID
  useEffect(() => {
    const focusInput = () => {
      if (inputRef.current && !isModalLaporanOpen && !isModalKelolaOpen && !showSplash) {
        inputRef.current.focus();
      }
    };
    
    focusInput();

    const handleGlobalClick = (e) => {
      if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && !isModalLaporanOpen && !isModalKelolaOpen && !showSplash) {
        focusInput();
      }
    };

    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [isModalLaporanOpen, isModalKelolaOpen, showSplash]);

  // 2. Penentu Jenis Absen
  const tentukanJenisAbsen = () => {
    if (modeIzinAktif) return 'izin_pulang';
    const jamSekarang = new Date().getHours();

    if (jamSekarang >= 5 && jamSekarang < 12) {
      return 'masuk';
    } else if (jamSekarang >= 12 && jamSekarang <= 17) {
      return 'pulang';
    } else {
      return 'ditolak_jam_operasional';
    }
  };

  // Helper Pemutar Suara
  const bunyiSuara = (tipe) => {
    if (isMuted) return;
    if (tipe === 'success') audioPlayer.playSuccess();
    if (tipe === 'error') audioPlayer.playError();
    if (tipe === 'warning') audioPlayer.playWarning();
  };

  const tanganiScan = async (e, uidOverride = null) => {
    e?.preventDefault();
    const uidYangDipindai = (uidOverride || inputUID).trim();
    setInputUID('');
    if (!uidYangDipindai) return;

    // Instantly bangkitkan layar jika sedang screensaver / blackout
    setInactivityMode('none');

    setStatus({ type: 'loading', pesan: 'Memverifikasi kartu RFID...' });

    try {
      // 3. Cari Data Pengguna di Database Supabase
      const { data: pengguna, error: errorCari } = await supabase
        .from('pengguna')
        .select('*')
        .eq('rfid_uid', uidYangDipindai)
        .single();

      if (errorCari) {
        console.error('Error Query Supabase:', errorCari);
        if (errorCari.code === 'PGRST301' || errorCari.message?.includes('relation') || errorCari.message?.includes('does not exist')) {
          bunyiSuara('error');
          setStatus({ 
            type: 'error', 
            pesan: 'Tabel "pengguna" belum dibuat di Supabase SQL Editor!' 
          });
          setDataProfil(null);
          resetLayar(3000);
          return;
        }
      }

      if (!pengguna) {
        bunyiSuara('error');
        setStatus({ 
          type: 'error', 
          pesan: `Kartu RFID (${uidYangDipindai}) tidak terdaftar dalam sistem!` 
        });
        setDataProfil(null);
        resetLayar(3000);
        return;
      }

      // 4. Panggil Fungsi Penentu Waktu
      const jenisAbsen = tentukanJenisAbsen();

      // 5. Validasi Jam Operasional
      if (jenisAbsen === 'ditolak_jam_operasional') {
         bunyiSuara('error');
         setStatus({ 
           type: 'error', 
           pesan: 'Di luar jam operasional presensi (Absen: 05:00-17:00)' 
         });
         setDataProfil(pengguna);
         resetLayar(3000);
         return; 
      }

      // 6. Cek Pencegahan "Tap Ganda" (Double Tap)
      const hariIniAwal = new Date(new Date().setHours(0,0,0,0)).toISOString();
      const { data: cekTapGanda } = await supabase
        .from('presensi')
        .select('id')
        .eq('pengguna_id', pengguna.id)
        .eq('jenis_tap', jenisAbsen)
        .gte('waktu_tap', hariIniAwal)
        .limit(1);

      if (cekTapGanda && cekTapGanda.length > 0 && !modeIzinAktif) {
          bunyiSuara('warning');
          const sebutan = jenisAbsen === 'masuk' ? 'MASUK' : 'PULANG';
          setStatus({ 
            type: 'warning', 
            pesan: `${pengguna.nama_lengkap} sudah absen ${sebutan} hari ini!` 
          });
          setDataProfil(pengguna);
          resetLayar(3000);
          return;
      }

      // 7. Simpan ke Database
      const { error: errorSimpan } = await supabase
        .from('presensi')
        .insert([
          { 
            pengguna_id: pengguna.id, 
            jenis_tap: jenisAbsen 
          }
        ]);

      if (errorSimpan) throw errorSimpan;

      // 8. Berikan Umpan Balik Sukses
      bunyiSuara('success');
      const salamPeran = pengguna.peran === 'guru' ? 'Selamat bertugas' : 'Selamat belajar';
      const pesanSukses = jenisAbsen === 'masuk' ? `${salamPeran}` : 
                          jenisAbsen === 'pulang' ? 'Hati-hati di jalan' : 'Izin keluar dicatat';
                          
      setStatus({ 
        type: 'success', 
        pesan: `${pesanSukses}, ${pengguna.nama_lengkap}!` 
      });
      setDataProfil(pengguna);

      // Tambahkan ke log riwayat lokal
      setRiwayatPresensi(prev => [{
        id: Date.now(),
        nama: pengguna.nama_lengkap,
        peran: pengguna.peran || 'murid',
        kelas: pengguna.kelas_jabatan || 'Siswa',
        jenis: jenisAbsen,
        waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }, ...prev.slice(0, 7)]);

      if (modeIzinAktif) setModeIzinAktif(false);

    } catch (error) {
       console.error('Error Presensi:', error);
       bunyiSuara('error');
       setStatus({ 
         type: 'error', 
         pesan: 'Terjadi kesalahan sistem database! Coba lagi.' 
       });
    }

    // 9. Reset Layar TEPAT 3 DETIK (3000ms)
    resetLayar(3000);
  };

  const resetLayar = (ms = 3000) => {
    setTimeout(() => {
      setStatus({ type: 'idle', pesan: 'Silakan tempelkan kartu RFID' });
      setDataProfil(null);
      if (inputRef.current) inputRef.current.focus();
    }, ms);
  };

  const simulasiScan = (uid) => {
    setInputUID(uid);
    tanganiScan(null, uid);
  };

  const jamFormatted = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const tanggalFormatted = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Filter daftar pengguna untuk tombol simulasi
  const muridSimulasi = daftarPenggunaAktif.filter(p => p.peran !== 'guru');
  const guruSimulasi = daftarPenggunaAktif.filter(p => p.peran === 'guru');

  const isDark = themeMode === 'dark';

  return (
    <div className={`min-h-screen flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden transition-colors duration-300 ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      
      {/* 1. TAMPILKAN SPLASH SCREEN SAAT AWAL MEMBUKA APLIKASI */}
      {showSplash && (
        <SplashScreen onStart={() => setShowSplash(false)} />
      )}

      {/* 2. TAMPILKAN SCREENSAVER (1 MENIT: JAM, 5 MENIT: BLACKOUT) */}
      {!showSplash && inactivityMode !== 'none' && (
        <Screensaver 
          mode={inactivityMode} 
          onWakeUp={() => setInactivityMode('none')} 
        />
      )}

      {/* Background Neon Gradients */}
      <div className={`absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
        isDark ? 'bg-cyan-600/20' : 'bg-cyan-300/40'
      }`}></div>
      <div className={`absolute top-1/2 -right-40 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
        isDark ? 'bg-indigo-600/20' : 'bg-blue-300/40'
      }`}></div>

      {/* HEADER BAR */}
      <header className={`flex flex-col sm:flex-row justify-between items-center gap-4 p-4 sm:p-5 rounded-2xl border shadow-xl relative z-10 backdrop-blur-md transition-colors ${
        isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-slate-200 shadow-slate-200/50'
      }`}>
        <div className="flex items-center gap-3">
          {/* Logo Sekolah 1:1 */}
          <div className="w-11 h-11 bg-slate-900 border border-slate-700/80 rounded-xl p-1 shadow-md flex items-center justify-center flex-shrink-0">
            <img 
              src="/logo.png" 
              alt="Logo Sekolah" 
              className="w-full h-full object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <div>
            <h1 className={`text-base sm:text-lg font-bold flex items-center gap-2 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              SDIT Qurratu A'yun Al-Islami
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                isDark ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-cyan-100 text-cyan-800 border-cyan-300'
              }`}>
                Kab. Maros
              </span>
            </h1>
            <p className={`text-[11px] flex items-center gap-1.5 mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Database className="w-3.5 h-3.5 text-cyan-500" />
              {isSupabaseConfigured ? (
                <span className="text-emerald-500 font-medium">Terhubung ke Supabase</span>
              ) : (
                <span className="text-amber-500 font-medium">Demo Mode (Mock Database)</span>
              )}
            </p>
          </div>
        </div>

        {/* Buttons & Realtime Clock */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
          
          {/* Tombol Kembali ke Splash Screen */}
          <button
            onClick={() => setShowSplash(true)}
            className={`p-2.5 rounded-xl border transition-all ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' 
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
            }`}
            title="Tampilkan Beranda Identitas Sekolah (Splash Screen)"
          >
            <Home className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Sakelar Mode Gelap / Terang */}
          <button
            onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
            className={`p-2.5 rounded-xl border transition-all ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400' 
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
            }`}
            title={isDark ? "Ubah ke Mode Terang" : "Ubah ke Mode Gelap"}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* Tombol Kelola User / RFID */}
          <button
            onClick={() => setIsModalKelolaOpen(true)}
            className={`px-3.5 py-2.5 font-bold rounded-xl text-xs flex items-center gap-2 transition-all border ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          >
            <UserPlus className="w-4 h-4 text-cyan-500" />
            Kelola User / RFID
          </button>

          {/* Tombol Buka Modal Laporan */}
          <button
            onClick={() => setIsModalLaporanOpen(true)}
            className="px-3.5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-cyan-900/20"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Laporan & Ekspor
          </button>

          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2.5 rounded-xl border transition-colors ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
            }`}
            title={isMuted ? "Unmute Audio" : "Mute Audio"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-500" />}
          </button>

          <div className={`text-right pl-3 border-l hidden sm:block ${isDark ? 'border-slate-800' : 'border-slate-300'}`}>
            <div className="text-xl font-extrabold tracking-wider text-cyan-500 font-mono">
              {jamFormatted}
            </div>
            <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{tanggalFormatted}</div>
          </div>
        </div>
      </header>

      {/* MAIN SCANNER CARD DISPLAY */}
      <main className="my-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* LEFT COLUMN: SCANNER & STATUS DISPLAY (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Main Status Container */}
          <div className={`p-8 rounded-3xl border backdrop-blur-xl shadow-2xl transition-all duration-500 relative flex flex-col items-center justify-center min-h-[360px] text-center ${
            status.type === 'success' 
              ? (isDark ? 'bg-emerald-950/40 border-emerald-500/50 shadow-emerald-950/50' : 'bg-emerald-50/80 border-emerald-300 shadow-emerald-100')
              : status.type === 'error'
              ? (isDark ? 'bg-rose-950/40 border-rose-500/50 shadow-rose-950/50' : 'bg-rose-50/80 border-rose-300 shadow-rose-100')
              : status.type === 'warning'
              ? (isDark ? 'bg-amber-950/40 border-amber-500/50 shadow-amber-950/50' : 'bg-amber-50/80 border-amber-300 shadow-amber-100')
              : (isDark ? 'bg-slate-900/40 border-slate-800 shadow-slate-950/50' : 'bg-white/80 border-slate-200 shadow-slate-200/50')
          }`}>
            
            {/* Mode Izin Badge Indicator */}
            {modeIzinAktif && (
              <div className="absolute top-4 left-4 bg-amber-500/20 border border-amber-500/50 text-amber-500 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                <ShieldAlert className="w-4 h-4" />
                Mode Izin Keluar Khusus AKTIF
              </div>
            )}

            {/* Hidden Input for RFID Card Reader */}
            <form onSubmit={tanganiScan} className="w-full max-w-sm">
              <input
                ref={inputRef}
                type="text"
                value={inputUID}
                onChange={(e) => setInputUID(e.target.value)}
                placeholder="Scan Kartu RFID..."
                className="opacity-0 absolute pointer-events-none"
                autoComplete="off"
              />
            </form>

            {/* Scanner Visual Icon */}
            <div className="mb-6 relative">
              <div className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 ${
                status.type === 'success' ? 'bg-emerald-500/20 text-emerald-500 ring-4 ring-emerald-500/40 scale-110' :
                status.type === 'error' ? 'bg-rose-500/20 text-rose-500 ring-4 ring-rose-500/40 scale-110' :
                status.type === 'warning' ? 'bg-amber-500/20 text-amber-500 ring-4 ring-amber-500/40' :
                status.type === 'loading' ? 'bg-cyan-500/20 text-cyan-500 animate-spin' :
                (isDark ? 'bg-slate-800/80 text-cyan-400 animate-pulse-ring' : 'bg-slate-100 text-cyan-600 animate-pulse-ring')
              }`}>
                {status.type === 'success' && <CheckCircle2 className="w-14 h-14" />}
                {status.type === 'error' && <XCircle className="w-14 h-14" />}
                {status.type === 'warning' && <AlertTriangle className="w-14 h-14" />}
                {status.type === 'loading' && <Clock className="w-14 h-14" />}
                {status.type === 'idle' && <CreditCard className="w-14 h-14" />}
              </div>
            </div>

            {/* Status Message Text */}
            <h2 className={`text-2xl sm:text-3xl font-extrabold max-w-xl transition-all duration-300 ${
              status.type === 'success' ? (isDark ? 'text-emerald-300' : 'text-emerald-700') :
              status.type === 'error' ? (isDark ? 'text-rose-300' : 'text-rose-700') :
              status.type === 'warning' ? (isDark ? 'text-amber-300' : 'text-amber-700') : (isDark ? 'text-slate-100' : 'text-slate-900')
            }`}>
              {status.pesan}
            </h2>

            <p className={`text-xs mt-2 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {status.type === 'idle' ? 'Silakan tempelkan kartu RFID pada scanner' : 'Memproses cepat (Reset otomatis 3 detik)...'}
            </p>
          </div>

          {/* Admin Control Bar & Simulation Buttons */}
          <div className={`p-5 rounded-2xl border backdrop-blur-md ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-slate-200 shadow-sm'
          }`}>
            <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div>
                <h3 className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  <KeyRound className="w-4 h-4 text-cyan-500" />
                  Kontrol Akses Satpam / Guru
                </h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Aktifkan untuk memberikan izin keluar khusus di luar jam operasional</p>
              </div>

              <button
                onClick={() => setModeIzinAktif(!modeIzinAktif)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  modeIzinAktif 
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/25' 
                    : (isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300')
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                {modeIzinAktif ? 'Mode Izin Keluar: AKTIF' : 'Aktifkan Mode Izin Keluar'}
              </button>
            </div>

            {/* RFID Test Simulator Buttons */}
            <div className="space-y-3">
              <p className={`text-xs font-semibold flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                Simulasi Scan Kartu RFID (Klik untuk menguji):
              </p>

              {/* Murid Buttons */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[11px] font-bold text-cyan-500 uppercase tracking-wider flex items-center gap-1 mr-1">
                  <GraduationCap className="w-3.5 h-3.5" /> Murid:
                </span>
                {muridSimulasi.map(m => (
                  <button 
                    key={m.id}
                    onClick={() => simulasiScan(m.rfid_uid)}
                    className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition-all ${
                      isDark ? 'bg-slate-800 hover:bg-cyan-950 hover:border-cyan-500/50 border-slate-700 text-slate-200' : 'bg-slate-50 hover:bg-cyan-50 hover:border-cyan-400 border-slate-200 text-slate-700'
                    }`}
                  >
                    {m.nama_lengkap} ({m.kelas_jabatan || 'Siswa'})
                  </button>
                ))}
              </div>

              {/* Guru Buttons */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[11px] font-bold text-purple-500 uppercase tracking-wider flex items-center gap-1 mr-1">
                  <Briefcase className="w-3.5 h-3.5" /> Guru:
                </span>
                {guruSimulasi.map(g => (
                  <button 
                    key={g.id}
                    onClick={() => simulasiScan(g.rfid_uid)}
                    className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition-all ${
                      isDark ? 'bg-purple-950/40 hover:bg-purple-900/60 border-purple-500/40 text-purple-200' : 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-800'
                    }`}
                  >
                    {g.nama_lengkap}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: ATTENDANCE HISTORY LOG & TIME INFO (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Rules / Operational Hours Box */}
          <div className={`p-5 rounded-2xl border backdrop-blur-md ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-slate-200 shadow-sm'
          }`}>
            <h3 className={`text-sm font-bold flex items-center gap-2 mb-3 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              <Clock className="w-4 h-4 text-cyan-500" />
              Aturan Jam Operasional
            </h3>
            <ul className="space-y-2.5 text-xs">
              <li className={`flex justify-between items-center p-2.5 rounded-xl border ${
                isDark ? 'bg-slate-800/60 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <span className="flex items-center gap-1.5 font-medium text-emerald-500">
                  <LogIn className="w-3.5 h-3.5" /> Absen Masuk:
                </span>
                <span className="font-mono font-semibold">05:00 - 11:59 WIB</span>
              </li>
              <li className={`flex justify-between items-center p-2.5 rounded-xl border ${
                isDark ? 'bg-slate-800/60 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <span className="flex items-center gap-1.5 font-medium text-blue-500">
                  <LogOut className="w-3.5 h-3.5" /> Absen Pulang:
                </span>
                <span className="font-mono font-semibold">12:00 - 17:00 WIB</span>
              </li>
              <li className={`flex justify-between items-center p-2.5 rounded-xl border ${
                isDark ? 'bg-slate-800/60 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <span className="flex items-center gap-1.5 font-medium text-amber-500">
                  <ShieldAlert className="w-3.5 h-3.5" /> Mode Izin:
                </span>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Bisa Kapan Saja</span>
              </li>
            </ul>
          </div>

          {/* Realtime Attendance History */}
          <div className={`p-5 rounded-2xl border backdrop-blur-md flex-1 flex flex-col ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-slate-200 shadow-sm'
          }`}>
            <h3 className={`text-sm font-bold flex items-center gap-2 mb-3 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              <History className="w-4 h-4 text-cyan-500" />
              Riwayat Presensi Terakhir
            </h3>
            
            {riwayatPresensi.length === 0 ? (
              <div className={`flex-1 flex flex-col items-center justify-center text-center p-6 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <History className="w-8 h-8 mb-2 stroke-1" />
                <p>Belum ada aktivitas presensi hari ini.</p>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1">
                {riwayatPresensi.map((log) => (
                  <div key={log.id} className={`p-3 rounded-xl border flex justify-between items-center ${
                    isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{log.nama}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          log.peran === 'guru' ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-500'
                        }`}>
                          {log.peran.toUpperCase()}
                        </span>
                      </div>
                      <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{log.kelas}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        log.jenis === 'masuk' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' :
                        log.jenis === 'pulang' ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30' :
                        'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                      }`}>
                        {log.jenis.toUpperCase()}
                      </span>
                      <p className={`text-[10px] font-mono mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{log.waktu}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </main>

      {/* FULLSCREEN HERO KIOSK DISPLAY OVERLAY (SPLIT-SCREEN 50:50 LAYAR TERBAGI DUA KIRI & KANAN) */}
      {dataProfil && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-0 animate-in fade-in duration-300 overflow-hidden select-none">
          
          <div className="w-full h-full grid grid-cols-1 lg:grid-cols-12 relative">

            {/* SISI KIRI (50% LAYAR): FOTO PROFIL RAKSASA HD */}
            <div className={`lg:col-span-6 h-full relative flex items-center justify-center p-6 lg:p-12 overflow-hidden ${
              dataProfil.peran === 'guru' 
                ? 'bg-gradient-to-tr from-purple-950 via-slate-950 to-indigo-950' 
                : 'bg-gradient-to-tr from-cyan-950 via-slate-950 to-blue-950'
            }`}>
              
              {/* Background Glow Effect */}
              <div className={`absolute w-full h-full rounded-full blur-3xl opacity-30 ${
                dataProfil.peran === 'guru' ? 'bg-purple-600' : 'bg-cyan-500'
              }`}></div>

              {/* Foto Raksasa Container */}
              <div className="relative w-full max-w-lg h-full max-h-[85vh] flex flex-col items-center justify-center">
                <div className={`w-full h-full rounded-3xl overflow-hidden ring-8 shadow-2xl p-2 bg-slate-900/80 transition-all ${
                  dataProfil.peran === 'guru' 
                    ? 'ring-purple-500 shadow-purple-500/50' 
                    : 'ring-cyan-500 shadow-cyan-500/50'
                }`}>
                  <img 
                    src={dataProfil.foto_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80'} 
                    alt={dataProfil.nama_lengkap}
                    className="w-full h-full object-cover rounded-2xl shadow-inner"
                  />
                </div>

                {/* Floating Role Tag on Left Bottom */}
                <div className={`absolute bottom-6 px-6 py-2 rounded-full text-sm font-black uppercase tracking-widest flex items-center gap-2 shadow-2xl border ${
                  dataProfil.peran === 'guru' 
                    ? 'bg-purple-600 text-white border-purple-300 shadow-purple-900/50' 
                    : 'bg-cyan-500 text-slate-950 border-cyan-200 shadow-cyan-900/50'
                }`}>
                  {dataProfil.peran === 'guru' ? <Briefcase className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
                  PERAN: {(dataProfil.peran || 'murid').toUpperCase()}
                </div>
              </div>
            </div>

            {/* SISI KANAN (50% LAYAR): BIODATA & STATUS RAKSASA */}
            <div className="lg:col-span-6 h-full bg-slate-900/90 border-l border-slate-800 p-8 lg:p-14 flex flex-col justify-between relative backdrop-blur-xl">
              
              {/* Top Row Status Banner */}
              <div>
                <div className={`w-full py-4 px-6 rounded-2xl text-xl sm:text-3xl font-black uppercase tracking-wider flex items-center justify-center gap-3 shadow-2xl mb-8 animate-bounce ${
                  status.type === 'success' ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/40' :
                  status.type === 'warning' ? 'bg-amber-500 text-slate-950 shadow-amber-500/40' :
                  'bg-rose-500 text-white shadow-rose-500/40'
                }`}>
                  {status.type === 'success' && <CheckCircle2 className="w-9 h-9" />}
                  {status.type === 'warning' && <AlertTriangle className="w-9 h-9" />}
                  {status.type === 'error' && <XCircle className="w-9 h-9" />}
                  {status.pesan.split(',')[0] || 'PRESENSI DICATAT'}
                </div>

                {/* Nama Lengkap Raksasa */}
                <div className="space-y-3">
                  <span className="text-xs uppercase font-mono tracking-widest text-slate-400 block">
                    Nama Lengkap Terdaftar:
                  </span>
                  <h2 className="text-4xl sm:text-6xl font-black text-white leading-tight tracking-tight">
                    {dataProfil.nama_lengkap}
                  </h2>
                </div>
              </div>

              {/* Middle Section: Biodata Card khusus Guru vs Murid */}
              <div className="my-6 space-y-4">
                
                {/* Banner Peran Khas */}
                <div className={`p-6 rounded-2xl border ${
                  dataProfil.peran === 'guru' 
                    ? 'bg-purple-950/40 border-purple-500/40 text-purple-200' 
                    : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                }`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-slate-400 block mb-1">
                        {dataProfil.peran === 'guru' ? 'Jabatan / Mata Pelajaran:' : 'Kelas:'}
                      </span>
                      <p className="text-xl sm:text-2xl font-bold text-white">
                        {dataProfil.kelas_jabatan || 'Siswa'}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs text-slate-400 block mb-1">
                        {dataProfil.peran === 'guru' ? 'NIP Pegawai:' : 'NISN Siswa:'}
                      </span>
                      <p className="text-xl sm:text-2xl font-mono font-bold text-cyan-300">
                        {dataProfil.nip_nisn || '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Info Jam Waktu Tap */}
                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-mono">Waktu Scan Tap:</span>
                  <span className="text-lg font-mono font-extrabold text-cyan-400">{jamFormatted} WIB</span>
                </div>
              </div>

              {/* Bottom Row Countdown Bar (3 Detik Reset) */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></div>
                  Reset otomatis dalam 3 detik untuk murid/guru berikutnya...
                </div>
                <span className="text-xs text-slate-500 font-mono">UID: {dataProfil.rfid_uid}</span>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* Modal Kelola User & Registrasi Kartu RFID */}
      <ModalKelolaUser 
        isOpen={isModalKelolaOpen}
        onClose={() => setIsModalKelolaOpen(false)}
        onDataChange={muatPenggunaSimulasi}
      />

      {/* Modal Laporan Presensi */}
      <ModalLaporan 
        isOpen={isModalLaporanOpen} 
        onClose={() => setIsModalLaporanOpen(false)} 
      />

      {/* FOOTER BAR */}
      <footer className={`text-center text-xs pt-4 mt-2 relative z-10 border-t ${
        isDark ? 'text-slate-500 border-slate-900' : 'text-slate-400 border-slate-200'
      }`}>
        SDIT Qurratu A'yun Al-Islami &bull; Kabupaten Maros &bull; Powered by React, Supabase & Vercel
      </footer>

    </div>
  );
}
