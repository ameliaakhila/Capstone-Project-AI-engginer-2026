import { Router } from 'express';
import prisma from '../config/database.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { isAdmin } from '../middlewares/role.middleware.js';

const router = Router();

const allowedStatuses = ['ACTIVE', 'UNDER_REVIEW', 'RESOLVED'];
const allowedSeverities = ['CRITICAL', 'WARNING', 'ELEVATED', 'STABLE'];
const allowedRuleTypes = ['PROXIMITY', 'DENSITY', 'CAPACITY'];

const normalizeUpper = (value) => String(value || '').toUpperCase();

const updateEntityFlagStatus = async (entityId) => {
  const activeCount = await prisma.violation.count({
    where: {
      entityId,
      deletedAt: null, // ← exclude soft deleted
      status: { in: ['ACTIVE', 'UNDER_REVIEW'] },
    },
  });
  await prisma.entity.update({
    where: { id: entityId },
    data: { isFlagged: activeCount > 0 },
  });
};

// ─── GET /api/v1/violations ─────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, severity, ruleType, districtId, entityId, search, page = 1, limit = 10 } = req.query;

    const where = { deletedAt: null }; // ← exclude soft deleted

    if (status) {
      const upperStatus = normalizeUpper(status);
      if (!allowedStatuses.includes(upperStatus))
        return res.status(400).json({ success: false, error: 'Invalid violation status' });
      where.status = upperStatus;
    }

    if (severity) {
      const upperSeverity = normalizeUpper(severity);
      if (!allowedSeverities.includes(upperSeverity))
        return res.status(400).json({ success: false, error: 'Invalid severity' });
      where.severity = upperSeverity;
    }

    if (ruleType) {
      const upperRuleType = normalizeUpper(ruleType);
      if (!allowedRuleTypes.includes(upperRuleType))
        return res.status(400).json({ success: false, error: 'Invalid rule type' });
      where.ruleType = upperRuleType;
    }

    if (districtId) where.districtId = districtId;
    if (entityId) where.entityId = entityId;

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { entity: { name: { contains: search, mode: 'insensitive' } } },
        { district: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const pageNumber = Math.max(parseInt(page), 1);
    const limitNumber = Math.min(Math.max(parseInt(limit), 1), 100);
    const skip = (pageNumber - 1) * limitNumber;

    const [violations, total] = await Promise.all([
      prisma.violation.findMany({
        where, skip, take: limitNumber,
        include: {
          entity: { select: { id: true, name: true, type: true, store: true, address: true } },
          district: { select: { id: true, name: true, code: true } },
          zoningRule: { select: { id: true, name: true, ruleType: true, minDistanceMeters: true, maxEntitiesPerZone: true } },
        },
        orderBy: { detectedAt: 'desc' },
      }),
      prisma.violation.count({ where }),
    ]);

    res.json({ success: true, data: violations, meta: { total, page: pageNumber, limit: limitNumber, totalPages: Math.ceil(total / limitNumber) } });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/violations/summary ─────────────────────
router.get('/summary', authenticate, async (req, res, next) => {
  try {
    const baseWhere = { deletedAt: null }; // ← exclude soft deleted

    const [byStatus, bySeverity, byRuleType, totalActive, totalResolved] = await Promise.all([
      prisma.violation.groupBy({ by: ['status'], where: baseWhere, _count: { status: true } }),
      prisma.violation.groupBy({ by: ['severity'], where: baseWhere, _count: { severity: true } }),
      prisma.violation.groupBy({ by: ['ruleType'], where: baseWhere, _count: { ruleType: true } }),
      prisma.violation.count({ where: { ...baseWhere, status: 'ACTIVE' } }),
      prisma.violation.count({ where: { ...baseWhere, status: 'RESOLVED' } }),
    ]);

    res.json({
      success: true,
      data: {
        totalActive, totalResolved,
        byStatus: byStatus.map(i => ({ status: i.status, count: i._count.status })),
        bySeverity: bySeverity.map(i => ({ severity: i.severity, count: i._count.severity })),
        byRuleType: byRuleType.map(i => ({ ruleType: i.ruleType, count: i._count.ruleType })),
      },
    });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/violations/trash ───────────────────────
// Admin only: lihat data yang sudah di-soft delete (recycle bin)
router.get('/trash', authenticate, isAdmin, async (req, res, next) => {
  try {
    const violations = await prisma.violation.findMany({
      where: { deletedAt: { not: null } },
      include: {
        entity: { select: { id: true, name: true, type: true } },
        district: { select: { id: true, name: true } },
      },
      orderBy: { deletedAt: 'desc' },
    });

    res.json({ success: true, data: violations });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/violations/:id ─────────────────────────
router.patch('/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    const {
      status,
      severity,
      distanceM,
    } = req.body;

    const data = {};

    if (status !== undefined)
      data.status = normalizeUpper(status);

    if (severity !== undefined)
      data.severity = normalizeUpper(severity);

    if (distanceM !== undefined)
      data.distanceM = Number(distanceM);

    const existing = await prisma.violation.findFirst({
      where: {
        id: req.params.id,
        deletedAt: null
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Violation not found'
      });
    }

    const updated = await prisma.violation.update({
      where: { id: req.params.id },
      data
    });

    await updateEntityFlagStatus(updated.entityId);

    res.json({ success: true, data: updated });

  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/v1/violations/:id/resolve ───────────────
router.patch('/:id/resolve', authenticate, isAdmin, async (req, res, next) => {
  try {
    const existing = await prisma.violation.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) return res.status(404).json({ success: false, error: 'Violation not found' });

    const violation = await prisma.violation.update({
      where: { id: req.params.id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });

    await updateEntityFlagStatus(violation.entityId);
    res.json({ success: true, message: 'Violation resolved successfully', data: violation });
  } catch (err) { next(err); }
});

// ─── PATCH /api/v1/violations/:id/status ────────────────
router.patch('/:id/status', authenticate, isAdmin, async (req, res, next) => {
  try {
    const status = normalizeUpper(req.body.status);
    if (!allowedStatuses.includes(status))
      return res.status(400).json({ success: false, error: 'Invalid violation status', allowedStatuses });

    const existing = await prisma.violation.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) return res.status(404).json({ success: false, error: 'Violation not found' });

    const violation = await prisma.violation.update({
      where: { id: req.params.id },
      data: { status, resolvedAt: status === 'RESOLVED' ? new Date() : null },
    });

    await updateEntityFlagStatus(violation.entityId);
    res.json({ success: true, message: 'Violation status updated successfully', data: violation });
  } catch (err) { next(err); }
});

// ─── PATCH /api/v1/violations/:id/action ────────────────
router.patch('/:id/action', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { action, status } = req.body;
    let nextStatus = status;

    if (!nextStatus && action) {
      const a = normalizeUpper(action);
      if (a === 'RESOLVE' || a === 'RESOLVED') nextStatus = 'RESOLVED';
      if (a === 'REVIEW' || a === 'UNDER_REVIEW') nextStatus = 'UNDER_REVIEW';
      if (a === 'REOPEN' || a === 'ACTIVE') nextStatus = 'ACTIVE';
    }

    nextStatus = normalizeUpper(nextStatus);
    if (!allowedStatuses.includes(nextStatus))
      return res.status(400).json({ success: false, error: 'Invalid action/status', allowedActions: ['RESOLVE', 'REVIEW', 'REOPEN'], allowedStatuses });

    const existing = await prisma.violation.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) return res.status(404).json({ success: false, error: 'Violation not found' });

    const violation = await prisma.violation.update({
      where: { id: req.params.id },
      data: { status: nextStatus, resolvedAt: nextStatus === 'RESOLVED' ? new Date() : null },
      include: {
        entity: { select: { id: true, name: true, type: true, store: true, address: true, isFlagged: true } },
        district: { select: { id: true, name: true, code: true } },
        zoningRule: true,
      },
    });

    await updateEntityFlagStatus(violation.entityId);
    res.json({ success: true, message: 'Violation action updated successfully', data: violation });
  } catch (err) { next(err); }
});

// ─── PATCH /api/v1/violations/:id/restore ───────────────
// ─── RESTORE /api/v1/violations/:id/restore ───────────────
// Restore dari recycle bin (Support PATCH, PUT, dan POST sekaligus)
const restoreHandler = async (req, res, next) => {
  try {
    const violation = await prisma.violation.findFirst({
      where: {
        id: req.params.id,
        NOT: { deletedAt: null } // Kueri Prisma paling aman
      },
    });

    if (!violation) {
      return res.status(404).json({ success: false, error: 'Data tidak ditemukan di tong sampah (recycle bin)' });
    }

    await prisma.violation.update({
      where: { id: req.params.id },
      data: { deletedAt: null },
    });

    await updateEntityFlagStatus(violation.entityId);
    res.json({ success: true, message: 'Violation restored successfully' });
  } catch (err) {
    next(err);
  }
};

// Daftarkan ke semua metode HTTP yang mungkin dipakai Frontend
router.patch('/:id/restore', authenticate, isAdmin, restoreHandler);
router.put('/:id/restore', authenticate, isAdmin, restoreHandler);
router.post('/:id/restore', authenticate, isAdmin, restoreHandler);
// ─── PATCH /api/v1/violations/:id ───────────────────────
router.patch('/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { status, severity } = req.body;
    const data = {};
    if (status) data.status = normalizeUpper(status);
    if (severity) data.severity = normalizeUpper(severity);

    const existing = await prisma.violation.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) return res.status(404).json({ success: false, error: 'Violation not found' });

    const updated = await prisma.violation.update({ where: { id: req.params.id }, data });
    await updateEntityFlagStatus(updated.entityId);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ─── POST /api/v1/violations ────────────────────────────
router.post('/', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { code, description, ruleType = 'PROXIMITY', severity = 'WARNING', status = 'ACTIVE', distanceM, entityId, districtId, zoningRuleId } = req.body;

    if (!code || !description || !entityId || !districtId)
      return res.status(400).json({ success: false, error: 'code, description, entityId, dan districtId wajib diisi' });

    const upperRuleType = normalizeUpper(ruleType);
    const upperSeverity = normalizeUpper(severity);
    const upperStatus = normalizeUpper(status);

    if (!allowedRuleTypes.includes(upperRuleType)) return res.status(400).json({ success: false, error: 'Invalid rule type', allowedRuleTypes });
    if (!allowedSeverities.includes(upperSeverity)) return res.status(400).json({ success: false, error: 'Invalid severity', allowedSeverities });
    if (!allowedStatuses.includes(upperStatus)) return res.status(400).json({ success: false, error: 'Invalid violation status', allowedStatuses });

    const entity = await prisma.entity.findUnique({ where: { id: entityId } });
    if (!entity) return res.status(404).json({ success: false, error: 'Entity not found' });

    const district = await prisma.district.findUnique({ where: { id: districtId } });
    if (!district) return res.status(404).json({ success: false, error: 'District not found' });

    if (zoningRuleId) {
      const zoningRule = await prisma.zoningRule.findUnique({ where: { id: zoningRuleId } });
      if (!zoningRule) return res.status(404).json({ success: false, error: 'Zoning rule not found' });
    }

    const violation = await prisma.violation.create({
      data: {
        code, description,
        ruleType: upperRuleType,
        severity: upperSeverity,
        status: upperStatus,
        distanceM: distanceM !== undefined ? Number(distanceM) : null,
        entityId, districtId,
        zoningRuleId: zoningRuleId || null,
        resolvedAt: upperStatus === 'RESOLVED' ? new Date() : null,
        deletedAt: null, // ← explicit null saat create
      },
      include: {
        entity: { select: { id: true, name: true, type: true } },
        district: { select: { id: true, name: true, status: true } },
        zoningRule: true,
      },
    });

    await updateEntityFlagStatus(entityId);
    res.status(201).json({ success: true, message: 'Violation created successfully', data: violation });
  } catch (err) { next(err); }
});

// ─── PUT /api/v1/violations/:id ─────────────────────────
router.put('/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { code, description, ruleType, severity, status, distanceM, entityId, districtId, zoningRuleId, resolvedAt } = req.body;

    const existingViolation = await prisma.violation.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existingViolation) return res.status(404).json({ success: false, error: 'Violation not found' });

    if (entityId) {
      const entity = await prisma.entity.findUnique({ where: { id: entityId } });
      if (!entity) return res.status(404).json({ success: false, error: 'Entity not found' });
    }
    if (districtId) {
      const district = await prisma.district.findUnique({ where: { id: districtId } });
      if (!district) return res.status(404).json({ success: false, error: 'District not found' });
    }
    if (zoningRuleId) {
      const zoningRule = await prisma.zoningRule.findUnique({ where: { id: zoningRuleId } });
      if (!zoningRule) return res.status(404).json({ success: false, error: 'Zoning rule not found' });
    }

    const data = {};
    if (code !== undefined) data.code = code;
    if (description !== undefined) data.description = description;
    if (ruleType !== undefined) {
      const upperRuleType = normalizeUpper(ruleType);
      if (!allowedRuleTypes.includes(upperRuleType)) return res.status(400).json({ success: false, error: 'Invalid rule type', allowedRuleTypes });
      data.ruleType = upperRuleType;
    }
    if (severity !== undefined) {
      const upperSeverity = normalizeUpper(severity);
      if (!allowedSeverities.includes(upperSeverity)) return res.status(400).json({ success: false, error: 'Invalid severity', allowedSeverities });
      data.severity = upperSeverity;
    }
    if (status !== undefined) {
      const upperStatus = normalizeUpper(status);
      if (!allowedStatuses.includes(upperStatus)) return res.status(400).json({ success: false, error: 'Invalid violation status', allowedStatuses });
      data.status = upperStatus;
      data.resolvedAt = upperStatus === 'RESOLVED' ? new Date() : null;
    }
    if (distanceM !== undefined) data.distanceM = Number(distanceM);
    if (entityId !== undefined) data.entityId = entityId;
    if (districtId !== undefined) data.districtId = districtId;
    if (zoningRuleId !== undefined) data.zoningRuleId = zoningRuleId || null;
    if (resolvedAt !== undefined) data.resolvedAt = resolvedAt ? new Date(resolvedAt) : null;

    const violation = await prisma.violation.update({
      where: { id: req.params.id }, data,
      include: {
        entity: { select: { id: true, name: true, type: true } },
        district: { select: { id: true, name: true } },
        zoningRule: true,
      },
    });

    await updateEntityFlagStatus(violation.entityId);
    if (existingViolation.entityId !== violation.entityId) await updateEntityFlagStatus(existingViolation.entityId);

    res.json({ success: true, message: 'Violation updated successfully', data: violation });
  } catch (err) { next(err); }
});

// ─── DELETE /api/v1/violations/:id ──────────────────────
// Soft delete — set deletedAt, bukan hapus dari DB
router.delete('/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    const violation = await prisma.violation.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });

    if (!violation)
      return res.status(404).json({ success: false, error: 'Violation not found or already deleted' });

    await prisma.violation.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() }, // ← soft delete
    });

    await updateEntityFlagStatus(violation.entityId);
    res.json({ success: true, message: 'Violation deleted (soft delete)' });
  } catch (err) { next(err); }
});

export default router;