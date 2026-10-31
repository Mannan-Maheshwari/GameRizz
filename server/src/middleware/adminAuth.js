import jwt from 'jsonwebtoken';
import { env } from '../config/environment.js';

export function adminAuth(req, res, next) {
  const token = req.cookies?.admin_token || req.headers.authorization?.replace(/^Bearer\s+/, '');

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' }
    });
  }

  try {
    const decoded = jwt.verify(token, env.ADMIN_JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient privileges.' }
      });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Session expired or invalid.' }
    });
  }
}
