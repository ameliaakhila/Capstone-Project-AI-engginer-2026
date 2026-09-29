import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export const AuthProvider = ({ children }) => {
    const [loading, setLoading] = useState(true);

    // 🔥 LOAD DARI LOCALSTORAGE (AUTO LOGIN)
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem("user");
        return savedUser ? JSON.parse(savedUser) : null;
    });

    useEffect(() => {
        // Normally verify token with backend here; for now we finish init
        setLoading(false);
    }, []);

    // 🔥 LOGIN — async, panggil API backend
    const login = async (email, password) => {
        if (!email || !password) return { success: false, error: "Email dan password wajib diisi" };

        try {
            const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const json = await res.json();

            if (!res.ok) {
                return { success: false, error: json.message || "Login gagal" };
            }

            // Simpan data lengkap user dari response API
            const userData = {
                id: json.data.id,
                email: json.data.email,
                name: json.data.username,   // field 'name' dipakai di Header
                roleId: json.data.roleId ?? 2,
                role: json.data.role ?? { id: 2, name: 'user' },
                isAdmin: json.data.isAdmin ?? (json.data.roleId === 1),
                avatar: json.data.avatar || null,
                token: json.token,
            };

            setUser(userData);
            localStorage.setItem("user", JSON.stringify(userData));
            localStorage.setItem("token", userData.token); // ← tambah ini

            return { success: true };
        } catch (err) {
            console.error("LOGIN ERROR:", err);
            return { success: false, error: "Tidak dapat terhubung ke server" };
        }
    };

    // 🔥 LOGOUT
    const logout = () => {
        setUser(null);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);