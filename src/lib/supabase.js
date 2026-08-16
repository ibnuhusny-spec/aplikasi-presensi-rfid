import { createClient } from '@supabase/supabase-js';

// Pembacaan & Penyimpanan Kredensial Supabase Dinamis (dari env atau localStorage)
export const getSupabaseCredentials = () => {
  const defaultUrl = 'https://nbhuqxgqbkjyasbidcks.supabase.co';
  const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iaHVxeGdxYmtqeWFzYmlkY2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDYXMzExMzMsImV4cCI6MjA6MjEwNzEzM30.OBMn3NmOWC_V7qEGxZ4dpbAJV4vYQppN2N5J_Q5boNA';

  const url = (localStorage.getItem('presensi_supabase_url') || import.meta.env.VITE_SUPABASE_URL || defaultUrl).trim();
  const key = (localStorage.getItem('presensi_supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || defaultKey).trim();

  const isConfigured = Boolean(
    url && key && 
    url.startsWith('https://') &&
    url !== 'https://your-supabase-project.supabase.co' && 
    key !== 'your-supabase-anon-key-here'
  );
  return { url, key, isConfigured };
};



export const setSupabaseCredentials = (url, key) => {
  if (url) localStorage.setItem('presensi_supabase_url', url.trim());
  if (key) localStorage.setItem('presensi_supabase_anon_key', key.trim());
  window.location.reload();
};

let cachedClient = null;
let cachedKey = '';

export const getSupabaseClient = () => {
  const creds = getSupabaseCredentials();
  if (!creds.isConfigured) return null;
  const keyIdentifier = `${creds.url}_${creds.key}`;
  if (!cachedClient || cachedKey !== keyIdentifier) {
    cachedClient = createClient(creds.url, creds.key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    cachedKey = keyIdentifier;
  }
  return cachedClient;
};

export const simpanPresensiFlexibel = async (record) => {
  const client = getSupabaseClient();
  if (!client) return { error: { message: 'Supabase belum dikonfigurasi!' } };

  // 1. Level 1: Payload Standard (pengguna_id, jenis_tap, status_kehadiran, waktu_tap)
  const pFull = {
    pengguna_id: record.pengguna_id,
    jenis_tap: record.jenis_tap || record.jenis || 'masuk',
    status_kehadiran: record.status_kehadiran || record.statusKehadiran || 'hadir',
    waktu_tap: record.waktu_tap || new Date().toISOString()
  };

  let resFull = await client.from('presensi').insert([pFull]);
  if (!resFull.error) return resFull;

  // Jika error PostgreSQL check constraint pada 'jenis_tap' (misal DB lama hanya mengizinkan 'masuk'/'pulang')
  if (pFull.jenis_tap === 'izin_pulang') {
    const pFallback = {
      ...pFull,
      jenis_tap: 'pulang',
      status_kehadiran: 'izin'
    };
    const resFb = await client.from('presensi').insert([pFallback]);
    if (!resFb.error) return resFb;
  }

  // Jika 400 / Column not found, fallback ke Level 2 & 3
  if (resFull.error.message?.includes('column') || resFull.error.code === 'PGRST204' || resFull.error.status === 400) {
    // Level 2: (pengguna_id, jenis_tap, waktu_tap)
    const pMin = {
      pengguna_id: record.pengguna_id,
      jenis_tap: record.jenis_tap || record.jenis || 'masuk',
      waktu_tap: record.waktu_tap || new Date().toISOString()
    };
    const resMin = await client.from('presensi').insert([pMin]);
    if (!resMin.error) return resMin;

    // Level 3: (pengguna_id, jenis_tap)
    const pSuperMin = {
      pengguna_id: record.pengguna_id,
      jenis_tap: record.jenis_tap || record.jenis || 'masuk'
    };
    return await client.from('presensi').insert([pSuperMin]);
  }

  return resFull;
};

export const tesKoneksiSupabase = async () => {
  const testClient = getSupabaseClient();
  if (!testClient) {
    return { ok: false, msg: 'Kredensial Supabase URL / Anon Key belum dikonfigurasi!' };
  }
  try {
    const { data: users, error: errUsers } = await testClient.from('pengguna').select('id').limit(1);
    if (errUsers) {
      if (errUsers.code === '42P01') {
        return { ok: false, code: errUsers.code, msg: 'Tabel "pengguna" belum ada di Supabase. Jalankan skrip SQL di Supabase Editor!' };
      }
      return { ok: false, code: errUsers.code, msg: 'Gagal akses tabel pengguna: ' + errUsers.message };
    }
    const { data: pres, error: errPres } = await testClient.from('presensi').select('id').limit(1);
    if (errPres) {
      if (errPres.code === '42P01') {
        return { ok: false, code: errPres.code, msg: 'Tabel "presensi" belum ada di Supabase. Jalankan skrip SQL di Supabase Editor!' };
      }
      return { ok: false, code: errPres.code, msg: 'Gagal akses tabel presensi: ' + errPres.message };
    }
    return { ok: true, msg: 'Koneksi ke Database Supabase BERHASIL 100%!' };
  } catch (e) {
    return { ok: false, msg: 'Koneksi gagal: ' + (e?.message || e) };
  }
};

export const ujiSimpanPresensiTes = async () => {
  const testClient = getSupabaseClient();
  if (!testClient) return { ok: false, msg: 'Kredensial belum diset!' };
  try {
    let testUserId = null;
    const { data: uExist } = await testClient.from('pengguna').select('id').limit(1).maybeSingle();
    if (uExist && uExist.id) {
      testUserId = uExist.id;
    } else {
      const { data: uNew, error: errU } = await testClient.from('pengguna').insert([{
        rfid_uid: 'TEST' + Date.now(),
        nama_lengkap: 'Pengguna Uji Coba',
        peran: 'murid',
        kelas_jabatan: 'Kelas Uji'
      }]).select('id').maybeSingle();

      if (errU) {
        return { ok: false, msg: 'Gagal simpan pengguna ke Supabase (Cek RLS): ' + errU.message };
      }
      testUserId = uNew?.id;
    }

    if (!testUserId) return { ok: false, msg: 'Gagal mendapatkan ID pengguna di Supabase!' };

    const { error: errP } = await simpanPresensiFlexibel({
      pengguna_id: testUserId,
      jenis_tap: 'masuk',
      status_kehadiran: 'hadir',
      waktu_tap: new Date().toISOString()
    });

    if (errP) {
      return { ok: false, msg: 'Gagal simpan presensi ke Supabase: ' + errP.message };
    }

    return { ok: true, msg: 'BERHASIL! 1 Data Presensi Uji Coba berhasil disimpan di Supabase Cloud!' };
  } catch(e) {
    return { ok: false, msg: 'Error: ' + (e?.message || e) };
  }
};


export const isSupabaseConfigured = () => getSupabaseCredentials().isConfigured;

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


// Store pengguna (Dinamis dari Input User / LocalStorage / Supabase)
export const initialMockPengguna = [];

const getStoredMockPengguna = () => {
  try {
    const saved = localStorage.getItem('presensi_mock_pengguna_list');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Error reading mock pengguna from storage:', e);
  }
  return [];
};

const saveMockPengguna = (list) => {
  try {
    localStorage.setItem('presensi_mock_pengguna_list', JSON.stringify(list));
  } catch (e) {
    console.error('Error saving mock pengguna to storage:', e);
  }
};

export const getStoredMockPresensi = () => {
  try {
    const saved = localStorage.getItem('presensi_mock_presensi_list');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Error reading mock presensi from storage:', e);
  }
  return [];
};

export const saveMockPresensi = (list) => {
  try {
    localStorage.setItem('presensi_mock_presensi_list', JSON.stringify(list));
  } catch (e) {
    console.error('Error saving mock presensi to storage:', e);
  }
};

const DEFAULT_DELETED_SAMPLES = [
  '10012024', '10012025', '10012026', '10012027', '10012028', '10012029', '10012030',
  '0005735914', '0005707338', '0005707281', '0005737825',
  'Ahmad Dahlan', 'Siti Nurhaliza', 'Dewi Lestari', 'Rizky Febian', 'Budi Santoso, M.Pd.', 'Dra. Endang Rahayu', 'Pengguna Uji Coba',
  'Radiant Fadli', 'Muhammad Amirul Mustaqim', 'Muh. Misyari Rosyid Al Aufi', 'Muh. Imam Mulia Al Afif'
];

export const getDeletedSampleIds = () => {
  try {
    const saved = localStorage.getItem('presensi_deleted_sample_ids');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return DEFAULT_DELETED_SAMPLES;
};

export const markSampleAsDeleted = (idOrUidOrName) => {
  try {
    const current = getDeletedSampleIds();
    const items = Array.isArray(idOrUidOrName) ? idOrUidOrName : [idOrUidOrName];
    const updated = Array.from(new Set([...current, ...items.map(String)]));
    localStorage.setItem('presensi_deleted_sample_ids', JSON.stringify(updated));
    window.dispatchEvent(new Event('presensi_history_updated'));
  } catch (e) {}
};

export const unmarkSampleAsDeleted = (idOrUidOrName) => {
  try {
    const current = getDeletedSampleIds();
    const items = (Array.isArray(idOrUidOrName) ? idOrUidOrName : [idOrUidOrName]).map(String);
    const updated = current.filter(x => !items.includes(String(x)));
    localStorage.setItem('presensi_deleted_sample_ids', JSON.stringify(updated));
    window.dispatchEvent(new Event('presensi_history_updated'));
  } catch (e) {}
};

export const clearDeletedSampleIds = () => {
  try {
    localStorage.removeItem('presensi_deleted_sample_ids');
    window.dispatchEvent(new Event('presensi_history_updated'));
  } catch (e) {}
};

export const clearStoredMockPresensi = () => {
  try {
    localStorage.removeItem('presensi_mock_presensi_list');
    localStorage.removeItem('presensi_riwayat_lokal');
    localStorage.removeItem('presensi_mock_pengguna_list');
    clearDeletedSampleIds();
    window.dispatchEvent(new Event('presensi_history_updated'));
  } catch (e) {}
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
          const u = users.find(usr => String(usr.id) === String(pr.pengguna_id) || String(usr.rfid_uid) === String(pr.pengguna_id)) || pr.pengguna || {};
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

// Hapus Semua Data Presensi (Database Cloud + LocalStorage)
export const hapusSemuaPresensiDatabase = async () => {
  try {
    // 1. Bersihkan semua storage lokal seketika
    localStorage.removeItem('presensi_riwayat_lokal');
    localStorage.removeItem('presensi_riwayat');
    localStorage.removeItem('presensi_mock_presensi_list');
    localStorage.setItem('presensi_last_cleared_timestamp', Date.now().toString());
    saveMockPresensi([]);

    // 2. Jika Supabase Cloud terhubung, hapus dari database cloud dengan filter PostgREST valid
    if (isSupabaseConfigured() && supabase && !supabase.isMock) {
      const { error: err1 } = await supabase
        .from('presensi')
        .delete()
        .gte('waktu_tap', '1970-01-01T00:00:00.000Z');

      if (err1) {
        await supabase.from('presensi').delete().neq('jenis_tap', 'xyz_dummy_filter_999');
      }
    }

    window.dispatchEvent(new Event('presensi_history_updated'));
    return { ok: true, msg: 'BERHASIL! Semua riwayat presensi berhasil dihapus bersih.' };
  } catch (e) {
    console.error('Error reset database presensi:', e);
    return { ok: false, msg: 'Gagal menghapus presensi di Cloud Supabase: ' + (e.message || e) };
  }
};

// Hapus Semua Data Pengguna & Presensi (Reset Total Database Cloud + LocalStorage)
export const hapusSemuaPenggunaDatabase = async () => {
  try {
    // 1. Bersihkan semua storage lokal seketika
    localStorage.removeItem('presensi_riwayat_lokal');
    localStorage.removeItem('presensi_riwayat');
    localStorage.removeItem('presensi_daftar_pengguna');
    localStorage.removeItem('presensi_mock_pengguna_list');
    localStorage.setItem('presensi_deleted_sample_ids', JSON.stringify(DEFAULT_DELETED_SAMPLES));
    localStorage.setItem('presensi_last_cleared_timestamp', Date.now().toString());
    saveMockPresensi([]);
    saveMockPengguna([]);

    // 2. Jika Supabase Cloud terhubung, hapus dari database cloud
    if (isSupabaseConfigured() && supabase && !supabase.isMock) {
      await supabase.from('presensi').delete().gte('waktu_tap', '1970-01-01T00:00:00.000Z');
      const { error: errU } = await supabase.from('pengguna').delete().neq('nama_lengkap', 'xyz_dummy_filter_999');
      if (errU) {
        await supabase.from('pengguna').delete().gte('created_at', '1970-01-01T00:00:00.000Z');
      }
    }

    window.dispatchEvent(new Event('presensi_history_updated'));
    window.dispatchEvent(new Event('presensi_pengguna_updated'));
    return { ok: true, msg: 'BERHASIL! Seluruh data murid, guru, dan presensi berhasil dihapus bersih.' };
  } catch (e) {
    console.error('Error reset total pengguna database:', e);
    return { ok: false, msg: 'Gagal menghapus pengguna di Cloud Supabase: ' + (e.message || e) };
  }
};

// Client Supabase Asli Dinamis (Proxy) atau Client Tiruan (Mock Client)
export const supabase = new Proxy({}, {
  get: (target, prop) => {
    const client = getSupabaseClient();
    if (client && prop in client) {
      const val = client[prop];
      return typeof val === 'function' ? val.bind(client) : val;
    }
    const mock = new MockQueryBuilder('');
    return prop in mock ? (typeof mock[prop] === 'function' ? mock[prop].bind(mock) : mock[prop]) : mock;
  }
});



