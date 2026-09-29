import jwt from 'jsonwebtoken';

export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - Token tidak ditemukan',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'JWT_SECRET belum disetting di .env',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      ...decoded,
      id: decoded.id || decoded.userId,
    };

    if (!req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - Token tidak memiliki user id',
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized - Token invalid',
      error: error.message,
    });
  }
};