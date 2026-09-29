// src/routes/auth.routes.js

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';

const router = Router();

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizeUsername = (username) => String(username || '').trim();

const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET belum disetting di .env');
  }

  const isAdmin = user.roleId === 1 || user.isAdmin === true;

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      roleId: user.roleId,
      isAdmin,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '1d',
    }
  );
};

const userResponse = (user) => {
  const isAdmin = user.roleId === 1 || user.isAdmin === true;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    roleId: user.roleId,
    role: user.role,
    isAdmin,
  };
};

// ─── REGISTER USER ──────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const username = normalizeUsername(req.body.username);
    const { password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Semua field wajib diisi',
      });
    }

    const existingEmail = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah digunakan',
      });
    }

    const existingUsername = await prisma.user.findUnique({
      where: {
        username,
      },
    });

    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username sudah digunakan',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        roleId: 2,
        isAdmin: false,
      },
      include: {
        role: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Register user berhasil',
      data: userResponse(user),
    });
  } catch (error) {
    console.error('REGISTER ERROR:', error);

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

// ─── REGISTER ADMIN ─────────────────────────────────────
// Route ini untuk development/testing.
// Di production, sebaiknya admin dibuat lewat seeder/database.
router.post('/register-admin', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const username = normalizeUsername(req.body.username);
    const { password, adminSecret } = req.body;

    if (process.env.ADMIN_SECRET) {
      if (adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({
          success: false,
          message: 'Admin secret salah',
        });
      }
    }

    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Semua field wajib diisi',
      });
    }

    const existingEmail = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah digunakan',
      });
    }

    const existingUsername = await prisma.user.findUnique({
      where: {
        username,
      },
    });

    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username sudah digunakan',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        roleId: 1,
        isAdmin: true,
      },
      include: {
        role: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Register admin berhasil',
      data: userResponse(admin),
    });
  } catch (error) {
    console.error('REGISTER ADMIN ERROR:', error);

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

// ─── LOGIN ──────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email dan password wajib diisi',
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Password salah',
      });
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: 'Login berhasil',
      token,
      data: userResponse(user),
    });
  } catch (error) {
    console.error('LOGIN ERROR FULL:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ─── LOGOUT ─────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logout berhasil',
    });
  } catch (error) {
    console.error('LOGOUT ERROR:', error);

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

export default router;