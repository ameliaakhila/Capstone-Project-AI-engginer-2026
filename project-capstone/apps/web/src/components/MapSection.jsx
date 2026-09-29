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
import * as turf from "@turf/turf";
import { useLocations } from "../hooks/useLocations";

// 🔥 KOMPONEN KETERANGAN (LEGEND) KHUSUS DASHBOARD (Lebih Compact)
const MapLegendDashboard = () => {
  return (
    <div className="absolute top-16 right-4 z-[1000] bg-surface-container-highest/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-outline-variant/20 text-on-surface">
      <h3 className="font-bold text-xs mb-2 font-headline border-b border-outline-variant/20 pb-1">
        Keterangan
      </h3>
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#3B82F6] shadow-sm"></span>
          <span>Retail Aman</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#F59E0B] shadow-sm"></span>
          <span>Alfamart Aman</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#EF4444] shadow-sm"></span>
          <span>Melanggar (Zona 500m)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#10B981] shadow-sm"></span>
          <span>Pasar Tradisional</span>
        </div>
        <div className="flex items-center gap-2 mt-1 pt-1 border-t border-outline-variant/20">
          <div className="w-3 h-3 rounded-full border-2 border-[#10B981] border-dashed bg-[#10B981]/20"></div>
          <span className="text-[10px] text-on-surface-variant italic">Radius 500m</span>
        </div>
      </div>
    </div>
  );
};

// 🔥 SEARCH HANDLER
const MapSearchHandler = ({ searchQuery, locations }) => {
  const map = useMap();

  useEffect(() => {
    if (!searchQuery || locations.length === 0) return;

    const found = locations.find(
      (loc) =>
        loc.nama?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !isNaN(Number(loc.lat)) &&
        !isNaN(Number(loc.lng))
    );

    if (found) {
      map.setView([Number(found.lat), Number(found.lng)], 15, {
        animate: true,
      });
    }
  }, [searchQuery, locations, map]);

  return null;
};

// 🔥 HELPER FUNCTIONS UNTUK HITUNG JARAK & OVERLAP
const createCircle = (lat, lng) => {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (isNaN(latNum) || isNaN(lngNum)) return null;
  return turf.circle([lngNum, latNum], 0.5, { units: "kilometers", steps: 64 });
};

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const checkOverlap = (loc1, loc2) => {
  if (
    isNaN(Number(loc1.lat)) ||
    isNaN(Number(loc1.lng)) ||
    isNaN(Number(loc2.lat)) ||
    isNaN(Number(loc2.lng))
  ) return false;
  
  return getDistance(Number(loc1.lat), Number(loc1.lng), Number(loc2.lat), Number(loc2.lng)) < 500;
};

