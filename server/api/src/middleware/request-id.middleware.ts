import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { asyncLocalStorage } from '../lib/request-context';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const headerReqId = req.header('x-request-id');
  const requestId = (typeof headerReqId === 'string' && headerReqId) || `req-${crypto.randomUUID()}`;

  res.setHeader('x-request-id', requestId);

  asyncLocalStorage.run({ requestId }, () => {
    next();
  });
};
