import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, FileSpreadsheet, FileText, Filter, Calendar, Users, Download, PieChart, Table } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function ModalLaporan({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('rekap'); // 'rekap' (Ringkasan Bulanan) atau 'log' (Aktivitas Harian)
  const [loading, setLoading] = useState(false);
  const [dataLogs, setDataLogs] = useState([]);
  const [dataRekap, setDataRekap] = useState([]);
  const [filterPeran, setFilterPeran] = useState('semua'); // 'semua', 'guru', 'XII IPA 1', 'XI IPS 2', 'X 3'
  const [filterJenis, setFilterJenis] = useState('semua');
  const [filterTanggal, setFilterTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [bulanPilihan, setBulanPilihan] = useState(new Date().toISOString().slice(0, 7)); // '2026-08'

  const opsiKategori = [
    { label: 'Semua Kategori', val: 'semua' },
    { label: 'Guru / Staf', val: 'guru' },
    { label: 'Murid - XII IPA 1', val: 'XII IPA 1' },
    { label: 'Murid - XI IPS 2', val: 'XI IPS 2' },
    { label: 'Murid - X 3', val: 'X 3' },
  ];

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'log') {
        muatDataLogPresensi();
      } else {
        muatDataRekapBulanan();
      }
    }
  }, [isOpen, activeTab, filterTanggal, filterPeran, filterJenis, bulanPilihan]);

  // Muat Log Presensi Harian
  const muatDataLogPresensi = async () => {
    setLoading(true);
    try {
      const awalHari = new Date(`${filterTanggal}T00:00:00`).toISOString();
      const akhirHari = new Date(`${filterTanggal}T23:59:59`).toISOString();

      let query = supabase
        .from('presensi')
        .select(`
          id,
          jenis_tap,
          status_kehadiran,
          keterangan,
          waktu_tap,
          pengguna:pengguna_id (
            nama_lengkap,
            peran,
            nip_nisn,
            kelas_jabatan,
            rfid_uid
          )
        `)
        .gte('waktu_tap', awalHari)
        .lte('waktu_tap', akhirHari);

      if (filterJenis !== 'semua') {
        query = query.eq('jenis_tap', filterJenis);
      }

      const { data, error } = await query;
      if (error) throw error;

      let result = data || [];
      if (filterPeran !== 'semua') {
        result = result.filter(item => {
          if (!item.pengguna) return false;
          if (filterPeran === 'guru') return item.pengguna.peran === 'guru';
          return item.pengguna.kelas_jabatan === filterPeran;
        });
      }

      setDataLogs(result);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Muat & Kalkulasi Rekapitulasi Bulanan Per Siswa (H, T, S, I, A)
  const muatDataRekapBulanan = async () => {
    setLoading(true);
    try {
      // Ambil daftar pengguna
      let { data: penggunaData } = await supabase.from('pengguna').select('*');
      let penggunaList = penggunaData || [];

      if (filterPeran !== 'semua') {
        penggunaList = penggunaList.filter(p => {
          if (filterPeran === 'guru') return p.peran === 'guru';
          return p.kelas_jabatan === filterPeran;
        });
      }

      // Ambil seluruh presensi di bulan pilihan
      const [thn, bln] = bulanPilihan.split('-');
      const awalBulan = new Date(parseInt(thn), parseInt(bln) - 1, 1).toISOString();
      const akhirBulan = new Date(parseInt(thn), parseInt(bln), 0, 23, 59, 59).toISOString();

      const { data: presensiData } = await supabase
        .from('presensi')
        .select('*')
        .gte('waktu_tap', awalBulan)
        .lte('waktu_tap', akhirBulan);

      const logs = presensiData || [];

      // Hitung kalkulasi per pengguna
      const rekapResult = penggunaList.map(u => {
        const uLogs = logs.filter(l => l.pengguna_id === u.id);

        let countHadir = 0;
        let countTerlambat = 0;
        let countSakit = 0;
        let countIzin = 0;
        let countAlpa = 0;

        uLogs.forEach(l => {
          const st = l.status_kehadiran || (l.jenis_tap === 'masuk' ? 'hadir' : 'hadir');
          if (st === 'terlambat') countTerlambat++;
          else if (st === 'sakit') countSakit++;
          else if (st === 'izin') countIzin++;
          else if (st === 'alpa') countAlpa++;
          else countHadir++;
        });

        const totalTidakHadir = countSakit + countIzin + countAlpa;
        const totalKehadiranEfektif = countHadir + countTerlambat;
        const totalHariDicatat = uLogs.length || 1;
        const persentase = Math.round((totalKehadiranEfektif / Math.max(totalHariDicatat, 1)) * 100);

        return {
          id: u.id,
          nama: u.nama_lengkap,
          peran: u.peran || 'murid',
          nip_nisn: u.nip_nisn || '-',
          kelas: u.kelas_jabatan || '-',
          hadir: countHadir,
          terlambat: countTerlambat,
          sakit: countSakit,
          izin: countIzin,
          alpa: countAlpa,
          totalTidakHadir,
          persentase: isNaN(persentase) ? 100 : persentase
        };
      });

      setDataRekap(rekapResult);
    } catch (err) {
      console.error('Error fetching monthly summary:', err);
    } finally {
      setLoading(false);
    }
  };

  // Ekspor ke Excel (.xlsx)
  const eksporExcel = () => {
    if (activeTab === 'log') {
      if (dataLogs.length === 0) return alert('Tidak ada data presensi untuk diekspor!');

      const rows = dataLogs.map((item, index) => ({
        No: index + 1,
        Tanggal: new Date(item.waktu_tap).toLocaleDateString('id-ID'),
        Jam: new Date(item.waktu_tap).toLocaleTimeString('id-ID'),
        Nama: item.pengguna?.nama_lengkap || '-',
        Peran: (item.pengguna?.peran || 'murid').toUpperCase(),
        'NIP / NISN': item.pengguna?.nip_nisn || '-',
        'Kelas / Jabatan': item.pengguna?.kelas_jabatan || '-',
        Status: (item.status_kehadiran || item.jenis_tap).toUpperCase(),
        Keterangan: item.keterangan || '-'
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Log Presensi');
      XLSX.writeFile(workbook, `Log_Presensi_${filterTanggal}.xlsx`);

    } else {
      if (dataRekap.length === 0) return alert('Tidak ada data rekapitulasi untuk diekspor!');

      const rows = dataRekap.map((item, index) => ({
        No: index + 1,
        Nama: item.nama,
        'NIP / NISN': item.nip_nisn,
        'Kelas / Jabatan': item.kelas,
        'Hadir (H)': item.hadir,
        'Terlambat (T)': item.terlambat,
        'Sakit (S)': item.sakit,
        'Izin (I)': item.izin,
        'Alpa (A)': item.alpa,
        'Total Ketidakhadiran (S+I+A)': item.totalTidakHadir,
        'Persentase Kehadiran (%)': `${item.persentase}%`
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Bulanan');
      XLSX.writeFile(workbook, `Rekapitulasi_Kehadiran_${bulanPilihan}.xlsx`);
    }
  };

  // Ekspor ke PDF (.pdf)
  const eksporPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');

    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('SDIT QURRATU A\'YUN AL-ISLAMI', 14, 15);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);

    if (activeTab === 'log') {
      doc.text(`LAPORAN LOG PRESENSI HARIAN (${filterTanggal})`, 14, 22);
      const tableColumn = ["No", "Jam", "Nama Lengkap", "Kelas", "Jenis Tap", "Status"];
      const tableRows = dataLogs.map((item, idx) => [
        idx + 1,
        new Date(item.waktu_tap).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        item.pengguna?.nama_lengkap || '-',
        item.pengguna?.kelas_jabatan || '-',
        (item.jenis_tap || 'masuk').toUpperCase(),
        (item.status_kehadiran || 'HADIR').toUpperCase()
      ]);

      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 28,
        theme: 'grid',
        headStyles: { fillColor: [2, 132, 199] }
      });
      doc.save(`Laporan_Log_${filterTanggal}.pdf`);

    } else {
      doc.text(`REKAPITULASI KEHADIRAN BULANAN (${bulanPilihan})`, 14, 22);
      const tableColumn = ["No", "Nama Lengkap", "Kelas", "H", "T", "S", "I", "A", "Tdk Hadir", "% Hadir"];
      const tableRows = dataRekap.map((item, idx) => [
        idx + 1,
        item.nama,
        item.kelas,
        item.hadir,
        item.terlambat,
        item.sakit,
        item.izin,
        item.alpa,
        item.totalTidakHadir,
        `${item.persentase}%`
      ]);

      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 28,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }
      });
      doc.save(`Rekapitulasi_Kehadiran_${bulanPilihan}.pdf`);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header Modal & Tabs */}
        <div className="p-3.5 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/90">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center flex-shrink-0">
                <img src="/logo.png" alt="Logo Sekolah" className="w-full h-full object-contain filter drop-shadow-sm" />
              </div>
              <div>
                <h2 className="text-sm sm:text-lg font-bold text-white">Laporan & Rekapitulasi Presensi</h2>
                <p className="text-[10px] sm:text-xs text-slate-400">SDIT Qurratu A'yun Al-Islami &bull; Kab. Maros</p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="sm:hidden p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto overflow-x-auto whitespace-nowrap scrollbar-none">
              <button
                onClick={() => setActiveTab('rekap')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all flex-shrink-0 ${
                  activeTab === 'rekap' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <PieChart className="w-3.5 h-3.5" /> Rekap Bulanan Siswa
              </button>
              <button
                onClick={() => setActiveTab('log')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all flex-shrink-0 ${
                  activeTab === 'log' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" /> Log Harian Presensi
              </button>
            </div>

            <button 
              onClick={onClose}
              className="hidden sm:block p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="p-4 bg-slate-950/50 border-b border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {activeTab === 'rekap' ? (
            <div>
              <label className="text-xs text-slate-400 mb-1 flex items-center gap-1 font-medium">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Pilih Bulan Rekap:
              </label>
              <input 
                type="month" 
                value={bulanPilihan}
                onChange={(e) => setBulanPilihan(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs text-slate-400 mb-1 flex items-center gap-1 font-medium">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Filter Tanggal:
              </label>
              <input 
                type="date" 
                value={filterTanggal}
                onChange={(e) => setFilterTanggal(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 mb-1 flex items-center gap-1 font-medium">
              <Users className="w-3.5 h-3.5 text-cyan-400" /> Filter Kelas / Kategori:
            </label>
            <select
              value={filterPeran}
              onChange={(e) => setFilterPeran(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              {opsiKategori.map(o => (
                <option key={o.val} value={o.val}>{o.label}</option>
              ))}
            </select>
          </div>

          {activeTab === 'log' && (
            <div>
              <label className="text-xs text-slate-400 mb-1 flex items-center gap-1 font-medium">
                <Filter className="w-3.5 h-3.5 text-cyan-400" /> Jenis Presensi:
              </label>
              <select
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="semua">Semua (Masuk / Pulang / Izin)</option>
                <option value="masuk">Hanya Absen Masuk</option>
                <option value="pulang">Hanya Absen Pulang</option>
              </select>
            </div>
          )}

        </div>

        {/* Content Section */}
        <div className="p-5 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-xs">
              Mengkalkulasi data presensi...
            </div>
          ) : activeTab === 'rekap' ? (
            /* TAB REKAP BULANAN MATEMATIS */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-800/40">
                    <th className="p-3">No</th>
                    <th className="p-3">Nama Lengkap</th>
                    <th className="p-3">Kelas / Jabatan</th>
                    <th className="p-3 text-center text-emerald-400 font-bold">Hadir (H)</th>
                    <th className="p-3 text-center text-amber-400 font-bold">Terlambat (T)</th>
                    <th className="p-3 text-center text-purple-400 font-bold">Sakit (S)</th>
                    <th className="p-3 text-center text-blue-400 font-bold">Izin (I)</th>
                    <th className="p-3 text-center text-rose-400 font-bold">Alpa (A)</th>
                    <th className="p-3 text-center font-bold text-slate-200">Total Tdk Hadir</th>
                    <th className="p-3 text-right font-bold text-cyan-400">% Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {dataRekap.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-10 text-slate-500">
                        Tidak ada data rekapitulasi ditemukan.
                      </td>
                    </tr>
                  ) : (
                    dataRekap.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-200">{item.nama}</td>
                        <td className="p-3 text-slate-400">{item.kelas}</td>
                        <td className="p-3 text-center font-mono font-bold text-emerald-400">{item.hadir}</td>
                        <td className="p-3 text-center font-mono font-bold text-amber-400">{item.terlambat}</td>
                        <td className="p-3 text-center font-mono font-bold text-purple-400">{item.sakit}</td>
                        <td className="p-3 text-center font-mono font-bold text-blue-400">{item.izin}</td>
                        <td className="p-3 text-center font-mono font-bold text-rose-400">{item.alpa}</td>
                        <td className="p-3 text-center font-mono font-bold text-slate-300 bg-slate-950/40 rounded">
                          {item.totalTidakHadir} hari
                        </td>
                        <td className="p-3 text-right font-mono font-extrabold text-cyan-300">
                          {item.persentase}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* TAB LOG HARIAN */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-800/40">
                    <th className="p-3">No</th>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Nama Lengkap</th>
                    <th className="p-3">Kelas / Jabatan</th>
                    <th className="p-3">Jenis Tap</th>
                    <th className="p-3 text-right">Status Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {dataLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-500">
                        Tidak ada log presensi pada tanggal ini.
                      </td>
                    </tr>
                  ) : (
                    dataLogs.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-mono text-cyan-400 font-medium">
                          {new Date(item.waktu_tap).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3 font-bold text-slate-200">{item.pengguna?.nama_lengkap || '-'}</td>
                        <td className="p-3 text-slate-300">{item.pengguna?.kelas_jabatan || '-'}</td>
                        <td className="p-3 uppercase text-[10px] text-slate-400 font-mono">{item.jenis_tap}</td>
                        <td className="p-3 text-right">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                            (item.status_kehadiran || item.jenis_tap) === 'hadir' || item.jenis_tap === 'masuk' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            item.status_kehadiran === 'terlambat' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            item.status_kehadiran === 'sakit' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                            item.status_kehadiran === 'izin' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            {(item.status_kehadiran || item.jenis_tap || 'HADIR').toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Export Buttons */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-slate-400">
            {activeTab === 'rekap' ? (
              <>Rekapitulasi: <strong className="text-emerald-400">{dataRekap.length}</strong> Siswa/Guru</>
            ) : (
              <>Ditemukan: <strong className="text-cyan-400">{dataLogs.length}</strong> Catatan Log</>
            )}
          </p>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={eksporExcel}
              className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/30"
            >
              <Download className="w-4 h-4" /> Unduh Excel (.xlsx)
            </button>
            <button
              onClick={eksporPDF}
              className="flex-1 sm:flex-initial px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-900/30"
            >
              <FileText className="w-4 h-4" /> Unduh PDF (.pdf)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
