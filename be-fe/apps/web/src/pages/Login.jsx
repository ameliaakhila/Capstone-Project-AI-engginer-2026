import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

const Login = () => {
    const { login, user } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // -- UI state --
    const [loading, setLoading] = useState(false);  // disable tombol & tampilkan teks loading
    const [error, setError] = useState("");          // pesan error inline

    // 🔥 AUTO REDIRECT kalau sudah login
    useEffect(() => {
        if (user) {
            navigate("/");
        }
    }, [user, navigate]);

    // 🔥 HANDLE LOGIN
    const handleLogin = async (e) => {
        e.preventDefault();        // cegah reload halaman
        setError("");              // bersihkan error lama
        setLoading(true);

        try {
            // AuthContext.login() sudah menangani:
            //   - fetch POST ke /api/v1/auth/login
            //   - parsing JWT
            //   - localStorage.setItem('user', ...)
            //   - setUser(userData) secara global
            const result = await login(email, password);

            if (result.success) {
                // replace: true agar tombol Back tidak kembali ke halaman login
                navigate("/", { replace: true });
            } else {
                setError(result.error || "Email atau password salah.");
            }
        } catch (err) {
            console.error("[Login] unexpected error:", err);
            setError("Tidak dapat terhubung ke server. Coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#020817]">
            {/* onSubmit di <form> agar Enter pun memicu login */}
            <form
                onSubmit={handleLogin}
                className="bg-[#1e293b] p-6 rounded-xl w-80 shadow-lg"
            >

                <h2 className="text-white text-lg font-bold mb-4 text-center">
                    Login
                </h2>

                {/* PESAN ERROR INLINE */}
                {error && (
                    <div className="mb-3 px-3 py-2 rounded bg-red-500/20 border border-red-500/40 text-red-400 text-sm text-center">
                        {error}
                    </div>
                )}

                {/* EMAIL */}
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                    className="w-full mb-3 px-3 py-2 rounded bg-gray-300 text-black disabled:opacity-60"
                />

                {/* PASSWORD */}
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    className="w-full mb-4 px-3 py-2 rounded bg-gray-300 text-black disabled:opacity-60"
                />

                {/* BUTTON LOGIN */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-purple-400 py-2 rounded text-white font-semibold hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {loading ? "Memproses..." : "Login"}
                </button>

                {/* LINK KE REGISTER */}
                <p className="text-center text-sm text-slate-500 mt-4">
                    Belum punya akun?{" "}
                    <Link
                        to="/register"
                        className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                    >
                        Daftar di sini
                    </Link>
                </p>

            </form>
        </div>
    );
};

export default Login;