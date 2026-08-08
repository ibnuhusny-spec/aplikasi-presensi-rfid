import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, FileSpreadsheet, FileText, Filter, Calendar, Users, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function ModalLaporan({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [dataLogs, setDataLogs] = useState([]);
  const [filterPeran, setFilterPeran] = useState('semua'); // 'semua', 'guru', 'XII IPA 1', 'XI IPS 2', 'X 3'
  const [filterJenis, setFilterJenis] = useState('semua'); // 'semua', 'masuk', 'pulang', 'izin_pulang'
  const [filterTanggal, setFilterTanggal] = useState(new Date().toISOString().split('T')[0]);

  // Daftar opsi kelas/peran
  const opsiKategori = [
    { label: 'Semua Kategori', val: 'semua' },
    { label: 'Guru / Staf', val: 'guru' },
    { label: 'Murid - XII IPA 1', val: 'XII IPA 1' },
    { label: 'Murid - XI IPS 2', val: 'XI IPS 2' },
    { label: 'Murid - X 3', val: 'X 3' },
  ];

  useEffect(() => {
    if (isOpen) {
      muatDataPresensi();
    }
  }, [isOpen, filterTanggal, filterPeran, filterJenis]);

  const muatDataPresensi = async () => {
    setLoading(true);
    try {
      // Format tanggal awal dan akhir hari
      const awalHari = new Date(`${filterTanggal}T00:00:00`).toISOString();
      const akhirHari = new Date(`${filterTanggal}T23:59:59`).toISOString();

      let query = supabase
        .from('presensi')
        .select(`
          id,
          jenis_tap,
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

      // Filter di client side untuk peran/kelas jika query join kompleks
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

  // Ekspor ke Excel (.xlsx)
  const eksporExcel = () => {
    if (dataLogs.length === 0) {
      alert('Tidak ada data presensi untuk diekspor!');
      return;
    }

    const rows = dataLogs.map((item, index) => ({
      No: index + 1,
      Tanggal: new Date(item.waktu_tap).toLocaleDateString('id-ID'),
      Jam: new Date(item.waktu_tap).toLocaleTimeString('id-ID'),
      Nama: item.pengguna?.nama_lengkap || '-',
      Peran: (item.pengguna?.peran || 'murid').toUpperCase(),
      'NIP / NISN': item.pengguna?.nip_nisn || '-',
      'Kelas / Jabatan': item.pengguna?.kelas_jabatan || '-',
      'Jenis Presensi': item.jenis_tap === 'masuk' ? 'MASUK' : item.jenis_tap === 'pulang' ? 'PULANG' : 'IZIN KELUAR',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Presensi');

    // Auto fit column width
    worksheet['!cols'] = [
      { wch: 5 },  // No
      { wch: 14 }, // Tanggal
      { wch: 10 }, // Jam
      { wch: 25 }, // Nama
      { wch: 10 }, // Peran
      { wch: 18 }, // NIP/NISN
      { wch: 20 }, // Kelas/Jabatan
      { wch: 15 }, // Jenis
    ];

    const namaFile = `Laporan_Presensi_${filterPeran.replace(/\s+/g, '_')}_${filterTanggal}.xlsx`;
    XLSX.writeFile(workbook, namaFile);
  };

  // Ekspor ke PDF (.pdf)
  const eksporPDF = () => {
    if (dataLogs.length === 0) {
      alert('Tidak ada data presensi untuk diekspor!');
      return;
    }

    const doc = new jsPDF('p', 'mm', 'a4');

    // Header PDF
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('LAPORAN PRESENSI RFID DIGITAL', 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Kategori: ${filterPeran.toUpperCase()} | Tanggal: ${filterTanggal}`, 14, 25);
    doc.text(`Total Catatan: ${dataLogs.length} Data`, 14, 30);

    const tableColumn = ["No", "Jam", "Nama Lengkap", "Peran", "NISN / NIP", "Kelas / Jabatan", "Status"];
    const tableRows = [];

    dataLogs.forEach((item, index) => {
      const rowData = [
        index + 1,
        new Date(item.waktu_tap).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        item.pengguna?.nama_lengkap || '-',
        (item.pengguna?.peran || 'murid').toUpperCase(),
        item.pengguna?.nip_nisn || '-',
        item.pengguna?.kelas_jabatan || '-',
        item.jenis_tap === 'masuk' ? 'HADIR' : item.jenis_tap === 'pulang' ? 'PULANG' : 'IZIN'
      ];
      tableRows.push(rowData);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [241, 245, 249] }
    });

    const namaFile = `Laporan_Presensi_${filterPeran.replace(/\s+/g, '_')}_${filterTanggal}.pdf`;
    doc.save(namaFile);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header Modal */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Laporan & Rekap Presensi</h2>
              <p className="text-xs text-slate-400">Filter data presensi per kelas/guru dan unduh laporan Excel/PDF</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls */}
        <div className="p-5 bg-slate-950/50 border-b border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Tanggal */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1 font-medium">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Filter Tanggal:
            </label>
            <input 
              type="date" 
              value={filterTanggal}
              onChange={(e) => setFilterTanggal(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Kategori Peran / Kelas */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1 font-medium">
              <Users className="w-3.5 h-3.5 text-cyan-400" /> Kategori / Kelas:
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

          {/* Jenis Presensi */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1 font-medium">
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
              <option value="izin_pulang">Hanya Izin Keluar</option>
            </select>
          </div>

        </div>

        {/* Content Table / Results */}
        <div className="p-5 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-xs">
              Memuat data presensi...
            </div>
          ) : dataLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-xs text-center">
              <FileSpreadsheet className="w-10 h-10 mb-2 stroke-1" />
              <p>Tidak ada data presensi yang ditemukan untuk filter ini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-800/40">
                    <th className="p-3">No</th>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Nama Lengkap</th>
                    <th className="p-3">Peran</th>
                    <th className="p-3">NIP / NISN</th>
                    <th className="p-3">Kelas / Jabatan</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {dataLogs.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono text-cyan-400 font-medium">
                        {new Date(item.waktu_tap).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3 font-bold text-slate-200">{item.pengguna?.nama_lengkap || '-'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.pengguna?.peran === 'guru' 
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        }`}>
                          {(item.pengguna?.peran || 'murid').toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-400">{item.pengguna?.nip_nisn || '-'}</td>
                      <td className="p-3 text-slate-300">{item.pengguna?.kelas_jabatan || '-'}</td>
                      <td className="p-3 text-right">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                          item.jenis_tap === 'masuk' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          item.jenis_tap === 'pulang' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {item.jenis_tap === 'masuk' ? 'HADIR' : item.jenis_tap === 'pulang' ? 'PULANG' : 'IZIN'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Export Buttons */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-slate-400">
            Ditemukan <strong className="text-cyan-400">{dataLogs.length}</strong> catatan presensi
          </p>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={eksporExcel}
              disabled={dataLogs.length === 0}
              className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/30"
            >
              <Download className="w-4 h-4" /> Unduh Excel (.xlsx)
            </button>
            <button
              onClick={eksporPDF}
              disabled={dataLogs.length === 0}
              className="flex-1 sm:flex-initial px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-900/30"
            >
              <FileText className="w-4 h-4" /> Unduh PDF (.pdf)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
