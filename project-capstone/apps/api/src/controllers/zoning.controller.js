import prisma from '../config/database.js';
import { validateLatitudeLongitude, haversineDistanceMeters, formatDistance, toNumber } from '../utils/geo.util.js';
import axios from 'axios';

const DEFAULT_RADIUS = 500;

export const getZoningMapPoints = async (req, res) => {
  try {
    const { type, districtId, store } = req.query;

    const entities = await prisma.entity.findMany({
      include: { district: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    let filtered = entities.filter(e => e.latitude !== null && e.longitude !== null);

    if (type) filtered = filtered.filter(e => e.type === String(type).toUpperCase());
    else filtered = filtered.filter(e => ['MINIMARKET', 'SUPERMARKET', 'PASAR'].includes(e.type));

    if (districtId) filtered = filtered.filter(e => e.districtId === districtId);
    if (store) filtered = filtered.filter(e => e.store?.toLowerCase().includes(store.toLowerCase()));

    const points = filtered.map((e) => {
      const entityType = (e.type || "").toUpperCase();
      return {
        id: e.id,
        name: e.name || "Tanpa Nama",
        type: entityType,
        store: e.store || "Lainnya",
        latitude: Number(e.latitude) || 0,
        longitude: Number(e.longitude) || 0,
        isFlagged: e.isFlagged || false,
        district: e.district || { name: "-" },
      };
    });

    res.status(200).json({ success: true, data: { points } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const calculateZoningStatus = async (req, res) => {
  try {
    const { latitude, longitude, radiusMeters, name } = req.body;
    const validation = validateLatitudeLongitude(latitude, longitude);
    if (!validation.valid) return res.status(400).json({ success: false, message: validation.message });

    const lat = validation.latitude;
    const lon = validation.longitude;
    const bodyRadius = toNumber(radiusMeters);

    const zoningRule = await prisma.zoningRule.findFirst({
      where: { ruleType: 'PROXIMITY', targetEntityType: 'MINIMARKET', referenceEntityType: 'PASAR' },
      orderBy: { createdAt: 'desc' },
    });

    const minimumDistanceMeters = bodyRadius || zoningRule?.minDistanceMeters || DEFAULT_RADIUS;
    const ruleSource = bodyRadius ? 'REQUEST_BODY_RADIUS' : zoningRule ? 'DATABASE_ZONING_RULE' : 'DEFAULT_500_METERS';

    const allEntities = await prisma.entity.findMany({
      where: { type: 'PASAR' },
      include: { district: { select: { id: true, name: true, code: true } } },
    });

    const pasars = allEntities.filter(p => p.latitude != null && p.longitude != null);

    if (!pasars.length) return res.status(404).json({ success: false, message: 'Data pasar tradisional belum tersedia' });

    const distances = pasars
      .map((p) => {
        const dMeters = haversineDistanceMeters(lat, lon, Number(p.latitude), Number(p.longitude));
        const f = formatDistance(dMeters);
        return {
          pasarId: p.id,
          pasarName: p.name,
          address: p.address,
          district: p.district,
          latitude: Number(p.latitude),
          longitude: Number(p.longitude),
          distanceMeters: f.meters,
          distanceKm: f.kilometers,
          status: dMeters < minimumDistanceMeters ? 'MELANGGAR' : 'AMAN',
        };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    const nearest = distances[0];
    const isViolation = nearest.distanceMeters < minimumDistanceMeters;

    res.status(200).json({
      success: true,
      message: 'Perhitungan zonasi berhasil',
      data: {
        input: { name: name || 'Calon Minimarket', latitude: lat, longitude: lon },
        rule: { ruleType: 'PROXIMITY', targetEntityType: 'MINIMARKET', referenceEntityType: 'PASAR', minimumDistanceMeters, source: ruleSource },
        result: {
          status: isViolation ? 'DITOLAK' : 'AMAN',
          isViolation,
          statusLabel: isViolation ? '⛔ DITOLAK / MELANGGAR ATURAN ZONASI' : '✅ AMAN / MEMENUHI ATURAN ZONASI',
          message: isViolation
            ? `Lokasi berada ${nearest.distanceMeters} meter dari ${nearest.pasarName}, kurang dari batas minimal ${minimumDistanceMeters} meter.`
            : `Lokasi aman. Pasar terdekat adalah ${nearest.pasarName} dengan jarak ${nearest.distanceMeters} meter.`,
          nearestPasar: nearest,
        },
        nearestMarkets: distances.slice(0, 10),
        allMarkets: distances,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal menghitung status zonasi', error: error.message });
  }
};

export const predictZoning = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    const validation = validateLatitudeLongitude(latitude, longitude);
    if (!validation.valid) return res.status(400).json({ success: false, message: validation.message });

    const lat = validation.latitude;
    const lon = validation.longitude;

    // 2. Haversine Calculation
    const competitors = await prisma.entity.findMany({
      where: {
        type: { in: ['MINIMARKET', 'SUPERMARKET'] } // Assuming retail locations are Minimarket & Supermarket
      }
    });

    const validCompetitors = competitors.filter(c => c.latitude != null && c.longitude != null);
    let competitor_density = 0;
    let minDistance = Infinity;

    validCompetitors.forEach(c => {
      const dMeters = haversineDistanceMeters(lat, lon, Number(c.latitude), Number(c.longitude));
      
      if (dMeters <= 500) {
        competitor_density += 1;
      }
      
      if (dMeters < minDistance) {
        minDistance = dMeters;
      }
    });

    const jarak_kompetitor = minDistance === Infinity ? 0 : Number(minDistance.toFixed(2));
    const head_to_head = jarak_kompetitor <= 50 ? 1.0 : 0.0;

    // 3. Cluster Lookup
    // NOTE: 'ClusterLookup' table does not exist in schema.prisma.
    // I am mocking these values. If you have a specific table for this, you can replace the query below.
    let cluster_macro = 0.0;
    let cluster_hotspot = 0.0;
    let is_hotspot = 0;
    
    // Example of how it would be queried if the table existed:
    // const nearestCluster = await prisma.$queryRaw`
    //   SELECT cluster_macro, cluster_hotspot, is_hotspot 
    //   FROM geographic_cluster_lookup 
    //   ORDER BY (latitude - ${lat}) * (latitude - ${lat}) + (longitude - ${lon}) * (longitude - ${lon}) ASC 
    //   LIMIT 1
    // `;
    // if (nearestCluster && nearestCluster.length > 0) { ... }

    // 4. Payload Assembly & Forwarding
    const payload = {
      latitude: lat,
      longitude: lon,
      competitor_density,
      jarak_kompetitor,
      head_to_head,
      cluster_macro,
      cluster_hotspot,
      is_hotspot
    };

    const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5000/api/predict'; // adjust path if needed
    
    const mlResponse = await axios.post(ML_API_URL, payload);

    // 5. Response Handling
    return res.status(200).json(mlResponse.data);

  } catch (error) {
    console.error('ML API Error:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to predict zoning features', 
      error: error.response?.data || error.message 
    });
  }
};

// import prisma from '../config/database.js';
// import { validateLatitudeLongitude, haversineDistanceMeters, formatDistance, toNumber } from '../utils/geo.util.js';

// const DEFAULT_RADIUS = 500;

// // GET /api/v1/zoning/points
// // export const getZoningMapPoints = async (req, res) => {
// //   try {
// //     const { type, districtId, store } = req.query;
// //     const where = { latitude: { not: null }, longitude: { not: null } };

// //     if (type) where.type = String(type).toUpperCase();
// //     else where.type = { in: ['MINIMARKET', 'SUPERMARKET', 'PASAR'] };

// //     if (districtId) where.districtId = districtId;
// //     if (store) where.store = { contains: store, mode: 'insensitive' };

// //     const entities = await prisma.entity.findMany({
// //       where,
// //       include: { district: { select: { id: true, name: true, code: true, status: true, saturationPercent: true } } },
// //       orderBy: [{ type: 'asc' }, { name: 'asc' }],
// //     });

// //     const points = entities.map((e) => {
// //       const isPasar = e.type === 'PASAR';
// //       const isSupermarket = e.type === 'SUPERMARKET';

// //       return {
// //         id: e.id,
// //         name: e.name,
// //         type: e.type,
// //         store: e.store,
// //         address: e.address,
// //         kelurahan: e.kelurahan,
// //         latitude: Number(e.latitude),
// //         longitude: Number(e.longitude),
// //         rating: e.rating,
// //         totalRatings: e.totalRatings,
// //         permitStatus: e.permitStatus,
// //         complianceScore: e.complianceScore,
// //         isFlagged: e.isFlagged,
// //         district: e.district,
// //         markerType: isPasar ? 'PASAR' : isSupermarket ? 'SUPERMARKET' : 'MINIMARKET',
// //         markerColor: isPasar
// //           ? 'green'
// //           : e.isFlagged
// //             ? 'red'
// //             : e.store === 'Indomaret'
// //               ? 'blue'
// //               : e.store === 'Alfamart'
// //                 ? 'orange'
// //                 : isSupermarket
// //                   ? 'purple'
// //                   : 'gray',
// //         statusLabel: isPasar ? 'Pasar Tradisional' : e.isFlagged ? 'Berpotensi Melanggar' : 'Aman',
// //         popupTitle: e.name,
// //         popupSubtitle: isPasar ? `Pasar Tradisional - ${e.district?.name || '-'}` : `${e.store || e.type} - ${e.district?.name || '-'}`,
// //       };
// //     });

// //     const summary = {
// //       total: points.length,
// //       totalMinimarket: points.filter((p) => p.type === 'MINIMARKET').length,
// //       totalSupermarket: points.filter((p) => p.type === 'SUPERMARKET').length,
// //       totalPasar: points.filter((p) => p.type === 'PASAR').length,
// //       totalFlagged: points.filter((p) => p.isFlagged).length,
// //     };

// //     res.status(200).json({ success: true, message: 'Data titik peta berhasil diambil', data: { summary, points } });
// //   } catch (error) {
// //     console.error(error);
// //     res.status(500).json({ success: false, message: 'Gagal mengambil data titik peta', error: error.message });
// //   }
// // };

// // POST /api/v1/zoning/calculate
// export const calculateZoningStatus = async (req, res) => {
//   try {
//     const { latitude, longitude, radiusMeters, name } = req.body;
//     const validation = validateLatitudeLongitude(latitude, longitude);
//     if (!validation.valid) return res.status(400).json({ success: false, message: validation.message });

//     const lat = validation.latitude;
//     const lon = validation.longitude;
//     const bodyRadius = toNumber(radiusMeters);

//     const zoningRule = await prisma.zoningRule.findFirst({
//       where: { ruleType: 'PROXIMITY', targetEntityType: 'MINIMARKET', referenceEntityType: 'PASAR' },
//       orderBy: { createdAt: 'desc' },
//     });

//     const minimumDistanceMeters = bodyRadius || zoningRule?.minDistanceMeters || DEFAULT_RADIUS;
//     const ruleSource = bodyRadius ? 'REQUEST_BODY_RADIUS' : zoningRule ? 'DATABASE_ZONING_RULE' : 'DEFAULT_500_METERS';

//     // 1. Ambil SEMUA data pasar tanpa filter 'where' dari database
//     // Ini akan menghindari error Prisma sama sekali
//     const allEntities = await prisma.entity.findMany({
//       where: { type: 'PASAR' },
//       include: { district: { select: { id: true, name: true, code: true } } },
//     });

//     // 2. Filter secara manual di kodingan (bukan di database)
//     const pasars = allEntities.filter(p => p.latitude != null && p.longitude != null);
//     // const pasars = await prisma.entity.findMany({
//     //   where: { type: 'PASAR', latitude: { not: null }, longitude: { not: null } },
//     //   include: { district: { select: { id: true, name: true, code: true } } },
//     // });

//     if (!pasars.length) return res.status(404).json({ success: false, message: 'Data pasar tradisional belum tersedia' });

//     const distances = pasars
//       .map((p) => {
//         const dMeters = haversineDistanceMeters(lat, lon, Number(p.latitude), Number(p.longitude));
//         const f = formatDistance(dMeters);
//         return {
//           pasarId: p.id,
//           pasarName: p.name,
//           address: p.address,
//           district: p.district,
//           latitude: Number(p.latitude),
//           longitude: Number(p.longitude),
//           distanceMeters: f.meters,
//           distanceKm: f.kilometers,
//           status: dMeters < minimumDistanceMeters ? 'MELANGGAR' : 'AMAN',
//         };
//       })
//       .sort((a, b) => a.distanceMeters - b.distanceMeters);

//     const nearest = distances[0];
//     const isViolation = nearest.distanceMeters < minimumDistanceMeters;

//     res.status(200).json({
//       success: true,
//       message: 'Perhitungan zonasi berhasil',
//       data: {
//         input: { name: name || 'Calon Minimarket', latitude: lat, longitude: lon },
//         rule: { ruleType: 'PROXIMITY', targetEntityType: 'MINIMARKET', referenceEntityType: 'PASAR', minimumDistanceMeters, source: ruleSource },
//         result: {
//           status: isViolation ? 'DITOLAK' : 'AMAN',
//           isViolation,
//           statusLabel: isViolation ? '⛔ DITOLAK / MELANGGAR ATURAN ZONASI' : '✅ AMAN / MEMENUHI ATURAN ZONASI',
//           message: isViolation
//             ? `Lokasi berada ${nearest.distanceMeters} meter dari ${nearest.pasarName}, kurang dari batas minimal ${minimumDistanceMeters} meter.`
//             : `Lokasi aman. Pasar terdekat adalah ${nearest.pasarName} dengan jarak ${nearest.distanceMeters} meter.`,
//           nearestPasar: nearest,
//         },
//         nearestMarkets: distances.slice(0, 10),
//         allMarkets: distances,
//       },
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: 'Gagal menghitung status zonasi', error: error.message });
//   }
// };