// 🔥 OPTIMASI RENDERING & ZONING SMART HIGHLIGHT
const LazyLoadFeatures = ({ locations }) => {
  const map = useMap();
  const [bounds, setBounds] = useState(() => map.getBounds());

  useMapEvents({
    moveend() { setBounds(map.getBounds()); },
    zoomend() { setBounds(map.getBounds()); },
  });

  const visibleLocations = useMemo(() => {
    if (!bounds) return [];
    const extendedBounds = bounds.pad(0.2);
    return locations.filter((loc) => {
      const latLng = L.latLng(Number(loc.lat), Number(loc.lng));
      return extendedBounds.contains(latLng);
    });
  }, [locations, bounds]);

  return (
    <>
      {visibleLocations.map((loc) => {
        const isOverlapping = visibleLocations.some((other) => {
          if (other.id === loc.id) return false;
          // 🔥 Logika Pelanggaran: Jika dia BUKAN pasar, dan ada dalam radius pasar lain
          if (loc.type !== "pasar" && other.type === "pasar") {
            return checkOverlap(loc, other);
          }
          return false;
        });

        // Logika Warna
        let dotColor = "#3B82F6"; // Biru
        if (isOverlapping && loc.type !== "pasar") dotColor = "#EF4444"; // Merah (Melanggar)
        else if (loc.type === "pasar") dotColor = "#10B981"; // Hijau
        else if (loc.nama?.toLowerCase().includes("alfamart")) dotColor = "#F59E0B"; // Orange

        return (
          <React.Fragment key={`dash-loc-${loc.id || Math.random()}`}>
            {/* TITIK KECIL */}
            <CircleMarker
              center={[Number(loc.lat), Number(loc.lng)]}
              radius={5}
              pathOptions={{
                color: dotColor,
                fillColor: dotColor,
                fillOpacity: 1,
                weight: 1,
              }}
            >
              <Popup>
                <strong>{loc.nama}</strong>
                <br />
                Tipe: {loc.type === "pasar" ? "Pasar Tradisional" : "Minimarket"}
                <br />
                Status: {isOverlapping && loc.type !== "pasar" ? "Violation ❌" : "Safe ✅"}
              </Popup>
            </CircleMarker>

            {/* RADIUS 500M KHUSUS PASAR */}
            {loc.type === "pasar" && (
              <Circle
                center={[Number(loc.lat), Number(loc.lng)]}
                radius={500}
                pathOptions={{
                  color: "#10B981",
                  fillColor: "#10B981",
                  fillOpacity: 0.08,
                  weight: 1,
                  dashArray: "5, 5"
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

// 🔥 MAIN COMPONENT
const MapSection = ({ searchQuery }) => {
  const rawLocations = useLocations();

  const locations = useMemo(() => {
    return rawLocations.filter(
      (loc) => loc && !isNaN(Number(loc.lat)) && !isNaN(Number(loc.lng))
    );
  }, [rawLocations]);

  return (
    <div className="lg:col-span-8 flex flex-col gap-6">
      <div className="bg-surface-container-high/70 backdrop-blur-md outline outline-1 outline-outline-variant/20 rounded-xl overflow-hidden h-[400px] flex flex-col relative">
        
        {/* HEADER DASHBOARD MAP */}
        <div className="p-5 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-highest/50 absolute top-0 w-full z-20 backdrop-blur-sm">
          <h2 className="font-headline font-bold text-lg">
            Jakarta Selatan Heatmap
          </h2>
        </div>

        {/* MAP CONTAINER */}
        <div className="flex-1 relative overflow-hidden">
          
          {/* RENDER KETERANGAN (LEGEND) */}
          <MapLegendDashboard />

          <MapContainer
            center={[-6.25, 106.8]}
            zoom={13}
            minZoom={11}
            className="h-full w-full z-0 pt-[60px]" // Tambah padding top biar ngga ketutup header
            zoomControl={false} // Matikan zoom default
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            
            {/* Tombol zoom di dashboard dipindah ke pojok kanan bawah agar aman */}
            <ZoomControl position="bottomright" />
            
            <MapSearchHandler searchQuery={searchQuery} locations={locations} />
            <LazyLoadFeatures locations={locations} />
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default MapSection;

// import React, { useEffect, useMemo, useState } from "react";
// import {
//   MapContainer,
//   TileLayer,
//   Marker,
//   Popup,
//   Circle,
//   GeoJSON,
//   useMap,
//   useMapEvents,
// } from "react-leaflet";
// import L from "leaflet"; // Tambahan import leaflet untuk deteksi kordinat layar
// import "leaflet/dist/leaflet.css";
// import * as turf from "@turf/turf";
// import { useLocations } from "../hooks/useLocations";

// // 🔥 SEARCH HANDLER (AMAN)
// const MapSearchHandler = ({ searchQuery, locations }) => {
//   const map = useMap();

//   useEffect(() => {
//     if (!searchQuery || locations.length === 0) return;

//     const found = locations.find(
//       (loc) =>
//         loc.nama?.toLowerCase().includes(searchQuery.toLowerCase()) &&
//         !isNaN(Number(loc.lat)) &&
//         !isNaN(Number(loc.lng))
//     );

//     if (found) {
//       map.setView([Number(found.lat), Number(found.lng)], 15, {
//         animate: true,
//       });
//     }
//   }, [searchQuery, locations, map]);

//   return null;
// };

// // 🔥 SAFE CREATE CIRCLE (ANTI ERROR TURF)
// const createCircle = (lat, lng) => {
//   const latNum = Number(lat);
//   const lngNum = Number(lng);

//   if (isNaN(latNum) || isNaN(lngNum)) {
//     console.warn("INVALID COORD:", lat, lng);
//     return null;
//   }

//   return turf.circle([lngNum, latNum], 0.6, {
//     units: "kilometers",
//     steps: 64,
//   });
// };

// // 🔥 HITUNG OVERLAP (SAFE)
// const getIntersection = (loc1, loc2) => {
//   const c1 = createCircle(loc1.lat, loc1.lng);
//   const c2 = createCircle(loc2.lat, loc2.lng);

//   if (!c1 || !c2) return null;
//   if (!c1.geometry || !c2.geometry) return null;

//   try {
//     return turf.intersect(c1, c2);
//   } catch {
//     return null;
//   }
// };

// // 🔥 HITUNG JARAK (TETAP)
// const getDistance = (lat1, lon1, lat2, lon2) => {
//   const R = 6371000;
//   const toRad = (x) => (x * Math.PI) / 180;

//   const dLat = toRad(lat2 - lat1);
//   const dLon = toRad(lon2 - lon1);

//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos(toRad(lat1)) *
//     Math.cos(toRad(lat2)) *
//     Math.sin(dLon / 2) ** 2;

//   return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// };

// // 🔥 CEK OVERLAP (AMAN)
// const checkOverlap = (loc1, loc2) => {
//   if (
//     isNaN(Number(loc1.lat)) ||
//     isNaN(Number(loc1.lng)) ||
//     isNaN(Number(loc2.lat)) ||
//     isNaN(Number(loc2.lng))
//   ) {
//     return false;
//   }

//   const distance = getDistance(
//     Number(loc1.lat),
//     Number(loc1.lng),
//     Number(loc2.lat),
//     Number(loc2.lng)
//   );

//   return distance < 1000;
// };

// // 🔥 OPTIMASI RENDERING: LAZY LOAD FEATURES
// // Komponen ini HANYA merender elemen yang ada di dalam kotak layar monitor (Viewport)
// const LazyLoadFeatures = ({ locations }) => {
//   const map = useMap();
//   const [bounds, setBounds] = useState(() => map.getBounds());

//   // Update area layar (bounds) setiap kali map digeser atau di-zoom
//   useMapEvents({
//     moveend() {
//       setBounds(map.getBounds());
//     },
//     zoomend() {
//       setBounds(map.getBounds());
//     },
//   });

//   // 1. FILTER LOKASI: Buang titik yang ada di luar layar dari render list
//   const visibleLocations = useMemo(() => {
//     if (!bounds) return [];
    
//     // pad(0.2) melebarkan area deteksi sedikit ke luar layar sebesar 20%
//     // Supaya saat kita geser pelan-pelan, markernya ngga pop-in secara mendadak
//     const extendedBounds = bounds.pad(0.2);

//     return locations.filter((loc) => {
//       const latLng = L.latLng(Number(loc.lat), Number(loc.lng));
//       return extendedBounds.contains(latLng);
//     });
//   }, [locations, bounds]);

//   // 2. HITUNG OVERLAP HANYA UNTUK YANG DI LAYAR
//   // Ini bikin performa ngebut banget, karena kamu ngga ngehitung ribuan overlap
//   // untuk lokasi yang bahkan ngga diliat user.
//   const visibleOverlaps = useMemo(() => {
//     const result = [];
//     for (let i = 0; i < visibleLocations.length; i++) {
//       for (let j = i + 1; j < visibleLocations.length; j++) {
//         const inter = getIntersection(visibleLocations[i], visibleLocations[j]);
//         if (inter) result.push(inter);
//       }
//     }
//     return result;
//   }, [visibleLocations]);

//   return (
//     <>
//       {visibleLocations.map((loc) => {
//         const isOverlapping = visibleLocations.some((other) => {
//           if (other.id === loc.id) return false;
//           if (loc.type === "retail" && other.type === "pasar") {
//             return checkOverlap(loc, other);
//           }
//           return false;
//         });

//         return (
//           <React.Fragment key={`loc-${loc.id || Math.random()}`}>
//             <Marker position={[Number(loc.lat), Number(loc.lng)]}>
//               <Popup>
//                 <strong>{loc.nama}</strong>
//                 <br />
//                 {loc.type}
//                 <br />
//                 Status: {isOverlapping ? "Violation ❌" : "Safe ✅"}
//               </Popup>
//             </Marker>

//             <Circle
//               center={[Number(loc.lat), Number(loc.lng)]}
//               radius={500}
//               pathOptions={{
//                 color:
//                   loc.type === "pasar"
//                     ? "blue"
//                     : isOverlapping
//                     ? "red"
//                     : "green",
//                 fillOpacity: 0.15,
//               }}
//             />
//           </React.Fragment>
//         );
//       })}

//       {visibleOverlaps.map((area, idx) => (
//         <GeoJSON
//           key={`overlap-${idx}`}
//           data={area}
//           style={{
//             color: "yellow",
//             fillColor: "yellow",
//             fillOpacity: 0.8,
//           }}
//         />
//       ))}
//     </>
//   );
// };

// // 🔥 MAIN COMPONENT
// const MapSection = ({ searchQuery }) => {
//   const rawLocations = useLocations();

//   // 🔥 CLEAN DATA (PENTING BANGET)
//   const locations = useMemo(() => {
//     return rawLocations.filter(
//       (loc) => loc && !isNaN(Number(loc.lat)) && !isNaN(Number(loc.lng))
//     );
//   }, [rawLocations]);

//   return (
//     <div className="lg:col-span-8 flex flex-col gap-6">
//       <div className="bg-surface-container-high/70 backdrop-blur-md outline outline-1 outline-outline-variant/20 rounded-xl overflow-hidden h-[400px] flex flex-col relative">
//         {/* HEADER */}
//         <div className="p-5 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-highest/50 absolute top-0 w-full z-20 backdrop-blur-sm">
//           <h2 className="font-headline font-bold text-lg">
//             Jakarta Selatan Heatmap
//           </h2>
//         </div>

//         {/* MAP */}
//         <div className="flex-1 relative overflow-hidden">
//           <MapContainer
//             // OPTIMASI: Default zoom diubah jadi 15 supaya masuk-masuk langsung nge-zoom in ke area kecil
//             center={[-6.25, 106.8]}
//             zoom={15} 
//             // OPTIMASI: Membatasi zoom out maksimal di level 12 supaya titik ngga menumpuk se-Jabar
//             minZoom={12} 
//             className="h-full w-full z-0"
//           >
//             <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

//             {/* SEARCH */}
//             <MapSearchHandler searchQuery={searchQuery} locations={locations} />

//             {/* 🔥 RENDER KOMPONEN OPTIMASI LAZY LOAD */}
//             <LazyLoadFeatures locations={locations} />

//           </MapContainer>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default MapSection;






////INI KODE LAMA YANG BUG
// import React, { useEffect, useMemo } from "react";
// import {
//   MapContainer,
//   TileLayer,
//   Marker,
//   Popup,
//   Circle,
//   GeoJSON,
//   useMap,
// } from "react-leaflet";
// import "leaflet/dist/leaflet.css";
// import * as turf from "@turf/turf";
// import { useLocations } from "../hooks/useLocations";


// // 🔥 SEARCH HANDLER (AMAN)
// const MapSearchHandler = ({ searchQuery, locations }) => {
//   const map = useMap();

//   useEffect(() => {
//     if (!searchQuery || locations.length === 0) return;

//     const found = locations.find(
//       (loc) =>
//         loc.nama?.toLowerCase().includes(searchQuery.toLowerCase()) &&
//         !isNaN(Number(loc.lat)) &&
//         !isNaN(Number(loc.lng))
//     );

//     if (found) {
//       map.setView([Number(found.lat), Number(found.lng)], 15, {
//         animate: true,
//       });
//     }
//   }, [searchQuery, locations, map]);

//   return null;
// };


// // 🔥 SAFE CREATE CIRCLE (ANTI ERROR TURF)
// const createCircle = (lat, lng) => {
//   const latNum = Number(lat);
//   const lngNum = Number(lng);

//   if (isNaN(latNum) || isNaN(lngNum)) {
//     console.warn("INVALID COORD:", lat, lng);
//     return null;
//   }

//   return turf.circle([lngNum, latNum], 0.6, {
//     units: "kilometers",
//     steps: 64,
//   });
// };


// // 🔥 HITUNG OVERLAP (SAFE)
// const getIntersection = (loc1, loc2) => {
//   const c1 = createCircle(loc1.lat, loc1.lng);
//   const c2 = createCircle(loc2.lat, loc2.lng);

//   if (!c1 || !c2) return null;
//   if (!c1.geometry || !c2.geometry) return null;

//   try {
//     return turf.intersect(c1, c2);
//   } catch {
//     return null;
//   }
// };


// // 🔥 HITUNG JARAK (TETAP)
// const getDistance = (lat1, lon1, lat2, lon2) => {
//   const R = 6371000;
//   const toRad = (x) => (x * Math.PI) / 180;

//   const dLat = toRad(lat2 - lat1);
//   const dLon = toRad(lon2 - lon1);

//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos(toRad(lat1)) *
//     Math.cos(toRad(lat2)) *
//     Math.sin(dLon / 2) ** 2;

//   return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// };


// // 🔥 CEK OVERLAP (AMAN)
// const checkOverlap = (loc1, loc2) => {
//   if (
//     isNaN(Number(loc1.lat)) ||
//     isNaN(Number(loc1.lng)) ||
//     isNaN(Number(loc2.lat)) ||
//     isNaN(Number(loc2.lng))
//   ) {
//     return false;
//   }

//   const distance = getDistance(
//     Number(loc1.lat),
//     Number(loc1.lng),
//     Number(loc2.lat),
//     Number(loc2.lng)
//   );

//   return distance < 1000;
// };


// // 🔥 MAIN COMPONENT
// const MapSection = ({ searchQuery }) => {
//   const rawLocations = useLocations();

//   // 🔥 CLEAN DATA (PENTING BANGET)
//   const locations = useMemo(() => {
//     return rawLocations.filter(
//       (loc) =>
//         loc &&
//         !isNaN(Number(loc.lat)) &&
//         !isNaN(Number(loc.lng))
//     );
//   }, [rawLocations]);

//   console.log("CLEAN LOCATIONS:", locations);

//   // 🔥 HITUNG OVERLAP AREA (SAFE)
//   const overlaps = useMemo(() => {
//     const result = [];

//     for (let i = 0; i < locations.length; i++) {
//       for (let j = i + 1; j < locations.length; j++) {
//         const inter = getIntersection(locations[i], locations[j]);
//         if (inter) result.push(inter);
//       }
//     }

//     return result;
//   }, [locations]);

//   console.log("OVERLAPS LENGTH:", overlaps.length);

//   return (
//     <div className="lg:col-span-8 flex flex-col gap-6">
//       <div className="bg-surface-container-high/70 backdrop-blur-md outline outline-1 outline-outline-variant/20 rounded-xl overflow-hidden h-[400px] flex flex-col relative">

//         {/* HEADER */}
//         <div className="p-5 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-highest/50 absolute top-0 w-full z-20 backdrop-blur-sm">
//           <h2 className="font-headline font-bold text-lg">
//             Jakarta Selatan Heatmap
//           </h2>
//         </div>

//         {/* MAP */}
//         <div className="flex-1 relative overflow-hidden">
//           <MapContainer
//             center={[-6.25, 106.8]}
//             zoom={13}
//             className="h-full w-full z-0"
//           >
//             <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

//             {/* SEARCH */}
//             <MapSearchHandler
//               searchQuery={searchQuery}
//               locations={locations}
//             />

//             {/* MARKER + CIRCLE */}
//             {locations.map((loc) => {
//               const isOverlapping = locations.some((other) => {
//                 if (other.id === loc.id) return false;

//                 if (loc.type === "retail" && other.type === "pasar") {
//                   return checkOverlap(loc, other);
//                 }

//                 return false;
//               });

//               return (
//                 <React.Fragment key={loc.id}>
//                   <Marker position={[Number(loc.lat), Number(loc.lng)]}>
//                     <Popup>
//                       <strong>{loc.nama}</strong>
//                       <br />
//                       {loc.type}
//                       <br />
//                       Status: {isOverlapping ? "Violation ❌" : "Safe ✅"}
//                     </Popup>
//                   </Marker>

//                   <Circle
//                     center={[Number(loc.lat), Number(loc.lng)]}
//                     radius={500}
//                     pathOptions={{
//                       color:
//                         loc.type === "pasar"
//                           ? "blue"
//                           : isOverlapping
//                             ? "red"
//                             : "green",
//                       fillOpacity: 0.15,
//                     }}
//                   />
//                 </React.Fragment>
//               );
//             })}

//             {/* OVERLAP AREA */}
//             {overlaps.map((area, idx) => (
//               <GeoJSON
//                 key={idx}
//                 data={area}
//                 style={{
//                   color: "yellow",
//                   fillColor: "yellow",
//                   fillOpacity: 0.8,
//                 }}
//               />
//             ))}
//           </MapContainer>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default MapSection;