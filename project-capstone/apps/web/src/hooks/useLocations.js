import { useState, useEffect } from 'react';

// API_BASE: empty string in production (same-origin, proxied by Nginx), localhost for local dev
const API_BASE = `${import.meta.env.VITE_API_URL ?? ""}/api/v1`;

export const useLocations = () => {
    const [locations, setLocations] = useState([]);

    useEffect(() => {
        const fetchPoints = async () => {
            try {
                const savedUser = localStorage.getItem("user");
                const token = savedUser ? JSON.parse(savedUser)?.token : null;

                const response = await fetch(`${API_BASE}/zoning/points`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });

                const json = await response.json();

                if (json.success && json.data) {
                    // Kita pakai logika mapping dari kodingan lama agar data "nyambung" ke Peta
                    const rawPoints = json.data.points || json.data; // Jaga-jaga jika strukturnya beda

                    const cleanedData = rawPoints.map((item) => {
                        const lat = parseFloat(item.latitude);
                        const lng = parseFloat(item.longitude);

                        if (isNaN(lat) || isNaN(lng)) return null;

                        return {
                            id: item.id,
                            nama: item.name,           // Map ke 'nama' yang diminta Peta
                            lat: lat,                  // Map ke 'lat' yang diminta Peta
                            lng: lng,                  // Map ke 'lng' yang diminta Peta
                            type: item.type ? item.type.toLowerCase() : "retail",
                            kecamatan: item.district?.name || "-",
                            violation: item.isFlagged
                        };
                    }).filter(Boolean); // Hapus yang null

                    setLocations(cleanedData);
                }
            } catch (err) {
                console.error("❌ MAP FETCH ERROR:", err);
            }
        };

        fetchPoints();
    }, []);

    return locations;
};

// import { useEffect, useState } from "react";

// // 🔧 Sesuaikan URL base dengan env kamu
// const API_BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api/v1`;

// export const useLocations = () => {
//     const [locations, setLocations] = useState([]);

//     useEffect(() => {
//         const fetchLocations = async () => {
//             try {
//                 // 1. Ambil token untuk Authorization
//                 const savedUser = localStorage.getItem("user");
//                 const token = savedUser ? JSON.parse(savedUser)?.token : null;
//                 const headers = token
//                     ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
//                     : { "Content-Type": "application/json" };

//                 // 2. Tembak endpoint Map Entities (sesuai Postman Hansel)
//                 const res = await fetch(`${API_BASE}/dashboard/map-entities`, { headers });

//                 if (!res.ok) throw new Error("Gagal mengambil data peta dari server");

//                 const json = await res.json();

//                 // 3. Mapping data dari Backend agar cocok dengan MapSection.jsx
//                 const cleanedData = json.data.map((item) => {
//                     const lat = parseFloat(item.latitude);
//                     const lng = parseFloat(item.longitude);

//                     // Buang titik yang kordinatnya error/kosong
//                     if (isNaN(lat) || isNaN(lng)) return null;

//                     return {
//                         id: item.id,
//                         nama: item.name,          // Backend: 'name' -> Frontend: 'nama'
//                         lat: lat,                 // Backend: 'latitude' -> Frontend: 'lat'
//                         lng: lng,                 // Backend: 'longitude' -> Frontend: 'lng'

//                         // Backend mengirim "MINIMARKET" / "PASAR".
//                         // Kita jadikan huruf kecil agar cocok dengan logika loc.type === "pasar" di MapSection
//                         type: item.type ? item.type.toLowerCase() : "retail",

//                         kecamatan: item.district?.name || "-",
//                         violation: item.isFlagged // Mengambil status pelanggaran dari backend
//                     };
//                 }).filter(Boolean); // Hapus array yang bernilai null

//                 // 4. Update state peta
//                 setLocations(cleanedData);

//             } catch (err) {
//                 console.error("❌ MAP FETCH ERROR:", err);
//             }
//         };

//         fetchLocations();
//     }, []);

//     return locations;
// };