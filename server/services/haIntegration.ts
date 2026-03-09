import WebSocket from 'ws';
import { getPrismaClient } from '../database';
import { LOG } from '../utils/logger';
import { fetchAndCacheCoverImage } from './coverImageCache';
import { sendNotification } from './notifications';
import { publishActiveSpoolSensor } from './haSensors';

const logger = LOG('HA_INTEGRATION');

let haSocket: WebSocket | null = null;
let messageId = 1;
let isConnected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let subscriptionId: number | null = null;

const trackedPrintStates = new Map<string, {
  printerId: string | null;
  lastStatus: string;
  printJobId: string | null;
}>();

function nextId(): number {
  return messageId++;
}

export function isHAConnected(): boolean {
  return isConnected;
}

export async function startHAIntegration(): Promise<void> {
  const token = process.env.SUPERVISOR_TOKEN;
  if (!token) {
    logger.info('SUPERVISOR_TOKEN not set — HA integration disabled (development mode)');
    return;
  }

  connect(token);
}

function connect(token: string): void {
  if (haSocket) {
    try { haSocket.close(); } catch { /* ignore */ }
  }

  logger.info('Connecting to Home Assistant WebSocket API...');
  haSocket = new WebSocket('ws://supervisor/core/websocket');

  haSocket.on('open', () => {
    logger.info('WebSocket connection opened to HA');
  });

  haSocket.on('message', (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleHAMessage(msg, token);
    } catch (error) {
      logger.error('Failed to parse HA message:', error);
    }
  });

  haSocket.on('close', () => {
    logger.warn('HA WebSocket connection closed');
    isConnected = false;
    subscriptionId = null;
    scheduleReconnect(token);
  });

  haSocket.on('error', (error: Error) => {
    logger.error('HA WebSocket error:', error);
    isConnected = false;
  });
}

function scheduleReconnect(token: string): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    logger.info('Attempting to reconnect to HA...');
    connect(token);
  }, 30000);
}

function send(msg: Record<string, unknown>): void {
  if (haSocket && haSocket.readyState === WebSocket.OPEN) {
    haSocket.send(JSON.stringify(msg));
  }
}

function handleHAMessage(msg: Record<string, unknown>, token: string): void {
  switch (msg.type) {
    case 'auth_required':
      send({ type: 'auth', access_token: token });
      break;

    case 'auth_ok':
      logger.info('Authenticated with Home Assistant');
      isConnected = true;
      subscribeToStateChanges();
      break;

    case 'auth_invalid':
      logger.error('HA authentication failed:', msg.message);
      isConnected = false;
      break;

    case 'event':
      if ((msg as Record<string, unknown>).id === subscriptionId) {
        const event = (msg as { event?: { data?: { entity_id?: string; new_state?: Record<string, unknown>; old_state?: Record<string, unknown> } } }).event;
        if (event?.data) {
          handleStateChange(event.data);
        }
      }
      break;

    case 'result':
      if ((msg as { success?: boolean }).success) {
        logger.debug('HA command succeeded, id:', msg.id);
      } else {
        logger.warn('HA command failed:', msg);
      }
      break;
  }
}

function subscribeToStateChanges(): void {
  const id = nextId();
  subscriptionId = id;
  send({
    id,
    type: 'subscribe_events',
    event_type: 'state_changed',
  });
  logger.info('Subscribed to HA state_changed events');
}

const PRINT_STATUS_STATES = new Set([
  'running', 'printing', 'idle', 'finish', 'finished', 'completed', 'failed', 'offline', 'unknown', 'unavailable',
]);

async function handleStateChange(data: {
  entity_id?: string;
  new_state?: Record<string, unknown>;
  old_state?: Record<string, unknown>;
}): Promise<void> {
  const { entity_id, new_state, old_state } = data;
  if (!entity_id || !new_state) return;

  if (!entity_id.endsWith('_print_status')) return;

  const state = (new_state.state as string)?.toLowerCase();
  const manufacturer = ((new_state.attributes as Record<string, unknown>)?.manufacturer as string)?.toLowerCase() ?? '';

  const prefix = entity_id.replace(/^sensor\./, '').replace(/_print_status$/, '');
  const isBambu =
    entity_id.toLowerCase().includes('bambu') ||
    manufacturer.includes('bambu') ||
    (PRINT_STATUS_STATES.has(state ?? '') && /^(p1|p2|p2s|x1|x1c|a1|a1m|h2|p1s)(_|$)/i.test(prefix));

  logger.debug(`Print status event: entity_id=${entity_id} state=${state} isBambu=${isBambu} prefix=${prefix}`);

  if (!isBambu) return;

  await handlePrintStatusChange(entity_id, new_state, old_state);
}

