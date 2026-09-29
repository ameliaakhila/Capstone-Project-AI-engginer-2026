import { Router } from 'express';
import axios from 'axios';
import prisma from '../config/database.js';
import {
  haversineDistanceMeters,
  isValidLatitude,
  isValidLongitude,
  findAlternativeLocation,
} from '../utils/geo.util.js';

const router = Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL;

const COMPETITOR_RADIUS_METERS = 500;
const HEAD_TO_HEAD_RADIUS_METERS = 50;

const COMPETITOR_KEYWORDS = [
  'MINIMARKET',
  'MINI_MARKET',
  'RETAIL',
  'STORE',
  'TOKO',
  'MART',
  'ALFAMART',
  'INDOMARET',
  'ALFAMIDI',
  'LAWSON',
  'FAMILYMART',
  'CIRCLE K',
];

function roundNumber(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

function stringifyValue(value) {
  if (value === null || value === undefined) return '';

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  return String(value);
}

function isRetailCompetitor(entity) {
  const text = [
    stringifyValue(entity.name),
    stringifyValue(entity.type),
    stringifyValue(entity.store),
  ]
    .join(' ')
    .toUpperCase();

  return COMPETITOR_KEYWORDS.some((keyword) => text.includes(keyword));
}

function deriveClusterFeatures({ competitorDensity, jarakKompetitor, nearestDistrict }) {
  const saturationPercent = nearestDistrict?.saturationPercent ?? null;
  const districtStatus = nearestDistrict?.status ?? null;

  let cluster_macro = 1;
  let cluster_hotspot = -1;
  let is_hotspot = 0;

  /**
   * Prioritas 1:
   * Jika data district punya saturationPercent/status,
   * gunakan itu sebagai dasar fitur klaster.
   */
  if (saturationPercent !== null && saturationPercent !== undefined) {
    if (saturationPercent >= 80) {
      cluster_macro = 4;
      cluster_hotspot = 1;
      is_hotspot = 1;
    } else if (saturationPercent >= 60) {
      cluster_macro = 3;
      cluster_hotspot = 1;
      is_hotspot = 1;
    } else if (saturationPercent >= 40) {
      cluster_macro = 2;
      cluster_hotspot = 0;
      is_hotspot = 0;
    } else {
      cluster_macro = 1;
      cluster_hotspot = -1;
      is_hotspot = 0;
    }
  }

  /**
   * Prioritas 2:
   * Jika status district CRITICAL/WARNING,
   * anggap area sebagai hotspot.
   */
  if (districtStatus === 'CRITICAL') {
    cluster_macro = 4;
    cluster_hotspot = 1;
    is_hotspot = 1;
  }

  if (districtStatus === 'WARNING') {
    cluster_macro = Math.max(cluster_macro, 3);
    cluster_hotspot = 1;
    is_hotspot = 1;
  }

  /**
   * Fallback:
   * Jika belum ada data district/cluster,
   * gunakan kepadatan kompetitor sebagai pendekatan sementara.
   */
  if (!nearestDistrict) {
    if (competitorDensity >= 8) {
      cluster_macro = 4;
      cluster_hotspot = 1;
      is_hotspot = 1;
    } else if (competitorDensity >= 5) {
      cluster_macro = 3;
      cluster_hotspot = 1;
      is_hotspot = 1;
    } else if (competitorDensity >= 2) {
      cluster_macro = 2;
      cluster_hotspot = 0;
      is_hotspot = 0;
    } else {
      cluster_macro = 1;
      cluster_hotspot = -1;
      is_hotspot = 0;
    }
  }

  /**
   * Jika jarak kompetitor terlalu dekat,
   * area tetap dianggap berisiko hotspot.
   */
  if (jarakKompetitor <= HEAD_TO_HEAD_RADIUS_METERS) {
    is_hotspot = 1;
    cluster_hotspot = 1;
    cluster_macro = Math.max(cluster_macro, 3);
  }

  return {
    cluster_macro,
    cluster_hotspot,
    is_hotspot,
  };
}

async function buildPredictionFeatures(latitude, longitude) {
  const entities = await prisma.entity.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      store: true,
      latitude: true,
      longitude: true,
      district: {
        select: {
          id: true,
          name: true,
          status: true,
          saturationPercent: true,
        },
      },
    },
  });

  // filter secara manual di JS supaya latitude & longitude valid
  const validEntities = entities.filter(
    (e) =>
      typeof e.latitude === 'number' &&
      !isNaN(e.latitude) &&
      typeof e.longitude === 'number' &&
      !isNaN(e.longitude)
  );

  const competitors = entities
    .filter((entity) => {
      const entityLat = Number(entity.latitude);
      const entityLng = Number(entity.longitude);

      return (
        isValidLatitude(entityLat) &&
        isValidLongitude(entityLng) &&
        isRetailCompetitor(entity)
      );
    })
    .map((entity) => {
      const entityLat = Number(entity.latitude);
      const entityLng = Number(entity.longitude);

      const distanceMeters = haversineDistanceMeters(
        latitude,
        longitude,
        entityLat,
        entityLng
      );

      return {
        entity,
        distanceMeters,
      };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const competitorsWithinRadius = competitors.filter(
    (item) => item.distanceMeters <= COMPETITOR_RADIUS_METERS
  );

  const nearestCompetitor = competitors[0] || null;

  const competitor_density = competitorsWithinRadius.length;

  const jarak_kompetitor = nearestCompetitor
    ? roundNumber(nearestCompetitor.distanceMeters, 2)
    : 999999;

  const head_to_head =
    nearestCompetitor && nearestCompetitor.distanceMeters <= HEAD_TO_HEAD_RADIUS_METERS
      ? 1
      : 0;

  const nearestDistrict = nearestCompetitor?.entity?.district || null;

  const clusterFeatures = deriveClusterFeatures({
    competitorDensity: competitor_density,
    jarakKompetitor: jarak_kompetitor,
    nearestDistrict,
  });

  return {
    latitude,
    longitude,
    competitor_density,
    jarak_kompetitor,
    head_to_head,
    cluster_macro: clusterFeatures.cluster_macro,
    cluster_hotspot: clusterFeatures.cluster_hotspot,
    is_hotspot: clusterFeatures.is_hotspot,
  };
}

// POST /api/v1/ai/predict
// POST /api/v1/ai/predict
// POST /api/v1/ai/predict
router.post('/predict', async (req, res, next) => {
  try {
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);

    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      return res.status(400).json({ success: false, message: 'Latitude dan longitude tidak valid' });
    }

    const features = await buildPredictionFeatures(latitude, longitude);

    // 1. Ambil data pasar secara agresif
    const semuaEntity = await prisma.entity.findMany();
    const pasarEntities = semuaEntity.filter(e =>
      (e.type && String(e.type).toUpperCase() === 'PASAR') ||
      (e.store && String(e.store).toUpperCase().includes('PASAR')) ||
      (e.name && String(e.name).toUpperCase().includes('PASAR'))
    );

    // 2. BUNGKUS KE DALAM OBJEK (Sesuai ekspektasi Front-End)
    let finalAIObject = {
      prediction: 'AMAN',
      ai_recommendation: 'Lokasi aman dari pelanggaran zonasi.'
    };

    // Panggil AI service — jika gagal (timeout, sleep, dll), lanjut dengan guardrail lokal
    try {
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/api/zonasi/predict`, features, { timeout: 120000 });
      if (aiResponse.data && typeof aiResponse.data === 'object') {
        finalAIObject.prediction = aiResponse.data.prediction || 'AMAN';
        finalAIObject.ai_recommendation = aiResponse.data.ai_recommendation || 'Aman';
      }
    } catch (aiErr) {
      console.warn('⚠️  AI service unreachable, using local guardrail fallback.');
      console.warn('   reason:', aiErr.code || aiErr.message);
    }

    // 3. HITUNG JARAK MUTLAK
    if (pasarEntities.length === 0) {
      // Jika database benar-benar kosong
      finalAIObject.prediction = "MELANGGAR";
      finalAIObject.ai_recommendation = "🚨 ERROR BACKEND: Data Pasar KOSONG di Database! Tolong pastikan database sudah di-seed.";
    } else {
      let jarakTerdekat = 999999;
      let namaPasarTerdekat = '';

      for (const pasar of pasarEntities) {
        const latPasar = Number(pasar.latitude);
        const lonPasar = Number(pasar.longitude);

        if (isValidLatitude(latPasar) && isValidLongitude(lonPasar)) {
          const jarak = haversineDistanceMeters(latitude, longitude, latPasar, lonPasar);
          if (jarak < jarakTerdekat) {
            jarakTerdekat = jarak;
            namaPasarTerdekat = pasar.name;
          }
        }
      }

      // 4. GUARDRAIL 500 METER
      if (jarakTerdekat < 500) {
        finalAIObject.prediction = "MELANGGAR"; // Masukkan ke dalam objek final
        finalAIObject.ai_recommendation = `🚨 Sistem Zonify: Lokasi ini melanggar karena berjarak hanya ${jarakTerdekat.toFixed(2)} meter dari ${namaPasarTerdekat} (Batas min 500m).`;
      }
    }

    // 5. KIRIM DATA KE FRONT-END
    res.json({
      success: true,
      message: 'Prediksi berhasil',
      data: {
        input: { latitude, longitude },
        generatedFeatures: features,
        // KUNCI PERBAIKAN: prediction sekarang berisi OBJEK utuh, bukan string rata!
        prediction: finalAIObject
      },
    });
  } catch (err) {
    next(err);
  }
});
// router.post('/predict', async (req, res, next) => {
//   try {
//     const latitude = Number(req.body.latitude);
//     const longitude = Number(req.body.longitude);

//     if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Latitude dan longitude tidak valid',
//       });
//     }

//     const features = await buildPredictionFeatures(latitude, longitude);

//     const aiResponse = await axios.post(
//       `${AI_SERVICE_URL}/api/zonasi/predict`,
//       features,
//       {
//         timeout: 15000,
//       }
//     );

//     res.json({
//       success: true,
//       message: 'Prediksi berhasil',
//       data: {
//         input: {
//           latitude,
//           longitude,
//         },
//         generatedFeatures: features,
//         prediction: aiResponse.data,
//       },
//     });
//   } catch (err) {
//     if (err.response) {
//       err.status = err.response.status || 500;
//       err.message =
//         err.response.data?.message ||
//         err.response.data?.error ||
//         'Gagal melakukan prediksi AI';
//     }

//     next(err);
//   }
// });

// ─── POST /api/v1/ai/recommendation ─────────────────────────────────────────
// Accepts { lat, lng }, computes zone status from the DB, finds the nearest
// compliant alternative location via radial search, constructs an Indonesian
// prompt, and returns the AI explanation together with the new coordinates.
router.post('/recommendation', async (req, res, next) => {
  try {
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);

    // ── 1. Input validation ────────────────────────────────────────────────
    if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
      return res.status(400).json({
        success: false,
        message: 'lat dan lng wajib berupa angka desimal yang valid',
      });
    }

    // ── 2. Fetch all entities from DB ──────────────────────────────────────
    const allEntities = await prisma.entity.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        store: true,
        latitude: true,
        longitude: true,
      },
    });

    // ── 3. Separate markets (Pasar) from retail competitors ───────────────
    const markets = allEntities.filter((e) => {
      const t = String(e.type ?? '').toUpperCase();
      const n = String(e.name ?? '').toUpperCase();
      const s = String(e.store ?? '').toUpperCase();
      return t === 'PASAR' || n.includes('PASAR') || s.includes('PASAR');
    }).filter((e) =>
      isValidLatitude(Number(e.latitude)) && isValidLongitude(Number(e.longitude))
    );

    const retails = allEntities.filter((e) => isRetailCompetitor(e)).filter((e) =>
      isValidLatitude(Number(e.latitude)) && isValidLongitude(Number(e.longitude))
    );

    // ── 4. Compute metrics for the origin point ────────────────────────────
    // 4a. Count retails within 500 m
    const retailsWithin500m = retails.filter((e) => {
      const d = haversineDistanceMeters(lat, lng, Number(e.latitude), Number(e.longitude));
      return d <= COMPETITOR_RADIUS_METERS;
    });
    const retailCount = retailsWithin500m.length;

    // 4b. Nearest market distance
    let nearestMarketDist = Infinity;
    let nearestMarketName = '-';
    for (const m of markets) {
      const d = haversineDistanceMeters(lat, lng, Number(m.latitude), Number(m.longitude));
      if (d < nearestMarketDist) {
        nearestMarketDist = d;
        nearestMarketName = m.name ?? '-';
      }
    }

    // 4c. Determine zone status
    const violatesMarketRule = markets.length > 0 && nearestMarketDist < COMPETITOR_RADIUS_METERS;
    const isOversaturated = retailCount >= 5; // ≥5 retails within 500 m = oversaturated
    let statusLabel;
    if (violatesMarketRule) statusLabel = 'Melanggar';
    else if (isOversaturated) statusLabel = 'Oversaturated';
    else statusLabel = 'Aman';

    // ── 5. Find nearest compliant alternative location ─────────────────────
    const alternative = findAlternativeLocation(lat, lng, markets);

    // ── 6. Build the Indonesian prompt ────────────────────────────────────
    let prompt;
    if (alternative) {
      prompt =
        `Lokasi saat ini (${lat}, ${lng}) memiliki status ${statusLabel}. ` +
        `Terdapat ${retailCount} retail di radius 500m. ` +
        `Rekomendasi koordinat alternatif terdekat adalah di (${alternative.lat}, ${alternative.lng}), ` +
        `bergeser sejauh ${alternative.distanceM} meter ke arah ${alternative.direction}. ` +
        `Sebagai konsultan tata letak ritel, berikan penjelasan singkat (max 3 kalimat) ` +
        `mengapa rekomendasi ini lebih baik untuk bisnis dan sesuai regulasi.`;
    } else {
      prompt =
        `Lokasi saat ini (${lat}, ${lng}) memiliki status ${statusLabel}. ` +
        `Terdapat ${retailCount} retail di radius 500m. ` +
        `Tidak ditemukan titik alternatif yang sepenuhnya aman dalam radius pencarian (≤500m radial). ` +
        `Sebagai konsultan tata letak ritel, berikan penjelasan singkat (max 3 kalimat) ` +
        `mengenai kondisi ini dan saran tindak lanjut yang sesuai regulasi.`;
    }

    // ── 7. Send prompt to Python AI service ───────────────────────────────
    let aiExplanation = null;
    try {
      const llmResponse = await axios.post(
        `${AI_SERVICE_URL}/api/v1/ai/recommendation`,
        { prompt },
        { timeout: 20000 }
      );
      aiExplanation =
        llmResponse.data?.explanation ??
        llmResponse.data?.text ??
        llmResponse.data?.message ??
        null;
    } catch (_llmErr) {
      // Python LLM endpoint not yet available — use deterministic fallback
      aiExplanation = null;
    }

    // Deterministic fallback explanation when LLM is unavailable
    if (!aiExplanation) {
      if (alternative) {
        aiExplanation =
          `Lokasi ini berstatus "${statusLabel}" dengan ${retailCount} retail kompetitor dalam radius 500m. ` +
          `Titik alternatif ke arah ${alternative.direction} (${alternative.lat}, ${alternative.lng}) ` +
          `berjarak ${alternative.distanceM}m dari posisi saat ini dan memenuhi jarak aman ≥500m dari seluruh pasar tradisional. ` +
          `Memilih lokasi ini akan mengurangi risiko pelanggaran zonasi sekaligus memperluas jangkauan pasar ke segmen konsumen baru.`;
      } else {
        aiExplanation =
          `Lokasi ini berstatus "${statusLabel}" dengan ${retailCount} retail kompetitor dalam radius 500m. ` +
          `Tidak ditemukan titik alternatif yang memenuhi jarak aman ≥500m dari semua pasar dalam radius pencarian radial 500m. ` +
          `Disarankan untuk melakukan survei lapangan di area yang lebih luas atau berkonsultasi dengan Dinas Perdagangan setempat.`;
      }
    }

    // ── 8. Return structured response ─────────────────────────────────────
    res.json({
      success: true,
      message: 'Rekomendasi lokasi berhasil dihasilkan',
      data: {
        origin: { lat, lng },
        zoneStatus: statusLabel,
        retailCountWithin500m: retailCount,
        nearestMarket: {
          name: nearestMarketName,
          distanceM: nearestMarketDist === Infinity ? null : roundNumber(nearestMarketDist, 1),
        },
        alternative: alternative
          ? {
            lat: alternative.lat,
            lng: alternative.lng,
            distanceM: alternative.distanceM,
            direction: alternative.direction,
          }
          : null,
        explanation: aiExplanation,
        prompt,           // expose the prompt so the frontend can show or log it
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;