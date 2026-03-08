import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../database';
import { LOG } from '../utils/logger';
import type { PrinterCreateRequest, PrinterUpdateRequest } from '@ha-addon/types';

const logger = LOG('PRINTERS');
const router: Router = Router();

router.get('/printers', async (_req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    const printers = await prisma.printer.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(printers);
  } catch (error) {
    logger.error('Failed to fetch printers:', error);
    res.status(500).json({ error: 'Failed to fetch printers' });
  }
});

router.post('/printers', async (req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    const body: PrinterCreateRequest = req.body;
    const printer = await prisma.printer.create({
      data: {
        name: body.name,
        haDeviceId: body.haDeviceId,
        entityPrefix: body.entityPrefix,
        model: body.model,
      },
    });
    res.status(201).json(printer);
  } catch (error) {
    logger.error('Failed to create printer:', error);
    res.status(500).json({ error: 'Failed to create printer' });
  }
});

router.put('/printers/:id', async (req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    const body: PrinterUpdateRequest = req.body;
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = body.name;
    if (body.haDeviceId !== undefined) data.haDeviceId = body.haDeviceId;
    if (body.entityPrefix !== undefined) data.entityPrefix = body.entityPrefix;
    if (body.model !== undefined) data.model = body.model;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const printer = await prisma.printer.update({
      where: { id: req.params.id as string },
      data,
    });
    res.json(printer);
  } catch (error) {
    logger.error('Failed to update printer:', error);
    res.status(500).json({ error: 'Failed to update printer' });
  }
});

router.delete('/printers/:id', async (req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    await prisma.printer.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete printer:', error);
    res.status(500).json({ error: 'Failed to delete printer' });
  }
});

export default router;
