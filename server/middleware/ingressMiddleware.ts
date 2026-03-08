import { Request, Response, NextFunction } from 'express';
import { LOG } from '../utils/logger';

const logger = LOG('INGRESS');

export function ingressMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.path.includes('/api/hassio_ingress/')) {
    if (req.headers.upgrade === 'websocket') {
      const ingressPath = req.path.match(/\/api\/hassio_ingress\/[^/]+\/(.*)/);
      req.url = ingressPath?.[1] ? '/' + ingressPath[1] : '/';
      logger.debug(`Ingress WS: ${req.path} -> ${req.url}`);
    } else if (req.path.includes('/api/')) {
      const ingressPath = req.path.match(/\/api\/hassio_ingress\/[^/]+\/api\/(.*)/);
      if (ingressPath?.[1]) {
        req.url = '/api/' + ingressPath[1];
        logger.debug(`Ingress API: ${req.path} -> ${req.url}`);
      }
    } else {
      const ingressPath = req.path.match(/\/api\/hassio_ingress\/[^/]+\/(.*)/);
      req.url = ingressPath?.[1] ? '/' + ingressPath[1] : '/';
      logger.debug(`Ingress static: ${req.path} -> ${req.url}`);
    }
  }
  next();
}
