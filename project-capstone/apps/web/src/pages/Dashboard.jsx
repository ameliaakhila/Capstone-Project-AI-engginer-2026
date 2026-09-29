import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import KPIGrid from '../components/KPIGrid';
import MapSection from '../components/MapSection';
import TopDistrictsChart from '../components/TopDistrictsChart';
import ViolationsTable from '../components/ViolationsTable';
import AuditSummaryCard from '../components/AuditSummaryCard';
import { useStats } from '../hooks/useStats';

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');

  // Single Source of Truth:
  //   total = entities.filter(e => e.type === 'MINIMARKET').length
  //   diambil dari GET /api/v1/entities?type=MINIMARKET (meta.total)
  //   dengan cache: 'no-store' agar tidak kena 304.
  const stats = useStats();

  // ── Listen event dari Sidebar setelah form New Audit di-Save ──────────────
  // Sidebar.jsx mendispatch 'zonify:audit-saved' setelah POST /api/v1/audits
  // sukses. Di sini kita panggil refresh() agar KPI terupdate tanpa reload.
  useEffect(() => {
    const handleAuditSaved = () => {
      stats.refresh();
    };

    window.addEventListener('zonify:audit-saved', handleAuditSaved);
    return () => {
      window.removeEventListener('zonify:audit-saved', handleAuditSaved);
    };
  }, [stats.refresh]);

  return (
    <div className="bg-surface-dim text-on-surface font-body antialiased selection:bg-primary-container/30 selection:text-primary-fixed min-h-screen">
      <Header onSearch={setSearchQuery} />

      <main className="ml-64 p-8 min-h-screen">
        {/* ── Page title ──────────────────────────────── */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight">Overview</h1>
            <p className="text-on-surface-variant text-sm mt-1">Real-time geospatial zoning analysis.</p>
          </div>

          {/* Tombol Refresh Manual */}
          <button
            id="dashboard-refresh-btn"
            onClick={stats.refresh}
            className="flex items-center gap-2 text-sm text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-lg outline outline-1 outline-outline-variant/20 hover:outline-primary/40 transition-colors"
          >
            <span className={`material-symbols-outlined text-xs text-success ${stats.loading ? 'animate-spin' : 'animate-spin-slow'}`}>
              sync
            </span>
            {stats.loading ? 'Memuat…' : 'Live Sync Active'}
          </button>
        </div>

        {/* ── KPI Cards ────────────────────────────────────────────────────── */}
        <KPIGrid stats={stats} />

        {/* ── Map + Top Districts ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          <MapSection searchQuery={searchQuery} />
          <TopDistrictsChart />
        </div>

        {/* ── Violations Table ────────────────────────── */}
        <ViolationsTable hideAction={true} />

        {/* ── Audit Summary ────────────────────────────── */}
        <div className="mt-8">
          <AuditSummaryCard />
        </div>
      </main>
    </div>
  );
};

export default Dashboard;