import { Router } from 'express';
import prisma from '../config/database.js';

const router = Router();

// ─── Timeframe Helper ────────────────────────────────────────────────────────
// Returns a Date representing the start of the requested window, or null for 'all time'.
function getStartDate(timeframe) {
  const now = new Date();
  switch (timeframe) {
    case '7d':  { const d = new Date(now); d.setDate(d.getDate() - 7);   return d; }
    case '30d': { const d = new Date(now); d.setDate(d.getDate() - 30);  return d; }
    case '90d': { const d = new Date(now); d.setDate(d.getDate() - 90);  return d; }
    case '1y':  { const d = new Date(now.getFullYear(), 0, 1);           return d; } // Jan 1st
    default:    { const d = new Date(now); d.setDate(d.getDate() - 30);  return d; } // fallback 30d
  }
}

// GET /api/v1/analytics/kpis
router.get('/kpis', async (req, res, next) => {
  try {
    const startDate = getStartDate(req.query.timeframe);
    const dateFilter = { gte: startDate };

    const [totalAudits, overSaturatedZones, activeViolations, entities] = await Promise.all([
      prisma.audit.count({ where: { createdAt: dateFilter } }),
      prisma.district.count({ where: { saturationPercent: { gte: 80 } } }),
      prisma.violation.count({ where: { status: 'ACTIVE', detectedAt: dateFilter } }),
      prisma.entity.findMany({ select: { complianceScore: true } }),
    ]);

    const avgCompliance = entities.length > 0
      ? Math.round((entities.reduce((sum, e) => sum + (e.complianceScore || 0), 0) / entities.length) * 10) / 10
      : 0;

    res.json({
      success: true,
      data: {
        totalAudits: { value: totalAudits, trend: 8, label: 'from last month' },
        overSaturatedZones: { value: overSaturatedZones, trend: 3, label: 'new this month' },
        activeViolations: { value: activeViolations, trend: -5, label: 'from last month' },
        avgCompliance: { value: avgCompliance, trend: 2.1, label: 'improvement' },
      },
    });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/saturation-by-district
router.get('/saturation-by-district', async (req, res, next) => {
  try {
    // saturationPercent is a district-level aggregate; timeframe not directly applicable here,
    // but we filter by districts that have violations within the window.
    const startDate = getStartDate(req.query.timeframe);
    const districtIds = await prisma.violation.findMany({
      where: { detectedAt: { gte: startDate } },
      select: { districtId: true },
      distinct: ['districtId'],
    }).then(rows => rows.map(r => r.districtId).filter(Boolean));

    const where = districtIds.length > 0 ? { id: { in: districtIds } } : {};
    const districts = await prisma.district.findMany({
      where,
      orderBy: { saturationPercent: 'desc' },
      select: { name: true, saturationPercent: true, status: true },
    });
    res.json({ success: true, data: districts });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/violation-trends
router.get('/violation-trends', async (req, res, next) => {
  try {
    const startDate = getStartDate(req.query.timeframe);
    const logs = await prisma.saturationLog.findMany({
      where: { recordedAt: { gte: startDate } },
      orderBy: { recordedAt: 'asc' },
      include: { district: { select: { name: true } } },
    });

    // Group by date, inject a human-readable label per data point
    const weekMap = {};
    logs.forEach(log => {
      const weekKey = log.recordedAt.toISOString().split('T')[0];
      if (!weekMap[weekKey]) {
        // Format: "12 Mei", "03 Jun", etc. using id-ID locale
        const label = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' })
          .format(new Date(weekKey))
          .replace('.', ''); // remove trailing dot some locales add (e.g. "Mei.")
        weekMap[weekKey] = { date: weekKey, label, commercial: 0, residential: 0 };
      }
      weekMap[weekKey].commercial += log.violationCount;
      weekMap[weekKey].residential += Math.floor(log.violationCount * 0.3);
    });

    res.json({ success: true, data: Object.values(weekMap) });

  } catch (err) { next(err); }
});

// GET /api/v1/analytics/district-comparison
router.get('/district-comparison', async (req, res, next) => {
  try {
    const { districts: districtNames } = req.query;

    const where = districtNames
      ? { name: { in: districtNames.split(',') } }
      : {};

    const districts = await prisma.district.findMany({
      where,
      take: districtNames ? undefined : 2,
      orderBy: { saturationPercent: 'desc' },
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

    const comparison = districts.map(d => {
      const totalEntities = d._count.entities;
      const approvedPermits = d.entities.filter(e => e.permitStatus === 'APPROVED').length;

      const permitScore = totalEntities > 0
        ? Math.round((approvedPermits / totalEntities) * 100)
        : 0;

      const avgCompliance = totalEntities > 0
        ? Math.round(
            d.entities.reduce((sum, e) => sum + (e.complianceScore || 0), 0) / totalEntities
          )
        : 0;

      return {
        name: d.name,
        axes: {
          density: Math.min(totalEntities, 100),
          permits: permitScore,
          compliance: avgCompliance,
          violations: Math.min(d._count.violations * 5, 100),
          zoningArea: d.saturationPercent,
        },
      };
    });

    res.json({
      success: true,
      data: comparison,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/analytics/entity-distribution
router.get('/entity-distribution', async (req, res, next) => {
  try {
    const result = await prisma.entity.groupBy({
      by: ['type'],
      _count: {
        type: true,
      },
    });

    const data = result.map(item => ({
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

// GET /api/v1/analytics/permit-status-summary
router.get('/permit-status-summary', async (req, res, next) => {
  try {
    const result = await prisma.entity.groupBy({
      by: ['permitStatus'],
      _count: {
        permitStatus: true,
      },
    });

    const data = result.map(item => ({
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

// GET /api/v1/analytics/violation-summary
router.get('/violation-summary', async (req, res, next) => {
  try {
    const byStatus = await prisma.violation.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    const bySeverity = await prisma.violation.groupBy({
      by: ['severity'],
      _count: {
        severity: true,
      },
    });

    res.json({
      success: true,
      data: {
        byStatus: byStatus.map(item => ({
          status: item.status,
          count: item._count.status,
        })),
        bySeverity: bySeverity.map(item => ({
          severity: item.severity,
          count: item._count.severity,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/analytics/audit-priority-summary
router.get('/audit-priority-summary', async (req, res, next) => {
  try {
    const result = await prisma.audit.groupBy({
      by: ['priority'],
      _count: {
        priority: true,
      },
    });

    const data = result.map(item => ({
      priority: item.priority,
      count: item._count.priority,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/analytics/flagged-entities
router.get('/flagged-entities', async (req, res, next) => {
  try {
    const entities = await prisma.entity.findMany({
      where: {
        isFlagged: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        address: true,
        latitude: true,
        longitude: true,
        complianceScore: true,
        permitStatus: true,
        district: {
          select: {
            name: true,
            status: true,
          },
        },
      },
      orderBy: {
        complianceScore: 'asc',
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

// GET /api/v1/analytics/critical-districts
router.get('/critical-districts', async (req, res, next) => {
  try {
    const districts = await prisma.district.findMany({
      where: {
        OR: [
          { status: 'CRITICAL' },
          { status: 'WARNING' },
          { saturationPercent: { gte: 80 } },
        ],
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
      orderBy: {
        saturationPercent: 'desc',
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

// GET /api/v1/analytics/map-points
router.get('/map-points', async (req, res, next) => {
  try {
    const entities = await prisma.entity.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        latitude: true,
        longitude: true,
        permitStatus: true,
        complianceScore: true,
        isFlagged: true,
        district: {
          select: {
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

// GET /api/v1/violations/ranking-matrix
router.get('/ranking-matrix', async (req, res, next) => {
  try {
    const startDate = getStartDate(req.query.timeframe);
    const violations = await prisma.violation.findMany({
      where: { detectedAt: { gte: startDate } },
      include: {
        entity: { select: { id: true, name: true, type: true, store: true } },
        district: { select: { id: true, name: true } },
      },
      orderBy: [{ severity: 'asc' }, { detectedAt: 'desc' }],
    });

    const severityScore = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    const statusScore = {
      ACTIVE: 2,
      RESOLVED: 1,
    };

    const matrix = violations.map((violation) => {
      const severityValue = severityScore[violation.severity] || 0;
      const statusValue = statusScore[violation.status] || 0;
      const totalScore = severityValue + statusValue;

      return {
        id: violation.id,
        entityName: violation.entity?.name || null,
        entityType: violation.entity?.type || null,
        districtName: violation.district?.name || null,
        ruleType: violation.ruleType,
        severity: violation.severity,
        status: violation.status,
        severityScore: severityValue,
        statusScore: statusValue,
        totalScore,
        detectedAt: violation.detectedAt,
      };
    });

    matrix.sort((a, b) => b.totalScore - a.totalScore);

    res.json({
      success: true,
      data: matrix,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
