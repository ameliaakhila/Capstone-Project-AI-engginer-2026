import { Router } from 'express';
import prisma from '../config/database.js';

const router = Router();

// GET /api/v1/search?q=...&type=entity|district|coordinates
// GET /api/v1/search?q=...&type=entity|district|violation|all
router.get('/', async (req, res, next) => {
  try {
    const {
      q,
      type = 'all',
      entityType,
      permitStatus,
      districtId,
      limit = 20,
    } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
      });
    }

    const take = Math.min(parseInt(limit), 50);

    const results = {
      entities: [],
      districts: [],
      violations: [],
      flaggedClusters: [],
    };

    // Search entities
    if (type === 'all' || type === 'entity') {
      const entityWhere = {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { store: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } },
          { kelurahan: { contains: q, mode: 'insensitive' } },
        ],
      };

      if (entityType) {
        entityWhere.type = entityType.toUpperCase();
      }

      if (permitStatus) {
        entityWhere.permitStatus = permitStatus.toUpperCase();
      }

      if (districtId) {
        entityWhere.districtId = districtId;
      }

      results.entities = await prisma.entity.findMany({
        where: entityWhere,
        take,
        select: {
          id: true,
          name: true,
          type: true,
          address: true,
          latitude: true,
          longitude: true,
          store: true,
          kelurahan: true,
          rating: true,
          permitStatus: true,
          complianceScore: true,
          isFlagged: true,
          district: {
            select: {
              id: true,
              name: true,
              code: true,
              status: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    }

    // Search districts
    if (type === 'all' || type === 'district') {
      results.districts = await prisma.district.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
          ],
        },
        take,
        select: {
          id: true,
          name: true,
          code: true,
          latitude: true,
          longitude: true,
          saturationPercent: true,
          status: true,
          _count: {
            select: {
              entities: true,
              violations: true,
            },
          },
        },
        orderBy: {
          saturationPercent: 'desc',
        },
      });
    }

    // Search violations
    if (type === 'all' || type === 'violation') {
      results.violations = await prisma.violation.findMany({
        where: {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take,
        select: {
          id: true,
          code: true,
          description: true,
          ruleType: true,
          severity: true,
          status: true,
          distanceM: true,
          detectedAt: true,
          entity: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          district: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          detectedAt: 'desc',
        },
      });
    }

    // Search flagged clusters
    if (type === 'all' || type === 'cluster') {
      results.flaggedClusters = await prisma.flaggedCluster.findMany({
        where: {
          OR: [
            { streetName: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take,
        include: {
          district: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
        orderBy: {
          entityCount: 'desc',
        },
      });
    }

    res.json({
      success: true,
      query: q,
      type,
      data: results,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/search/suggestions?q=...
router.get('/suggestions', async (req, res, next) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
      });
    }

    const take = Math.min(parseInt(limit), 20);

    const [entities, districts] = await Promise.all([
      prisma.entity.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { store: { contains: q, mode: 'insensitive' } },
            { address: { contains: q, mode: 'insensitive' } },
            { kelurahan: { contains: q, mode: 'insensitive' } },
          ],
        },
        take,
        select: {
          id: true,
          name: true,
          type: true,
          address: true,
        },
        orderBy: {
          name: 'asc',
        },
      }),

      prisma.district.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
          ],
        },
        take,
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
        },
        orderBy: {
          name: 'asc',
        },
      }),
    ]);

    const suggestions = [
      ...entities.map(item => ({
        id: item.id,
        label: item.name,
        description: item.address,
        category: 'entity',
        type: item.type,
      })),

      ...districts.map(item => ({
        id: item.id,
        label: item.name,
        description: item.code,
        category: 'district',
        status: item.status,
      })),
    ];

    res.json({
      success: true,
      data: suggestions.slice(0, take),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/search/nearby?lat=-6.2&lng=106.8&radius=1000
router.get('/nearby', async (req, res, next) => {
  try {
    const { lat, lng, radius = 1000 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Query parameters "lat" and "lng" are required',
      });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);
    const radiusMeters = Math.min(Number(radius), 5000);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid latitude or longitude',
      });
    }

    const nearby = await prisma.$queryRaw`
      SELECT 
        e.id,
        e.name,
        e.type,
        e.address,
        e.latitude,
        e.longitude,
        e.store,
        e.kelurahan,
        e."permitStatus",
        e."isFlagged",
        e."complianceScore",
        d.name AS "districtName",
        d.code AS "districtCode",
        (
          6371000 * acos(
            cos(radians(${latitude})) * cos(radians(e.latitude)) *
            cos(radians(e.longitude) - radians(${longitude})) +
            sin(radians(${latitude})) * sin(radians(e.latitude))
          )
        ) AS distance_meters
      FROM entities e
      LEFT JOIN districts d ON d.id = e."districtId"
      WHERE (
        6371000 * acos(
          cos(radians(${latitude})) * cos(radians(e.latitude)) *
          cos(radians(e.longitude) - radians(${longitude})) +
          sin(radians(${latitude})) * sin(radians(e.latitude))
        )
      ) <= ${radiusMeters}
      ORDER BY distance_meters ASC
      LIMIT 30
    `;

    res.json({
      success: true,
      data: nearby,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/search/coordinates?q=-6.2,106.8
router.get('/coordinates', async (req, res, next) => {
  try {
    const { q, radius = 500 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required. Format: lat,lng',
      });
    }

    const [lat, lng] = q.split(',').map(Number);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinate format. Use format: lat,lng',
      });
    }

    const radiusMeters = Math.min(Number(radius), 5000);

    const nearby = await prisma.$queryRaw`
      SELECT 
        e.id,
        e.name,
        e.type,
        e.address,
        e.latitude,
        e.longitude,
        e."permitStatus",
        e."isFlagged",
        e."complianceScore",
        d.name AS "districtName",
        (
          6371000 * acos(
            cos(radians(${lat})) * cos(radians(e.latitude)) *
            cos(radians(e.longitude) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(e.latitude))
          )
        ) AS distance_meters
      FROM entities e
      LEFT JOIN districts d ON d.id = e."districtId"
      WHERE (
        6371000 * acos(
          cos(radians(${lat})) * cos(radians(e.latitude)) *
          cos(radians(e.longitude) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(e.latitude))
        )
      ) <= ${radiusMeters}
      ORDER BY distance_meters ASC
      LIMIT 30
    `;

    res.json({
      success: true,
      data: nearby,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
