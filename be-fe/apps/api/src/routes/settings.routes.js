import { Router } from 'express';
import prisma from '../config/database.js';

const router = Router();

// GET /api/v1/settings
router.get('/', async (req, res, next) => {
  try {
    const settings = await prisma.systemSetting.findMany();
    const settingsObj = {};
    settings.forEach(s => { settingsObj[s.key] = s.value; });
    res.json({ success: true, data: settingsObj });
  } catch (err) { next(err); }
});

// PATCH /api/v1/settings
router.patch('/', async (req, res, next) => {
  try {
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one setting is required',
      });
    }

    const updatedSettings = [];

    for (const [key, value] of Object.entries(updates)) {
      const setting = await prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });

      updatedSettings.push(setting);
    }

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: updatedSettings,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/settings/sync
router.post('/sync', async (req, res, next) => {
  try {
    const timestamp = new Date().toISOString();

    await prisma.systemSetting.upsert({
      where: {
        key: 'lastSyncAt',
      },
      update: {
        value: timestamp,
      },
      create: {
        key: 'lastSyncAt',
        value: timestamp,
      },
    });

    res.json({
      success: true,
      data: {
        synced: true,
        timestamp,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/settings/:key
router.get('/:key', async (req, res, next) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: {
        key: req.params.key,
      },
    });

    if (!setting) {
      return res.status(404).json({
        success: false,
        error: 'Setting not found',
      });
    }

    res.json({
      success: true,
      data: setting,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/settings/:key
router.put('/:key', async (req, res, next) => {
  try {
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Value is required',
      });
    }

    const setting = await prisma.systemSetting.upsert({
      where: {
        key: req.params.key,
      },
      update: {
        value,
      },
      create: {
        key: req.params.key,
        value,
      },
    });

    res.json({
      success: true,
      message: 'Setting saved successfully',
      data: setting,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/settings/:key
router.delete('/:key', async (req, res, next) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: {
        key: req.params.key,
      },
    });

    if (!setting) {
      return res.status(404).json({
        success: false,
        error: 'Setting not found',
      });
    }

    await prisma.systemSetting.delete({
      where: {
        key: req.params.key,
      },
    });

    res.json({
      success: true,
      message: 'Setting deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/settings/defaults
router.post('/defaults', async (req, res, next) => {
  try {
    const defaultSettings = {
      saturationThreshold: 80,
      criticalSaturationThreshold: 90,
      nearbyRadiusMeters: 500,
      maxEntitiesPerZone: 20,
      minDistanceMeters: 500,
      defaultForecastMonths: 6,
      complianceWarningScore: 60,
      complianceCriticalScore: 40,
    };

    const settings = [];

    for (const [key, value] of Object.entries(defaultSettings)) {
      const setting = await prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });

      settings.push(setting);
    }

    res.status(201).json({
      success: true,
      message: 'Default settings created successfully',
      data: settings,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/settings
router.patch('/', async (req, res, next) => {
  try {
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one setting is required',
      });
    }

    const updatedSettings = [];

    for (const [key, value] of Object.entries(updates)) {
      const setting = await prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });

      updatedSettings.push(setting);
    }

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: updatedSettings,
    });
  } catch (err) {
    next(err);
  }
});



export default router;
