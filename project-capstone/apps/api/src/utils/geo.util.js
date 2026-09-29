// src/utils/geo.util.js

export const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const validateLatitudeLongitude = (latitude, longitude) => {
  const lat = toNumber(latitude);
  const lon = toNumber(longitude);

  if (lat === null || lon === null) {
    return {
      valid: false,
      message: 'Latitude dan longitude wajib berupa angka',
    };
  }

  if (lat < -90 || lat > 90) {
    return {
      valid: false,
      message: 'Latitude harus berada di antara -90 sampai 90',
    };
  }

  if (lon < -180 || lon > 180) {
    return {
      valid: false,
      message: 'Longitude harus berada di antara -180 sampai 180',
    };
  }

  return {
    valid: true,
    latitude: lat,
    longitude: lon,
  };
};

export const haversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;

  const toRad = (degree) => degree * Math.PI / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) *
    Math.cos(phi2) *
    Math.sin(dLambda / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const formatDistance = (distanceMeters) => {
  return {
    meters: Number(distanceMeters.toFixed(1)),
    kilometers: Number((distanceMeters / 1000).toFixed(3)),
  };
};

// tambahan kecil utility untuk feature engineering otomatis
export const isValidLatitude = (lat) => typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
export const isValidLongitude = (lon) => typeof lon === 'number' && !isNaN(lon) && lon >= -180 && lon <= 180;

export const roundNumber = (value, digits = 2) => Number(Number(value).toFixed(digits));

// ─── Radial Search: find the nearest compliant alternative location ──────────
//
// Algorithm:
//   For each of 8 compass bearings (N, NE, E, SE, S, SW, W, NW) and each of
//   three candidate radii (250 m, 350 m, 500 m), a destination point is
//   computed from the origin (lat, lng) using the direct/inverse Haversine
//   (destination-point) formula.  The first candidate whose distance to EVERY
//   market in the supplied array is strictly >= 500 m is returned.
//   Returns null when no compliant point is found among all 24 candidates.
//
// @param {number}   lat      - Origin latitude  (decimal degrees)
// @param {number}   lng      - Origin longitude (decimal degrees)
// @param {Array}    markets  - Array of market objects with .latitude & .longitude
// @returns {{ lat, lng, distanceM, direction }|null}
//
export const findAlternativeLocation = (lat, lng, markets) => {
  const R = 6371000; // Earth radius in metres — same constant as haversineDistanceMeters

  // 8 compass bearings with Indonesian direction labels
  const DIRECTIONS = [
    { angle: 0, label: 'Utara' },
    { angle: 45, label: 'Timur Laut' },
    { angle: 90, label: 'Timur' },
    { angle: 135, label: 'Tenggara' },
    { angle: 180, label: 'Selatan' },
    { angle: 225, label: 'Barat Daya' },
    { angle: 270, label: 'Barat' },
    { angle: 315, label: 'Barat Laut' },
  ];

  // Candidate search radii (metres), ordered from closest to farthest
  const RADII = [250, 350, 500];

  // Minimum required clearance from every market (metres)
  const MIN_CLEARANCE = 500;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const originLat = toRad(lat);
  const originLng = toRad(lng);

  for (const { angle, label } of DIRECTIONS) {
    for (const distanceM of RADII) {
      const bearing = toRad(angle);
      const angularDist = distanceM / R; // angular distance (radians)

      // Destination-point formula
      const destLatRad = Math.asin(
        Math.sin(originLat) * Math.cos(angularDist) +
        Math.cos(originLat) * Math.sin(angularDist) * Math.cos(bearing)
      );

      const destLngRad = originLng + Math.atan2(
        Math.sin(bearing) * Math.sin(angularDist) * Math.cos(originLat),
        Math.cos(angularDist) - Math.sin(originLat) * Math.sin(destLatRad)
      );

      const candidateLat = toDeg(destLatRad);
      const candidateLng = toDeg(destLngRad);

      // Check clearance against every market
      const clearOfAll = markets.every((market) => {
        const mLat = Number(market.latitude ?? market.lat);
        const mLng = Number(market.longitude ?? market.lng ?? market.lon);
        const dist = haversineDistanceMeters(candidateLat, candidateLng, mLat, mLng);
        return dist >= MIN_CLEARANCE;
      });

      if (clearOfAll) {
        return {
          lat: roundNumber(candidateLat, 7),
          lng: roundNumber(candidateLng, 7),
          distanceM: distanceM,
          direction: label,
        };
      }
    }
  }

  // No compliant point found within the search space
  return null;
};