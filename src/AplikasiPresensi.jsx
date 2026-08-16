import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured, initialMockPengguna, simpanPresensiFlexibel, getDeletedSampleIds } from './lib/supabase';

import { audioPlayer } from './utils/audio';
import { buatPesanTerlambatRingkas, buatPesanIzinKeluar, kirimNotifikasiWA } from './utils/whatsapp';
import { getSchoolSettings, getJamPulangKelas, normalizeTo24Hour } from './utils/settings';
import ModalLaporan from './components/ModalLaporan';
import ModalKelolaUser from './components/ModalKelolaUser';
import ModalLoginAdmin from './components/ModalLoginAdmin';
import PortalWaliKelas from './components/PortalWaliKelas';
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
  UserCheck,
  Sun,

  Moon,
  Home,
  Smartphone,
  Lock,
  Unlock,
  MessageSquare,
  Send,
  Sliders,
  X
} from 'lucide-react';

export default function AplikasiPresensi() {
  const [inputUID, setInputUID] = useState('');
  const [status, setStatus] = useState({ type: 'idle', pesan: 'Silakan tempelkan kartu RFID' });
  const [dataProfil, setDataProfil] = useState(null);
  
  // State Splash Screen (Default Langsung Masuk ke Layar Utama)
  const [showSplash, setShowSplash] = useState(false);

  // State Mode Izin Keluar & Mode Simulasi Bebas Tap & Paksa Jenis Absen
  const [modeIzinAktif, setModeIzinAktif] = useState(false); 
  const [isBebasTapSimulasi, setIsBebasTapSimulasi] = useState(false);
  const [simulasiPaksaJenis, setSimulasiPaksaJenis] = useState('auto'); // 'auto', 'masuk', 'pulang'
  
  // State Tema
  const [themeMode, setThemeMode] = useState('dark');

  // State Pengaturan Sekolah Dinamis
  const [schoolSettings, setSchoolSettings] = useState(getSchoolSettings());

  // State Keamanan Admin
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isModalAdminLoginOpen, setIsModalAdminLoginOpen] = useState(false);
  const [pendingAdminAction, setPendingAdminAction] = useState(null);

  // State Modal & Portal
  const [isModalLaporanOpen, setIsModalLaporanOpen] = useState(false);
  const [isModalKelolaOpen, setIsModalKelolaOpen] = useState(false);
  const [isPortalWaliOpen, setIsPortalWaliOpen] = useState(false);
  
  // State Preview WhatsApp Notifikasi
  const [waModalData, setWaModalData] = useState(null);

  const [isMuted, setIsMuted] = useState(false);
  const [riwayatPresensi, setRiwayatPresensi] = useState([]);
  const [daftarPenggunaAktif, setDaftarPenggunaAktif] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const inputRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    muatPenggunaSimulasi();
    muatRiwayatPresensi();
    setSchoolSettings(getSchoolSettings());

    const handleSettingsUpdate = () => {
      setSchoolSettings(getSchoolSettings());
    };

    const handleHistoryUpdate = () => {
      muatRiwayatPresensi();
    };

    // Auto-polling 2 detik untuk memastikan sinkronisasi seketika dari Laptop ke HP
    const pollInterval = setInterval(() => {
      muatRiwayatPresensi();
    }, 2000);

    // Supabase Realtime Subscription
    let channel = null;
    try {
      channel = supabase
        .channel('realtime_presensi_channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'presensi' },
          () => {
            muatRiwayatPresensi();
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription:', e);
    }

    window.addEventListener('presensi_settings_changed', handleSettingsUpdate);
    window.addEventListener('presensi_history_updated', handleHistoryUpdate);
    window.addEventListener('storage', handleHistoryUpdate);

    return () => {
      clearInterval(pollInterval);
      if (channel) supabase.removeChannel(channel);
      window.removeEventListener('presensi_settings_changed', handleSettingsUpdate);
      window.removeEventListener('presensi_history_updated', handleHistoryUpdate);
      window.removeEventListener('storage', handleHistoryUpdate);
    };
  }, [isModalKelolaOpen, isPortalWaliOpen]);

  const muatRiwayatPresensi = async () => {
    const awalHari = new Date();
    awalHari.setHours(0, 0, 0, 0);
    const awalHariTimestamp = awalHari.getTime();
    const awalHariIso = awalHari.toISOString();
    const todayDateStr = awalHari.toISOString().split('T')[0];

    // Cek tanggal reset harian terakhir
    const lastResetDate = localStorage.getItem('presensi_last_reset_date');
    if (lastResetDate !== todayDateStr) {
      localStorage.setItem('presensi_last_reset_date', todayDateStr);
    }

    // Ambil data riwayat lokal terlebih dahulu & filter KHUSUS HARI INI
    let localItems = [];
    try {
      const saved = localStorage.getItem('presensi_riwayat_lokal');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Purge entri dari hari sebelumnya (hanya pertahankan timestamp >= awalHari)
          localItems = parsed.filter(item => {
            const ts = item.timestamp || (item.waktu ? new Date(item.waktu).getTime() : 0);
            return ts >= awalHariTimestamp;
          });
          // Update storage jika ada entri lama yang dibersihkan
          if (localItems.length !== parsed.length) {
            localStorage.setItem('presensi_riwayat_lokal', JSON.stringify(localItems));
          }
        }
      }
    } catch (e) {}

    const deletedIds = getDeletedSampleIds();

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('presensi')
          .select('*, pengguna:pengguna_id(*)')
          .gte('waktu_tap', awalHariIso)
          .order('waktu_tap', { ascending: false })
          .limit(40);

        if (!error && Array.isArray(data)) {
          const listUser = daftarPenggunaAktif || [];
          const settings = getSchoolSettings();
          const jamMasukStr = settings?.jamMasuk || '07:15';
          const partsMasuk = String(jamMasukStr).split(':');
          const masukH = parseInt(partsMasuk[0], 10) || 7;
          const masukM = parseInt(partsMasuk[1], 10) || 15;

          const itemsSupabase = data
            .filter(item => {
              if (!item) return false;
              const uRel = item.pengguna || {};
              const user = uRel.nama_lengkap ? uRel : (listUser.find(u => String(u.id) === String(item.pengguna_id) || String(u.rfid_uid) === String(item.pengguna_id)) || {});
              const name = user.nama_lengkap || item.nama || '';
              const uid = String(user.rfid_uid || item.rfid_uid || '');
              const id = String(user.id || item.pengguna_id || '');

              if (!name || name === 'Pengguna' || name === 'Pengguna Uji Coba') return false;
              if (deletedIds.includes(name) || deletedIds.includes(uid) || deletedIds.includes(id)) return false;
              return true;
            })
            .map(item => {
              const uRel = item.pengguna || {};
              const user = uRel.nama_lengkap ? uRel : (listUser.find(u => String(u.id) === String(item.pengguna_id) || String(u.rfid_uid) === String(item.pengguna_id)) || {});
              const w = new Date(item.waktu_tap || Date.now());
              const jenis = item.jenis_tap || item.jenis || 'masuk';

              let status = item.status_kehadiran || item.statusKehadiran || 'hadir';
              if (jenis === 'masuk' && status !== 'sakit' && status !== 'izin' && status !== 'alpa') {
                const jamTerlambatLimit = new Date(w);
                jamTerlambatLimit.setHours(masukH, masukM, 0, 0);
                if (w > jamTerlambatLimit) {
                  status = 'terlambat';
                }
              }

              return {
                id: item.id || Date.now(),
                nama: user.nama_lengkap || item.nama || 'Pengguna',
                peran: user.peran || item.peran || 'murid',
                kelas: user.kelas_jabatan || item.kelas || (user.peran === 'guru' ? 'Guru' : 'Siswa'),
                jenis: jenis,
                statusKehadiran: status,
                tanggal: w.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
                waktu: w.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }),
                timestamp: w.getTime()
              };
            });

          // Gabungkan itemsSupabase dengan localItems (hanya entri lokal HARI INI yang belum ada di Supabase)
          const mergedMap = new Map();
          
          localItems.forEach(item => {
            if (!deletedIds.includes(item.nama) && (item.timestamp || 0) >= awalHariTimestamp) {
              const key = `${item.nama}_${item.jenis}_${item.waktu}`;
              mergedMap.set(key, item);
            }
          });

          itemsSupabase.forEach(item => {
            if (!deletedIds.includes(item.nama) && (item.timestamp || 0) >= awalHariTimestamp) {
              const key = `${item.nama}_${item.jenis}_${item.waktu}`;
              mergedMap.set(key, item);
            }
          });

          const mergedList = Array.from(mergedMap.values())
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 50);

          setRiwayatPresensi(mergedList);
          return;
        }
      } catch (err) {
        console.warn('Query Supabase presensi error:', err);
      }
    }

    // 2. Offline / Demo Fallback Mode (Hanya Tampilkan Presensi Hari Ini)
    setRiwayatPresensi(localItems);
  };








  const muatPenggunaSimulasi = async () => {
    try {
      let supaData = [];
      try {
        const { data } = await supabase.from('pengguna').select('*');
        if (Array.isArray(data)) supaData = data;
      } catch (e) {}

      let localData = [];
      try {
        const saved = localStorage.getItem('presensi_mock_pengguna_list');
        if (saved) localData = JSON.parse(saved);
      } catch (e) {}

      const deletedIds = getDeletedSampleIds();

      const uniqueList = [];
      const seenNames = new Set();

      const supaReversed = [...supaData].reverse();
      const localReversed = [...localData].reverse();

      [...supaReversed, ...localReversed].forEach(u => {
        if (!u || !u.nama_lengkap) return;
        const uId = String(u.id || '').trim();
        const uUid = String(u.rfid_uid || '').trim();
        const nameKey = u.nama_lengkap.toLowerCase().trim();

        if (deletedIds.includes(uId) || (uUid && deletedIds.includes(uUid)) || deletedIds.includes(u.nama_lengkap.trim())) {
          return;
        }

        if (!seenNames.has(nameKey)) {
          seenNames.add(nameKey);
          uniqueList.push(u);
        }
      });

      setDaftarPenggunaAktif(uniqueList);
    } catch (err) {
      console.error('Error loading users for simulation:', err);
    }
  };


  useEffect(() => {
    const focusInput = () => {
      if (inputRef.current && !isModalLaporanOpen && !isModalKelolaOpen && !isModalAdminLoginOpen && !isPortalWaliOpen && !showSplash) {
        inputRef.current.focus();
      }
    };
    
    focusInput();

    const handleGlobalClick = (e) => {
      if (!e.target.closest('button') && !e.target.closest('input') && !isModalLaporanOpen && !isModalKelolaOpen && !isModalAdminLoginOpen && !isPortalWaliOpen && !showSplash) {
        focusInput();
      }
    };

    window.addEventListener('click', handleGlobalClick);

    // Global USB RFID Hardware Scanner Keydown Listener (Anti Focus Loss)
    let rfidBuffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e) => {
      const activeEl = document.activeElement;
      if (activeEl && activeEl !== inputRef.current && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
      }
      if (isModalLaporanOpen || isModalKelolaOpen || isModalAdminLoginOpen || isPortalWaliOpen || showSplash) return;

      const now = Date.now();
      if (now - lastKeyTime > 250) {
        rfidBuffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter' || e.key === 'Tab') {
        if (rfidBuffer.trim().length >= 3) {
          e.preventDefault();
          tanganiScan(null, rfidBuffer.trim());
          rfidBuffer = '';
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        rfidBuffer += e.key;
        if (rfidBuffer.trim().length >= 10) {
          const scanned = rfidBuffer.trim();
          rfidBuffer = '';
          setTimeout(() => tanganiScan(null, scanned), 50);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isModalLaporanOpen, isModalKelolaOpen, isModalAdminLoginOpen, isPortalWaliOpen, showSplash]);

  // Penentu Jenis Absen Dinamis (Berdasarkan Pengaturan Jam Masuk & Jam Pulang Kelas)
  const tentukanJenisAbsen = (pengguna) => {
    if (modeIzinAktif) return 'izin_pulang';
    
    try {
      const settings = getSchoolSettings();
      const jamPulangTargetStr = getJamPulangKelas(pengguna?.kelas_jabatan) || '13:00';
      const jamAwalStr = settings?.jamAwalMasuk || '05:00';

      const partsPulang = String(jamPulangTargetStr).split(':');
      const pulangH = parseInt(partsPulang[0], 10) || 13;
      const pulangM = parseInt(partsPulang[1], 10) || 0;

      const partsAwal = String(jamAwalStr).split(':');
      const awalH = parseInt(partsAwal[0], 10) || 5;
      const awalM = parseInt(partsAwal[1], 10) || 0;

      const skr = new Date();
      const totalMenitSkr = skr.getHours() * 60 + skr.getMinutes();
      const totalMenitAwal = awalH * 60 + awalM;
      const totalMenitPulang = pulangH * 60 + pulangM;

      if (totalMenitSkr >= totalMenitAwal && totalMenitSkr < totalMenitPulang) {
        return 'masuk';
      } else if (totalMenitSkr >= totalMenitPulang && skr.getHours() <= 18) {
        return 'pulang';
      } else {
        return 'masuk';
      }
    } catch (err) {
      console.error('Error tentukanJenisAbsen:', err);
      return 'masuk';
    }
  };

  const mintaAksesAdmin = (actionCallback) => {
    if (isAdminLoggedIn) {
      actionCallback();
    } else {
      setPendingAdminAction(() => actionCallback);
      setIsModalAdminLoginOpen(true);
    }
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminLoggedIn(true);
    setIsModalAdminLoginOpen(false);
    if (pendingAdminAction) {
      pendingAdminAction();
      setPendingAdminAction(null);
    }
  };

  const bunyiSuara = (tipe) => {
    try {
      if (isMuted) return;
      if (tipe === 'success') audioPlayer.playSuccess();
      if (tipe === 'error') audioPlayer.playError();
      if (tipe === 'warning') audioPlayer.playWarning();
    } catch (e) {
      console.warn('Audio playback error swallowed:', e);
    }
  };

  const tanganiScan = async (e, uidOverride = null) => {
    e?.preventDefault();
    const uidYangDipindai = (uidOverride || inputUID).trim();
    setInputUID('');
    if (!uidYangDipindai) return;

    setStatus({ type: 'loading', pesan: 'Memverifikasi kartu RFID...' });

    try {
      const normalizeUid = (str) => String(str || '').trim().replace(/^0+/, '').toLowerCase();
      const scannedRaw = String(uidYangDipindai).trim().toLowerCase();
      const scannedNorm = normalizeUid(uidYangDipindai);

      let pengguna = (daftarPenggunaAktif || []).find(p => {
        const pUidRaw = String(p.rfid_uid || '').trim().toLowerCase();
        const pIdRaw = String(p.id || '').trim().toLowerCase();
        if (pUidRaw === scannedRaw || pIdRaw === scannedRaw) return true;

        const pUidNorm = normalizeUid(p.rfid_uid);
        const pIdNorm = normalizeUid(p.id);
        return scannedNorm !== '' && (pUidNorm === scannedNorm || pIdNorm === scannedNorm);
      });

      // Jika tidak ada di memori lokal, coba cari di Supabase
      if (!pengguna && isSupabaseConfigured) {
        try {
          const { data: exactMatch } = await supabase
            .from('pengguna')
            .select('*')
            .eq('rfid_uid', uidYangDipindai)
            .maybeSingle();

          if (exactMatch) {
            pengguna = exactMatch;
          } else if (scannedNorm) {
            const { data: normMatch } = await supabase
              .from('pengguna')
              .select('*')
              .ilike('rfid_uid', `%${scannedNorm}%`)
              .limit(1);
            if (normMatch && normMatch.length > 0) pengguna = normMatch[0];
          }
        } catch (err) {
          console.warn('Query pengguna Supabase:', err);
        }
      }

      // Periksa jika pengguna telah terhapus
      const deletedIds = getDeletedSampleIds();
      if (pengguna && (deletedIds.includes(String(pengguna.id)) || deletedIds.includes(String(pengguna.rfid_uid)) || deletedIds.includes(pengguna.nama_lengkap))) {
        pengguna = null;
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

      const isIzinMode = modeIzinAktif || simulasiPaksaJenis === 'izin';
      const jenisAbsen = isIzinMode 
        ? 'izin_pulang' 
        : ((simulasiPaksaJenis && simulasiPaksaJenis !== 'auto') ? simulasiPaksaJenis : tentukanJenisAbsen(pengguna));

      // Kalkulasi Terlambat Dinamis
      const settings = getSchoolSettings();
      const jamMasukStr = settings?.jamMasuk || '07:15';
      const partsMasuk = String(jamMasukStr).split(':');
      const masukH = parseInt(partsMasuk[0], 10) || 7;
      const masukM = parseInt(partsMasuk[1], 10) || 15;
      
      let statusKehadiran = 'hadir';
      let menitTerlambat = 0;
      const SEKARANG = new Date();
      const jamTerlambatLimit = new Date();
      jamTerlambatLimit.setHours(masukH, masukM, 0, 0);

      if (jenisAbsen === 'izin_pulang' || isIzinMode) {
        statusKehadiran = 'izin';
      } else if (jenisAbsen === 'masuk' && SEKARANG > jamTerlambatLimit) {
        statusKehadiran = 'terlambat';
        const diffMs = SEKARANG - jamTerlambatLimit;
        menitTerlambat = Math.floor(diffMs / 60000);
      }

      // Cek Double Tap di Riwayat Lokal (Instant 0ms)
      if (!isIzinMode && !isBebasTapSimulasi) {
        const awalHariMs = new Date().setHours(0,0,0,0);
        const sudahAbsenDiLokal = riwayatPresensi.some(log => 
          (String(log.nama).toLowerCase() === String(pengguna.nama_lengkap).toLowerCase() || String(log.id) === String(pengguna.id)) &&
          log.jenis === jenisAbsen &&
          (log.timestamp >= awalHariMs)
        );

        if (sudahAbsenDiLokal) {
          bunyiSuara('warning');
          const sebutan = jenisAbsen === 'masuk' ? 'MASUK' : 'PULANG';
          setStatus({ 
            type: 'warning', 
            pesan: `${pengguna.nama_lengkap} sudah absen ${sebutan} hari ini!` 
          });
          setDataProfil(pengguna);
          resetLayar(3500);
          return;
        }
      }

      // 1. RESPONSE UI & AUDIO SECARA INSTAN KILAT (0 MILLISECONDS)!
      bunyiSuara(jenisAbsen === 'izin_pulang' ? 'warning' : (statusKehadiran === 'terlambat' ? 'warning' : 'success'));
      const pesanSukses = jenisAbsen === 'izin_pulang' ? 'Izin Keluar Khusus' : (jenisAbsen === 'masuk' ? 'Selamat Datang' : 'Selamat Jalan');

      setStatus({ 
        type: jenisAbsen === 'izin_pulang' ? 'warning' : (statusKehadiran === 'terlambat' ? 'warning' : 'success'), 
        pesan: `${pesanSukses}, ${pengguna.nama_lengkap}! ${statusKehadiran === 'terlambat' ? `(TERLAMBAT ${menitTerlambat} menit)` : (jenisAbsen === 'izin_pulang' ? '(IZIN DIPROSES)' : '')}` 
      });
      setDataProfil(pengguna);

      // Trigger Notifikasi WA jika Terlambat atau Izin
      if ((statusKehadiran === 'terlambat' || jenisAbsen === 'izin_pulang') && pengguna.peran === 'murid') {
        const waktuTapStr = SEKARANG.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
        const pesanWA = jenisAbsen === 'izin_pulang'
          ? buatPesanIzinKeluar({
              namaSiswa: pengguna.nama_lengkap,
              kelas: pengguna.kelas_jabatan || 'Siswa',
              waktuTap: waktuTapStr
            })
          : buatPesanTerlambatRingkas({
              namaSiswa: pengguna.nama_lengkap,
              kelas: pengguna.kelas_jabatan || 'Siswa',
              waktuTap: waktuTapStr,
              menitTerlambat: menitTerlambat > 0 ? menitTerlambat : 15
            });

        // Cek jika Fonnte Token terisi di pengaturan untuk kirim WA background otomatis
        const settingsNow = getSchoolSettings();
        if (settingsNow?.fonnteToken && settingsNow.fonnteToken.trim() !== '' && pengguna.no_wa_ortu) {
          kirimNotifikasiWA({
            noHp: pengguna.no_wa_ortu,
            pesan: pesanWA,
            apiToken: settingsNow.fonnteToken.trim()
          }).then(res => {
            if (res.success && res.mode === 'api') {
              console.log('WA Otomatis terkirim via Fonnte Gateway!');
            }
          }).catch(err => {
            console.warn('Gagal kirim WA Fonnte:', err);
          });
        }
      }

      const skrg = new Date();
      const itemBaru = {
        id: skrg.getTime(),
        nama: pengguna.nama_lengkap,
        peran: pengguna.peran || 'murid',
        kelas: pengguna.kelas_jabatan || 'Siswa',
        jenis: jenisAbsen,
        statusKehadiran,
        tanggal: skrg.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
        waktu: skrg.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }),
        timestamp: skrg.getTime()
      };

      const newRiwayat = [itemBaru, ...riwayatPresensi.slice(0, 49)];
      setRiwayatPresensi(newRiwayat);
      try {
        localStorage.setItem('presensi_riwayat_lokal', JSON.stringify(newRiwayat));
        window.dispatchEvent(new Event('presensi_history_updated'));
      } catch (e) {}

      resetLayar(4000);

      // 2. SINKRONISASI DATABASE CLOUD SUPABASE SECARA ASYNCHRONOUS DI BACKGROUND (NON-BLOCKING)
      if (isSupabaseConfigured) {
        (async () => {
          try {
            let realPenggunaId = null;
            const { data: dbUser } = await supabase
              .from('pengguna')
              .select('id')
              .eq('rfid_uid', String(pengguna.rfid_uid))
              .maybeSingle();

            if (dbUser && dbUser.id) {
              realPenggunaId = dbUser.id;
            } else {
              const { data: newUser } = await supabase
                .from('pengguna')
                .insert([{
                  rfid_uid: String(pengguna.rfid_uid),
                  nama_lengkap: pengguna.nama_lengkap,
                  peran: pengguna.peran || 'murid',
                  nip_nisn: pengguna.nip_nisn || '',
                  kelas_jabatan: pengguna.kelas_jabatan || 'Siswa',
                  no_wa_ortu: pengguna.no_wa_ortu || '',
                  foto_url: pengguna.foto_url || ''
                }])
                .select('id')
                .maybeSingle();

              if (newUser && newUser.id) realPenggunaId = newUser.id;
            }

            if (realPenggunaId) {
              await simpanPresensiFlexibel({
                pengguna_id: realPenggunaId,
                jenis_tap: jenisAbsen,
                status_kehadiran: statusKehadiran,
                waktu_tap: SEKARANG.toISOString()
              });
            }
          } catch (e) {
            console.warn('Background Supabase Sync:', e);
          }
        })();
      }

      if (modeIzinAktif) setModeIzinAktif(false);

    } catch (error) {
       console.error('Error Presensi:', error);
       bunyiSuara('error');
       setStatus({ 
         type: 'error', 
         pesan: error?.message ? `Error: ${error.message}` : 'Terjadi kesalahan sistem database! Coba lagi.' 
       });
       setDataProfil(null);
    } finally {
       resetLayar(3000);
    }
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

  const eksekusiKirimWA = async () => {
    if (!waModalData) return;
    const res = await kirimNotifikasiWA({
      noHp: waModalData.noHp,
      pesan: waModalData.pesan
    });
    if (res.url) {
      window.open(res.url, '_blank');
    }
    setWaModalData(null);
  };

  const jamFormatted = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const tanggalFormatted = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const muridSimulasi = daftarPenggunaAktif.filter(p => p.peran !== 'guru');
  const guruSimulasi = daftarPenggunaAktif.filter(p => p.peran === 'guru');

  const isDark = themeMode === 'dark';
  const currentSettings = getSchoolSettings();

  return (
    <div className={`min-h-screen w-full overflow-x-auto p-2 sm:p-6 lg:p-8 relative transition-colors duration-300 flex flex-col justify-center items-center ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-gradient-to-br from-slate-200 via-sky-100/80 to-emerald-100/90 text-slate-900'
    }`}>
      
      {showSplash && (
        <SplashScreen onStart={() => setShowSplash(false)} />
      )}

      {/* FLOATING MOBILE APP SHELL CARD (KOTAK PENGAPUNG DI BELAKANG) */}
      <div className={`w-full max-w-sm sm:max-w-2xl xl:max-w-7xl mx-auto my-auto flex flex-col items-stretch space-y-4 sm:space-y-6 p-4 sm:p-6 xl:p-0 rounded-3xl xl:rounded-none border xl:border-0 shadow-2xl xl:shadow-none backdrop-blur-xl transition-all duration-300 ${
        isDark ? 'bg-slate-900/95 border-slate-800/90 shadow-slate-950/80' : 'bg-white/90 border-cyan-200/90 shadow-2xl shadow-cyan-900/10 backdrop-blur-xl'
      }`}>







      {/* HEADER BAR */}
      <header className={`w-full flex flex-col lg:flex-row justify-between items-center gap-4 p-4 sm:p-5 rounded-3xl border shadow-xl relative z-10 backdrop-blur-md transition-colors text-center lg:text-left ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-gradient-to-r from-teal-500/10 via-cyan-50/90 to-emerald-50/80 border-cyan-200/90 shadow-md shadow-cyan-950/5'
      }`}>
        {/* Left Side: Logo & School Info */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto justify-center lg:justify-start text-center lg:text-left">
          <div className="w-12 h-12 flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0">
            <img 
              src="/logo.png" 
              alt="Logo Sekolah" 
              className="w-full h-full object-contain filter drop-shadow-md"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-0.5">
            <h1 className={`text-base sm:text-lg font-extrabold flex flex-wrap items-center justify-center sm:justify-start gap-2 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              <span>SDIT Qurratu A'yun Al-Islami</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border inline-block ${
                isDark ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-cyan-100 text-cyan-800 border-cyan-300'
              }`}>
                Kab. Maros
              </span>
            </h1>
            <p className={`text-[11px] flex items-center justify-center sm:justify-start gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Database className="w-3.5 h-3.5 text-cyan-500" />
              {isSupabaseConfigured ? (
                <span className="text-emerald-400 font-bold">Terhubung ke Supabase</span>
              ) : (
                <span className="text-amber-400 font-bold">Demo Mode</span>
              )}
            </p>
          </div>
        </div>

        {/* Right Side: Action Controls Header */}
        <div className="flex items-center gap-2 flex-wrap justify-center lg:justify-end w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800/80">
          
          <button
            onClick={() => setIsPortalWaliOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-all"
          >
            <Smartphone className="w-4 h-4" />
            <span>Portal HP Wali Kelas</span>
          </button>

          <button
            onClick={() => mintaAksesAdmin(() => setIsModalKelolaOpen(true))}
            className={`px-3.5 py-2 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all border ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-500" />
            <span>Pengaturan & User</span>
          </button>

          <button
            onClick={() => mintaAksesAdmin(() => setIsModalLaporanOpen(true))}
            className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-900/20"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Laporan</span>
          </button>

          <button
            onClick={() => setShowSplash(true)}
            className={`p-2 rounded-xl border transition-all ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' 
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
            }`}
            title="Tampilkan Splash Screen"
          >
            <Home className="w-4 h-4 text-emerald-400" />
          </button>

          <button
            onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
            className={`p-2 rounded-xl border transition-all ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400' 
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
            }`}
            title="Toggle Tema"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          {isAdminLoggedIn ? (
            <button
              onClick={() => setIsAdminLoggedIn(false)}
              className="p-2 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-rose-500/30 transition-all"
              title="Logout Akses Admin"
            >
              <Unlock className="w-4 h-4 text-rose-400" /> Logout
            </button>
          ) : (
            <button
              onClick={() => mintaAksesAdmin(() => {})}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl border border-slate-700"
              title="Login Admin"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}

          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-xl border transition-colors ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
            }`}
            title="Mute / Unmute"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-500" />}
          </button>

          <div className={`text-right pl-3 border-l hidden lg:block ${isDark ? 'border-slate-800' : 'border-slate-300'}`}>
            <div className="text-lg font-extrabold tracking-wider text-cyan-500 font-mono">
              {jamFormatted}
            </div>
            <div className={`text-[9px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{tanggalFormatted}</div>
          </div>
        </div>
      </header>



      {/* MOBILE QUICK NAVIGATION BANNER (Tampilan Khusus HP Guru & Wali Kelas) */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-3.5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 xl:hidden backdrop-blur-md text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 text-center sm:text-left">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 flex-shrink-0 mx-auto">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="text-center sm:text-left">
            <h3 className="text-xs font-bold text-white">Mode HP Wali Kelas / Guru</h3>
            <p className="text-[10px] text-slate-400">Absen murid lupa kartu & tidak hadir</p>
          </div>
        </div>

        <button
          onClick={() => setIsPortalWaliOpen(true)}
          className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap animate-pulse"
        >
          <UserCheck className="w-4 h-4" />
          <span>Buka Portal HP Wali Kelas</span>
        </button>
      </div>



      {/* MAIN DISPLAY */}
      <main className="w-full min-w-0 max-w-full my-6 flex flex-col xl:flex-row gap-6 relative z-10">
        
        {/* LEFT COLUMN */}
        <div className="w-full min-w-0 max-w-full xl:w-8/12 flex flex-col gap-6">
          <div className={`p-4 sm:p-8 rounded-2xl sm:rounded-3xl border backdrop-blur-xl shadow-2xl transition-all duration-500 relative flex flex-col items-center justify-center min-h-[300px] sm:min-h-[360px] text-center ${
            status.type === 'success' 
              ? (isDark ? 'bg-emerald-950/40 border-emerald-500/50 shadow-emerald-950/50' : 'bg-emerald-50/80 border-emerald-300 shadow-emerald-100')
              : status.type === 'error'
              ? (isDark ? 'bg-rose-950/40 border-rose-500/50 shadow-rose-950/50' : 'bg-rose-50/80 border-rose-300 shadow-rose-100')
              : status.type === 'warning'
              ? (isDark ? 'bg-amber-950/40 border-amber-500/50 shadow-amber-950/50' : 'bg-amber-50/80 border-amber-300 shadow-amber-100')
              : (isDark ? 'bg-slate-900/40 border-slate-800 shadow-slate-950/50' : 'bg-white/95 border-cyan-200 shadow-lg shadow-cyan-950/5')
          }`}>
            
            {modeIzinAktif && (
              <div className="absolute top-4 left-4 bg-amber-500/20 border border-amber-500/50 text-amber-500 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                <ShieldAlert className="w-4 h-4" />
                Mode Izin Keluar Khusus AKTIF
              </div>
            )}

            <form onSubmit={tanganiScan} className="w-full max-w-sm">
              <input
                ref={inputRef}
                type="text"
                value={inputUID}
                onChange={(e) => {
                  const val = e.target.value;
                  setInputUID(val);
                  if (val.trim().length >= 10) {
                    const scanned = val.trim();
                    setInputUID('');
                    tanganiScan(null, scanned);
                  }
                }}
                placeholder="Scan Kartu RFID..."
                className="opacity-0 absolute"
                autoComplete="off"
              />
            </form>

            {dataProfil ? (
              <div className="w-full grid grid-cols-1 sm:grid-cols-12 gap-6 p-4 items-center animate-in fade-in zoom-in-95">
                {/* LEFT COLUMN: 4x6 Portrait Frame for Full Un-cropped Photo */}
                <div className="sm:col-span-4 flex flex-col items-center justify-center">
                  <div className={`relative w-36 h-48 sm:w-44 sm:h-60 rounded-3xl p-1.5 shadow-2xl transition-all duration-500 border-2 ${
                    dataProfil.peran === 'guru' 
                      ? 'bg-gradient-to-b from-purple-900 via-indigo-950 to-purple-950 border-purple-500/60 shadow-purple-950/80 ring-4 ring-purple-500/30' 
                      : 'bg-gradient-to-b from-teal-900 via-cyan-950 to-slate-950 border-cyan-500/60 shadow-cyan-950/80 ring-4 ring-cyan-500/30'
                  }`}>
                    <img
                      src={dataProfil.foto_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'}
                      alt={dataProfil.nama_lengkap}
                      className="w-full h-full object-contain rounded-2xl bg-slate-950"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg backdrop-blur-md border ${
                      dataProfil.peran === 'guru' ? 'bg-purple-600/90 text-white border-purple-400' : 'bg-cyan-600/90 text-white border-cyan-400'
                    }`}>
                      {dataProfil.peran === 'guru' ? '👑 GURU / STAF' : '🎓 MURID / SISWA'}
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Biodata Details & Status */}
                <div className="sm:col-span-8 flex flex-col items-center sm:items-start text-center sm:text-left space-y-3">
                  <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider border ${
                    dataProfil.peran === 'guru' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  }`}>
                    {dataProfil.kelas_jabatan || (dataProfil.peran === 'guru' ? 'Guru' : 'Siswa')}
                  </span>

                  <h2 className={`text-2xl sm:text-4xl font-black leading-tight ${
                    dataProfil.peran === 'guru' 
                      ? (isDark ? 'text-purple-200' : 'text-purple-950 font-black') 
                      : (isDark ? 'text-cyan-200' : 'text-cyan-950 font-black')
                  }`}>
                    {dataProfil.nama_lengkap}
                  </h2>

                  <p className="text-xs font-mono font-bold text-slate-400">
                    {dataProfil.peran === 'guru' ? 'NIP:' : 'NISN:'} <span className="text-white">{dataProfil.nip_nisn || '-'}</span> &bull; RFID UID: <span className="text-cyan-400">{dataProfil.rfid_uid}</span>
                  </p>

                  <div className={`mt-2 py-2 px-5 rounded-2xl text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-lg ${
                    status.type === 'success' ? 'bg-emerald-500 text-slate-950 shadow-emerald-950/40' :
                    status.type === 'warning' ? 'bg-amber-500 text-slate-950 shadow-amber-950/40' :
                    'bg-rose-500 text-white shadow-rose-950/40'
                  }`}>
                    {status.pesan}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 sm:mb-6 relative flex items-center justify-center">
                  <div className={`w-20 h-20 sm:w-28 sm:h-28 rounded-full flex items-center justify-center transition-all duration-500 mx-auto ${
                    status.type === 'success' ? 'bg-emerald-500/20 text-emerald-500 ring-4 ring-emerald-500/40 scale-105' :
                    status.type === 'error' ? 'bg-rose-500/20 text-rose-500 ring-4 ring-rose-500/40 scale-105' :
                    status.type === 'warning' ? 'bg-amber-500/20 text-amber-500 ring-4 ring-amber-500/40 scale-105' :
                    status.type === 'loading' ? 'bg-cyan-500/20 text-cyan-500 animate-spin' :
                    (isDark ? 'bg-slate-800/80 text-cyan-400 animate-pulse-ring' : 'bg-slate-100 text-cyan-600 animate-pulse-ring')
                  }`}>
                    {status.type === 'success' && <CheckCircle2 className="w-10 h-10 sm:w-14 sm:h-14" />}
                    {status.type === 'error' && <XCircle className="w-10 h-10 sm:w-14 sm:h-14" />}
                    {status.type === 'warning' && <AlertTriangle className="w-10 h-10 sm:w-14 sm:h-14" />}
                    {status.type === 'loading' && <Clock className="w-10 h-10 sm:w-14 sm:h-14" />}
                    {status.type === 'idle' && <CreditCard className="w-10 h-10 sm:w-14 sm:h-14" />}
                  </div>
                </div>

                <h2 className={`text-xl sm:text-3xl font-extrabold max-w-xl text-center transition-all duration-300 ${
                  status.type === 'success' ? (isDark ? 'text-emerald-300' : 'text-emerald-700') :
                  status.type === 'error' ? (isDark ? 'text-rose-300' : 'text-rose-700') :
                  status.type === 'warning' ? (isDark ? 'text-amber-300' : 'text-amber-700') : (isDark ? 'text-slate-100' : 'text-slate-900')
                }`}>
                  {status.pesan}
                </h2>

                <p className={`text-xs mt-2 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {status.type === 'idle' ? 'Silakan tempelkan kartu RFID pada scanner' : 'Memproses cepat (Reset otomatis 3 detik)...'}
                </p>
              </>
            )}
          </div>

          <div className={`p-4 sm:p-5 rounded-2xl border backdrop-blur-md ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-slate-200 shadow-sm'
          }`}>
            <div className={`flex flex-col sm:flex-row justify-between items-center text-center sm:text-left gap-3 mb-4 pb-4 border-b ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left w-full sm:w-auto">
                <h3 className={`text-sm font-bold flex items-center justify-center sm:justify-start gap-2 w-full ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  <KeyRound className="w-4 h-4 text-cyan-500" />
                  Kontrol Akses Satpam / Guru
                </h3>
                <p className={`text-xs mt-0.5 text-center sm:text-left w-full ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Aktifkan untuk memberikan izin keluar khusus di luar jam operasional</p>
              </div>

              <button
                onClick={() => setModeIzinAktif(!modeIzinAktif)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all w-full sm:w-auto ${
                  modeIzinAktif 
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/25' 
                    : (isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300')
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                {modeIzinAktif ? 'Mode Izin Keluar: AKTIF' : 'Aktifkan Mode Izin Keluar'}
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center gap-3 text-center w-full">
                <p className={`text-xs font-semibold flex items-center justify-center gap-1 w-full text-center ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                  Simulasi Scan Kartu RFID:
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 w-full max-w-full min-w-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-[11px] sm:text-xs w-full min-w-0">
                    <button
                      type="button"
                      onClick={() => setSimulasiPaksaJenis('auto')}
                      className={`py-1.5 px-1 rounded-lg font-bold transition-all text-center flex items-center justify-center gap-1 min-w-0 ${
                        simulasiPaksaJenis === 'auto' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Otomatis tentukan Masuk/Pulang berdasarkan jam"
                    >
                      <span>🔄</span> <span className="truncate">Otomatis</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimulasiPaksaJenis('masuk')}
                      className={`py-1.5 px-1 rounded-lg font-bold transition-all text-center flex items-center justify-center gap-1 min-w-0 ${
                        simulasiPaksaJenis === 'masuk' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Paksa pengujian Absen MASUK (Terlambat & Notifikasi WA)"
                    >
                      <span>🌅</span> <span className="truncate">MASUK</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimulasiPaksaJenis('pulang')}
                      className={`py-1.5 px-1 rounded-lg font-bold transition-all text-center flex items-center justify-center gap-1 min-w-0 ${
                        simulasiPaksaJenis === 'pulang' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Paksa pengujian Absen PULANG"
                    >
                      <span>🌇</span> <span className="truncate">PULANG</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimulasiPaksaJenis('izin')}
                      className={`py-1.5 px-1 rounded-lg font-bold transition-all text-center flex items-center justify-center gap-1 min-w-0 ${
                        simulasiPaksaJenis === 'izin' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Paksa pengujian Absen IZIN (Izin Keluar Khusus)"
                    >
                      <span>📋</span> <span className="truncate">IZIN</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsBebasTapSimulasi(!isBebasTapSimulasi)}
                    className={`w-full sm:w-auto text-[11px] sm:text-xs font-bold py-1.5 px-2.5 rounded-xl border transition-all flex items-center justify-center gap-1 min-w-0 ${
                      isBebasTapSimulasi 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                    title="Klik untuk mengizinkan scan berulang kali tanpa terhalang proteksi sudah absen"
                  >
                    {isBebasTapSimulasi ? '⚡ Tap Ulang: AKTIF' : 'Tap Ulang: Dibatasi'}
                  </button>
                </div>


              </div>

              <div className="flex flex-col items-center justify-center text-center w-full space-y-2">
                <span className="text-[11px] font-bold text-cyan-500 uppercase tracking-wider flex items-center justify-center gap-1 w-full text-center">
                  <GraduationCap className="w-3.5 h-3.5" /> Murid:
                </span>
                {muridSimulasi.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic py-1">Belum ada data murid terdaftar. Daftarkan di Kelola User.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 w-full">
                    {muridSimulasi.map(m => (
                      <button 
                        key={m.id}
                        onClick={() => simulasiScan(m.rfid_uid)}
                        className={`w-full px-2 py-2 border rounded-xl text-xs font-semibold transition-all text-center flex flex-col items-center justify-center min-w-0 ${
                          isDark ? 'bg-slate-800/90 hover:bg-cyan-950 hover:border-cyan-500/50 border-slate-700 text-slate-200' : 'bg-slate-50 hover:bg-cyan-50 hover:border-cyan-400 border-slate-200 text-slate-700'
                        }`}
                        title={`${m.nama_lengkap} (${m.kelas_jabatan || 'Siswa'})`}
                      >
                        <span className="font-bold text-slate-100 text-[11px] truncate w-full">{m.nama_lengkap}</span>
                        <span className="text-[9px] text-cyan-400 font-mono truncate w-full">{m.kelas_jabatan || 'Siswa'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center justify-center text-center w-full space-y-2">
                <span className="text-[11px] font-bold text-purple-500 uppercase tracking-wider flex items-center justify-center gap-1 w-full text-center">
                  <Briefcase className="w-3.5 h-3.5" /> Guru:
                </span>
                {guruSimulasi.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic py-1">Belum ada data guru terdaftar. Daftarkan di Kelola User.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 w-full">
                    {guruSimulasi.map(g => (
                      <button 
                        key={g.id}
                        onClick={() => simulasiScan(g.rfid_uid)}
                        className={`w-full px-2 py-2 border rounded-xl text-xs font-semibold transition-all text-center flex flex-col items-center justify-center min-w-0 ${
                          isDark ? 'bg-purple-950/40 hover:bg-purple-900/60 border-purple-500/40 text-purple-200' : 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-800'
                        }`}
                        title={g.nama_lengkap}
                      >
                        <span className="font-bold text-purple-200 text-[11px] truncate w-full">{g.nama_lengkap}</span>
                        <span className="text-[9px] text-purple-400 font-mono truncate w-full">{g.kelas_jabatan || 'Guru'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="w-full min-w-0 max-w-full xl:w-4/12 flex flex-col gap-6">
          <div className={`p-5 rounded-2xl border backdrop-blur-md ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-gradient-to-b from-cyan-50/90 to-emerald-50/80 border-cyan-200 shadow-md shadow-cyan-950/5'
          }`}>
            <h3 className={`text-sm font-bold flex items-center justify-center sm:justify-start text-center sm:text-left gap-2 mb-3 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              <Clock className="w-4 h-4 text-cyan-500" />
              Pengaturan Jam Sekolah (Dinamis)
            </h3>
            <ul className="space-y-2.5 text-xs">
              <li className={`flex flex-wrap justify-between items-center p-2.5 rounded-xl border min-w-0 gap-1 ${
                isDark ? 'bg-slate-800/60 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <span className="flex items-center gap-1.5 font-medium text-emerald-500 min-w-0">
                  <LogIn className="w-3.5 h-3.5 flex-shrink-0" /> Batas Masuk:
                </span>
                <span className="font-mono font-bold text-emerald-400 ml-auto">05:00 - {schoolSettings.jamMasuk} WITA</span>
              </li>
              <li className={`flex flex-wrap justify-between items-center p-2.5 rounded-xl border min-w-0 gap-1 ${
                isDark ? 'bg-slate-800/60 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <span className="flex items-center gap-1.5 font-medium text-amber-500 min-w-0">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Terlambat:
                </span>
                <span className="font-mono font-bold text-amber-400 ml-auto">&gt; {schoolSettings.jamMasuk} WITA</span>
              </li>
              
              {/* List Jam Pulang per Kelas Dinamis */}
              {Object.entries(schoolSettings.jamPulangPerKelas || {}).map(([kKey, jVal]) => (
                <li key={kKey} className={`flex flex-wrap justify-between items-center p-2 rounded-xl border min-w-0 gap-1 ${
                  isDark ? 'bg-slate-900/40 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <span className="text-[11px] text-cyan-400 font-medium">{kKey}:</span>
                  <span className="font-mono font-semibold text-[11px] ml-auto">Pulang {normalizeTo24Hour(jVal, 'pulang')} WITA</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={`p-4 sm:p-5 rounded-2xl border backdrop-blur-md flex-1 flex flex-col min-w-0 ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-slate-200 shadow-sm'
          }`}>
            <h3 className={`text-sm font-bold flex items-center justify-center sm:justify-start text-center sm:text-left gap-2 mb-3 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              <History className="w-4 h-4 text-cyan-500" />
              Riwayat Presensi Terakhir
            </h3>
            
            {riwayatPresensi.length === 0 ? (
              <div className={`flex-1 flex flex-col items-center justify-center text-center p-6 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <History className="w-8 h-8 mb-2 stroke-1" />
                <p>Belum ada aktivitas presensi hari ini.</p>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1 min-w-0">
                {riwayatPresensi.map((log) => (
                  <div key={log.id} className={`p-2.5 rounded-xl border flex justify-between items-center gap-2 min-w-0 ${
                    isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <p className={`text-xs font-bold truncate max-w-[140px] sm:max-w-none ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{log.nama}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded flex-shrink-0 ${
                          log.peran === 'guru' ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-500'
                        }`}>
                          {log.peran.toUpperCase()}
                        </span>
                      </div>
                      <p className={`text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{log.kelas}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                        log.statusKehadiran === 'terlambat' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        log.statusKehadiran === 'sakit' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                        log.statusKehadiran === 'izin' || log.jenis === 'izin_pulang' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        log.jenis === 'masuk' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' :
                        log.jenis === 'pulang' ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30' :
                        'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                      }`}>
                        {log.statusKehadiran === 'terlambat' ? 'TERLAMBAT' :
                         log.statusKehadiran === 'sakit' ? 'SAKIT' :
                         log.statusKehadiran === 'izin' || log.jenis === 'izin_pulang' ? 'IZIN' :
                         log.jenis.toUpperCase()}
                      </span>
                      <p className={`text-[10px] font-mono mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{log.tanggal || 'Hari Ini'} &bull; {normalizeTo24Hour(log.waktu, 'pulang')} WITA</p>


                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>


        </div>

      </main>

      {/* FULLSCREEN POP-UP SCAN MODAL RESULT */}
      {dataProfil && (
        <div 
          onClick={() => setDataProfil(null)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`border rounded-3xl w-full max-w-4xl p-5 sm:p-8 shadow-2xl relative overflow-hidden transition-all duration-500 ${
              dataProfil.peran === 'guru'
                ? 'bg-slate-900 border-purple-500/50 ring-4 ring-purple-500/20 shadow-purple-950/80'
                : 'bg-slate-900 border-cyan-500/50 ring-4 ring-cyan-500/20 shadow-cyan-950/80'
            }`}
          >
            {/* Header Bar */}
            <div className={`flex justify-between items-center pb-4 border-b mb-6 ${
              dataProfil.peran === 'guru' ? 'border-purple-800/80' : 'border-slate-800/80'
            }`}>
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                <div>
                  <h3 className="text-base font-extrabold text-white">SDIT Qurratu A'yun Al-Islami</h3>
                  <p className="text-xs text-slate-400">Presensi Instant RFID &bull; Kab. Maros</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-md ${
                  dataProfil.peran === 'guru'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-400'
                    : 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white border-cyan-400'
                }`}>
                  {dataProfil.peran === 'guru' ? '👑 GURU / STAF' : '🎓 MURID / SISWA'}
                </span>

                <button
                  onClick={() => setDataProfil(null)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* 2-COLUMN SPLIT SCREEN LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* LEFT COLUMN: Full 4x6 Photo Display Frame */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center">
                <div className={`relative w-48 h-64 sm:w-60 sm:h-80 aspect-[4/6] rounded-3xl p-2 shadow-2xl transition-all duration-500 border-2 ${
                  dataProfil.peran === 'guru'
                    ? 'bg-gradient-to-b from-purple-900 via-indigo-950 to-purple-950 border-purple-500/60 shadow-purple-950/90 ring-4 ring-purple-500/30'
                    : 'bg-gradient-to-b from-teal-900 via-cyan-950 to-slate-950 border-cyan-500/60 shadow-cyan-950/90 ring-4 ring-cyan-500/30'
                }`}>
                  <img
                    src={dataProfil.foto_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80'}
                    alt={dataProfil.nama_lengkap}
                    className="w-full h-full object-contain rounded-2xl bg-slate-950"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80';
                    }}
                  />
                </div>
              </div>

              {/* RIGHT COLUMN: Biodata & Attendance Status */}
              <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
                
                {/* Status Banner */}
                <div className={`py-3.5 px-6 rounded-2xl text-lg sm:text-2xl font-black uppercase tracking-wider flex items-center justify-center lg:justify-start gap-3 shadow-xl ${
                  status.type === 'success' ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30' :
                  status.type === 'warning' ? 'bg-amber-500 text-slate-950 shadow-amber-500/30' :
                  'bg-rose-500 text-white shadow-rose-500/30'
                }`}>
                  {status.type === 'success' && <CheckCircle2 className="w-7 h-7" />}
                  {status.type === 'warning' && <AlertTriangle className="w-7 h-7" />}
                  {status.type === 'error' && <XCircle className="w-7 h-7" />}
                  <span>{status.pesan}</span>
                </div>

                <div>
                  <p className="text-xs uppercase font-mono tracking-widest text-slate-400 mb-1">Nama Lengkap Terdaftar:</p>
                  <h2 className={`text-3xl sm:text-5xl font-black leading-tight ${
                    dataProfil.peran === 'guru' ? 'text-purple-200' : 'text-cyan-200'
                  }`}>
                    {dataProfil.nama_lengkap}
                  </h2>
                </div>

                <div className={`grid grid-cols-2 gap-4 p-4 rounded-2xl border ${
                  dataProfil.peran === 'guru' ? 'bg-purple-950/40 border-purple-800/60' : 'bg-slate-950/60 border-slate-800'
                }`}>
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-0.5">{dataProfil.peran === 'guru' ? 'Jabatan / Matpel:' : 'Kelas / Rombel:'}</span>
                    <p className={`text-base sm:text-xl font-bold ${dataProfil.peran === 'guru' ? 'text-purple-300' : 'text-cyan-300'}`}>{dataProfil.kelas_jabatan || 'Siswa'}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-0.5">{dataProfil.peran === 'guru' ? 'NIP Pegawai:' : 'NISN Siswa:'}</span>
                    <p className="text-base sm:text-xl font-mono font-bold text-white">{dataProfil.nip_nisn || '-'}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 text-xs text-slate-400 border-t border-slate-800">
                  <span>Waktu Scan: <strong className="text-cyan-400 font-mono">{jamFormatted} WITA</strong></span>
                  <span className="font-mono">RFID UID: {dataProfil.rfid_uid}</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center mt-6">
              Kembali otomatis ke layar utama dalam 4 detik... (Atau <strong className="text-cyan-400 underline cursor-pointer" onClick={() => setDataProfil(null)}>klik di mana saja</strong> untuk menutup sekarang)
            </p>
          </div>
        </div>
      )}

      {/* MODAL PREVIEW WHATSAPP */}
      {waModalData && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95">
            
            <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Kirim Pesan WA Keterlambatan</h3>
                  <p className="text-xs text-slate-400">Notifikasi otomatis santun & ringkas untuk Orang Tua</p>
                </div>
              </div>
              <button 
                onClick={() => setWaModalData(null)}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4">
              <p className="text-xs text-slate-400 mb-1.5 font-mono">Tujuan: <strong className="text-emerald-400">{waModalData.noHp}</strong> ({waModalData.nama})</p>
              <pre className="whitespace-pre-wrap font-sans text-xs text-slate-200 bg-slate-900 p-3 rounded-xl border border-slate-800">
                {waModalData.pesan}
              </pre>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setWaModalData(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Tutup
              </button>
              <button
                onClick={eksekusiKirimWA}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950"
              >
                <Send className="w-4 h-4" /> Buka WhatsApp
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal Admin Auth */}
      <ModalLoginAdmin
        isOpen={isModalAdminLoginOpen}
        onClose={() => {
          setIsModalAdminLoginOpen(false);
          setPendingAdminAction(null);
        }}
        onSuccess={handleAdminLoginSuccess}
        isDark={isDark}
      />

      {/* Portal Mobile HP Wali Kelas */}
      <PortalWaliKelas
        isOpen={isPortalWaliOpen}
        onClose={() => setIsPortalWaliOpen(false)}
        onDataUpdated={muatPenggunaSimulasi}
        isDark={isDark}
      />

      {/* Modal Kelola User, RFID & Pengaturan Sekolah */}
      <ModalKelolaUser 
        isOpen={isModalKelolaOpen}
        onClose={() => setIsModalKelolaOpen(false)}
        onDataChange={() => {
          muatPenggunaSimulasi();
          setSchoolSettings(getSchoolSettings());
        }}
        isDark={isDark}
      />

      {/* Modal Laporan Presensi */}
      <ModalLaporan 
        isOpen={isModalLaporanOpen} 
        onClose={() => setIsModalLaporanOpen(false)} 
        isDark={isDark}
      />

      {/* FOOTER BAR */}
      <footer className={`w-full text-center text-xs pt-4 mt-2 relative z-10 border-t ${
        isDark ? 'text-slate-500 border-slate-900' : 'text-slate-400 border-slate-200'
      }`}>
        SDIT Qurratu A'yun Al-Islami &bull; Kabupaten Maros &bull; Powered by React, Supabase & Vercel
      </footer>

      </div>
    </div>
  );
}
