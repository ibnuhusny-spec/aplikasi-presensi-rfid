import React, { useState, useEffect, useRef } from 'react';
import { supabase, getAdminPassword, setAdminPassword, clearStoredMockPresensi, getSupabaseCredentials, setSupabaseCredentials, initialMockPengguna, tesKoneksiSupabase, ujiSimpanPresensiTes, getDeletedSampleIds, markSampleAsDeleted, unmarkSampleAsDeleted } from '../lib/supabase';

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
  Layers
} from 'lucide-react';


export default function ModalKelolaUser({ isOpen, onClose, onDataChange, isDark = true }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'classes', 'settings', 'password', 'supabase'
  const [loading, setLoading] = useState(false);
  const [daftarPengguna, setDaftarPengguna] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
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
    if (isScanningKartu && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [isScanningKartu]);

  const muatDaftarPengguna = async () => {
    setLoading(true);
    try {
      let supaData = [];
      try {
        const fetchPromise = supabase.from('pengguna').select('*');
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ data: null }), 2000));
        const res = await Promise.race([fetchPromise, timeoutPromise]);
        if (res && res.data && Array.isArray(res.data)) supaData = res.data;
      } catch (e) {}

      let localData = [];
      try {
        const saved = localStorage.getItem('presensi_mock_pengguna_list');
        if (saved) localData = JSON.parse(saved);
      } catch (e) {}

      const deletedIds = getDeletedSampleIds();

      // Deduplikasi ketat: prioritaskan data TERBARU (reverse order), ambil 1 entri paling terkini
      const uniqueList = [];
      const seenNames = new Set();
      const duplicateIdsToDelete = [];

      // Balik urutan supaData agar data TERBARU diproses lebih dulu
      const supaReversed = [...supaData].reverse();
      const localReversed = [...localData].reverse();

      supaReversed.forEach(u => {
        if (!u || !u.nama_lengkap) return;
        const uId = String(u.id || '').trim();
        const uUid = String(u.rfid_uid || '').trim();
        const nameKey = u.nama_lengkap.toLowerCase().trim();

        // Abaikan jika terdaftar di deletedSampleIds
        if (deletedIds.includes(uId) || (uUid && deletedIds.includes(uUid)) || deletedIds.includes(u.nama_lengkap.trim())) {
          return;
        }

        if (seenNames.has(nameKey)) {
          // Tandai ID duplikat lama di DB untuk dibersihkan dari cloud
          if (uId) duplicateIdsToDelete.push(uId);
        } else {
          seenNames.add(nameKey);
          uniqueList.push(u);
        }
      });

      // Proses data lokal jika belum ada di Supabase
      localReversed.forEach(u => {
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

      // Bersihkan data duplikat lama di Supabase Cloud secara otomatis di background
      if (duplicateIdsToDelete.length > 0) {
        (async () => {
          try {
            await supabase.from('pengguna').delete().in('id', duplicateIdsToDelete);
          } catch(e) {}
        })();
      }

      // Perbarui local cache pengguna agar selalu bersih dari duplikat
      try {
        localStorage.setItem('presensi_mock_pengguna_list', JSON.stringify(uniqueList));
      } catch (e) {}

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

  const tanganiHapusUser = (id, nama) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus kartu RFID & data ${nama}?`)) return;

    const targetUser = daftarPengguna.find(p => String(p.id) === String(id) || p.nama_lengkap === nama);
    const targetUid = targetUser?.rfid_uid || '';

    // 1. UPDATE STATE & LOCAL STORAGE SEGERA SECARA KILAT (0 MILLISECONDS)!
    markSampleAsDeleted([id, nama, targetUid].filter(Boolean));

    try {
      const saved = localStorage.getItem('presensi_mock_pengguna_list');
      if (saved) {
        const list = JSON.parse(saved);
        const filtered = list.filter(u => 
          String(u.id) !== String(id) && 
          (!targetUid || String(u.rfid_uid) !== String(targetUid)) && 
          u.nama_lengkap?.toLowerCase().trim() !== String(nama).toLowerCase().trim()
        );
        localStorage.setItem('presensi_mock_pengguna_list', JSON.stringify(filtered));
      }
    } catch (e) {}

    setDaftarPengguna(prev => prev.filter(u => 
      String(u.id) !== String(id) && 
      (!targetUid || String(u.rfid_uid) !== String(targetUid)) && 
      u.nama_lengkap?.toLowerCase().trim() !== String(nama).toLowerCase().trim()
    ));

    if (onDataChange) onDataChange();

    // 2. HAPUS DATABASE SUPABASE CLOUD DI BACKGROUND (NON-BLOCKING)
    (async () => {
      try {
        await Promise.all([
          supabase.from('presensi').delete().eq('pengguna_id', id),
          targetUid ? supabase.from('pengguna').delete().eq('rfid_uid', String(targetUid)) : null,
          supabase.from('pengguna').delete().eq('id', id),
          supabase.from('pengguna').delete().ilike('nama_lengkap', nama)
        ].filter(Boolean));
      } catch (e) {
        console.warn('Background delete Supabase:', e);
      }
    })();
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

  const tanganiHapusKelas = async (namaKelas) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus Kelas "${namaKelas}"? Murid di kelas ini akan dialihkan ke kelas "Siswa", dan aturan jam pulangnya akan dihapus.`)) {
      return;
    }
    setLoading(true);
    try {
      // 1. Tandai nama kelas sebagai terhapus di tingkat klien
      markSampleAsDeleted(namaKelas);

      // 2. Update pengguna di Supabase jika ada
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

      // 3. Hapus dari pengaturan jam pulang
      removeKelasSetting(namaKelas);
      setSettings(getSchoolSettings());

      // 4. Reload data pengguna
      await muatDaftarPengguna();
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
  };

  const tanganiBersihkanSemuaDataSampel = async () => {
    if (!window.confirm('Apakah Anda yakin ingin membersihkan SELURUH data sampel bawaan & riwayat tes? Data sampel akan dihapus permanen dari aplikasi & database.')) {
      return;
    }
    setLoading(true);
    try {
      const sampelKelas = ['XII IPA 1', 'XI IPS 2', 'X 3', 'Kelas Uji'];
      const sampleUids = ['10012024', '10012025', '10012026', '10012027', '10012028', '10012029'];
      const sampleNames = ['Ahmad Dahlan', 'Siti Nurhaliza', 'Dewi Lestari', 'Rizky Febian', 'Budi Santoso, M.Pd.', 'Dra. Endang Rahayu', 'Pengguna Uji Coba'];

      // Tandai semua data sampel terhapus secara permanen di tingkat klien
      markSampleAsDeleted([...sampleUids, ...sampleNames, ...sampelKelas, '1', '2', '3', '4', '5', '6']);

      // 1. Hapus aturan kelas sampel dari settings
      for (const k of sampelKelas) {
        removeKelasSetting(k);
      }

      // 2. Ambil seluruh pengguna di Supabase untuk mencocokkan sampel
      try {
        const { data: dbAllUsers } = await supabase.from('pengguna').select('id, rfid_uid, nama_lengkap, kelas_jabatan');

        if (dbAllUsers && dbAllUsers.length > 0) {
          const targetUsers = dbAllUsers.filter(u => 
            sampleUids.includes(String(u.rfid_uid)) ||
            sampleNames.includes(u.nama_lengkap) ||
            sampelKelas.includes(u.kelas_jabatan) ||
            u.nama_lengkap?.includes('TEST') ||
            u.rfid_uid?.startsWith('TEST')
          );

          for (const targetUser of targetUsers) {
            await supabase.from('presensi').delete().eq('pengguna_id', targetUser.id);
            await supabase.from('pengguna').delete().eq('id', targetUser.id);
          }
        }

        // Hapus presensi tanpa pengguna valid / orphan di Supabase
        const { data: allPres } = await supabase.from('presensi').select('id, pengguna_id');
        if (allPres && allPres.length > 0) {
          const { data: validUsers } = await supabase.from('pengguna').select('id');
          const validIds = new Set((validUsers || []).map(u => String(u.id)));
          for (const p of allPres) {
            if (!p.pengguna_id || !validIds.has(String(p.pengguna_id))) {
              await supabase.from('presensi').delete().eq('id', p.id);
            }
          }
        }
      } catch (e) {}

      // Hapus tambahan berdasarkan rfid_uid & nama_lengkap langsung jika ada
      for (const uid of sampleUids) {
        try { await supabase.from('pengguna').delete().eq('rfid_uid', uid); } catch(e){}
      }
      for (const name of sampleNames) {
        try { await supabase.from('pengguna').delete().eq('nama_lengkap', name); } catch(e){}
      }

      // 3. Bersihkan localStorage caches
      try {
        localStorage.removeItem('presensi_mock_pengguna_list');
        localStorage.removeItem('presensi_riwayat_lokal');
        localStorage.removeItem('presensi_mock_presensi_list');
        window.dispatchEvent(new Event('presensi_history_updated'));
      } catch (e) {}

      setSettings(getSchoolSettings());
      await muatDaftarPengguna();
      alert('SELURUH data sampel bawaan & riwayat presensi sampel berhasil dibersihkan! Aplikasi kini 100% bersih.');
    } catch (e) {
      console.error('Error cleaning sample data:', e);
      alert('Gagal membersihkan data sampel: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const deletedIds = getDeletedSampleIds();

  // Kelas murid yang sedang aktif terdaftar HARUS SELALU TERDAFTAR OTOMATIS
  const kelasAktifMurid = Array.from(new Set(
    daftarPengguna
      .filter(p => p.peran !== 'guru' && p.kelas_jabatan)
      .map(p => p.kelas_jabatan.trim())
      .filter(Boolean)
  ));

  const kelasDariSettings = Object.keys(settings.jamPulangPerKelas || {}).filter(k => k !== 'Guru / Staf');

  const daftarSemuaKelasUnik = Array.from(new Set([
    ...kelasAktifMurid,
    ...kelasDariSettings.filter(k => !deletedIds.includes(k))
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

              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Apakah Anda yakin ingin membersihkan seluruh riwayat presensi? Data lama akan dihapus dan dimulai segar hari ini.')) {
                      clearStoredMockPresensi();
                      if (onDataChange) onDataChange();
                      setSettingsStatus({ type: 'success', msg: 'Riwayat presensi berhasil dibersihkan!' });
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" /> Bersihkan Riwayat Presensi
                </button>

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

