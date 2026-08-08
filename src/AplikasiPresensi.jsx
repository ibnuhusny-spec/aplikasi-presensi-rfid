import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { audioPlayer } from './utils/audio';
import ModalLaporan from './components/ModalLaporan';
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
  Maximize2
} from 'lucide-react';

export default function AplikasiPresensi() {
  const [inputUID, setInputUID] = useState('');
  const [status, setStatus] = useState({ type: 'idle', pesan: 'Silakan tempelkan kartu RFID' });
  const [dataProfil, setDataProfil] = useState(null);
  
  // State untuk mode izin keluar khusus
  const [modeIzinAktif, setModeIzinAktif] = useState(false); 
  
  // State untuk Modal Laporan & Audio Mute & Riwayat
  const [isModalLaporanOpen, setIsModalLaporanOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [riwayatPresensi, setRiwayatPresensi] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const inputRef = useRef(null);

  // Clock Update setiap 1 detik
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. useEffect untuk Auto-Focus & Auto-Refocus Input RFID
  useEffect(() => {
    const focusInput = () => {
      if (inputRef.current && !isModalLaporanOpen) {
        inputRef.current.focus();
      }
    };
    
    focusInput();

    const handleGlobalClick = (e) => {
      if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && !isModalLaporanOpen) {
        focusInput();
      }
    };

    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [isModalLaporanOpen]);

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
          resetLayar(3000); // 3 DETIK TEPAT SANGAT CEPAT
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
        resetLayar(3000); // 3 DETIK TEPAT
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
         resetLayar(3000); // 3 DETIK TEPAT
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
          resetLayar(3000); // 3 DETIK TEPAT
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

    // 9. Reset Layar TEPAT 3 DETIK (3000ms) agar murid tidak antre
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      
      {/* Background Neon Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* HEADER BAR */}
      <header className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/60 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent flex items-center gap-2">
              Sistem Presensi RFID
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Murid & Guru
              </span>
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              {isSupabaseConfigured ? (
                <span className="text-emerald-400 font-medium">Terhubung ke Supabase</span>
              ) : (
                <span className="text-amber-400 font-medium">Demo Mode (Mock Database)</span>
              )}
            </p>
          </div>
        </div>

        {/* Buttons & Realtime Clock */}
        <div className="flex items-center gap-3">
          
          {/* Tombol Buka Modal Laporan */}
          <button
            onClick={() => setIsModalLaporanOpen(true)}
            className="px-3.5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-cyan-900/30"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Laporan & Ekspor
          </button>

          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 text-slate-300 transition-colors"
            title={isMuted ? "Unmute Audio" : "Mute Audio"}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
          </button>

          <div className="text-right pl-2 border-l border-slate-800 hidden sm:block">
            <div className="text-xl font-extrabold tracking-wider text-cyan-400 font-mono">
              {jamFormatted}
            </div>
            <div className="text-[10px] text-slate-400">{tanggalFormatted}</div>
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
              ? 'bg-emerald-950/40 border-emerald-500/50 shadow-emerald-950/50' 
              : status.type === 'error'
              ? 'bg-rose-950/40 border-rose-500/50 shadow-rose-950/50'
              : status.type === 'warning'
              ? 'bg-amber-950/40 border-amber-500/50 shadow-amber-950/50'
              : 'bg-slate-900/40 border-slate-800 shadow-slate-950/50'
          }`}>
            
            {/* Mode Izin Badge Indicator */}
            {modeIzinAktif && (
              <div className="absolute top-4 left-4 bg-amber-500/20 border border-amber-500/50 text-amber-300 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 animate-pulse">
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
                status.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 ring-4 ring-emerald-500/40 scale-110' :
                status.type === 'error' ? 'bg-rose-500/20 text-rose-400 ring-4 ring-rose-500/40 scale-110' :
                status.type === 'warning' ? 'bg-amber-500/20 text-amber-400 ring-4 ring-amber-500/40' :
                status.type === 'loading' ? 'bg-cyan-500/20 text-cyan-400 animate-spin' :
                'bg-slate-800/80 text-cyan-400 animate-pulse-ring'
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
              status.type === 'success' ? 'text-emerald-300' :
              status.type === 'error' ? 'text-rose-300' :
              status.type === 'warning' ? 'text-amber-300' : 'text-slate-100'
            }`}>
              {status.pesan}
            </h2>

            <p className="text-xs text-slate-400 mt-2 font-medium">
              {status.type === 'idle' ? 'Silakan tempelkan kartu RFID pada scanner' : 'Memproses cepat (Reset otomatis 3 detik)...'}
            </p>
          </div>

          {/* Admin Control Bar & Simulation Buttons */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-cyan-400" />
                  Kontrol Akses Satpam / Guru
                </h3>
                <p className="text-xs text-slate-400">Aktifkan untuk memberikan izin keluar khusus di luar jam operasional</p>
              </div>

              <button
                onClick={() => setModeIzinAktif(!modeIzinAktif)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  modeIzinAktif 
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/25' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                {modeIzinAktif ? 'Mode Izin Keluar: AKTIF' : 'Aktifkan Mode Izin Keluar'}
              </button>
            </div>

            {/* RFID Test Simulator Buttons (Grouped by Murid & Guru) */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Simulasi Scan Kartu RFID (Klik untuk menguji tampilan):
              </p>

              {/* Murid Buttons */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                  <GraduationCap className="w-3.5 h-3.5" /> Murid:
                </span>
                <button 
                  onClick={() => simulasiScan('10012024')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-cyan-950 hover:border-cyan-500/50 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 transition-all"
                >
                  Ahmad Dahlan (XII IPA 1)
                </button>
                <button 
                  onClick={() => simulasiScan('10012025')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-cyan-950 hover:border-cyan-500/50 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 transition-all"
                >
                  Siti Nurhaliza (XI IPS 2)
                </button>
                <button 
                  onClick={() => simulasiScan('10012028')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-cyan-950 hover:border-cyan-500/50 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 transition-all"
                >
                  Rizky Febian (X 3)
                </button>
              </div>

              {/* Guru Buttons */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                  <Briefcase className="w-3.5 h-3.5" /> Guru:
                </span>
                <button 
                  onClick={() => simulasiScan('10012026')}
                  className="px-3 py-1.5 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/40 rounded-lg text-xs font-medium text-purple-200 transition-all"
                >
                  Budi Santoso, M.Pd. (Matematika)
                </button>
                <button 
                  onClick={() => simulasiScan('10012029')}
                  className="px-3 py-1.5 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/40 rounded-lg text-xs font-medium text-purple-200 transition-all"
                >
                  Dra. Endang Rahayu (B. Indo)
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: ATTENDANCE HISTORY LOG & TIME INFO (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Rules / Operational Hours Box */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-cyan-400" />
              Aturan Jam Operasional
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex justify-between items-center bg-slate-800/60 p-2.5 rounded-xl border border-slate-800">
                <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                  <LogIn className="w-3.5 h-3.5" /> Absen Masuk:
                </span>
                <span className="font-mono text-slate-300 font-semibold">05:00 - 11:59 WIB</span>
              </li>
              <li className="flex justify-between items-center bg-slate-800/60 p-2.5 rounded-xl border border-slate-800">
                <span className="flex items-center gap-1.5 font-medium text-blue-400">
                  <LogOut className="w-3.5 h-3.5" /> Absen Pulang:
                </span>
                <span className="font-mono text-slate-300 font-semibold">12:00 - 17:00 WIB</span>
              </li>
              <li className="flex justify-between items-center bg-slate-800/60 p-2.5 rounded-xl border border-slate-800">
                <span className="flex items-center gap-1.5 font-medium text-amber-400">
                  <ShieldAlert className="w-3.5 h-3.5" /> Mode Izin:
                </span>
                <span className="text-slate-400 text-right">Bisa Kapan Saja</span>
              </li>
            </ul>
          </div>

          {/* Realtime Attendance History */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md flex-1 flex flex-col">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-cyan-400" />
              Riwayat Presensi Terakhir
            </h3>
            
            {riwayatPresensi.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <History className="w-8 h-8 mb-2 stroke-1" />
                <p className="text-xs">Belum ada aktivitas presensi hari ini.</p>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1">
                {riwayatPresensi.map((log) => (
                  <div key={log.id} className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-200">{log.nama}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          log.peran === 'guru' ? 'bg-purple-500/20 text-purple-300' : 'bg-cyan-500/20 text-cyan-300'
                        }`}>
                          {log.peran.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">{log.kelas}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        log.jenis === 'masuk' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        log.jenis === 'pulang' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {log.jenis.toUpperCase()}
                      </span>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">{log.waktu}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </main>

      {/* FULLSCREEN HERO KIOSK DISPLAY OVERLAY (TAMPIL BUKAN 6 DETIK TAPI HANYA 3 DETIK) */}
      {dataProfil && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-300">
          
          {/* Header Badge Status Presensi Raksasa */}
          <div className="mb-6">
            <div className={`px-8 py-3 rounded-full text-xl sm:text-2xl font-black uppercase tracking-widest flex items-center gap-3 shadow-2xl animate-bounce ${
              status.type === 'success' ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/50' :
              status.type === 'warning' ? 'bg-amber-500 text-slate-950 shadow-amber-500/50' :
              'bg-rose-500 text-white shadow-rose-500/50'
            }`}>
              {status.type === 'success' && <CheckCircle2 className="w-8 h-8" />}
              {status.type === 'warning' && <AlertTriangle className="w-8 h-8" />}
              {status.type === 'error' && <XCircle className="w-8 h-8" />}
              {status.pesan.split(',')[0] || 'PRESENSI BERHASIL'}
            </div>
          </div>

          {/* Foto Profil Raksasa & Glow Ring */}
          <div className="relative mb-6">
            <div className={`w-44 h-44 sm:w-56 sm:h-56 rounded-3xl overflow-hidden ring-8 p-1.5 bg-slate-900 shadow-2xl transition-all ${
              dataProfil.peran === 'guru' ? 'ring-purple-500 shadow-purple-500/40' : 'ring-cyan-500 shadow-cyan-500/40'
            }`}>
              <img 
                src={dataProfil.foto_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'} 
                alt={dataProfil.nama_lengkap}
                className="w-full h-full object-cover rounded-2xl"
              />
            </div>
            
            {/* Badge Peran (GURU vs MURID) */}
            <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-xl border ${
              dataProfil.peran === 'guru' 
                ? 'bg-purple-600 text-white border-purple-400' 
                : 'bg-cyan-500 text-slate-950 border-cyan-300'
            }`}>
              {dataProfil.peran === 'guru' ? <Briefcase className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
              {(dataProfil.peran || 'murid').toUpperCase()}
            </div>
          </div>

          {/* Detail Informasi Raksasa */}
          <div className="text-center max-w-2xl">
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-2">
              {dataProfil.nama_lengkap}
            </h2>
            
            <div className="flex flex-wrap items-center justify-center gap-3 text-slate-300 text-sm sm:text-lg font-medium mt-2">
              <span className="bg-slate-900/80 px-4 py-1.5 rounded-xl border border-slate-800 text-cyan-300 font-semibold">
                {dataProfil.kelas_jabatan || 'Siswa'}
              </span>
              <span className="bg-slate-900/80 px-4 py-1.5 rounded-xl border border-slate-800 font-mono text-slate-300">
                {dataProfil.peran === 'guru' ? 'NIP' : 'NISN'}: {dataProfil.nip_nisn || '-'}
              </span>
            </div>

            <p className="text-sm sm:text-base text-slate-400 mt-4 font-mono">
              Waktu Tap: <strong className="text-cyan-400 font-bold">{jamFormatted}</strong> WIB &bull; RFID: <code className="text-slate-300">{dataProfil.rfid_uid}</code>
            </p>
          </div>

          {/* Countdown Indicator (3 Detik Reset) */}
          <div className="mt-8 flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 px-4 py-2 rounded-full border border-slate-800">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></div>
            Reset layar otomatis dalam 3 detik untuk tap berikutnya...
          </div>

        </div>
      )}

      {/* Modal Laporan Presensi */}
      <ModalLaporan 
        isOpen={isModalLaporanOpen} 
        onClose={() => setIsModalLaporanOpen(false)} 
      />

      {/* FOOTER BAR */}
      <footer className="text-center text-xs text-slate-500 border-t border-slate-900 pt-4 mt-2 relative z-10">
        Aplikasi Presensi RFID Murid & Guru &bull; Powered by React, Supabase & Vercel
      </footer>

    </div>
  );
}
