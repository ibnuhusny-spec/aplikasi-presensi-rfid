import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Cek apakah kredensial Supabase sudah ada di .env
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-supabase-project.supabase.co'
);

// Management Admin Password (tersimpan di localStorage dengan fallback 'admin123')
export const getAdminPassword = () => {
  return localStorage.getItem('presensi_admin_password') || 'admin123';
};

export const setAdminPassword = (newPassword) => {
  if (!newPassword || newPassword.trim().length < 6) {
    throw new Error('Password minimal harus 6 karakter!');
  }
  localStorage.setItem('presensi_admin_password', newPassword.trim());
  return true;
};

// In-Memory & LocalStorage Persisted Mock Store untuk pengujian lokal/Vercel
export const initialMockPengguna = [
  { id: '1', rfid_uid: '10012024', nama_lengkap: 'Ahmad Dahlan', peran: 'murid', nip_nisn: '20241001', kelas_jabatan: 'XII IPA 1', no_wa_ortu: '081234567890', foto_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80' },
  { id: '2', rfid_uid: '10012025', nama_lengkap: 'Siti Nurhaliza', peran: 'murid', nip_nisn: '20241002', kelas_jabatan: 'XI IPS 2', no_wa_ortu: '081987654321', foto_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80' },
  { id: '3', rfid_uid: '10012027', nama_lengkap: 'Dewi Lestari', peran: 'murid', nip_nisn: '20241004', kelas_jabatan: 'XII IPA 1', no_wa_ortu: '085211223344', foto_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80' },
  { id: '4', rfid_uid: '10012028', nama_lengkap: 'Rizky Febian', peran: 'murid', nip_nisn: '20241005', kelas_jabatan: 'X 3', no_wa_ortu: '087855667788', foto_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80' },
  { id: '5', rfid_uid: '10012026', nama_lengkap: 'Budi Santoso, M.Pd.', peran: 'guru', nip_nisn: '198501152010011002', kelas_jabatan: 'Guru Matematika', no_wa_ortu: '081122334455', foto_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80' },
  { id: '6', rfid_uid: '10012029', nama_lengkap: 'Dra. Endang Rahayu', peran: 'guru', nip_nisn: '197804122005022001', kelas_jabatan: 'Guru Bahasa Indonesia', no_wa_ortu: '081299887766', foto_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80' },
];

const getStoredMockPengguna = () => {
  try {
    const saved = localStorage.getItem('presensi_mock_pengguna_list');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Error reading mock pengguna from storage:', e);
  }
  return initialMockPengguna;
};

const saveMockPengguna = (list) => {
  try {
    localStorage.setItem('presensi_mock_pengguna_list', JSON.stringify(list));
  } catch (e) {
    console.error('Error saving mock pengguna to storage:', e);
  }
};

const getStoredMockPresensi = () => {
  try {
    const saved = localStorage.getItem('presensi_mock_presensi_list');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Error reading mock presensi from storage:', e);
  }
  return [
    { id: 'p1', pengguna_id: '1', jenis_tap: 'masuk', status_kehadiran: 'hadir', dicatat_oleh: 'system', waktu_tap: new Date().toISOString() },
    { id: 'p2', pengguna_id: '2', jenis_tap: 'masuk', status_kehadiran: 'terlambat', dicatat_oleh: 'system', waktu_tap: new Date().toISOString() },
    { id: 'p3', pengguna_id: '3', jenis_tap: 'masuk', status_kehadiran: 'sakit', keterangan: 'Demam tinggi', dicatat_oleh: 'wali_kelas', waktu_tap: new Date().toISOString() },
  ];
};

const saveMockPresensi = (list) => {
  try {
    localStorage.setItem('presensi_mock_presensi_list', JSON.stringify(list));
  } catch (e) {
    console.error('Error saving mock presensi to storage:', e);
  }
};

class MockQueryBuilder {
  constructor(tableName) {
    this.tableName = tableName;
    this.filters = [];
    this.orderCol = null;
    this.limitVal = null;
    this.isSingle = false;
  }

  select(cols) { return this; }
  eq(field, val) { 
    this.filters.push(item => String(item[field]) === String(val) || String(item.id) === String(val)); 
    return this; 
  }
  gte(field, val) { 
    this.filters.push(item => new Date(item[field]) >= new Date(val)); 
    return this; 
  }
  lte(field, val) { 
    this.filters.push(item => new Date(item[field]) <= new Date(val)); 
    return this; 
  }
  order(col, opts) { this.orderCol = col; return this; }
  limit(num) { this.limitVal = num; return this; }
  single() { this.isSingle = true; return this; }

  async _execute() {
    try {
      if (this.tableName === 'pengguna') {
        let list = getStoredMockPengguna();
        for (const filterFn of this.filters) {
          list = list.filter(filterFn);
        }
        if (this.orderCol) {
          list = [...list].sort((a, b) => (a[this.orderCol] || '').toString().localeCompare((b[this.orderCol] || '').toString()));
        }
        if (this.limitVal) {
          list = list.slice(0, this.limitVal);
        }
        if (this.isSingle) {
          const user = list[0];
          if (!user) return { data: null, error: { message: 'Pengguna tidak ditemukan' } };
          return { data: user, error: null };
        }
        return { data: list, error: null };
      }

      if (this.tableName === 'presensi') {
        let list = getStoredMockPresensi();
        const users = getStoredMockPengguna();
        for (const filterFn of this.filters) {
          list = list.filter(filterFn);
        }
        if (this.orderCol) {
          list = [...list].sort((a, b) => new Date(b.waktu_tap) - new Date(a.waktu_tap));
        }
        if (this.limitVal) {
          list = list.slice(0, this.limitVal);
        }
        const enriched = list.map(pr => {
          const u = users.find(usr => String(usr.id) === String(pr.pengguna_id)) || {};
          return { ...pr, pengguna: u };
        });
        if (this.isSingle) {
          const item = enriched[0];
          if (!item) return { data: null, error: { message: 'Data presensi tidak ditemukan' } };
          return { data: item, error: null };
        }
        return { data: enriched, error: null };
      }

      return { data: [], error: null };
    } catch (e) {
      console.error('Mock query execution error:', e);
      return { data: [], error: null };
    }
  }

  insert(rows) {
    const rowList = Array.isArray(rows) ? rows : [rows];
    if (this.tableName === 'pengguna') {
      const list = getStoredMockPengguna();
      const inserted = rowList.map(r => ({
        id: String(Date.now() + Math.floor(Math.random() * 1000)),
        ...r
      }));
      saveMockPengguna([...inserted, ...list]);
      return Promise.resolve({ data: inserted, error: null });
    }
    if (this.tableName === 'presensi') {
      const users = getStoredMockPengguna();
      const currentPresensi = getStoredMockPresensi();
      const inserted = rowList.map(r => {
        const u = users.find(usr => String(usr.id) === String(r.pengguna_id));
        return {
          id: String(Date.now() + Math.floor(Math.random() * 1000)),
          status_kehadiran: 'hadir',
          dicatat_oleh: 'system',
          waktu_tap: new Date().toISOString(),
          ...r,
          pengguna: u
        };
      });
      const newList = [...inserted, ...currentPresensi];
      saveMockPresensi(newList);
      return Promise.resolve({ data: inserted, error: null });
    }
    return Promise.resolve({ data: rowList, error: null });
  }

  update(updates) {
    return {
      eq: (field, val) => {
        if (this.tableName === 'pengguna') {
          const list = getStoredMockPengguna();
          const newList = list.map(p => (String(p[field]) === String(val) || String(p.id) === String(val)) ? { ...p, ...updates } : p);
          saveMockPengguna(newList);
        } else if (this.tableName === 'presensi') {
          const current = getStoredMockPresensi();
          const newList = current.map(p => (String(p[field]) === String(val) || String(p.id) === String(val)) ? { ...p, ...updates } : p);
          saveMockPresensi(newList);
        }
        return Promise.resolve({ data: updates, error: null });
      }
    };
  }

  delete() {
    return {
      eq: (field, val) => {
        if (this.tableName === 'pengguna') {
          const list = getStoredMockPengguna();
          const newList = list.filter(p => String(p[field]) !== String(val) && String(p.id) !== String(val));
          saveMockPengguna(newList);
        } else if (this.tableName === 'presensi') {
          const current = getStoredMockPresensi();
          const newList = current.filter(p => String(p[field]) !== String(val) && String(p.id) !== String(val));
          saveMockPresensi(newList);
        }
        return Promise.resolve({ data: true, error: null });
      }
    };
  }


  then(onFulfilled, onRejected) {
    return this._execute().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this._execute().catch(onRejected);
  }
}

// Client Supabase Asli atau Client Tiruan (Mock Client)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      isMock: true,
      from: (tableName) => new MockQueryBuilder(tableName)
    };

