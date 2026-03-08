import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../database';
import { LOG } from '../utils/logger';

const logger = LOG('SETTINGS');
const router: Router = Router();

router.get('/settings', async (_req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    const settings = await prisma.setting.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    res.json(result);
  } catch (error) {
    logger.error('Failed to fetch settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/settings', async (req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  try {
    const body: Record<string, string> = req.body;
    const operations = Object.entries(body).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    );
    await Promise.all(operations);

    const settings = await prisma.setting.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    res.json(result);
  } catch (error) {
    logger.error('Failed to update settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
