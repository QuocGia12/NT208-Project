import { NextFunction, Request, Response } from 'express';
import { getRequestId } from '../lib/request-context';

function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  if (Array.isArray(body)) {
    return body.map(sanitizeBody);
  }

  const sensitiveKeys = ['password', 'passwordHash', 'token', 'secret', 'newPassword', 'oldPassword', 'accessToken', 'refreshToken'];
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(body)) {
    if (sensitiveKeys.some((k) => k.toLowerCase() === key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeBody(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = getRequestId();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const hasBody = req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0;
    const body = hasBody ? sanitizeBody(req.body) : undefined;

    console.log(
      JSON.stringify({
        '@timestamp': new Date().toISOString(),
        ...(requestId ? { 'request.id': requestId } : {}),
        'source.ip': req.ip,
        'http.request.method': req.method,
        'url.path': req.originalUrl,
        ...(body !== undefined ? { 'http.request.body': body } : {}),
        'http.response.status_code': res.statusCode,
        'user_agent.original': req.get('user-agent'),
        'event.duration': duration * 1_000_000
      })
    );
  });

  next();
};

