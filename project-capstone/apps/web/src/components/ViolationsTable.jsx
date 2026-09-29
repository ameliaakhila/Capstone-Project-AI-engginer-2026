import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from '../context/AuthContext';

// 🔧 Sesuaikan URL base dengan env kamu
const API_BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api/v1`;

const ViolationsTable = ({ hideAction = false }) => {

  const navigate = useNavigate();
  const { user } = useAuth();
  
  const showAction = !hideAction && user?.isAdmin;

  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Track which row's dropdown is open (null = none)
  const [openDropdown, setOpenDropdown] = useState(null);
  const dropdownRef = useRef(null);

  // 1. FETCH DATA DARI BACKEND HANSEL
  useEffect(() => {
    const fetchRecentViolations = async () => {
      try {
        const savedUser = localStorage.getItem("user");
        const token = savedUser ? JSON.parse(savedUser)?.token : null;
        const headers = token
          ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
          : { "Content-Type": "application/json" };

        const res = await fetch(`${API_BASE}/dashboard/recent-violations`, { headers });
        if (!res.ok) throw new Error("Gagal mengambil data pelanggaran terbaru");

        const json = await res.json();

        // Pastikan data berbentuk array sebelum dimasukkan ke state
        if (json && Array.isArray(json.data)) {
          setViolations(json.data);
        } else if (Array.isArray(json)) {
          setViolations(json);
        } else {
          setViolations([]);
        }
      } catch (err) {
        console.error("❌ VIOLATIONS TABLE FETCH ERROR:", err);
        setViolations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentViolations();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleDropdown = (id) =>
    setOpenDropdown(prev => (prev === id ? null : id));

  // 🔥 HELPER LOGIK UNTUK BADGE WARNA DAN ATURAN SECARA DINAMIS
  const getStatusStyle = (distance) => {
    const distNum = Number(distance);
    if (isNaN(distNum) || distNum < 300) {
      return {
        label: "Critical",
        classes: "bg-error-container text-error outline-error/20",
        ruleColor: "bg-error",
        ruleText: `< ${isNaN(distNum) ? 300 : distNum}m from Pasar`
      };
    }
    return {
      label: "Warning",
      classes: "bg-tertiary-container/30 text-tertiary outline-tertiary/20",
      ruleColor: "bg-tertiary",
      ruleText: `< ${distNum}m from Pasar`
    };
  };

  return (
    <div className="bg-surface-container-high/70 backdrop-blur-md outline outline-1 outline-outline-variant/20 rounded-xl overflow-hidden">

      <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
        <h2 className="font-headline font-bold text-lg">Recent Violations</h2>
        <button
          onClick={() => navigate("/violations")}
          className="text-xs text-primary hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-md outline outline-1 outline-outline-variant/30 flex items-center gap-1"
        >
          View All
          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
        </button>
      </div>

      <div className="overflow-x-auto" ref={dropdownRef}>
        <table className="w-full text-left border-collapse">

          <thead>
            <tr className="text-xs text-on-surface-variant uppercase tracking-wider bg-surface-container-lowest/50">
              <th className="px-6 py-4 font-medium">ID</th>
              <th className="px-6 py-4 font-medium">Entity Name</th>
              <th className="px-6 py-4 font-medium">District</th>
              <th className="px-6 py-4 font-medium">Proximity Rule</th>
              <th className="px-6 py-4 font-medium">Status</th>
              {showAction && <th className="px-6 py-4 font-medium text-right">Action</th>}
            </tr>
          </thead>

          <tbody className="text-sm divide-y divide-outline-variant/10">
            {loading ? (
              <tr>
                <td colSpan={showAction ? 6 : 5} className="text-center py-8 text-on-surface-variant animate-pulse">
                  Menghubungkan ke server retail intelligence...
                </td>
              </tr>
            ) : violations.length === 0 ? (
              <tr>
                <td colSpan={showAction ? 6 : 5} className="text-center py-8 text-on-surface-variant">
                  Tidak ada riwayat pelanggaran zonasi yang terdeteksi.
                </td>
              </tr>
            ) : (
              /* 🔥 MAPPING DENGAN PROTEKSI TOTAL */
              violations.map((row) => {
                if (!row) return null;

                // 🛡️ 1. Proteksi ID Toko
                const displayId = row.id
                  ? (typeof row.id === 'string' ? row.id.substring(0, 6).toUpperCase() : String(row.id))
                  : "VIO";

                // 🛡️ 2. Proteksi Nama Toko (Biang kerok objek {id, name, type, address} tadi dibongkar di sini)
                let displayEntity = "-";
                if (row.name) {
                  displayEntity = typeof row.name === 'object' ? (row.name.name || row.name.nama) : row.name;
                } else if (row.entity) {
                  displayEntity = typeof row.entity === 'object' ? (row.entity.name || row.entity.nama) : row.entity;
                }

                // 🛡️ 3. Proteksi Nama Kecamatan dari objek bersarang
                let displayDistrict = "-";
                if (row.district) {
                  displayDistrict = typeof row.district === 'object' ? (row.district.name || "-") : row.district;
                } else if (row.entity && typeof row.entity === 'object' && row.entity.district) {
                  displayDistrict = typeof row.entity.district === 'object' ? (row.entity.district.name || "-") : row.entity.district;
                }

                const styleConfig = getStatusStyle(row.distanceToMarket || row.jarak || 500);

                return (
                  <tr key={row.id || displayId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-number text-on-surface-variant">#{displayId}</td>
                    <td className="px-6 py-4 font-medium text-on-surface">{String(displayEntity)}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{String(displayDistrict)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${styleConfig.ruleColor}`} />
                        <span className="font-number">{styleConfig.ruleText}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium outline outline-1 ${styleConfig.classes}`}>
                        {styleConfig.label}
                      </span>
                    </td>

                    {/* ── Action cell (hidden on Dashboard or for Non-Admins) ── */}
                    {showAction && (
                      <td className="px-6 py-4 text-right relative">
                        <button
                          onClick={() => toggleDropdown(row.id || displayId)}
                          className="text-on-surface-variant hover:text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">more_vert</span>
                        </button>

                        {openDropdown === (row.id || displayId) && (
                          <div className="absolute right-4 top-full mt-1 z-50 min-w-[160px] bg-surface-container rounded-lg shadow-xl border border-outline-variant/20 py-1 text-left">
                            <button
                              onClick={() => { navigate('/violations'); setOpenDropdown(null); }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-on-surface hover:bg-white/5 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[15px] text-on-surface-variant">open_in_new</span>
                              View Details
                            </button>

                            {user?.isAdmin && (
                              <>
                                <div className="my-1 border-t border-outline-variant/15" />
                                <button
                                  onClick={() => { alert(`Edit: #${displayId}`); setOpenDropdown(null); }}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-blue-400 hover:bg-blue-500/10 transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[15px]">edit</span>
                                  Edit
                                </button>
                                <button
                                  onClick={() => { alert(`Hapus: #${displayId}`); setOpenDropdown(null); }}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-error hover:bg-error/10 transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[15px]">delete</span>
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>

        </table>
      </div>
    </div>
  );
};

