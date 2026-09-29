import React from 'react';

// 🔥 Terima data 'stats' dari Dashboard
const KPIGrid = ({ stats }) => {
  // Pecah datanya
  const { loading, pasar, pasarTrend = 0, total, violations, safe, compliance } = stats;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
      {/* 🟡 TOTAL PASAR */}
      <div className="bg-surface-container-high/70 backdrop-blur-md outline outline-1 outline-outline-variant/20 rounded-xl p-6 relative overflow-hidden group hover:outline-primary/30 transition-colors">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors"></div>
        <div className="flex justify-between items-start min-h-[48px] mb-4">
          <span className="text-sm text-on-surface-variant font-medium leading-5 max-w-[70%]">Total Pasar <br /> Tradisional</span>
          <span className="material-symbols-outlined text-primary/70">storefront</span>
        </div>
        <div className="font-number text-4xl font-bold text-on-surface">
          {loading ? <span className="text-on-surface-variant animate-pulse">—</span> : pasar}
        </div>
        <div className={`mt-3 text-xs flex items-center gap-1 ${
          pasarTrend > 0 ? 'text-success' : pasarTrend < 0 ? 'text-tertiary' : 'text-on-surface-variant'
        }`}>
          <span className="material-symbols-outlined text-[10px]">
            {pasarTrend > 0 ? 'trending_up' : pasarTrend < 0 ? 'trending_down' : 'trending_flat'}
          </span>
          {pasarTrend > 0 ? `+${pasarTrend}% from last month` : pasarTrend < 0 ? `${pasarTrend}% from last month` : 'No change'}
        </div>
      </div>

      {/* 🔵 TOTAL MINIMARKET */}
      <div className="bg-surface-container-high/70 backdrop-blur-md outline outline-1 outline-outline-variant/20 rounded-xl p-6 relative overflow-hidden group hover:outline-primary/30 transition-colors">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors"></div>
        <div className="flex justify-between items-start min-h-[48px] mb-4">
          <span className="text-sm text-on-surface-variant font-medium leading-5 max-w-[70%]">Total <br /> Minimarket</span>
          <span className="material-symbols-outlined text-primary/70">local_convenience_store</span>
        </div>
        <div className="font-number text-4xl font-bold text-on-surface">
          {loading ? <span className="text-on-surface-variant animate-pulse">—</span> : total}
        </div>
        <div className="mt-3 text-xs text-primary flex items-center gap-1">
          <span className="material-symbols-outlined text-[10px]">trending_up</span> Data real-time
        </div>
      </div>

      {/* 🔴 VIOLATIONS */}
      <div className="bg-surface-container-high/70 backdrop-blur-md outline outline-1 outline-outline-variant/20 rounded-xl p-6 relative overflow-hidden group hover:outline-error/30 transition-colors">
        <div className="absolute top-0 right-0 w-32 h-32 bg-error/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-error/10 transition-colors"></div>
        <div className="flex justify-between items-start min-h-[48px] mb-4">
          <span className="text-sm text-on-surface-variant font-medium leading-5 max-w-[70%]">Violations <br /> detected</span>
          <span className="material-symbols-outlined text-error/70">warning</span>
        </div>
        <div className="font-number text-4xl font-bold text-error">
          {loading ? <span className="text-error/40 animate-pulse">—</span> : violations}
        </div>
        <div className="mt-3 text-xs text-error flex items-center gap-1">
          <span className="material-symbols-outlined text-[10px]">priority_high</span> Critical based on distance
        </div>
      </div>

      {/* 🟣 COMPLIANCE RATE */}
      <div className="bg-surface-container-high/70 backdrop-blur-md outline outline-1 outline-outline-variant/20 rounded-xl p-6 relative overflow-hidden group hover:outline-tertiary/30 transition-colors">
        <div className="absolute top-0 right-0 w-32 h-32 bg-tertiary/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-tertiary/10 transition-colors"></div>
        <div className="flex justify-between items-start min-h-[48px] mb-4">
          <span className="text-sm text-on-surface-variant font-medium leading-5 max-w-[70%]">Compliance <br /> Rate</span>
          <span className="material-symbols-outlined text-tertiary/70">verified</span>
        </div>
        <div className="font-number text-4xl font-bold text-tertiary">
          {loading ? <span className="text-tertiary/40 animate-pulse">—</span> : `${compliance}%`}
        </div>
        <div className="mt-3 text-xs text-on-surface-variant flex items-center gap-1">
          Safe locations ratio
        </div>
      </div>

      {/* 🟢 SAFE LOCATIONS */}
      <div className="bg-surface-container-high/70 backdrop-blur-md outline outline-1 outline-outline-variant/20 rounded-xl p-6 relative overflow-hidden group hover:outline-green-500/30 transition-colors">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-green-500/10 transition-colors"></div>
        <div className="flex justify-between items-start min-h-[48px] mb-4">
          <span className="text-sm text-on-surface-variant font-medium leading-5 max-w-[70%]">Safe <br /> Locations</span>
          <span className="material-symbols-outlined text-green-400">verified</span>
        </div>
        <div className="font-number text-4xl font-bold text-green-500">
          {loading ? <span className="text-green-500/40 animate-pulse">—</span> : safe}
        </div>
        <div className="mt-3 text-xs text-on-surface-variant">
          Locations with no violation
        </div>
      </div>
    </div>
  );
};

export default KPIGrid;

