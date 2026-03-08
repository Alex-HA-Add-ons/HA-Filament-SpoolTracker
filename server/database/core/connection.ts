import 'dotenv/config';
import { LOG } from '../../utils/logger';

const logger = LOG('DB');

let prismaClient: any = null;
let isInitialized = false;
let isDisabled = false;

export async function initializeConnections(): Promise<void> {
  if (isInitialized) {
    logger.warn('Database connection already initialized');
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.info('DATABASE_URL not set — running without database');
    isDisabled = true;
    return;
  }

  try {
    const { PrismaClient } = await import('../../generated/prisma/client');
    const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');

    logger.info('Initializing database connection...');
    const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
    prismaClient = new PrismaClient({ adapter });
    await prismaClient.$connect();

    isInitialized = true;
    logger.info('Database connection initialized successfully');
  } catch (error) {
    logger.warn('Database connection failed — running without database:', error);
    await cleanupConnection();
    isDisabled = true;
  }
}

export function getPrismaClient(): any | null {
  if (isDisabled) return null;
  if (!prismaClient || !isInitialized) {
    return null;
  }
  return prismaClient;
}

export function isDatabaseInitialized(): boolean {
  return isInitialized;
}

export function isDatabaseDisabled(): boolean {
  return isDisabled;
}

export function getConnectionStatus() {
  return {
    initialized: isInitialized,
    disabled: isDisabled,
    connected: isInitialized && !!prismaClient
  };
}

async function cleanupConnection(): Promise<void> {
  try {
    if (prismaClient) {
      await prismaClient.$disconnect();
      prismaClient = null;
    }
    isInitialized = false;
  } catch (error) {
    logger.error('Error during connection cleanup:', error);
  }
}

export async function closeConnections(): Promise<void> {
  if (isInitialized) {
    try {
      logger.info('Closing database connection...');
      await cleanupConnection();
      logger.info('Database connection closed successfully');
    } catch (error) {
      logger.error('Error closing database connection:', error);
      throw error;
    }
  }
}

export function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await closeConnections();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
