// src/controllers/violations.controller.js
import prisma from '../config/database.js';

// ─── Helper ─────────────────────────────────────────────
const normalizeUpper = (value) => String(value || '').toUpperCase();

const updateEntityFlagStatus = async (entityId) => {
  const activeCount = await prisma.violation.count({
    where: {
      entityId,
      deletedAt: null,
      status: {
        in: ['ACTIVE', 'UNDER_REVIEW'],
      },
    },
  });

  await prisma.entity.update({
    where: { id: entityId },
    data: { isFlagged: activeCount > 0 },
  });
};

// ─── Soft Delete ───────────────────────────────────────
export const deleteViolation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const violation = await prisma.violation.findFirst({
      where: { id, deletedAt: null },
    });

    if (!violation)
      return res.status(404).json({ success: false, message: 'Violation not found or already deleted' });

    await prisma.violation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await updateEntityFlagStatus(violation.entityId);

    res.json({ success: true, message: 'Violation deleted (soft delete)' });
  } catch (err) {
    next(err);
  }
};

// ─── Restore Soft Deleted ──────────────────────────────
export const restoreViolation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const violation = await prisma.violation.findFirst({
      where: { id, NOT: { deletedAt: null } },
    });

    if (!violation)
      return res.status(404).json({ success: false, message: 'Violation not found in recycle bin' });

    await prisma.violation.update({
      where: { id },
      data: { deletedAt: null },
    });

    await updateEntityFlagStatus(violation.entityId);

    res.json({ success: true, message: 'Violation restored successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── GET All Violations (exclude deleted) ───────────────
export const getViolations = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { deletedAt: null };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.violation.findMany({
        where,
        include: {
          entity: true,
          district: true,
          zoningRule: true,
        },
        skip,
        take: Number(limit),
        orderBy: { detectedAt: 'desc' },
      }),
      prisma.violation.count({ where }),
    ]);

    res.json({ success: true, data, meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (err) {
    next(err);
  }
};

// ─── GET Violation By ID (exclude deleted) ─────────────
export const getViolationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const violation = await prisma.violation.findFirst({
      where: { id, deletedAt: null },
      include: { entity: true, district: true, zoningRule: true },
    });

    if (!violation) return res.status(404).json({ success: false, message: 'Violation not found' });

    res.json({ success: true, data: violation });
  } catch (err) {
    next(err);
  }
};