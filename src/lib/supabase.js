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
const mockPengguna = [
  { id: '1', rfid_uid: '10012024', nama_lengkap: 'Ahmad Dahlan', kelas_jabatan: 'XII IPA 1', foto_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
  { id: '2', rfid_uid: '10012025', nama_lengkap: 'Siti Nurhaliza', kelas_jabatan: 'XI IPS 2', foto_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80' },
  { id: '3', rfid_uid: '10012026', nama_lengkap: 'Budi Santoso', kelas_jabatan: 'Guru Matematika', foto_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
];

const mockPresensi = [];

// Client Supabase Asli atau Client Tiruan (Mock Client)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      isMock: true,
      from: (tableName) => {
        if (tableName === 'pengguna') {
          return {
            select: () => ({
              eq: (field, val) => ({
                single: async () => {
                  const user = mockPengguna.find(p => p[field] === val);
                  if (!user) return { data: null, error: { message: 'Pengguna tidak ditemukan' } };
                  return { data: user, error: null };
                }
              })
            })
          };
        }

        if (tableName === 'presensi') {
          return {
            select: () => ({
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
              })
            }),
            insert: async (rows) => {
              rows.forEach(row => {
                mockPresensi.unshift({
                  id: Math.random().toString(),
                  ...row,
                  waktu_tap: new Date().toISOString()
                });
              });
              return { data: rows, error: null };
            }
          };
        }
      }
    };