async function handlePrintStatusChange(
  entityId: string,
  newState: Record<string, unknown>,
  oldState?: Record<string, unknown> | null,
): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;

  const newStatus = (newState.state as string)?.toLowerCase();
  const oldStatus = (oldState?.state as string)?.toLowerCase();

  if (newStatus === oldStatus) return;

  const printerPrefix = entityId.replace(/_print_status$/, '').replace(/^sensor\./, '');

  const isPrinting = newStatus === 'running' || newStatus === 'printing';
  const isFinished = newStatus === 'finish' || newStatus === 'finished' || newStatus === 'completed' || newStatus === 'idle';
  const isFailed = newStatus === 'failed';
  const wasPrinting = oldStatus === 'running' || oldStatus === 'printing';

  if (isPrinting && !wasPrinting) {
    await onPrintStarted(prisma, printerPrefix, entityId);
  } else if ((isFinished || isFailed) && wasPrinting) {
    await onPrintFinished(prisma, printerPrefix, isFailed);
  }
}

async function onPrintStarted(
  prisma: NonNullable<ReturnType<typeof getPrismaClient>>,
  printerPrefix: string,
  _entityId: string,
): Promise<void> {
  try {
    let printer = await prisma.printer.findFirst({
      where: { entityPrefix: { contains: printerPrefix } },
    });

    if (!printer) {
      printer = await prisma.printer.create({
        data: {
          name: printerPrefix.replace(/_/g, ' '),
          haDeviceId: printerPrefix,
          entityPrefix: printerPrefix,
        },
      });
      logger.info(`Auto-registered printer: ${printer.name}`);
    }

    const taskNameEntity = printer.entityTaskName ?? `sensor.${printerPrefix}_task_name`;
    const printWeightEntity = printer.entityPrintWeight ?? `sensor.${printerPrefix}_print_weight`;
    const coverImageEntity = printer.entityCoverImage ?? `image.${printerPrefix}_cover_image`;
    const projectName = await fetchEntityState(taskNameEntity) || 'Unknown Print';
    const printWeight = await fetchEntityState(printWeightEntity);
    const coverImageHaPath = await fetchEntityValue(coverImageEntity, 'entity_picture');

    const job = await prisma.printJob.create({
      data: {
        printerId: printer.id,
        projectName,
        projectImage: null,
        filamentUsed: printWeight ? parseFloat(printWeight) : null,
        status: 'in_progress',
      },
    });

    if (coverImageHaPath && coverImageHaPath.startsWith('/')) {
      const cachedPath = await fetchAndCacheCoverImage(coverImageHaPath, job.id);
      if (cachedPath) {
        await prisma.printJob.update({
          where: { id: job.id },
          data: { projectImage: cachedPath },
        });
      }
    }

    trackedPrintStates.set(printerPrefix, {
      printerId: printer.id,
      lastStatus: 'in_progress',
      printJobId: job.id,
    });

    logger.info(`Print started: "${projectName}" on ${printer.name}`);
  } catch (error) {
    logger.error('Failed to log print start:', error);
  }
}

