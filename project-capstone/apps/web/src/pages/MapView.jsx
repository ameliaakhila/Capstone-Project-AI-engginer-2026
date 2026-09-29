import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Popup,
  CircleMarker,
  Circle,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useLocations } from "../hooks/useLocations";
import { useSearchParams } from "react-router-dom";


const DEFAULT_RADIUS_METER = 500;

// ─────────────────────────────────────────────
// 1. DATA NORMALIZER (SANGAT AMAN & ANTI-CRASH)
// ─────────────────────────────────────────────
const getName = (loc) => {
  if (!loc) return "Tanpa Nama";
  return String(loc.nama || loc.name || loc.nama_tempat || "Tanpa Nama");
};

const getLat = (loc) => {
  if (!loc) return 0;
  return Number(loc.lat ?? loc.latitude ?? 0);
};

const getLng = (loc) => {
  if (!loc) return 0;
  return Number(loc.lng ?? loc.longitude ?? 0);
};

const isValidCoordinate = (loc) => {
  const lat = getLat(loc);
  const lng = getLng(loc);
  return !Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0;
};

const getType = (loc) => {
  if (!loc) return "retail";
  const rawType = String(loc.type || loc.markerType || "").toLowerCase();
  const name = getName(loc).toLowerCase();

  if (rawType.includes("pasar") || name.includes("pasar")) {
    return "pasar";
  }
  return "retail";
};

const getStore = (loc) => {
  if (!loc) return "Lainnya";

  // Coba ambil dari field store database
  const store = String(loc.store || loc.brand || "").trim();
  if (store && store !== "null" && store !== "undefined" && store !== "-") {
    return store;
  }

  // Jika di database kosong, deteksi otomatis dari nama toko
  const name = getName(loc).toLowerCase();
  if (name.includes("indomaret") || name.includes("ceriamart")) return "Indomaret";
  if (name.includes("alfamart") || name.includes("alfamidi") || name.includes("alfa")) return "Alfamart";

  return "Lainnya";
};

const getDistrict = (loc) => {
  if (!loc) return "-";
  const dist = loc.kecamatan || loc.nama_kecamatan || loc.district?.name || loc.districtName || loc.district;
  return dist ? String(dist) : "-";
};

const formatNumber = (value) => {
  return Number(value || 0).toLocaleString("id-ID");
};

// ─────────────────────────────────────────────
// 2. HAVERSINE DISTANCE
// ─────────────────────────────────────────────
const getDistanceMeter = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getNearestPasar = (loc, pasarLocations) => {
  if (getType(loc) === "pasar") return null;

  const lat = getLat(loc);
  const lng = getLng(loc);

  const sorted = pasarLocations
    .map((pasar) => {
      const distance = getDistanceMeter(lat, lng, getLat(pasar), getLng(pasar));
      return { pasar, distance };
    })
    .sort((a, b) => a.distance - b.distance);

  return sorted[0] || null;
};

const getMarkerColor = ({ type, store, isViolation }) => {
  if (type === "pasar") return "#10B981"; // Hijau
  if (isViolation) return "#EF4444"; // Merah
  if (store === "Alfamart") return "#F59E0B"; // Oranye
  if (store === "Indomaret") return "#3B82F6"; // Biru
  return "#A855F7"; // Ungu (Lainnya)
};

// ─────────────────────────────────────────────
// 3. KOMPONEN UI PETA
// ─────────────────────────────────────────────
const MapLegend = ({ radiusMeter }) => (
  <div className="bg-surface-container-highest/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-outline-variant/20 text-on-surface">
    <h3 className="font-bold text-xs mb-2 font-headline border-b border-outline-variant/20 pb-2">
      Keterangan Peta
    </h3>
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#3B82F6]" /><span>Indomaret Aman</span></div>
      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#F59E0B]" /><span>Alfamart Aman</span></div>
      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#A855F7]" /><span>Retail Lainnya</span></div>
      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#EF4444]" /><span>Melanggar Zonasi</span></div>
      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#10B981]" /><span>Pasar Tradisional</span></div>
      <div className="flex items-center gap-2 mt-1 pt-2 border-t border-outline-variant/20">
        <div className="w-3 h-3 rounded-full border-2 border-[#10B981] border-dashed bg-[#10B981]/20" />
        <span className="text-[11px] text-on-surface-variant italic">Radius {radiusMeter}m</span>
      </div>
    </div>
  </div>
);

