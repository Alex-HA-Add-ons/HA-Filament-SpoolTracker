import express from 'express';
import cors from 'cors';
import path from 'path';
import 'dotenv/config';

import { initializeConnections, setupGracefulShutdown } from './database';
import { ingressMiddleware } from './middleware/ingressMiddleware';
import { requestLogger } from './middleware/requestLogger';
import routes from './routes';
import { LOG } from './utils/logger';
import { startHAIntegration } from './services/haIntegration';
import { startPeriodicChecks } from './services/notifications';
import { publishAllSpooltrackerHASensors } from './services/haSensors';

const logger = LOG('SERVER');

const app = express();
const port = Number(process.env.PORT) || 3000;

function logStartupEndpoints(listenPort: number): void {
  const p = String(listenPort);
  logger.info('--- SpoolTracker endpoints ---');
  logger.info(`Listening on port ${p} (this process)`);

  if (process.env.HOME_ASSISTANT === 'true') {
    const hostname = process.env.ADDON_HOSTNAME;
    const ingress = process.env.ADDON_INGRESS_URL;

    if (hostname) {
      logger.info(
        `API on supervisor Docker network (e.g. rest_command): http://${hostname}:${p}/api`,
      );
    } else {
      logger.info(
        `API: http://127.0.0.1:${p}/api — use your host IP and published port in rest_command if Home Assistant is not on this container network`,
      );
    }

    if (ingress) {
      logger.info(`Ingress (sidebar web UI): ${ingress}`);
    }
  } else {
    logger.info(`API: http://127.0.0.1:${p}/api`);
  }

  logger.info('------------------------------');
}

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    /^https?:\/\/.*\.home-assistant\.io$/,
    /^https?:\/\/.*\.local$/,
    /^https?:\/\/.*\.lan$/
  ],
  credentials: true
}));
app.use(express.json());
app.use('/api', requestLogger);
app.use(ingressMiddleware);

const isProduction = process.env.NODE_ENV === 'production' || process.env.HOME_ASSISTANT === 'true';
if (isProduction) {
  const clientPath = process.env.CLIENT_PATH || path.join(process.cwd(), '../client');
  const staticPath = path.join(clientPath, 'dist');
  logger.info('Serving static files from:', staticPath);
  app.use(express.static(staticPath));
}

app.use(routes);

app.get('{*path}', (_req, res) => {
  const clientPath = process.env.CLIENT_PATH || path.join(process.cwd(), '../client');
  const indexPath = path.join(clientPath, 'dist/index.html');
  res.sendFile(indexPath);
});

async function startServer() {
  await initializeConnections();

  setupGracefulShutdown();

  const server = app.listen(port, () => {
    logStartupEndpoints(port);

    startHAIntegration().catch((err) =>
      logger.warn('HA integration failed to start:', err)
    );
    startPeriodicChecks();

    // Publish initial HA sensors so Home Assistant has data immediately.
    publishAllSpooltrackerHASensors().catch((err) =>
      logger.warn('Failed to publish SpoolTracker HA sensors on startup:', err)
    );

    logger.info('Startup completed successfully');
  });

  server.on('error', (error) => {
    logger.error('Server error:', error);
    throw error;
  });
}

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
