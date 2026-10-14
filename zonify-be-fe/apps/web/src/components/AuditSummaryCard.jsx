import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';

// ─── Badge helpers ────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  PENDING:     'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  IN_PROGRESS: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  COMPLETED:   'bg-green-500/15 text-green-400 border border-green-500/30',
  CANCELLED:   'bg-red-500/15 text-red-400 border border-red-500/30',
};

const PRIORITY_STYLES = {
  HIGH:   'bg-red-500/15 text-red-400',
  MEDIUM: 'bg-yellow-500/15 text-yellow-400',
  LOW:    'bg-green-500/15 text-green-400',
};

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${STATUS_STYLES[status] ?? 'bg-surface-variant text-on-surface-variant'}`}>
    {status?.replace('_', ' ')}
  </span>
);

const PriorityBadge = ({ priority }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${PRIORITY_STYLES[priority] ?? 'bg-surface-variant text-on-surface-variant'}`}>
    {priority}
  </span>
);

// ─── Skeleton row ─────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <tr className="animate-pulse">
    {[...Array(5)].map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-3 bg-surface-variant/50 rounded w-3/4" />
      </td>
    ))}
  </tr>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const AuditSummaryCard = () => {
  const [audits,     setAudits]     = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  // Filter & search state
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });
  const [page,    setPage]    = useState(1);

  const fetchAudits = useCallback(async (currentPage = 1, currentFilters = filters) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page:  currentPage,
        limit: 8,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      if (currentFilters.status)   params.set('status',   currentFilters.status);
      if (currentFilters.priority) params.set('priority', currentFilters.priority);
      if (currentFilters.search)   params.set('search',   currentFilters.search);

      const res = await api.get(`/dashboard/audits?${params.toString()}`);

      setAudits(res.data.data ?? []);
      setPagination(res.data.pagination ?? { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      setError(err?.response?.data?.error ?? err.message ?? 'Gagal memuat data audit');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch on mount & whenever page/filters change
  useEffect(() => {
    fetchAudits(page, filters);
  }, [page, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleSearchChange = (e) => {
    handleFilterChange('search', e.target.value);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  return (
    <div className="bg-surface-container-high/70 backdrop-blur-md outline outline-1 outline-outline-variant/20 rounded-xl overflow-hidden">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 border-b border-outline-variant/20">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary/80">assignment</span>
          <div>
            <h2 className="font-semibold text-on-surface text-base leading-tight">Data Audit</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {loading ? '…' : `${pagination.total} total audit terdaftar`}
            </p>
          </div>
        </div>

        {/* Refresh button */}
        <button
          id="audit-refresh-btn"
          onClick={() => fetchAudits(page, filters)}
          className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>refresh</span>
          Refresh
        </button>
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 px-6 py-4 bg-surface-container/30 border-b border-outline-variant/10">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant pointer-events-none">search</span>
          <input
            id="audit-search-input"
            type="text"
            placeholder="Cari kode, entity, district…"
            value={filters.search}
            onChange={handleSearchChange}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-surface-container outline outline-1 outline-outline-variant/30 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-primary/50 focus:outline-2 transition"
          />
        </div>

        {/* Status filter */}
        <select
          id="audit-status-filter"
          value={filters.status}
          onChange={e => handleFilterChange('status', e.target.value)}
          className="text-xs px-3 py-1.5 rounded-lg bg-surface-container outline outline-1 outline-outline-variant/30 text-on-surface focus:outline-primary/50 transition"
        >
          <option value="">Semua Status</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        {/* Priority filter */}
        <select
          id="audit-priority-filter"
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

      {/* ── Table ──────────────────────────────────────────── */}
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
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {loading ? (
              [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-error text-xs">
                  <span className="material-symbols-outlined text-2xl block mb-1">error_outline</span>
                  {error}
                </td>
              </tr>
            ) : audits.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-on-surface-variant text-xs">
                  <span className="material-symbols-outlined text-2xl block mb-1 opacity-40">inbox</span>
                  Tidak ada data audit ditemukan
                </td>
              </tr>
            ) : (
              audits.map((audit) => (
                <tr
                  key={audit.id}
                  className="hover:bg-surface-container/50 transition-colors group"
                >
                  <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">
                    {audit.code}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-on-surface text-xs leading-tight">
                      {audit.entity?.name ?? '—'}
                    </div>
                    <div className="text-[10px] text-on-surface-variant mt-0.5">
                      {audit.entity?.type}
                      {audit.entity?.isFlagged && (
                        <span className="ml-1.5 text-error">● Flagged</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-on-surface">{audit.district?.name ?? '—'}</div>
                    <div className="text-[10px] text-on-surface-variant">{audit.district?.status}</div>
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={audit.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={audit.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant whitespace-nowrap">
                    {formatDate(audit.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────── */}
      {!loading && !error && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-outline-variant/20 text-xs text-on-surface-variant">
          <span>
            Halaman {pagination.page} dari {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              id="audit-prev-btn"
              disabled={!pagination.hasPrev}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 rounded-lg outline outline-1 outline-outline-variant/20 hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              ← Prev
            </button>
            <button
              id="audit-next-btn"
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
  );
};

export default AuditSummaryCard;
