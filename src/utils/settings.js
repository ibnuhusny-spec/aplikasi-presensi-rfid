/**
 * Settings Service untuk Pengaturan Jam Masuk & Jam Pulang per Kelas
 * SDIT Qurratu A'yun Al-Islami
 */

export const DEFAULT_SETTINGS = {
  jamMasuk: '07:15', // Format HH:mm (Batas Toleransi Masuk)
  jamAwalMasuk: '05:00', // Format HH:mm (Awal Jam Operasional)
  jamPulangDefault: '13:00', // Default Jam Pulang
  fonnteToken: '', // Token API WA Gateway Fonnte (Otomatis Kirim WA)
  jamPulangPerKelas: {
    'Kelas 1 & 2': '11:30',
    'Kelas 3 & 4': '12:45',
    'Kelas 5 & 6': '13:30',
    'Guru / Staf': '15:00'
  }
};

/**
 * Normalisasi format waktu ke 24 Jam (HH:mm).
 * Jika jam pulang diinput antara 01:00 - 07:59 (format 12-jam sore), otomatis dikonversi ke 13:00 - 19:59.
 */
export const normalizeTo24Hour = (timeStr, context = 'exact') => {
  if (!timeStr) return '13:00';
  if (typeof timeStr !== 'string') {
    if (timeStr instanceof Date && !isNaN(timeStr.getTime())) {
      return timeStr.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return String(timeStr);
  }

  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2})[:.](\d{2})/);
  if (!match) return timeStr;

  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const lower = trimmed.toLowerCase();

  if (lower.includes('pm') && hour < 12) {
    hour += 12;
  } else if (lower.includes('am') && hour === 12) {
    hour = 0;
  } else if (context === 'pulang' && hour >= 1 && hour <= 7 && match[1].length === 1) {
    // Hanya konversi jika diinput 1 digit tanpa leading zero (misal "3:00" -> 15:00)
    hour += 12;
  }

  const formattedHour = String(hour).padStart(2, '0');
  return `${formattedHour}:${minute}`;
};

// Ambil Pengaturan dari localStorage / Default (Aman terhadap data corrupt/undefined)
export const getSchoolSettings = () => {
  try {
    const saved = localStorage.getItem('presensi_school_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        const rawJamPulang = (parsed.jamPulangPerKelas && typeof parsed.jamPulangPerKelas === 'object')
          ? parsed.jamPulangPerKelas
          : DEFAULT_SETTINGS.jamPulangPerKelas;

        const normalizedJamPulangPerKelas = {};
        for (const [k, v] of Object.entries(rawJamPulang)) {
          normalizedJamPulangPerKelas[k] = normalizeTo24Hour(v, 'pulang');
        }

        return {
          jamMasuk: typeof parsed.jamMasuk === 'string' && parsed.jamMasuk ? parsed.jamMasuk : DEFAULT_SETTINGS.jamMasuk,
          jamAwalMasuk: typeof parsed.jamAwalMasuk === 'string' && parsed.jamAwalMasuk ? parsed.jamAwalMasuk : DEFAULT_SETTINGS.jamAwalMasuk,
          jamPulangDefault: normalizeTo24Hour(typeof parsed.jamPulangDefault === 'string' && parsed.jamPulangDefault ? parsed.jamPulangDefault : DEFAULT_SETTINGS.jamPulangDefault, 'pulang'),
          fonnteToken: typeof parsed.fonnteToken === 'string' ? parsed.fonnteToken : (localStorage.getItem('presensi_fonnte_token') || ''),
          jamPulangPerKelas: normalizedJamPulangPerKelas
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
    const normalizedJamPulangPerKelas = {};
    if (newSettings?.jamPulangPerKelas) {
      for (const [k, v] of Object.entries(newSettings.jamPulangPerKelas)) {
        normalizedJamPulangPerKelas[k] = normalizeTo24Hour(v, 'pulang');
      }
    }

    const toSave = {
      ...newSettings,
      jamPulangDefault: normalizeTo24Hour(newSettings?.jamPulangDefault || '13:00', 'pulang'),
      jamPulangPerKelas: normalizedJamPulangPerKelas
    };

    localStorage.setItem('presensi_school_settings', JSON.stringify(toSave));
    window.dispatchEvent(new Event('presensi_settings_changed'));
    return true;
  } catch (e) {
    console.error('Error saving school settings:', e);
    throw new Error('Gagal menyimpan pengaturan sekolah!');
  }
};

// Ambil Jam Pulang Spesifik untuk Suatu Kelas / Pengguna
export const getJamPulangKelas = (kelasJabatan, customSettings = null) => {
  const settings = customSettings || getSchoolSettings();
  if (!kelasJabatan) return normalizeTo24Hour(settings.jamPulangDefault, 'pulang');

  const jamMap = settings.jamPulangPerKelas || {};

  // 1. Cek match persis
  if (jamMap[kelasJabatan]) {
    return normalizeTo24Hour(jamMap[kelasJabatan], 'pulang');
  }

  const targetLower = kelasJabatan.toLowerCase();

  // 2. Cek match partial string (misal kelasJabatan "Kelas 6" dan key "Kelas 6 Putra", atau sebaliknya)
  for (const [key, val] of Object.entries(jamMap)) {
    const keyLower = key.toLowerCase();
    if (targetLower.includes(keyLower) || keyLower.includes(targetLower)) {
      return normalizeTo24Hour(val, 'pulang');
    }
  }

  // 3. Match nomor kelas (misal "Kelas 6 Putra" punya angka 6, cocok dengan key "Kelas 5 & 6" atau "Kelas 6")
  const targetNumbers = targetLower.match(/\d+/g) || [];
  if (targetNumbers.length > 0) {
    for (const [key, val] of Object.entries(jamMap)) {
      const keyNumbers = key.toLowerCase().match(/\d+/g) || [];
      const matchFound = targetNumbers.some(num => keyNumbers.includes(num));
      if (matchFound) {
        return normalizeTo24Hour(val, 'pulang');
      }
    }
  }

  return normalizeTo24Hour(settings.jamPulangDefault, 'pulang');
};

// Hapus Aturan Jam Pulang Kelas dari Pengaturan
export const removeKelasSetting = (namaKelas) => {
  const current = getSchoolSettings();
  if (current.jamPulangPerKelas && current.jamPulangPerKelas[namaKelas]) {
    delete current.jamPulangPerKelas[namaKelas];
    saveSchoolSettings(current);
  }
};

// Ubah Nama Kelas di Pengaturan Jam Pulang
export const renameKelasSetting = (oldName, newName) => {
  if (!oldName || !newName || oldName === newName) return;
  const current = getSchoolSettings();
  if (current.jamPulangPerKelas && current.jamPulangPerKelas[oldName]) {
    const timeVal = current.jamPulangPerKelas[oldName];
    delete current.jamPulangPerKelas[oldName];
    current.jamPulangPerKelas[newName] = normalizeTo24Hour(timeVal, 'pulang');
    saveSchoolSettings(current);
  }
};


