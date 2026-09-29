import { useState, useEffect, useCallback } from "react";

const API_BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api/v1`;

// Helper ambil Authorization header dari localStorage
const getHeaders = () => {
  try {
    const token =
      localStorage.getItem("token") ||
      JSON.parse(localStorage.getItem("user") ?? "{}")?.token;
    return token
      ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      : { "Content-Type": "application/json" };
  } catch {
    return { "Content-Type": "application/json" };
  }
};

/**
 * useStats — Single Source of Truth untuk KPI Dashboard.
 *
 * Sumber data: GET /api/v1/entities?type=MINIMARKET (meta.total)
 * Cache: 'no-store' pada setiap fetch agar browser tidak pakai data stale (304).
 *
 * Mengekspos refresh() agar bisa di-trigger dari luar (misal: setelah form Save).
 *
 * @param {number} [refreshInterval=0] - Auto-refresh interval ms (0 = disable)
 */
export const useStats = ({ refreshInterval = 0 } = {}) => {
  const [stats, setStats] = useState({
    pasar:      0,
    pasarTrend: 0,
    total:      0,
    violations: 0,
    safe:       0,
    compliance: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchLiveStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const headers = getHeaders();

      // ── Fetch paralel dengan cache: 'no-store' agar tidak kena 304 ──────────
      const [miniRes, pasarRes, violRes] = await Promise.all([
        fetch(`${API_BASE}/entities?type=MINIMARKET&limit=1`, {
          headers,
          cache: 'no-store',   // ← paksa browser tidak gunakan cache
        }),
        fetch(`${API_BASE}/entities?type=PASAR&limit=1`, {
          headers,
          cache: 'no-store',
        }),
        fetch(`${API_BASE}/violations/summary`, {
          headers,
          cache: 'no-store',
        }),
      ]);

      if (!miniRes.ok)  throw new Error(`Entities MINIMARKET error: ${miniRes.status}`);
      if (!pasarRes.ok) throw new Error(`Entities PASAR error: ${pasarRes.status}`);

      const [miniJson, pasarJson, violJson] = await Promise.all([
        miniRes.json(),
        pasarRes.json(),
        violRes.ok ? violRes.json() : Promise.resolve(null),
      ]);

      // totalMinimarket = entities.filter(e => e.type === 'MINIMARKET').length
      // (versi server-side via meta.total — efisien & akurat)
      const totalMinimarket  = miniJson?.meta?.total  ?? 0;
      const totalPasar       = pasarJson?.meta?.total ?? 0;
      const pasarTrend       = pasarJson?.meta?.trend ?? 0;

      const activeViolations =
        violJson?.data?.totalActive ??
        violJson?.data?.active ??
        0;

      const safeCount = Math.max(0, totalMinimarket - activeViolations);
      const compliance =
        totalMinimarket > 0
          ? ((safeCount / totalMinimarket) * 100).toFixed(1)
          : "0.0";

      setStats({
        pasar:      totalPasar,
        pasarTrend,
        total:      totalMinimarket,
        violations: activeViolations,
        safe:       safeCount,
        compliance,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveStats();

    if (refreshInterval > 0) {
      const id = setInterval(fetchLiveStats, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetchLiveStats, refreshInterval]);

  // refresh() diekspor agar komponen lain dapat trigger ulang fetch
  return { ...stats, loading, error, refresh: fetchLiveStats };
};