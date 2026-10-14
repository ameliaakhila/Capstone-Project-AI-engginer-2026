import { Router } from 'express';
import prisma from '../config/database.js';

const router = Router();

// GET /api/v1/districts
router.get('/', async (req, res, next) => {
  try {
    const { status, sortBy = 'saturationPercent', order = 'desc' } = req.query;

    const allowedSortBy = ['name', 'code', 'saturationPercent', 'status', 'createdAt', 'updatedAt'];
    const allowedOrder = ['asc', 'desc'];

    const safeSortBy = allowedSortBy.includes(sortBy) ? sortBy : 'saturationPercent';
    const safeOrder = allowedOrder.includes(order) ? order : 'desc';

    const where = status ? { status: status.toUpperCase() } : {};

    const districts = await prisma.district.findMany({
      where,
      orderBy: {
        [safeSortBy]: safeOrder,
      },
      include: {
        _count: {
          select: {
            entities: true,
            violations: true,
            audits: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: districts,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/districts/rankings
router.get('/rankings', async (req, res, next) => {
  try {
    const districts = await prisma.district.findMany({
      orderBy: { saturationPercent: 'desc' },
      include: {
        _count: { select: { entities: true, violations: true } },
        flaggedClusters: true,
        forecasts: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    const rankings = districts.map((d, idx) => ({
      position: idx + 1,
      id: d.id,
      name: d.name,
      code: d.code,
      latitude: d.latitude,
      longitude: d.longitude,
      saturationPercent: d.saturationPercent,
      status: d.status,
      violationCount: d._count.violations,
      entityCount: d._count.entities,
      flaggedClusters: d.flaggedClusters,
      recommendation: d.forecasts[0] || null,
    }));

    res.json({ success: true, data: rankings });
  } catch (err) { next(err); }
});

// GET /api/v1/districts/:id
router.get('/:id', async (req, res, next) => {
  try {
    const district = await prisma.district.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { entities: true, violations: true, audits: true } },
        flaggedClusters: true,
        forecasts: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!district) return res.status(404).json({ success: false, error: 'District not found' });
    res.json({ success: true, data: district });
  } catch (err) { next(err); }
});

// GET /api/v1/districts/:id/clusters
router.get('/:id/clusters', async (req, res, next) => {
  try {
    const clusters = await prisma.flaggedCluster.findMany({
      where: { districtId: req.params.id },
    });
    res.json({ success: true, data: clusters });
  } catch (err) { next(err); }
});

// GET /api/v1/districts/:id/comparison
router.get('/:id/comparison', async (req, res, next) => {
  try {
    const district = await prisma.district.findUnique({
      where: { id: req.params.id },
      include: {
        entities: {
          select: {
            permitStatus: true,
            complianceScore: true,
          },
        },
        _count: {
          select: {
            entities: true,
            violations: true,
            audits: true,
          },
        },
      },
    });

    if (!district) {
      return res.status(404).json({
        success: false,
        error: 'District not found',
      });
    }

    const totalEntities = district._count.entities;
    const approvedPermits = district.entities.filter(
      entity => entity.permitStatus === 'APPROVED'
    ).length;

    const permitScore =
      totalEntities > 0
        ? Math.round((approvedPermits / totalEntities) * 100)
        : 0;

    const avgCompliance =
      totalEntities > 0
        ? Math.round(
            district.entities.reduce(
              (sum, entity) => sum + (entity.complianceScore || 0),
              0
            ) / totalEntities
          )
        : 0;

    const radarData = {
      districtName: district.name,
      axes: {
        density: Math.min(totalEntities, 100),
        permits: permitScore,
        compliance: avgCompliance,
        violations: Math.min(district._count.violations * 5, 100),
        audits: Math.min(district._count.audits * 10, 100),
        zoningArea: district.saturationPercent,
      },
    };

    res.json({
      success: true,
      data: radarData,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/districts
router.post('/', async (req, res, next) => {
  try {
    const {
      name,
      code,
      latitude,
      longitude,
      saturationPercent = 0,
      status = 'STABLE',
    } = req.body;

    const district = await prisma.district.create({
      data: {
        name,
        code,
        latitude: Number(latitude),
        longitude: Number(longitude),
        saturationPercent: Number(saturationPercent),
        status,
      },
    });

    res.status(201).json({
      success: true,
      message: 'District created successfully',
      data: district,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/districts/:id
router.put('/:id', async (req, res, next) => {
  try {
    const {
      name,
      code,
      latitude,
      longitude,
      saturationPercent,
      status,
    } = req.body;

    const existingDistrict = await prisma.district.findUnique({
      where: { id: req.params.id },
    });

    if (!existingDistrict) {
      return res.status(404).json({
        success: false,
        error: 'District not found',
      });
    }

    const district = await prisma.district.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(latitude !== undefined && { latitude: Number(latitude) }),
        ...(longitude !== undefined && { longitude: Number(longitude) }),
        ...(saturationPercent !== undefined && {
          saturationPercent: Number(saturationPercent),
        }),
        ...(status !== undefined && { status }),
      },
    });

    res.json({
      success: true,
      message: 'District updated successfully',
      data: district,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/districts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existingDistrict = await prisma.district.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            entities: true,
            violations: true,
            audits: true,
          },
        },
      },
    });

    if (!existingDistrict) {
      return res.status(404).json({
        success: false,
        error: 'District not found',
      });
    }

    if (
      existingDistrict._count.entities > 0 ||
      existingDistrict._count.violations > 0 ||
      existingDistrict._count.audits > 0
    ) {
      return res.status(400).json({
        success: false,
        error: 'District cannot be deleted because it still has related data',
      });
    }

    await prisma.district.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'District deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/districts/:id/entities
router.get('/:id/entities', async (req, res, next) => {
  try {
    const district = await prisma.district.findUnique({
      where: { id: req.params.id },
    });

    if (!district) {
      return res.status(404).json({
        success: false,
        error: 'District not found',
      });
    }

    const entities = await prisma.entity.findMany({
      where: {
        districtId: req.params.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        type: true,
        address: true,
        latitude: true,
        longitude: true,
        rating: true,
        totalRatings: true,
        permitStatus: true,
        complianceScore: true,
        isFlagged: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: entities,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/districts/:id/violations
router.get('/:id/violations', async (req, res, next) => {
  try {
    const district = await prisma.district.findUnique({
      where: { id: req.params.id },
    });

    if (!district) {
      return res.status(404).json({
        success: false,
        error: 'District not found',
      });
    }

    const violations = await prisma.violation.findMany({
      where: {
        districtId: req.params.id,
      },
      orderBy: {
        detectedAt: 'desc',
      },
      include: {
        entity: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true,
          },
        },
        zoningRule: {
          select: {
            id: true,
            name: true,
            ruleType: true,
            minDistanceMeters: true,
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

// GET /api/v1/districts/:id/audits
router.get('/:id/audits', async (req, res, next) => {
  try {
    const district = await prisma.district.findUnique({
      where: { id: req.params.id },
    });

    if (!district) {
      return res.status(404).json({
        success: false,
        error: 'District not found',
      });
    }

    const audits = await prisma.audit.findMany({
      where: {
        districtId: req.params.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        entity: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true,
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
