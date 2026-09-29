const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const getZoningMapPoints = async () => {
  const token = localStorage.getItem('token'); // Tambahkan token juga di sini
  const response = await fetch(`${API_BASE_URL}/zoning/points`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const json = await response.json();
  if (!response.ok) throw new Error(json.message || 'Gagal mengambil data peta');
  return json.data;
};

export const calculateZoning = async (payload) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/zoning/calculate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` // PENTING: Agar lolos middleware authenticate
    },
    body: JSON.stringify(payload)
  });

  const json = await response.json();
  if (!response.ok) throw new Error(json.message || 'Gagal menghitung zonasi');

  // Karena API kamu mengembalikan { success, message, data },
  // kita kembalikan json-nya agar Calculator.jsx bisa mengakses results.data
  return json;
};

/**
 * Memanggil endpoint AI feature-engineering.
 * POST /api/v1/ai/predict
 * Menghitung fitur kompetitor (Haversine) di backend lalu
 * meneruskannya ke Python ML service.
 * Mengembalikan { prediction, ai_recommendation } yang sudah dinormalisasi.
 */
export const predictAI = async ({ latitude, longitude }) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/ai/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ latitude, longitude }),
  });

  const json = await response.json();
  if (!response.ok) throw new Error(json.message || 'Gagal melakukan prediksi AI');

  // json.data.prediction = objek dari Python ML service
  // { is_violation, verdict, confidence_percentage, ai_recommendation? }
  const predictionObj = json?.data?.prediction ?? json?.prediction ?? {};
  const aiRec =
    predictionObj.ai_recommendation ??
    json?.data?.ai_recommendation ??
    json?.ai_recommendation ??
    null;

  return {
    prediction: predictionObj,
    ai_recommendation: aiRec,
  };
};

// // src/services/zoningApi.js

// const API_BASE_URL =
//   import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';

// export const getZoningMapPoints = async () => {
//   const response = await fetch(`${API_BASE_URL}/zoning/points`);

//   const json = await response.json();

//   if (!response.ok) {
//     throw new Error(json.message || 'Gagal mengambil data peta');
//   }

//   return json.data;
// };

// export const calculateZoning = async ({ name, latitude, longitude, radiusMeters = 500 }) => {
//   const response = await fetch(`${API_BASE_URL}/zoning/calculate`, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify({
//       name,
//       latitude: Number(latitude),
//       longitude: Number(longitude),
//       radiusMeters: Number(radiusMeters),
//     }),
//   });

//   const json = await response.json();

//   if (!response.ok) {
//     throw new Error(json.message || 'Gagal menghitung zonasi');
//   }

//   return json.data;
// };