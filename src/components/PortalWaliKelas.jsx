import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Smartphone, Calendar, Search, CheckCircle2, AlertCircle, FileSpreadsheet, UserCheck, HeartPulse, FileText, UserX, Save, Sparkles, GraduationCap } from 'lucide-react';

export default function PortalWaliKelas({ isOpen, onClose, onDataUpdated, isDark = true }) {
  const [daftarKelas, setDaftarKelas] = useState([]);
  const [kelasPilihan, setKelasPilihan] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [daftarSiswa, setDaftarSiswa] = useState([]);
  const [presensiMap, setPresensiMap] = useState({}); // { pengguna_id: { status, keterangan, id } }
  const [searchQuery, setSearchQuery] = useState('');
  const [simpanSuccess, setSimpanSuccess] = useState(false);

  // Load daftar kelas unik dari database murid saat dialog dibuka
  useEffect(() => {
    if (isOpen) {
      muatDaftarKelasDinamis();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && kelasPilihan) {
      muatDataSiswaDanPresensi();
    }
  }, [isOpen, kelasPilihan, tanggal]);

  // Ambil kelas secara otomatis dari data pengguna (peran: murid)
  const muatDaftarKelasDinamis = async () => {
    try {
      const { data, error } = await supabase
        .from('pengguna')
        .select('kelas_jabatan')
        .eq('peran', 'murid');

      if (error) throw error;

      if (data && data.length > 0) {
        // Ambil kelas unik dan hapus duplikat / null
        const kelasUnik = Array.from(new Set(
          data.map(d => d.kelas_jabatan?.trim()).filter(Boolean)
        )).sort();

        setDaftarKelas(kelasUnik);
        
        // Pilihkah kelas pertama secara otomatis jika belum ada pilihan
        if (kelasUnik.length > 0 && (!kelasPilihan || !kelasUnik.includes(kelasPilihan))) {
          setKelasPilihan(kelasUnik[0]);
        }
      } else {
        setDaftarKelas([]);
        setKelasPilihan('');
      }
    } catch (err) {
      console.error('Error fetching dynamic classes:', err);
    }
  };

  const muatDataSiswaDanPresensi = async () => {
    if (!kelasPilihan) return;
    setLoading(true);
    try {
      // 1. Ambil daftar murid di kelas tersebut secara otomatis
      const { data: siswaData, error: errSiswa } = await supabase
        .from('pengguna')
        .select('*')
        .eq('peran', 'murid')
        .eq('kelas_jabatan', kelasPilihan);

      if (errSiswa) throw errSiswa;
      const siswaList = siswaData || [];
      setDaftarSiswa(siswaList);

      // 2. Ambil data presensi hari/tanggal tersebut
      const awalHari = new Date(`${tanggal}T00:00:00`).toISOString();
      const akhirHari = new Date(`${tanggal}T23:59:59`).toISOString();

      const { data: presensiData, error: errPresensi } = await supabase
        .from('presensi')
        .select('*')
        .gte('waktu_tap', awalHari)
        .lte('waktu_tap', akhirHari);

      if (errPresensi) throw errPresensi;

      // Map presensi berdasarkan pengguna_id
      const map = {};
      (presensiData || []).forEach(item => {
        map[item.pengguna_id] = {
          id: item.id,
          status: item.status_kehadiran || (item.jenis_tap === 'masuk' ? 'hadir' : 'hadir'),
          keterangan: item.keterangan || '',
          jenis_tap: item.jenis_tap || 'masuk'
        };
      });

      setPresensiMap(map);

    } catch (err) {
      console.error('Error loading data wali kelas:', err);
    } finally {
      setLoading(false);
    }
  };

  const setStatusSiswa = (penggunaId, newStatus) => {
    setPresensiMap(prev => ({
      ...prev,
      [penggunaId]: {
        ...prev[penggunaId],
        status: newStatus
      }
    }));
  };

  const setKeteranganSiswa = (penggunaId, ket) => {
    setPresensiMap(prev => ({
      ...prev,
      [penggunaId]: {
        ...prev[penggunaId],
        keterangan: ket
      }
    }));
  };

  const simpanPresensiWaliKelas = async () => {
    setLoading(true);
    try {
      const awalHari = `${tanggal}T08:00:00.000Z`;

      for (const siswa of daftarSiswa) {
        const itemPresensi = presensiMap[siswa.id];
        
          let realSiswaId = siswa.id;
          try {
            const { data: dbUser } = await supabase.from('pengguna').select('id').eq('rfid_uid', siswa.rfid_uid).maybeSingle();
            if (dbUser && dbUser.id) {
              realSiswaId = dbUser.id;
            } else {
              const { data: newU } = await supabase.from('pengguna').insert([{
                rfid_uid: siswa.rfid_uid,
                nama_lengkap: siswa.nama_lengkap,
                peran: 'murid',
                nip_nisn: siswa.nip_nisn || '',
                kelas_jabatan: siswa.kelas_jabatan || kelasPilihan,
                no_wa_ortu: siswa.no_wa_ortu || ''
              }]).select().maybeSingle();
              if (newU && newU.id) realSiswaId = newU.id;
            }
          } catch(e) {}

          if (itemPresensi && itemPresensi.status) {
            try {
              if (itemPresensi.id) {
                await supabase
                  .from('presensi')
                  .update({
                    status_kehadiran: itemPresensi.status,
                    keterangan: itemPresensi.keterangan || ''
                  })
                  .eq('id', itemPresensi.id);
              } else {
                await supabase
                  .from('presensi')
                  .insert([{
                    pengguna_id: realSiswaId,
                    jenis_tap: 'masuk',
                    status_kehadiran: itemPresensi.status,
                    keterangan: itemPresensi.keterangan || '',
                    waktu_tap: awalHari
                  }]);
              }
            } catch(e) {}
          }


      }

      setSimpanSuccess(true);
      setTimeout(() => setSimpanSuccess(false), 3000);

      try {
        const localRaw = localStorage.getItem('presensi_riwayat_lokal');
        let currentLocal = localRaw ? JSON.parse(localRaw) : [];
        const skrg = new Date();
        
        for (const siswa of daftarSiswa) {
          const itemPresensi = presensiMap[siswa.id];
          if (itemPresensi && itemPresensi.status) {
            const newLog = {
              id: Date.now() + Math.random(),
              nama: siswa.nama_lengkap,
              peran: 'murid',
              kelas: siswa.kelas_jabatan || kelasPilihan,
              jenis: itemPresensi.jenis_tap || 'masuk',
              statusKehadiran: itemPresensi.status,
              tanggal: skrg.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
              waktu: skrg.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }),
              timestamp: skrg.getTime()
            };
            currentLocal = [newLog, ...currentLocal.slice(0, 49)];
          }
        }
        localStorage.setItem('presensi_riwayat_lokal', JSON.stringify(currentLocal));
        window.dispatchEvent(new Event('presensi_history_updated'));
      } catch (e) {}

      if (onDataUpdated) onDataUpdated();
      muatDataSiswaDanPresensi();
    } catch (err) {
      console.error('Error saving attendance by Wali Kelas:', err);
      alert('Gagal menyimpan presensi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredSiswa = daftarSiswa.filter(s => 
    s.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.nip_nisn?.includes(searchQuery)
  );

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto ${
      isDark ? 'bg-slate-950/90' : 'bg-slate-900/40'
    }`}>
      <div className={`border rounded-3xl w-full max-w-full sm:max-w-3xl max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden mx-auto my-auto transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-slate-50 border-teal-200/90 text-slate-800 shadow-2xl shadow-cyan-900/10'
      }`}>

        
        {/* Header Responsive HP Wali Kelas */}
        <div className={`p-3.5 sm:p-5 border-b flex justify-between items-center ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 text-white border-emerald-600 shadow-md'
        }`}>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center flex-shrink-0">
              <img src="/logo.png" alt="Logo Sekolah" className="w-full h-full object-contain filter drop-shadow-sm" />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-bold text-white flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span>Portal HP Wali Kelas</span>
                <span className="text-[9px] sm:text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 sm:px-2 py-0.5 rounded-full font-medium">
                  Mobile Responsive
                </span>
              </h2>
              <p className={`text-[10px] sm:text-xs ${isDark ? 'text-slate-400' : 'text-emerald-100'}`}>SDIT Qurratu A'yun Al-Islami &bull; Kab. Maros</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-1.5 sm:p-2 rounded-xl transition-colors flex-shrink-0 ${
              isDark ? 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700' : 'text-emerald-100 hover:text-white bg-emerald-800/60 hover:bg-emerald-800'
            }`}
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Filter Bar (Pilih Kelas & Tanggal) */}
        <div className={`p-4 border-b grid grid-cols-1 sm:grid-cols-2 gap-3 ${
          isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-100/90 border-slate-200/80'
        }`}>
          <div>
            <label className="text-xs text-slate-400 mb-1 block font-semibold">Pilih Kelas (Otomatis dari Data):</label>
            {daftarKelas.length === 0 ? (
              <div className="p-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-amber-400">
                Belum ada data kelas murid di sistem
              </div>
            ) : (
              <select
                value={kelasPilihan}
                onChange={(e) => setKelasPilihan(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
              >
                {daftarKelas.map(k => (
                  <option key={k} value={k}>
                    {k.toLowerCase().startsWith('kelas') ? k : `Kelas ${k}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block font-semibold">Tanggal Presensi:</label>
            <input 
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>

        {/* List Siswa & Quick Status Buttons */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          
          {simpanSuccess && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" /> Data presensi berhasil disimpan & disinkronkan ke database!
            </div>
          )}

          {daftarKelas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-xs text-slate-400 space-y-2">
              <GraduationCap className="w-12 h-12 text-slate-600 stroke-1" />
              <p className="font-bold text-slate-300">Belum ada murid / kelas yang terdaftar</p>
              <p className="text-slate-500 max-w-sm">
                Silakan daftarkan siswa beserta kelasnya terlebih dahulu di menu <strong>Kelola User / RFID</strong>. Pilihan kelas dan daftar murid akan otomatis muncul di sini.
              </p>
            </div>
          ) : (
            <>
              <div className="relative mb-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama murid..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-slate-400">Memuat daftar siswa kelas {kelasPilihan}...</div>
              ) : filteredSiswa.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">Tidak ada siswa ditemukan di kelas {kelasPilihan}.</div>
              ) : (
                filteredSiswa.map((siswa, index) => {
                  const currentStatus = presensiMap[siswa.id]?.status || 'belum';
                  const currentKet = presensiMap[siswa.id]?.keterangan || '';

                  return (
                    <div key={siswa.id} className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col gap-3">
                      
                      {/* Info Siswa */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 font-mono text-cyan-400 font-bold text-xs flex items-center justify-center border border-slate-700">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white">{siswa.nama_lengkap}</h4>
                            <p className="text-[10px] text-slate-400 font-mono">NISN: {siswa.nip_nisn || '-'}</p>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                          currentStatus === 'hadir' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          currentStatus === 'terlambat' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          currentStatus === 'sakit' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                          currentStatus === 'izin' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          currentStatus === 'alpa' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {currentStatus.toUpperCase()}
                        </span>
                      </div>

                      {/* Tombol Opsi Cepat Sekali Ketuk */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">

                        <button
                          onClick={() => setStatusSiswa(siswa.id, 'hadir')}
                          className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                            currentStatus === 'hadir' 
                              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950 ring-2 ring-emerald-400' 
                              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                          }`}
                        >
                          <UserCheck className="w-3.5 h-3.5" /> HADIR
                        </button>

                        <button
                          onClick={() => setStatusSiswa(siswa.id, 'sakit')}
                          className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                            currentStatus === 'sakit' 
                              ? 'bg-purple-600 text-white shadow-lg shadow-purple-950 ring-2 ring-purple-400' 
                              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                          }`}
                        >
                          <HeartPulse className="w-3.5 h-3.5" /> SAKIT
                        </button>

                        <button
                          onClick={() => setStatusSiswa(siswa.id, 'izin')}
                          className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                            currentStatus === 'izin' 
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-950 ring-2 ring-blue-400' 
                              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" /> IZIN
                        </button>

                        <button
                          onClick={() => setStatusSiswa(siswa.id, 'alpa')}
                          className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                            currentStatus === 'alpa' 
                              ? 'bg-rose-600 text-white shadow-lg shadow-rose-950 ring-2 ring-rose-400' 
                              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                          }`}
                        >
                          <UserX className="w-3.5 h-3.5" /> ALPA
                        </button>
                      </div>

                      {(currentStatus === 'sakit' || currentStatus === 'izin') && (
                        <input 
                          type="text" 
                          value={currentKet}
                          onChange={(e) => setKeteranganSiswa(siswa.id, e.target.value)}
                          placeholder={`Catatan ${currentStatus} (misal: Demam / Surat Dokter)...`}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      )}

                    </div>
                  );
                })
              )}
            </>
          )}

        </div>

        {/* Footer Submit Button */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex justify-between items-center">
          <p className="text-xs text-slate-400">
            Total siswa: <strong className="text-white">{daftarSiswa.length}</strong>
          </p>
          <button
            onClick={simpanPresensiWaliKelas}
            disabled={loading || daftarSiswa.length === 0}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-950"
          >
            <Save className="w-4 h-4" /> Simpan Presensi Kelas
          </button>
        </div>

      </div>
    </div>
  );
}
