import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../database';
import { LOG } from '../utils/logger';
import type { PrintJobUpdateRequest } from '@ha-addon/types';

const logger = LOG('PRINT_JOBS');
const router: Router = Router();

router.get('/print-jobs', async (req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    const { printerId, spoolId, status, limit } = req.query;
    const where: Record<string, unknown> = {};

    if (printerId) where.printerId = printerId as string;
    if (spoolId) where.spoolId = spoolId as string;
    if (status) where.status = status as string;

    const take = limit ? parseInt(limit as string, 10) : 50;

    const printJobs = await prisma.printJob.findMany({
      where,
      include: { printer: true, spool: true },
      orderBy: { startedAt: 'desc' },
      take,
    });
    res.json(printJobs);
  } catch (error) {
    logger.error('Failed to fetch print jobs:', error);
    res.status(500).json({ error: 'Failed to fetch print jobs' });
  }
});

router.get('/print-jobs/:id', async (req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    const job = await prisma.printJob.findUnique({
      where: { id: req.params.id as string },
      include: { printer: true, spool: true },
    });
    if (!job) return res.status(404).json({ error: 'Print job not found' });
    res.json(job);
  } catch (error) {
    logger.error('Failed to fetch print job:', error);
    res.status(500).json({ error: 'Failed to fetch print job' });
  }
});

router.put('/print-jobs/:id', async (req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    const body: PrintJobUpdateRequest = req.body;
    const data: Record<string, unknown> = {};

    if (body.spoolId !== undefined) data.spoolId = body.spoolId;
    if (body.status !== undefined) data.status = body.status;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.status === 'completed' || body.status === 'failed' || body.status === 'cancelled') {
      data.completedAt = new Date();
    }

    const job = await prisma.printJob.update({
      where: { id: req.params.id as string },
      data,
      include: { printer: true, spool: true },
    });

    if (body.status === 'completed' && job.spoolId && job.filamentUsed) {
      const spool = await prisma.spool.findUnique({ where: { id: job.spoolId } });
      if (spool) {
        await prisma.spool.update({
          where: { id: job.spoolId },
          data: { remainingWeight: Math.max(0, spool.remainingWeight - job.filamentUsed) },
        });
      }
    }

    res.json(job);
  } catch (error) {
    logger.error('Failed to update print job:', error);
    res.status(500).json({ error: 'Failed to update print job' });
  }
});

router.delete('/print-jobs/:id', async (req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    await prisma.printJob.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete print job:', error);
    res.status(500).json({ error: 'Failed to delete print job' });
  }
});

export default router;
