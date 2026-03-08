/**
 * MCPSearch API Server
 *
 * Main entry point for the API service.
 */

// Load environment variables first
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger.js';
import { config } from './lib/config.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { createRouter } from './routes/index.js';
import { getRedisClient, checkRedisHealth } from './lib/cache.js';
import { checkSearchHealth, createPackagesIndex } from './lib/search.js';

async function main() {
  const app = express();

  // Trust proxy (for rate limiting behind load balancer)
  app.set('trust proxy', 1);

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Cookie parsing (for session tokens)
  app.use(cookieParser());

  // Request logging
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => {
          // Don't log health check requests
          return req.url === '/health' || req.url === '/health/live';
        },
      },
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          query: req.query,
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
    })
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ==========================================================================
  // Health Check Endpoints
  // ==========================================================================

  // Basic health check (for load balancer)
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      version: config.version,
      timestamp: new Date().toISOString(),
    });
  });

  // Liveness probe (is the process running?)
  app.get('/health/live', (_req, res) => {
    res.json({ status: 'alive' });
  });

  // Readiness probe (can the service handle requests?)
  app.get('/health/ready', async (_req, res) => {
    const checks: Record<string, { status: string; latencyMs?: number }> = {};

    // Check Redis
    const redisHealth = await checkRedisHealth();
    checks['cache'] = redisHealth;

    // Check OpenSearch
    const searchHealth = await checkSearchHealth();
    checks['search'] = searchHealth;

    // Overall status
    const allHealthy = Object.values(checks).every(
      (c) => c.status === 'ok' || c.status === 'disconnected'
    );

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  // ==========================================================================
  // API Routes
  // ==========================================================================

  // Mount API routes at /api/v1 and /v1 (for flexibility)
  const router = createRouter();
  app.use('/api/v1', router);
  app.use('/v1', router);

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  app.use(notFoundHandler);
  app.use(errorHandler);

  // ==========================================================================
  // Initialization
  // ==========================================================================

  // Initialize Redis connection
  const redis = getRedisClient();
  if (redis) {
    logger.info('Redis client initialized');
  } else {
    logger.warn('Redis client not available - caching disabled');
  }

  // Initialize OpenSearch index
  if (config.opensearch.endpoint) {
    try {
      await createPackagesIndex();
      logger.info('OpenSearch index ready');
    } catch (error) {
      logger.warn({ error }, 'Failed to initialize OpenSearch - search may not work');
    }
  }

  // ==========================================================================
  // Start Server
  // ==========================================================================

  const server = app.listen(config.port, () => {
    logger.info(
      {
        port: config.port,
        env: config.env,
        version: config.version,
        corsOrigins: config.corsOrigins,
      },
      'MCPSearch API server started'
    );
  });

  // Configure server timeouts
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  // ==========================================================================
  // Graceful Shutdown
  // ==========================================================================

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');

    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Close Redis connection
    const redisClient = getRedisClient();
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }

    // Wait for existing requests to finish
    await new Promise((resolve) => setTimeout(resolve, 5000));

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled rejection');
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