const MapFilterPanel = ({ radiusMeter, setRadiusMeter, selectedKecamatan, setSelectedKecamatan, selectedBrand, setSelectedBrand, selectedStatus, setSelectedStatus, search, setSearch, kecamatanOptions, summary, onReset }) => (
  <div className="bg-surface-container-highest/90 backdrop-blur-md rounded-xl shadow-lg border border-outline-variant/20 text-on-surface overflow-hidden">
    <div className="px-3 py-2.5 border-b border-outline-variant/20">
      <h3 className="text-xs font-bold uppercase tracking-widest text-white">Filter Peta</h3>
      <p className="text-[11px] text-on-surface-variant mt-0.5">{formatNumber(summary.totalShown)} titik ditampilkan</p>
    </div>
    <div className="p-3 flex flex-col gap-3">
      <div>
        <label className="text-[10px] uppercase tracking-widest text-on-surface-variant">Cari Lokasi</label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari toko / pasar" className="mt-1.5 w-full bg-slate-900/70 border border-slate-700/70 rounded-lg px-3 py-2 text-xs text-white" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5"><label className="text-[10px] uppercase tracking-widest text-on-surface-variant">Radius</label><span className="text-xs font-bold text-red-400">{radiusMeter}m</span></div>
        <input type="range" min="100" max="1000" step="50" value={radiusMeter} onChange={(e) => setRadiusMeter(Number(e.target.value))} className="w-full accent-red-500" />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-widest text-on-surface-variant">Kecamatan</label>
        <select value={selectedKecamatan} onChange={(e) => setSelectedKecamatan(e.target.value)} className="mt-1.5 w-full bg-slate-900/70 border border-slate-700/70 rounded-lg px-2 py-2 text-xs text-white">
          <option value="Semua Kecamatan">Semua Kecamatan</option>
          {kecamatanOptions.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-widest text-on-surface-variant">Brand</label>
        <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className="mt-1.5 w-full bg-slate-900/70 border border-slate-700/70 rounded-lg px-2 py-2 text-xs text-white">
          <option value="Semua Brand">Semua Brand</option>
          <option value="Indomaret">Indomaret</option>
          <option value="Alfamart">Alfamart</option>
          <option value="Lainnya">Lainnya</option>
        </select>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-widest text-on-surface-variant">Status</label>
        <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="mt-1.5 w-full bg-slate-900/70 border border-slate-700/70 rounded-lg px-2 py-2 text-xs text-white">
          <option value="Semua Status">Semua Status</option>
          <option value="Melanggar">{`Melanggar (<${radiusMeter}m)`}</option>
          <option value="Aman">{`Aman (≥${radiusMeter}m)`}</option>
        </select>
      </div>
      <button onClick={onReset} className="w-full py-2 mt-2 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-[10px] font-bold uppercase tracking-widest text-white">Reset Filter</button>
    </div>
  </div>
);

const MapSearchHandler = ({ searchQuery, locations }) => {
  const map = useMap();
  useEffect(() => {
    if (!searchQuery || locations.length === 0) return;
    const query = searchQuery.toLowerCase();
    const found = locations.find((loc) => getName(loc).toLowerCase().includes(query) || String(loc.__store).toLowerCase().includes(query) || String(loc.__district).toLowerCase().includes(query));
    if (found && isValidCoordinate(found)) map.setView([getLat(found), getLng(found)], 15, { animate: true });
  }, [searchQuery, locations, map]);
  return null;
};

const LazyLoadFeatures = ({ locations, radiusMeter }) => {
  const map = useMap();
  const [bounds, setBounds] = useState(() => map.getBounds());

  useMapEvents({
    moveend() { setBounds(map.getBounds()); },
    zoomend() { setBounds(map.getBounds()); },
  });

  const visibleLocations = useMemo(() => {
    if (!bounds) return [];
    const extendedBounds = bounds.pad(0.2);
    return locations.filter((loc) => extendedBounds.contains(L.latLng(getLat(loc), getLng(loc))));
  }, [locations, bounds]);

  return (
    <>
      {visibleLocations.map((loc) => {
        const type = loc.__type;
        const store = loc.__store;
        const district = loc.__district;
        const nearest = loc.__nearest;
        const isViolation = loc.__isViolation;
        const dotColor = getMarkerColor({ type, store, isViolation });

        return (
          <React.Fragment key={`fullmap-loc-${loc.id || `${getLat(loc)}-${getLng(loc)}`}`}>
            <CircleMarker center={[getLat(loc), getLng(loc)]} radius={type === "pasar" ? 7 : 5} pathOptions={{ color: dotColor, fillColor: dotColor, fillOpacity: 1, weight: 1 }}>
              <Popup>
                <div className="text-sm min-w-[220px]">
                  <strong>{getName(loc)}</strong><br />
                  Tipe: {type === "pasar" ? "Pasar Tradisional" : "Minimarket"}<br />
                  Kecamatan: {district}
                  {type !== "pasar" && (
                    <>
                      <br />Brand: {store}<br />Status: {isViolation ? "Melanggar ❌" : "Aman ✅"}
                      {nearest && (
                        <><br />Pasar terdekat: {getName(nearest.pasar)}<br />Jarak: {formatNumber(Math.round(nearest.distance))} meter</>
                      )}
                    </>
                  )}
                </div>
              </Popup>
            </CircleMarker>
            {type === "pasar" && <Circle center={[getLat(loc), getLng(loc)]} radius={radiusMeter} pathOptions={{ color: "#10B981", fillColor: "#10B981", fillOpacity: 0.08, weight: 1, dashArray: "5, 5" }} />}
          </React.Fragment>
        );
      })}
    </>
  );
};

// ─────────────────────────────────────────────
// 4. KOMPONEN UTAMA MAPVIEW
// ─────────────────────────────────────────────
const MapView = ({ searchQuery: externalSearchQuery = "" }) => {
  const rawLocations = useLocations();

  const [radiusMeter, setRadiusMeter] = useState(DEFAULT_RADIUS_METER);
  const [selectedKecamatan, setSelectedKecamatan] = useState("Semua Kecamatan");
  const [selectedBrand, setSelectedBrand] = useState("Semua Brand");
  const [selectedStatus, setSelectedStatus] = useState("Semua Status");
  const [internalSearch, setInternalSearch] = useState("");

  // ─ Read ?search= from URL (e.g. navigated from global search bar in Header)
  const [searchParams] = useSearchParams();
  const urlSearchQuery = searchParams.get('search') ?? '';

  // URL param takes priority over prop; both take priority over internal filter search
  const searchQuery = urlSearchQuery || externalSearchQuery || internalSearch;


  const cleanLocations = useMemo(() => {
    if (!rawLocations || rawLocations.length === 0) return [];
    return rawLocations.filter((loc) => loc && isValidCoordinate(loc));
  }, [rawLocations]);

  const pasarLocations = useMemo(() => {
    return cleanLocations.filter((loc) => getType(loc) === "pasar");
  }, [cleanLocations]);

  const enrichedLocations = useMemo(() => {
    return cleanLocations.map((loc) => {
      const type = getType(loc);
      const store = getStore(loc);
      const district = getDistrict(loc);
      const nearest = getNearestPasar(loc, pasarLocations);

      const isViolation = type !== "pasar" && nearest
        ? nearest.distance < radiusMeter
        : Boolean(loc.violation || loc.isFlagged);

      return {
        ...loc,
        __type: type,
        __store: store,
        __district: district,
        __nearest: nearest,
        __isViolation: isViolation,
      };
    });
  }, [cleanLocations, pasarLocations, radiusMeter]);

  const kecamatanOptions = useMemo(() => {
    const set = new Set();
    enrichedLocations.forEach((loc) => {
      if (loc.__district && loc.__district !== "-") set.add(loc.__district);
    });
    return Array.from(set).sort();
  }, [enrichedLocations]);

  const filteredLocations = useMemo(() => {
    return enrichedLocations.filter((loc) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!getName(loc).toLowerCase().includes(query) && !String(loc.__store).toLowerCase().includes(query) && !String(loc.__district).toLowerCase().includes(query)) return false;
      }
      if (selectedKecamatan !== "Semua Kecamatan" && loc.__district !== selectedKecamatan) return false;
      if (selectedBrand !== "Semua Brand" && loc.__type !== "pasar" && loc.__store !== selectedBrand) return false;
      if (selectedStatus === "Melanggar" && loc.__type !== "pasar" && loc.__isViolation !== true) return false;
      if (selectedStatus === "Aman" && loc.__type !== "pasar" && loc.__isViolation !== false) return false;
      return true;
    });
  }, [enrichedLocations, searchQuery, selectedKecamatan, selectedBrand, selectedStatus]);

  const summary = useMemo(() => {
    const retail = filteredLocations.filter((loc) => loc.__type !== "pasar");
    const pasar = filteredLocations.filter((loc) => loc.__type === "pasar");
    const violation = retail.filter((loc) => loc.__isViolation);
    return {
      totalShown: filteredLocations.length,
      totalRetail: retail.length,
      totalPasar: pasar.length,
      totalViolation: violation.length,
      percentViolation: retail.length > 0 ? ((violation.length / retail.length) * 100).toFixed(1) : "0.0",
    };
  }, [filteredLocations]);

  const handleResetFilter = () => {
    setRadiusMeter(DEFAULT_RADIUS_METER);
    setSelectedKecamatan("Semua Kecamatan");
    setSelectedBrand("Semua Brand");
    setSelectedStatus("Semua Status");
    setInternalSearch("");
  };

  return (
    <div className="flex flex-col w-full h-[calc(100vh-80px)] md:h-screen relative bg-surface-container-lowest">
      <div className="absolute top-4 right-4 z-[1000] w-[270px] max-h-[calc(100vh-32px)] overflow-y-auto flex flex-col gap-3">
        <MapLegend radiusMeter={radiusMeter} />
        <MapFilterPanel radiusMeter={radiusMeter} setRadiusMeter={setRadiusMeter} selectedKecamatan={selectedKecamatan} setSelectedKecamatan={setSelectedKecamatan} selectedBrand={selectedBrand} setSelectedBrand={setSelectedBrand} selectedStatus={selectedStatus} setSelectedStatus={setSelectedStatus} search={internalSearch} setSearch={setInternalSearch} kecamatanOptions={kecamatanOptions} summary={summary} onReset={handleResetFilter} />
      </div>

      <MapContainer center={[-6.25, 106.8]} zoom={13} minZoom={11} className="w-full h-full z-0" zoomControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ZoomControl position="bottomleft" />
        <MapSearchHandler searchQuery={searchQuery} locations={filteredLocations} />
        <LazyLoadFeatures locations={filteredLocations} radiusMeter={radiusMeter} />
      </MapContainer>
    </div>
  );
};

export default MapView;
