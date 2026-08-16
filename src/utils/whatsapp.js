/**
 * Helper WhatsApp Notification Service untuk Aplikasi Presensi RFID
 */

// Formatter Nomor WhatsApp (Mengubah 08... menjadi 628...)
export const formatNomorWA = (nomor) => {
  if (!nomor) return '';
  let bersih = nomor.replace(/[^0-9]/g, '');
  if (bersih.startsWith('0')) {
    bersih = '62' + bersih.slice(1);
  }
  return bersih;
};

/**
 * Buat Draf Pesan Ringkas WhatsApp Keterlambatan Siswa
 */
export const buatPesanTerlambatRingkas = ({ namaSiswa, kelas, waktuTap, menitTerlambat, tanggal }) => {
  const tglFormatted = tanggal || new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  
  return `🤖 *[PESAN OTOMATIS PRESENSI SDIT QURRATU A'YUN]*

Assalamu'alaikum Bpk/Ibu wali dari *${namaSiswa}* (${kelas || 'Siswa'}).

Informasi presensi hari ini (${tglFormatted}):
• Waktu Tap: *${waktuTap}*
• Status: *TERLAMBAT (${menitTerlambat} menit)*

Mohon bimbingan Bpk/Ibu di rumah agar ananda dapat hadir lebih awal besok. Terima kasih.`;
};

/**
 * Buat Draf Pesan Ringkas WhatsApp Izin Keluar Khusus Siswa
 */
export const buatPesanIzinKeluar = ({ namaSiswa, kelas, waktuTap, tanggal }) => {
  const tglFormatted = tanggal || new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  
  return `🤖 *[PESAN OTOMATIS PRESENSI SDIT QURRATU A'YUN]*

Assalamu'alaikum Bpk/Ibu wali dari *${namaSiswa}* (${kelas || 'Siswa'}).

Informasi izin keluar sekolah hari ini (${tglFormatted}):
• Waktu Scan: *${waktuTap} WITA*
• Status: *IZIN KELUAR KHUSUS*

Ananda telah diberikan izin keluar sekolah oleh pihak sekolah/satpam. Terima kasih.`;
};

/**
 * Kirim / Buka Notifikasi WhatsApp
 * Jika fonnteToken ada, akan mencoba kirim API otomatis.
 * Jika tidak, akan mengembalikan URL wa.me untuk pengiriman langsung.
 */
export const kirimNotifikasiWA = async ({ noHp, pesan, apiToken = '' }) => {
  const hpFormatted = formatNomorWA(noHp);
  if (!hpFormatted) {
    return { success: false, mode: 'none', message: 'Nomor WhatsApp orang tua belum diisi.' };
  }

  // Jika API Token Fonnte terisi, coba kirim via API
  if (apiToken && apiToken.trim() !== '') {
    try {
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          'Authorization': apiToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target: hpFormatted,
          message: pesan,
        })
      });
      const resData = await response.json();
      if (resData.status) {
        return { success: true, mode: 'api', message: 'Notifikasi WA terkirim otomatis via Gateway Fonnte!' };
      }
    } catch (err) {
      console.warn('Gagal kirim via WA Gateway, beralih ke WhatsApp Web Link:', err);
    }
  }

  // Fallback: URL Direct WhatsApp Web / App
  const waUrl = `https://api.whatsapp.com/send?phone=${hpFormatted}&text=${encodeURIComponent(pesan)}`;
  return { 
    success: true, 
    mode: 'link', 
    url: waUrl,
    message: 'Link WhatsApp Web siap dibuka!' 
  };
};
