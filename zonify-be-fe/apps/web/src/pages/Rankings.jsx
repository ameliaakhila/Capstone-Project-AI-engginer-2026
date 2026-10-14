import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Header from '../components/Header';

// â”€â”€â”€ Fallback Data (Hanya jika API bermasalah) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const FALLBACK_RANKINGS = [
  { position: 1, name: 'Jagakarsa', violationCount: 20, saturationPercent: 100, status: 'CRITICAL' },
  { position: 2, name: 'Cilandak', violationCount: 14, saturationPercent: 70, status: 'CRITICAL' },
  { position: 3, name: 'Pesanggrahan', violationCount: 14, saturationPercent: 70, status: 'CRITICAL' },
  { position: 4, name: 'Pancoran', violationCount: 10, saturationPercent: 50, status: 'WARNING' },
  { position: 5, name: 'Mampang Prapatan', violationCount: 9, saturationPercent: 45, status: 'WARNING' },
  { position: 6, name: 'Kebayoran Baru', violationCount: 8, saturationPercent: 40, status: 'STABLE' },
  { position: 7, name: 'Setiabudi', violationCount: 7, saturationPercent: 35, status: 'STABLE' },
  { position: 8, name: 'Pasar Minggu', violationCount: 6, saturationPercent: 30, status: 'STABLE' },
  { position: 9, name: 'Kebayoran Lama', violationCount: 6, saturationPercent: 30, status: 'STABLE' },
  { position: 10, name: 'Tebet', violationCount: 5, saturationPercent: 25, status: 'STABLE' },
];

