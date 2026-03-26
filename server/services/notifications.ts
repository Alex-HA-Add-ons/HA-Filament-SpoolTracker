import { LOG } from '../utils/logger';
import { getHABaseUrl } from '../utils/haUrl';
import { getPrismaClient } from '../database';
import { publishAllSpooltrackerHASensors } from './haSensors';

const logger = LOG('NOTIFY');

export async function sendNotification(title: string, message: string): Promise<void> {
  const token = process.env.SUPERVISOR_TOKEN;
  if (!token) {
    logger.debug(`Notification (dev mode): ${title} — ${message}`);
    return;
  }

  const prisma = getPrismaClient();
  if (!prisma) {
    logger.debug(`Notification skipped (no database): ${title} — ${message}`);
    return;
  }

  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'notifications_enabled' } });
    const enabled = setting ? setting.value !== 'false' && setting.value !== '0' : true;
    if (!enabled) {
      logger.debug(`Notification suppressed by settings: ${title}`);
      return;
    }
  } catch (err) {
    logger.warn('Failed to read notifications_enabled setting, sending anyway:', err);
  }

  try {
    const response = await fetch(`${getHABaseUrl()}/api/services/persistent_notification/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        message,
        notification_id: `spooltracker_${Date.now()}`,
      }),
    });

    if (!response.ok) {
      logger.warn(`Failed to send notification: ${response.status} ${response.statusText}`);
    } else {
      logger.info(`Notification sent: ${title}`);
    }
  } catch (error) {
    logger.error('Failed to send HA notification:', error);
  }
}

export async function checkExpiringSpools(): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;

  try {
    const warningDays = 30;
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + warningDays);

    const expiringSpools = await prisma.spool.findMany({
      where: {
        archivedAt: null,
        expirationDate: {
          lte: warningDate,
          gte: new Date(),
        },
      },
    });

    for (const spool of expiringSpools) {
      const daysLeft = Math.ceil(
        ((spool.expirationDate as Date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      await sendNotification(
        `Spool Expiring Soon: ${spool.name}`,
        `Spool "${spool.name}" (${spool.filamentType}) expires in ${daysLeft} days.`
      );
    }
  } catch (error) {
    logger.error('Failed to check expiring spools:', error);
  }
}

export async function checkUnassignedJobs(): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;

  try {
    const unassigned = await prisma.printJob.count({
      where: { status: 'completed', spoolId: null },
    });

    if (unassigned > 0) {
      await sendNotification(
        'Unassigned Print Jobs',
        `You have ${unassigned} completed print job${unassigned > 1 ? 's' : ''} without a spool assigned. Open SpoolTracker to assign them.`
      );
    }
  } catch (error) {
    logger.error('Failed to check unassigned jobs:', error);
  }
}

export async function checkStuckInProgressJobs(): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;

  try {
    const [inProgress, activePrinters] = await Promise.all([
      prisma.printJob.count({ where: { status: 'in_progress' } }),
      prisma.printer.count({ where: { isActive: true } }),
    ]);

    if (inProgress > 0 && activePrinters === 0) {
      await sendNotification(
        'Stuck print jobs',
        `You have ${inProgress} print job${inProgress > 1 ? 's' : ''} marked as in progress while all printers are inactive. ` +
          'Please review them in SpoolTracker and update their status manually if needed.'
      );
    }
  } catch (error) {
    logger.error('Failed to check stuck in-progress jobs:', error);
  }
}

let checkInterval: ReturnType<typeof setInterval> | null = null;

export function startPeriodicChecks(): void {
  checkInterval = setInterval(async () => {
    await checkExpiringSpools();
    await checkUnassignedJobs();
    await checkStuckInProgressJobs();
    await publishAllSpooltrackerHASensors();
  }, 6 * 60 * 60 * 1000); // every 6 hours

  logger.info('Periodic notification checks started (every 6 hours)');
}

export function stopPeriodicChecks(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}
