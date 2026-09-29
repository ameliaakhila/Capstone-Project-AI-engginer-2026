import prisma from '../config/database.js';

export const isAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - User belum login',
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
      select: {
        id: true,
        email: true,
        username: true,
        roleId: true,
        isAdmin: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - User tidak ditemukan',
      });
    }

    const adminAccess = user.isAdmin === true || Number(user.roleId) === 1;

    if (!adminAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - Admin only',
      });
    }

    req.user = {
      ...req.user,
      id: user.id,
      email: user.email,
      username: user.username,
      roleId: user.roleId,
      isAdmin: adminAccess,
    };

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Role middleware error',
      error: error.message,
    });
  }
};