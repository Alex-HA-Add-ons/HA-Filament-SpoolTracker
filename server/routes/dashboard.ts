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

    const [totalSpools, activeSpools, registeredPrinters, activePrintJobs, recentPrintJobs, lowFilamentSpools, allSpools, activeSpoolsList, printersList, spoolsList] =
      await Promise.all([
        prisma.spool.count({ where: { archivedAt: null } }),
        prisma.spool.count({ where: { isActive: true, archivedAt: null } }),
        prisma.printer.count({ where: { isActive: true } }),
        prisma.printJob.count({ where: { status: 'in_progress' } }),
        prisma.printJob.findMany({
          include: { printer: true, spool: true },
          orderBy: { startedAt: 'desc' },
          take: 10,
        }),
        prisma.spool.findMany({
          where: {
            archivedAt: null,
            remainingWeight: { lte: lowFilamentThreshold },
          },
          orderBy: { remainingWeight: 'asc' },
        }),
        prisma.spool.findMany({
          where: { archivedAt: null },
          select: { remainingWeight: true },
        }),
        prisma.spool.findMany({
          where: { isActive: true, archivedAt: null },
          orderBy: { name: 'asc' },
        }),
        prisma.printer.findMany({
          orderBy: { name: 'asc' },
          include: { activeSpool: true },
        }),
        prisma.spool.findMany({
          where: { archivedAt: null },
          select: { id: true, name: true, filamentType: true, color: true, colorHex: true, remainingWeight: true },
          orderBy: { name: 'asc' },
        }),
      ]);

    const totalFilamentStock = allSpools.reduce((sum, s) => sum + s.remainingWeight, 0);

    const spoolIdsForPrinter = [...new Set([...lowFilamentSpools.map((s) => s.id), ...activeSpoolsList.map((s) => s.id)])];
    const printersWithSpool = spoolIdsForPrinter.length > 0
      ? await prisma.printer.findMany({
          where: { activeSpoolId: { in: spoolIdsForPrinter } },
          select: { id: true, name: true, activeSpoolId: true },
        })
      : [];
    const loadedOnBySpoolId = Object.fromEntries(
      printersWithSpool
        .filter((p) => p.activeSpoolId != null)
        .map((p) => [p.activeSpoolId!, { id: p.id, name: p.name }])
    );
    const withLoadedOn = (s: { id: string; [k: string]: unknown }[]) =>
      s.map((spool) => ({ ...spool, loadedOnPrinter: loadedOnBySpoolId[spool.id] ?? null }));

    res.json({
      totalSpools,
      activeSpools,
      totalFilamentStock,
      registeredPrinters,
      activePrintJobs,
      lowFilamentAlerts: lowFilamentSpools.length,
      recentPrintJobs,
      lowFilamentSpools: withLoadedOn(lowFilamentSpools),
      activeSpoolsList: withLoadedOn(activeSpoolsList),
      printersList,
      spoolsList,
    });
  } catch (error) {
    logger.error('Failed to fetch dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

export default router;
