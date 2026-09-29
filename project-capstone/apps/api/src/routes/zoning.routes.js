import { Router } from 'express';
import { getZoningMapPoints, calculateZoningStatus, predictZoning } from '../controllers/zoning.controller.js';

const router = Router();

// GET untuk Map (titik toko & pasar)
router.get('/points', getZoningMapPoints);

// POST untuk Calculator Zonasi
router.post('/calculate', calculateZoningStatus);

// POST untuk Prediksi ML On-the-Fly Feature Engineering
router.post('/predict', predictZoning);

export default router;