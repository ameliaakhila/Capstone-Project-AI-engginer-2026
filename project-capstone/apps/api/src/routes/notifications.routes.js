import { Router } from 'express';
import prisma from '../config/database.js';

const router = Router();

// GET /api/v1/notifications
router.get('/', async (req, res, next) => {
  try {
    const recentViolations = await prisma.violation.findMany({
      take: 3,
      orderBy: { detectedAt: 'desc' },
      include: {
        entity: { select: { name: true } },
      },
    });

    const recentAudits = await prisma.audit.findMany({
      take: 2,
      orderBy: { createdAt: 'desc' },
      include: {
        entity: { select: { name: true } },
      },
    });

    const notifications = [];

    recentViolations.forEach((v) => {
      notifications.push({
        id: `v-${v.id}`,
        title: 'Zoning Violation',
        message: `${v.entity?.name || 'Unknown Entity'} violates rule: ${v.ruleType}`,
        time: v.detectedAt,
        isRead: false,
        type: v.severity === 'CRITICAL' || v.severity === 'HIGH' ? 'CRITICAL' : 'WARNING',
      });
    });

    recentAudits.forEach((a) => {
      notifications.push({
        id: `a-${a.id}`,
        title: 'New Audit Log',
        message: `Audit for ${a.entity?.name || 'Entity'} has been recorded.`,
        time: a.createdAt,
        isRead: false,
        type: a.priority === 'HIGH' ? 'WARNING' : 'INFO',
      });
    });

    // Sort by most recent
    notifications.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json({
      success: true,
      data: notifications,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