export default ViolationsTable;

// import { useNavigate } from "react-router-dom";
// import { useAuth } from '../context/AuthContext';

// // ─── Static sample data ──────────────────────────────────────────────────────
// const RECENT_ROWS = [
//   { id: 'V-8821', entity: 'Indomaret Point', district: 'Cilandak', rule: '< 400m from Pasar', ruleColor: 'bg-error', statusLabel: 'Critical', statusClass: 'bg-error-container text-error outline-error/20' },
//   { id: 'V-8820', entity: 'Alfamart Express', district: 'Tebet', rule: '< 400m from Pasar', ruleColor: 'bg-error', statusLabel: 'Critical', statusClass: 'bg-error-container text-error outline-error/20' },
//   { id: 'V-8819', entity: 'Lawson', district: 'Kebayoran Baru', rule: '< 100m from Minimarket', ruleColor: 'bg-tertiary', statusLabel: 'Warning', statusClass: 'bg-tertiary-container/30 text-tertiary outline-tertiary/20' },
//   { id: 'V-8818', entity: 'FamilyMart', district: 'Setiabudi', rule: 'Zone Capacity Exceeded', ruleColor: 'bg-tertiary', statusLabel: 'Warning', statusClass: 'bg-tertiary-container/30 text-tertiary outline-tertiary/20' },
//   { id: 'V-8817', entity: 'Circle K', district: 'Pancoran', rule: 'Resolved Post-Audit', ruleColor: 'bg-[#10B981]', statusLabel: 'Resolved', statusClass: 'bg-secondary-container text-on-surface outline-outline-variant/30' },
// ];

// // ─── Component ────────────────────────────────────────────────────────────────
// const ViolationsTable = () => {
//   const navigate = useNavigate();
//   const { user } = useAuth();