const API_BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/api/v1`;

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function statusLabel(status) {
  const map = {
    CRITICAL: 'Critical',
    WARNING: 'Warning',
    STABLE: 'Safe',
    SAFE: 'Safe',
  };
  return map[status?.toUpperCase()] ?? status ?? '-';
}

function statusColorClass(status) {
  const s = status?.toUpperCase();
  if (s === 'CRITICAL') return 'text-error';
  if (s === 'WARNING') return 'text-tertiary';
  return 'text-green-400';
}

function rowBgClass(idx) {
  return idx === 0 ? 'bg-surface-container-highest/40' : '';
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Rankings = () => {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const getDateStamp = () => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  };

  // â”€â”€â”€ CSV Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleExportCSV = () => {
    const headers = ['POS', 'DISTRICT', 'VIOLATIONS', 'SATURATION %', 'STATUS'];
    const rows = rankings.map((r) => [
      pad(r.position),
      r.name,
      r.violationCount ?? 0,
      `${(r.saturationPercent ?? 0).toFixed(1)}%`,
      statusLabel(r.status),
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Zonify_District_Saturation_${getDateStamp()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // â”€â”€â”€ PDF Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    // Title
    doc.setFontSize(18);
    doc.setTextColor(30, 30, 60);
    doc.text('ZONIFY District Saturation Report', 40, 50);

    // Subtitle / generated date
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 140);
    doc.text(`Generated: ${new Date().toLocaleString('id-ID')}`, 40, 66);

    // Table
    autoTable(doc, {
      startY: 82,
      head: [['POS', 'DISTRICT', 'VIOLATIONS', 'SATURATION %', 'STATUS']],
      body: rankings.map((r) => [
        pad(r.position),
        r.name,
        (r.violationCount ?? 0).toLocaleString(),
        `${(r.saturationPercent ?? 0).toFixed(1)}%`,
        statusLabel(r.status),
      ]),
      headStyles: { fillColor: [34, 40, 80], textColor: 255, fontSize: 9 },
      alternateRowStyles: { fillColor: [245, 246, 252] },
      styles: { fontSize: 9, cellPadding: 6 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 40 },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'center' },
      },
    });

    doc.save(`Zonify_District_Saturation_${getDateStamp()}.pdf`);
  };

  useEffect(() => {
    let cancelled = false;

    const fetchRankings = async () => {
      try {
        setLoading(true);

        const savedUser = localStorage.getItem("user");
        const token = savedUser ? JSON.parse(savedUser)?.token : null;
        const headers = token
          ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
          : { "Content-Type": "application/json" };

        const res = await fetch(`${API_BASE}/analytics/critical-districts`, { headers });
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

        const json = await res.json();

        if (!cancelled) {
          const rawData = json?.data ?? [];

          if (rawData.length > 0) {
            const mappedData = rawData.map((d) => ({
              id: d.id,
              name: d.name,
              saturationPercent: parseFloat(d.saturationPercent ?? 0),
              status: d.status || 'STABLE',
              violationCount: d._count?.violations ?? d.violationCount ?? 0
            }));

            const sorted = mappedData
              .sort((a, b) => b.violationCount - a.violationCount)
              .map((d, i) => ({ ...d, position: i + 1 }));

            setRankings(sorted);
            setUsingFallback(false);
          } else {
            setRankings(FALLBACK_RANKINGS);
            setUsingFallback(true);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[Rankings] API fetch failed, using fallback snapshot:', err.message);
          setRankings(FALLBACK_RANKINGS);
          setUsingFallback(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRankings();
    return () => { cancelled = true; };
  }, []);

  const totalViolations = rankings.reduce((sum, r) => sum + (r.violationCount ?? 0), 0);

  return (
    <div className="bg-background text-on-surface font-body min-h-screen antialiased">
      <Header />

      <main className="ml-64 p-8 flex flex-col gap-8 items-start relative z-10">
        <section className="flex-1 flex flex-col gap-6 w-full">

          {/* Header Row */}
          <div className="flex items-end justify-between">
            {/* â”€â”€ Left: Title + Help Popover â”€â”€ */}
            <div className="relative">
              <div className="flex items-center gap-2">
                <h2 className="font-headline text-3xl font-bold text-white tracking-tight">
                  District Saturation
                </h2>
                {/* â”€â”€ Help Icon â”€â”€ */}
                <button
                  onClick={() => setShowHelpModal((prev) => !prev)}
                  title="What is this page?"
                  className="mt-0.5 text-slate-400 hover:text-white hover:bg-white/5 p-1 rounded-lg transition-colors"
                  aria-label="Toggle help information"
                >
                  <span className="material-symbols-outlined text-xl leading-none">help_outline</span>
                </button>
              </div>
              <p className="text-sm text-on-surface-variant mt-1">
                Real-time ranking based on commercial zoning violations.
                {usingFallback && (
                  <span className="ml-2 text-xs text-tertiary italic">
                    (Displaying offline snapshot â€” API unreachable)
                  </span>
                )}
              </p>

              {/* â”€â”€ Inline Help Popover â”€â”€ */}
              {showHelpModal && (
                <div className="absolute left-0 top-full mt-3 w-96 bg-[#1e293b] text-white p-5 rounded-xl shadow-xl border border-white/10 z-50 text-sm space-y-3">
                  <h3 className="font-bold text-base text-white">Tentang Halaman Rankings</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Halaman Rankings ini khusus menampilkan peringkat distrik berdasarkan seberapa
                    banyak pelanggaran zonasi ritel yang terjadi. Angka{' '}
                    <span className="text-white font-semibold">Saturation %</span> menunjukkan
                    tingkat kepadatan area tersebutâ€”semakin tinggi persentasenya, berarti wilayah
                    itu sudah semakin kritis dan melampaui batas aman. Data ini bisa kamu jadikan
                    acuan utama untuk menentukan distrik mana yang paling mendesak untuk diaudit
                    lebih lanjut.
                  </p>
                  <button
                    onClick={() => setShowHelpModal(false)}
                    className="w-full mt-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-sm font-medium border border-outline-variant/20 transition-all"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-sm font-medium border border-outline-variant/20 transition-all"
              >
                <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                PDF Report
              </button>
            </div>
          </div>

          {/* Summary Chip */}
          {!loading && (
            <div className="text-xs text-on-surface-variant">
              Showing <span className="text-white font-semibold">{rankings.length}</span> districts Â·
              Total violations: <span className="text-white font-semibold">{totalViolations}</span>
            </div>
          )}

          {/* Table Container */}
          <div className="glass-panel rounded-xl overflow-hidden w-full">
            <div className="overflow-y-auto max-h-[70vh]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-surface-container-low/80 backdrop-blur border-b border-outline-variant/20">
                    <th className="py-4 px-6 text-xs text-on-surface-variant uppercase">Pos</th>
                    <th className="py-4 px-6 text-xs text-on-surface-variant uppercase">District</th>
                    <th className="py-4 px-6 text-xs text-on-surface-variant uppercase text-right">Violations</th>
                    <th className="py-4 px-6 text-xs text-on-surface-variant uppercase text-right">Saturation %</th>
                    <th className="py-4 px-6 text-xs text-on-surface-variant uppercase text-center">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-outline-variant/10 text-sm">
                  {loading && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined animate-spin text-2xl align-middle mr-2">progress_activity</span>
                        Loading rankings from backendâ€¦
                      </td>
                    </tr>
                  )}

                  {!loading && rankings.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                        No data available from retail database.
                      </td>
                    </tr>
                  )}

                  {!loading && rankings.map((district, idx) => {
                    const colorCls = statusColorClass(district.status);
                    return (
                      <tr key={district.id ?? district.name} className={rowBgClass(idx)}>
                        <td className="py-4 px-6 text-primary font-medium">{pad(district.position)}</td>
                        <td className="py-4 px-6 text-white">{district.name}</td>
                        <td className="py-4 px-6 text-right">{(district.violationCount ?? 0).toLocaleString()}</td>
                        <td className={`py-4 px-6 text-right ${colorCls}`}>
                          {(district.saturationPercent ?? 0).toFixed(1)}%
                        </td>
                        <td className={`py-4 px-6 text-center ${colorCls}`}>
                          <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-surface-container border border-outline-variant/10`}>
                            {statusLabel(district.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </section>
      </main>
    </div>
  );
};

export default Rankings;
