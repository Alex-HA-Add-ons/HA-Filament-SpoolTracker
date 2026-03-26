import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../database';
import { LOG } from '../utils/logger';
import type { PrinterCreateRequest, PrinterUpdateRequest } from '@ha-addon/types';
import { publishAllSpooltrackerHASensors } from '../services/haSensors';
import { assignActiveSpoolToPrinter, AssignSpoolError } from '../services/assignActiveSpool';

const logger = LOG('PRINTERS');
const router: Router = Router();

router.get('/printers', async (_req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    const printers = await prisma.printer.findMany({
      orderBy: { name: 'asc' },
      include: { activeSpool: true },
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
    type PrinterCreateData = Parameters<typeof prisma.printer.create>[0]['data'];
    const printer = await prisma.printer.create({
      data: {
        name: body.name,
        haDeviceId: body.haDeviceId,
        entityPrefix: body.entityPrefix,
        model: body.model,
        activeSpoolId: body.activeSpoolId ?? undefined,
        entityPrintStatus: body.entityPrintStatus ?? undefined,
        entityTaskName: body.entityTaskName ?? undefined,
        entityPrintWeight: body.entityPrintWeight ?? undefined,
        entityCoverImage: body.entityCoverImage ?? undefined,
        entityPrintStart: body.entityPrintStart ?? undefined,
      } as unknown as PrinterCreateData,
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

  const id = req.params.id as string;

  try {
    const body: PrinterUpdateRequest = req.body;

    let printer: Awaited<ReturnType<typeof assignActiveSpoolToPrinter>> | undefined;

    if (body.activeSpoolId !== undefined) {
      printer = await assignActiveSpoolToPrinter(prisma, id, body.activeSpoolId);
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.haDeviceId !== undefined) data.haDeviceId = body.haDeviceId;
    if (body.entityPrefix !== undefined) data.entityPrefix = body.entityPrefix;
    if (body.model !== undefined) data.model = body.model;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.entityPrintStatus !== undefined) data.entityPrintStatus = body.entityPrintStatus;
    if (body.entityTaskName !== undefined) data.entityTaskName = body.entityTaskName;
    if (body.entityPrintWeight !== undefined) data.entityPrintWeight = body.entityPrintWeight;
    if (body.entityCoverImage !== undefined) data.entityCoverImage = body.entityCoverImage;
    if (body.entityPrintStart !== undefined) data.entityPrintStart = body.entityPrintStart;

    if (Object.keys(data).length > 0) {
      type PrinterUpdateData = Parameters<typeof prisma.printer.update>[0]['data'];
      printer = await prisma.printer.update({
        where: { id },
        data: data as unknown as PrinterUpdateData,
        include: { activeSpool: true },
      });
    }

    if (!printer) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    await publishAllSpooltrackerHASensors();
    res.json(printer);
  } catch (error) {
    if (error instanceof AssignSpoolError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
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
