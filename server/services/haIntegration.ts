import WebSocket from 'ws';
import { getPrismaClient } from '../database';
import { LOG } from '../utils/logger';
import { sendNotification } from './notifications';

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

async function handleStateChange(data: {
  entity_id?: string;
  new_state?: Record<string, unknown>;
  old_state?: Record<string, unknown>;
}): Promise<void> {
  const { entity_id, new_state, old_state } = data;
  if (!entity_id || !new_state) return;

  const isBambu = entity_id.includes('bambu') ||
    ((new_state.attributes as Record<string, unknown>)?.manufacturer as string)?.toLowerCase().includes('bambu');

  if (!isBambu) return;

  if (entity_id.endsWith('_print_status')) {
    await handlePrintStatusChange(entity_id, new_state, old_state);
  }
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
  const isFinished = newStatus === 'finish' || newStatus === 'completed' || newStatus === 'idle';
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

    const projectName = await fetchEntityState(`sensor.${printerPrefix}_task_name`) || 'Unknown Print';
    const printWeight = await fetchEntityState(`sensor.${printerPrefix}_print_weight`);
    const coverImage = await fetchEntityState(`sensor.${printerPrefix}_cover_image`);

    const job = await prisma.printJob.create({
      data: {
        printerId: printer.id,
        projectName,
        projectImage: coverImage || null,
        filamentUsed: printWeight ? parseFloat(printWeight) : null,
        status: 'in_progress',
      },
    });

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

    const printWeight = await fetchEntityState(`sensor.${printerPrefix}_print_weight`);
    const filamentUsed = printWeight ? parseFloat(printWeight) : null;

    const job = await prisma.printJob.update({
      where: { id: tracked.printJobId },
      data: {
        status,
        completedAt: new Date(),
        filamentUsed: filamentUsed ?? undefined,
        progress: failed ? undefined : 100,
      },
      include: { spool: true },
    });

    if (!failed && job.spoolId && filamentUsed) {
      const spool = await prisma.spool.findUnique({ where: { id: job.spoolId } });
      if (spool) {
        const newWeight = Math.max(0, spool.remainingWeight - filamentUsed);
        await prisma.spool.update({
          where: { id: job.spoolId },
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

    if (!job.spoolId) {
      await sendNotification(
        'Unassigned Print Job',
        `Print job "${job.projectName}" completed but has no spool assigned. Please assign a spool in SpoolTracker.`
      );
    }

    trackedPrintStates.delete(printerPrefix);
    logger.info(`Print ${status}: "${job.projectName}"`);
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
    const state = await response.json() as { state?: string };
    return state.state === 'unknown' || state.state === 'unavailable' ? null : state.state ?? null;
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
