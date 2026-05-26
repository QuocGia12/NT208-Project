import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET ?? 'dev_jwt_secret_change_me';

export type AuthenticatedRequest = Request & {
  userId?: string;
  jwtUsername?: string;
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
    const decoded = jwt.verify(token, jwtSecret) as { sub: string; username: string };
    req.userId = decoded.sub;
    req.jwtUsername = decoded.username;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};
