import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { isAdmin } from '../middlewares/role.middleware.js';

const router = Router();

// test authenticate middleware
router.get('/profile', authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Protected route berhasil',
    user: req.user,
  });
});

// test authenticate + admin middleware
router.get('/admin', authenticate, isAdmin, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin route berhasil',
    user: req.user,
  });
});

export default router;