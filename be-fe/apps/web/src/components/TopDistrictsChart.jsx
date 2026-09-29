import React, { useState, useEffect } from 'react';

// 🔧 Sesuaikan URL base dengan env kamu
const API_BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api/v1`;

const TopDistrictsChart = () => {
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        // 1. Ambil token untuk otentikasi
        const savedUser = localStorage.getItem("user");
        const token = savedUser ? JSON.parse(savedUser)?.token : null;
        const headers = token
          ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
          : { "Content-Type": "application/json" };

        // 2. Tembak endpoint heatmap
        const res = await fetch(`${API_BASE}/dashboard/heatmap`, { headers });
        if (!res.ok) throw new Error("Gagal mengambil data heatmap");

        const json = await res.json();

        // 3. Urutkan data dari persentase tertinggi ke terendah, lalu potong ambil 5 teratas
        const sortedDistricts = json.data
          .sort((a, b) => b.saturationPercent - a.saturationPercent)
          .slice(0, 5);

        setDistricts(sortedDistricts);
      } catch (err) {
        console.error("❌ CHART FETCH ERROR:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHeatmap();
  }, []);

  // 🔥 Fungsi dinamis untuk menentukan warna bar berdasarkan angka persentase
  const getBarColor = (percent) => {
    if (percent >= 90) return "from-error-container to-error";         // Merah (Kritis)
    if (percent >= 80) return "from-tertiary-container to-tertiary";   // Ungu
    if (percent >= 60) return "from-primary-container to-primary";     // Biru
    return "from-surface-variant to-outline-variant";                  // Abu-abu (Aman)
  };

  const getTextColor = (percent) => {
    if (percent >= 90) return "text-error";
    if (percent >= 80) return "text-tertiary";
    if (percent >= 60) return "text-primary";
    return "text-on-surface-variant";
  };

  return (
    <div className="lg:col-span-4 bg-surface-container-high/70 backdrop-blur-md outline outline-1 outline-outline-variant/20 rounded-xl p-6 flex flex-col h-full">
      <h2 className="font-headline font-bold text-lg mb-6">Top Saturated Districts</h2>
      
      <div className="flex flex-col gap-5 flex-1 justify-center">
        {/* State saat loading atau data kosong */}
        {loading ? (
          <div className="text-center text-sm text-on-surface-variant animate-pulse">Memuat data metrik...</div>
        ) : districts.length === 0 ? (
          <div className="text-center text-sm text-on-surface-variant">Belum ada data kecamatan</div>
        ) : (
          /* Looping data dari database */
          districts.map((district, index) => (
            <div className="w-full" key={district.id || index}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium text-on-surface">{district.name}</span>
                <span className={`font-number font-bold ${getTextColor(district.saturationPercent)}`}>
                  {district.saturationPercent}%
                </span>
              </div>
              
              <div className="h-2 w-full bg-surface-container-lowest rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${getBarColor(district.saturationPercent)} rounded-full relative`}
                  // 🚨 PENTING: Gunakan inline style untuk width agar Tailwind tidak error
                  style={{ width: `${district.saturationPercent}%` }}
                >
                  {/* Efek shimmer menyala khusus untuk peringkat 1 (index 0) */}
                  {index === 0 && (
                    <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TopDistrictsChart;

// import React from 'react';

// const TopDistrictsChart = () => {
//   return (
//     <div className="lg:col-span-4 bg-surface-container-high/70 backdrop-blur-md outline outline-1 outline-outline-variant/20 rounded-xl p-6 flex flex-col h-full">
//       <h2 className="font-headline font-bold text-lg mb-6">Top Saturated Districts</h2>
//       <div className="flex flex-col gap-5 flex-1 justify-center">
//         <div className="w-full">
//           <div className="flex justify-between text-xs mb-1.5">
//             <span className="font-medium text-on-surface">Cilandak</span>
//             <span className="font-number text-tertiary font-bold">98%</span>
//           </div>
//           <div className="h-2 w-full bg-surface-container-lowest rounded-full overflow-hidden">
//             <div className="h-full bg-gradient-to-r from-tertiary-container to-tertiary w-[98%] rounded-full relative">
//               <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
//             </div>
//           </div>
//         </div>
        
//         <div className="w-full">
//           <div className="flex justify-between text-xs mb-1.5">
//             <span className="font-medium text-on-surface">Tebet</span>
//             <span className="font-number text-error font-bold">92%</span>
//           </div>
//           <div className="h-2 w-full bg-surface-container-lowest rounded-full overflow-hidden">
//             <div className="h-full bg-gradient-to-r from-error-container to-error w-[92%] rounded-full relative"></div>
//           </div>
//         </div>
        
//         <div className="w-full">
//           <div className="flex justify-between text-xs mb-1.5">
//             <span className="font-medium text-on-surface">Kebayoran Baru</span>
//             <span className="font-number text-primary font-bold">85%</span>
//           </div>
//           <div className="h-2 w-full bg-surface-container-lowest rounded-full overflow-hidden">
//             <div className="h-full bg-gradient-to-r from-primary-container to-primary w-[85%] rounded-full relative"></div>
//           </div>
//         </div>
        
//         <div className="w-full">
//           <div className="flex justify-between text-xs mb-1.5">
//             <span className="font-medium text-on-surface">Pancoran</span>
//             <span className="font-number text-primary-fixed-dim font-bold">78%</span>
//           </div>
//           <div className="h-2 w-full bg-surface-container-lowest rounded-full overflow-hidden">
//             <div className="h-full bg-gradient-to-r from-primary-container/50 to-primary/80 w-[78%] rounded-full relative"></div>
//           </div>
//         </div>
        
//         <div className="w-full">
//           <div className="flex justify-between text-xs mb-1.5">
//             <span className="font-medium text-on-surface">Setiabudi</span>
//             <span className="font-number text-on-surface-variant font-bold">65%</span>
//           </div>
//           <div className="h-2 w-full bg-surface-container-lowest rounded-full overflow-hidden">
//             <div className="h-full bg-surface-variant w-[65%] rounded-full relative"></div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default TopDistrictsChart;
