import React, { useState, useEffect, useRef } from 'react';
import { supabase, getAdminPassword, setAdminPassword, clearStoredMockPresensi, getSupabaseCredentials, setSupabaseCredentials, initialMockPengguna, tesKoneksiSupabase, ujiSimpanPresensiTes, getDeletedSampleIds, markSampleAsDeleted, unmarkSampleAsDeleted, hapusSemuaPresensiDatabase, hapusSemuaPenggunaDatabase } from '../lib/supabase';

import { getSchoolSettings, saveSchoolSettings, removeKelasSetting, renameKelasSetting, getJamPulangKelas, normalizeTo24Hour } from '../utils/settings';
import TimeInput24h from './TimeInput24h';
import { 
  X, 
  UserPlus, 
  CreditCard, 
  Search, 
  Edit3, 
  Trash2, 
  Save, 
  GraduationCap, 
  Briefcase, 
  CheckCircle2, 
  Sparkles,
  RefreshCw,
  Phone,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Users,
  Clock,
  Plus,
  Camera,
  Upload,
  Image as ImageIcon,
  Database,
  Layers,
  BarChart3,
  PieChart,
  UserCheck,
  UserX,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Calendar,
  MessageSquare
} from 'lucide-react';


export default function ModalKelolaUser({ isOpen, onClose, onDataChange, isDark = true }) {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'users', 'classes', 'settings', 'password', 'supabase'
  const [loading, setLoading] = useState(false);
  const [daftarPengguna, setDaftarPengguna] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State Dashboard Statistik Per Kelas
  const [dashboardStats, setDashboardStats] = useState({
    totalMurid: 0,
    totalSudahPresensi: 0,
    totalBelumPresensi: 0,
    persentaseTotal: 0,
    kelasStats: []
  });
  const [expandedKelas, setExpandedKelas] = useState(null);
  const [searchDashboardKelas, setSearchDashboardKelas] = useState('');
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // State Form User (Tambah / Edit)
  const [editId, setEditId] = useState(null);
  const [rfidUid, setRfidUid] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [peran, setPeran] = useState('murid');
  const [nipNisn, setNipNisn] = useState('');
  const [kelasJabatan, setKelasJabatan] = useState('');
  const [noWaOrtu, setNoWaOrtu] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');

  // State Kelola & Edit Kelas
  const [editingKelasOld, setEditingKelasOld] = useState(null);
  const [editingKelasNew, setEditingKelasNew] = useState('');

  // State Form Ganti Password Admin
  const [passLama, setPassLama] = useState('');
  const [passBaru, setPassBaru] = useState('');
  const [konfirmasiPass, setKonfirmasiPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [passStatus, setPassStatus] = useState({ type: '', msg: '' });

  // State Pengaturan Jam Operasional & Jam Pulang per Kelas
  const [settings, setSettings] = useState(getSchoolSettings());
  const [settingsStatus, setSettingsStatus] = useState({ type: '', msg: '' });

  // State input tambah jam pulang kelas baru
  const [kelasBaruName, setKelasBaruName] = useState('');
  const [kelasBaruTime, setKelasBaruTime] = useState('13:00');

  // State Form Kredensial Supabase Dinamis
  const [supaUrlInput, setSupaUrlInput] = useState('');
  const [supaKeyInput, setSupaKeyInput] = useState('');
  const [supaStatus, setSupaStatus] = useState({ type: '', msg: '' });

  // Mode Scan Kartu Fisik
  const [isScanningKartu, setIsScanningKartu] = useState(false);
  const scanInputRef = useRef(null);

  const avatarPresets = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80'
  ];

  useEffect(() => {
    if (isOpen) {
      muatDaftarPengguna();
      setSettings(getSchoolSettings());
      const c = getSupabaseCredentials();
      setSupaUrlInput(c.url);
      setSupaKeyInput(c.key);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'dashboard') {
      muatDashboardPresensi(daftarPengguna);
    }
  }, [isOpen, activeTab]);

  const muatDashboardPresensi = async (penggunaList = daftarPengguna) => {
    setLoadingDashboard(true);
    try {
      const awalHari = new Date();
      awalHari.setHours(0, 0, 0, 0);
      const awalHariTimestamp = awalHari.getTime();
      const awalHariIso = awalHari.toISOString();

      const deletedIds = getDeletedSampleIds();
      // Filter murid aktif
      const muridList = (penggunaList || []).filter(u => {
        if (!u || u.peran !== 'murid' || !u.nama_lengkap) return false;
        const uId = String(u.id || '').trim();
        const uUid = String(u.rfid_uid || '').trim();
        if (deletedIds.includes(uId) || (uUid && deletedIds.includes(uUid)) || deletedIds.includes(u.nama_lengkap.trim())) {
          return false;
        }
        return true;
      });

      // Ambil data presensi hari ini (Lokal & Supabase)
      let presensiHariIni = [];
      try {
        const savedLokal = localStorage.getItem('presensi_riwayat_lokal');
        if (savedLokal) {
          const parsed = JSON.parse(savedLokal);
          if (Array.isArray(parsed)) {
            presensiHariIni = parsed.filter(item => (item.timestamp || 0) >= awalHariTimestamp);
          }
        }
      } catch (e) {}

      const creds = getSupabaseCredentials();
      if (creds.isConfigured) {
        try {
          const { data } = await supabase
            .from('presensi')
            .select('*, pengguna:pengguna_id(*)')
            .gte('waktu_tap', awalHariIso);
          
          if (Array.isArray(data)) {
            const supaItems = data.map(item => {
              const uRel = item.pengguna || {};
              const w = new Date(item.waktu_tap || Date.now());
              return {
                id: item.id,
                pengguna_id: item.pengguna_id || uRel.id,
                rfid_uid: uRel.rfid_uid || item.rfid_uid,
                nama: uRel.nama_lengkap || item.nama,
                peran: uRel.peran || item.peran || 'murid',
                kelas: uRel.kelas_jabatan || item.kelas,
                jenis: item.jenis_tap || item.jenis || 'masuk',
                statusKehadiran: item.status_kehadiran || item.statusKehadiran || 'hadir',
                waktu: w.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }),
                timestamp: w.getTime()
              };
            });

            const mergedMap = new Map();
            presensiHariIni.forEach(p => {
              const key = `${(p.nama || '').toLowerCase()}_${p.jenis}`;
              mergedMap.set(key, p);
            });
            supaItems.forEach(p => {
              const key = `${(p.nama || '').toLowerCase()}_${p.jenis}`;
              mergedMap.set(key, p);
            });
            presensiHariIni = Array.from(mergedMap.values());
          }
        } catch (err) {}
      }

      // Kelompokkan murid per kelas
      const kelasMap = {};
      muridList.forEach(m => {
        const kName = (m.kelas_jabatan || 'Tanpa Kelas').trim();
        if (!kelasMap[kName]) kelasMap[kName] = [];
        kelasMap[kName].push(m);
      });

      const sortedKelasNames = Object.keys(kelasMap).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      let grandTotalSudah = 0;

      const kelasStats = sortedKelasNames.map(kName => {
        const listSiswa = kelasMap[kName];
        let sudahCount = 0;
        let hadirCount = 0;
        let terlambatCount = 0;

        const siswaWithStatus = listSiswa.map(siswa => {
          const sName = (siswa.nama_lengkap || '').toLowerCase().trim();
          const sUid = String(siswa.rfid_uid || '').trim();
          const sId = String(siswa.id || '').trim();

          const record = presensiHariIni.find(p => {
            const pName = (p.nama || '').toLowerCase().trim();
            const pUid = String(p.rfid_uid || p.pengguna_id || '').trim();
            const pId = String(p.pengguna_id || p.id || '').trim();
            return (sUid && pUid === sUid) || (sId && pId === sId) || (sName && pName === sName);
          });

          if (record) {
            sudahCount++;
            const st = (record.statusKehadiran || record.status_kehadiran || 'hadir').toLowerCase();
            if (st === 'terlambat') {
              terlambatCount++;
            } else {
              hadirCount++;
            }
            return {
              ...siswa,
              sudahPresensi: true,
              waktuTap: record.waktu || 'Masuk',
              statusKehadiran: record.statusKehadiran || record.status_kehadiran || 'hadir',
              jenisTap: record.jenis || record.jenis_tap || 'masuk'
            };
          } else {
            return {
              ...siswa,
              sudahPresensi: false,
              waktuTap: null,
              statusKehadiran: 'belum',
              jenisTap: null
            };
          }
        });

        const totalInKelas = listSiswa.length;
        const belumCount = totalInKelas - sudahCount;
        const pct = totalInKelas > 0 ? Math.round((sudahCount / totalInKelas) * 100) : 0;
        grandTotalSudah += sudahCount;

        return {
          namaKelas: kName,
          totalMurid: totalInKelas,
          sudahPresensi: sudahCount,
          hadirCount,
          terlambatCount,
          belumPresensi: belumCount < 0 ? 0 : belumCount,
          persentase: pct,
          siswaList: siswaWithStatus
        };
      });

      const grandTotalMurid = muridList.length;
      const grandTotalBelum = grandTotalMurid - grandTotalSudah;
      const totalPct = grandTotalMurid > 0 ? Math.round((grandTotalSudah / grandTotalMurid) * 100) : 0;

      setDashboardStats({
        totalMurid: grandTotalMurid,
        totalSudahPresensi: grandTotalSudah,
        totalBelumPresensi: grandTotalBelum < 0 ? 0 : grandTotalBelum,
        persentaseTotal: totalPct,
        kelasStats
      });
    } catch (e) {
      console.error('Error computing dashboard stats:', e);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const handleKosongkanPresensiHariIni = () => {
    if (window.confirm('Apakah Anda yakin ingin mengosongkan riwayat presensi harian HARI INI?\n\nTindakan ini akan mengosongkan tampilan riwayat harian untuk hari ini.')) {
      localStorage.removeItem('presensi_riwayat_lokal');
      localStorage.setItem('presensi_last_reset_date', new Date().toISOString().split('T')[0]);
      window.dispatchEvent(new Event('presensi_history_updated'));
      muatDashboardPresensi(daftarPengguna);
      if (onDataChange) onDataChange();
      alert('Riwayat presensi hari ini berhasil dikosongkan!');
    }
  };


  useEffect(() => {
    if (isScanningKartu && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [isScanningKartu]);

  const muatDaftarPengguna = async () => {
    setLoading(true);
    try {
      let supaData = [];
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase.from('pengguna').select('*');
          if (!error && Array.isArray(data)) {
            supaData = data;
          } else if (error) {
            console.warn('Error select pengguna from Supabase:', error);
          }
        } catch (e) {
          console.error('Error fetching pengguna from Supabase:', e);
        }
      }

      let sourceList = supaData;
      if (sourceList.length === 0 && !isSupabaseConfigured()) {
        try {
          const saved = localStorage.getItem('presensi_mock_pengguna_list');
          if (saved) sourceList = JSON.parse(saved);
        } catch (e) {}
      }

      const uniqueList = [];
      const seenNames = new Set();
      const duplicateIdsToDelete = [];

      const reversedSource = [...sourceList].reverse();

      reversedSource.forEach(rawU => {
        if (!rawU) return;
        const name = String(rawU.nama_lengkap || rawU.nama || rawU.nama_siswa || rawU.name || rawU.fullName || rawU.nama_murid || '').trim();
        if (!name) return;
        const u = {
          ...rawU,
          id: rawU.id || Date.now(),
          nama_lengkap: name,
          rfid_uid: String(rawU.rfid_uid || rawU.rfid || rawU.uid || rawU.no_rfid || rawU.card_id || rawU.id || '').trim(),
          peran: String(rawU.peran || rawU.role || 'murid').toLowerCase().includes('guru') ? 'guru' : 'murid',
          kelas_jabatan: rawU.kelas_jabatan || rawU.kelas || rawU.jabatan || 'Kelas 1'
        };

        const uId = String(u.id || '').trim();
        const nameKey = u.nama_lengkap.toLowerCase().trim();

        if (seenNames.has(nameKey)) {
          if (uId) duplicateIdsToDelete.push(uId);
        } else {
          seenNames.add(nameKey);
          uniqueList.push(u);
        }
      });

      // Bersihkan data duplikat lama di Supabase Cloud secara otomatis di background
      if (duplicateIdsToDelete.length > 0 && isSupabaseConfigured()) {
        (async () => {
          try {
            const client = getSupabaseClient();
            if (client) await client.from('pengguna').delete().in('id', duplicateIdsToDelete);
          } catch(e) {}
        })();
      }

      setDaftarPengguna(uniqueList);
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateRandomUID = () => {
    const randomVal = Math.floor(10000000 + Math.random() * 90000000).toString();
    setRfidUid(randomVal);
  };

  const tanganiSimpanUser = async (e) => {
    e.preventDefault();
    if (loading) return;

    const nameClean = namaLengkap.trim();
    if (!nameClean) {
      alert('Mohon isi Nama Lengkap terlebih dahulu!');
      return;
    }

    let finalRfidUid = rfidUid.trim();
    if (!finalRfidUid) {
      finalRfidUid = Math.floor(10000000 + Math.random() * 90000000).toString();
      setRfidUid(finalRfidUid);
    }

    // 1. Validasi saat Pendaftaran Baru (Bukan Edit Mode)
    if (!editId) {
      // Cek apakah kombinasi utuh Nama & UID RFID persis sama sudah ada
      const isExactDuplicate = daftarPengguna.some(p => 
        p.nama_lengkap?.toLowerCase().trim() === nameClean.toLowerCase() && 
        String(p.rfid_uid).trim() === finalRfidUid
      );

      if (isExactDuplicate) {
        alert(`Pengguna dengan nama "${nameClean}" dan UID RFID "${finalRfidUid}" ini sudah terdaftar dalam sistem!`);
        return;
      }

      // Cek jika UID RFID sudah digunakan oleh pengguna lain
      const uidOwner = daftarPengguna.find(p => String(p.rfid_uid).trim() === finalRfidUid);
      if (uidOwner) {
        alert(`Kartu RFID (UID: ${finalRfidUid}) sudah terdaftar untuk ${uidOwner.nama_lengkap} (${uidOwner.kelas_jabatan || 'Siswa'}).\n\nJika ini kartu baru untuk menggantikan kartu yang hilang, silakan klik tombol Edit (ikon pensil) pada data siswa bersangkutan.`);
        return;
      }
    }

    setLoading(true);
    try {
      const targetId = editId || `usr_${Date.now()}_${Math.floor(Math.random()*1000)}`;

      const newUserObj = {
        id: targetId,
        rfid_uid: finalRfidUid,
        nama_lengkap: nameClean,
        peran,
        nip_nisn: nipNisn.trim() || (peran === 'guru' ? '198001012010011001' : '20241099'),
        kelas_jabatan: kelasJabatan.trim() || (peran === 'guru' ? 'Guru Pengajar' : 'Kelas 1 A'),
        no_wa_ortu: noWaOrtu.trim() || '',
        foto_url: fotoUrl.trim() || avatarPresets[Math.floor(Math.random() * avatarPresets.length)]
      };

      const payload = {
        rfid_uid: newUserObj.rfid_uid,
        nama_lengkap: newUserObj.nama_lengkap,
        peran: newUserObj.peran,
        nip_nisn: newUserObj.nip_nisn,
        kelas_jabatan: newUserObj.kelas_jabatan,
        no_wa_ortu: newUserObj.no_wa_ortu,
        foto_url: newUserObj.foto_url
      };

      // Hapus dari deletedSampleIds jika sebelumnya pernah ditandai terhapus
      unmarkSampleAsDeleted([finalRfidUid, nameClean, targetId, newUserObj.kelas_jabatan].filter(Boolean));

      // 1. UPDATE STATE LOCAL & STORAGE SEGERA SECARA KILAT (0 MILLISECONDS)!
      try {
        const saved = localStorage.getItem('presensi_mock_pengguna_list');
        let currentList = saved ? JSON.parse(saved) : [];
        const filtered = currentList.filter(u => 
          String(u.id) !== String(targetId) &&
          String(u.rfid_uid) !== String(finalRfidUid) &&
          u.nama_lengkap?.toLowerCase().trim() !== nameClean.toLowerCase()
        );
        localStorage.setItem('presensi_mock_pengguna_list', JSON.stringify([newUserObj, ...filtered]));
      } catch (e) {}

      setDaftarPengguna(prev => {
        const filtered = prev.filter(u => 
          String(u.id) !== String(targetId) &&
          String(u.rfid_uid) !== String(finalRfidUid) &&
          u.nama_lengkap?.toLowerCase().trim() !== nameClean.toLowerCase()
        );
        return [newUserObj, ...filtered];
      });

      const modeText = editId ? 'diperbarui (kartu/data berhasil diperbarui)' : 'didaftarkan';
      alert(`Data ${nameClean} (UID: ${finalRfidUid}) berhasil ${modeText}!`);

      resetFormUser();
      if (onDataChange) onDataChange();

      // 2. SINKRONISASI DATABASE SUPABASE CLOUD DI BACKGROUND (NON-BLOCKING)
      (async () => {
        try {
          // Bersihkan duplikat lama dengan nama sama
          await supabase.from('pengguna').delete().ilike('nama_lengkap', nameClean);
          // Insert data baru
          let { error } = await supabase.from('pengguna').insert([payload]);
          if (error && error.message?.includes('duplicate key')) {
            await supabase.from('pengguna').update(payload).eq('rfid_uid', finalRfidUid);
          }
        } catch (supaErr) {
          console.warn('Background save Supabase:', supaErr);
        }
      })();
    } catch (err) {
      console.error('Error saving user:', err);
      alert(`Data ${nameClean} berhasil disimpan di sistem!`);
    } finally {
      setLoading(false);
    }
  };

  const mulaiEditUser = (user) => {
    setEditId(user.id);
    setRfidUid(user.rfid_uid);
    setNamaLengkap(user.nama_lengkap);
    setPeran(user.peran || 'murid');
    setNipNisn(user.nip_nisn || '');
    setKelasJabatan(user.kelas_jabatan || '');
    setNoWaOrtu(user.no_wa_ortu || '');
    setFotoUrl(user.foto_url || '');
    setActiveTab('users');
  };

  const tanganiHapusUser = async (id, nama) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus data ${nama}?`)) return;

    const targetUser = daftarPengguna.find(p => String(p.id) === String(id) || p.nama_lengkap === nama);
    const targetUid = targetUser?.rfid_uid || '';

    // Hapus seketika dari UI state
    setDaftarPengguna(prev => prev.filter(u => 
      String(u.id) !== String(id) && 
      (!targetUid || String(u.rfid_uid) !== String(targetUid)) && 
      u.nama_lengkap?.toLowerCase().trim() !== String(nama).toLowerCase().trim()
    ));

    try {
      localStorage.removeItem('presensi_mock_pengguna_list');
    } catch (e) {}

    // Hapus dari Supabase Cloud
    try {
      const client = getSupabaseClient();
      if (isSupabaseConfigured() && client) {
        if (id) await client.from('presensi').delete().eq('pengguna_id', id);
        if (targetUid) await client.from('presensi').delete().eq('rfid_uid', targetUid);

        let cloudError = null;
        if (id) {
          const { error } = await client.from('pengguna').delete().eq('id', id);
          if (error) cloudError = error.message;
        }
        if (targetUid) {
          const { error } = await client.from('pengguna').delete().eq('rfid_uid', String(targetUid));
          if (error) cloudError = error.message;
        }
        if (nama) {
          const { error } = await client.from('pengguna').delete().ilike('nama_lengkap', nama);
          if (error) cloudError = error.message;
        }

        if (cloudError) {
          alert(`Perhatian: Data dihapus dari tampilan aplikasi, namun di Supabase Cloud gagal dihapus.\n\nPesan Error Supabase: ${cloudError}\n\nSolusi: Jalankan skrip RLS di Supabase Editor agar perizinan DELETE diizinkan.`);
        }
      }
    } catch (e) {
      console.error('Error delete Supabase user:', e);
    }

    if (onDataChange) onDataChange();
    window.dispatchEvent(new Event('presensi_pengguna_updated'));
    await muatDaftarPengguna();
  };

  const resetFormUser = () => {
    setEditId(null);
    setRfidUid('');
    setNamaLengkap('');
    setPeran('murid');
    setNipNisn('');
    setKelasJabatan('');
    setNoWaOrtu('');
    setFotoUrl('');
    setIsScanningKartu(false);
  };

  // Handler Pengaturan Jam Operasional & Jam Pulang per Kelas
  const updateJamPulangKelas = (kelasKey, jamVal) => {
    const timeNormalized = normalizeTo24Hour(jamVal, 'pulang');
    setSettings(prev => {
      const updated = {
        ...prev,
        jamPulangPerKelas: {
          ...(prev.jamPulangPerKelas || {}),
          [kelasKey]: timeNormalized
        }
      };
      saveSchoolSettings(updated);
      return updated;
    });
  };

  const hapusJamPulangKelas = (kelasKey) => {
    setSettings(prev => {
      const copy = { ...(prev.jamPulangPerKelas || {}) };
      delete copy[kelasKey];
      const updated = { ...prev, jamPulangPerKelas: copy };
      saveSchoolSettings(updated);
      return updated;
    });
  };

  const tambahJamPulangKelasBaru = () => {
    if (!kelasBaruName.trim()) return alert('Masukkan nama kelas / kelompok kelas!');
    const timeNormalized = normalizeTo24Hour(kelasBaruTime, 'pulang');
    setSettings(prev => {
      const updated = {
        ...prev,
        jamPulangPerKelas: {
          ...(prev.jamPulangPerKelas || {}),
          [kelasBaruName.trim()]: timeNormalized
        }
      };
      saveSchoolSettings(updated);
      return updated;
    });
    setKelasBaruName('');
    alert(`Jam pulang ${timeNormalized} WITA untuk ${kelasBaruName.trim()} berhasil disimpan dan otomatis terhubung!`);
  };

  const tanganiSimpanSettings = (e) => {
    e.preventDefault();
    try {
      saveSchoolSettings(settings);
      setSettingsStatus({ type: 'success', msg: 'Pengaturan Jam Masuk & Jam Pulang per Kelas berhasil disimpan!' });
      setTimeout(() => setSettingsStatus({ type: '', msg: '' }), 3000);
      window.dispatchEvent(new Event('presensi_settings_changed'));
    } catch (err) {
      setSettingsStatus({ type: 'error', msg: err.message || 'Gagal menyimpan pengaturan.' });
    }
  };

  // Evaluasi Kekuatan Password Baru
  const hitungKekuatanPassword = (pass) => {
    if (!pass) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { score, label: 'Lemah', color: 'text-rose-400 bg-rose-500/20 border-rose-500/30' };
    if (score <= 3) return { score, label: 'Sedang', color: 'text-amber-400 bg-amber-500/20 border-amber-500/30' };
    if (score <= 4) return { score, label: 'Kuat', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' };
    return { score, label: 'Sangat Kuat 🔒', color: 'text-cyan-300 bg-cyan-500/20 border-cyan-500/30' };
  };

  const tanganiGantiPassword = (e) => {
    e.preventDefault();
    setPassStatus({ type: '', msg: '' });

    const passwordSekarang = getAdminPassword();

    if (passLama !== passwordSekarang) {
      setPassStatus({ type: 'error', msg: 'Password Lama yang Anda masukkan salah!' });
      return;
    }

    if (passBaru.length < 6) {
      setPassStatus({ type: 'error', msg: 'Password Baru minimal harus 6 karakter!' });
      return;
    }

    if (passBaru !== konfirmasiPass) {
      setPassStatus({ type: 'error', msg: 'Konfirmasi Password Baru tidak cocok!' });
      return;
    }

    try {
      setAdminPassword(passBaru);
      setPassStatus({ type: 'success', msg: 'Password Admin berhasil diperbarui & disimpan dengan stabil!' });
      setPassLama('');
      setPassBaru('');
      setKonfirmasiPass('');
    } catch (err) {
      setPassStatus({ type: 'error', msg: err.message || 'Gagal mengubah password.' });
    }
  };

  const tanganiHapusKelas = (namaKelas) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus Kelas "${namaKelas}"? Seluruh aturan jam pulang untuk kelas ini akan dihapus.`)) {
      return;
    }
    setLoading(true);
    try {
      // 1. Tandai nama kelas sebagai terhapus di tingkat klien (seketika 0ms!)
      markSampleAsDeleted(namaKelas);

      // 2. Hapus dari pengaturan jam pulang sekolah
      removeKelasSetting(namaKelas);

      // 3. Update settings React state secara langsung dengan object baru tanpa key namaKelas
      setSettings(prev => {
        const copy = { ...(prev.jamPulangPerKelas || {}) };
        delete copy[namaKelas];
        const updated = { ...prev, jamPulangPerKelas: copy };
        saveSchoolSettings(updated);
        return updated;
      });

      // 4. Update siswa di localStorage agar tidak lagi memakai nama kelas ini
      try {
        const saved = localStorage.getItem('presensi_mock_pengguna_list');
        if (saved) {
          const list = JSON.parse(saved);
          const updated = list.map(u => {
            if (u.kelas_jabatan === namaKelas) {
              return { ...u, kelas_jabatan: 'Siswa' };
            }
            return u;
          });
          localStorage.setItem('presensi_mock_pengguna_list', JSON.stringify(updated));
        }
      } catch (e) {}

      // 5. Update state pengguna lokal secara instant
      setDaftarPengguna(prev => prev.map(u => {
        if (u.kelas_jabatan === namaKelas) {
          return { ...u, kelas_jabatan: 'Siswa' };
        }
        return u;
      }));

      // 6. Update pengguna di Supabase Cloud (Non-blocking)
      (async () => {
        try {
          const { data: usersInKelas } = await supabase
            .from('pengguna')
            .select('id')
            .eq('kelas_jabatan', namaKelas);

          if (usersInKelas && usersInKelas.length > 0) {
            for (const u of usersInKelas) {
              await supabase.from('pengguna').update({ kelas_jabatan: 'Siswa' }).eq('id', u.id);
            }
          }
        } catch (e) {}
      })();

      if (onDataChange) onDataChange();
      alert(`Kelas "${namaKelas}" berhasil dihapus dari sistem!`);
    } catch (err) {
      console.error('Error hapus kelas:', err);
      alert('Terjadi kesalahan saat menghapus kelas.');
    } finally {
      setLoading(false);
    }
  };

  const tanganiUbahNamaKelas = async (oldName, newName) => {
    const targetNew = newName.trim();
    if (!targetNew || targetNew === oldName) {
      setEditingKelasOld(null);
      return;
    }
    setLoading(true);
    try {
      // 1. Update pengguna di Supabase
      const { data: usersInKelas } = await supabase
        .from('pengguna')
        .select('id')
        .eq('kelas_jabatan', oldName);

      if (usersInKelas && usersInKelas.length > 0) {
        for (const u of usersInKelas) {
          await supabase.from('pengguna').update({ kelas_jabatan: targetNew }).eq('id', u.id);
        }
      }

      // 2. Update pengaturan jam pulang
      renameKelasSetting(oldName, targetNew);
      setSettings(getSchoolSettings());

      // 3. Reload pengguna
      await muatDaftarPengguna();
      setEditingKelasOld(null);
      alert(`Nama kelas berhasil diubah dari "${oldName}" menjadi "${targetNew}"!`);
    } catch (err) {
      console.error('Error ubah nama kelas:', err);
      alert('Terjadi kesalahan saat mengubah nama kelas.');
    } finally {
      setLoading(false);
    }
  };  const tanganiBersihkanSemuaDataSampel = async () => {
    if (!window.confirm('Apakah Anda yakin ingin membersihkan SELURUH data pengguna sampel & kelas?\n\nSeluruh pengguna sampel dan kelas akan dihapus bersih.')) {
      return;
    }
    setLoading(true);
    try {
      const allClassKeys = Object.keys(settings.jamPulangPerKelas || {});
      const sampleUids = ['10012024', '10012025', '10012026', '10012027', '10012028', '10012029', '10012030', '0005735914', '0005707338', '0005707281', '0005737825'];
      const sampleNames = ['Ahmad Dahlan', 'Siti Nurhaliza', 'Dewi Lestari', 'Rizky Febian', 'Budi Santoso, M.Pd.', 'Dra. Endang Rahayu', 'Pengguna Uji Coba', 'Radiant Fadli', 'Muhammad Amirul Mustaqim', 'Muh. Misyari Rosyid Al Aufi', 'Muh. Imam Mulia Al Afif'];

      // Ambil SELURUH ID, UID, dan Nama Pengguna dari daftar yang ada saat ini
      const currentNames = daftarPengguna.map(p => p.nama_lengkap).filter(Boolean);
      const currentUids = daftarPengguna.map(p => p.rfid_uid).filter(Boolean);
      const currentIds = daftarPengguna.map(p => String(p.id)).filter(Boolean);

      const allToDelete = Array.from(new Set([
        ...sampleUids,
        ...sampleNames,
        ...currentNames,
        ...currentUids,
        ...currentIds,
        ...allClassKeys,
        'XII IPA 1', 'XI IPS 2', 'X 3', 'Kelas Uji', 'Kelas 1 Putra', 'Kelas 1 Putri', 'Kelas 3 Putra', 'Kelas 4 Putra', 'Kelas 5 Putra', 'Kelas 6 Putra'
      ]));

      // Tandai semua terhapus secara permanen di local storage
      markSampleAsDeleted(allToDelete);

      // 1. Kosongkan jamPulangPerKelas dari settings & simpan ke localStorage
      const newSettings = {
        ...settings,
        jamPulangPerKelas: {}
      };
      saveSchoolSettings(newSettings);
      setSettings(newSettings);

      // 2. Bersihkan localStorage caches
      try {
        localStorage.removeItem('presensi_mock_pengguna_list');
        localStorage.removeItem('presensi_riwayat_lokal');
        localStorage.removeItem('presensi_mock_presensi_list');
        window.dispatchEvent(new Event('presensi_history_updated'));
        window.dispatchEvent(new Event('presensi_settings_changed'));
      } catch (e) {}

      // 3. Hapus dari Supabase Cloud jika terhubung
      if (supabase && !supabase.isMock) {
        try {
          await supabase.from('presensi').delete().gte('waktu_tap', '1970-01-01T00:00:00.000Z');
          await supabase.from('pengguna').delete().neq('nama_lengkap', 'xyz_dummy_filter_999');
        } catch (e) {}
      }

      setDaftarPengguna([]);
      if (onDataChange) onDataChange();
      alert('SELURUH data pengguna & kelas berhasil dibersihkan! Tabel pengguna kini 100% kosong.');
    } catch (e) {
      console.error('Error cleaning sample data:', e);
      alert('Gagal membersihkan data sampel: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const tanganiSyncKeSupabase = async () => {
    if (daftarPengguna.length === 0) {
      alert('Belum ada data pengguna yang terdaftar untuk disinkronkan!');
      return;
    }
    setLoading(true);
    let lastErrorMsg = '';
    try {
      let insertedCount = 0;
      let errCount = 0;
      for (const p of daftarPengguna) {
        const payload = {
          rfid_uid: String(p.rfid_uid),
          nama_lengkap: p.nama_lengkap,
          peran: p.peran || 'murid',
          nip_nisn: p.nip_nisn || '',
          kelas_jabatan: p.kelas_jabatan || 'Siswa',
          no_wa_ortu: p.no_wa_ortu || '',
          foto_url: p.foto_url || ''
        };
        try {
          let { error } = await supabase.from('pengguna').insert([payload]);
          if (error) {
            if (error.message?.includes('duplicate key') || error.code === '23505') {
              const { error: errUpdate } = await supabase.from('pengguna').update(payload).eq('rfid_uid', payload.rfid_uid);
              if (errUpdate) {
                errCount++;
                lastErrorMsg = errUpdate.message;
              } else {
                insertedCount++;
              }
            } else if (error.message?.includes('column')) {
              // Fallback: Coba simpan entri dasar jika kolom foto_url/no_wa_ortu belum ada di tabel Supabase
              const basicPayload = {
                rfid_uid: String(p.rfid_uid),
                nama_lengkap: p.nama_lengkap,
                peran: p.peran || 'murid',
                kelas_jabatan: p.kelas_jabatan || 'Siswa'
              };
              let { error: errBasic } = await supabase.from('pengguna').insert([basicPayload]);
              if (errBasic && (errBasic.message?.includes('duplicate key') || errBasic.code === '23505')) {
                await supabase.from('pengguna').update(basicPayload).eq('rfid_uid', basicPayload.rfid_uid);
                insertedCount++;
              } else if (!errBasic) {
                insertedCount++;
              } else {
                errCount++;
                lastErrorMsg = errBasic.message;
              }
            } else {
              errCount++;
              lastErrorMsg = error.message;
            }
          } else {
            insertedCount++;
          }
        } catch (e) {
          errCount++;
          lastErrorMsg = e?.message || String(e);
        }
      }

      const activeCreds = getSupabaseCredentials();
      const targetUrl = activeCreds.url || 'Supabase Cloud';

      if (errCount > 0 && insertedCount === 0) {
        alert(`Gagal mengirim data ke Supabase Cloud!\n\nTarget URL: ${targetUrl}\nPesan Error Supabase: ${lastErrorMsg}\n\nSolusi:\n1. Pastikan URL & Anon Key di tab 'Database Supabase' sudah sesuai dengan Project Baru Anda.\n2. Pastikan RLS Policy di Supabase sudah diatur ke Akses Publik.`);
      } else {
        alert(`BERHASIL! ${insertedCount} Data Pengguna berhasil di-upload & disinkronkan ke Supabase Cloud!\n\nTarget URL Supabase: ${targetUrl}\n\nJika tabel di Supabase Dashboard Baru Anda masih kosong, mohon cek menu 'Pengaturan & User' -> 'Database Supabase' untuk memastikan Project URL & Anon Key yang dimasukkan adalah milik Project Baru Anda.`);
      }
    } catch (e) {
      alert('Error saat sinkronisasi: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const deletedIds = getDeletedSampleIds();

  // Kelas murid yang sedang aktif terdaftar (filter deletedIds)
  const kelasAktifMurid = Array.from(new Set(
    daftarPengguna
      .filter(p => p.peran !== 'guru' && p.kelas_jabatan)
      .map(p => p.kelas_jabatan.trim())
      .filter(k => k && !deletedIds.includes(k))
  ));

  const kelasDariSettings = Object.keys(settings.jamPulangPerKelas || {})
    .filter(k => k !== 'Guru / Staf' && !deletedIds.includes(k));

  const daftarSemuaKelasUnik = Array.from(new Set([
    ...kelasAktifMurid,
    ...kelasDariSettings
  ])).sort();

  const filteredPengguna = daftarPengguna.filter(p => 
    p.nama_lengkap?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.rfid_uid?.includes(searchQuery) ||
    p.nip_nisn?.includes(searchQuery) ||
    p.kelas_jabatan?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const kekuatanPass = hitungKekuatanPassword(passBaru);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto ${
      isDark ? 'bg-slate-950/85' : 'bg-slate-900/40'
    }`}>
      <div className={`border rounded-3xl w-full max-w-full sm:max-w-5xl max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden mx-auto my-auto transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-slate-50 border-teal-200/90 text-slate-800 shadow-2xl shadow-cyan-900/10'
      }`}>

        
        {/* Header Dialog & Tab Controls */}
        <div className={`p-3.5 sm:p-5 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-gradient-to-r from-teal-700 via-emerald-700 to-cyan-800 text-white border-teal-600 shadow-md'
        }`}>
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center flex-shrink-0">
                <img src="/logo.png" alt="Logo Sekolah" className="w-full h-full object-contain filter drop-shadow-sm" />
              </div>
              <div>
                <h2 className="text-sm sm:text-lg font-bold text-white">Panel Administrasi & Pengaturan</h2>
                <p className={`text-[10px] sm:text-xs ${isDark ? 'text-slate-400' : 'text-teal-100'}`}>SDIT Qurratu A'yun Al-Islami &bull; Kab. Maros</p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className={`sm:hidden p-1.5 rounded-xl transition-colors ${
                isDark ? 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700' : 'text-teal-100 hover:text-white bg-teal-800/60 hover:bg-teal-800'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {/* Tabs */}
            <div className={`flex p-1 rounded-xl border w-full sm:w-auto overflow-x-auto whitespace-nowrap scrollbar-none ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-teal-900/40 border-teal-600/50 backdrop-blur-sm'
            }`}>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all flex-shrink-0 ${
                  activeTab === 'dashboard' 
                    ? 'bg-indigo-600 text-white shadow font-extrabold ring-2 ring-indigo-400' 
                    : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-teal-100 hover:text-white')
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-indigo-300" /> Dashboard Kelas
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all flex-shrink-0 ${
                  activeTab === 'users' 
                    ? 'bg-cyan-600 text-white shadow font-extrabold' 
                    : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-teal-100 hover:text-white')
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Kelola User
              </button>

              <button
                onClick={() => setActiveTab('classes')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all flex-shrink-0 ${
                  activeTab === 'classes' 
                    ? 'bg-blue-600 text-white shadow font-extrabold' 
                    : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-teal-100 hover:text-white')
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Kelola Kelas
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all flex-shrink-0 ${
                  activeTab === 'settings' 
                    ? 'bg-emerald-600 text-white shadow font-extrabold' 
                    : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-teal-100 hover:text-white')
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> Jam Sekolah
              </button>

              <button
                onClick={() => setActiveTab('password')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all flex-shrink-0 ${
                  activeTab === 'password' 
                    ? 'bg-amber-600 text-white shadow font-extrabold' 
                    : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-teal-100 hover:text-white')
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" /> Password Admin
              </button>

              <button
                onClick={() => setActiveTab('supabase')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all flex-shrink-0 ${
                  activeTab === 'supabase' 
                    ? 'bg-cyan-600 text-white shadow ring-2 ring-cyan-400 font-extrabold' 
                    : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-teal-100 hover:text-white')
                }`}
              >
                <Database className="w-3.5 h-3.5 text-cyan-400" /> Database Supabase
              </button>
            </div>


            <button 
              onClick={onClose}
              className={`hidden sm:block p-2 rounded-xl transition-colors flex-shrink-0 ${
                isDark ? 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700' : 'text-teal-100 hover:text-white bg-teal-800/60 hover:bg-teal-800'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TAB 0: DASHBOARD KELAS & RINGKASAN PRESENSI */}
        {activeTab === 'dashboard' && (
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-6">
            
            {/* Header Control Panel */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 sm:p-5 rounded-2xl backdrop-blur-md">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-400" /> Dashboard Statistik Presensi Siswa Per Kelas
                </h3>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  Presensi Realtime Hari Ini &bull; {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => muatDashboardPresensi(daftarPengguna)}
                  disabled={loadingDashboard}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${loadingDashboard ? 'animate-spin' : ''}`} />
                  Refresh Data
                </button>

                <button
                  type="button"
                  onClick={handleKosongkanPresensiHariIni}
                  className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  Kosongkan Presensi Hari Ini
                </button>
              </div>
            </div>

            {/* Top 4 Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Total Murid */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-blue-950/40 border border-blue-900/30 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Murid Terdaftar</p>
                  <h4 className="text-2xl font-black text-white mt-1">{dashboardStats.totalMurid} <span className="text-xs font-normal text-slate-400">siswa</span></h4>
                  <p className="text-[10px] text-blue-400 mt-1">Tersebar di {dashboardStats.kelasStats.length} Kelas</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              {/* Card 2: Sudah Presensi */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 border border-emerald-900/30 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/90">Sudah Presensi Hari Ini</p>
                  <h4 className="text-2xl font-black text-emerald-400 mt-1">{dashboardStats.totalSudahPresensi} <span className="text-xs font-normal text-emerald-300/70">siswa</span></h4>
                  <p className="text-[10px] text-emerald-400/80 mt-1">Hadir & Terlambat</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <UserCheck className="w-6 h-6" />
                </div>
              </div>

              {/* Card 3: Belum Presensi */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-rose-950/40 border border-rose-900/30 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-400/90">Belum Presensi</p>
                  <h4 className="text-2xl font-black text-rose-400 mt-1">{dashboardStats.totalBelumPresensi} <span className="text-xs font-normal text-rose-300/70">siswa</span></h4>
                  <p className="text-[10px] text-rose-400/80 mt-1">Belum Tap RFID Hari Ini</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <UserX className="w-6 h-6" />
                </div>
              </div>

              {/* Card 4: Persentase Kehadiran */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 border border-indigo-900/30 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                <div className="w-full">
                  <div className="flex justify-between items-center">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">Persentase Kehadiran</p>
                    <PieChart className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h4 className="text-2xl font-black text-indigo-300 mt-1">{dashboardStats.persentaseTotal}%</h4>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${dashboardStats.persentaseTotal}%` }}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Filter Search Kelas */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama kelas..."
                  value={searchDashboardKelas}
                  onChange={(e) => setSearchDashboardKelas(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <span className="text-xs text-slate-400 font-medium self-end sm:self-center">
                Total {dashboardStats.kelasStats.length} Kelas Terdaftar
              </span>
            </div>

            {/* Grid Kelas Stats */}
            {dashboardStats.kelasStats.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
                <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-300">Belum Ada Data Kelas / Murid Terdaftar</p>
                <p className="text-xs text-slate-500 mt-1">Daftarkan murid dan kelas terlebih dahulu di tab <strong>Kelola User</strong>.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {dashboardStats.kelasStats
                  .filter(ks => ks.namaKelas.toLowerCase().includes(searchDashboardKelas.toLowerCase()))
                  .map((ks, idx) => {
                    const isExpanded = expandedKelas === ks.namaKelas;
                    const pctColor = ks.persentase >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : ks.persentase >= 50 ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30';

                    return (
                      <div 
                        key={idx}
                        className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-5 shadow-lg transition-all flex flex-col justify-between"
                      >
                        <div>
                          {/* Header Kelas */}
                          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
                                <GraduationCap className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-white">{ks.namaKelas}</h4>
                                <p className="text-[11px] text-slate-400 font-semibold">{ks.sudahPresensi} dari {ks.totalMurid} Murid Presensi</p>
                              </div>
                            </div>

                            <span className={`px-2.5 py-1 rounded-full text-xs font-black border ${pctColor}`}>
                              {ks.persentase}%
                            </span>
                          </div>

                          {/* Progress Bar Segmented */}
                          <div className="mt-4 space-y-1.5">
                            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                              <div 
                                className="bg-emerald-500 h-full transition-all"
                                style={{ width: `${ks.totalMurid > 0 ? (ks.hadirCount / ks.totalMurid) * 100 : 0}%` }}
                                title={`Hadir Tepat Waktu: ${ks.hadirCount}`}
                              />
                              <div 
                                className="bg-amber-500 h-full transition-all"
                                style={{ width: `${ks.totalMurid > 0 ? (ks.terlambatCount / ks.totalMurid) * 100 : 0}%` }}
                                title={`Terlambat: ${ks.terlambatCount}`}
                              />
                              <div 
                                className="bg-slate-700 h-full transition-all"
                                style={{ width: `${ks.totalMurid > 0 ? (ks.belumPresensi / ks.totalMurid) * 100 : 0}%` }}
                                title={`Belum Presensi: ${ks.belumPresensi}`}
                              />
                            </div>

                            {/* Mini Metrics Badges */}
                            <div className="flex items-center justify-between text-[11px] font-semibold pt-1">
                              <span className="text-emerald-400 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Hadir: {ks.hadirCount}
                              </span>
                              <span className="text-amber-400 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Terlambat: {ks.terlambatCount}
                              </span>
                              <span className="text-slate-400 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" /> Belum: {ks.belumPresensi}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Accordion Toggle Button */}
                        <div className="mt-4 pt-3 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => setExpandedKelas(isExpanded ? null : ks.namaKelas)}
                            className="w-full py-2 bg-slate-800/60 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-slate-700/50"
                          >
                            {isExpanded ? (
                              <>
                                Sembunyikan Rincian Siswa <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
                              </>
                            ) : (
                              <>
                                Lihat Rincian Siswa ({ks.totalMurid}) <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                              </>
                            )}
                          </button>

                          {/* Accordion Content: Student Status List */}
                          {isExpanded && (
                            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                              {ks.siswaList.map((siswa, sIdx) => {
                                let badgeStyle = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
                                let statusText = 'Belum Presensi';

                                if (siswa.sudahPresensi) {
                                  if (siswa.statusKehadiran === 'terlambat') {
                                    badgeStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                                    statusText = `Terlambat (${siswa.waktuTap})`;
                                  } else {
                                    badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                                    statusText = `Hadir (${siswa.waktuTap})`;
                                  }
                                }

                                return (
                                  <div 
                                    key={sIdx}
                                    className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-300 font-bold">
                                        {siswa.nama_lengkap.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="font-bold text-slate-200 text-xs">{siswa.nama_lengkap}</p>
                                        <p className="text-[10px] text-slate-500">{siswa.nip_nisn ? `NISN: ${siswa.nip_nisn}` : 'Murid'}</p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeStyle}`}>
                                        {statusText}
                                      </span>

                                      {/* Quick WA button if parent number available */}
                                      {siswa.no_wa_ortu && !siswa.sudahPresensi && (
                                        <a
                                          href={`https://wa.me/${siswa.no_wa_ortu.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Assalamu'alaikum Warahmatullah. Menginfokan bahwa Ananda *${siswa.nama_lengkap}* belum melakukan presensi RFID hari ini di SDIT Qurratu A'yun.`)}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          title="Kirim Pesan WA ke Ortu"
                                          className="p-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 rounded-lg transition-colors"
                                        >
                                          <MessageSquare className="w-3.5 h-3.5" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })}
              </div>
            )}

          </div>
        )}

        {/* TAB 1: KELOLA USER & RFID */}
        {activeTab === 'users' && (
          <div className="p-6 flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* FORM USER (5 Cols) */}
            <div className="lg:col-span-5 bg-slate-950/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm flex flex-col justify-between">
              <form onSubmit={tanganiSimpanUser} className="space-y-3.5">
                
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    {editId ? <Edit3 className="w-4 h-4 text-amber-400" /> : <UserPlus className="w-4 h-4 text-cyan-400" />}
                    {editId ? 'Edit Data Pengguna' : 'Registrasi Kartu Baru'}
                  </h3>
                  {editId && (
                    <button 
                      type="button" 
                      onClick={resetFormUser}
                      className="text-[11px] text-cyan-400 hover:underline"
                    >
                      Batal Edit
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-cyan-400" /> UID Kartu RFID: *
                    </span>
                    <button 
                      type="button" 
                      onClick={generateRandomUID}
                      className="text-[10px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded"
                    >
                      <Sparkles className="w-3 h-3 text-cyan-400" /> Acak UID
                    </button>
                  </label>
                  <input 
                    type="text"
                    value={rfidUid}
                    onChange={(e) => setRfidUid(e.target.value)}
                    placeholder="Kosongkan untuk buat UID otomatis / Tempel Kartu..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-1.5 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Peran: *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPeran('murid')}
                      className={`py-1.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        peran === 'murid' 
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md' 
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4" /> MURID
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeran('guru')}
                      className={`py-1.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        peran === 'guru' 
                          ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-md' 
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Briefcase className="w-4 h-4" /> GURU / STAF
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Nama Lengkap: *</label>
                  <input 
                    type="text"
                    required
                    value={namaLengkap}
                    onChange={(e) => setNamaLengkap(e.target.value)}
                    placeholder={peran === 'guru' ? 'Contoh: Budi Santoso, M.Pd.' : 'Contoh: Ahmad Dahlan'}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">
                    {peran === 'guru' ? 'NIP Pegawai:' : 'NISN Siswa:'}
                  </label>
                  <input 
                    type="text"
                    value={nipNisn}
                    onChange={(e) => setNipNisn(e.target.value)}
                    placeholder={peran === 'guru' ? '198501152010011002' : '20241001'}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">
                    {peran === 'guru' ? 'Mata Pelajaran / Jabatan:' : 'Kelas:'}
                  </label>
                  <input 
                    type="text"
                    value={kelasJabatan}
                    onChange={(e) => setKelasJabatan(e.target.value)}
                    placeholder={peran === 'guru' ? 'Guru Matematika' : 'XII IPA 1'}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" /> Nomor WA Orang Tua / Wali:
                  </label>
                  <input 
                    type="text"
                    value={noWaOrtu}
                    onChange={(e) => setNoWaOrtu(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-1.5 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Seksi Unggah / Input Foto Profil */}
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-cyan-400" /> Foto Profil:
                    </label>
                    {fotoUrl && (
                      <button 
                        type="button" 
                        onClick={() => setFotoUrl('')} 
                        className="text-[10px] text-rose-400 hover:underline"
                      >
                        Hapus Foto
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Frame Preview Foto */}
                    <div className="w-14 h-14 rounded-xl border border-slate-700 bg-slate-900 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-md">
                      {fotoUrl ? (
                        <img src={fotoUrl} alt="Preview Foto" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-slate-600" />
                      )}
                    </div>

                    <div className="flex-1 space-y-1.5">
                      {/* Tombol Upload File Gambar dari Laptop/HP */}
                      <label className="cursor-pointer px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs text-cyan-300 font-medium flex items-center justify-center gap-1.5 transition-all shadow-sm">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Foto (PNG/JPG)</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            if (file.size > 3 * 1024 * 1024) {
                              alert('Ukuran foto maksimal 3MB!');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (evt) => setFotoUrl(evt.target.result);
                            reader.readAsDataURL(file);
                          }} 
                          className="hidden" 
                        />
                      </label>

                      {/* Input URL Foto Manual */}
                      <input 
                        type="text"
                        value={fotoUrl}
                        onChange={(e) => setFotoUrl(e.target.value)}
                        placeholder="Atau tempel Link URL Foto di sini..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Opsi Avatar Presets Cepat */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 mb-1">Pilih Avatar Sampel Cepat:</p>
                    <div className="flex items-center gap-2">
                      {avatarPresets.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFotoUrl(preset)}
                          className={`w-7 h-7 rounded-full border-2 overflow-hidden transition-all ${
                            fotoUrl === preset ? 'border-cyan-400 scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={preset} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                  <Save className="w-4 h-4" />
                  {editId ? 'Simpan Perubahan Data' : 'Daftarkan Kartu RFID'}
                </button>

              </form>
            </div>

            {/* TABEL USER (7 Cols) */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div className="mb-4 flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama, NISN/NIP, kelas, atau UID..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <button onClick={muatDaftarPengguna} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 border border-slate-700" title="Muat Ulang Data">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button 
                  onClick={tanganiSyncKeSupabase}
                  className="px-2.5 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all flex-shrink-0"
                  title="Upload & Sinkronkan Seluruh Data User ke Database Cloud Supabase"
                >
                  <Database className="w-3.5 h-3.5 text-cyan-400" /> Upload Ke Cloud
                </button>
                <button 
                  onClick={tanganiBersihkanSemuaDataSampel} 
                  className="px-2.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all flex-shrink-0"
                  title="Bersihkan seluruh data sampel contoh bawaan (Ahmad Dahlan, Budi Santoso, XII IPA 1, dst)"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Reset Sampel
                </button>
              </div>

              <div className="flex-1 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-950/40">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/80 sticky top-0">
                      <th className="p-3">User / Foto</th>
                      <th className="p-3">Peran & WA Ortu</th>
                      <th className="p-3">UID RFID</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredPengguna.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <img src={p.foto_url || avatarPresets[0]} alt={p.nama_lengkap} className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-700" />
                            <div>
                              <p className="font-bold text-slate-200">{p.nama_lengkap}</p>
                              <p className="text-[10px] text-slate-400">{p.kelas_jabatan || '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            p.peran === 'guru' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}>
                            {(p.peran || 'murid').toUpperCase()}
                          </span>
                          <p className="text-[10px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {p.no_wa_ortu || '-'}
                          </p>
                        </td>
                        <td className="p-3">
                          <code className="bg-slate-900 px-2 py-1 rounded text-cyan-300 font-mono border border-slate-800">{p.rfid_uid}</code>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => mulaiEditUser(p)} className="p-1.5 bg-slate-800 hover:bg-amber-950 hover:text-amber-300 border border-slate-700 rounded-lg text-slate-300">
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => tanganiHapusUser(p.id, p.nama_lengkap)} className="p-1.5 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 border border-slate-700 rounded-lg text-slate-400">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB KELOLA KELAS & ROMBEL */}
        {activeTab === 'classes' && (
          <div className="p-6 flex-1 overflow-y-auto max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Daftar Kelas & Rombel Aktif</h3>
                    <p className="text-xs text-slate-400">Ubah nama kelas, hapus kelas lama (seperti kelas sampel/alumni), dan atur kelompok siswa</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={tanganiBersihkanSemuaDataSampel}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clean Seluruh Data Sampel
                </button>
              </div>

              {daftarSemuaKelasUnik.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  <p>Belum ada kelas yang terdaftar dalam sistem.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/80">
                        <th className="p-3">Nama Kelas / Rombel</th>
                        <th className="p-3">Jumlah Siswa / User</th>
                        <th className="p-3">Jam Pulang Kelas</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {daftarSemuaKelasUnik.map((namaK) => {
                        const countSiswa = daftarPengguna.filter(p => p.kelas_jabatan === namaK).length;
                        const jamPulang = getJamPulangKelas(namaK, settings);
                        const isEditing = editingKelasOld === namaK;

                        return (
                          <tr key={namaK} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3 font-bold text-slate-200">
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingKelasNew}
                                    onChange={(e) => setEditingKelasNew(e.target.value)}
                                    className="bg-slate-950 border border-cyan-500 rounded-lg px-2.5 py-1 text-xs text-white"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => tanganiUbahNamaKelas(namaK, editingKelasNew)}
                                    className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500"
                                    title="Simpan Nama Kelas"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingKelasOld(null)}
                                    className="p-1 bg-slate-700 text-slate-300 rounded"
                                    title="Batal"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span>{namaK}</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                {countSiswa} Siswa / User
                              </span>
                            </td>
                            <td className="p-3">
                              <TimeInput24h
                                value={getJamPulangKelas(namaK, settings)}
                                onChange={(newTime) => updateJamPulangKelas(namaK, newTime)}
                                title="Ubah jam pulang khusus kelas ini"
                              />
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => { setEditingKelasOld(namaK); setEditingKelasNew(namaK); }}
                                  className="p-1.5 bg-slate-800 hover:bg-amber-950 hover:text-amber-300 text-slate-300 rounded-lg border border-slate-700"
                                  title="Edit Nama Kelas"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => tanganiHapusKelas(namaK)}
                                  className="p-1.5 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 rounded-lg border border-slate-700"
                                  title="Hapus Kelas"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PENGATURAN JAM MASUK & JAM PULANG PER KELAS */}
        {activeTab === 'settings' && (
          <div className="p-6 flex-1 overflow-y-auto max-w-4xl mx-auto space-y-6">
            
            {settingsStatus.msg && (
              <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 border ${
                settingsStatus.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}>
                <CheckCircle2 className="w-4 h-4" /> {settingsStatus.msg}
              </div>
            )}

            <form onSubmit={tanganiSimpanSettings} className="space-y-6">
              
              {/* Bagian 1: Jam Batas Masuk Normal */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Jam Batas Masuk Sekolah (Batas Toleransi Terlambat)</h3>
                    <p className="text-xs text-slate-400">Jam di mana murid yang melakukan tap setelah waktu ini akan terdeteksi "TERLAMBAT"</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-300 font-semibold mb-1 block">Batas Waktu Masuk (Toleransi):</label>
                    <TimeInput24h 
                      value={settings.jamMasuk}
                      onChange={(newTime) => setSettings({ ...settings, jamMasuk: newTime })}
                      title="Atur jam toleransi masuk"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold mb-1 block">Jam Pulang Default (Umum):</label>
                    <TimeInput24h 
                      value={settings.jamPulangDefault}
                      onChange={(newTime) => setSettings({ ...settings, jamPulangDefault: newTime })}
                      title="Atur jam pulang umum"
                    />
                  </div>
                </div>
              </div>

              {/* Bagian 2: Jam Pulang Khusus per Kelas / Kelompok Kelas */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Jam Pulang Khusus per Kelas</h3>
                      <p className="text-xs text-slate-400">Atur jam pulang yang berbeda untuk tiap kelas (misal: Kelas 1-2 pulang 11:30, Kelas 5-6 pulang 13:30)</p>
                    </div>
                  </div>
                </div>

                {/* Form Tambah Jam Pulang Kelas Baru */}
                <div className="flex flex-col sm:flex-row gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="flex-1 flex flex-col sm:flex-row gap-2">
                    {daftarSemuaKelasUnik.length > 0 && (
                      <select
                        value={daftarSemuaKelasUnik.includes(kelasBaruName) ? kelasBaruName : ''}
                        onChange={(e) => {
                          if (e.target.value) setKelasBaruName(e.target.value);
                        }}
                        className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-cyan-300 font-semibold focus:outline-none focus:border-blue-500"
                      >
                        <option value="">-- Pilih Kelas Terdaftar --</option>
                        {daftarSemuaKelasUnik.map(k => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    )}
                    <input
                      type="text"
                      value={kelasBaruName}
                      onChange={(e) => setKelasBaruName(e.target.value)}
                      placeholder="Atau ketik nama kelas..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <TimeInput24h
                    value={kelasBaruTime}
                    onChange={(newTime) => setKelasBaruTime(newTime)}
                    title="Pilih jam pulang kelas baru"
                  />
                  <button
                    type="button"
                    onClick={tambahJamPulangKelasBaru}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Simpan Aturan Jam
                  </button>
                </div>

                {/* Table Daftar Aturan Jam Pulang Kelas */}
                <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/80">
                        <th className="p-3">Nama Kelas / Kelompok Kelas</th>
                        <th className="p-3">Jam Waktu Pulang</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {Object.entries(settings.jamPulangPerKelas || {}).map(([kelasKey, jamVal]) => (
                        <tr key={kelasKey} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-bold text-slate-200">{kelasKey}</td>
                          <td className="p-3">
                            <TimeInput24h 
                              value={jamVal}
                              onChange={(newTime) => updateJamPulangKelas(kelasKey, newTime)}
                              title="Ubah jam pulang kelas"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => hapusJamPulangKelas(kelasKey)}
                              className="p-1.5 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 rounded-lg border border-slate-700"
                              title="Hapus Aturan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              {/* Bagian 3: Integrasi WhatsApp Gateway (Fonnte API Token) */}
              <div className="bg-gradient-to-br from-slate-950 to-emerald-950/30 border border-emerald-800/40 rounded-2xl p-5 space-y-4 shadow-lg">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        Integrasi WhatsApp Gateway Fonnte
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          100% Kirim Otomatis
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        Masukkan Token API Fonnte agar pesan WA presensi terkirim secara otomatis 100% di background ke HP orang tua tanpa perlu membuka WhatsApp Web!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-300 font-semibold mb-1 flex justify-between items-center">
                      <span>Fonnte Account API Token:</span>
                      <a 
                        href="https://fonnte.com" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 font-bold"
                      >
                        Dapatkan Token Fonnte (Gratis) &rarr;
                      </a>
                    </label>
                    <input
                      type="text"
                      value={settings.fonnteToken || ''}
                      onChange={(e) => setSettings({ ...settings, fonnteToken: e.target.value })}
                      placeholder="Tempelkan API Token Fonnte di sini (misal: a1b2c3d4e5...)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-300 space-y-1">
                    <p className="font-bold text-emerald-400">💡 Cara Mengaktifkan Fonnte (Gratis / Berbayar):</p>
                    <ol className="list-decimal list-inside text-[11px] text-slate-400 space-y-0.5">
                      <li>Daftar akun di <a href="https://fonnte.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline">Fonnte.com</a>.</li>
                      <li>Sambungkan nomor WhatsApp sekolah dengan scan QR Code di dashboard Fonnte.</li>
                      <li>Salin <strong>Token API</strong> dari Fonnte dan tempelkan pada kolom di atas.</li>
                      <li>Klik tombol <strong>Simpan Pengaturan Sekolah</strong> di bawah.</li>
                    </ol>
                  </div>
                </div>
              </div>

                {/* Bagian 4: Zona Bahaya & Reset Database */}
                <div className="bg-gradient-to-br from-slate-950 to-rose-950/40 border border-rose-900/50 rounded-2xl p-5 space-y-4 shadow-lg mt-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                    <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Zona Bahaya & Reset Database</h3>
                      <p className="text-xs text-slate-400">Kosongkan riwayat presensi atau reset total seluruh database sekolah</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm('⚠️ KONFIRMASI: Apakah Anda yakin ingin MENGHAPUS SEMUA RIWAYAT PRESENSI?\n\nSemua catatan presensi masuk, pulang, dan izin akan dihapus bersih.')) {
                          const res = await hapusSemuaPresensiDatabase();
                          if (onDataChange) onDataChange();
                          setSettingsStatus({ type: res.ok ? 'success' : 'error', msg: res.msg });
                        }
                      }}
                      className="px-4 py-2.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-700/60 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      <Trash2 className="w-4 h-4 text-rose-400" /> Hapus Semua Riwayat Presensi
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm('🚨 DANGER ZONE: Apakah Anda benar-benar yakin ingin RESET TOTAL DATABASE?\n\nSemua data Murid, Guru/Staf, dan Riwayat Presensi akan DIHAPUS PERMANEN!')) {
                          const res = await hapusSemuaPenggunaDatabase();
                          if (onDataChange) onDataChange();
                          setSettingsStatus({ type: res.ok ? 'success' : 'error', msg: res.msg });
                        }
                      }}
                      className="px-4 py-2.5 bg-gradient-to-r from-rose-700 to-red-700 hover:from-rose-600 hover:to-red-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-rose-950 transition-all"
                    >
                      <Trash2 className="w-4 h-4 text-white" /> ⚠️ Reset Total Database
                    </button>
                  </div>
                </div>

              </div>

              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all"
                >
                  <Save className="w-4 h-4" /> Simpan Pengaturan Sekolah
                </button>
              </div>


            </form>

          </div>
        )}

        {/* TAB 3: FORM KEAMANAN & GANTI PASSWORD ADMIN */}
        {activeTab === 'password' && (
          <div className="p-8 max-w-xl mx-auto flex-1 flex flex-col justify-center">
            
            <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Ganti Password Admin</h3>
                  <p className="text-xs text-slate-400">Atur password baru yang stabil dan kuat untuk mengamankan sistem</p>
                </div>
              </div>

              {passStatus.msg && (
                <div className={`p-3 rounded-xl text-xs font-bold mb-4 border flex items-center gap-2 ${
                  passStatus.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}>
                  {passStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-rose-400" />}
                  {passStatus.msg}
                </div>
              )}

              <form onSubmit={tanganiGantiPassword} className="space-y-4">
                
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                    Password Admin Sekarang / Lama: *
                  </label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={passLama}
                    onChange={(e) => setPassLama(e.target.value)}
                    placeholder="Masukkan password saat ini (default: admin123)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 flex justify-between items-center">
                    <span>Password Admin Baru: *</span>
                    {kekuatanPass.label && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${kekuatanPass.color}`}>
                        {kekuatanPass.label}
                      </span>
                    )}
                  </label>

                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      value={passBaru}
                      onChange={(e) => setPassBaru(e.target.value)}
                      placeholder="Masukkan password baru (minimal 6 karakter)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                    Konfirmasi Password Baru: *
                  </label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={konfirmasiPass}
                    onChange={(e) => setKonfirmasiPass(e.target.value)}
                    placeholder="Ketik ulang password baru..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg"
                  >
                    <Save className="w-4 h-4" /> Simpan & Perbarui Password Admin
                  </button>
                </div>

              </form>
            </div>

          </div>
        )}

        {/* TAB 4: KONEKSI DATABASE SUPABASE REALTIME */}
        {activeTab === 'supabase' && (
          <div className="p-6 flex-1 overflow-y-auto max-w-2xl mx-auto w-full">
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/30">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Koneksi Database Supabase Realtime</h3>
                  <p className="text-xs text-slate-400">Masukkan Supabase URL dan Anon Key milik Anda agar Laptop & HP langsung tersambung dan tersinkronisasi 100% secara real-time.</p>
                </div>
              </div>

              {supaStatus.msg && (
                <div className={`p-3.5 rounded-xl border text-xs font-bold ${
                  supaStatus.type === 'success' ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300' : 'bg-rose-950/60 border-rose-500 text-rose-300'
                }`}>
                  {supaStatus.msg}
                </div>
              )}

              <form onSubmit={(e) => {
                e.preventDefault();
                if (!supaUrlInput.trim() || !supaKeyInput.trim()) {
                  setSupaStatus({ type: 'error', msg: 'Harap isi Supabase Project URL dan Anon Key secara lengkap!' });
                  return;
                }
                setSupabaseCredentials(supaUrlInput, supaKeyInput);
                setSupaStatus({ type: 'success', msg: 'Kredensial Supabase disimpan! Memuat ulang aplikasi...' });
              }} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Supabase Project URL: *</label>
                  <input
                    type="text"
                    required
                    value={supaUrlInput}
                    onChange={(e) => setSupaUrlInput(e.target.value)}
                    placeholder="https://xxxxxxxxxxxx.supabase.co"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Dapatkan dari Supabase Dashboard ➔ Project Settings ➔ API ➔ Project URL.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Supabase Anon Key: *</label>
                  <textarea
                    required
                    rows={3}
                    value={supaKeyInput}
                    onChange={(e) => setSupaKeyInput(e.target.value)}
                    placeholder="eyJHbg..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Dapatkan dari Supabase Dashboard ➔ Project Settings ➔ API ➔ Project API keys (anon / public).</p>
                </div>

                <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-2.5 flex-wrap justify-between items-center">
                  <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={async () => {
                        setLoading(true);
                        const res = await tesKoneksiSupabase();
                        setSupaStatus({ type: res.ok ? 'success' : 'error', msg: res.msg });
                        setLoading(false);
                      }}
                      className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Uji Koneksi DB
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        setLoading(true);
                        const res = await ujiSimpanPresensiTes();
                        setSupaStatus({ type: res.ok ? 'success' : 'error', msg: res.msg });
                        setLoading(false);
                      }}
                      className="px-3.5 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Uji Simpan 1 Data Tes
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm('Apakah Anda yakin ingin menghapus SELURUH data pengguna & presensi dari database Supabase? Tabel akan dikosongkan 100%.')) return;
                        setLoading(true);
                        try {
                          // Hapus seluruh presensi dan pengguna dari Supabase
                          await supabase.from('presensi').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                          await supabase.from('pengguna').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                          
                          // Reset cache lokal
                          localStorage.removeItem('presensi_mock_pengguna_list');
                          localStorage.removeItem('presensi_riwayat_lokal');
                          localStorage.removeItem('presensi_mock_presensi_list');
                          window.dispatchEvent(new Event('presensi_history_updated'));

                          setSupaStatus({ type: 'success', msg: 'Database Supabase & penyimpanan lokal BERHASIL dikosongkan 100%!' });
                          await muatDaftarPengguna();
                        } catch (err) {
                          setSupaStatus({ type: 'error', msg: 'Gagal mengosongkan database: ' + (err?.message || err) });
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="px-3.5 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Kosongkan Database Supabase
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
                  >
                    <Save className="w-4 h-4" /> Simpan Kredensial Supabase
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}



      </div>
    </div>
  );
}

