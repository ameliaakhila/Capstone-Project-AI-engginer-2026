import React, { useState } from 'react';
import Header from '../../components/Header';
import api from '../../utils/api';
import { calculateZoning, predictAI } from '../../services/zoningApi';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const THRESHOLD_METER = 500;

const Calculator = () => {
  const [form, setForm] = useState({
    nama: '',
    lat: '',
    lng: '',
  });

  const [results, setResults] = useState(null);
  const [showFormula, setShowFormula] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ── AI Recommendation state ────────────────────────────────────────────────
  const [aiRec, setAiRec] = useState(null);      // full data object from /recommendation
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleCalculate = async () => {
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);

    if (isNaN(lat) || isNaN(lng)) {
      setError('Harap masukkan nilai Latitude dan Longitude yang valid.');
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError('Koordinat di luar rentang valid. Latitude: -90 s/d 90, Longitude: -180 s/d 180.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setResults(null);
      setAiRec(null);        // clear previous AI recommendation card immediately
      setIsAiLoading(false); // reset any stuck loading spinner from a prior request

      // Jalankan kedua request secara paralel agar lebih cepat.
      // Promise.allSettled memastikan jika salah satu gagal, yang lain tetap diproses.
      const [zoningResult, aiResult] = await Promise.allSettled([
        calculateZoning({
          name: form.nama || 'Calon Minimarket',
          latitude: lat,
          longitude: lng,
          radiusMeters: THRESHOLD_METER,
        }),
        predictAI({ latitude: lat, longitude: lng }),
      ]);

      // Zoning harus berhasil — jika gagal, lempar error seperti sebelumnya
      if (zoningResult.status === 'rejected') {
        throw new Error(zoningResult.reason?.message || 'Gagal menghitung zonasi.');
      }

      const zoningData = zoningResult.value?.data ?? {};

      // Gabungkan data AI ke dalam state hasil zonasi
      const aiData = aiResult.status === 'fulfilled' ? aiResult.value : {};

      setResults({
        ...zoningData,
        prediction: aiData.prediction ?? null,
        ai_recommendation: aiData.ai_recommendation ?? null,
      });

      // Automatically fetch AI location recommendation in the background
      // (fire-and-forget — does not block the main calculation flow)
      fetchAiRecommendation();
    } catch (err) {
      setError(err.message || 'Gagal menghitung zonasi.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm({ nama: '', lat: '', lng: '' });
    setResults(null);
    setError('');
    setAiRec(null);
  };

  // ── Fetch AI location recommendation from the new backend endpoint ─────────
  const fetchAiRecommendation = async () => {
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (isNaN(lat) || isNaN(lng)) return;

    try {
      setIsAiLoading(true);
      setAiRec(null);
      const res = await api.post('/ai/recommendation', { lat, lng });
      setAiRec(res.data?.data ?? null);
    } catch (err) {
      setAiRec({
        error: err?.response?.data?.message ?? err.message ?? 'Gagal mengambil rekomendasi.',
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  // Mengakses data dari 'results' yang sekarang berasal dari API
  const nearest = results?.result?.nearestPasar;
  const isViolation = results?.result?.isViolation;
  const nearestMarkets = results?.allMarkets || [];

  // Data prediksi AI dari ML API — MUST be declared before retailCount (TDZ fix)
  const prediction = results?.prediction;

  // Jumlah retail kompetitor dalam 500m — dari generatedFeatures yang diisi oleh /ai/predict
  const retailCount =
    results?.generatedFeatures?.competitor_density ??
    prediction?.competitor_density ??
    null;

  // Ekstrak rekomendasi (cover berbagai kemungkinan format JSON dari backend)
  const aiRecommendation = results?.ai_recommendation || prediction?.ai_recommendation;

  // PERBAIKAN KRITIS: Tambahkan pengecekan untuk kata "MELANGGAR" 
  const isAiViolation =
    prediction?.is_violation === 1 ||
    prediction?.verdict === 'Violation' ||
    prediction?.prediction === 'MELANGGAR' ||
    prediction === 'MELANGGAR';
  // const prediction = results?.prediction;
  // const aiRecommendation = results?.ai_recommendation;
  // const isAiViolation = prediction?.is_violation === 1 || prediction?.verdict === 'Violation';

  return (
    <div className="bg-background text-on-surface font-body min-h-screen antialiased">
      <Header />
      <main className="ml-64 p-8 flex flex-col gap-8 relative z-10">

        {/* Page Header */}
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                <span className="material-symbols-outlined text-white text-lg">calculate</span>
              </div>
              <h1 className="font-headline text-3xl font-bold text-white tracking-tight">Distance calculator</h1>
            </div>
            <p className="text-sm text-on-surface-variant mt-1 pl-12">
              Implementasi <span className="text-purple-400 font-semibold">Haversine Formula</span> untuk cek kelayakan zonasi minimarket.
            </p>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-sm font-medium border border-outline-variant/20 transition-all"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Reset
          </button>
        </div>

        {/* Formula Accordion - Tetap Sama */}
        <div className="glass-panel rounded-xl overflow-hidden border border-purple-500/20">
          <button onClick={() => setShowFormula(!showFormula)} className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition-all">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-purple-400">functions</span>
              <span className="font-semibold text-white text-sm tracking-wide">Tentang Formula Haversine</span>
            </div>
            <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-300 ${showFormula ? 'rotate-180' : ''}`}>expand_more</span>
          </button>
          {showFormula && (
            <div className="px-6 pb-5 border-t border-purple-500/10 pt-4 text-sm text-on-surface-variant">
              <p>Formula Haversine menghitung jarak terpendek antara dua titik di permukaan Bumi.</p>
            </div>
          )}
        </div>

        {/* Input Form - Tetap Sama */}
        <div className="glass-panel rounded-xl p-6 border border-slate-700/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <input type="text" name="nama" value={form.nama} onChange={handleChange} placeholder="Nama Calon Minimarket" className="bg-slate-900/60 border border-slate-700/60 rounded-lg px-4 py-3 text-white text-sm" />
            <input type="number" name="lat" value={form.lat} onChange={handleChange} placeholder="Latitude (cth: -6.2615)" step="any" className="bg-slate-900/60 border border-slate-700/60 rounded-lg px-4 py-3 text-white text-sm" />
            <input type="number" name="lng" value={form.lng} onChange={handleChange} placeholder="Longitude (cth: 106.8120)" step="any" className="bg-slate-900/60 border border-slate-700/60 rounded-lg px-4 py-3 text-white text-sm" />
          </div>
          {error && <div className="mb-4 text-red-400 text-sm">{error}</div>}
          <button onClick={handleCalculate} disabled={loading} className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm uppercase rounded-lg">
            {loading ? 'Menghitung...' : 'Hitung Jarak & Cek Zonasi'}
          </button>
        </div>

        {/* ── Calon Minimarket AI Prediction Container ── */}
        <div
          className={`rounded-xl border transition-all duration-500 overflow-hidden ${loading
            ? 'bg-slate-800/40 border-slate-600/30'
            : prediction && isAiViolation
              ? 'bg-red-950/30 border-red-500/40 shadow-[0_0_30px_rgba(220,38,38,0.12)]'
              : prediction && !isAiViolation
                ? 'bg-green-950/30 border-green-500/40 shadow-[0_0_30px_rgba(34,197,94,0.12)]'
                : 'glass-panel border-slate-700/30'
            }`}
        >
          {/* Container Header */}
          <div
            className={`px-6 py-4 border-b flex items-center gap-3 ${loading
              ? 'border-slate-600/20'
              : prediction && isAiViolation
                ? 'border-red-500/20 bg-red-900/20'
                : prediction && !isAiViolation
                  ? 'border-green-500/20 bg-green-900/20'
                  : 'border-outline-variant/20'
              }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${loading
                ? 'bg-slate-700/50'
                : prediction && isAiViolation
                  ? 'bg-red-500/20'
                  : prediction && !isAiViolation
                    ? 'bg-green-500/20'
                    : 'bg-purple-500/20'
                }`}
            >
              <span
                className={`material-symbols-outlined text-base ${loading
                  ? 'text-slate-400 animate-spin'
                  : prediction && isAiViolation
                    ? 'text-red-400'
                    : prediction && !isAiViolation
                      ? 'text-green-400'
                      : 'text-purple-400'
                  }`}
              >
                {loading
                  ? 'progress_activity'
                  : prediction && isAiViolation
                    ? 'gpp_bad'
                    : prediction && !isAiViolation
                      ? 'verified'
                      : 'storefront'}
              </span>
            </div>
            <span className="text-sm font-semibold text-white uppercase tracking-widest">
              Calon Minimarket
            </span>
            {prediction && (
              <span
                className={`ml-auto text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border ${isAiViolation
                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : 'bg-green-500/20 text-green-400 border-green-500/30'
                  }`}
              >
                {isAiViolation ? '⚠ Melanggar' : '✓ Aman'}
              </span>
            )}
          </div>

          {/* Container Body */}
          <div className="px-6 py-5">
            {/* ─── LOADING STATE ─── */}
            {loading && (
              <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                <div className="w-10 h-10 rounded-full border-2 border-slate-600 border-t-purple-500 animate-spin" />
                <p className="text-sm text-on-surface-variant animate-pulse">
                  Menganalisis Kepatuhan Tata Ruang...
                </p>
              </div>
            )}

            {/* ─── DEFAULT / IDLE STATE ─── */}
            {!loading && !prediction && (
              <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-600">location_searching</span>
                <div>
                  <p className="text-sm font-medium text-on-surface-variant">Belum ada prediksi</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Masukkan koordinat dan klik{' '}
                    <span className="text-purple-400 font-semibold">Hitung Jarak &amp; Cek Zonasi</span>{' '}
                    untuk mendapatkan analisis.
                  </p>
                </div>
              </div>
            )}

            {/* ─── VIOLATION STATE ─── */}
            {!loading && prediction && isAiViolation && (
              <div className="flex flex-col gap-4 animate-[fadeIn_0.4s_ease]">
                {/* Verdict Badge */}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <span className="material-symbols-outlined text-3xl text-red-400">cancel</span>
                  <div>
                    <p className="text-lg font-extrabold text-red-400 uppercase tracking-wider leading-tight">
                      MELANGGAR / TIDAK AMAN
                    </p>
                    <p className="text-xs text-red-300/70 mt-0.5">Lokasi ini tidak memenuhi syarat zonasi minimarket</p>
                  </div>
                </div>

                {/* Confidence */}
                <div className="flex items-center justify-between bg-black/20 rounded-lg px-4 py-3">
                  <span className="text-xs text-on-surface-variant uppercase tracking-wider">Tingkat Kepercayaan</span>
                  <span className="text-base font-bold text-red-400">{prediction.confidence_percentage}</span>
                </div>

                {/* Mini Map */}
                {results?.input?.latitude && results?.input?.longitude && (
                  <div className="rounded-xl overflow-hidden border border-red-500/20" style={{ height: '220px' }}>
                    <MapContainer
                      key={`map-violation-${results.input.latitude}-${results.input.longitude}`}
                      center={[results.input.latitude, results.input.longitude]}
                      zoom={15}
                      style={{ height: '100%', width: '100%' }}
                      zoomControl={false}
                      scrollWheelZoom={false}
                      attributionControl={false}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {/* Radius zona 500m */}
                      <Circle
                        center={[results.input.latitude, results.input.longitude]}
                        radius={THRESHOLD_METER}
                        pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.08, weight: 1.5, dashArray: '5, 5' }}
                      />
                      {/* Marker titik calon minimarket */}
                      <CircleMarker
                        center={[results.input.latitude, results.input.longitude]}
                        radius={9}
                        pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 1, weight: 2 }}
                      >
                        <Popup>
                          <div className="text-sm">
                            <strong>{results.input?.name || 'Calon Minimarket'}</strong><br />
                            {results.input.latitude.toFixed(6)}, {results.input.longitude.toFixed(6)}<br />
                            <span style={{ color: '#EF4444', fontWeight: 'bold' }}>⚠ Melanggar Zonasi</span>
                          </div>
                        </Popup>
                      </CircleMarker>
                    </MapContainer>
                  </div>
                )}

                {/* AI Recommendation (from existing /predict endpoint) */}
                {aiRecommendation && (
                  <div className="rounded-xl bg-red-900/10 border border-red-500/15 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-sm text-red-400">smart_toy</span>
                      <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Rekomendasi</span>
                    </div>
                    <p className="text-sm text-red-200/80 leading-relaxed">{aiRecommendation}</p>
                  </div>
                )}

                {/* AI Recommendation Result Card — auto-fetched on calculate */}
                {aiRec && !aiRec.error && (
                  <div className="rounded-xl border border-violet-500/25 bg-violet-950/20 p-5 flex flex-col gap-4 animate-[fadeIn_0.4s_ease]">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-violet-400 text-lg">location_on</span>
                      <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">Rekomendasi Lokasi</span>
                    </div>

                    {/* Zone status + retail count */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-black/20 rounded-lg px-4 py-2.5">
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">Status Zona</p>
                        <p className={`text-sm font-bold ${aiRec.zoneStatus === 'Aman' ? 'text-green-400' :
                          aiRec.zoneStatus === 'Melanggar' ? 'text-red-400' : 'text-yellow-400'
                          }`}>{aiRec.zoneStatus}</p>
                      </div>
                      <div className="bg-black/20 rounded-lg px-4 py-2.5">
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">Retail dalam 500m</p>
                        <p className="text-sm font-bold text-white">{aiRec.retailCountWithin500m ?? '-'}</p>
                      </div>
                    </div>

                    {/* Alternative coordinates */}
                    {aiRec.alternative ? (
                      <div className="bg-violet-900/20 rounded-xl border border-violet-500/20 p-4 flex flex-col gap-2">
                        <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Koordinat Alternatif Terdekat</p>
                        <div className="flex items-baseline gap-2">
                          <span className="material-symbols-outlined text-violet-400 text-sm">explore</span>
                          <span className="text-sm font-mono text-white">
                            {aiRec.alternative.lat}, {aiRec.alternative.lng}
                          </span>
                        </div>
                        <p className="text-xs text-violet-200/70">
                          Bergeser <span className="font-semibold text-violet-300">{aiRec.alternative.distanceM}m</span> ke arah{' '}
                          <span className="font-semibold text-violet-300">{aiRec.alternative.direction}</span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-on-surface-variant italic">Tidak ditemukan titik alternatif dalam radius pencarian.</p>
                    )}

                    {/* AI natural-language explanation */}
                    <div className="rounded-lg bg-black/20 border border-violet-500/10 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-sm text-violet-400">smart_toy</span>
                        <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Analisis</span>
                      </div>
                      <p className="text-sm text-violet-100/80 leading-relaxed">{aiRec.explanation}</p>
                    </div>
                  </div>
                )}

                {/* Error state */}
                {aiRec?.error && (
                  <div className="rounded-xl bg-red-900/15 border border-red-500/20 p-4 text-sm text-red-300">
                    <span className="material-symbols-outlined text-sm mr-1 align-middle">error_outline</span>
                    {aiRec.error}
                  </div>
                )}
              </div>
            )}

            {/* ─── COMPLIANCE STATE ─── */}
            {!loading && prediction && !isAiViolation && (
              <div className="flex flex-col gap-4 animate-[fadeIn_0.4s_ease]">
                {/* Verdict Badge */}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <span className="material-symbols-outlined text-3xl text-green-400">check_circle</span>
                  <div>
                    <p className="text-lg font-extrabold text-green-400 uppercase tracking-wider leading-tight">
                      AMAN / PATUH ZONASI
                    </p>
                    <p className="text-xs text-green-300/70 mt-0.5">Lokasi ini memenuhi persyaratan zonasi minimarket</p>
                  </div>
                </div>

                {/* 🏪 Retail count chip — only visible in Aman state */}
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-black/20 border border-green-500/15 w-fit">
                  <span className="text-base leading-none">🏪</span>
                  <span className="text-sm text-on-surface-variant">
                    Jumlah Retail dalam radius 500m:{' '}
                    <span className="font-bold text-green-300">
                      {retailCount !== null ? `${retailCount} toko` : '— toko'}
                    </span>
                  </span>
                </div>

                {/* Confidence */}
                <div className="flex items-center justify-between bg-black/20 rounded-lg px-4 py-3">
                  <span className="text-xs text-on-surface-variant uppercase tracking-wider">Tingkat Kepercayaan</span>
                  <span className="text-base font-bold text-green-400">{prediction.confidence_percentage}</span>
                </div>

                {/* Mini Map */}
                {results?.input?.latitude && results?.input?.longitude && (
                  <div className="rounded-xl overflow-hidden border border-green-500/20" style={{ height: '220px' }}>
                    <MapContainer
                      key={`map-compliance-${results.input.latitude}-${results.input.longitude}`}
                      center={[results.input.latitude, results.input.longitude]}
                      zoom={15}
                      style={{ height: '100%', width: '100%' }}
                      zoomControl={false}
                      scrollWheelZoom={false}
                      attributionControl={false}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {/* Radius zona 500m */}
                      <Circle
                        center={[results.input.latitude, results.input.longitude]}
                        radius={THRESHOLD_METER}
                        pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 0.08, weight: 1.5, dashArray: '5, 5' }}
                      />
                      {/* Marker titik calon minimarket */}
                      <CircleMarker
                        center={[results.input.latitude, results.input.longitude]}
                        radius={9}
                        pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 1, weight: 2 }}
                      >
                        <Popup>
                          <div className="text-sm">
                            <strong>{results.input?.name || 'Calon Minimarket'}</strong><br />
                            {results.input.latitude.toFixed(6)}, {results.input.longitude.toFixed(6)}<br />
                            <span style={{ color: '#10B981', fontWeight: 'bold' }}>✓ Aman / Patuh Zonasi</span>
                          </div>
                        </Popup>
                      </CircleMarker>
                    </MapContainer>
                  </div>
                )}

                {/* AI Recommendation (from existing /predict endpoint) */}
                {aiRecommendation && (
                  <div className="rounded-xl bg-green-900/10 border border-green-500/15 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-sm text-green-400">smart_toy</span>
                      <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Rekomendasi</span>
                    </div>
                    <p className="text-sm text-green-200/80 leading-relaxed">{aiRecommendation}</p>
                  </div>
                )}

                {/* AI Recommendation Result Card + error — auto-fetched, only shown for violations */}
                {isAiViolation && (
                  <>
                    {aiRec && !aiRec.error && (
                      <div className="rounded-xl border border-violet-500/25 bg-violet-950/20 p-5 flex flex-col gap-4 animate-[fadeIn_0.4s_ease]">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-violet-400 text-lg">location_on</span>
                          <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">Rekomendasi Lokasi</span>
                        </div>

                        {/* Zone status + retail count */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-black/20 rounded-lg px-4 py-2.5">
                            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">Status Zona</p>
                            <p className={`text-sm font-bold ${aiRec.zoneStatus === 'Aman' ? 'text-green-400' :
                              aiRec.zoneStatus === 'Melanggar' ? 'text-red-400' : 'text-yellow-400'
                              }`}>{aiRec.zoneStatus}</p>
                          </div>
                          <div className="bg-black/20 rounded-lg px-4 py-2.5">
                            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">Retail dalam 500m</p>
                            <p className="text-sm font-bold text-white">{aiRec.retailCountWithin500m ?? '-'}</p>
                          </div>
                        </div>

                        {/* Alternative coordinates */}
                        {aiRec.alternative ? (
                          <div className="bg-violet-900/20 rounded-xl border border-violet-500/20 p-4 flex flex-col gap-2">
                            <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Koordinat Alternatif Terdekat</p>
                            <div className="flex items-baseline gap-2">
                              <span className="material-symbols-outlined text-violet-400 text-sm">explore</span>
                              <span className="text-sm font-mono text-white">
                                {aiRec.alternative.lat}, {aiRec.alternative.lng}
                              </span>
                            </div>
                            <p className="text-xs text-violet-200/70">
                              Bergeser <span className="font-semibold text-violet-300">{aiRec.alternative.distanceM}m</span> ke arah{' '}
                              <span className="font-semibold text-violet-300">{aiRec.alternative.direction}</span>
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-on-surface-variant italic">Tidak ditemukan titik alternatif dalam radius pencarian.</p>
                        )}

                        {/* AI natural-language explanation */}
                        <div className="rounded-lg bg-black/20 border border-violet-500/10 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-sm text-violet-400">smart_toy</span>
                            <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Analisis</span>
                          </div>
                          <p className="text-sm text-violet-100/80 leading-relaxed">{aiRec.explanation}</p>
                        </div>
                      </div>
                    )}

                    {/* Error state */}
                    {aiRec?.error && (
                      <div className="rounded-xl bg-red-900/15 border border-red-500/20 p-4 text-sm text-red-300">
                        <span className="material-symbols-outlined text-sm mr-1 align-middle">error_outline</span>
                        {aiRec.error}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Result Cards (Haversine distance summary + markets table) ── */}
        {
          results && nearest && (
            <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease]">
              <div className={`rounded-xl p-6 border ${isViolation ? 'bg-red-900/20 border-red-500/40' : 'bg-green-900/20 border-green-500/40'}`}>
                <h3 className="text-xl font-bold text-white mb-2">{results.input?.name}</h3>
                <p className="text-sm text-on-surface-variant">{results.result?.message}</p>
              </div>
              {/* Tabel Pasar Tradisional */}
              <div className="glass-panel rounded-xl p-6 border border-slate-700/30">
                <table className="w-full text-left">
                  <thead><tr className="text-xs uppercase text-on-surface-variant"><th>Pasar</th><th>Jarak</th><th>Status</th></tr></thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {nearestMarkets.map((pasar, idx) => (
                      <tr key={idx}>
                        <td className="py-3">{pasar.pasarName}</td>
                        <td className="py-3">{Number(pasar.distanceMeters).toLocaleString()} m</td>
                        <td className="py-3">{pasar.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        }
      </main >
    </div >
  );
};

export default Calculator;

