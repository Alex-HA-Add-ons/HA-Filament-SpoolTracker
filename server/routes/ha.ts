import { Router, Request, Response } from 'express';
import { LOG } from '../utils/logger';

const logger = LOG('HA');
const router: Router = Router();

router.get('/ha/status', async (_req: Request, res: Response) => {
  try {
    const supervisorToken = process.env.SUPERVISOR_TOKEN;
    if (!supervisorToken) {
      return res.json({ connected: false, printerCount: 0 });
    }

    const response = await fetch('http://supervisor/core/api/states', {
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });

    if (!response.ok) {
      return res.json({ connected: false, printerCount: 0 });
    }

    const states = await response.json() as Array<{ entity_id: string; attributes?: { manufacturer?: string } }>;
    const bambuEntities = states.filter(
      (s) => s.entity_id.includes('bambu') || s.attributes?.manufacturer === 'Bambu Lab'
    );
    const deviceIds = new Set(
      bambuEntities.map((e) => e.entity_id.split('.')[1]?.split('_').slice(0, -1).join('_')).filter(Boolean)
    );

    res.json({ connected: true, printerCount: deviceIds.size });
  } catch (error) {
    logger.error('Failed to get HA status:', error);
    res.json({ connected: false, printerCount: 0 });
  }
});

router.get('/ha/entities', async (_req: Request, res: Response) => {
  try {
    const supervisorToken = process.env.SUPERVISOR_TOKEN;
    if (!supervisorToken) {
      return res.json([]);
    }

    const response = await fetch('http://supervisor/core/api/states', {
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });

    if (!response.ok) {
      return res.json([]);
    }

    const states = await response.json() as Array<{
      entity_id: string;
      state: string;
      attributes?: Record<string, unknown>;
    }>;

    const bambuEntities = states.filter(
      (s) => s.entity_id.includes('bambu') ||
             (s.attributes?.manufacturer as string)?.toLowerCase().includes('bambu')
    );

    const grouped: Record<string, {
      deviceId: string;
      deviceName: string;
      model: string | null;
      entities: string[];
    }> = {};

    for (const entity of bambuEntities) {
      const parts = entity.entity_id.split('.');
      const prefix = parts[1]?.split('_').slice(0, -1).join('_') || parts[1] || 'unknown';

      if (!grouped[prefix]) {
        grouped[prefix] = {
          deviceId: prefix,
          deviceName: (entity.attributes?.friendly_name as string)?.split(' ').slice(0, -1).join(' ') || prefix,
          model: (entity.attributes?.model as string) || null,
          entities: [],
        };
      }
      grouped[prefix].entities.push(entity.entity_id);
    }

    res.json(Object.values(grouped).map((g) => ({
      entityId: g.entities[0],
      ...g,
    })));
  } catch (error) {
    logger.error('Failed to discover HA entities:', error);
    res.json([]);
  }
});

export default router;
