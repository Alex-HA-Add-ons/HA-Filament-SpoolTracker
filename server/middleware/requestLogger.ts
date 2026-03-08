import { Request, Response, NextFunction } from 'express';
import { LOG } from '../utils/logger';

const logger = LOG('HTTP');

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const { statusCode } = res;
    logger.info(`${method} ${originalUrl} -> ${statusCode} ${durationMs}ms`);
  });

  next();
}
