import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';


// 🔧 URL endpoint — sesuaikan via file .env (VITE_API_URL=http://localhost:3001)
const API_BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/api/v1`;

// ─── Data Fetching Hook ───────────────────────────────────
function useAnalyticsData(timeframe = '30d') {
  const navigate = useNavigate();
  const [data, setData] = useState({
    kpis: null,
    saturation: [],
    trends: [],
    rankingMatrix: [],
    comparison: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);

        // 🔑 Ambil JWT dari localStorage (format sesuai AuthContext proyek ini)
        const getAuthHeader = () => {
          try {
            const token = JSON.parse(localStorage.getItem('user'))?.token;
            return token ? { Authorization: `Bearer ${token}` } : {};
          } catch {
            return {};
          }
        };

        const headers = {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        };

        // 🌐 5 endpoint paralel — timeframe query param injected into every URL
        const qs = `timeframe=${timeframe}`;
        const [kpisRes, satRes, trendsRes, matrixRes, compRes] = await Promise.all([
          fetch(`${API_BASE}/analytics/kpis?${qs}`, { headers }),
          fetch(`${API_BASE}/analytics/saturation-by-district?${qs}`, { headers }),
          fetch(`${API_BASE}/analytics/violation-trends?${qs}`, { headers }),
          fetch(`${API_BASE}/analytics/ranking-matrix?${qs}`, { headers }),
          fetch(`${API_BASE}/analytics/district-comparison?${qs}`, { headers }),
        ]);

        // ⚠️ Tangani 401/403: sesi habis → bersihkan localStorage & redirect login
        const responses = [kpisRes, satRes, trendsRes, matrixRes, compRes];
        const unauthorized = responses.find(r => r.status === 401 || r.status === 403);
        if (unauthorized) {
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          navigate('/login', { replace: true });
          return;
        }

        const [kpisJson, satJson, trendsJson, matrixJson, compJson] = await Promise.all([
          kpisRes.json(), satRes.json(), trendsRes.json(), matrixRes.json(), compRes.json(),
        ]);


        // 🗂️ Data mapping — sesuaikan key di sini jika format JSON backend berubah
        const kpisData = kpisJson.data ?? null;


        setData({
          kpis: kpisData,
          saturation: satJson.data ?? [],   // array { name, saturationPercent, status }
          trends: trendsJson.data ?? [],   // array { commercial, residential }
          rankingMatrix: matrixJson.data ?? [],   // array { districtName, severity, ... }
          comparison: compJson.data ?? [],    // array { name, axes: { density, permits, ... } }
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [navigate, timeframe]); // re-fetch whenever timeframe changes

  return { data, loading, error };
}


// ─── Helpers ─────────────────────────────────────────────
const Skeleton = ({ className = '' }) => (
  <span className={`inline-block bg-white/10 animate-pulse rounded ${className}`}>&nbsp;</span>
);

function statusBadge(status) {
  const map = {
    CRITICAL: 'bg-error-container text-on-error animate-pulse',
    WARNING: 'bg-tertiary-container/30 border border-tertiary/30 text-tertiary',
    ELEVATED: 'bg-surface-container border border-outline-variant/30 text-on-surface-variant',
    STABLE: 'bg-success/10 text-success',
    SAFE: 'bg-success/10 text-success',
  };
  return map[status] ?? 'bg-surface-container text-on-surface-variant';
}

function trendColor(trend) {
  if (trend > 0) return 'text-success bg-success/10';
  if (trend < 0) return 'text-error bg-error/10';
  return 'text-on-surface-variant bg-surface-container';
}

function trendLabel(trend) {
  if (trend == null) return null;
  return trend > 0 ? `+${trend}%` : `${trend}%`;
}

// ─── Sub-components ───────────────────────────────────────

/** Bar chart: saturation by district */
function SaturationChart({ districts, loading }) {
  if (loading) {
    return (
      <div className="flex-1 flex items-end gap-3 px-2">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full bg-white/10 animate-pulse rounded-t-sm" style={{ height: `${30 + Math.random() * 60}%` }} />
          </div>
        ))}
      </div>
    );
  }

  const maxSat = Math.max(...districts.map(d => d.saturationPercent), 100);

  return (
    <>
      <div className="flex-1 flex items-end gap-2 px-2">
        <div className="flex flex-col justify-between h-full text-xs font-number text-on-surface-variant/50 pb-6 pr-3 border-r border-outline-variant/20">
          <span>100</span>
          <span>75</span>
          <span>50</span>
          <span>25</span>
          <span>0</span>
        </div>
        <div className="flex-1 flex justify-between items-end h-[85%] pb-1 gap-1">
          {districts.map(d => {
            const heightPct = (d.saturationPercent / maxSat) * 100;
            const isCritical = d.status === 'CRITICAL';
            const isWarning = d.status === 'WARNING';
            const barClass = isCritical
              ? 'bg-error/60 glow-danger'
              : isWarning
                ? 'bg-tertiary/50'
                : 'bg-primary/20 hover:bg-primary/40';

            return (
              <div
                key={d.name}
                className={`flex-1 ${barClass} rounded-t-sm relative group transition-all cursor-pointer`}
                style={{ height: `${heightPct}%` }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-container px-2 py-1 rounded text-xs font-number whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 border border-outline-variant/20">
                  {d.saturationPercent.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-between pl-12 pr-4 mt-3 text-[10px] text-on-surface-variant/70 uppercase font-medium gap-1">
        {districts.map(d => (
          <span key={d.name} className="flex-1 text-center truncate">{d.name.replace('Kebayoran', 'Kby.')}</span>
        ))}
      </div>
    </>
  );
}

/** Violation trend SVG line chart */
function TrendChart({ trends, loading }) {
  if (loading || trends.length === 0) {
    return (
      <div className="flex-1 relative border-l border-b border-outline-variant/20 ml-6 mb-4">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-on-surface-variant/40 text-sm">
            {loading ? 'Loading...' : 'No trend data'}
          </span>
        </div>
      </div>
    );
  }

  // Use up to 8 most recent weeks
  const points = trends.slice(-8);
  const maxCommercial = Math.max(...points.map(p => p.commercial), 1);
  const maxResidential = Math.max(...points.map(p => p.residential), 1);
  const max = Math.max(maxCommercial, maxResidential, 1);

  const toSVG = (val) => 100 - (val / max) * 90;
  const step = points.length > 1 ? 100 / (points.length - 1) : 100;

  const commercialPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${toSVG(p.commercial).toFixed(1)}`)
    .join(' ');

  const residentialPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${toSVG(p.residential).toFixed(1)}`)
    .join(' ');

  const fillPath = commercialPath + ` L100,100 L0,100 Z`;

  return (
    <>
      <div className="flex-1 relative border-l border-b border-outline-variant/20 ml-6 mb-4">
        <div className="absolute inset-0 flex flex-col justify-between">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border-t border-outline-variant/10 w-full" />
          ))}
        </div>
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="trendGrad" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity="1" />
              <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill="url(#trendGrad)" opacity="0.2" />
          <path d={commercialPath} fill="none" stroke="#7C3AED" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <path d={residentialPath} fill="none" stroke="#ffb784" strokeDasharray="4" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="flex justify-between pl-6 text-[10px] text-on-surface-variant/50">
        {points.map((p, i) => (
          <span key={i}>{p.label || `Wk ${i + 1}`}</span>
        ))}
      </div>
    </>
  );
}

/** Ranking matrix table */
function RankingMatrix({ rows, loading }) {
  if (loading) {
    return (
      <tbody className="divide-y divide-outline-variant/10">
        {[...Array(5)].map((_, i) => (
          <tr key={i} className="hover:bg-white/5 transition-colors">
            <td className="py-4 px-4"><Skeleton className="w-6 h-4" /></td>
            <td className="py-4 px-4"><Skeleton className="w-32 h-4" /></td>
            <td className="py-4 px-4 text-right"><Skeleton className="w-10 h-4 ml-auto" /></td>
            <td className="py-4 px-4 text-center"><Skeleton className="w-16 h-5 mx-auto" /></td>
          </tr>
        ))}
      </tbody>
    );
  }

  // Group by district and deduplicate for display — show one row per district
  const districtMap = {};
  for (const v of rows) {
    const name = v.districtName;
    if (!name) continue;
    if (!districtMap[name]) {
      districtMap[name] = { name, violations: 0, severities: [], status: v.severity };
    }
    districtMap[name].violations++;
    districtMap[name].severities.push(v.severity);
  }

  const districtRows = Object.values(districtMap)
    .map(d => {
      const hasCritical = d.severities.includes('CRITICAL');
      const hasWarning = d.severities.includes('WARNING');
      const status = hasCritical ? 'CRITICAL' : hasWarning ? 'WARNING' : 'ELEVATED';
      return { ...d, status };
    })
    .sort((a, b) => b.violations - a.violations)
    .slice(0, 10);

  return (
    <tbody className="divide-y divide-outline-variant/10">
      {districtRows.map((d, i) => (
        <tr key={d.name} className="hover:bg-white/5 transition-colors">
          <td className="py-4 px-4 font-number text-on-surface-variant">
            {String(i + 1).padStart(2, '0')}
          </td>
          <td className="py-4 px-4 font-medium text-white">{d.name}</td>
          <td className="py-4 px-4 font-number text-right">{d.violations}</td>
          <td className="py-4 px-4 text-center">
            <span className={`inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${statusBadge(d.status)}`}>
              {d.status.charAt(0) + d.status.slice(1).toLowerCase()}
            </span>
          </td>
        </tr>
      ))}
    </tbody>
  );
}

// Maps button index → display label and API query string value
const TIMEFRAME_OPTIONS = [
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 90 Days", value: "90d" }
];

const Analytics = () => {
  const [timeframeIdx, setTimeframeIdx] = useState(1); // Default: Last 30 Days
  const timeframe = TIMEFRAME_OPTIONS[timeframeIdx]?.value ?? '30d';

  const { data, loading } = useAnalyticsData(timeframe);
  const { kpis, saturation, trends, rankingMatrix, comparison } = data;

  const handleExport = () => {
    // Build a district summary from rankingMatrix rows for CSV export
    const districtMap = {};
    for (const v of rankingMatrix) {
      const name = v.districtName;
      if (!name) continue;
      if (!districtMap[name]) districtMap[name] = { name, violations: 0, status: v.severity };
      districtMap[name].violations++;
    }
    const rows = Object.values(districtMap).sort((a, b) => b.violations - a.violations);
    const header = 'Rank,District,Violation Count,Status';
    const csvRows = rows.map((d, i) => `${i + 1},${d.name},${d.violations},${d.status}`);
    const csv = [header, ...csvRows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Zonify_District_Ranking.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const kpiCards = [
    {
      key: 'totalAudits',
      label: 'Total Audits',
      icon: 'assignment',
      iconBg: 'bg-surface-container',
      iconColor: 'text-primary',
      valueColor: 'text-white',
      accentBg: 'bg-primary/5',
    },
    {
      key: 'overSaturatedZones',
      label: 'Over-Saturated Zones',
      icon: 'warning',
      iconFill: true,
      iconBg: 'bg-error-container/30 border border-error/20',
      iconColor: 'text-error',
      valueColor: 'text-white',
      accentBg: 'bg-error/10',
      glassExtra: 'glow-danger border-error-container/40',
    },
    {
      key: 'activeViolations',
      label: 'Active Violations',
      icon: 'policy',
      iconBg: 'bg-tertiary-container/30 border border-tertiary/20',
      iconColor: 'text-tertiary',
      valueColor: 'text-white',
      accentBg: 'bg-tertiary/5',
    },
    {
      key: 'avgCompliance',
      label: 'Avg Compliance',
      icon: 'check_circle',
      iconFill: true,
      iconBg: 'bg-success/10 border border-success/20',
      iconColor: 'text-success',
      valueColor: 'text-white',
      accentBg: 'bg-success/5',
      suffix: '%',
    },
  ];

  return (
    <div className="bg-background text-on-surface font-body min-h-screen antialiased overflow-x-hidden">
      <Header />
      <main className="ml-64 p-8 overflow-y-auto">

        {/* ── Page Header ── */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="font-headline text-3xl font-bold tracking-tight text-white mb-1">Analytics Intelligence</h2>
            <p className="text-sm text-on-surface-variant max-w-xl">
              Deep geospatial analysis of saturation levels and violation frequencies across monitored districts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-on-surface-variant font-medium">Timeframe:</span>
            <div className="flex items-center gap-1 glass-panel rounded-lg p-1">
              {TIMEFRAME_OPTIONS.map((opt, i) => (
                <button
                  key={opt.value}
                  onClick={() => setTimeframeIdx(i)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${i === timeframeIdx
                    ? 'bg-primary/20 text-primary glow-primary border border-primary/30'
                    : 'text-on-surface-variant hover:text-white hover:bg-white/5'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPI Summary Row ── */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          {kpiCards.map(card => {
            const kpi = kpis?.[card.key];
            const trend = kpi?.trend;
            return (
              <div key={card.key} className={`glass-panel p-6 rounded-xl relative overflow-hidden group transition-colors ${card.glassExtra ?? ''}`}>
                <div className={`absolute top-0 right-0 w-32 h-32 ${card.accentBg} rounded-full blur-2xl -mr-10 -mt-10`} />
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-2 ${card.iconBg} rounded-lg`}>
                    <span
                      className={`material-symbols-outlined ${card.iconColor} text-[20px]`}
                      style={card.iconFill ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >
                      {card.icon}
                    </span>
                  </div>
                  {trend != null && (
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${trendColor(trend)}`}>
                      {trendLabel(trend)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider mb-1">{card.label}</p>
                <p className={`font-number text-3xl font-bold ${card.valueColor}`}>
                  {loading || !kpi
                    ? <Skeleton className="w-16 h-8" />
                    : <>{kpi.value}{card.suffix && <span className="text-lg text-on-surface-variant/70">{card.suffix}</span>}</>
                  }
                </p>
              </div>
            );
          })}
        </div>

        {/* ── Charts Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 flex flex-col gap-8">

            {/* Bar Chart: Saturation by District */}
            <div className="glass-panel p-6 rounded-xl flex flex-col relative">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline text-lg font-bold">Over-Saturation Score by District</h3>
                {/* Help Icon with tooltip */}
                <div className="relative group">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant cursor-help hover:text-white transition-colors">
                    info
                  </span>
                  <div className="absolute right-0 top-6 z-20 w-64 px-3 py-2.5 rounded-lg bg-surface-container-highest border border-outline-variant/30 text-xs text-on-surface-variant shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <p className="font-semibold text-white mb-1">Saturasi per Kecamatan</p>
                    Menampilkan persentase saturasi minimarket per kecamatan berdasarkan rasio jumlah minimarket terhadap kapasitas zona. Semakin tinggi bar, semakin jenuh area tersebut.
                  </div>
                </div>
              </div>
              <div className="h-[220px] flex flex-col">
                <SaturationChart districts={saturation} loading={loading} />
              </div>
              {/* Data Interpretation */}
              <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-outline-variant/20 leading-relaxed">
                {loading
                  ? 'Memuat interpretasi data...'
                  : saturation.length === 0
                    ? 'Belum ada data saturasi untuk ditampilkan.'
                    : (() => {
                      const critical = saturation.filter(d => d.status === 'CRITICAL').length;
                      const top = [...saturation].sort((a, b) => b.saturationPercent - a.saturationPercent)[0];
                      return critical > 0
                        ? `⚠ ${critical} kecamatan dalam status CRITICAL. Kecamatan paling jenuh: ${top?.name} (${top?.saturationPercent?.toFixed(1)}%). Pertimbangkan moratorium izin minimarket baru di zona ini.`
                        : `Semua kecamatan dalam batas aman. Kecamatan dengan saturasi tertinggi: ${top?.name} (${top?.saturationPercent?.toFixed(1)}%). Pantau secara berkala.`;
                    })()
                }
              </p>
            </div>

            {/* Line Chart: Violation Trend */}
            <div className="glass-panel p-6 rounded-xl flex flex-col relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle at 70% 30%, rgba(124,58,237,0.3) 0%, transparent 60%)' }} />
              <div className="flex justify-between items-center mb-6 z-10">
                <h3 className="font-headline text-lg font-bold">Violation Trend Line</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary" /> Commercial</div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-tertiary" /> Residential</div>
                  </div>
                  {/* Help Icon with tooltip */}
                  <div className="relative group">
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant cursor-help hover:text-white transition-colors">
                      info
                    </span>
                    <div className="absolute right-0 top-6 z-20 w-64 px-3 py-2.5 rounded-lg bg-surface-container-highest border border-outline-variant/30 text-xs text-on-surface-variant shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <p className="font-semibold text-white mb-1">Tren Pelanggaran Mingguan</p>
                      Menampilkan jumlah pelanggaran zona komersial (ungu) dan residensial (oranye) per minggu. Tren naik mengindikasikan peningkatan risiko pelanggaran di periode tersebut.
                    </div>
                  </div>
                </div>
              </div>
              <div className="h-[180px] flex flex-col">
                <TrendChart trends={trends} loading={loading} />
              </div>
              {/* Data Interpretation */}
              <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-outline-variant/20 leading-relaxed">
                {loading
                  ? 'Memuat interpretasi data...'
                  : trends.length === 0
                    ? 'Belum ada data tren pelanggaran.'
                    : (() => {
                      const recent = trends.slice(-1)[0];
                      const prev = trends.slice(-2, -1)[0];
                      if (!recent) return 'Data tren tidak tersedia.';
                      const diff = prev ? recent.commercial - prev.commercial : 0;
                      return diff > 0
                        ? `📈 Pelanggaran komersial minggu ini naik ${diff} kasus dibanding minggu lalu. Waspadai lonjakan di zona padat.`
                        : diff < 0
                          ? `📉 Pelanggaran komersial turun ${Math.abs(diff)} kasus minggu ini. Tren membaik, pantau konsistensinya.`
                          : `➡ Pelanggaran komersial stabil minggu ini (${recent.commercial} kasus). Pertahankan pengawasan rutin.`;
                    })()
                }
              </p>
            </div>
          </div>

          {/* Radar: District Comparison */}
          <div className="glass-panel p-6 rounded-xl flex flex-col relative">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-headline text-lg font-bold">District Comparison</h3>
              {/* Help Icon with tooltip */}
              <div className="relative group">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant cursor-help hover:text-white transition-colors">
                  info
                </span>
                <div className="absolute right-0 top-6 z-20 w-64 px-3 py-2.5 rounded-lg bg-surface-container-highest border border-outline-variant/30 text-xs text-on-surface-variant shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <p className="font-semibold text-white mb-1">Radar Komparasi Kecamatan</p>
                  Membandingkan 5 dimensi zona antar kecamatan: Density (kepadatan), Permits (izin aktif), Compliance (kepatuhan), Violations (pelanggaran), dan Zoning Area (luas zona). Semakin luas polygon, semakin tinggi indeks gabungannya.
                </div>
              </div>
            </div>
            <div className="flex-1 flex justify-center items-center relative">
              <div className="relative w-64 h-64">
                <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100">
                  <polygon fill="none" points="50,10 90,38 75,85 25,85 10,38" stroke="#958da1" strokeWidth="0.5" />
                  <polygon fill="none" points="50,25 75,43 65,75 35,75 25,43" stroke="#958da1" strokeWidth="0.5" />
                  <polygon fill="none" points="50,40 60,50 55,65 45,65 40,50" stroke="#958da1" strokeWidth="0.5" />
                  <line stroke="#958da1" strokeWidth="0.5" x1="50" x2="50" y1="50" y2="10" />
                  <line stroke="#958da1" strokeWidth="0.5" x1="50" x2="90" y1="50" y2="38" />
                  <line stroke="#958da1" strokeWidth="0.5" x1="50" x2="75" y1="50" y2="85" />
                  <line stroke="#958da1" strokeWidth="0.5" x1="50" x2="25" y1="50" y2="85" />
                  <line stroke="#958da1" strokeWidth="0.5" x1="50" x2="10" y1="50" y2="38" />
                  {comparison[0] && (() => {
                    const a = comparison[0].axes;
                    const scale = (v) => v / 100;
                    const center = 50;
                    const axes = [
                      [center, center - 40 * scale(a.density)],                                        // top
                      [center + 40 * scale(a.permits), center - 12 * scale(a.permits)],              // top-right
                      [center + 25 * scale(a.compliance), center + 35 * scale(a.compliance)],          // bottom-right
                      [center - 25 * scale(a.violations), center + 35 * scale(a.violations)],          // bottom-left
                      [center - 40 * scale(a.zoningArea), center - 12 * scale(a.zoningArea)],          // top-left
                    ];
                    return (
                      <polygon
                        fill="rgba(124, 58, 237, 0.4)"
                        points={axes.map(p => p.join(',')).join(' ')}
                        stroke="#7C3AED"
                        strokeWidth="1.5"
                      />
                    );
                  })()}
                  {comparison[1] && (() => {
                    const a = comparison[1].axes;
                    const scale = (v) => v / 100;
                    const center = 50;
                    const axes = [
                      [center, center - 40 * scale(a.density)],
                      [center + 40 * scale(a.permits), center - 12 * scale(a.permits)],
                      [center + 25 * scale(a.compliance), center + 35 * scale(a.compliance)],
                      [center - 25 * scale(a.violations), center + 35 * scale(a.violations)],
                      [center - 40 * scale(a.zoningArea), center - 12 * scale(a.zoningArea)],
                    ];
                    return (
                      <polygon
                        fill="none"
                        points={axes.map(p => p.join(',')).join(' ')}
                        stroke="#ffb784"
                        strokeDasharray="2"
                        strokeWidth="1.5"
                      />
                    );
                  })()}
                </svg>
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-on-surface-variant uppercase font-medium">Density</span>
                <span className="absolute top-8 -right-8 text-[10px] text-on-surface-variant uppercase font-medium">Permits</span>
                <span className="absolute bottom-4 -right-6 text-[10px] text-on-surface-variant uppercase font-medium">Compliance</span>
                <span className="absolute bottom-4 -left-8 text-[10px] text-on-surface-variant uppercase font-medium">Violations</span>
                <span className="absolute top-8 -left-10 text-[10px] text-on-surface-variant uppercase font-medium">Zoning Area</span>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-outline-variant/20 flex flex-col gap-3">
              {loading
                ? <>
                  <div className="flex items-center justify-between text-sm">
                    <Skeleton className="w-20 h-4" />
                    <Skeleton className="w-12 h-4" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <Skeleton className="w-20 h-4" />
                    <Skeleton className="w-12 h-4" />
                  </div>
                </>
                : comparison.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {i === 0
                        ? <div className="w-3 h-3 rounded bg-primary" />
                        : <div className="w-3 h-3 rounded border border-tertiary bg-transparent" />
                      }
                      <span>{d.name}</span>
                    </div>
                    <span className="font-number">
                      Idx: {((d.axes.density + d.axes.permits + d.axes.compliance + d.axes.violations + d.axes.zoningArea) / 5).toFixed(1)}
                    </span>
                  </div>
                ))
              }
            </div>
            {/* Data Interpretation */}
            <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-outline-variant/20 leading-relaxed">
              {loading || comparison.length === 0
                ? 'Memuat data perbandingan kecamatan...'
                : (() => {
                  const top = comparison[0];
                  if (!top?.axes) return 'Data komparasi tidak tersedia.';
                  const idx = ((top.axes.density + top.axes.permits + top.axes.compliance + top.axes.violations + top.axes.zoningArea) / 5).toFixed(1);
                  return `Kecamatan ${top.name} memiliki indeks tertinggi (${idx}/100). Perlu perhatian khusus pada dimensi dengan nilai terendah.`;
                })()
              }
            </p>
          </div>
        </div>

        {/* ── District Ranking Matrix Table ── */}
        <div className="glass-panel p-6 rounded-xl flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline text-lg font-bold">District Ranking Matrix</h3>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary-fixed transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Export Report
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="text-on-surface-variant border-b border-outline-variant/20">
                  <th className="pb-3 px-4 font-medium">Rank</th>
                  <th className="pb-3 px-4 font-medium">District</th>
                  <th className="pb-3 px-4 font-medium text-right">Violation Count</th>
                  <th className="pb-3 px-4 font-medium text-center">Status Flag</th>
                </tr>
              </thead>
              <RankingMatrix rows={rankingMatrix} loading={loading} />
            </table>
          </div>
        </div>

      </main>
    </div>
  );
};

export default Analytics;
