import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
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
  UserCheck
} from 'lucide-react';

export default function ModalKelolaUser({ isOpen, onClose, onDataChange }) {
  const [loading, setLoading] = useState(false);
  const [daftarPengguna, setDaftarPengguna] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State Form (Tambah / Edit)
  const [editId, setEditId] = useState(null); // null jika Tambah Baru
  const [rfidUid, setRfidUid] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [peran, setPeran] = useState('murid'); // 'murid' atau 'guru'
  const [nipNisn, setNipNisn] = useState('');
  const [kelasJabatan, setKelasJabatan] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');

  // Mode Scan Kartu Fisik Baru
  const [isScanningKartu, setIsScanningKartu] = useState(false);
  const scanInputRef = useRef(null);

  // Preset Avatar Gambar
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
      const { data, error } = await supabase
        .from('pengguna')
        .select('*');

      if (error) throw error;
      setDaftarPengguna(data || []);
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto Generate UID Acak untuk pengujian tanpa kartu fisik
  const generateRandomUID = () => {
    const randomUID = Math.floor(10000000 + Math.random() * 90000000).toString();
    setRfidUid(randomUID);
  };

  // Tangani Submit Form (Tambah atau Edit)
  const tanganiSimpan = async (e) => {
    e.preventDefault();
    if (!rfidUid.trim() || !namaLengkap.trim()) {
      alert('Mohon isi UID Kartu RFID dan Nama Lengkap!');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        rfid_uid: rfidUid.trim(),
        nama_lengkap: namaLengkap.trim(),
        peran,
        nip_nisn: nipNisn.trim() || (peran === 'guru' ? '198001012010011001' : '20241099'),
        kelas_jabatan: kelasJabatan.trim() || (peran === 'guru' ? 'Guru Pengajar' : 'XII IPA 1'),
        foto_url: fotoUrl.trim() || avatarPresets[Math.floor(Math.random() * avatarPresets.length)]
      };

      if (editId) {
        // Edit User
        const { error } = await supabase
          .from('pengguna')
          .update(payload)
          .eq('id', editId);
        if (error) throw error;
        alert(`Data ${namaLengkap} berhasil diperbarui!`);
      } else {
        // Tambah User Baru
        const { error } = await supabase
          .from('pengguna')
          .insert([payload]);
        if (error) throw error;
        alert(`Kartu RFID berhasil didaftarkan untuk ${namaLengkap}!`);
      }

      resetForm();
      muatDaftarPengguna();
    } catch (err) {
      console.error('Error saving user:', err);
      alert(`Gagal menyimpan data: ${err.message || 'Terjadi kesalahan'}`);
    } finally {
      setLoading(false);
    }
  };

  // Isi Form saat mengklik Edit
  const mulaiEdit = (user) => {
    setEditId(user.id);
    setRfidUid(user.rfid_uid);
    setNamaLengkap(user.nama_lengkap);
    setPeran(user.peran || 'murid');
    setNipNisn(user.nip_nisn || '');
    setKelasJabatan(user.kelas_jabatan || '');
    setFotoUrl(user.foto_url || '');
  };

  // Tangani Hapus Pengguna
  const tanganiHapus = async (id, nama) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus kartu RFID & data ${nama}?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('pengguna')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert(`Data ${nama} berhasil dihapus!`);
      muatDaftarPengguna();
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Gagal menghapus data.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditId(null);
    setRfidUid('');
    setNamaLengkap('');
    setPeran('murid');
    setNipNisn('');
    setKelasJabatan('');
    setFotoUrl('');
    setIsScanningKartu(false);
  };

  // Filter Pengguna berdasarkan pencarian
  const filteredPengguna = daftarPengguna.filter(p => 
    p.nama_lengkap?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.rfid_uid?.includes(searchQuery) ||
    p.nip_nisn?.includes(searchQuery) ||
    p.kelas_jabatan?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header Dialog */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl text-white shadow-lg shadow-cyan-500/20">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Kelola Data & Registrasi Kartu RFID</h2>
              <p className="text-xs text-slate-400">Daftarkan kartu RFID baru untuk Murid & Guru atau edit data yang sudah ada</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: FORM REGISTRASI / EDIT (5 Cols) */}
          <div className="lg:col-span-5 bg-slate-950/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm flex flex-col justify-between">
            <form onSubmit={tanganiSimpan} className="space-y-4">
              
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  {editId ? <Edit3 className="w-4 h-4 text-amber-400" /> : <UserPlus className="w-4 h-4 text-cyan-400" />}
                  {editId ? 'Edit Data Pengguna' : 'Registrasi Kartu Baru'}
                </h3>
                {editId && (
                  <button 
                    type="button" 
                    onClick={resetForm}
                    className="text-[11px] text-cyan-400 hover:underline"
                  >
                    Batal Edit
                  </button>
                )}
              </div>

              {/* Input RFID UID dengan Mode Scan Fisik */}
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
                    <Sparkles className="w-3 h-3 text-cyan-400" /> Acak UID (Demo)
                  </button>
                </label>

                <div className="relative">
                  <input 
                    type="text"
                    required
                    value={rfidUid}
                    onChange={(e) => setRfidUid(e.target.value)}
                    placeholder="Contoh: 10012024 atau Tempel Kartu..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                  />
                  {isScanningKartu && (
                    <span className="absolute right-2 top-2 text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded animate-pulse">
                      Ready Scan...
                    </span>
                  )}
                </div>
              </div>

              {/* Peran (Murid / Guru) */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                  Peran Pengguna: *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPeran('murid')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      peran === 'murid' 
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-950' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" /> MURID
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeran('guru')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      peran === 'guru' 
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-md shadow-purple-950' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Briefcase className="w-4 h-4" /> GURU / STAF
                  </button>
                </div>
              </div>

              {/* Nama Lengkap */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">
                  Nama Lengkap: *
                </label>
                <input 
                  type="text"
                  required
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  placeholder={peran === 'guru' ? 'Contoh: Drs. Suherman, M.Pd.' : 'Contoh: Ahmad Dahlan'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* NISN / NIP */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">
                  {peran === 'guru' ? 'NIP (Nomor Induk Pegawai):' : 'NISN (Nomor Induk Siswa):'}
                </label>
                <input 
                  type="text"
                  value={nipNisn}
                  onChange={(e) => setNipNisn(e.target.value)}
                  placeholder={peran === 'guru' ? '198501152010011002' : '20241001'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Kelas / Jabatan */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">
                  {peran === 'guru' ? 'Mata Pelajaran / Jabatan:' : 'Kelas:'}
                </label>
                <input 
                  type="text"
                  value={kelasJabatan}
                  onChange={(e) => setKelasJabatan(e.target.value)}
                  placeholder={peran === 'guru' ? 'Guru Fisika / Wali Kelas' : 'XII IPA 1'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Foto URL Preset Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">
                  Pilih / Input URL Foto Profil:
                </label>
                <input 
                  type="text"
                  value={fotoUrl}
                  onChange={(e) => setFotoUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500 mb-2"
                />
                
                {/* Preset Avatar Thumbs */}
                <div className="flex gap-2">
                  {avatarPresets.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Avatar ${idx}`}
                      onClick={() => setFotoUrl(url)}
                      className={`w-8 h-8 rounded-lg object-cover cursor-pointer hover:scale-110 transition-transform ${
                        fotoUrl === url ? 'ring-2 ring-cyan-400' : 'opacity-60'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-900/30"
              >
                <Save className="w-4 h-4" />
                {editId ? 'Simpan Perubahan Data' : 'Daftarkan Kartu RFID'}
              </button>

            </form>
          </div>

          {/* RIGHT COLUMN: DAFTAR USER & RFID TABLE (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            
            {/* Search Bar */}
            <div className="mb-4 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama, NISN/NIP, kelas, atau UID RFID..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                onClick={muatDaftarPengguna}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 border border-slate-700"
                title="Refresh Data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Table Users */}
            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-950/40">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/80 sticky top-0">
                    <th className="p-3">User / Foto</th>
                    <th className="p-3">Peran & NISN/NIP</th>
                    <th className="p-3">UID RFID</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredPengguna.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-slate-500 text-xs">
                        Tidak ada data pengguna yang sesuai pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredPengguna.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <img 
                              src={p.foto_url || avatarPresets[0]} 
                              alt={p.nama_lengkap} 
                              className="w-9 h-9 rounded-lg object-cover ring-1 ring-slate-700"
                            />
                            <div>
                              <p className="font-bold text-slate-200">{p.nama_lengkap}</p>
                              <p className="text-[10px] text-slate-400">{p.kelas_jabatan || '-'}</p>
                            </div>
                          </div>
                        </td>

                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            p.peran === 'guru' 
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}>
                            {(p.peran || 'murid').toUpperCase()}
                          </span>
                          <p className="text-[10px] text-slate-400 font-mono mt-1">{p.nip_nisn || '-'}</p>
                        </td>

                        <td className="p-3">
                          <code className="bg-slate-900 px-2 py-1 rounded text-cyan-300 font-mono border border-slate-800">
                            {p.rfid_uid}
                          </code>
                        </td>

                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => mulaiEdit(p)}
                              className="p-1.5 bg-slate-800 hover:bg-amber-950 hover:text-amber-300 border border-slate-700 rounded-lg text-slate-300 transition-colors"
                              title="Edit Data"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => tanganiHapus(p.id, p.nama_lengkap)}
                              className="p-1.5 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 border border-slate-700 rounded-lg text-slate-400 transition-colors"
                              title="Hapus User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Stat */}
            <div className="mt-3 text-xs text-slate-400 flex justify-between items-center px-1">
              <span>Total Terdaftar: <strong className="text-white">{daftarPengguna.length}</strong> User</span>
              <span className="text-[11px] text-slate-500">Klik icon pensil untuk mengedit UID RFID</span>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
