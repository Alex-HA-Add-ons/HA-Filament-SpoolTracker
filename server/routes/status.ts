import { Router, Request, Response } from 'express';
import { getConnectionStatus } from '../database';

const router: Router = Router();

router.get('/health', (_req: Request, res: Response) => {
  const dbStatus = getConnectionStatus();
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus.disabled
      ? { connected: false, note: 'Database not configured' }
      : { connected: dbStatus.connected }
  });
});

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    system: {
      status: 'operational',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    },
    database: getConnectionStatus()
  });
});

export default router;
