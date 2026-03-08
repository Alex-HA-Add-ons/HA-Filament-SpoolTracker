import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../database';
import { LOG } from '../utils/logger';

const logger = LOG('DASHBOARD');
const router: Router = Router();

router.get('/dashboard/stats', async (_req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    const lowFilamentThreshold = 100; // grams, TODO: read from settings

    const [totalSpools, activeSpools, activePrintJobs, recentPrintJobs, lowFilamentSpools, allSpools] =
      await Promise.all([
        prisma.spool.count({ where: { isArchived: false } }),
        prisma.spool.count({ where: { isActive: true, isArchived: false } }),
        prisma.printJob.count({ where: { status: 'in_progress' } }),
        prisma.printJob.findMany({
          include: { printer: true, spool: true },
          orderBy: { startedAt: 'desc' },
          take: 10,
        }),
        prisma.spool.findMany({
          where: {
            isArchived: false,
            remainingWeight: { lte: lowFilamentThreshold },
          },
          orderBy: { remainingWeight: 'asc' },
        }),
        prisma.spool.findMany({
          where: { isArchived: false },
          select: { remainingWeight: true },
        }),
      ]);

    const totalFilamentStock = allSpools.reduce((sum, s) => sum + s.remainingWeight, 0);

    res.json({
      totalSpools,
      activeSpools,
      totalFilamentStock,
      activePrintJobs,
      lowFilamentAlerts: lowFilamentSpools.length,
      recentPrintJobs,
      lowFilamentSpools,
    });
  } catch (error) {
    logger.error('Failed to fetch dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

export default router;
