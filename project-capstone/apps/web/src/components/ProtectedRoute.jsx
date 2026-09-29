import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Helper: ambil token dari object user di localStorage
const getToken = () => {
  try {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user)?.token : null;
  } catch {
    return null;
  }
};

export const RequireAuth = () => {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
};

export const RequireAdmin = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    // Full-screen loader so it never appears as a blank page
    return (
      <div className="ml-64 flex items-center justify-center min-h-screen bg-surface-dim">
        <div className="flex flex-col items-center gap-3 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">refresh</span>
          <p className="text-sm">Memverifikasi akses admin…</p>
        </div>
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Support both wrapper-children pattern and nested-route Outlet pattern
  return children ? <>{children}</> : <Outlet />;
};

const ProtectedRoute = ({ children }) => {
  // 🔥 FIX: Baca token dari objek "user" di localStorage (sesuai AuthContext)
  const savedUser = localStorage.getItem('user');
  const token = savedUser ? JSON.parse(savedUser)?.token : null;

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;