import React, { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import api from '../utils/api';

// ─── Badge helpers ────────────────────────────────────────────────────────────
const STATUS_STYLE = {
  PENDING: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  IN_PROGRESS: 'bg-blue-500/15   text-blue-400   border border-blue-500/30',
  COMPLETED: 'bg-green-500/15  text-green-400  border border-green-500/30',
  CANCELLED: 'bg-red-500/15    text-red-400    border border-red-500/30',
};

const PRIORITY_STYLE = {
  HIGH: 'bg-red-500/15    text-red-400',
  MEDIUM: 'bg-yellow-500/15 text-yellow-400',
  LOW: 'bg-green-500/15  text-green-400',
};

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${STATUS_STYLE[status] ?? 'bg-surface-variant text-on-surface-variant'}`}>
    {status?.replace('_', ' ')}
  </span>
);

const PriorityBadge = ({ priority }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${PRIORITY_STYLE[priority] ?? 'bg-surface-variant text-on-surface-variant'}`}>
    {priority}
  </span>
);

// ─── Skeleton row ─────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <tr className="animate-pulse">
    {[...Array(7)].map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-3 bg-surface-variant/40 rounded w-3/4" />
      </td>
    ))}
  </tr>
);

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
const ConfirmDialog = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="bg-[#1f2937] rounded-xl p-6 w-[360px] shadow-2xl outline outline-1 outline-white/10">
      <div className="flex items-start gap-3 mb-5">
        <span className="material-symbols-outlined text-yellow-400 mt-0.5">warning</span>
        <p className="text-sm text-white leading-relaxed">{message}</p>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm text-slate-300 bg-white/5 hover:bg-white/10 transition"
        >
          Batal
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition"
        >
          Ya, Lanjutkan
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const AuditLogs = () => {
  const [audits, setAudits] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState('');  // feedback singkat setelah aksi

  // Filter state
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });
  const [page, setPage] = useState(1);

  // Confirm dialog state
  const [confirm, setConfirm] = useState(null);  // { type: 'delete'|'restore', id, code }

  // ── Fetch data ────────────────────────────────────────────────────────────
  const fetchAudits = useCallback(async (currentPage = 1, currentFilters = filters) => {
    console.log('[AuditLogs] fetchAudits called — page:', currentPage, 'filters:', currentFilters);
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      if (currentFilters.status) params.set('status', currentFilters.status);
      if (currentFilters.priority) params.set('priority', currentFilters.priority);
      if (currentFilters.search) params.set('search', currentFilters.search);

      const endpoint = `/audits?${params.toString()}`;
      console.log('[AuditLogs] GET', endpoint);

      const res = await api.get(endpoint);
      console.log('[AuditLogs] raw response:', res.data);

      // Flexible response shape: plain array OR { data: [...], pagination: {} }
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
          ? res.data.data
          : [];

      console.log('[AuditLogs] rows parsed:', rows.length, 'items');
      setAudits(rows);
      setPagination(res.data.pagination ?? { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      console.error('[AuditLogs] fetchAudits ERROR:', err);
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        err.message ??
        'Gagal memuat data audit';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAudits(page, filters);
  }, [page, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  // ── Aksi: Delete (soft) ───────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      setConfirm(null);
      await api.delete(`/audits/${id}`);
      setActionMsg('✓ Audit berhasil dihapus (status → CANCELLED)');
      fetchAudits(page, filters);
      // Sync Dashboard KPI
      window.dispatchEvent(new CustomEvent('zonify:audit-saved'));
    } catch (err) {
      setActionMsg(`✗ ${err?.response?.data?.message ?? 'Gagal menghapus audit'}`);
    } finally {
      setTimeout(() => setActionMsg(''), 4000);
    }
  };

  // ── Aksi: Restore ─────────────────────────────────────────────────────────
  const handleRestore = async (id) => {
    try {
      setConfirm(null);
      await api.post(`/audits/${id}/restore`);
      setActionMsg('✓ Audit berhasil di-restore (status → PENDING)');
      fetchAudits(page, filters);
      // Sync Dashboard KPI
      window.dispatchEvent(new CustomEvent('zonify:audit-saved'));
    } catch (err) {
      setActionMsg(`✗ ${err?.response?.data?.message ?? 'Gagal me-restore audit'}`);
    } finally {
      setTimeout(() => setActionMsg(''), 4000);
    }
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  console.log('[AuditLogs] render — loading:', loading, '| error:', error, '| audits:', audits.length);

  return (
    <div className="bg-surface-dim text-on-surface font-body antialiased min-h-screen">
      <Header />

      <main className="ml-64 p-8 min-h-screen">
        {/* ── Page title ───────────────────────── */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight">Audit Logs</h1>
            <p className="text-on-surface-variant text-sm mt-1">
              Manajemen riwayat data audit — khusus Admin.
            </p>
          </div>
          <button
            id="audit-logs-refresh"
            onClick={() => fetchAudits(page, filters)}
            className="flex items-center gap-2 text-sm text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-lg outline outline-1 outline-outline-variant/20 hover:outline-primary/40 transition-colors"
          >
            <span className={`material-symbols-outlined text-xs text-success ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            Refresh
          </button>
        </div>

        {/* ── Feedback toast ───────────────────── */}
        {actionMsg && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${actionMsg.startsWith('✓') ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
            {actionMsg}
          </div>
        )}

        {/* ── Card ─────────────────────────────── */}
        <div className="bg-surface-container-high/70 backdrop-blur-md outline outline-1 outline-outline-variant/20 rounded-xl overflow-hidden">

          {/* Filters */}
          <div className="flex flex-wrap gap-3 px-6 py-4 bg-surface-container/30 border-b border-outline-variant/10">
            <div className="relative flex-1 min-w-[180px]">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant pointer-events-none">search</span>
              <input
                id="audit-logs-search"
                type="text"
                placeholder="Cari kode, entity, district…"
                value={filters.search}
                onChange={e => handleFilterChange('search', e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-surface-container outline outline-1 outline-outline-variant/30 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-primary/50 focus:outline-2 transition"
              />
            </div>

            <select
              id="audit-logs-status"
              value={filters.status}
              onChange={e => handleFilterChange('status', e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg bg-surface-container outline outline-1 outline-outline-variant/30 text-on-surface focus:outline-primary/50 transition"
            >
              <option value="">Semua Status</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled (Deleted)</option>
            </select>

            <select
              id="audit-logs-priority"
              value={filters.priority}
              onChange={e => handleFilterChange('priority', e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg bg-surface-container outline outline-1 outline-outline-variant/30 text-on-surface focus:outline-primary/50 transition"
            >
              <option value="">Semua Prioritas</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/20">
                  <th className="px-4 py-3 text-left font-medium">Kode</th>
                  <th className="px-4 py-3 text-left font-medium">Entity</th>
                  <th className="px-4 py-3 text-left font-medium">District</th>
                  <th className="px-4 py-3 text-left font-medium">Prioritas</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Tanggal</th>
                  <th className="px-4 py-3 text-center font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {loading ? (
                  [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-error text-xs">
                      <span className="material-symbols-outlined text-2xl block mb-1">error_outline</span>
                      {error}
                    </td>
                  </tr>
                ) : audits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-xs">
                      {/* ── DEBUG BANNER ── Remove once data is confirmed ── */}
                      <div className="mb-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-mono">
                        <span className="material-symbols-outlined text-sm">bug_report</span>
                        DEBUG: No data found — API returned 0 rows. Check console for raw response.
                      </div>
                      <div className="text-on-surface-variant mt-2">
                        <span className="material-symbols-outlined text-2xl block mb-1 opacity-40">inbox</span>
                        Tidak ada data audit
                      </div>
                    </td>
                  </tr>
                ) : (
                  audits.map((audit) => (
                    <tr key={audit.id} className={`hover:bg-surface-container/50 transition-colors ${audit.status === 'CANCELLED' ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{audit.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-on-surface text-xs leading-tight">{audit.entity?.name ?? '—'}</div>
                        <div className="text-[10px] text-on-surface-variant mt-0.5">{audit.entity?.type}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-on-surface">{audit.district?.name ?? '—'}</div>
                        <div className="text-[10px] text-on-surface-variant">{audit.district?.status}</div>
                      </td>
                      <td className="px-4 py-3"><PriorityBadge priority={audit.priority} /></td>
                      <td className="px-4 py-3"><StatusBadge status={audit.status} /></td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant whitespace-nowrap">{formatDate(audit.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {/* Tombol Delete — aktif jika bukan CANCELLED */}
                          <button
                            id={`delete-audit-${audit.id}`}
                            disabled={audit.status === 'CANCELLED'}
                            onClick={() => setConfirm({ type: 'delete', id: audit.id, code: audit.code })}
                            title="Hapus (soft delete)"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <span className="material-symbols-outlined text-xs">delete</span>
                            Hapus
                          </button>

                          {/* Tombol Restore — hanya muncul jika CANCELLED */}
                          {audit.status === 'CANCELLED' && (
                            <button
                              id={`restore-audit-${audit.id}`}
                              onClick={() => setConfirm({ type: 'restore', id: audit.id, code: audit.code })}
                              title="Restore ke PENDING"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition"
                            >
                              <span className="material-symbols-outlined text-xs">restore</span>
                              Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && !error && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-outline-variant/20 text-xs text-on-surface-variant">
              <span>
                Halaman {pagination.page} dari {pagination.totalPages}
                <span className="ml-2 text-on-surface-variant/60">({pagination.total} total)</span>
              </span>
              <div className="flex gap-2">
                <button
                  id="audit-logs-prev"
                  disabled={!pagination.hasPrev}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg outline outline-1 outline-outline-variant/20 hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  ← Prev
                </button>
                <button
                  id="audit-logs-next"
                  disabled={!pagination.hasNext}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 rounded-lg outline outline-1 outline-outline-variant/20 hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Confirm Dialog */}
      {confirm && (
        <ConfirmDialog
          message={
            confirm.type === 'delete'
              ? `Hapus audit ${confirm.code}? Status akan berubah menjadi CANCELLED. Data dapat di-restore kapanpun.`
              : `Restore audit ${confirm.code}? Status akan kembali ke PENDING.`
          }
          onConfirm={() =>
            confirm.type === 'delete'
              ? handleDelete(confirm.id)
              : handleRestore(confirm.id)
          }
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default AuditLogs;
