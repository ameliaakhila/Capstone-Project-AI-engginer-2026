import { Router } from 'express';
import prisma from '../config/database.js';

const router = Router();

// GET /api/v1/entities
// GET /api/v1/entities
router.get('/', async (req, res, next) => {
  try {
    const {
      districtId,
      type,
      permitStatus,
      isFlagged,
      page = 1,
      limit = 50,
      search,
    } = req.query;

    const where = {
      audits: {
        none: {
          status: 'CANCELLED',
        },
      },
    };

    const allowedTypes = ['PASAR', 'MINIMARKET', 'SUPERMARKET'];
    const allowedPermitStatuses = ['APPROVED', 'UNDER_REVIEW', 'REJECTED', 'EXPIRED'];

    if (districtId) where.districtId = districtId;

    if (type) {
      const upperType = type.toUpperCase();
      if (!allowedTypes.includes(upperType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid entity type',
        });
      }
      where.type = upperType;
    }

    if (permitStatus) {
      const upperPermitStatus = permitStatus.toUpperCase();
      if (!allowedPermitStatuses.includes(upperPermitStatus)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid permit status',
        });
      }
      where.permitStatus = upperPermitStatus;
    }

    if (isFlagged !== undefined) {
      where.isFlagged = isFlagged === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { store: { contains: search, mode: 'insensitive' } },
        { kelurahan: { contains: search, mode: 'insensitive' } },
      ];
    }

    const pageNumber = Math.max(parseInt(page), 1);
    const limitNumber = Math.min(Math.max(parseInt(limit), 1), 100);
    const skip = (pageNumber - 1) * limitNumber;

    let trend = undefined;
    if (type) {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const currentPeriodCount = await prisma.entity.count({
        where: {
          ...where,
          createdAt: { gte: thirtyDaysAgo }
        }
      });

      const previousPeriodCount = await prisma.entity.count({
        where: {
          ...where,
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }
        }
      });

      if (previousPeriodCount === 0) {
        trend = currentPeriodCount > 0 ? 100 : 0;
      } else {
        trend = Math.round(((currentPeriodCount - previousPeriodCount) / previousPeriodCount) * 100);
      }
    }

    const [entities, total] = await Promise.all([
      prisma.entity.findMany({
        where,
        skip,
        take: limitNumber,
        include: {
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
      }),
      prisma.entity.count({ where }),
    ]);

    res.json({
      success: true,
      data: entities,
      meta: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
        ...(trend !== undefined && { trend })
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/entities/:id
router.get('/:id', async (req, res, next) => {
  try {
    const entity = await prisma.entity.findUnique({
      where: { id: req.params.id },
      include: {
        district: true,
        violations: { orderBy: { detectedAt: 'desc' } },
        audits: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!entity) return res.status(404).json({ success: false, error: 'Entity not found' });
    res.json({ success: true, data: entity });
  } catch (err) { next(err); }
});

// GET /api/v1/entities/:id/nearby — PostGIS-style distance calculation using Haversine
router.get('/:id/nearby', async (req, res, next) => {
  try {
    const { radius = 500 } = req.query;
    const entity = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!entity) return res.status(404).json({ success: false, error: 'Entity not found' });

    // Use raw SQL with PostGIS ST_DWithin for accurate spatial query
    const radiusMeters = Math.min(parseFloat(radius), 5000);
    const nearby = await prisma.$queryRaw`
      SELECT 
        e.id, e.name, e.type, e.latitude, e.longitude, e.store, e.kelurahan,
        e."isFlagged", e."complianceScore", e."districtId",
        (6371000 * acos(
          cos(radians(${entity.latitude})) * cos(radians(e.latitude)) *
          cos(radians(e.longitude) - radians(${entity.longitude})) +
          sin(radians(${entity.latitude})) * sin(radians(e.latitude))
        )) AS distance_meters
      FROM entities e
      WHERE e.id != ${entity.id}
        AND (6371000 * acos(
          cos(radians(${entity.latitude})) * cos(radians(e.latitude)) *
          cos(radians(e.longitude) - radians(${entity.longitude})) +
          sin(radians(${entity.latitude})) * sin(radians(e.latitude))
        )) <= ${radiusMeters}
      ORDER BY distance_meters
      LIMIT 20
    `;

    res.json({ success: true, data: nearby });
  } catch (err) { next(err); }
});

// POST /api/v1/entities
router.post('/', async (req, res, next) => {
  try {
    const {
      name,
      type,
      address,
      latitude,
      longitude,
      placeId,
      store,
      kelurahan,
      rating = 0,
      totalRatings = 0,
      permitStatus = 'UNDER_REVIEW',
      complianceScore = 0,
      isFlagged = false,
      districtId,
    } = req.body;

    const district = await prisma.district.findUnique({
      where: { id: districtId },
    });

    if (!district) {
      return res.status(404).json({
        success: false,
        error: 'District not found',
      });
    }

    const entity = await prisma.entity.create({
      data: {
        name,
        type: type.toUpperCase(),
        address,
        latitude: Number(latitude),
        longitude: Number(longitude),
        placeId,
        store,
        kelurahan,
        rating: Number(rating),
        totalRatings: Number(totalRatings),
        permitStatus,
        complianceScore: Number(complianceScore),
        isFlagged: Boolean(isFlagged),
        districtId,
      },
      include: {
        district: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Entity created successfully',
      data: entity,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/entities/:id
router.put('/:id', async (req, res, next) => {
  try {
    const {
      name,
      type,
      address,
      latitude,
      longitude,
      placeId,
      store,
      kelurahan,
      rating,
      totalRatings,
      permitStatus,
      complianceScore,
      isFlagged,
      districtId,
    } = req.body;

    const existingEntity = await prisma.entity.findUnique({
      where: { id: req.params.id },
    });

    if (!existingEntity) {
      return res.status(404).json({
        success: false,
        error: 'Entity not found',
      });
    }

    if (districtId) {
      const district = await prisma.district.findUnique({
        where: { id: districtId },
      });

      if (!district) {
        return res.status(404).json({
          success: false,
          error: 'District not found',
        });
      }
    }

    const entity = await prisma.entity.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type: type.toUpperCase() }),
        ...(address !== undefined && { address }),
        ...(latitude !== undefined && { latitude: Number(latitude) }),
        ...(longitude !== undefined && { longitude: Number(longitude) }),
        ...(placeId !== undefined && { placeId }),
        ...(store !== undefined && { store }),
        ...(kelurahan !== undefined && { kelurahan }),
        ...(rating !== undefined && { rating: Number(rating) }),
        ...(totalRatings !== undefined && { totalRatings: Number(totalRatings) }),
        ...(permitStatus !== undefined && { permitStatus }),
        ...(complianceScore !== undefined && { complianceScore: Number(complianceScore) }),
        ...(isFlagged !== undefined && { isFlagged: Boolean(isFlagged) }),
        ...(districtId !== undefined && { districtId }),
      },
      include: {
        district: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Entity updated successfully',
      data: entity,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/entities/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existingEntity = await prisma.entity.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            violations: true,
            audits: true,
          },
        },
      },
    });

    if (!existingEntity) {
      return res.status(404).json({
        success: false,
        error: 'Entity not found',
      });
    }

    if (
      existingEntity._count.violations > 0 ||
      existingEntity._count.audits > 0
    ) {
      return res.status(400).json({
        success: false,
        error: 'Entity cannot be deleted because it still has related violations or audits',
      });
    }

    await prisma.entity.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Entity deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/entities/:id/flag
router.patch('/:id/flag', async (req, res, next) => {
  try {
    const entity = await prisma.entity.findUnique({
      where: { id: req.params.id },
    });

    if (!entity) {
      return res.status(404).json({
        success: false,
        error: 'Entity not found',
      });
    }

    const updatedEntity = await prisma.entity.update({
      where: { id: req.params.id },
      data: {
        isFlagged: true,
      },
    });

    res.json({
      success: true,
      message: 'Entity flagged successfully',
      data: updatedEntity,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/entities/:id/unflag
router.patch('/:id/unflag', async (req, res, next) => {
  try {
    const entity = await prisma.entity.findUnique({
      where: { id: req.params.id },
    });

    if (!entity) {
      return res.status(404).json({
        success: false,
        error: 'Entity not found',
      });
    }

    const updatedEntity = await prisma.entity.update({
      where: { id: req.params.id },
      data: {
        isFlagged: false,
      },
    });

    res.json({
      success: true,
      message: 'Entity unflagged successfully',
      data: updatedEntity,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/entities/:id/violations
router.get('/:id/violations', async (req, res, next) => {
  try {
    const entity = await prisma.entity.findUnique({
      where: { id: req.params.id },
    });

    if (!entity) {
      return res.status(404).json({
        success: false,
        error: 'Entity not found',
      });
    }

    const violations = await prisma.violation.findMany({
      where: {
        entityId: req.params.id,
      },
      orderBy: {
        detectedAt: 'desc',
      },
      include: {
        district: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        zoningRule: {
          select: {
            id: true,
            name: true,
            ruleType: true,
            minDistanceMeters: true,
            maxEntitiesPerZone: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: violations,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/entities/:id/audits
router.get('/:id/audits', async (req, res, next) => {
  try {
    const entity = await prisma.entity.findUnique({
      where: { id: req.params.id },
    });

    if (!entity) {
      return res.status(404).json({
        success: false,
        error: 'Entity not found',
      });
    }

    const audits = await prisma.audit.findMany({
      where: {
        entityId: req.params.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        district: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: audits,
    });
  } catch (err) {
    next(err);
  }
});



export default router;
