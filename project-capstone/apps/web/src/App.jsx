import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MapView from './pages/MapView';
import Analytics from './pages/Analytics';
import Rankings from './pages/Rankings';
import ViolationsPage from "./pages/ViolationsPage";
import Calculator from "./pages/calculator/Calculator";
import AuditLogs from "./pages/AuditLogs";

// 🔥 TAMBAHAN
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute, { RequireAuth, RequireAdmin } from "./components/ProtectedRoute";


function App() {
  return (
    <Routes>

      {/* 🔓 PUBLIC */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/map" element={<MapView />} />

        {/* 🔒 ADMIN ONLY */}
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          }
        />

        <Route
          path="/violations"
          element={
            <ProtectedRoute>
              <ViolationsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rankings"
          element={
            <ProtectedRoute>
              <Rankings />
            </ProtectedRoute>
          }
        />

        {/* 🧮 KALKULATOR JARAK (Haversine) */}
        <Route path="/calculator" element={<Calculator />} />

        {/* 📋 AUDIT LOGS — Admin only */}
        <Route
          path="/audit-logs"
          element={
            <RequireAdmin>
              <AuditLogs />
            </RequireAdmin>
          }
        />
      </Route>

      {/* ─────────────────────────────────────────────────────────────
          PANDUAN PENGGUNAAN SATPAM FRONTEND (Outlet Pattern)
          Aktifkan blok ini jika ingin melindungi route dengan Outlet:

          🔒 RequireAuth — Semua user yang sudah login:
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
            </Route>
          </Route>

          🔐 RequireAdmin — Hanya Admin (isAdmin: true):
          <Route element={<RequireAdmin />}>
            <Route element={<Layout />}>
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
          </Route>
      ───────────────────────────────────────────────────────────── */}

    </Routes>
  );
}

export default App;
