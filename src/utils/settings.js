/**
 * Settings Service untuk Pengaturan Jam Masuk & Jam Pulang per Kelas
 * SDIT Qurratu A'yun Al-Islami
 */

export const DEFAULT_SETTINGS = {
  jamMasuk: '07:15', // Format HH:mm (Batas Toleransi Masuk)
  jamAwalMasuk: '05:00', // Format HH:mm (Awal Jam Operasional)
  jamPulangDefault: '13:00', // Default Jam Pulang
  jamPulangPerKelas: {
    'Kelas 1 & 2': '11:30',
    'Kelas 3 & 4': '12:45',
    'Kelas 5 & 6': '13:30',
    'Guru / Staf': '15:00'
  }
};

// Ambil Pengaturan dari localStorage / Default (Aman terhadap data corrupt/undefined)
export const getSchoolSettings = () => {
  try {
    const saved = localStorage.getItem('presensi_school_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return {
          jamMasuk: typeof parsed.jamMasuk === 'string' && parsed.jamMasuk ? parsed.jamMasuk : DEFAULT_SETTINGS.jamMasuk,
          jamAwalMasuk: typeof parsed.jamAwalMasuk === 'string' && parsed.jamAwalMasuk ? parsed.jamAwalMasuk : DEFAULT_SETTINGS.jamAwalMasuk,
          jamPulangDefault: typeof parsed.jamPulangDefault === 'string' && parsed.jamPulangDefault ? parsed.jamPulangDefault : DEFAULT_SETTINGS.jamPulangDefault,
          jamPulangPerKelas: (parsed.jamPulangPerKelas && typeof parsed.jamPulangPerKelas === 'object')
            ? parsed.jamPulangPerKelas
            : DEFAULT_SETTINGS.jamPulangPerKelas
        };
      }
    }
  } catch (e) {
    console.error('Error reading school settings:', e);
  }
  return DEFAULT_SETTINGS;
};

// Simpan Pengaturan Baru ke localStorage & Broadcast Event Realtime
export const saveSchoolSettings = (newSettings) => {
  try {
    localStorage.setItem('presensi_school_settings', JSON.stringify(newSettings));
    window.dispatchEvent(new Event('presensi_settings_changed'));
    return true;
  } catch (e) {
    console.error('Error saving school settings:', e);
    throw new Error('Gagal menyimpan pengaturan sekolah!');
  }
};

// Ambil Jam Pulang Spesifik untuk Suatu Kelas / Pengguna
export const getJamPulangKelas = (kelasJabatan) => {
  const settings = getSchoolSettings();
  if (!kelasJabatan) return settings.jamPulangDefault;

  // Cek apakah ada match persis
  if (settings.jamPulangPerKelas[kelasJabatan]) {
    return settings.jamPulangPerKelas[kelasJabatan];
  }

  // Cek match partial (misal "Kelas 1", "Kelas 2", "XII")
  for (const [key, val] of Object.entries(settings.jamPulangPerKelas)) {
    if (kelasJabatan.toLowerCase().includes(key.toLowerCase())) {
      return val;
    }
  }

  return settings.jamPulangDefault;
};
