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
const initialMockPengguna = [
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

let mockPresensi = [
  { id: 'p1', pengguna_id: '1', jenis_tap: 'masuk', status_kehadiran: 'hadir', dicatat_oleh: 'system', waktu_tap: new Date().toISOString() },
  { id: 'p2', pengguna_id: '2', jenis_tap: 'masuk', status_kehadiran: 'terlambat', dicatat_oleh: 'system', waktu_tap: new Date().toISOString() },
  { id: 'p3', pengguna_id: '3', jenis_tap: 'masuk', status_kehadiran: 'sakit', keterangan: 'Demam tinggi', dicatat_oleh: 'wali_kelas', waktu_tap: new Date().toISOString() },
];

// Client Supabase Asli atau Client Tiruan (Mock Client)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      isMock: true,
      from: (tableName) => {
        if (tableName === 'pengguna') {
          return {
            select: (cols) => {
              const currentList = getStoredMockPengguna();
              const createQueryObj = (currentData = currentList) => {
                return {
                  eq: (field, val) => {
                    const filtered = currentData.filter(p => String(p[field]) === String(val) || String(p.id) === String(val));
                    return {
                      single: async () => {
                        const user = filtered[0];
                        if (!user) return { data: null, error: { message: 'Pengguna tidak ditemukan' } };
                        return { data: user, error: null };
                      },
                      then: (resolve) => resolve({ data: filtered, error: null })
                    };
                  },
                  order: (col, opts) => {
                    const sorted = [...currentData].sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''));
                    return createQueryObj(sorted);
                  },
                  then: (resolve) => {
                    const sorted = [...currentData].sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''));
                    resolve({ data: sorted, error: null });
                  }
                };
              };
              return createQueryObj();
            },
            insert: async (rows) => {
              const list = getStoredMockPengguna();
              const inserted = rows.map(r => ({
                id: String(Date.now() + Math.floor(Math.random() * 1000)),
                ...r
              }));
              const newList = [...inserted, ...list];
              saveMockPengguna(newList);
              return { data: inserted, error: null };
            },
            update: (updates) => ({
              eq: (field, val) => {
                const list = getStoredMockPengguna();
                const newList = list.map(p => (String(p[field]) === String(val) || String(p.id) === String(val)) ? { ...p, ...updates } : p);
                saveMockPengguna(newList);
                return Promise.resolve({ data: updates, error: null });
              }
            }),
            delete: () => ({
              eq: (field, val) => {
                const list = getStoredMockPengguna();
                const newList = list.filter(p => String(p[field]) !== String(val) && String(p.id) !== String(val));
                saveMockPengguna(newList);
                return Promise.resolve({ data: true, error: null });
              }
            })
          };
        }

        if (tableName === 'presensi') {
          return {
            select: (cols) => {
              const currentList = getStoredMockPengguna();
              const createQueryObj = (currentFiltered = [...mockPresensi]) => {
                return {
                  eq: (field, val) => {
                    const filtered = currentFiltered.filter(p => String(p[field]) === String(val));
                    return createQueryObj(filtered);
                  },
                  gte: (field, val) => {
                    const filtered = currentFiltered.filter(p => new Date(p[field]) >= new Date(val));
                    return createQueryObj(filtered);
                  },
                  lte: (field, val) => {
                    const filtered = currentFiltered.filter(p => new Date(p[field]) <= new Date(val));
                    return createQueryObj(filtered);
                  },
                  limit: async (l) => {
                    const sliced = currentFiltered.slice(0, l || 100);
                    const result = sliced.map(pr => {
                      const p = currentList.find(u => String(u.id) === String(pr.pengguna_id)) || {};
                      return { ...pr, pengguna: p };
                    });
                    return { data: result, error: null };
                  },
                  order: (col, opts) => {
                    const sorted = [...currentFiltered].sort((a, b) => new Date(b.waktu_tap) - new Date(a.waktu_tap));
                    return createQueryObj(sorted);
                  },
                  then: (resolve) => {
                    const result = currentFiltered.map(pr => {
                      const p = currentList.find(u => String(u.id) === String(pr.pengguna_id)) || {};
                      return { ...pr, pengguna: p };
                    });
                    resolve({ data: result, error: null });
                  }
                };
              };
              return createQueryObj();
            },
            insert: async (rows) => {
              const currentList = getStoredMockPengguna();
              const insertedRows = rows.map(row => {
                const user = currentList.find(u => String(u.id) === String(row.pengguna_id));
                const newRec = {
                  id: Math.random().toString(),
                  status_kehadiran: 'hadir',
                  dicatat_oleh: 'system',
                  waktu_tap: new Date().toISOString(),
                  ...row,
                  pengguna: user
                };
                mockPresensi.unshift(newRec);
                return newRec;
              });
              return { data: insertedRows, error: null };
            },
            update: (updates) => ({
              eq: (field, val) => {
                mockPresensi = mockPresensi.map(p => String(p[field]) === String(val) || String(p.id) === String(val) ? { ...p, ...updates } : p);
                return Promise.resolve({ data: updates, error: null });
              }
            })
          };
        }
      }
    };
