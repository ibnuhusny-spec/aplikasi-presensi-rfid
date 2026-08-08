-- ==========================================================
-- SKRIP SQL SUPABASE UNTUK APLIKASI PRESENSI RFID
-- Jalankan skrip ini di SQL Editor Supabase Anda
-- ==========================================================

-- 1. Buat Tabel 'pengguna'
CREATE TABLE IF NOT EXISTS public.pengguna (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rfid_uid VARCHAR(50) UNIQUE NOT NULL,
    nama_lengkap VARCHAR(255) NOT NULL,
    kelas_jabatan VARCHAR(100),
    foto_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Buat Tabel 'presensi'
CREATE TABLE IF NOT EXISTS public.presensi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pengguna_id UUID REFERENCES public.pengguna(id) ON DELETE CASCADE,
    jenis_tap VARCHAR(50) NOT NULL, -- 'masuk', 'pulang', 'izin_pulang'
    waktu_tap TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Aktifkan Row Level Security (RLS) & Kebijakan Akses Publik
ALTER TABLE public.pengguna ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presensi ENABLE ROW LEVEL SECURITY;

-- Policy agar aplikasi bisa membaca data pengguna
CREATE POLICY "Akses baca pengguna" ON public.pengguna
    FOR SELECT USING (true);

-- Policy agar aplikasi bisa membaca & memasukkan presensi
CREATE POLICY "Akses baca presensi" ON public.presensi
    FOR SELECT USING (true);

CREATE POLICY "Akses simpan presensi" ON public.presensi
    FOR INSERT WITH CHECK (true);

-- 4. Masukkan Data Sampel Pengguna (Kartu RFID)
INSERT INTO public.pengguna (rfid_uid, nama_lengkap, kelas_jabatan, foto_url)
VALUES 
    ('10012024', 'Ahmad Dahlan', 'XII IPA 1', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'),
    ('10012025', 'Siti Nurhaliza', 'XI IPS 2', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'),
    ('10012026', 'Budi Santoso', 'Guru Matematika', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80')
ON CONFLICT (rfid_uid) DO NOTHING;
