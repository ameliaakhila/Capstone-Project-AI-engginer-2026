import { Router } from 'express';
import prisma from '../config/database.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { isAdmin } from '../middlewares/role.middleware.js';

const router = Router();

const generateAuditCode = () => {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `#MZ-${Date.now()}-${random}`;
};

const allowedViolationStatus = ['ACTIVE', 'UNDER_REVIEW', 'RESOLVED'];
const allowedAuditPriority = ['HIGH', 'MEDIUM', 'LOW'];
const allowedAuditStatus = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

// ─── GET /api/v1/dashboard/kpis ─────────────────────────
router.get('/kpis', authenticate, async (req, res, next) => {
  try {
    const [
      totalPasar,
      totalMinimarket,
      totalSupermarket,
      totalEntities,
      totalViolations,
      activeViolations,
      overSaturatedZones,
      totalDistricts,
      flaggedEntities,
      approvedPermits,
    ] = await Promise.all([
      prisma.entity.count({ where: { type: 'PASAR' } }),
      prisma.entity.count({ where: { type: 'MINIMARKET' } }),
      prisma.entity.count({ where: { type: 'SUPERMARKET' } }),
      prisma.entity.count(),
      prisma.violation.count(),
      prisma.violation.count({ where: { status: 'ACTIVE' } }),
      prisma.district.count({ where: { saturationPercent: { gte: 80 } } }),
      prisma.district.count(),
      prisma.entity.count({ where: { isFlagged: true } }),
      prisma.entity.count({ where: { permitStatus: 'APPROVED' } }),
    ]);

    const permitApprovalRate =
      totalEntities > 0 ? Math.round((approvedPermits / totalEntities) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalPasar: {
          value: totalPasar,
          label: 'Total pasar terdaftar',
        },
        totalMinimarket: {
          value: totalMinimarket,
          label: 'Total minimarket terdaftar',
        },
        totalSupermarket: {
          value: totalSupermarket,
          label: 'Total supermarket terdaftar',
        },
        totalEntities: {
          value: totalEntities,
          label: 'Total seluruh entity',
        },
        activeViolations: {
          value: activeViolations,
          label: 'Pelanggaran aktif',
        },
        totalViolations: {
          value: totalViolations,
          label: 'Total pelanggaran terdeteksi',
        },
        overSaturatedZones: {
          value: overSaturatedZones,
          label: `Dari ${totalDistricts} district`,
        },
        flaggedEntities: {
          value: flaggedEntities,
          label: 'Entity yang ditandai bermasalah',
        },
        permitApprovalRate: {
          value: permitApprovalRate,
          label: 'Persentase izin disetujui',
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/dashboard/heatmap ──────────────────────
router.get('/heatmap', authenticate, async (req, res, next) => {
  try {
    const districts = await prisma.district.findMany({
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
            audits: true,
          },
        },
      },
      orderBy: {
        saturationPercent: 'desc',
      },
    });

    const data = districts.map((district) => ({
      id: district.id,
      name: district.name,
      code: district.code,
      latitude: district.latitude,
      longitude: district.longitude,
      saturationPercent: district.saturationPercent,
      status: district.status,
      entityCount: district._count.entities,
      violationCount: district._count.violations,
      auditCount: district._count.audits,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/dashboard/forecast ─────────────────────
router.get('/forecast', authenticate, async (req, res, next) => {
  try {
    const forecasts = await prisma.aiForecast.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
      include: {
        district: {
          select: {
            name: true,
            status: true,
            saturationPercent: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: forecasts,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/dashboard/top-districts ────────────────
router.get('/top-districts', authenticate, async (req, res, next) => {
  try {
    const districts = await prisma.district.findMany({
      orderBy: {
        saturationPercent: 'desc',
      },
      take: 5,
      select: {
        id: true,
        name: true,
        code: true,
        saturationPercent: true,
        status: true,
        _count: {
          select: {
            entities: true,
            violations: true,
          },
        },
      },
    });

    const data = districts.map((district, index) => ({
      rank: index + 1,
      id: district.id,
      name: district.name,
      code: district.code,
      saturationPercent: district.saturationPercent,
      status: district.status,
      entityCount: district._count.entities,
      violationCount: district._count.violations,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/dashboard/ranking-analytics ────────────
// Tambahan agar frontend tidak 404 saat klik Ranking Analytics
router.get('/ranking-analytics', authenticate, async (req, res, next) => {
  try {
    const districts = await prisma.district.findMany({
      orderBy: {
        saturationPercent: 'desc',
      },
      select: {
        id: true,
        name: true,
        code: true,
        saturationPercent: true,
        status: true,
        _count: {
          select: {
            entities: true,
            violations: true,
            audits: true,
          },
        },
      },
    });

    const data = districts.map((district, index) => ({
      rank: index + 1,
      id: district.id,
      name: district.name,
      code: district.code,
      saturationPercent: district.saturationPercent,
      status: district.status,
      entityCount: district._count.entities,
      violationCount: district._count.violations,
      auditCount: district._count.audits,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/dashboard/recent-violations ────────────
router.get('/recent-violations', authenticate, async (req, res, next) => {
  try {
    const violations = await prisma.violation.findMany({
      orderBy: {
        detectedAt: 'desc',
      },
      take: 10,
      select: {
        id: true,
        code: true,
        description: true,
        ruleType: true,
        severity: true,
        status: true,
        distanceM: true,
        detectedAt: true,
        resolvedAt: true,
        entity: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true,
          },
        },
        district: {
          select: {
            id: true,
            name: true,
            status: true,
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

// ─── GET /api/v1/dashboard/violations ───────────────────
// Tambahan agar halaman Violation bisa ambil data dari dashboard juga
router.get('/violations', authenticate, async (req, res, next) => {
  try {
    const violations = await prisma.violation.findMany({
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
            isFlagged: true,
          },
        },
        district: {
          select: {
            id: true,
            name: true,
            status: true,
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

// ─── PATCH /api/v1/dashboard/recent-violations/:id/action ─
// HANYA ADMIN: ubah action/status recent violations
router.patch(
  '/recent-violations/:id/action',
  authenticate,
  isAdmin,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { action, status } = req.body;

      let nextStatus = status;

      if (!nextStatus && action) {
        const normalizedAction = String(action).toUpperCase();

        if (normalizedAction === 'RESOLVE' || normalizedAction === 'RESOLVED') {
          nextStatus = 'RESOLVED';
        } else if (
          normalizedAction === 'REVIEW' ||
          normalizedAction === 'UNDER_REVIEW'
        ) {
          nextStatus = 'UNDER_REVIEW';
        } else if (
          normalizedAction === 'REOPEN' ||
          normalizedAction === 'ACTIVE'
        ) {
          nextStatus = 'ACTIVE';
        }
      }

      if (!nextStatus) {
        return res.status(400).json({
          success: false,
          message: 'Status/action wajib diisi',
          allowedAction: ['RESOLVE', 'REVIEW', 'REOPEN'],
          allowedStatus: allowedViolationStatus,
        });
      }

      nextStatus = String(nextStatus).toUpperCase();

      if (!allowedViolationStatus.includes(nextStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Status violation tidak valid',
          allowedStatus: allowedViolationStatus,
        });
      }

      const existingViolation = await prisma.violation.findUnique({
        where: {
          id,
        },
      });

      if (!existingViolation) {
        return res.status(404).json({
          success: false,
          message: 'Violation tidak ditemukan',
        });
      }

      const updatedViolation = await prisma.violation.update({
        where: {
          id,
        },
        data: {
          status: nextStatus,
          resolvedAt: nextStatus === 'RESOLVED' ? new Date() : null,
        },
        include: {
          entity: {
            select: {
              id: true,
              name: true,
              type: true,
              address: true,
              isFlagged: true,
            },
          },
          district: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      if (nextStatus === 'RESOLVED') {
        const activeViolationCount = await prisma.violation.count({
          where: {
            entityId: existingViolation.entityId,
            status: {
              in: ['ACTIVE', 'UNDER_REVIEW'],
            },
          },
        });

        if (activeViolationCount === 0) {
          await prisma.entity.update({
            where: {
              id: existingViolation.entityId,
            },
            data: {
              isFlagged: false,
            },
          });
        }
      } else {
        await prisma.entity.update({
          where: {
            id: existingViolation.entityId,
          },
          data: {
            isFlagged: true,
          },
        });
      }

      res.json({
        success: true,
        message: 'Action recent violation berhasil diubah',
        data: updatedViolation,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/v1/dashboard/entity-summary ───────────────
router.get('/entity-summary', authenticate, async (req, res, next) => {
  try {
    const result = await prisma.entity.groupBy({
      by: ['type'],
      _count: {
        type: true,
      },
    });

    const data = result.map((item) => ({
      type: item.type,
      count: item._count.type,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/dashboard/permit-summary ───────────────
router.get('/permit-summary', authenticate, async (req, res, next) => {
  try {
    const result = await prisma.entity.groupBy({
      by: ['permitStatus'],
      _count: {
        permitStatus: true,
      },
    });

    const data = result.map((item) => ({
      status: item.permitStatus,
      count: item._count.permitStatus,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/dashboard/violation-summary ────────────
router.get('/violation-summary', authenticate, async (req, res, next) => {
  try {
    const [byStatus, bySeverity] = await Promise.all([
      prisma.violation.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
      }),
      prisma.violation.groupBy({
        by: ['severity'],
        _count: {
          severity: true,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        byStatus: byStatus.map((item) => ({
          status: item.status,
          count: item._count.status,
        })),
        bySeverity: bySeverity.map((item) => ({
          severity: item.severity,
          count: item._count.severity,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/dashboard/audit-summary ────────────────
router.get('/audit-summary', authenticate, async (req, res, next) => {
  try {
    const [byPriority, byStatus] = await Promise.all([
      prisma.audit.groupBy({
        by: ['priority'],
        _count: {
          priority: true,
        },
      }),
      prisma.audit.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        byPriority: byPriority.map((item) => ({
          priority: item.priority,
          count: item._count.priority,
        })),
        byStatus: byStatus.map((item) => ({
          status: item.status,
          count: item._count.status,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/dashboard/audits ───────────────────────
// List semua audit dengan pagination, filter & search
router.get('/audits', authenticate, async (req, res, next) => {
  try {
    const {
      page = '1',
      limit = '10',
      status,
      priority,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // ── where clause ──────────────────────────────────────
    const where = {};

    if (status) {
      const normalizedStatus = String(status).toUpperCase();
      if (allowedAuditStatus.includes(normalizedStatus)) {
        where.status = normalizedStatus;
      }
    }

    if (priority) {
      const normalizedPriority = String(priority).toUpperCase();
      if (allowedAuditPriority.includes(normalizedPriority)) {
        where.priority = normalizedPriority;
      }
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { findings: { contains: q, mode: 'insensitive' } },
        { entity: { name: { contains: q, mode: 'insensitive' } } },
        { district: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // ── allowed sort fields ────────────────────────────────
    const allowedSortFields = ['createdAt', 'completedAt', 'priority', 'status', 'code'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    // ── query ──────────────────────────────────────────────
    const [audits, total] = await Promise.all([
      prisma.audit.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [safeSortBy]: safeSortOrder },
        include: {
          entity: {
            select: {
              id: true,
              name: true,
              type: true,
              address: true,
              permitStatus: true,
              complianceScore: true,
              isFlagged: true,
            },
          },
          district: {
            select: {
              id: true,
              name: true,
              status: true,
              saturationPercent: true,
            },
          },
        },
      }),
      prisma.audit.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: audits,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/dashboard/audits ──────────────────────
// HANYA ADMIN: membuat new audit
router.post('/audits', authenticate, isAdmin, async (req, res, next) => {
  try {
    const {
      entityId,
      districtId,
      priority = 'MEDIUM',
      status = 'PENDING',
      findings,
    } = req.body;

    if (!entityId) {
      return res.status(400).json({
        success: false,
        message: 'entityId wajib diisi',
      });
    }

    const normalizedPriority = String(priority).toUpperCase();
    const normalizedStatus = String(status).toUpperCase();

    if (!allowedAuditPriority.includes(normalizedPriority)) {
      return res.status(400).json({
        success: false,
        message: 'Priority audit tidak valid',
        allowedPriority: allowedAuditPriority,
      });
    }

    if (!allowedAuditStatus.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Status audit tidak valid',
        allowedStatus: allowedAuditStatus,
      });
    }

    const entity = await prisma.entity.findUnique({
      where: {
        id: entityId,
      },
      select: {
        id: true,
        name: true,
        districtId: true,
      },
    });

    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entity tidak ditemukan',
      });
    }

    const finalDistrictId = districtId || entity.districtId;

    const district = await prisma.district.findUnique({
      where: {
        id: finalDistrictId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!district) {
      return res.status(404).json({
        success: false,
        message: 'District tidak ditemukan',
      });
    }

    const audit = await prisma.audit.create({
      data: {
        code: generateAuditCode(),
        priority: normalizedPriority,
        status: normalizedStatus,
        findings: findings || null,
        entityId: entity.id,
        districtId: district.id,
        completedAt: normalizedStatus === 'COMPLETED' ? new Date() : null,
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
        district: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Audit baru berhasil dibuat',
      data: audit,
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/v1/dashboard/audits/:id/action ──────────
// HANYA ADMIN: mengubah action/status audit
router.patch('/audits/:id/action', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, status, findings } = req.body;

    let nextStatus = status;

    if (!nextStatus && action) {
      const normalizedAction = String(action).toUpperCase();

      if (normalizedAction === 'COMPLETE' || normalizedAction === 'COMPLETED') {
        nextStatus = 'COMPLETED';
      } else if (normalizedAction === 'CANCEL' || normalizedAction === 'CANCELLED') {
        nextStatus = 'CANCELLED';
      } else if (normalizedAction === 'PENDING') {
        nextStatus = 'PENDING';
      } else if (normalizedAction === 'IN_PROGRESS') {
        nextStatus = 'IN_PROGRESS';
      }
    }

    if (!nextStatus) {
      return res.status(400).json({
        success: false,
        message: 'Status/action audit wajib diisi',
        allowedAction: ['COMPLETE', 'CANCEL', 'PENDING', 'IN_PROGRESS'],
        allowedStatus: allowedAuditStatus,
      });
    }

    const normalizedStatus = String(nextStatus).toUpperCase();

    if (!allowedAuditStatus.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Status audit tidak valid',
        allowedStatus: allowedAuditStatus,
      });
    }

    const existingAudit = await prisma.audit.findUnique({
      where: {
        id,
      },
    });

    if (!existingAudit) {
      return res.status(404).json({
        success: false,
        message: 'Audit tidak ditemukan',
      });
    }

    const audit = await prisma.audit.update({
      where: {
        id,
      },
      data: {
        status: normalizedStatus,
        findings: findings !== undefined ? findings : existingAudit.findings,
        completedAt: normalizedStatus === 'COMPLETED' ? new Date() : null,
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
        district: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Action audit berhasil diubah',
      data: audit,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/dashboard/flagged-clusters ─────────────
router.get('/flagged-clusters', authenticate, async (req, res, next) => {
  try {
    const clusters = await prisma.flaggedCluster.findMany({
      orderBy: {
        entityCount: 'desc',
      },
      take: 10,
      include: {
        district: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: clusters,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/dashboard/map-entities ─────────────────
router.get('/map-entities', authenticate, async (req, res, next) => {
  try {
    const entities = await prisma.entity.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        address: true,
        latitude: true,
        longitude: true,
        permitStatus: true,
        complianceScore: true,
        isFlagged: true,
        store: true,
        kelurahan: true,
        district: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
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

export default router;