//   // Track which row's dropdown is open (null = none)
//   const [openDropdown, setOpenDropdown] = useState(null);
//   const dropdownRef = useRef(null);

//   // Close dropdown when clicking outside
//   useEffect(() => {
//     const handler = (e) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
//         setOpenDropdown(null);
//       }
//     };
//     document.addEventListener('mousedown', handler);
//     return () => document.removeEventListener('mousedown', handler);
//   }, []);

//   const toggleDropdown = (id) =>
//     setOpenDropdown(prev => (prev === id ? null : id));

//   return (
//     <div className="bg-surface-container-high/70 backdrop-blur-md outline outline-1 outline-outline-variant/20 rounded-xl overflow-hidden">

//       <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
//         <h2 className="font-headline font-bold text-lg">Recent Violations</h2>
//         <button
//           onClick={() => navigate("/violations")}
//           className="text-xs text-primary hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-md outline outline-1 outline-outline-variant/30 flex items-center gap-1"
//         >
//           View All
//           <span className="material-symbols-outlined text-[14px]">open_in_new</span>
//         </button>
//       </div>

//       <div className="overflow-x-auto" ref={dropdownRef}>
//         <table className="w-full text-left border-collapse">

//           <thead>
//             <tr className="text-xs text-on-surface-variant uppercase tracking-wider bg-surface-container-lowest/50">
//               <th className="px-6 py-4 font-medium">ID</th>
//               <th className="px-6 py-4 font-medium">Entity Name</th>
//               <th className="px-6 py-4 font-medium">District</th>
//               <th className="px-6 py-4 font-medium">Proximity Rule</th>
//               <th className="px-6 py-4 font-medium">Status</th>
//               <th className="px-6 py-4 font-medium text-right">Action</th>
//             </tr>
//           </thead>

//           <tbody className="text-sm divide-y divide-outline-variant/10">
//             {RECENT_ROWS.map((row) => (
//               <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
//                 <td className="px-6 py-4 font-number text-on-surface-variant">#{row.id}</td>
//                 <td className="px-6 py-4 font-medium text-on-surface">{row.entity}</td>
//                 <td className="px-6 py-4 text-on-surface-variant">{row.district}</td>
//                 <td className="px-6 py-4">
//                   <div className="flex items-center gap-2">
//                     <span className={`w-1.5 h-1.5 rounded-full ${row.ruleColor}`} />
//                     <span className="font-number">{row.rule}</span>
//                   </div>
//                 </td>
//                 <td className="px-6 py-4">
//                   <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium outline outline-1 ${row.statusClass}`}>
//                     {row.statusLabel}
//                   </span>
//                 </td>

//                 {/* ── Action cell with dropdown ── */}
//                 <td className="px-6 py-4 text-right relative">
//                   <button
//                     onClick={() => toggleDropdown(row.id)}
//                     className="text-on-surface-variant hover:text-primary transition-colors"
//                   >
//                     <span className="material-symbols-outlined text-lg">more_vert</span>
//                   </button>

//                   {openDropdown === row.id && (
//                     <div className="absolute right-4 top-full mt-1 z-50 min-w-[160px] bg-surface-container rounded-lg shadow-xl border border-outline-variant/20 py-1 text-left">

//                       {/* View Details — visible to ALL users */}
//                       <button
//                         onClick={() => { navigate('/violations'); setOpenDropdown(null); }}
//                         className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-on-surface hover:bg-white/5 transition-colors"
//                       >
//                         <span className="material-symbols-outlined text-[15px] text-on-surface-variant">open_in_new</span>
//                         View Details
//                       </button>

//                       {/* Edit & Delete — Admin only */}
//                       {user?.isAdmin && (
//                         <>
//                           <div className="my-1 border-t border-outline-variant/15" />
//                           <button
//                             onClick={() => { alert(`Edit: #${row.id}`); setOpenDropdown(null); }}
//                             className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-blue-400 hover:bg-blue-500/10 transition-colors"
//                           >
//                             <span className="material-symbols-outlined text-[15px]">edit</span>
//                             Edit
//                           </button>
//                           <button
//                             onClick={() => { alert(`Hapus: #${row.id}`); setOpenDropdown(null); }}
//                             className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-error hover:bg-error/10 transition-colors"
//                           >
//                             <span className="material-symbols-outlined text-[15px]">delete</span>
//                             Delete
//                           </button>
//                         </>
//                       )}

//                     </div>
//                   )}
//                 </td>
//               </tr>
//             ))}
//           </tbody>

//         </table>
//       </div>
//     </div>
//   );
// };

// export default ViolationsTable;