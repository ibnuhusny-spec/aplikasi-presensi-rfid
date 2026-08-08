import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Cek apakah kredensial Supabase sudah ada di .env
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-supabase-project.supabase.co'
);

// In-Memory Mock Store untuk pengujian lokal jika Supabase belum di-connect
let mockPengguna = [
  { id: '1', rfid_uid: '10012024', nama_lengkap: 'Ahmad Dahlan', peran: 'murid', nip_nisn: '20241001', kelas_jabatan: 'XII IPA 1', foto_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80' },
  { id: '2', rfid_uid: '10012025', nama_lengkap: 'Siti Nurhaliza', peran: 'murid', nip_nisn: '20241002', kelas_jabatan: 'XI IPS 2', foto_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80' },
  { id: '3', rfid_uid: '10012027', nama_lengkap: 'Dewi Lestari', peran: 'murid', nip_nisn: '20241004', kelas_jabatan: 'XII IPA 1', foto_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80' },
  { id: '4', rfid_uid: '10012028', nama_lengkap: 'Rizky Febian', peran: 'murid', nip_nisn: '20241005', kelas_jabatan: 'X 3', foto_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80' },
  { id: '5', rfid_uid: '10012026', nama_lengkap: 'Budi Santoso, M.Pd.', peran: 'guru', nip_nisn: '198501152010011002', kelas_jabatan: 'Guru Matematika', foto_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80' },
  { id: '6', rfid_uid: '10012029', nama_lengkap: 'Dra. Endang Rahayu', peran: 'guru', nip_nisn: '197804122005022001', kelas_jabatan: 'Guru Bahasa Indonesia', foto_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80' },
];

let mockPresensi = [];

// Client Supabase Asli atau Client Tiruan (Mock Client)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      isMock: true,
      from: (tableName) => {
        if (tableName === 'pengguna') {
          return {
            select: (cols) => ({
              order: (col, opts) => async () => {
                const sorted = [...mockPengguna].sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''));
                return { data: sorted, error: null };
              },
              eq: (field, val) => ({
                single: async () => {
                  const user = mockPengguna.find(p => p[field] === val);
                  if (!user) return { data: null, error: { message: 'Pengguna tidak ditemukan' } };
                  return { data: user, error: null };
                }
              })
            }),
            insert: async (rows) => {
              const inserted = rows.map(r => ({
                id: Math.random().toString(),
                ...r
              }));
              mockPengguna = [...inserted, ...mockPengguna];
              return { data: inserted, error: null };
            },
            update: (updates) => ({
              eq: (field, val) => async () => {
                mockPengguna = mockPengguna.map(p => p[field] === val ? { ...p, ...updates } : p);
                return { data: updates, error: null };
              }
            }),
            delete: () => ({
              eq: (field, val) => async () => {
                mockPengguna = mockPengguna.filter(p => p[field] !== val);
                return { data: true, error: null };
              }
            })
          };
        }

        if (tableName === 'presensi') {
          return {
            select: (cols) => ({
              eq: (field1, val1) => ({
                eq: (field2, val2) => ({
                  gte: (field3, val3) => ({
                    limit: async () => {
                      const records = mockPresensi.filter(p => 
                        p[field1] === val1 && 
                        p[field2] === val2 && 
                        p[field3] >= val3
                      );
                      return { data: records, error: null };
                    }
                  })
                })
              }),
              order: (orderCol, opts) => ({
                limit: async (l) => {
                  const sorted = [...mockPresensi].sort((a, b) => new Date(b.waktu_tap) - new Date(a.waktu_tap)).slice(0, l);
                  const result = sorted.map(pr => {
                    const p = mockPengguna.find(u => u.id === pr.pengguna_id) || {};
                    return {
                      ...pr,
                      pengguna: p
                    };
                  });
                  return { data: result, error: null };
                }
              })
            }),
            insert: async (rows) => {
              rows.forEach(row => {
                const user = mockPengguna.find(u => u.id === row.pengguna_id);
                mockPresensi.unshift({
                  id: Math.random().toString(),
                  ...row,
                  waktu_tap: new Date().toISOString(),
                  pengguna: user
                });
              });
              return { data: rows, error: null };
            }
          };
        }
      }
    };
