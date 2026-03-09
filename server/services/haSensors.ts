import { LOG } from '../utils/logger';
import { getPrismaClient } from '../database';

const logger = LOG('HA_SENSORS');

async function setHASensorState(
  entityId: string,
  state: string,
  attributes?: Record<string, unknown>,
): Promise<void> {
  const token = process.env.SUPERVISOR_TOKEN;
  if (!token) {
    logger.debug(`HA sensor update skipped (no SUPERVISOR_TOKEN): ${entityId}=${state}`);
    return;
  }

  try {
    const res = await fetch(`http://supervisor/core/api/states/${encodeURIComponent(entityId)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state,
        attributes,
      }),
    });

    if (!res.ok) {
      logger.warn(`Failed to update HA sensor ${entityId}: ${res.status} ${res.statusText}`);
    } else {
      logger.debug(`Updated HA sensor ${entityId}=${state}`);
    }
  } catch (err) {
    logger.error('Error updating HA sensor:', err);
  }
}

/**
 * Publish a single \"active spool\" sensor with grams remaining and attributes:
 * initial grams, percent remaining, type, color.
 */
export async function publishActiveSpoolSensor(): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;

  try {
    // Prefer spools that are currently loaded on a printer, fall back to legacy isActive flag.
    const activeSpools = await prisma.spool.findMany({
      where: {
        isArchived: false,
        OR: [
          { loadedOnPrinter: { isNot: null } },
          { isActive: true },
        ],
      },
      include: {
        loadedOnPrinter: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 1,
    });

    const entityId = 'sensor.spooltracker_active_spool_remaining_g';

    if (activeSpools.length === 0) {
      await setHASensorState(entityId, '0', {
        unit_of_measurement: 'g',
        friendly_name: 'SpoolTracker Active Spool Remaining',
        spool_id: null,
        initial_grams: null,
        percent_remaining: 0,
        filament_type: null,
        color: null,
      });
      return;
    }

    const spool = activeSpools[0];
    const remaining = spool.remainingWeight ?? 0;
    const initial = spool.initialWeight || 0;
    const percent = initial > 0 ? Math.max(0, Math.min(100, Math.round((remaining / initial) * 100))) : 0;

    await setHASensorState(entityId, String(Math.round(remaining)), {
      unit_of_measurement: 'g',
      friendly_name: 'SpoolTracker Active Spool Remaining',
      spool_id: spool.id,
      spool_name: spool.name,
      initial_grams: initial,
      percent_remaining: percent,
      filament_type: spool.filamentType,
      color: spool.colorHex || spool.color,
    });
  } catch (err) {
    logger.error('Failed to publish active spool sensor:', err);
  }
}

