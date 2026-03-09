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
import { publishActiveSpoolSensor } from './services/haSensors';

const logger = LOG('SERVER');

const app = express();
const port = process.env.PORT || 3000;

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
    logger.info(`Server running on port ${port}`);

    startHAIntegration().catch((err) =>
      logger.warn('HA integration failed to start:', err)
    );
    startPeriodicChecks();

    // Publish initial active spool state so HA has data immediately.
    publishActiveSpoolSensor().catch((err) =>
      logger.warn('Failed to publish active spool sensor on startup:', err)
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