async function onPrintFinished(
  prisma: NonNullable<ReturnType<typeof getPrismaClient>>,
  printerPrefix: string,
  failed: boolean,
): Promise<void> {
  try {
    const tracked = trackedPrintStates.get(printerPrefix);
    if (!tracked?.printJobId) {
      logger.warn(`No tracked print job for printer prefix: ${printerPrefix}`);
      return;
    }

    const status = failed ? 'failed' : 'completed';

    const printerRecord = tracked.printerId
      ? await prisma.printer.findUnique({ where: { id: tracked.printerId }, include: { activeSpool: true } })
      : await prisma.printer.findFirst({ where: { entityPrefix: { contains: printerPrefix } }, include: { activeSpool: true } });
    const printWeightEntity = printerRecord?.entityPrintWeight ?? `sensor.${printerPrefix}_print_weight`;
    const printWeight = await fetchEntityState(printWeightEntity);
    const filamentUsed = printWeight ? parseFloat(printWeight) : null;

    const currentJob = await prisma.printJob.findUnique({ where: { id: tracked.printJobId }, select: { spoolId: true } });
    const spoolToDeduct = currentJob?.spoolId ?? printerRecord?.activeSpoolId ?? null;

    const job = await prisma.printJob.update({
      where: { id: tracked.printJobId },
      data: {
        status,
        completedAt: new Date(),
        filamentUsed: filamentUsed ?? undefined,
        progress: failed ? undefined : 100,
        ...(spoolToDeduct != null && currentJob?.spoolId == null ? { spoolId: spoolToDeduct } : {}),
      },
      include: { spool: true },
    });

    const effectiveSpoolId = job.spoolId ?? spoolToDeduct;
    if (!failed && effectiveSpoolId && filamentUsed) {
      const spool = await prisma.spool.findUnique({ where: { id: effectiveSpoolId } });
      if (spool) {
        const newWeight = Math.max(0, spool.remainingWeight - filamentUsed);
        await prisma.spool.update({
          where: { id: effectiveSpoolId },
          data: { remainingWeight: newWeight },
        });
        logger.info(`Deducted ${filamentUsed}g from spool "${spool.name}" (${newWeight}g remaining)`);

        const settings = await prisma.setting.findUnique({ where: { key: 'low_filament_threshold' } });
        const threshold = settings ? parseFloat(settings.value) : 100;
        if (newWeight <= threshold) {
          await sendNotification(
            `Low Filament: ${spool.name}`,
            `Spool "${spool.name}" has only ${Math.round(newWeight)}g remaining (threshold: ${threshold}g).`
          );
        }
      }
    }

    if (!effectiveSpoolId) {
      await sendNotification(
        'Unassigned Print Job',
        `Print job "${job.projectName}" completed but has no spool assigned. Assign a spool to printer "${printerRecord?.name ?? 'this printer'}" or to the print job in SpoolTracker.`
      );
    }

    trackedPrintStates.delete(printerPrefix);
    logger.info(`Print ${status}: "${job.projectName}"`);

    // Spool remaining weight may have changed; refresh the HA sensor.
    await publishActiveSpoolSensor();
  } catch (error) {
    logger.error('Failed to log print finish:', error);
  }
}

async function fetchEntityState(entityId: string): Promise<string | null> {
  const token = process.env.SUPERVISOR_TOKEN;
  if (!token) return null;

  try {
    const response = await fetch(`http://supervisor/core/api/states/${entityId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data = await response.json() as { state?: string };
    return data.state === 'unknown' || data.state === 'unavailable' ? null : data.state ?? null;
  } catch {
    return null;
  }
}

/** Fetch state or a specific attribute. attribute "state" or omitted = entity state; else attributes[attribute]. */
async function fetchEntityValue(entityId: string, attribute?: string): Promise<string | null> {
  const token = process.env.SUPERVISOR_TOKEN;
  if (!token) return null;
  const attr = attribute ?? 'state';
  try {
    const normalized = entityId.toLowerCase();
    const response = await fetch(`http://supervisor/core/api/states/${encodeURIComponent(normalized)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data = await response.json() as { state?: string; attributes?: Record<string, unknown> };
    if (attr === 'state') {
      const state = data.state;
      return state === 'unknown' || state === 'unavailable' || state === undefined ? null : (state ?? null);
    }
    const v = data.attributes?.[attr];
    return typeof v === 'string' ? v : (v != null ? String(v) : null);
  } catch {
    return null;
  }
}

export function stopHAIntegration(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (haSocket) {
    try { haSocket.close(); } catch { /* ignore */ }
    haSocket = null;
  }
  isConnected = false;
  logger.info('HA integration stopped');
}
