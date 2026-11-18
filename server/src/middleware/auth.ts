import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const DEV_SECRET = 'fitpulse-dev-secret-change-me';

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not set. Add a long random string to the environment.');
  }
  console.warn('⚠️  JWT_SECRET not set — using an insecure development secret');
}

const JWT_SECRET: string = process.env.JWT_SECRET || DEV_SECRET;

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: { user_id: number; role: string; member_id?: number; trainer_id?: number };
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role))
      return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}

export { JWT_SECRET };
