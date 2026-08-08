-- ==========================================================
-- SKRIP SQL SUPABASE UNTUK APLIKASI PRESENSI RFID (GURU & MURID)
-- Jalankan skrip ini di SQL Editor Supabase Anda
-- ==========================================================

-- 1. Buat Tabel 'pengguna'
CREATE TABLE IF NOT EXISTS public.pengguna (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rfid_uid VARCHAR(50) UNIQUE NOT NULL,
    nama_lengkap VARCHAR(255) NOT NULL,
    peran VARCHAR(20) DEFAULT 'murid' NOT NULL, -- 'murid' atau 'guru'
    nip_nisn VARCHAR(50),
    kelas_jabatan VARCHAR(100),
    foto_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tambahkan kolom peran & nip_nisn jika tabel sudah pernah dibuat sebelumnya
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pengguna' AND column_name='peran') THEN
        ALTER TABLE public.pengguna ADD COLUMN peran VARCHAR(20) DEFAULT 'murid' NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pengguna' AND column_name='nip_nisn') THEN
        ALTER TABLE public.pengguna ADD COLUMN nip_nisn VARCHAR(50);
    END IF;
END $$;

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

-- Remove policies if exist and recreate
DROP POLICY IF EXISTS "Akses baca pengguna" ON public.pengguna;
DROP POLICY IF EXISTS "Akses baca presensi" ON public.presensi;
DROP POLICY IF EXISTS "Akses simpan presensi" ON public.presensi;

CREATE POLICY "Akses baca pengguna" ON public.pengguna FOR SELECT USING (true);
CREATE POLICY "Akses baca presensi" ON public.presensi FOR SELECT USING (true);
CREATE POLICY "Akses simpan presensi" ON public.presensi FOR INSERT WITH CHECK (true);

-- 4. Masukkan Data Sampel Pengguna (Murid Per Kelas & Guru/Staf)
INSERT INTO public.pengguna (rfid_uid, nama_lengkap, peran, nip_nisn, kelas_jabatan, foto_url)
VALUES 
    -- MURID
    ('10012024', 'Ahmad Dahlan', 'murid', '20241001', 'XII IPA 1', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80'),
    ('10012025', 'Siti Nurhaliza', 'murid', '20241002', 'XI IPS 2', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80'),
    ('10012027', 'Dewi Lestari', 'murid', '20241004', 'XII IPA 1', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80'),
    ('10012028', 'Rizky Febian', 'murid', '20241005', 'X 3', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80'),
    
    -- GURU / STAF
    ('10012026', 'Budi Santoso, M.Pd.', 'guru', '198501152010011002', 'Guru Matematika', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80'),
    ('10012029', 'Dra. Endang Rahayu', 'guru', '197804122005022001', 'Guru Bahasa Indonesia', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80')
ON CONFLICT (rfid_uid) DO UPDATE SET
    nama_lengkap = EXCLUDED.nama_lengkap,
    peran = EXCLUDED.peran,
    nip_nisn = EXCLUDED.nip_nisn,
    kelas_jabatan = EXCLUDED.kelas_jabatan,
    foto_url = EXCLUDED.foto_url;
