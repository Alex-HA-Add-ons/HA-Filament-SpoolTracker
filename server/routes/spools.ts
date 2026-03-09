import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../database';
import { LOG } from '../utils/logger';
import type { SpoolCreateRequest, SpoolUpdateRequest, DeductionRequest } from '@ha-addon/types';
import { publishActiveSpoolSensor } from '../services/haSensors';

const logger = LOG('SPOOLS');
const router: Router = Router();

router.get('/spools', async (req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    const { status } = req.query;
    const where: Record<string, unknown> = {};
    if (status === 'active') { where.isActive = true; where.isArchived = false; }
    else if (status === 'archived') { where.isArchived = true; }
    else { where.isArchived = false; }

    const spools = await prisma.spool.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
    const printersWithSpool = await prisma.printer.findMany({
      where: { activeSpoolId: { in: spools.map((s) => s.id) } },
      select: { id: true, name: true, activeSpoolId: true },
    });
    const loadedOnBySpoolId = Object.fromEntries(
      printersWithSpool
        .filter((p) => p.activeSpoolId != null)
        .map((p) => [p.activeSpoolId!, { id: p.id, name: p.name }])
    );
    const result = spools.map((s) => ({
      ...s,
      loadedOnPrinter: loadedOnBySpoolId[s.id] ?? null,
    }));
    res.json(result);
  } catch (error) {
    logger.error('Failed to fetch spools:', error);
    res.status(500).json({ error: 'Failed to fetch spools' });
  }
});

router.get('/spools/:id', async (req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    const spool = await prisma.spool.findUnique({
      where: { id: req.params.id as string },
      include: { printJobs: { orderBy: { startedAt: 'desc' }, take: 10 } },
    });
    if (!spool) return res.status(404).json({ error: 'Spool not found' });
    res.json(spool);
  } catch (error) {
    logger.error('Failed to fetch spool:', error);
    res.status(500).json({ error: 'Failed to fetch spool' });
  }
});

router.post('/spools', async (req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    const body: SpoolCreateRequest = req.body;
    const spool = await prisma.spool.create({
      data: {
        name: body.name,
        filamentType: body.filamentType,
        color: body.color,
        colorHex: body.colorHex,
        manufacturer: body.manufacturer,
        initialWeight: body.initialWeight,
        remainingWeight: body.remainingWeight ?? body.initialWeight,
        spoolWeight: body.spoolWeight,
        diameter: body.diameter ?? 1.75,
        expirationDate: body.expirationDate ? new Date(body.expirationDate) : null,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
        notes: body.notes,
      },
    });
    res.status(201).json(spool);
  } catch (error) {
    logger.error('Failed to create spool:', error);
    res.status(500).json({ error: 'Failed to create spool' });
  }
});

router.put('/spools/:id', async (req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    const body: SpoolUpdateRequest = req.body;
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = body.name;
    if (body.filamentType !== undefined) data.filamentType = body.filamentType;
    if (body.color !== undefined) data.color = body.color;
    if (body.colorHex !== undefined) data.colorHex = body.colorHex;
    if (body.manufacturer !== undefined) data.manufacturer = body.manufacturer;
    if (body.initialWeight !== undefined) data.initialWeight = body.initialWeight;
    if (body.remainingWeight !== undefined) data.remainingWeight = body.remainingWeight;
    if (body.spoolWeight !== undefined) data.spoolWeight = body.spoolWeight;
    if (body.diameter !== undefined) data.diameter = body.diameter;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.isArchived !== undefined) data.isArchived = body.isArchived;
    if (body.expirationDate !== undefined) data.expirationDate = body.expirationDate ? new Date(body.expirationDate) : null;
    if (body.purchaseDate !== undefined) data.purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : null;
    if (body.notes !== undefined) data.notes = body.notes;

    const spool = await prisma.spool.update({
      where: { id: req.params.id as string },
      data,
    });
    await publishActiveSpoolSensor();
    res.json(spool);
  } catch (error) {
    logger.error('Failed to update spool:', error);
    res.status(500).json({ error: 'Failed to update spool' });
  }
});

router.delete('/spools/:id', async (req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    await prisma.spool.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete spool:', error);
    res.status(500).json({ error: 'Failed to delete spool' });
  }
});

router.post('/spools/:id/deduct', async (req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    const { amount }: DeductionRequest = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const spool = await prisma.spool.findUnique({ where: { id: req.params.id as string } });
    if (!spool) return res.status(404).json({ error: 'Spool not found' });

    const newWeight = Math.max(0, spool.remainingWeight - amount);
    const updated = await prisma.spool.update({
      where: { id: req.params.id as string },
      data: { remainingWeight: newWeight },
    });
    await publishActiveSpoolSensor();
    res.json(updated);
  } catch (error) {
    logger.error('Failed to deduct filament:', error);
    res.status(500).json({ error: 'Failed to deduct filament' });
  }
});

router.post('/spools/:id/archive', async (req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    const spool = await prisma.spool.update({
      where: { id: req.params.id as string },
      data: { isArchived: true, isActive: false },
    });
    await publishActiveSpoolSensor();
    res.json(spool);
  } catch (error) {
    logger.error('Failed to archive spool:', error);
    res.status(500).json({ error: 'Failed to archive spool' });
  }
});

router.post('/spools/:id/activate', async (req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    const spool = await prisma.spool.update({
      where: { id: req.params.id as string },
      data: { isActive: true, isArchived: false },
    });
    await publishActiveSpoolSensor();
    res.json(spool);
  } catch (error) {
    logger.error('Failed to activate spool:', error);
    res.status(500).json({ error: 'Failed to activate spool' });
  }
});

export default router;
