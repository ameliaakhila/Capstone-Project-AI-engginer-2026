import React, { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

// ─── Konstanta ────────────────────────────────────────────────────────────────
const INITIAL_FORM = {
  nama: '',
  lat: '',
  lng: '',
  type: 'MINIMARKET',
  kecamatan: '',
  districtId: '',   // diisi otomatis dari dropdown — tidak perlu diketik user
};

/**
 * Sidebar — navigasi utama + tombol New Audit.
 *
 * Setelah POST /api/v1/audits berhasil, Sidebar mendispatch custom event
 * 'zonify:audit-saved' sehingga Dashboard dapat trigger refresh KPI
 * tanpa perlu prop drilling melalui Layout.
 */
const Sidebar = () => {
  const { user } = useAuth();
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Districts untuk dropdown
  const [districts, setDistricts] = useState([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const fetchedRef = useRef(false);   // fetch sekali saja sepanjang sesi

  const baseLinkClass = "flex items-center gap-3 px-6 py-4 transition-all duration-300 scale-95 duration-150 ease-in-out ";
  const inactiveLinkClass = baseLinkClass + "text-slate-400 hover:bg-white/5 hover:text-white";
  const activeLinkClass = baseLinkClass + "text-[#7C3AED] bg-gradient-to-r from-[#7C3AED]/10 to-transparent border-r-4 border-[#7C3AED]";

  // ── Fetch daftar districts saat modal pertama kali dibuka ─────────────────
  useEffect(() => {
    if (!showAuditModal || fetchedRef.current) return;

    const fetchDistricts = async () => {
      try {
        setLoadingDistricts(true);
        const res = await api.get('/districts?limit=100');
        const list = res.data?.data ?? [];
        setDistricts(list);

        // Set nilai default ke district pertama agar districtId tidak kosong
        if (list.length > 0) {
          setForm(prev => ({ ...prev, districtId: list[0].id }));
        }

        fetchedRef.current = true;
      } catch {
        // Jika gagal fetch, biarkan user lihat pesan error saat submit
      } finally {
        setLoadingDistricts(false);
      }
    };

    fetchDistricts();
  }, [showAuditModal]);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleClose = () => {
    setShowAuditModal(false);
    setForm(INITIAL_FORM);
    setFormError('');
  };

  // ─── handleSave: POST ke /api/v1/audits lalu trigger refresh Dashboard ───────
  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');

    // Validasi minimal — districtId kini diisi otomatis via dropdown
    if (!form.districtId) {
      setFormError('Pilih district terlebih dahulu.');
      return;
    }
    if (!form.nama.trim()) {
      setFormError('Nama tempat wajib diisi.');
      return;
    }
    if (!form.lat || !form.lng) {
      setFormError('Latitude dan Longitude wajib diisi.');
      return;
    }

    try {
      setSubmitting(true);

      // POST ke backend — menggunakan Axios instance (otomatis bawa JWT token)
      // Backend: prisma.$transaction → simpan ke Audit + Entity sekaligus
      await api.post('/audits', {
        name: form.nama.trim(),
        type: form.type,
        latitude: parseFloat(form.lat),
        longitude: parseFloat(form.lng),
        kelurahan: form.kecamatan.trim() || undefined,
        districtId: form.districtId,    // UUID dari state — tidak perlu diketik user
        priority: 'MEDIUM',
        status: 'PENDING',
      });

      // Tutup modal dan reset form
      handleClose();

      // ── Paksa refresh KPI di Dashboard ───────────────────────────────────────
      // Broadcast custom event — Dashboard.jsx akan listen dan panggil refresh()
      window.dispatchEvent(new CustomEvent('zonify:audit-saved'));
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err.message ||
        'Gagal menyimpan data. Coba lagi.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <nav className="flex flex-col h-full fixed left-0 top-0 z-40 bg-[#171f33] dark:bg-[#171f33] w-64 border-r border-white/5 shadow-[10px_0_30px_rgba(0,0,0,0.3)]">

        {/* Brand/Header */}
        <div className="px-6 py-8 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.4)]">
              <span className="material-symbols-outlined text-white text-xl">satellite_alt</span>
            </div>
            <span className="font-headline text-2xl font-black tracking-tighter text-white uppercase">Zonify</span>
          </div>
          <span className="text-xs text-on-surface-variant tracking-wider uppercase pl-11">Jakarta Selatan</span>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-col mt-4 flex-1">
          <NavLink to="/" className={({ isActive }) => isActive ? activeLinkClass : inactiveLinkClass} end>
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-medium text-sm">Dashboard</span>
          </NavLink>

          <NavLink to="/map" className={({ isActive }) => isActive ? activeLinkClass : inactiveLinkClass}>
            <span className="material-symbols-outlined">map</span>
            <span className="font-medium text-sm">Map</span>
          </NavLink>

          <NavLink to="/analytics" className={({ isActive }) => isActive ? activeLinkClass : inactiveLinkClass}>
            <span className="material-symbols-outlined">analytics</span>
            <span className="font-medium text-sm">Analytics</span>
          </NavLink>

          <NavLink to="/rankings" className={({ isActive }) => isActive ? activeLinkClass : inactiveLinkClass}>
            <span className="material-symbols-outlined">leaderboard</span>
            <span className="font-medium text-sm">Rankings</span>
          </NavLink>

          <NavLink to="/violations" className={({ isActive }) => isActive ? activeLinkClass : inactiveLinkClass}>
            <span className="material-symbols-outlined">warning</span>
            <span className="font-medium text-sm">Violations</span>
          </NavLink>

          {user?.isAdmin && (
            <NavLink to="/audit-logs" className={({ isActive }) => isActive ? activeLinkClass : inactiveLinkClass}>
              <span className="material-symbols-outlined">assignment</span>
              <span className="font-medium text-sm">Audit Logs</span>
            </NavLink>
          )}

          <NavLink to="/calculator" className={({ isActive }) => isActive ? activeLinkClass : inactiveLinkClass}>
            <span className="material-symbols-outlined">calculate</span>
            <span className="font-medium text-sm">Distance calculator</span>
          </NavLink>
        </div>

        {/* CTA — New Audit */}
        {user?.isAdmin && (
          <div className="p-6 mt-auto">
            <button
              id="new-audit-btn"
              onClick={() => setShowAuditModal(true)}
              className="w-full py-3 px-4 bg-gradient-to-r from-primary-container to-[#5a00c6] text-white font-bold text-xs tracking-widest uppercase rounded-lg shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] transition-all duration-300 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              New Audit
            </button>
          </div>
        )}
      </nav>

      {/* ── Modal New Audit ─────────────────────────────────────────────────── */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1f2937] p-6 rounded-xl w-[420px] shadow-2xl outline outline-1 outline-white/10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">assignment_add</span>
                Tambah Audit Baru
              </h2>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Tutup modal"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form id="new-audit-form" onSubmit={handleSave} className="space-y-3">
              {/* Error */}
              {formError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}

              {/* Nama */}
              <input
                id="audit-nama"
                name="nama"
                value={form.nama}
                onChange={handleChange}
                placeholder="Nama tempat *"
                required
                className="w-full p-2.5 rounded-lg bg-[#111827] text-white text-sm outline outline-1 outline-white/10 focus:outline-purple-500 transition placeholder:text-slate-500"
              />

              {/* Koordinat */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  id="audit-lat"
                  name="lat"
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={handleChange}
                  placeholder="Latitude *"
                  required
                  className="w-full p-2.5 rounded-lg bg-[#111827] text-white text-sm outline outline-1 outline-white/10 focus:outline-purple-500 transition placeholder:text-slate-500"
                />
                <input
                  id="audit-lng"
                  name="lng"
                  type="number"
                  step="any"
                  value={form.lng}
                  onChange={handleChange}
                  placeholder="Longitude *"
                  required
                  className="w-full p-2.5 rounded-lg bg-[#111827] text-white text-sm outline outline-1 outline-white/10 focus:outline-purple-500 transition placeholder:text-slate-500"
                />
              </div>

              {/* Tipe */}
              <select
                id="audit-type"
                name="type"
                value={form.type}
                onChange={handleChange}
                className="w-full p-2.5 rounded-lg bg-[#111827] text-white text-sm outline outline-1 outline-white/10 focus:outline-purple-500 transition"
              >
                <option value="MINIMARKET">Retail / Minimarket</option>
                <option value="PASAR">Pasar Tradisional</option>
                <option value="SUPERMARKET">Supermarket / Zonasi</option>
              </select>

              {/* Kecamatan */}
              <input
                id="audit-kecamatan"
                name="kecamatan"
                value={form.kecamatan}
                onChange={handleChange}
                placeholder="Kecamatan / Kelurahan"
                className="w-full p-2.5 rounded-lg bg-[#111827] text-white text-sm outline outline-1 outline-white/10 focus:outline-purple-500 transition placeholder:text-slate-500"
              />

              {/* District — Dropdown nama, UUID tersembunyi di state */}
              <div className="relative">
                {loadingDistricts ? (
                  <div className="w-full p-2.5 rounded-lg bg-[#111827] text-slate-500 text-sm outline outline-1 outline-white/10 flex items-center gap-2">
                    <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                    Memuat daftar district…
                  </div>
                ) : (
                  <select
                    id="audit-district"
                    name="districtId"
                    value={form.districtId}
                    onChange={handleChange}
                    required
                    className="w-full p-2.5 rounded-lg bg-[#111827] text-white text-sm outline outline-1 outline-white/10 focus:outline-purple-500 transition appearance-none"
                  >
                    {districts.length === 0 ? (
                      <option value="" disabled>Tidak ada district tersedia</option>
                    ) : (
                      districts.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name}{d.code ? ` (${d.code})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                )}
                {/* Ikon chevron untuk select */}
                {!loadingDistricts && (
                  <span className="material-symbols-outlined text-slate-500 text-sm absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    expand_more
                  </span>
                )}
              </div>

              {/* Tombol aksi */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 bg-white/5 hover:bg-white/10 transition"
                >
                  Batal
                </button>
                <button
                  id="audit-save-btn"
                  type="submit"
                  disabled={submitting || loadingDistricts}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {submitting && (
                    <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                  )}
                  {submitting ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
