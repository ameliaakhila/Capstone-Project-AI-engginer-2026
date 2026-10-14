import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

// ─── Instance Axios terpusat ──────────────────────────────────────────────────
const api = axios.create({
    baseURL: `${API_BASE}/api/v1`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Otomatis sisipkan header Authorization: Bearer <token> di setiap request
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ─── Response Interceptor ─────────────────────────────────────────────────────
// Jika backend mengembalikan 401 Unauthorized → hapus token & redirect ke /login
api.interceptors.response.use(
    (response) => response, // response sukses: teruskan langsung
    (error) => {
        if (error.response?.status === 401) {
            // Hapus semua sesi yang tersimpan
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // Redirect ke halaman login
            // Gunakan window.location agar state React ter-reset penuh
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
