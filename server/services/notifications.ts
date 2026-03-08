import { LOG } from '../utils/logger';
import { getPrismaClient } from '../database';

const logger = LOG('NOTIFY');

export async function sendNotification(title: string, message: string): Promise<void> {
  const token = process.env.SUPERVISOR_TOKEN;
  if (!token) {
    logger.debug(`Notification (dev mode): ${title} — ${message}`);
    return;
  }

  try {
    const response = await fetch('http://supervisor/core/api/services/persistent_notification/create', {
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
        isArchived: false,
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

let checkInterval: ReturnType<typeof setInterval> | null = null;

export function startPeriodicChecks(): void {
  checkInterval = setInterval(async () => {
    await checkExpiringSpools();
    await checkUnassignedJobs();
  }, 6 * 60 * 60 * 1000); // every 6 hours

  logger.info('Periodic notification checks started (every 6 hours)');
}

export function stopPeriodicChecks(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}
