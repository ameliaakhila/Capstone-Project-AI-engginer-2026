import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL ?? '';

const Register = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 🔥 Auto redirect kalau sudah login
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // 🔒 Validasi password match
    if (form.password !== form.confirmPassword) {
      setError("Password dan Konfirmasi Password tidak cocok.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }

    setLoading(true);

    try {

      const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.name,
          email: form.email,
          password: form.password,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.message || "Registrasi gagal. Coba lagi.");
        return;
      }

      // ✅ Sukses — tampilkan pesan lalu redirect ke login
      setSuccess("Akun berhasil dibuat! Mengarahkan ke halaman login...");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      console.error("REGISTER ERROR:", err);
      setError("Tidak dapat terhubung ke server. Pastikan backend berjalan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020817] relative overflow-hidden">

      {/* ─── Background glow decorations ─── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-900/10 rounded-full blur-3xl" />
      </div>

      {/* ─── Card ─── */}
      <div className="relative z-10 w-full max-w-md mx-4">

        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 mb-4">
            <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Zonify</h1>
          <p className="text-slate-400 text-sm mt-1">Buat akun baru</p>
        </div>

        {/* Glass Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/40">

          <h2 className="text-lg font-semibold text-white mb-6">Daftar Akun</h2>

          {/* ─── Error Alert ─── */}
          {error && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-4 py-3 mb-5">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* ─── Success Alert ─── */}
          {success && (
            <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm rounded-xl px-4 py-3 mb-5">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Nama Lengkap */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="reg-name">
                Nama Lengkap
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <input
                  id="reg-name"
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="Masukkan nama lengkap"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder:text-slate-600 text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-violet-500/60 focus:bg-white/8 transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="reg-email">
                Email
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <input
                  id="reg-email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="contoh@email.com"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder:text-slate-600 text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-violet-500/60 focus:bg-white/8 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="reg-password">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  id="reg-password"
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  placeholder="Minimal 6 karakter"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder:text-slate-600 text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-violet-500/60 focus:bg-white/8 transition-all"
                />
              </div>
            </div>

            {/* Konfirmasi Password */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="reg-confirm">
                Konfirmasi Password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </span>
                <input
                  id="reg-confirm"
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="Ulangi password"
                  className={`w-full bg-white/5 border text-white placeholder:text-slate-600 text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none transition-all ${form.confirmPassword && form.confirmPassword !== form.password
                    ? "border-red-500/50 focus:border-red-500"
                    : "border-white/10 focus:border-violet-500/60 focus:bg-white/8"
                    }`}
                />
              </div>
              {/* Real-time mismatch hint */}
              {form.confirmPassword && form.confirmPassword !== form.password && (
                <p className="text-red-400 text-xs mt-1.5 pl-1">Password tidak cocok</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              id="reg-submit"
              type="submit"
              disabled={loading || !!success}
              className="w-full mt-2 py-2.5 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-violet-900/30"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Memproses...
                </>
              ) : (
                "Buat Akun"
              )}
            </button>

          </form>

          {/* ─── Link ke Login ─── */}
          <p className="text-center text-sm text-slate-500 mt-6">
            Sudah punya akun?{" "}
            <Link
              to="/login"
              className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
            >
              Masuk di sini
            </Link>
          </p>

        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-6">
          © {new Date().getFullYear()} Zonify · Geospatial Retail Analytics
        </p>
      </div>
    </div>
  );
};

export default Register;
