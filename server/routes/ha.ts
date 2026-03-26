import { Router, Request, Response } from 'express';
import { LOG } from '../utils/logger';
import { getHABaseUrl } from '../utils/haUrl';
import { getPrismaClient } from '../database';
import { assignActiveSpoolToPrinter, AssignSpoolError } from '../services/assignActiveSpool';
import { publishAllSpooltrackerHASensors } from '../services/haSensors';

const logger = LOG('HA');
const router: Router = Router();

router.get('/ha/status', async (_req: Request, res: Response) => {
  try {
    const supervisorToken = process.env.SUPERVISOR_TOKEN;
    if (!supervisorToken) {
      return res.json({ connected: false, printerCount: 0 });
    }

    const response = await fetch(`${getHABaseUrl()}/api/states`, {
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

    const response = await fetch(`${getHABaseUrl()}/api/states`, {
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

/**
 * GET /ha/entities/states?ids=id1,id2[entity_picture],id3
 * Returns { [request_key]: value }. Use id[attribute] to get attributes[attribute] instead of state.
 * Example: sensor.x_cover_image[entity_picture] -> entity_picture attribute of that entity.
 */
function parseIdAndAttribute(requestKey: string): { entityId: string; attribute: string } {
  const bracket = requestKey.indexOf('[');
  if (bracket === -1) {
    return { entityId: requestKey, attribute: 'state' };
  }
  const entityId = requestKey.slice(0, bracket).trim();
  const attr = requestKey.slice(bracket + 1).replace(/]\s*$/, '').trim();
  return { entityId, attribute: attr || 'state' };
}

router.get('/ha/entities/states', async (req: Request, res: Response) => {
  try {
    const supervisorToken = process.env.SUPERVISOR_TOKEN;
    const idsParam = typeof req.query.ids === 'string' ? req.query.ids : '';
    const requestKeys = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
    if (!supervisorToken || requestKeys.length === 0) {
      return res.json({});
    }

    const results: Record<string, string | null> = {};
    await Promise.all(
      requestKeys.map(async (requestKey) => {
        try {
          const { entityId, attribute: attr } = parseIdAndAttribute(requestKey);
          const fetchId = entityId.toLowerCase();
          const response = await fetch(`${getHABaseUrl()}/api/states/${encodeURIComponent(fetchId)}`, {
            headers: { Authorization: `Bearer ${supervisorToken}` },
          });
          if (!response.ok) {
            results[requestKey] = null;
            return;
          }
          const raw = await response.json() as Record<string, unknown>;
          const data = (raw.data as Record<string, unknown>) ?? raw;
          const state = data.state as string | undefined;
          const attributes = (data.attributes as Record<string, unknown>) ?? {};
          let value: string | null;
          if (attr === 'state') {
            value = state === 'unknown' || state === 'unavailable' || state === undefined ? null : (state ?? null);
          } else {
            const v = attributes[attr];
            value = typeof v === 'string' ? v : (v != null ? String(v) : null);
          }
          results[requestKey] = value;
        } catch {
          results[requestKey] = null;
        }
      })
    );
    res.json(results);
  } catch (error) {
    logger.error('Failed to fetch entity states:', error);
    res.json({});
  }
});

router.post('/ha/set-active-spool', async (req: Request, res: Response) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  const spoolId = typeof req.body?.spoolId === 'string' ? req.body.spoolId.trim() : '';
  if (!spoolId) {
    return res.status(400).json({ error: 'spoolId is required' });
  }

  let printerId: string | undefined =
    typeof req.body?.printerId === 'string' ? req.body.printerId.trim() : undefined;
  if (!printerId) {
    const printers = await prisma.printer.findMany({ select: { id: true } });
    if (printers.length !== 1) {
      return res.status(400).json({ error: 'printerId is required when multiple printers exist' });
    }
    printerId = printers[0].id;
  }

  try {
    const printer = await assignActiveSpoolToPrinter(prisma, printerId, spoolId);
    await publishAllSpooltrackerHASensors();
    res.json(printer);
  } catch (err) {
    if (err instanceof AssignSpoolError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error('set-active-spool failed:', err);
    res.status(500).json({ error: 'Failed to set active spool' });
  }
});

export default router;
