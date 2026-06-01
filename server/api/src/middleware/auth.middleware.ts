import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

const jwtSecret = process.env.JWT_SECRET ?? 'dev_jwt_secret_change_me';

export type AuthenticatedRequest = Request & {
  userId?: string;
  jwtUsername?: string;
  userRole?: UserRole;
};

export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header.' });
  }

  const token = header.slice(7);

  try {
    const decoded = jwt.verify(token, jwtSecret) as { sub: string; username: string; role?: UserRole };
    req.userId = decoded.sub;
    req.jwtUsername = decoded.username;
    req.userRole = decoded.role ?? UserRole.USER;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.userRole !== UserRole.ADMIN) {
    return res.status(403).json({ error: 'Admin access is required.' });
  }

  next();
};
